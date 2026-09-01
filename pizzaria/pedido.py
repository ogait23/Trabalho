from pizzaria.pagamento import Pagamento

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
