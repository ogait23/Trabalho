# Pizzaria Fornatta — Sistema de Pedidos

Trabalho da disciplina de Análise e Projeto Orientados a Objetos.

Equipe: Tiago, João Victor Seki Mantovani, Rudson

## Sobre o projeto

Sistema web de pedidos para a Pizzaria Fornatta. O foco do trabalho é a
modelagem do domínio e as regras de negócio, não a sofisticação técnica.

A pizzaria vende:

- Pizzas salgadas
- Pizzas doces
- Bebidas: refrigerante, bebida alcoólica e água
- Porções: batata frita, calabresa, frango a passarinho, anéis de cebola e
  pão de alho

## Stack

- Linguagem: Python 3
- Framework: Flask (application factory + blueprints)
- Banco de dados: PostgreSQL, com SQLAlchemy e Flask-Migrate
- Frontend: templates Jinja2, HTML, CSS e JavaScript puro (sem React, sem
  Bootstrap)

## Estrutura do repositório

- `app/` — aplicação Flask: `models.py`, blueprint `loja` (cardápio, carrinho,
  checkout) e blueprint `admin` (gestão de produtos e pedidos), templates e
  arquivos estáticos
- `migrations/` — migrations do banco (Flask-Migrate / Alembic)
- `entrega-classes-casos-de-uso/` — entregas 3 e 4: `index.html` são os
  slides para a apresentação e `detalhes.html` é o documento completo
  (diagramas, regras de negócio e tabela de casos de uso)
- `scripts/` — utilitários, como a geração do hash da senha do admin
- `config.py`, `run.py` — configuração e ponto de entrada da aplicação

## Entregas

- 03 — Identificação das classes e atributos — feito
- 04 — Casos de uso — feito
- Slides para a apresentação do dia 14/09:
  [entrega-classes-casos-de-uso/index.html](entrega-classes-casos-de-uso/index.html)
- Documento completo (diagramas + regras + tabela de casos de uso):
  [entrega-classes-casos-de-uso/detalhes.html](entrega-classes-casos-de-uso/detalhes.html)
- Modelos, migrations e implementação Flask — em andamento

## Como rodar localmente

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
flask db upgrade
python scripts/gerar_hash_senha.py <senha>
flask run
```

Ajuste `DATABASE_URL`, `ADMIN_USUARIO` e `ADMIN_SENHA_HASH` no `.env` antes de
rodar. `ADMIN_SENHA_HASH` recebe a saída do script de geração de hash.

Parte da frente= HTML,CSS: ja que estamos trabalhando em um Site de entregas de pizzaria é importante, nós iremos trabalhar com HTML e CSS para melhorar o design do site em planos futuros para melhorar o desenvolvimento do site e sua rapidez.
