import os
import re
import secrets
import time
from datetime import timedelta
from functools import wraps

from flask import Flask, g, jsonify, request, send_from_directory, session
from sqlalchemy import select

from dados_iniciais import montar_dados_iniciais
from pizzaria.banco import SessionLocal
from pizzaria.pedido import Pedido, STATUS_FINALIZADOS
from pizzaria.usuario import Usuario

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Strict",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)
dados = montar_dados_iniciais()

MAX_TENTATIVAS = 5
BLOQUEIO_SEGUNDOS = 300
tentativas = {}
EMAIL_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- Segurança ----------
# Nível 1: autenticação (senha com hash, sessão com expiração, bloqueio após 5 erros)
# Nível 2: autorização por perfil (cliente, garçom, cozinha, gerente)
# Nível 3: proteção de requisições (token CSRF em todo POST, cookie Strict)
# Nível 4: proteção das respostas (cabeçalhos de segurança, sem cache da API)

def usuario_logado():
    if "usuario" not in g:
        g.usuario = None
        if session.get("uid"):
            with SessionLocal() as db:
                g.usuario = db.get(Usuario, session["uid"])
    return g.usuario


def exige(*perfis):
    def decorador(funcao):
        @wraps(funcao)
        def interno(*args, **kwargs):
            usuario = usuario_logado()
            if usuario is None:
                return jsonify({"erro": "Faça login para continuar."}), 401
            if usuario.perfil != "gerente" and usuario.perfil not in perfis:
                return jsonify({"erro": "Você não tem permissão para isso."}), 403
            return funcao(*args, **kwargs)
        return interno
    return decorador


@app.before_request
def proteger_requisicao():
    if "csrf" not in session:
        session["csrf"] = secrets.token_hex(16)
        session.permanent = True
    if request.method == "POST" and request.headers.get("X-CSRF-Token") != session["csrf"]:
        return jsonify({"erro": "Requisição inválida. Recarregue a página."}), 403


@app.after_request
def cabecalhos_seguranca(resposta):
    resposta.headers["X-Content-Type-Options"] = "nosniff"
    resposta.headers["X-Frame-Options"] = "DENY"
    resposta.headers["Referrer-Policy"] = "same-origin"
    resposta.headers["Content-Security-Policy"] = "default-src 'self'"
    if request.path.startswith("/api/"):
        resposta.headers["Cache-Control"] = "no-store"
    else:
        resposta.headers["Cache-Control"] = "no-cache"
    return resposta


def corpo_json():
    corpo = request.get_json(silent=True)
    return corpo if isinstance(corpo, dict) else {}


# ---------- Conversão para JSON ----------

def usuario_para_dict(usuario):
    return {"nome": usuario.nome, "perfil": usuario.perfil}


def mesa_para_dict(mesa):
    pedido_aberto = None
    for pedido in dados.pedidos:
        if pedido.mesa is mesa and pedido.status not in STATUS_FINALIZADOS:
            pedido_aberto = pedido.numero
            break
    return {"numero": mesa.numero, "capacidade": mesa.capacidade, "status": mesa.status, "pedidoAberto": pedido_aberto}


def produto_para_dict(produto):
    return {
        "nome": produto.nome,
        "preco": produto.preco,
        "descricao": produto.descricao,
        "categoria": produto.categoria.nome,
    }


def item_para_dict(item):
    return {"produto": item["produto"].nome, "quantidade": item["quantidade"], "precoUnitario": item["precoUnitario"]}


def pedido_para_dict(pedido):
    return {
        "numero": pedido.numero,
        "tipo": pedido.tipo,
        "mesa": pedido.mesa.numero if pedido.mesa else None,
        "cliente": pedido.clienteNome,
        "telefone": pedido.clienteTelefone,
        "endereco": pedido.endereco,
        "status": pedido.status,
        "valorTotal": pedido.valorTotal,
        "itens": [item_para_dict(item) for item in pedido.itens],
    }


def estoque_para_dict(estoque):
    return {
        "produto": estoque.produto.nome,
        "quantidade": estoque.quantidade,
        "quantidadeMinima": estoque.quantidadeMinima,
        "baixo": estoque.verificarEstoqueBaixo(),
    }


# ---------- Buscas e regras auxiliares ----------

def encontrar_mesa(numero):
    return next((mesa for mesa in dados.mesas if mesa.numero == numero), None)


def encontrar_pedido(numero):
    return next((pedido for pedido in dados.pedidos if pedido.numero == numero), None)


def encontrar_produto(nome):
    return next((produto for produto in dados.produtos if produto.nome == nome), None)


def encontrar_garcom(nome):
    return next((garcom for garcom in dados.garcons if garcom.nome == nome), None)


