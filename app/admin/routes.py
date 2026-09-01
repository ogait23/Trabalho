from datetime import datetime
from functools import wraps

from flask import current_app, flash, redirect, render_template, request, session, url_for
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash

from app.admin import admin_bp
from app.extensions import db
from app.models import (
    CATEGORIA_TIPOS,
    Categoria,
    FORMAS_PAGAMENTO,
    Garcom,
    ItemPedido,
    Mesa,
    Pagamento,
    Pedido,
    Produto,
    STATUS_MESA,
    STATUS_PEDIDO,
    Tamanho,
    calcular_preco_unitario,
    validar_selecao_item,
    validar_tipo_pedido,
)

CHAVE_SESSAO_ADMIN = "admin_logado"


def login_obrigatorio(funcao):
    @wraps(funcao)
    def decorada(*args, **kwargs):
        if not session.get(CHAVE_SESSAO_ADMIN):
            return redirect(url_for("admin.login"))
        return funcao(*args, **kwargs)

    return decorada


@admin_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usuario = request.form.get("usuario", "")
        senha = request.form.get("senha", "")

        usuario_valido = usuario == current_app.config["ADMIN_USUARIO"]
        hash_configurado = current_app.config["ADMIN_SENHA_HASH"]
        senha_valida = bool(hash_configurado) and check_password_hash(hash_configurado, senha)

        if usuario_valido and senha_valida:
            session[CHAVE_SESSAO_ADMIN] = True
            return redirect(url_for("admin.listar_pedidos"))

        flash("Usuário ou senha inválidos.", "erro")

    return render_template("admin/login.html")


@admin_bp.route("/logout")
def logout():
    session.pop(CHAVE_SESSAO_ADMIN, None)
    return redirect(url_for("admin.login"))


@admin_bp.route("/")
@login_obrigatorio
def painel():
    return redirect(url_for("admin.listar_pedidos"))


@admin_bp.route("/mesas")
@login_obrigatorio
def listar_mesas():
    mesas = Mesa.query.order_by(Mesa.numero).all()
    return render_template("admin/mesas.html", mesas=mesas, status_mesa=STATUS_MESA)


@admin_bp.route("/mesas/nova", methods=["POST"])
@login_obrigatorio
def nova_mesa():
    numero = request.form.get("numero", type=int)
    if not numero:
        flash("Informe o número da mesa.", "erro")
        return redirect(url_for("admin.listar_mesas"))

    mesa = Mesa(numero=numero, status="livre")
    db.session.add(mesa)
    try:
        db.session.commit()
        flash("Mesa cadastrada.", "sucesso")
    except IntegrityError:
        db.session.rollback()
        flash("Já existe uma mesa com esse número.", "erro")

    return redirect(url_for("admin.listar_mesas"))


@admin_bp.route("/mesas/<int:mesa_id>/status", methods=["POST"])
@login_obrigatorio
def atualizar_status_mesa(mesa_id):
    mesa = Mesa.query.get_or_404(mesa_id)
    novo_status = request.form.get("status")

    if novo_status not in dict(STATUS_MESA):
        flash("Status de mesa inválido.", "erro")
        return redirect(url_for("admin.listar_mesas"))

    mesa.status = novo_status
    db.session.commit()
    flash("Status da mesa atualizado.", "sucesso")
    return redirect(url_for("admin.listar_mesas"))


@admin_bp.route("/pedidos")
@login_obrigatorio
def listar_pedidos():
    status_filtro = request.args.get("status", "")
    consulta = Pedido.query.order_by(Pedido.data_criacao.desc())
    if status_filtro:
        consulta = consulta.filter_by(status=status_filtro)
    pedidos = consulta.all()
    return render_template(
        "admin/pedidos.html",
        pedidos=pedidos,
        status_pedido=STATUS_PEDIDO,
        status_filtro=status_filtro,
    )


