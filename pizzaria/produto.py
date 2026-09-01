class Produto:
    def __init__(self, nome, preco, categoria):
        self.nome = nome
        self.preco = preco
        self.categoria = categoria
        categoria.produtos.append(self)

    def atualizarPreco(self, novo_preco):
        self.preco = novo_preco
