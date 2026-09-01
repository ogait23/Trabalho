class Cozinha:
    def __init__(self):
        self.pedidosPendentes = []

    def prepararPedido(self, pedido):
        if pedido not in self.pedidosPendentes:
            raise ValueError(f"Pedido {pedido.numero} não está na fila da cozinha.")
        self.pedidosPendentes.remove(pedido)
        pedido.status = "pronto"