@admin_bp.route("/pedidos/mesa/novo", methods=["GET", "POST"])
@login_obrigatorio
def novo_pedido_mesa():
    mesas_livres = Mesa.query.filter(Mesa.status != "ocupada").order_by(Mesa.numero).all()
    garcons = Garcom.query.order_by(Garcom.nome).all()

    if request.method == "POST":
        mesa_id = request.form.get("mesa_id", type=int)
        garcom_id = request.form.get("garcom_id", type=int)

        mesa = Mesa.query.get(mesa_id) if mesa_id else None
        garcom = Garcom.query.get(garcom_id) if garcom_id else None

        try:
            validar_tipo_pedido("mesa", mesa=mesa)
        except ValueError as erro:
            flash(str(erro), "erro")
            return redirect(url_for("admin.novo_pedido_mesa"))

        if garcom is None:
            flash("Escolha o garçom responsável.", "erro")
            return redirect(url_for("admin.novo_pedido_mesa"))

        pedido = Pedido(tipo="mesa", mesa=mesa, garcom=garcom, status="recebido")
        mesa.status = "ocupada"
        db.session.add(pedido)
        db.session.commit()

        flash("Pedido de mesa aberto.", "sucesso")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    return render_template("admin/pedido_mesa_form.html", mesas=mesas_livres, garcons=garcons)


@admin_bp.route("/pedidos/<int:pedido_id>")
@login_obrigatorio
def detalhe_pedido(pedido_id):
    pedido = Pedido.query.get_or_404(pedido_id)
    produtos = Produto.query.filter_by(disponivel=True).order_by(Produto.nome).all()
    tamanhos = Tamanho.query.order_by(Tamanho.ordem).all()
    return render_template(
        "admin/pedido_detalhe.html",
        pedido=pedido,
        status_pedido=STATUS_PEDIDO,
        formas_pagamento=FORMAS_PAGAMENTO,
        produtos=produtos,
        tamanhos=tamanhos,
    )


@admin_bp.route("/pedidos/<int:pedido_id>/itens", methods=["POST"])
@login_obrigatorio
def adicionar_item_pedido(pedido_id):
    pedido = Pedido.query.get_or_404(pedido_id)

    if pedido.esta_bloqueado:
        flash("Este pedido já foi entregue ou cancelado.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    produto_id = request.form.get("produto_id", type=int)
    tamanho_id = request.form.get("tamanho_id", type=int)
    segundo_sabor_id = request.form.get("segundo_sabor_id", type=int)
    quantidade = request.form.get("quantidade", default=1, type=int)

    produto = Produto.query.get(produto_id)
    if produto is None:
        flash("Produto inválido.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    tamanho = Tamanho.query.get(tamanho_id) if tamanho_id else None
    segundo_sabor = Produto.query.get(segundo_sabor_id) if segundo_sabor_id else None

    if not quantidade or quantidade < 1:
        quantidade = 1

    try:
        validar_selecao_item(produto, tamanho, segundo_sabor)
    except ValueError as erro:
        flash(str(erro), "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    preco_unitario = calcular_preco_unitario(produto, tamanho, segundo_sabor)
    item = ItemPedido(
        produto_id=produto.id,
        segundo_sabor_id=segundo_sabor.id if segundo_sabor else None,
        tamanho_id=tamanho.id if tamanho else None,
        quantidade=quantidade,
        preco_unitario=preco_unitario,
    )
    pedido.itens.append(item)
    pedido.recalcular_total()
    db.session.commit()

    flash("Item adicionado ao pedido.", "sucesso")
    return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))


@admin_bp.route("/pedidos/<int:pedido_id>/itens/<int:item_id>/remover", methods=["POST"])
@login_obrigatorio
def remover_item_pedido(pedido_id, item_id):
    pedido = Pedido.query.get_or_404(pedido_id)

    if pedido.esta_bloqueado:
        flash("Este pedido já foi entregue ou cancelado.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    item = ItemPedido.query.get_or_404(item_id)
    if item.pedido_id != pedido.id:
        flash("Item não pertence a este pedido.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    pedido.itens.remove(item)
    pedido.recalcular_total()
    db.session.commit()

    flash("Item removido.", "sucesso")
    return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))


@admin_bp.route("/pedidos/<int:pedido_id>/status", methods=["POST"])
@login_obrigatorio
def atualizar_status_pedido(pedido_id):
    pedido = Pedido.query.get_or_404(pedido_id)

    if pedido.esta_bloqueado:
        flash("Este pedido já foi entregue ou cancelado e não pode mais ser alterado.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    novo_status = request.form.get("status")
    if novo_status not in dict(STATUS_PEDIDO):
        flash("Status inválido.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    pedido.status = novo_status
    if novo_status in ("entregue", "cancelado") and pedido.eh_mesa and pedido.mesa is not None:
        pedido.mesa.status = "livre"

    db.session.commit()
    flash("Status do pedido atualizado.", "sucesso")
    return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))


@admin_bp.route("/pedidos/<int:pedido_id>/fechar", methods=["POST"])
@login_obrigatorio
def fechar_conta(pedido_id):
    pedido = Pedido.query.get_or_404(pedido_id)

    if pedido.esta_bloqueado:
        flash("Este pedido já foi fechado.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    forma_pagamento = request.form.get("forma_pagamento")
    if forma_pagamento not in dict(FORMAS_PAGAMENTO):
        flash("Escolha uma forma de pagamento válida.", "erro")
        return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))

    pedido.forma_pagamento = forma_pagamento
    pedido.status = "entregue"

    pagamento = Pagamento(
        pedido=pedido,
        forma=forma_pagamento,
        valor=pedido.total,
        data_pagamento=datetime.utcnow(),
    )
    db.session.add(pagamento)

    if pedido.eh_mesa and pedido.mesa is not None:
        pedido.mesa.status = "livre"

    db.session.commit()
    flash("Conta fechada e pagamento registrado.", "sucesso")
    return redirect(url_for("admin.detalhe_pedido", pedido_id=pedido.id))


