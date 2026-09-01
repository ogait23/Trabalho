from decimal import Decimal

from flask import current_app, flash, redirect, render_template, request, session, url_for

from app.extensions import db
from app.loja import loja_bp
from app.models import (
    Categoria,
    Cliente,
    FORMAS_PAGAMENTO,
    ItemPedido,
    Pedido,
    Produto,
    Tamanho,
    calcular_preco_unitario,
    validar_selecao_item,
)

CHAVE_CARRINHO = "carrinho"


def obter_carrinho():
    return session.setdefault(CHAVE_CARRINHO, [])


def salvar_carrinho(carrinho):
    session[CHAVE_CARRINHO] = carrinho
    session.modified = True


def montar_linhas_carrinho():
    carrinho = obter_carrinho()
    linhas = []
    carrinho_valido = []

    for indice, item in enumerate(carrinho):
        produto = Produto.query.get(item["produto_id"])
        if produto is None or not produto.disponivel:
            continue

        segundo_sabor = None
        if item.get("segundo_sabor_id"):
            segundo_sabor = Produto.query.get(item["segundo_sabor_id"])
            if segundo_sabor is None or not segundo_sabor.disponivel:
                segundo_sabor = None

        tamanho = None
        if item.get("tamanho_id"):
            tamanho = Tamanho.query.get(item["tamanho_id"])

        preco_unitario = calcular_preco_unitario(produto, tamanho, segundo_sabor)
        quantidade = item["quantidade"]

        linhas.append(
            {
                "indice": indice,
                "produto": produto,
                "segundo_sabor": segundo_sabor,
                "tamanho": tamanho,
                "quantidade": quantidade,
                "preco_unitario": preco_unitario,
                "subtotal": preco_unitario * quantidade,
            }
        )
        carrinho_valido.append(item)

    if len(carrinho_valido) != len(carrinho):
        salvar_carrinho(carrinho_valido)

    return linhas


@loja_bp.route("/")
def cardapio():
    categorias = Categoria.query.order_by(Categoria.tipo).all()
    categorias_com_produtos = []
    for categoria in categorias:
        produtos_disponiveis = [produto for produto in categoria.produtos if produto.disponivel]
        if produtos_disponiveis:
            categorias_com_produtos.append((categoria, produtos_disponiveis))
    return render_template("loja/cardapio.html", categorias_com_produtos=categorias_com_produtos)