def validar_itens(itens):
    """Confere produtos, quantidades e estoque antes de alterar qualquer coisa."""
    if not isinstance(itens, list) or not itens:
        raise ValueError("O pedido precisa ter pelo menos um item.")
    totais = {}
    for item in itens:
        if not isinstance(item, dict):
            raise ValueError("Item inválido.")
        produto = encontrar_produto(str(item.get("produto", "")))
        if produto is None:
            raise ValueError("Produto não encontrado.")
        try:
            quantidade = int(item.get("quantidade", 1))
        except (TypeError, ValueError):
            raise ValueError("Quantidade inválida.")
        if not 1 <= quantidade <= 20:
            raise ValueError("A quantidade deve ser de 1 a 20.")
        totais[produto] = totais.get(produto, 0) + quantidade
    for produto, quantidade in totais.items():
        estoque = dados.estoque_do_produto(produto)
        if estoque is not None and estoque.quantidade < quantidade:
            raise ValueError(f"Estoque insuficiente de {produto.nome}.")
    return list(totais.items())


def lancar_itens(pedido, itens_validados):
    for produto, quantidade in itens_validados:
        pedido.adicionarItem(produto, quantidade)
        estoque = dados.estoque_do_produto(produto)
        if estoque is not None:
            estoque.atualizarQuantidade(-quantidade)


def pode_ver(pedido, usuario):
    return usuario.perfil != "cliente" or pedido.clienteId == usuario.id


def enviar_para_fila_da_cozinha(pedido):
    dados.cozinha.pedidosPendentes.append(pedido)
    pedido.status = "em_preparo"


# ---------- Páginas ----------

@app.route("/")
def pagina_inicial():
    return send_from_directory("frontend", "index.html")


@app.route("/<path:nome_arquivo>")
def arquivos_estaticos(nome_arquivo):
    return send_from_directory("frontend", nome_arquivo)


# ---------- Sessão ----------

@app.route("/api/sessao")
def ver_sessao():
    usuario = usuario_logado()
    return jsonify({"csrf": session["csrf"], "usuario": usuario_para_dict(usuario) if usuario else None})


@app.route("/api/login", methods=["POST"])
def entrar():
    corpo = corpo_json()
    email = str(corpo.get("email", "")).strip().lower()
    chave = (email, request.remote_addr)

    quantidade, bloqueado_ate = tentativas.get(chave, (0, 0))
    agora = time.time()
    if bloqueado_ate > agora:
        return jsonify({"erro": "Muitas tentativas. Aguarde alguns minutos e tente de novo."}), 429
    if bloqueado_ate:
        quantidade = 0

    with SessionLocal() as db:
        usuario = db.scalar(select(Usuario).where(Usuario.email == email))
    if usuario is None or not usuario.verificarSenha(str(corpo.get("senha", ""))):
        quantidade += 1
        tentativas[chave] = (quantidade, agora + BLOQUEIO_SEGUNDOS if quantidade >= MAX_TENTATIVAS else 0)
        return jsonify({"erro": "E-mail ou senha incorretos."}), 401

    tentativas.pop(chave, None)
    session.clear()
    session["csrf"] = secrets.token_hex(16)
    session["uid"] = usuario.id
    session.permanent = True
    return jsonify({"csrf": session["csrf"], "usuario": usuario_para_dict(usuario)})


@app.route("/api/sair", methods=["POST"])
def sair():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/cadastro", methods=["POST"])
def cadastrar_cliente():
    corpo = corpo_json()
    nome = str(corpo.get("nome", "")).strip()
    email = str(corpo.get("email", "")).strip().lower()
    telefone = re.sub(r"\D", "", str(corpo.get("telefone", "")))
    senha = str(corpo.get("senha", ""))
    confirmacao = str(corpo.get("confirmarSenha", ""))

    if len(nome) < 3:
        return jsonify({"erro": "Informe seu nome."}), 400
    if not EMAIL_VALIDO.match(email) or len(email) > 120:
        return jsonify({"erro": "Informe um e-mail válido."}), 400
    if len(telefone) not in (10, 11):
        return jsonify({"erro": "Informe o telefone com DDD."}), 400
    if len(senha) < 8:
        return jsonify({"erro": "A senha precisa ter pelo menos 8 caracteres."}), 400
    if senha != confirmacao:
        return jsonify({"erro": "As senhas não são iguais."}), 400

    with SessionLocal() as db:
        if db.scalar(select(Usuario).where(Usuario.email == email)) is not None:
            return jsonify({"erro": "Este e-mail já está cadastrado."}), 400
        usuario = Usuario(email=email, nome=nome, telefone=telefone, perfil="cliente")
        usuario.definirSenha(senha)
        db.add(usuario)
        db.commit()
    return jsonify({"ok": True}), 201


