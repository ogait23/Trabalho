import os

from pizzaria.caixa import Caixa
from pizzaria.categoria import Categoria
from pizzaria.cozinha import Cozinha
from pizzaria.estoque import Estoque
from pizzaria.garcom import Garcom
from pizzaria.mesa import Mesa
from pizzaria.produto import Produto
from pizzaria.usuario import Usuario


class BaseDados:
    def __init__(self):
        self.categorias = []
        self.produtos = []
        self.mesas = []
        self.garcons = []
        self.estoques = []
        self.pedidos = []
        self.usuarios = {}
        self.cozinha = Cozinha()
        self.caixa = Caixa()

    def estoque_do_produto(self, produto):
        for estoque in self.estoques:
            if estoque.produto is produto:
                return estoque
        return None

    def proximo_numero_pedido(self):
        return len(self.pedidos) + 1


def criar_produto(dados, nome, preco, categoria, descricao, quantidade_estoque, quantidade_minima):
    produto = Produto(nome, preco, categoria, descricao)
    dados.produtos.append(produto)
    dados.estoques.append(Estoque(produto, quantidade_estoque, quantidade_minima))
    return produto


def criar_usuario(dados, login, nome, perfil, variavel_ambiente, senha_demonstracao):
    senha = os.environ.get(variavel_ambiente, senha_demonstracao)
    dados.usuarios[login] = Usuario(login, nome, senha, perfil)


def montar_cardapio(dados):
    # O cardápio da Fornatta é só pizza e refrigerante.
    tradicional = Categoria("Pizzas Tradicionais")
    especial = Categoria("Pizzas Especiais")
    doce = Categoria("Pizzas Doces")
    refri = Categoria("Refrigerantes")
    dados.categorias.extend([tradicional, especial, doce, refri])

    # Pizzas: tamanho grande (35 cm, 8 fatias)
    criar_produto(dados, "Margherita", 42.0, tradicional, "Molho de tomate, mussarela, tomate fresco e manjericão.", 20, 5)
    criar_produto(dados, "Mussarela", 38.0, tradicional, "Molho de tomate, mussarela e orégano.", 20, 5)
    criar_produto(dados, "Calabresa", 40.0, tradicional, "Calabresa fatiada, cebola, mussarela e azeitonas.", 20, 5)
    criar_produto(dados, "Portuguesa", 46.0, tradicional, "Presunto, ovos, cebola, ervilha, mussarela e azeitonas.", 15, 5)
    criar_produto(dados, "Frango com Catupiry", 44.0, tradicional, "Frango desfiado, catupiry e mussarela.", 15, 5)
    criar_produto(dados, "Napolitana", 42.0, tradicional, "Mussarela, rodelas de tomate, parmesão e manjericão.", 15, 5)

    criar_produto(dados, "Quatro Queijos", 52.0, especial, "Mussarela, provolone, gorgonzola e parmesão.", 15, 5)
    criar_produto(dados, "Pepperoni", 54.0, especial, "Pepperoni artesanal e mussarela de búfala.", 15, 5)
    criar_produto(dados, "Bacon com Cheddar", 52.0, especial, "Bacon crocante, cheddar cremoso e cebola caramelizada.", 15, 5)
    criar_produto(dados, "Parma com Rúcula", 58.0, especial, "Presunto de Parma, rúcula, tomate seco e lascas de parmesão.", 10, 3)
    criar_produto(dados, "Burrata", 64.0, especial, "Molho de tomate, burrata, tomate cereja e pesto de manjericão.", 10, 3)

    criar_produto(dados, "Chocolate com Morango", 48.0, doce, "Chocolate ao leite e morangos frescos.", 10, 3)
    criar_produto(dados, "Banana com Canela", 44.0, doce, "Banana, açúcar, canela e mussarela.", 10, 3)
    criar_produto(dados, "Romeu e Julieta", 46.0, doce, "Mussarela e goiabada cremosa.", 10, 3)

    criar_produto(dados, "Refrigerante 2L", 14.0, refri, "Coca-Cola, Guaraná ou Fanta. Gelado.", 30, 10)
    criar_produto(dados, "Refrigerante 600 ml", 8.0, refri, "Coca-Cola, Guaraná ou Fanta.", 30, 10)
    criar_produto(dados, "Refrigerante Lata", 6.0, refri, "Lata de 350 ml. Coca-Cola, Guaraná ou Fanta.", 48, 12)


def montar_dados_iniciais():
    dados = BaseDados()
    montar_cardapio(dados)

    for numero in range(1, 7):
        dados.mesas.append(Mesa(numero, capacidade=4))

    dados.garcons.append(Garcom("Carlos"))
    dados.garcons.append(Garcom("Fernanda"))

    # Senhas vêm de variáveis de ambiente. Os valores padrão servem só para demonstração.
    # admin/admin: acesso total (cozinha, garçom e caixa) para apresentar o trabalho.
    criar_usuario(dados, "admin", "Admin", "gerente", "SENHA_ADMIN", "admin")
    criar_usuario(dados, "gerente", "Gerência", "gerente", "SENHA_GERENTE", "gerente@2026")
    criar_usuario(dados, "carlos", "Carlos", "garcom", "SENHA_CARLOS", "carlos@2026")
    criar_usuario(dados, "fernanda", "Fernanda", "garcom", "SENHA_FERNANDA", "fernanda@2026")
    criar_usuario(dados, "cozinha", "Cozinha", "cozinha", "SENHA_COZINHA", "cozinha@2026")

    # Cliente de teste: entra com cliente@fornatta.com (ou 18999999999) e senha cliente123
    dados.usuarios["18999999999"] = Usuario("18999999999", "Cliente Teste", "cliente123", "cliente",
                                            "18999999999", "cliente@fornatta.com")

    return dados
