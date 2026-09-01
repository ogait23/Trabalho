from flask import Flask

from app.config import Config
from app.extensions import db, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    from app.loja import loja_bp
    from app.admin import admin_bp

    app.register_blueprint(loja_bp)
    app.register_blueprint(admin_bp, url_prefix="/admin")

    from app import models
    from app.filtros import registrar_filtros

    registrar_filtros(app)

    return app
