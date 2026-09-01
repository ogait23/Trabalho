from flask import Blueprint

loja_bp = Blueprint("loja", __name__)

from app.loja import routes
