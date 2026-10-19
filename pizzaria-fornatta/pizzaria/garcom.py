class Garcom:
    def __init__(self, nome):
        self.nome = nome
        self.mesasAtendidas = []

    def atenderMesa(self, mesa):
        self.mesasAtendidas.append(mesa)
