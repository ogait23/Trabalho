# Pizzaria Fornatta

Trabalho da disciplina de Análise e Projeto Orientados a Objetos.

Equipe: João Victor, Tiago, Rudson

## Sobre

Sistema que simula o atendimento da Pizzaria Fornatta no salão: mesas,
pedidos, cozinha, caixa e estoque. Existem duas formas de ver o sistema
funcionando, com a mesma modelagem de classes:

- um programa de terminal, em Python
- um mini frontend, em HTML/CSS/JS

Nenhum dos dois depende do outro, e nenhum dos dois usa banco de dados —
os dados vivem só na memória enquanto o programa está aberto.

## Estrutura

- `pizzaria/` — uma classe por arquivo (Mesa, Pedido, Produto, Categoria,
  Garcom, Pagamento, Cozinha, Caixa, Estoque)
- `dados_iniciais.py` — carga inicial de categorias, produtos, mesas e
  garçons, usada pelo terminal
- `main.py` — menu de terminal
- `frontend/` — mini site (HTML, CSS e JavaScript puro, sem framework e
  sem backend) com as mesmas classes reescritas em JavaScript

## Como rodar

Terminal (precisa de Python 3, sem bibliotecas externas):

```
python main.py
```

Frontend (não precisa de nada instalado): abra o arquivo
`frontend/index.html` direto no navegador.
