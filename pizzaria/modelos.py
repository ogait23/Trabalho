class Mesa:
    def __init__(self, numero, capacidade, status="livre"):
        self.numero = numero
        self.capacidade = capacidade
        self.status = status

    def ocupar(self):
        if self.status == "ocupada":
            raise ValueError(f"Mesa {self.numero} já está ocupada.")
        self.status = "ocupada"

    def liberar(self):
        self.status = "livre"


class Categoria:
    def __init__(self, nome):
        self.nome = nome
        self.produtos = []

    def listarProdutos(self):
        return list(self.produtos)


class Produto:
    def __init__(self, nome, preco, categoria):
        self.nome = nome
        self.preco = preco
        self.categoria = categoria
        categoria.produtos.append(self)

    def atualizarPreco(self, novo_preco):
        self.preco = novo_preco


class Garcom:
    def __init__(self, nome):
        self.nome = nome
        self.mesasAtendidas = []

    def atenderMesa(self, mesa):
        self.mesasAtendidas.append(mesa)


class Pagamento:
    def __init__(self, forma, valor, pedido):
        self.forma = forma
        self.valor = valor
        self.pedido = pedido

    def registrarPagamento(self, caixa):
        caixa.totalRecebido += self.valor


STATUS_FINALIZADOS = ("entregue", "cancelado")


class Pedido:
    def __init__(self, numero, mesa):
        self.numero = numero
        self.mesa = mesa
        self.itens = []
        self.status = None
        self.valorTotal = 0
        self.pagamento = None

    def lancarPedido(self):
        self.status = "recebido"

    def adicionarItem(self, produto, quantidade):
        if self.status in STATUS_FINALIZADOS:
            raise ValueError(f"Pedido {self.numero} já foi finalizado.")
        self.itens.append({"produto": produto, "quantidade": quantidade, "precoUnitario": produto.preco})
        self.valorTotal = sum(item["precoUnitario"] * item["quantidade"] for item in self.itens)

    def fecharConta(self, forma_pagamento, caixa):
        if self.status in STATUS_FINALIZADOS:
            raise ValueError(f"Pedido {self.numero} já foi finalizado.")
        self.status = "entregue"
        self.mesa.liberar()
        pagamento = Pagamento(forma_pagamento, self.valorTotal, self)
        pagamento.registrarPagamento(caixa)
        self.pagamento = pagamento
        return pagamento


class Cozinha:
    def __init__(self):
        self.pedidosPendentes = []

    def prepararPedido(self, pedido):
        if pedido not in self.pedidosPendentes:
            raise ValueError(f"Pedido {pedido.numero} não está na fila da cozinha.")
        self.pedidosPendentes.remove(pedido)
        pedido.status = "pronto"


class Caixa:
    def __init__(self):
        self.totalRecebido = 0

    def fecharCaixa(self):
        total = self.totalRecebido
        self.totalRecebido = 0
        return total


class Estoque:
    def __init__(self, produto, quantidade, quantidadeMinima):
        self.produto = produto
        self.quantidade = quantidade
        self.quantidadeMinima = quantidadeMinima

    def atualizarQuantidade(self, variacao):
        self.quantidade += variacao

    def verificarEstoqueBaixo(self):
        return self.quantidade <= self.quantidadeMinima
