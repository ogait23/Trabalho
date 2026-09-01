from dados_iniciais import criar_produto, montar_dados_iniciais
from pizzaria.pedido import Pedido

STATUS_FINALIZADOS = ("entregue", "cancelado")


def encontrar_mesa(dados, numero_texto):
    for mesa in dados.mesas:
        if str(mesa.numero) == numero_texto.strip():
            return mesa
    return None


def encontrar_garcom(dados, nome):
    for garcom in dados.garcons:
        if garcom.nome.lower() == nome.strip().lower():
            return garcom
    return None


def encontrar_produto(dados, nome):
    for produto in dados.produtos:
        if produto.nome.lower() == nome.strip().lower():
            return produto
    return None


def encontrar_categoria(dados, nome):
    for categoria in dados.categorias:
        if categoria.nome.lower() == nome.strip().lower():
            return categoria
    return None


def encontrar_pedido(dados, numero):
    for pedido in dados.pedidos:
        if pedido.numero == numero:
            return pedido
    return None


def escolher_pedido_aberto(dados, status=None):
    candidatos = [p for p in dados.pedidos if p.status not in STATUS_FINALIZADOS]
    if status is not None:
        candidatos = [p for p in candidatos if p.status == status]

    if not candidatos:
        print("Nenhum pedido disponível para essa ação.")
        return None

    for pedido in candidatos:
        print(f"Pedido {pedido.numero} - mesa {pedido.mesa.numero} - status {pedido.status} - total R$ {pedido.valorTotal:.2f}")

    try:
        numero = int(input("Número do pedido: "))
    except ValueError:
        print("Número inválido.")
        return None

    pedido = encontrar_pedido(dados, numero)
    if pedido is None or pedido.status in STATUS_FINALIZADOS or (status is not None and pedido.status != status):
        print("Pedido inválido para essa ação.")
        return None
    return pedido


def listar_mesas(dados):
    for mesa in dados.mesas:
        print(f"Mesa {mesa.numero} - capacidade {mesa.capacidade} - status {mesa.status}")


def listar_produtos(dados):
    for produto in dados.produtos:
        print(f"{produto.nome} - R$ {produto.preco:.2f} - {produto.categoria.nome}")


def listar_categorias(dados):
    for categoria in dados.categorias:
        print(categoria.nome)


def acao_ver_mesas(dados):
    listar_mesas(dados)


def acao_lancar_pedido(dados):
    listar_mesas(dados)
    numero_mesa = input("Número da mesa: ")
    mesa = encontrar_mesa(dados, numero_mesa)
    if mesa is None:
        print("Mesa não encontrada.")
        return

    try:
        mesa.ocupar()
    except ValueError as erro:
        print(erro)
        return

    for garcom in dados.garcons:
        print(garcom.nome)
    nome_garcom = input("Nome do garçom responsável: ")
    garcom = encontrar_garcom(dados, nome_garcom)
    if garcom is not None:
        garcom.atenderMesa(mesa)

    pedido = Pedido(dados.proximo_numero_pedido(), mesa)
    pedido.lancarPedido()
    dados.pedidos.append(pedido)
    print(f"Pedido {pedido.numero} lançado para a mesa {mesa.numero}.")


def acao_adicionar_item(dados):
    pedido = escolher_pedido_aberto(dados)
    if pedido is None:
        return

    listar_produtos(dados)
    nome_produto = input("Nome do produto: ")
    produto = encontrar_produto(dados, nome_produto)
    if produto is None:
        print("Produto não encontrado.")
        return

    try:
        quantidade = int(input("Quantidade: "))
    except ValueError:
        print("Quantidade inválida.")
        return

    estoque = dados.estoque_do_produto(produto)
    if estoque is not None and estoque.quantidade < quantidade:
        print("Estoque insuficiente para essa quantidade.")
        return

    try:
        pedido.adicionarItem(produto, quantidade)
    except ValueError as erro:
        print(erro)
        return

    if estoque is not None:
        estoque.atualizarQuantidade(-quantidade)
        if estoque.verificarEstoqueBaixo():
            print(f"Aviso: estoque de {produto.nome} está baixo.")

    print(f"Item adicionado. Total do pedido {pedido.numero}: R$ {pedido.valorTotal:.2f}")


def acao_enviar_para_cozinha(dados):
    pedido = escolher_pedido_aberto(dados, status="recebido")
    if pedido is None:
        return
    dados.cozinha.pedidosPendentes.append(pedido)
    pedido.status = "em_preparo"
    print(f"Pedido {pedido.numero} enviado para a cozinha.")