@loja_bp.route("/produto/<int:produto_id>")
def produto_detalhe(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    if not produto.disponivel:
        flash("Este produto não está disponível.", "erro")
        return redirect(url_for("loja.cardapio"))

    tamanhos = Tamanho.query.order_by(Tamanho.ordem).all() if produto.eh_pizza else []
    outros_sabores = []
    if produto.eh_pizza:
        outros_sabores = (
            Produto.query.filter_by(categoria_id=produto.categoria_id, disponivel=True)
            .filter(Produto.id != produto.id)
            .order_by(Produto.nome)
            .all()
        )

    return render_template(
        "loja/produto.html",
        produto=produto,
        tamanhos=tamanhos,
        outros_sabores=outros_sabores,
    )


@loja_bp.route("/produto/<int:produto_id>/adicionar", methods=["POST"])
def adicionar_ao_carrinho(produto_id):
    produto = Produto.query.get_or_404(produto_id)

    tamanho_id = request.form.get("tamanho_id", type=int)
    segundo_sabor_id = request.form.get("segundo_sabor_id", type=int)
    quantidade = request.form.get("quantidade", default=1, type=int)

    tamanho = Tamanho.query.get(tamanho_id) if tamanho_id else None
    segundo_sabor = Produto.query.get(segundo_sabor_id) if segundo_sabor_id else None

    if not quantidade or quantidade < 1:
        quantidade = 1

    try:
        validar_selecao_item(produto, tamanho, segundo_sabor)
    except ValueError as erro:
        flash(str(erro), "erro")
        return redirect(url_for("loja.produto_detalhe", produto_id=produto.id))

    carrinho = obter_carrinho()
    carrinho.append(
        {
            "produto_id": produto.id,
            "segundo_sabor_id": segundo_sabor.id if segundo_sabor else None,
            "tamanho_id": tamanho.id if tamanho else None,
            "quantidade": quantidade,
        }
    )
    salvar_carrinho(carrinho)

    flash(f"{produto.nome} adicionado ao carrinho.", "sucesso")
    return redirect(url_for("loja.carrinho"))


@loja_bp.route("/carrinho")
def carrinho():
    linhas = montar_linhas_carrinho()
    total = sum((linha["subtotal"] for linha in linhas), Decimal("0"))
    return render_template("loja/carrinho.html", linhas=linhas, total=total)


@loja_bp.route("/carrinho/item/<int:indice>", methods=["POST"])
def atualizar_item_carrinho(indice):
    carrinho = obter_carrinho()
    acao = request.form.get("acao")

    if 0 <= indice < len(carrinho):
        if acao == "remover":
            carrinho.pop(indice)
        else:
            quantidade = request.form.get("quantidade", default=1, type=int)
            if quantidade and quantidade >= 1:
                carrinho[indice]["quantidade"] = quantidade
        salvar_carrinho(carrinho)

    return redirect(url_for("loja.carrinho"))


@loja_bp.route("/finalizar", methods=["GET", "POST"])
def finalizar():
    linhas = montar_linhas_carrinho()
    if not linhas:
        flash("Seu carrinho está vazio.", "erro")
        return redirect(url_for("loja.cardapio"))

    total_itens = sum((linha["subtotal"] for linha in linhas), Decimal("0"))

    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        telefone = request.form.get("telefone", "").strip()
        endereco_entrega = request.form.get("endereco_entrega", "").strip()
        forma_pagamento = request.form.get("forma_pagamento")

        if not nome or not telefone or not endereco_entrega:
            flash("Informe nome, telefone e endereço.", "erro")
            return redirect(url_for("loja.finalizar"))

        if forma_pagamento not in dict(FORMAS_PAGAMENTO):
            flash("Escolha uma forma de pagamento válida.", "erro")
            return redirect(url_for("loja.finalizar"))

        cliente = Cliente.query.filter_by(telefone=telefone).first()
        if cliente is None:
            cliente = Cliente(nome=nome, telefone=telefone, endereco_entrega=endereco_entrega)
            db.session.add(cliente)
        else:
            cliente.nome = nome
            cliente.endereco_entrega = endereco_entrega

        taxa_entrega = Decimal(str(current_app.config["TAXA_ENTREGA"]))

        pedido = Pedido(
            tipo="entrega",
            cliente=cliente,
            forma_pagamento=forma_pagamento,
            status="recebido",
            taxa_entrega=taxa_entrega,
        )

        for linha in linhas:
            item = ItemPedido(
                produto_id=linha["produto"].id,
                segundo_sabor_id=linha["segundo_sabor"].id if linha["segundo_sabor"] else None,
                tamanho_id=linha["tamanho"].id if linha["tamanho"] else None,
                quantidade=linha["quantidade"],
                preco_unitario=linha["preco_unitario"],
            )
            pedido.itens.append(item)

        pedido.recalcular_total()

        db.session.add(pedido)
        db.session.commit()

        salvar_carrinho([])

        return redirect(url_for("loja.confirmacao", pedido_id=pedido.id))

    return render_template(
        "loja/finalizar.html",
        linhas=linhas,
        total_itens=total_itens,
        formas_pagamento=FORMAS_PAGAMENTO,
        taxa_entrega=current_app.config["TAXA_ENTREGA"],
    )


@loja_bp.route("/confirmacao/<int:pedido_id>")
def confirmacao(pedido_id):
    pedido = Pedido.query.get_or_404(pedido_id)
    return render_template("loja/confirmacao.html", pedido=pedido)