@admin_bp.route("/categorias")
@login_obrigatorio
def listar_categorias():
    categorias = Categoria.query.order_by(Categoria.tipo).all()
    return render_template("admin/categorias.html", categorias=categorias)


@admin_bp.route("/categorias/nova", methods=["GET", "POST"])
@login_obrigatorio
def nova_categoria():
    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        tipo = request.form.get("tipo", "")

        if not nome or tipo not in dict(CATEGORIA_TIPOS):
            flash("Preencha nome e um tipo válido.", "erro")
            return render_template("admin/categoria_form.html", categoria=None, tipos=CATEGORIA_TIPOS)

        categoria = Categoria(nome=nome, tipo=tipo)
        db.session.add(categoria)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("Já existe uma categoria com esse tipo.", "erro")
            return render_template("admin/categoria_form.html", categoria=None, tipos=CATEGORIA_TIPOS)

        flash("Categoria criada.", "sucesso")
        return redirect(url_for("admin.listar_categorias"))

    return render_template("admin/categoria_form.html", categoria=None, tipos=CATEGORIA_TIPOS)


@admin_bp.route("/categorias/<int:categoria_id>/editar", methods=["GET", "POST"])
@login_obrigatorio
def editar_categoria(categoria_id):
    categoria = Categoria.query.get_or_404(categoria_id)

    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        tipo = request.form.get("tipo", "")

        if not nome or tipo not in dict(CATEGORIA_TIPOS):
            flash("Preencha nome e um tipo válido.", "erro")
            return render_template("admin/categoria_form.html", categoria=categoria, tipos=CATEGORIA_TIPOS)

        categoria.nome = nome
        categoria.tipo = tipo
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("Já existe uma categoria com esse tipo.", "erro")
            return render_template("admin/categoria_form.html", categoria=categoria, tipos=CATEGORIA_TIPOS)

        flash("Categoria atualizada.", "sucesso")
        return redirect(url_for("admin.listar_categorias"))

    return render_template("admin/categoria_form.html", categoria=categoria, tipos=CATEGORIA_TIPOS)


@admin_bp.route("/categorias/<int:categoria_id>/excluir", methods=["POST"])
@login_obrigatorio
def excluir_categoria(categoria_id):
    categoria = Categoria.query.get_or_404(categoria_id)
    db.session.delete(categoria)
    try:
        db.session.commit()
        flash("Categoria excluída.", "sucesso")
    except IntegrityError:
        db.session.rollback()
        flash("Não é possível excluir: existem produtos nessa categoria.", "erro")
    return redirect(url_for("admin.listar_categorias"))


@admin_bp.route("/produtos")
@login_obrigatorio
def listar_produtos():
    produtos = Produto.query.order_by(Produto.nome).all()
    return render_template("admin/produtos.html", produtos=produtos)


def _ler_dados_produto():
    nome = request.form.get("nome", "").strip()
    descricao = request.form.get("descricao", "").strip()
    categoria_id = request.form.get("categoria_id", type=int)
    preco = request.form.get("preco", type=float)
    disponivel = request.form.get("disponivel") == "on"

    if not nome or categoria_id is None or preco is None:
        flash("Preencha nome, categoria e preço.", "erro")
        return None

    return {
        "nome": nome,
        "descricao": descricao,
        "categoria_id": categoria_id,
        "preco": preco,
        "disponivel": disponivel,
    }


