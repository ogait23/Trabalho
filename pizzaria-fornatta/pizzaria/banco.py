import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# O banco é um arquivo SQLite (fornatta.db), criado na primeira execução.
engine = create_engine(os.environ.get("DATABASE_URL", "sqlite:///fornatta.db"))
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
