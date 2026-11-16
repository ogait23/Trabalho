from pizzaria.pagamento import Pagamento

# Tipos de pedido:
#   "salao"    -> cliente sentado numa mesa, garçom lança os itens
#   "entrega"  -> cliente pede pelo site e recebe em casa (paga ao entregador)
#   "retirada" -> cliente pede pelo site e busca no balcão (paga no balcão)
TIPOS_PEDIDO = ("salao", "entrega", "retirada")

# Caminho de um pedido: recebido -> em_preparo -> pronto -> entregue
STATUS_FINALIZADOS = ("entregue", "cancelado")


class Pedido:
    def __init__(self, numero, mesa=None, tipo="salao", cliente=None, endereco="",
                 formaPagamento="", trocoPara=0, observacao=""):
        if tipo not in TIPOS_PEDIDO:
            raise ValueError(f"Tipo de pedido inválido: {tipo}")
        self.numero = numero
        self.mesa = mesa
        self.tipo = tipo
        self.cliente = cliente
        self.endereco = endereco
        self.formaPagamento = formaPagamento  # como o cliente disse que vai pagar
        self.trocoPara = trocoPara            # só para dinheiro: "troco para R$ 100"
        self.observacao = observacao          # ex.: "sem cebola"
        self.itens = []
        self.status = None
        self.valorTotal = 0
        self.pagamento = None                 # preenchido quando a conta é fechada

    def lancarPedido(self):
        self.status = "recebido"

    def adicionarItem(self, produto, quantidade):
        if self.status in STATUS_FINALIZADOS:
            raise ValueError(f"Pedido {self.numero} já foi finalizado.")
        self.itens.append({"produto": produto, "quantidade": quantidade, "precoUnitario": produto.preco})
        self.valorTotal = sum(item["precoUnitario"] * item["quantidade"] for item in self.itens)

    def fecharConta(self, forma_pagamento, caixa):
        """Recebe o pagamento presencial (mesa, entrega ou balcão) e finaliza o pedido."""
        if self.status in STATUS_FINALIZADOS:
            raise ValueError(f"Pedido {self.numero} já foi finalizado.")
        if self.status != "pronto":
            raise ValueError(f"Pedido {self.numero} ainda não está pronto.")
        pagamento = Pagamento(forma_pagamento, self.valorTotal, self)
        self.status = "entregue"
        if self.mesa is not None:
            self.mesa.liberar()
        pagamento.registrarPagamento(caixa)
        self.pagamento = pagamento
        return pagamento
