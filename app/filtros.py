from app.models import CATEGORIA_TIPOS, FORMAS_PAGAMENTO, STATUS_MESA, STATUS_PEDIDO, TIPOS_PEDIDO

ROTULOS_CATEGORIA = dict(CATEGORIA_TIPOS)
ROTULOS_TIPO_PEDIDO = dict(TIPOS_PEDIDO)
ROTULOS_PAGAMENTO = dict(FORMAS_PAGAMENTO)
ROTULOS_STATUS = dict(STATUS_PEDIDO)
ROTULOS_MESA = dict(STATUS_MESA)


def registrar_filtros(app):
    app.jinja_env.filters["rotulo_categoria"] = lambda tipo: ROTULOS_CATEGORIA.get(tipo, tipo)
    app.jinja_env.filters["rotulo_tipo_pedido"] = lambda tipo: ROTULOS_TIPO_PEDIDO.get(tipo, tipo)
    app.jinja_env.filters["rotulo_pagamento"] = lambda tipo: ROTULOS_PAGAMENTO.get(tipo, tipo)
    app.jinja_env.filters["rotulo_status"] = lambda tipo: ROTULOS_STATUS.get(tipo, tipo)
    app.jinja_env.filters["rotulo_mesa"] = lambda tipo: ROTULOS_MESA.get(tipo, tipo)
