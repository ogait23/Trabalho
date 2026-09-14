# Pizzaria Fornatta

Trabalho da disciplina de Análise e Projeto Orientados a Objetos.

Equipe: João Victor, Tiago, Rudson

## Sobre

Sistema que simula o atendimento da Pizzaria Fornatta no salão: mesas,
pedidos, cozinha, caixa e estoque.

## Versão definitiva (apresentação)

Flask serve o frontend e expõe uma API que usa as mesmas classes Python de
`pizzaria/`. O frontend (HTML/CSS/JS puro) fala com essa API — é o
back-end de verdade, não uma simulação separada.

Como rodar:

```
pip install -r requirements.txt
python app.py
```

Depois abra `http://localhost:5000` no navegador.

## Estrutura

- `pizzaria/` — uma classe por arquivo (Mesa, Pedido, Produto, Categoria,
  Garcom, Pagamento, Cozinha, Caixa, Estoque)
- `dados_iniciais.py` — carga inicial de categorias, produtos, mesas e
  garçons
- `app.py` — servidor Flask: serve o frontend e expõe a API usada por ele
- `frontend/` — HTML, CSS e JavaScript puro (sem framework), consome a API
  do `app.py`
