import os
import re
import secrets
import time
from datetime import timedelta
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session

from dados_iniciais import montar_dados_iniciais
from pizzaria.pagamento import FORMAS_PRESENCIAIS
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

# Login por aba: cada aba do navegador recebe o próprio token.
# Assim dá para deixar uma aba como cliente e outra como admin ao mesmo tempo.
SESSAO_SEGUNDOS = 8 * 3600
sessoes = {}  # token -> (login do usuário, horário em que expira)


# ---------- Segurança ----------
# Nível 1: autenticação (senha com hash, token por aba que expira em 8 h, bloqueio após 5 erros)
# Nível 2: autorização por perfil (cliente, garçom, cozinha, gerente)
# Nível 3: proteção de requisições (token CSRF em todo POST, cookie Strict)
# Nível 4: proteção das respostas (cabeçalhos de segurança, sem cache da API)

def usuario_logado():
    """Descobre quem está usando esta aba pelo cabeçalho X-Sessao."""
    token = request.headers.get("X-Sessao", "")
    login, expira_em = sessoes.get(token, (None, 0))
    if expira_em < time.time():
        sessoes.pop(token, None)
        return None
    return dados.usuarios.get(login)


def normalizar_telefone(texto):
    """Deixa só os números e tira o +55. Ex.: '+55 (67) 99999-1234' -> '67999991234'."""
    numeros = re.sub(r"\D", "", texto)
    if len(numeros) in (12, 13) and numeros.startswith("55"):
        numeros = numeros[2:]
    return numeros


def encontrar_usuario(login):
    """Aceita e-mail, telefone (com ou sem formatação) ou o usuário da equipe."""
    login = login.strip().lower()
    if "@" in login:
        return next((u for u in dados.usuarios.values() if u.email == login), None)
    if not re.search(r"[a-z]", login):
        login = normalizar_telefone(login)
    return dados.usuarios.get(login)


def iniciar_sessao(usuario):
    """Cria um token novo para esta aba e devolve o que o navegador precisa guardar."""
    token = secrets.token_hex(32)
    sessoes[token] = (usuario.login, time.time() + SESSAO_SEGUNDOS)
    return {"token": token, "csrf": session["csrf"], "usuario": usuario_para_dict(usuario)}


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
        "cliente": pedido.cliente.nome if pedido.cliente else None,
        "telefone": pedido.cliente.telefone if pedido.cliente else None,
        "endereco": pedido.endereco,
        "formaPagamento": pedido.formaPagamento,
        "trocoPara": pedido.trocoPara,
        "observacao": pedido.observacao,
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


def validar_pagamento(corpo, total):
    """O cliente só escolhe COMO vai pagar. O dinheiro é recebido na entrega ou no balcão."""
    forma = str(corpo.get("formaPagamento", ""))
    if forma not in FORMAS_PRESENCIAIS:
        raise ValueError("Escolha dinheiro, débito ou crédito. O pagamento é feito na hora.")

    troco = 0
    if forma == "dinheiro" and corpo.get("trocoPara"):
        try:
            troco = float(corpo["trocoPara"])
        except (TypeError, ValueError):
            raise ValueError("Valor do troco inválido.")
        if troco < total:
            raise ValueError("O troco precisa ser para um valor maior que o total.")
    return forma, troco


def lancar_itens(pedido, itens_validados):
    for produto, quantidade in itens_validados:
        pedido.adicionarItem(produto, quantidade)
        estoque = dados.estoque_do_produto(produto)
        if estoque is not None:
            estoque.atualizarQuantidade(-quantidade)


def pode_ver(pedido, usuario):
    return usuario.perfil != "cliente" or pedido.cliente is usuario


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
    login = str(corpo.get("login", "")).strip().lower()
    chave = (login, request.remote_addr)

    quantidade, bloqueado_ate = tentativas.get(chave, (0, 0))
    agora = time.time()
    if bloqueado_ate > agora:
        return jsonify({"erro": "Muitas tentativas. Aguarde alguns minutos e tente de novo."}), 429
    if bloqueado_ate:
        quantidade = 0

    usuario = encontrar_usuario(login)
    if usuario is None or not usuario.verificarSenha(str(corpo.get("senha", ""))):
        quantidade += 1
        tentativas[chave] = (quantidade, agora + BLOQUEIO_SEGUNDOS if quantidade >= MAX_TENTATIVAS else 0)
        return jsonify({"erro": "Usuário ou senha incorretos."}), 401

    tentativas.pop(chave, None)
    return jsonify(iniciar_sessao(usuario))


