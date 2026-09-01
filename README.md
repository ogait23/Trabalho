# Pizzaria Fornatta — Sistema de Pedidos

Trabalho da disciplina de Análise e Projeto Orientados a Objetos.

Equipe: João Victor Seki Mantovani, Tiago, Rudson, Rafael Alves

## Sobre o projeto

Sistema de pedidos da Pizzaria Fornatta, que atende no salão (mesas e
garçom) e também por entrega (site). O foco do trabalho é a modelagem do
domínio e as regras de negócio, não a sofisticação técnica.

A pizzaria vende:

- Pizzas salgadas e pizzas doces, vendidas por tamanho
- Bebidas: refrigerante, bebida alcoólica e água
- Porções: batata frita, calabresa, frango a passarinho, anéis de cebola e
  pão de alho

## Stack

- Linguagem: Python 3
- Framework: Flask (application factory + blueprints)
- Banco de dados: PostgreSQL, com SQLAlchemy e Flask-Migrate
- Frontend: templates Jinja2, HTML, CSS e JavaScript puro

## Status das etapas do cronograma

- Etapa 1, descrição do problema e escopo: entregue
- Etapa 2, levantamento de requisitos: entregue
- Etapa 3, identificação das classes e atributos: entregue —
  [docs/03-classes.md](docs/03-classes.md)
- Etapa 4, casos de uso: entregue —
  [docs/04-casos-de-uso.md](docs/04-casos-de-uso.md)
- Etapa 5, apresentação parcial: 14 de setembro, com a modelagem e o site
  funcionando descrito abaixo
- Etapas 6 e 7, diagramas de classes, sequência e atividades: não iniciadas

## Estrutura do repositório

- `app/` — aplicação Flask: `models.py`, blueprint `loja` (site de entrega)
  e blueprint `admin` (salão e administração), templates e estáticos
- `migrations/` — migrations do banco (Flask-Migrate / Alembic)
- `seed.py` — carga inicial de categorias, tamanhos, produtos, mesas e
  garçons
- `docs/` — documentação das etapas 3 e 4
- `entrega-classes-casos-de-uso/` — slides e documento detalhado usados na
  entrega anterior (escopo só de entrega, mantido como referência)
- `scripts/gerar_hash_senha.py` — gera o hash de senha do admin

## Como rodar localmente

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
flask db upgrade
python scripts/gerar_hash_senha.py <senha>
python seed.py
flask run
```

Ajuste `DATABASE_URL`, `ADMIN_USUARIO` e `ADMIN_SENHA_HASH` no `.env` antes
de rodar. `ADMIN_SENHA_HASH` recebe a saída do script de geração de hash.

Depois de rodar `flask run`, o site fica em `http://localhost:5000/` e a
administração em `http://localhost:5000/admin/login`.

Frontend (HTML/CSS): o CSS atual é simples e sem framework; refinar o
design do site é um plano futuro, depois que o fluxo funcional estiver
validado.
