# Pizzaria Fornatta

Trabalho da disciplina de Análise e Projeto Orientados a Objetos.

Equipe: João Victor Seki Mantovani, Nicolas Emanuel e Tiago Dourado

## Sobre

Sistema da Pizzaria Fornatta: cardápio, pedidos no salão, pedidos para entrega,
retirada no balcão, cozinha, caixa e estoque. O pagamento é somente presencial
(dinheiro, cartão de débito ou cartão de crédito): na mesa, na entrega ou no
balcão. Não existe pagamento online. No site, o cliente só informa como vai
pagar (e o troco, se for dinheiro).

Material de apoio: [docs/ESTUDO.md](docs/ESTUDO.md) (como o código funciona) e
[docs/ORIENTACAO-DOCUMENTACAO.md](docs/ORIENTACAO-DOCUMENTACAO.md) (o que atualizar na documentação).

## Como rodar

```
pip install -r requirements.txt
python app.py
```

Depois abra `http://localhost:5000` no navegador.

## Landing page

A página inicial apresenta a Fornatta com layout responsivo, cardápio por
categorias e acesso por janelas de login e pedido. Os produtos e preços são
carregados da API existente; cadastro, entrega e áreas da equipe continuam
integrados ao Flask. Abra pelo servidor acima para usar essas funções.

- `frontend/estilo.css`: identidade visual e layouts para celular, tablet e desktop.
- `frontend/landing.js`: navegação móvel, janelas acessíveis, notificações e motion.
- `frontend/script.js`: sessão, cardápio, carrinho e operações da pizzaria.
- `frontend/assets/`: imagens locais e ícone; não há dependência de CDN em execução.

As imagens ganham perspectiva com o ponteiro no computador e com a rolagem no
celular. As animações usam `requestAnimationFrame` e `IntersectionObserver`,
preservam o scroll nativo e respeitam `prefers-reduced-motion`. Os diálogos podem
ser fechados com Escape e os controles são acessíveis pelo teclado.

As fotografias são ilustrativas, não representam cada sabor do cardápio.
Origens das fotos: [pizza sobre a tábua](https://images.unsplash.com/photo-1571407970349-bc81e7e96d47),
[pizza com acompanhamentos](https://images.unsplash.com/photo-1604382355076-af4b0eb60143)
e [pizza com tomates e ervas](https://images.unsplash.com/photo-1513104890138-7c749659a591).

## Níveis de acesso

| Perfil  | O que pode fazer                                                        |
|---------|-------------------------------------------------------------------------|
| Cliente | Ver o cardápio, se cadastrar, pedir entrega ou retirada no balcão e acompanhar os próprios pedidos ao vivo |
| Garçom  | Abrir pedidos nas mesas, lançar itens, enviar à cozinha, receber o pagamento e fechar a conta (salão, entrega e balcão) |
| Cozinha | Ver a fila de pedidos, marcar como pronto e consultar o estoque         |
| Gerente | Tudo o que os outros perfis fazem, mais ver e fechar o caixa            |

## Contas de teste

| Conta | Login | Senha |
|-------|-------|-------|
| Admin (acesso total: cozinha, garçom e caixa) | `admin` | `admin` |
| Cliente de teste | `cliente@fornatta.com` ou `18999999999` | `cliente123` |

O cliente também pode criar a própria conta (nome, e-mail, telefone e senha
repetida) e depois entrar com o e-mail ou com o telefone. Cada aba do navegador
tem o próprio login: dá para deixar uma aba como cliente e outra como admin.

## Segurança

1. Autenticação: senhas guardadas com hash, login por aba com token que expira em 8 horas e bloqueio de 5 minutos após 5 erros de senha.
2. Autorização: cada rota da API confere o perfil do usuário. O cliente só enxerga os próprios pedidos.
3. Requisições: todo POST exige o token CSRF da sessão, e o cookie de sessão é `HttpOnly` e `SameSite=Strict`.
4. Respostas: cabeçalhos de segurança em todas as respostas e a API nunca fica em cache.

As senhas da equipe vêm das variáveis de ambiente `SENHA_ADMIN`, `SENHA_GERENTE`,
`SENHA_CARLOS`, `SENHA_FERNANDA` e `SENHA_COZINHA`. Os valores padrão (por exemplo
`admin` e `gerente@2026`) servem só para a demonstração do trabalho e devem ser
trocados num uso real. Defina também `SECRET_KEY`.

## Estrutura

- `pizzaria/` — uma classe por arquivo (Mesa, Pedido, Produto, Categoria, Garcom, Pagamento, Cozinha, Caixa, Estoque, Usuario)
- `dados_iniciais.py` — cardápio, mesas, garçons e usuários iniciais
- `app.py` — servidor Flask com a API, a autenticação e as regras de acesso
- `frontend/` — HTML, CSS e JavaScript puro
