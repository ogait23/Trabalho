FORMAS_PRESENCIAIS = ("dinheiro", "cartao_debito", "cartao_credito")


class Pagamento:
    def __init__(self, forma, valor, pedido):
        if forma not in FORMAS_PRESENCIAIS:
            raise ValueError("Forma de pagamento inválida. O pagamento é feito somente de forma presencial.")
        self.forma = forma
        self.valor = valor
        self.pedido = pedido

    def registrarPagamento(self, caixa):
        caixa.totalRecebido += self.valor