@app.route("/api/sair", methods=["POST"])
def sair():
    sessoes.pop(request.headers.get("X-Sessao", ""), None)  # só esta aba sai; as outras continuam
    return jsonify({"ok": True})


@app.route("/api/cadastro", methods=["POST"])
def cadastrar_cliente():
    corpo = corpo_json()
    nome = str(corpo.get("nome", "")).strip()
    email = str(corpo.get("email", "")).strip().lower()
    telefone = normalizar_telefone(str(corpo.get("telefone", "")))
    senha = str(corpo.get("senha", ""))
    confirmacao = str(corpo.get("confirmacao", ""))

    # "campo" diz ao navegador em qual campo mostrar o erro
    if len(nome) < 3:
        return jsonify({"erro": "Digite seu nome (pelo menos 3 letras).", "campo": "nome"}), 400
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"erro": "Digite um e-mail válido, ex.: nome@gmail.com.", "campo": "email"}), 400
    if len(telefone) not in (10, 11):
        return jsonify({"erro": "Telefone com DDD, ex.: (18) 99764-0335.", "campo": "telefone"}), 400
    if len(senha) < 8:
        return jsonify({"erro": "A senha precisa ter pelo menos 8 caracteres.", "campo": "senha"}), 400
    if senha != confirmacao:
        return jsonify({"erro": "As senhas não são iguais.", "campo": "confirmacao"}), 400
    if encontrar_usuario(email):
        return jsonify({"erro": "Este e-mail já tem conta. Use a aba Entrar.", "campo": "email"}), 400
    if telefone in dados.usuarios:
        return jsonify({"erro": "Este telefone já tem conta. Use a aba Entrar.", "campo": "telefone"}), 400

    usuario = Usuario(telefone, nome, senha, "cliente", telefone, email)
    dados.usuarios[telefone] = usuario
    return jsonify(iniciar_sessao(usuario)), 201  # já entra direto depois de criar a conta


# ---------- Cardápio (público) ----------

@app.route("/api/produtos")
def listar_produtos():
    return jsonify([produto_para_dict(produto) for produto in dados.produtos])


# ---------- Cliente: entrega ou retirada no balcão ----------

@app.route("/api/meus-pedidos", methods=["POST"])
@exige("cliente")
def criar_pedido_cliente():
    usuario = usuario_logado()
    corpo = corpo_json()

    tipo = corpo.get("tipo")
    if tipo not in ("entrega", "retirada"):
        return jsonify({"erro": "Escolha entrega ou retirada no balcão."}), 400

    endereco = str(corpo.get("endereco", "")).strip()
    if tipo == "entrega" and len(endereco) < 10:
        return jsonify({"erro": "Informe o endereço completo para entrega."}), 400
    if tipo == "retirada":
        endereco = ""

    observacao = str(corpo.get("observacao", "")).strip()[:140]

    # 1) valida tudo antes  2) só depois cria o pedido
    try:
        itens = validar_itens(corpo.get("itens"))
        total = sum(produto.preco * quantidade for produto, quantidade in itens)
        forma, troco = validar_pagamento(corpo, total)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    pedido = Pedido(dados.proximo_numero_pedido(), None, tipo, usuario, endereco, forma, troco, observacao)
    pedido.lancarPedido()
    lancar_itens(pedido, itens)
    dados.pedidos.append(pedido)
    enviar_para_fila_da_cozinha(pedido)
    return jsonify(pedido_para_dict(pedido)), 201


@app.route("/api/meus-pedidos")
@exige("cliente")
def meus_pedidos():
    usuario = usuario_logado()
    return jsonify([pedido_para_dict(p) for p in reversed(dados.pedidos) if p.cliente is usuario])


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


@app.route("/api/pedidos-clientes")
@exige("garcom")
def listar_pedidos_clientes():
    """Pedidos feitos pelo site (entrega e retirada) que ainda não foram pagos."""
    ativos = [p for p in dados.pedidos if p.tipo != "salao" and p.status not in STATUS_FINALIZADOS]
    return jsonify([pedido_para_dict(pedido) for pedido in ativos])


@app.route("/api/pedidos/<int:numero>/fechar", methods=["POST"])
@exige("garcom")
def fechar_conta(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    # Se o garçom não escolher, usa a forma que o cliente informou no pedido.
    forma = str(corpo_json().get("formaPagamento") or pedido.formaPagamento)
    try:
        pedido.fecharConta(forma, dados.caixa)
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