# ---------- Cardápio (público) ----------

@app.route("/api/produtos")
def listar_produtos():
    return jsonify([produto_para_dict(produto) for produto in dados.produtos])


# ---------- Cliente: entrega ----------

@app.route("/api/entregas", methods=["POST"])
@exige("cliente")
def criar_entrega():
    usuario = usuario_logado()
    corpo = corpo_json()
    endereco = str(corpo.get("endereco", "")).strip()
    if len(endereco) < 10:
        return jsonify({"erro": "Informe o endereço completo para entrega."}), 400

    try:
        itens = validar_itens(corpo.get("itens"))
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    pedido = Pedido(dados.proximo_numero_pedido(), None, "entrega", usuario, endereco)
    pedido.lancarPedido()
    lancar_itens(pedido, itens)
    dados.pedidos.append(pedido)
    enviar_para_fila_da_cozinha(pedido)
    return jsonify(pedido_para_dict(pedido)), 201


@app.route("/api/meus-pedidos")
@exige("cliente")
def meus_pedidos():
    usuario = usuario_logado()
    return jsonify([pedido_para_dict(p) for p in reversed(dados.pedidos) if p.clienteId == usuario.id])


# ---------- Garçom: salão e entregas ----------

@app.route("/api/mesas")
@exige("garcom")
def listar_mesas():
    return jsonify([mesa_para_dict(mesa) for mesa in dados.mesas])


@app.route("/api/mesas/<int:numero>/pedido", methods=["POST"])
@exige("garcom")
def abrir_pedido(numero):
    mesa = encontrar_mesa(numero)
    if mesa is None:
        return jsonify({"erro": "Mesa não encontrada."}), 404

    try:
        mesa.ocupar()
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    garcom = encontrar_garcom(usuario_logado().nome)
    if garcom is not None:
        garcom.atenderMesa(mesa)

    pedido = Pedido(dados.proximo_numero_pedido(), mesa)
    pedido.lancarPedido()
    dados.pedidos.append(pedido)
    return jsonify(pedido_para_dict(pedido)), 201


@app.route("/api/pedidos/<int:numero>")
@exige("garcom", "cliente")
def ver_pedido(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None or not pode_ver(pedido, usuario_logado()):
        return jsonify({"erro": "Pedido não encontrado."}), 404
    return jsonify(pedido_para_dict(pedido))


@app.route("/api/pedidos/<int:numero>/itens", methods=["POST"])
@exige("garcom")
def adicionar_item(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    try:
        itens = validar_itens([corpo_json()])
        lancar_itens(pedido, itens)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    return jsonify(pedido_para_dict(pedido))


@app.route("/api/pedidos/<int:numero>/cozinha", methods=["POST"])
@exige("garcom")
def enviar_para_cozinha(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404
    if pedido.status != "recebido" or not pedido.itens:
        return jsonify({"erro": "Adicione itens antes de enviar para a cozinha."}), 400

    enviar_para_fila_da_cozinha(pedido)
    return jsonify(pedido_para_dict(pedido))


@app.route("/api/entregas")
@exige("garcom")
def listar_entregas():
    ativas = [p for p in dados.pedidos if p.tipo == "entrega" and p.status not in STATUS_FINALIZADOS]
    return jsonify([pedido_para_dict(pedido) for pedido in ativas])


@app.route("/api/pedidos/<int:numero>/fechar", methods=["POST"])
@exige("garcom")
def fechar_conta(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    try:
        pedido.fecharConta(str(corpo_json().get("formaPagamento", "")), dados.caixa)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    return jsonify(pedido_para_dict(pedido))


# ---------- Cozinha ----------

@app.route("/api/cozinha")
@exige("cozinha")
def listar_cozinha():
    return jsonify([pedido_para_dict(pedido) for pedido in dados.cozinha.pedidosPendentes])


@app.route("/api/pedidos/<int:numero>/preparar", methods=["POST"])
@exige("cozinha")
def preparar_pedido(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    try:
        dados.cozinha.prepararPedido(pedido)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    return jsonify(pedido_para_dict(pedido))


@app.route("/api/estoque")
@exige("cozinha")
def listar_estoque():
    return jsonify([estoque_para_dict(estoque) for estoque in dados.estoques])


# ---------- Gerente: caixa ----------

@app.route("/api/caixa")
@exige("gerente")
def ver_caixa():
    return jsonify({"totalRecebido": dados.caixa.totalRecebido})


@app.route("/api/caixa/fechar", methods=["POST"])
@exige("gerente")
def fechar_caixa():
    return jsonify({"total": dados.caixa.fecharCaixa()})


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
