class Estoque:
    def __init__(self, produto, quantidade, quantidadeMinima):
        self.produto = produto
        self.quantidade = quantidade
        self.quantidadeMinima = quantidadeMinima

    def atualizarQuantidade(self, variacao):
        self.quantidade += variacao

    def verificarEstoqueBaixo(self):
        return self.quantidade <= self.quantidadeMinima
