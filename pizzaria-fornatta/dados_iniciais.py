import os

from pizzaria.caixa import Caixa
from pizzaria.categoria import Categoria
from pizzaria.cozinha import Cozinha
from pizzaria.estoque import Estoque
from pizzaria.garcom import Garcom
from pizzaria.mesa import Mesa
from pizzaria.produto import Produto
from sqlalchemy import select

from pizzaria.banco import Base, SessionLocal, engine
from pizzaria.usuario import Usuario


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


def criar_produto(dados, nome, preco, categoria, descricao, quantidade_estoque, quantidade_minima):
    produto = Produto(nome, preco, categoria, descricao)
    dados.produtos.append(produto)
    dados.estoques.append(Estoque(produto, quantidade_estoque, quantidade_minima))
    return produto


def criar_usuarios_iniciais():
    """Cria as tabelas e a equipe no banco, se ainda não existirem."""
    Base.metadata.create_all(engine)
    equipe = [
        ("gerente@fornatta.com.br", "Gerência", "gerente", "SENHA_GERENTE", "gerente@2026"),
        ("carlos@fornatta.com.br", "Carlos", "garcom", "SENHA_CARLOS", "carlos@2026"),
        ("fernanda@fornatta.com.br", "Fernanda", "garcom", "SENHA_FERNANDA", "fernanda@2026"),
        ("cozinha@fornatta.com.br", "Cozinha", "cozinha", "SENHA_COZINHA", "cozinha@2026"),
    ]
    with SessionLocal() as db:
        for email, nome, perfil, variavel, senha_demonstracao in equipe:
            if db.scalar(select(Usuario).where(Usuario.email == email)) is None:
                usuario = Usuario(email=email, nome=nome, perfil=perfil)
                usuario.definirSenha(os.environ.get(variavel, senha_demonstracao))
                db.add(usuario)
        db.commit()


def montar_cardapio(dados):
    tradicional = Categoria("Pizzas Tradicionais")
    especial = Categoria("Pizzas Especiais")
    doce = Categoria("Pizzas Doces")
    bebida = Categoria("Bebidas")
    porcao = Categoria("Porções")
    sobremesa = Categoria("Sobremesas")
    dados.categorias.extend([tradicional, especial, doce, bebida, porcao, sobremesa])

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

    criar_produto(dados, "Refrigerante 2L", 14.0, bebida, "Coca-Cola, Guaraná ou Fanta.", 30, 10)
    criar_produto(dados, "Refrigerante Lata", 6.0, bebida, "Lata de 350 ml.", 48, 12)
    criar_produto(dados, "Suco Natural de Laranja", 10.0, bebida, "Copo de 400 ml, sem adição de açúcar.", 20, 6)
    criar_produto(dados, "Água Mineral", 5.0, bebida, "Garrafa de 500 ml, com ou sem gás.", 40, 10)
    criar_produto(dados, "Cerveja Long Neck", 12.0, bebida, "Long neck de 330 ml. Venda somente para maiores de 18 anos.", 24, 6)

    criar_produto(dados, "Pão de Alho", 18.0, porcao, "Seis unidades com alho assado e ervas.", 25, 8)
    criar_produto(dados, "Batata Frita", 28.0, porcao, "Porção de 400 g com cheddar e bacon à parte.", 20, 5)
    criar_produto(dados, "Bruschetta", 24.0, porcao, "Quatro fatias com tomate, manjericão e azeite.", 20, 5)

    criar_produto(dados, "Petit Gâteau", 24.0, sobremesa, "Bolo de chocolate com sorvete de creme.", 15, 4)
    criar_produto(dados, "Pudim", 14.0, sobremesa, "Pudim de leite condensado com calda de caramelo.", 15, 4)


def montar_dados_iniciais():
    dados = BaseDados()
    montar_cardapio(dados)

    for numero in range(1, 7):
        dados.mesas.append(Mesa(numero, capacidade=4))

    dados.garcons.append(Garcom("Carlos"))
    dados.garcons.append(Garcom("Fernanda"))

    criar_usuarios_iniciais()
    return dados
