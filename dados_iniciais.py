from pizzaria.caixa import Caixa
from pizzaria.categoria import Categoria
from pizzaria.cozinha import Cozinha
from pizzaria.estoque import Estoque
from pizzaria.garcom import Garcom
from pizzaria.mesa import Mesa
from pizzaria.produto import Produto


class BaseDados:
    def __init__(self):
        self.categorias = []
        self.produtos = []
        self.mesas = []
        self.garcons = []
        self.estoques = []
        self.pedidos = []
        self.cozinha = Cozinha()
        self.caixa = Caixa()

    def estoque_do_produto(self, produto):
        for estoque in self.estoques:
            if estoque.produto is produto:
                return estoque
        return None

    def proximo_numero_pedido(self):
        return len(self.pedidos) + 1


def criar_produto(dados, nome, preco, categoria, quantidade_estoque, quantidade_minima):
    produto = Produto(nome, preco, categoria)
    dados.produtos.append(produto)
    dados.estoques.append(Estoque(produto, quantidade_estoque, quantidade_minima))
    return produto


def montar_dados_iniciais():
    dados = BaseDados()

    pizza_salgada = Categoria("Pizza Salgada")
    pizza_doce = Categoria("Pizza Doce")
    bebida = Categoria("Bebida")
    porcao = Categoria("Porção")
    dados.categorias.extend([pizza_salgada, pizza_doce, bebida, porcao])

    criar_produto(dados, "Calabresa", 28.0, pizza_salgada, 20, 5)
    criar_produto(dados, "Quatro Queijos", 32.0, pizza_salgada, 15, 5)
    criar_produto(dados, "Frango com Catupiry", 30.0, pizza_salgada, 15, 5)
    criar_produto(dados, "Chocolate", 30.0, pizza_doce, 10, 3)
    criar_produto(dados, "Banana com Canela", 26.0, pizza_doce, 10, 3)
    criar_produto(dados, "Refrigerante 2L", 10.0, bebida, 30, 10)
    criar_produto(dados, "Água Mineral", 5.0, bebida, 40, 10)
    criar_produto(dados, "Cerveja Long Neck", 12.0, bebida, 24, 6)
    criar_produto(dados, "Batata Frita", 22.0, porcao, 20, 5)
    criar_produto(dados, "Calabresa Acebolada", 24.0, porcao, 20, 5)
    criar_produto(dados, "Frango a Passarinho", 26.0, porcao, 15, 5)
    criar_produto(dados, "Anéis de Cebola", 20.0, porcao, 15, 5)
    criar_produto(dados, "Pão de Alho", 14.0, porcao, 25, 8)

    for numero in range(1, 7):
        dados.mesas.append(Mesa(numero, capacidade=4))

    dados.garcons.append(Garcom("Carlos"))
    dados.garcons.append(Garcom("Fernanda"))

    return dados
