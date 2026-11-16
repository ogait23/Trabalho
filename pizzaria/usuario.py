from werkzeug.security import check_password_hash, generate_password_hash

PERFIS = ("cliente", "garcom", "cozinha", "gerente")


class Usuario:
    def __init__(self, login, nome, senha, perfil, telefone=""):
        if perfil not in PERFIS:
            raise ValueError(f"Perfil inválido: {perfil}")
        self.login = login
        self.nome = nome
        self.perfil = perfil
        self.telefone = telefone
        self.senhaHash = generate_password_hash(senha)

    def verificarSenha(self, senha):
        return check_password_hash(self.senhaHash, senha)
