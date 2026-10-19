from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from werkzeug.security import check_password_hash, generate_password_hash

from pizzaria.banco import Base

PERFIS = ("cliente", "garcom", "cozinha", "gerente")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(80))
    telefone: Mapped[str] = mapped_column(String(15), default="")
    perfil: Mapped[str] = mapped_column(String(20), default="cliente")
    senhaHash: Mapped[str] = mapped_column(String(255))

    def definirSenha(self, senha):
        self.senhaHash = generate_password_hash(senha)

    def verificarSenha(self, senha):
        return check_password_hash(self.senhaHash, senha)
