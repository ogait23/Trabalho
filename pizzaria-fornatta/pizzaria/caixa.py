class Caixa:
    def __init__(self):
        self.totalRecebido = 0

    def fecharCaixa(self):
        total = self.totalRecebido
        self.totalRecebido = 0
        return total
