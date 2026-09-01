class Pagamento:
    def __init__(self, forma, valor, pedido):
        self.forma = forma
        self.valor = valor
        self.pedido = pedido

    def registrarPagamento(self, caixa):
        caixa.totalRecebido += self.valor
