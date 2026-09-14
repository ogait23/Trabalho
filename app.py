from flask import Flask, jsonify, request, send_from_directory

from dados_iniciais import montar_dados_iniciais
from pizzaria.pedido import Pedido, STATUS_FINALIZADOS

app = Flask(__name__, static_folder=None)
dados = montar_dados_iniciais()


def mesa_para_dict(mesa):
    pedido_aberto = None
    for pedido in dados.pedidos:
        if pedido.mesa is mesa and pedido.status not in STATUS_FINALIZADOS:
            pedido_aberto = pedido.numero
            break
    return {
        "numero": mesa.numero,
        "capacidade": mesa.capacidade,
        "status": mesa.status,
        "pedidoAberto": pedido_aberto,
    }


def produto_para_dict(produto):
    return {"nome": produto.nome, "preco": produto.preco, "categoria": produto.categoria.nome}


def item_para_dict(item):
    return {
        "produto": item["produto"].nome,
        "quantidade": item["quantidade"],
        "precoUnitario": item["precoUnitario"],
    }


def pedido_para_dict(pedido):
    return {
        "numero": pedido.numero,
        "mesa": pedido.mesa.numero,
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


def encontrar_mesa(numero):
    for mesa in dados.mesas:
        if mesa.numero == numero:
            return mesa
    return None


def encontrar_pedido(numero):
    for pedido in dados.pedidos:
        if pedido.numero == numero:
            return pedido
    return None


def encontrar_produto(nome):
    for produto in dados.produtos:
        if produto.nome == nome:
            return produto
    return None


def encontrar_garcom(nome):
    for garcom in dados.garcons:
        if garcom.nome == nome:
            return garcom
    return None


@app.route("/")
def pagina_inicial():
    return send_from_directory("frontend", "index.html")


@app.route("/<path:nome_arquivo>")
def arquivos_estaticos(nome_arquivo):
    return send_from_directory("frontend", nome_arquivo)


@app.route("/api/mesas")
def listar_mesas():
    return jsonify([mesa_para_dict(mesa) for mesa in dados.mesas])


@app.route("/api/produtos")
def listar_produtos():
    return jsonify([produto_para_dict(produto) for produto in dados.produtos])


@app.route("/api/garcons")
def listar_garcons():
    return jsonify([garcom.nome for garcom in dados.garcons])


@app.route("/api/estoque")
def listar_estoque():
    return jsonify([estoque_para_dict(estoque) for estoque in dados.estoques])


@app.route("/api/cozinha")
def listar_cozinha():
    return jsonify([pedido_para_dict(pedido) for pedido in dados.cozinha.pedidosPendentes])


@app.route("/api/caixa")
def ver_caixa():
    return jsonify({"totalRecebido": dados.caixa.totalRecebido})


@app.route("/api/pedidos/<int:numero>")
def ver_pedido(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404
    return jsonify(pedido_para_dict(pedido))


@app.route("/api/mesas/<int:numero>/pedido", methods=["POST"])
def abrir_pedido(numero):
    mesa = encontrar_mesa(numero)
    if mesa is None:
        return jsonify({"erro": "Mesa não encontrada."}), 404

    corpo = request.get_json(force=True)
    garcom = encontrar_garcom(corpo.get("garcom", ""))
    if garcom is None:
        return jsonify({"erro": "Garçom não encontrado."}), 400

    try:
        mesa.ocupar()
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    garcom.atenderMesa(mesa)

    pedido = Pedido(len(dados.pedidos) + 1, mesa)
    pedido.lancarPedido()
    dados.pedidos.append(pedido)

    return jsonify(pedido_para_dict(pedido)), 201


@app.route("/api/pedidos/<int:numero>/itens", methods=["POST"])
def adicionar_item(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    corpo = request.get_json(force=True)
    produto = encontrar_produto(corpo.get("produto", ""))
    if produto is None:
        return jsonify({"erro": "Produto não encontrado."}), 400

    quantidade = int(corpo.get("quantidade", 1))
    estoque = dados.estoque_do_produto(produto)

    if estoque is not None and estoque.quantidade < quantidade:
        return jsonify({"erro": "Estoque insuficiente."}), 400

    try:
        pedido.adicionarItem(produto, quantidade)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    if estoque is not None:
        estoque.atualizarQuantidade(-quantidade)

    return jsonify(pedido_para_dict(pedido))


@app.route("/api/pedidos/<int:numero>/cozinha", methods=["POST"])
def enviar_para_cozinha(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    dados.cozinha.pedidosPendentes.append(pedido)
    pedido.status = "em_preparo"
    return jsonify(pedido_para_dict(pedido))


@app.route("/api/pedidos/<int:numero>/preparar", methods=["POST"])
def preparar_pedido(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    try:
        dados.cozinha.prepararPedido(pedido)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    return jsonify(pedido_para_dict(pedido))


@app.route("/api/pedidos/<int:numero>/fechar", methods=["POST"])
def fechar_conta(numero):
    pedido = encontrar_pedido(numero)
    if pedido is None:
        return jsonify({"erro": "Pedido não encontrado."}), 404

    corpo = request.get_json(force=True)
    forma = corpo.get("formaPagamento", "")

    try:
        pedido.fecharConta(forma, dados.caixa)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    return jsonify(pedido_para_dict(pedido))


@app.route("/api/caixa/fechar", methods=["POST"])
def fechar_caixa():
    total = dados.caixa.fecharCaixa()
    return jsonify({"total": total})


if __name__ == "__main__":
    app.run(debug=True)
