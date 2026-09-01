from app import create_app
from app.extensions import db
from app.models import Categoria, Garcom, Mesa, Produto, Tamanho


def obter_ou_criar_categoria(nome, tipo):
    categoria = Categoria.query.filter_by(tipo=tipo).first()
    if categoria is None:
        categoria = Categoria(nome=nome, tipo=tipo)
        db.session.add(categoria)
        db.session.flush()
    return categoria


def criar_produto(nome, descricao, categoria, preco):
    existente = Produto.query.filter_by(nome=nome).first()
    if existente is not None:
        return existente
    produto = Produto(nome=nome, descricao=descricao, categoria=categoria, preco=preco, disponivel=True)
    db.session.add(produto)
    return produto


def criar_tamanho(nome, preco_adicional, ordem):
    existente = Tamanho.query.filter_by(nome=nome).first()
    if existente is not None:
        return existente
    tamanho = Tamanho(nome=nome, preco_adicional=preco_adicional, ordem=ordem)
    db.session.add(tamanho)
    return tamanho


def criar_mesa(numero):
    existente = Mesa.query.filter_by(numero=numero).first()
    if existente is not None:
        return existente
    mesa = Mesa(numero=numero, status="livre")
    db.session.add(mesa)
    return mesa


def criar_garcom(nome):
    existente = Garcom.query.filter_by(nome=nome).first()
    if existente is not None:
        return existente
    garcom = Garcom(nome=nome)
    db.session.add(garcom)
    return garcom


def executar():
    app = create_app()
    with app.app_context():
        pizza_salgada = obter_ou_criar_categoria("Pizza Salgada", "pizza_salgada")
        pizza_doce = obter_ou_criar_categoria("Pizza Doce", "pizza_doce")
        bebida = obter_ou_criar_categoria("Bebida", "bebida")
        porcao = obter_ou_criar_categoria("Porção", "porcao")

        criar_tamanho("Pequena", 0, 1)
        criar_tamanho("Média", 8, 2)
        criar_tamanho("Grande", 16, 3)

        criar_produto("Calabresa", "Molho de tomate, mussarela e calabresa fatiada.", pizza_salgada, 28)
        criar_produto("Quatro Queijos", "Mussarela, provolone, parmesão e gorgonzola.", pizza_salgada, 32)
        criar_produto("Frango com Catupiry", "Frango desfiado e catupiry.", pizza_salgada, 30)
        criar_produto("Chocolate", "Chocolate ao leite derretido.", pizza_doce, 30)
        criar_produto("Banana com Canela", "Banana fatiada, canela e açúcar.", pizza_doce, 26)
        criar_produto("Refrigerante 2L", "Refrigerante de cola, 2 litros.", bebida, 10)
        criar_produto("Água Mineral", "Água mineral sem gás, 500ml.", bebida, 5)
        criar_produto("Cerveja Long Neck", "Cerveja pilsen, 355ml.", bebida, 12)
        criar_produto("Batata Frita", "Porção de batata frita crocante.", porcao, 22)
        criar_produto("Calabresa Acebolada", "Calabresa fatiada com cebola.", porcao, 24)
        criar_produto("Frango a Passarinho", "Frango frito em pedaços pequenos.", porcao, 26)
        criar_produto("Anéis de Cebola", "Anéis de cebola empanados e fritos.", porcao, 20)
        criar_produto("Pão de Alho", "Pão de alho assado na brasa.", porcao, 14)

        for numero in range(1, 7):
            criar_mesa(numero)

        criar_garcom("Carlos")
        criar_garcom("Fernanda")

        db.session.commit()
        print("Carga inicial concluída.")


if __name__ == "__main__":
    executar()
