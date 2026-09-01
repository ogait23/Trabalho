import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "chave-de-desenvolvimento-fornatta")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/pizzaria_fornatta",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    TAXA_ENTREGA = float(os.environ.get("TAXA_ENTREGA", "8.00"))
    ADMIN_USUARIO = os.environ.get("ADMIN_USUARIO", "admin")
    ADMIN_SENHA_HASH = os.environ.get("ADMIN_SENHA_HASH", "")
