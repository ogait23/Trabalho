from pizzaria.pagamento import Pagamento

STATUS_FINALIZADOS = ("entregue", "cancelado")


class Pedido:
    def __init__(self, numero, mesa=None, tipo="salao", cliente=None, endereco=""):  # cliente: Usuario
        self.numero = numero
        self.mesa = mesa
        self.tipo = tipo  # "salao" ou "entrega"
        self.clienteId = cliente.id if cliente else None
        self.clienteNome = cliente.nome if cliente else None
        self.clienteTelefone = cliente.telefone if cliente else None
        self.endereco = endereco
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
        if self.status != "pronto":
            raise ValueError(f"Pedido {self.numero} ainda não está pronto.")
        pagamento = Pagamento(forma_pagamento, self.valorTotal, self)
        self.status = "entregue"
        if self.mesa is not None:
            self.mesa.liberar()
        pagamento.registrarPagamento(caixa)
        self.pagamento = pagamento
        return pagamento