def acao_preparar_pedido(dados):
    if not dados.cozinha.pedidosPendentes:
        print("Não há pedidos pendentes na cozinha.")
        return

    for pedido in dados.cozinha.pedidosPendentes:
        print(f"Pedido {pedido.numero} - mesa {pedido.mesa.numero}")

    try:
        numero = int(input("Número do pedido a preparar: "))
    except ValueError:
        print("Número inválido.")
        return

    pedido = encontrar_pedido(dados, numero)
    if pedido is None:
        print("Pedido não encontrado.")
        return

    try:
        dados.cozinha.prepararPedido(pedido)
    except ValueError as erro:
        print(erro)
        return

    print(f"Pedido {pedido.numero} está pronto.")


def acao_fechar_conta(dados):
    pedido = escolher_pedido_aberto(dados, status="pronto")
    if pedido is None:
        return

    forma = input("Forma de pagamento (dinheiro, cartao ou pix): ").strip().lower()

    try:
        pagamento = pedido.fecharConta(forma, dados.caixa)
    except ValueError as erro:
        print(erro)
        return

    print(f"Conta fechada. Pagamento de R$ {pagamento.valor:.2f} em {pagamento.forma}. Mesa {pedido.mesa.numero} liberada.")


def acao_fechar_caixa(dados):
    total = dados.caixa.fecharCaixa()
    print(f"Total recebido no período: R$ {total:.2f}")


def acao_ver_estoque(dados):
    for estoque in dados.estoques:
        aviso = " (ESTOQUE BAIXO)" if estoque.verificarEstoqueBaixo() else ""
        print(f"{estoque.produto.nome}: {estoque.quantidade} unidades{aviso}")


def acao_atualizar_estoque(dados):
    listar_produtos(dados)
    nome_produto = input("Nome do produto: ")
    produto = encontrar_produto(dados, nome_produto)
    if produto is None:
        print("Produto não encontrado.")
        return

    estoque = dados.estoque_do_produto(produto)
    try:
        variacao = int(input("Quantidade a somar (negativo para retirar): "))
    except ValueError:
        print("Quantidade inválida.")
        return

    estoque.atualizarQuantidade(variacao)
    print(f"Novo estoque de {produto.nome}: {estoque.quantidade} unidades.")


def acao_cadastrar_produto(dados):
    listar_categorias(dados)
    nome_categoria = input("Nome da categoria: ")
    categoria = encontrar_categoria(dados, nome_categoria)
    if categoria is None:
        print("Categoria não encontrada.")
        return

    nome = input("Nome do produto: ")
    try:
        preco = float(input("Preço: "))
        quantidade = int(input("Quantidade inicial em estoque: "))
        minimo = int(input("Quantidade mínima: "))
    except ValueError:
        print("Valor inválido.")
        return

    criar_produto(dados, nome, preco, categoria, quantidade, minimo)
    print(f"Produto {nome} cadastrado.")


OPCOES = {
    "1": ("Ver mesas", acao_ver_mesas),
    "2": ("Ocupar mesa e lançar pedido", acao_lancar_pedido),
    "3": ("Adicionar item a um pedido", acao_adicionar_item),
    "4": ("Enviar pedido para a cozinha", acao_enviar_para_cozinha),
    "5": ("Preparar pedido (cozinha)", acao_preparar_pedido),
    "6": ("Fechar conta (caixa)", acao_fechar_conta),
    "7": ("Fechar caixa", acao_fechar_caixa),
    "8": ("Ver estoque", acao_ver_estoque),
    "9": ("Atualizar estoque de um produto", acao_atualizar_estoque),
    "10": ("Cadastrar produto", acao_cadastrar_produto),
}


def exibir_menu():
    print()
    print("Pizzaria Fornatta")
    for chave, (rotulo, _) in OPCOES.items():
        print(f"{chave}. {rotulo}")
    print("0. Sair")


def executar():
    dados = montar_dados_iniciais()
    while True:
        exibir_menu()
        escolha = input("Escolha uma opção: ").strip()

        if escolha == "0":
            print("Encerrando.")
            break

        opcao = OPCOES.get(escolha)
        if opcao is None:
            print("Opção inválida.")
            continue

        _, acao = opcao
        acao(dados)


if __name__ == "__main__":
    executar()
