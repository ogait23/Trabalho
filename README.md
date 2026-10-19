# Pizzaria Fornatta

Trabalho da disciplina de Análise e Projeto Orientados a Objetos.

Equipe: João Victor, Tiago, Rudson

## Sobre

Sistema da Pizzaria Fornatta: cardápio, pedidos no salão, pedidos para entrega,
cozinha, caixa e estoque. O pagamento é somente presencial (dinheiro, cartão de
débito ou cartão de crédito), na entrega ou no estabelecimento. Não existe
pagamento online.

## Como rodar

```
pip install -r requirements.txt
python app.py
```

Depois abra `http://localhost:5000` no navegador.

## Banco de dados

As contas ficam em um banco SQLite (`fornatta.db`) acessado com SQLAlchemy. O arquivo
é criado sozinho na primeira execução, junto com a equipe. Para criar uma conta de
cliente é preciso informar nome, e-mail, telefone, senha e repetir a senha. Pedidos,
estoque e caixa continuam em memória e zeram quando o servidor reinicia.

## Níveis de acesso

| Perfil  | O que pode fazer                                                        |
|---------|-------------------------------------------------------------------------|
| Cliente | Ver o cardápio, se cadastrar, pedir entrega e acompanhar os próprios pedidos |
| Garçom  | Abrir pedidos nas mesas, lançar itens, enviar à cozinha, receber o pagamento e fechar a conta (salão e entrega) |
| Cozinha | Ver a fila de pedidos, marcar como pronto e consultar o estoque         |
| Gerente | Tudo o que os outros perfis fazem, mais ver e fechar o caixa            |

## Segurança

1. Autenticação: senhas guardadas com hash, sessão que expira em 8 horas e bloqueio de 5 minutos após 5 erros de senha. O login é feito com e-mail.
2. Autorização: cada rota da API confere o perfil do usuário. O cliente só enxerga os próprios pedidos.
3. Requisições: todo POST exige o token CSRF da sessão, e o cookie de sessão é `HttpOnly` e `SameSite=Strict`.
4. Respostas: cabeçalhos de segurança em todas as respostas e a API nunca fica em cache.

As senhas da equipe vêm das variáveis de ambiente `SENHA_GERENTE`, `SENHA_CARLOS`,
`SENHA_FERNANDA` e `SENHA_COZINHA`. Os e-mails da equipe são `gerente@`, `carlos@`, `fernanda@` e `cozinha@` seguidos de `fornatta.com.br`. Os valores padrão de senha (por exemplo `gerente@2026`)
servem só para demonstração e devem ser trocados. Defina também `SECRET_KEY`.

## Estrutura

- `pizzaria/` — uma classe por arquivo (Mesa, Pedido, Produto, Categoria, Garcom, Pagamento, Cozinha, Caixa, Estoque, Usuario) e `banco.py` (conexão SQLAlchemy)
- `dados_iniciais.py` — cardápio, mesas, garçons e usuários iniciais
- `app.py` — servidor Flask com a API, a autenticação e as regras de acesso
- `frontend/` — HTML, CSS e JavaScript puro
