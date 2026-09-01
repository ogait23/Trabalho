class Categoria:
    def __init__(self, nome):
        self.nome = nome
        self.produtos = []

    def listarProdutos(self):
        return list(self.produtos)
