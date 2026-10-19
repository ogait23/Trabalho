class Mesa:
    def __init__(self, numero, capacidade, status="livre"):
        self.numero = numero
        self.capacidade = capacidade
        self.status = status

    def ocupar(self):
        if self.status == "ocupada":
            raise ValueError(f"Mesa {self.numero} já está ocupada.")
        self.status = "ocupada"

    def liberar(self):
        self.status = "livre"
