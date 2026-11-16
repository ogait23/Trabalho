class Produto:
    def __init__(self, nome, preco, categoria, descricao=""):
        self.nome = nome
        self.preco = preco
        self.categoria = categoria
        self.descricao = descricao
        categoria.produtos.append(self)

    def atualizarPreco(self, novo_preco):
        self.preco = novo_preco
