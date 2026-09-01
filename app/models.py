from datetime import datetime
from decimal import Decimal

from app.extensions import db

CATEGORIA_TIPOS = (
    ("pizza_salgada", "Pizza Salgada"),
    ("pizza_doce", "Pizza Doce"),
    ("bebida", "Bebida"),
    ("porcao", "Porção"),
)

TIPOS_PIZZA = ("pizza_salgada", "pizza_doce")

TIPOS_PEDIDO = (
    ("mesa", "Mesa"),
    ("entrega", "Entrega"),
)

STATUS_MESA = (
    ("livre", "Livre"),
    ("ocupada", "Ocupada"),
    ("reservada", "Reservada"),
)

FORMAS_PAGAMENTO = (
    ("dinheiro", "Dinheiro"),
    ("cartao", "Cartão"),
    ("pix", "Pix"),
)

STATUS_PEDIDO = (
    ("recebido", "Recebido"),
    ("em_preparo", "Em Preparo"),
    ("pronto", "Pronto"),
    ("entregue", "Entregue"),
    ("cancelado", "Cancelado"),
)

STATUS_FINALIZADOS = ("entregue", "cancelado")


class Categoria(db.Model):
    __tablename__ = "categorias"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(60), nullable=False)
    tipo = db.Column(db.String(20), nullable=False, unique=True)

    produtos = db.relationship("Produto", back_populates="categoria")

    @property
    def eh_pizza(self):
        return self.tipo in TIPOS_PIZZA

    def __repr__(self):
        return self.nome


class Produto(db.Model):
    __tablename__ = "produtos"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    descricao = db.Column(db.Text, nullable=False, default="")
    categoria_id = db.Column(db.Integer, db.ForeignKey("categorias.id"), nullable=False)
    preco = db.Column(db.Numeric(8, 2), nullable=False)
    disponivel = db.Column(db.Boolean, nullable=False, default=True)

    categoria = db.relationship("Categoria", back_populates="produtos")

    @property
    def eh_pizza(self):
        return self.categoria.eh_pizza

    def __repr__(self):
        return self.nome


class Tamanho(db.Model):
    __tablename__ = "tamanhos"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(30), nullable=False)
    preco_adicional = db.Column(db.Numeric(8, 2), nullable=False, default=0)
    ordem = db.Column(db.Integer, nullable=False, default=0)

    def __repr__(self):
        return self.nome


class Mesa(db.Model):
    __tablename__ = "mesas"

    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.Integer, nullable=False, unique=True)
    status = db.Column(db.String(20), nullable=False, default="livre")

    def __repr__(self):
        return f"Mesa {self.numero}"


class Garcom(db.Model):
    __tablename__ = "garcons"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)

    def __repr__(self):
        return self.nome


class Cliente(db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    telefone = db.Column(db.String(20), nullable=False, unique=True)
    endereco_entrega = db.Column(db.String(200), nullable=False, default="")

    pedidos = db.relationship("Pedido", back_populates="cliente")

    def __repr__(self):
        return self.nome


class Pedido(db.Model):
    __tablename__ = "pedidos"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False)
    mesa_id = db.Column(db.Integer, db.ForeignKey("mesas.id"), nullable=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=True)
    garcom_id = db.Column(db.Integer, db.ForeignKey("garcons.id"), nullable=True)
    data_criacao = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    forma_pagamento = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="recebido")
    taxa_entrega = db.Column(db.Numeric(8, 2), nullable=False, default=0)
    total = db.Column(db.Numeric(8, 2), nullable=False, default=0)

    mesa = db.relationship("Mesa")
    cliente = db.relationship("Cliente", back_populates="pedidos")
    garcom = db.relationship("Garcom")
    itens = db.relationship(
        "ItemPedido",
        back_populates="pedido",
        cascade="all, delete-orphan",
        order_by="ItemPedido.id",
    )
    pagamento = db.relationship(
        "Pagamento",
        back_populates="pedido",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def eh_mesa(self):
        return self.tipo == "mesa"

    @property
    def esta_bloqueado(self):
        return self.status in STATUS_FINALIZADOS

    def recalcular_total(self):
        soma_itens = sum((item.subtotal for item in self.itens), Decimal("0"))
        taxa = self.taxa_entrega if self.tipo == "entrega" else Decimal("0")
        self.total = soma_itens + taxa
        return self.total

    def __repr__(self):
        return f"Pedido {self.id}"


class ItemPedido(db.Model):
    __tablename__ = "itens_pedido"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    produto_id = db.Column(db.Integer, db.ForeignKey("produtos.id"), nullable=False)
    segundo_sabor_id = db.Column(db.Integer, db.ForeignKey("produtos.id"), nullable=True)
    tamanho_id = db.Column(db.Integer, db.ForeignKey("tamanhos.id"), nullable=True)
    quantidade = db.Column(db.Integer, nullable=False, default=1)
    preco_unitario = db.Column(db.Numeric(8, 2), nullable=False)

    pedido = db.relationship("Pedido", back_populates="itens")
    produto = db.relationship("Produto", foreign_keys=[produto_id])
    segundo_sabor = db.relationship("Produto", foreign_keys=[segundo_sabor_id])
    tamanho = db.relationship("Tamanho")

    @property
    def subtotal(self):
        return self.preco_unitario * self.quantidade


class Pagamento(db.Model):
    __tablename__ = "pagamentos"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False, unique=True)
    forma = db.Column(db.String(20), nullable=False)
    valor = db.Column(db.Numeric(8, 2), nullable=False)
    data_pagamento = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    pedido = db.relationship("Pedido", back_populates="pagamento")


def calcular_preco_unitario(produto, tamanho=None, segundo_sabor=None):
    preco_base = produto.preco
    if segundo_sabor is not None and segundo_sabor.preco > preco_base:
        preco_base = segundo_sabor.preco
    adicional_tamanho = tamanho.preco_adicional if tamanho is not None else Decimal("0")
    return preco_base + adicional_tamanho


def validar_selecao_item(produto, tamanho=None, segundo_sabor=None):
    if not produto.disponivel:
        raise ValueError("Este produto não está disponível.")

    if produto.eh_pizza:
        if tamanho is None:
            raise ValueError("Escolha o tamanho da pizza.")
        if segundo_sabor is not None:
            if segundo_sabor.id == produto.id:
                raise ValueError("Escolha um segundo sabor diferente do primeiro.")
            if not segundo_sabor.disponivel:
                raise ValueError("O segundo sabor escolhido não está disponível.")
            if segundo_sabor.categoria_id != produto.categoria_id:
                raise ValueError("Os dois sabores precisam ser da mesma categoria de pizza.")
    else:
        if tamanho is not None:
            raise ValueError("Este produto não utiliza tamanho.")
        if segundo_sabor is not None:
            raise ValueError("Este produto não permite segundo sabor.")


def validar_tipo_pedido(tipo, mesa=None, cliente=None):
    if tipo == "mesa":
        if mesa is None:
            raise ValueError("Pedido de mesa precisa de uma mesa.")
        if mesa.status == "ocupada":
            raise ValueError("Esta mesa já está ocupada.")
    elif tipo == "entrega":
        if cliente is None:
            raise ValueError("Pedido de entrega precisa dos dados do cliente.")
    else:
        raise ValueError("Tipo de pedido inválido.")