@admin_bp.route("/produtos/novo", methods=["GET", "POST"])
@login_obrigatorio
def novo_produto():
    categorias = Categoria.query.order_by(Categoria.nome).all()

    if request.method == "POST":
        dados = _ler_dados_produto()
        if dados is None:
            return render_template("admin/produto_form.html", produto=None, categorias=categorias)

        produto = Produto(**dados)
        db.session.add(produto)
        db.session.commit()
        flash("Produto criado.", "sucesso")
        return redirect(url_for("admin.listar_produtos"))

    return render_template("admin/produto_form.html", produto=None, categorias=categorias)


@admin_bp.route("/produtos/<int:produto_id>/editar", methods=["GET", "POST"])
@login_obrigatorio
def editar_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    categorias = Categoria.query.order_by(Categoria.nome).all()

    if request.method == "POST":
        dados = _ler_dados_produto()
        if dados is None:
            return render_template("admin/produto_form.html", produto=produto, categorias=categorias)

        produto.nome = dados["nome"]
        produto.descricao = dados["descricao"]
        produto.categoria_id = dados["categoria_id"]
        produto.preco = dados["preco"]
        produto.disponivel = dados["disponivel"]
        db.session.commit()
        flash("Produto atualizado.", "sucesso")
        return redirect(url_for("admin.listar_produtos"))

    return render_template("admin/produto_form.html", produto=produto, categorias=categorias)


@admin_bp.route("/produtos/<int:produto_id>/excluir", methods=["POST"])
@login_obrigatorio
def excluir_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    db.session.delete(produto)
    try:
        db.session.commit()
        flash("Produto excluído.", "sucesso")
    except IntegrityError:
        db.session.rollback()
        flash("Não é possível excluir: produto já usado em pedidos. Marque como indisponível.", "erro")
    return redirect(url_for("admin.listar_produtos"))


@admin_bp.route("/tamanhos")
@login_obrigatorio
def listar_tamanhos():
    tamanhos = Tamanho.query.order_by(Tamanho.ordem).all()
    return render_template("admin/tamanhos.html", tamanhos=tamanhos)


def _ler_dados_tamanho():
    nome = request.form.get("nome", "").strip()
    preco_adicional = request.form.get("preco_adicional", type=float)
    ordem = request.form.get("ordem", default=0, type=int)

    if not nome or preco_adicional is None:
        flash("Preencha nome e preço adicional.", "erro")
        return None

    return {"nome": nome, "preco_adicional": preco_adicional, "ordem": ordem}


@admin_bp.route("/tamanhos/novo", methods=["GET", "POST"])
@login_obrigatorio
def novo_tamanho():
    if request.method == "POST":
        dados = _ler_dados_tamanho()
        if dados is None:
            return render_template("admin/tamanho_form.html", tamanho=None)

        tamanho = Tamanho(**dados)
        db.session.add(tamanho)
        db.session.commit()
        flash("Tamanho criado.", "sucesso")
        return redirect(url_for("admin.listar_tamanhos"))

    return render_template("admin/tamanho_form.html", tamanho=None)


@admin_bp.route("/tamanhos/<int:tamanho_id>/editar", methods=["GET", "POST"])
@login_obrigatorio
def editar_tamanho(tamanho_id):
    tamanho = Tamanho.query.get_or_404(tamanho_id)

    if request.method == "POST":
        dados = _ler_dados_tamanho()
        if dados is None:
            return render_template("admin/tamanho_form.html", tamanho=tamanho)

        tamanho.nome = dados["nome"]
        tamanho.preco_adicional = dados["preco_adicional"]
        tamanho.ordem = dados["ordem"]
        db.session.commit()
        flash("Tamanho atualizado.", "sucesso")
        return redirect(url_for("admin.listar_tamanhos"))

    return render_template("admin/tamanho_form.html", tamanho=tamanho)


@admin_bp.route("/tamanhos/<int:tamanho_id>/excluir", methods=["POST"])
@login_obrigatorio
def excluir_tamanho(tamanho_id):
    tamanho = Tamanho.query.get_or_404(tamanho_id)
    db.session.delete(tamanho)
    try:
        db.session.commit()
        flash("Tamanho excluído.", "sucesso")
    except IntegrityError:
        db.session.rollback()
        flash("Não é possível excluir: tamanho já usado em pedidos.", "erro")
    return redirect(url_for("admin.listar_tamanhos"))
