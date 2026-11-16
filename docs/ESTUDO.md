# Resumo para estudar o código da Fornatta

Leia na ordem abaixo. Cada parte depende da anterior.

## 1. A ideia geral

```
Navegador (HTML + CSS + JS)  --fetch-->  Flask (app.py)  -->  Classes (pizzaria/*.py)
        frontend/                         rotas /api/...       Pedido, Mesa, Caixa...
```

- **Não tem banco de dados.** Tudo fica na memória do Python (`dados_iniciais.py`).
  Se o servidor reiniciar, os pedidos somem. Para um trabalho de faculdade isso basta.
- **Não tem pagamento online.** O cliente só diz *como* vai pagar. Quem registra o
  pagamento é o garçom ou o balcão, na hora em que entrega a pizza.

## 2. As classes (pasta `pizzaria/`)

Uma classe por arquivo. São as classes do diagrama de classes da disciplina.

| Classe | Para que serve | Métodos importantes |
|---|---|---|
| `Produto` | Item do cardápio (nome, preço, descrição) | `atualizarPreco` |
| `Categoria` | Agrupa produtos (Tradicionais, Bebidas…) | `listarProdutos` |
| `Mesa` | Mesa do salão (livre ou ocupada) | `ocupar`, `liberar` |
| `Pedido` | **A classe central.** Guarda itens, status, tipo e pagamento | `lancarPedido`, `adicionarItem`, `fecharConta` |
| `Pagamento` | Só aceita dinheiro, débito ou crédito (presencial) | `registrarPagamento` |
| `Caixa` | Soma o que foi recebido | `fecharCaixa` |
| `Cozinha` | Fila de pedidos para preparar | `prepararPedido` |
| `Estoque` | Quantidade de cada produto | `atualizarQuantidade`, `verificarEstoqueBaixo` |
| `Garcom` | Garçom e as mesas que atendeu | `atenderMesa` |
| `Usuario` | Login, senha (com hash) e perfil | `verificarSenha` |

### O pedido em detalhe (`pizzaria/pedido.py`)

**Tipos:** `salao` (mesa), `entrega` (casa do cliente) e `retirada` (balcão).

**Caminho do status:**

```
recebido  ->  em_preparo  ->  pronto  ->  entregue
 (criado)    (na cozinha)   (cozinha     (pago e
                             terminou)    finalizado)
```

Atributos novos desta versão: `formaPagamento` (como o cliente disse que vai pagar),
`trocoPara` (só para dinheiro) e `observacao` (ex.: "sem cebola").

`fecharConta(forma, caixa)` é onde o dinheiro entra: cria um `Pagamento`, muda o
status para `entregue`, libera a mesa (se tiver) e soma no `Caixa`.

## 3. O servidor (`app.py`)

Cada rota é uma função com `@app.route`. O padrão é sempre o mesmo:

1. lê o JSON que veio do navegador (`corpo_json()`);
2. valida (se tiver erro, devolve `{"erro": "..."}` com código 400);
3. chama os métodos das classes;
4. devolve o pedido em JSON (`pedido_para_dict`).

### Rotas principais

| Rota | Quem usa | O que faz |
|---|---|---|
| `GET /api/produtos` | todos | cardápio |
| `POST /api/cadastro` / `POST /api/login` | cliente | criar conta / entrar |
| `POST /api/meus-pedidos` | cliente | **cria pedido de entrega ou retirada** |
| `GET /api/meus-pedidos` | cliente | lista os pedidos (usada pelo rastreador) |
| `GET /api/mesas`, `POST /api/mesas/<n>/pedido` | garçom | salão |
| `POST /api/pedidos/<n>/itens` e `/cozinha` | garçom | lançar item / mandar para a cozinha |
| `GET /api/pedidos-clientes` | garçom | entregas e retiradas em andamento |
| `POST /api/pedidos/<n>/fechar` | garçom | recebe o pagamento e finaliza |
| `GET /api/cozinha`, `POST /api/pedidos/<n>/preparar` | cozinha | fila / marcar como pronto |
| `GET /api/estoque` | cozinha | estoque |
| `GET /api/caixa`, `POST /api/caixa/fechar` | gerente | caixa |

### Como um pedido do cliente é criado (`criar_pedido_cliente`)

1. Confere se `tipo` é `entrega` ou `retirada`.
2. Se for entrega, exige endereço. Se for retirada, o endereço fica vazio.
3. `validar_itens`: os produtos existem? A quantidade vai de 1 a 20? Tem estoque?
4. `validar_pagamento`: a forma é presencial? O troco é maior que o total?
5. **Só depois de validar tudo** cria o `Pedido`, baixa o estoque e coloca na fila da cozinha.

### Segurança (resumo do decorador `@exige`)

`@exige("garcom")` antes de uma rota quer dizer: "só garçom (ou gerente) pode chamar".
Se ninguém está logado, a resposta é 401; se o perfil é errado, é 403. O resto
(token CSRF, bloqueio após 5 senhas erradas, cabeçalhos) está explicado no README.

## 4. O frontend (`frontend/`)

- `index.html`: a estrutura da página. As partes de cada perfil têm
  `data-perfis="garcom"`, `data-perfis="cliente"` etc.
- `landing.js`: só a parte visual (menu do celular, janelas, notificações, parallax).
- `script.js`: a lógica, dividida em 8 seções numeradas no próprio arquivo.
- `estilo.css`: o visual. O final do arquivo ("Versão 2") tem tudo o que é novo.

### Como o JS fala com o servidor

Toda chamada passa por `requisitar(caminho, corpo)`:

- sem `corpo`: faz um **GET** (buscar dados);
- com `corpo`: faz um **POST** (enviar dados) com o token CSRF.

### Como a tela é montada

As funções `render...` buscam os dados e criam os elementos com `criar(tag, texto, classe)`.
Exemplo: `renderMeusPedidos()` busca `/meus-pedidos` e cria um card por pedido.
Nunca usamos `innerHTML` com dados do usuário (isso evita injeção de código).

## 5. O upgrade: acompanhamento ao vivo

**O que é:** depois de pedir, aparece uma barrinha no canto da tela
("Pedido 3 · No forno") e uma linha do tempo em "Meus pedidos". Quando o status
muda, aparece um aviso. O painel da equipe também se atualiza sozinho.

**Como funciona (é *polling*, não é GPS):**

```js
setInterval(async () => {          // a cada 10 segundos...
    if (perfil === "cliente") await renderMeusPedidos();   // pergunta o status
    else await atualizarOperacao();                        // ou atualiza o painel
}, INTERVALO_AO_VIVO);
```

E para saber se mudou, `avisarMudancas` compara com o status guardado:

```js
const antes = estado.statusConhecidos[pedido.numero];
if (antes && antes !== pedido.status) notificar("Pedido " + pedido.numero + ": " + nomeEtapa(pedido) + "!");
estado.statusConhecidos[pedido.numero] = pedido.status;
```

O nome de cada etapa muda conforme o tipo (tabela `NOMES_ETAPAS`): em uma entrega,
`pronto` aparece como "Saiu para entrega"; em uma retirada, como "Pronto no balcão".

## 6. Roteiro para demonstrar (simulação)

Contas que já vêm prontas:

| Conta | Login | Senha | Acesso |
|---|---|---|---|
| Admin | `admin` | `admin` | tudo (cozinha, garçom, caixa) |
| Cliente de teste | `cliente@fornatta.com` ou `18999999999` | `cliente123` | cliente |
| Gerente / garçons / cozinha | `gerente`, `carlos`, `fernanda`, `cozinha` | `<login>@2026` | cada um o seu |

1. `pip install -r requirements.txt` e depois `python app.py`. Abra `http://localhost:5000`.
2. **Aba 1:** entre como cliente (ou crie uma conta na aba "Criar conta"), adicione
   pizzas, escolha "Retirar no balcão", "Dinheiro" e troco para 100. Confirme.
3. **Aba 2** (Ctrl+T, no mesmo navegador): entre como `admin` / `admin`.
   O pedido aparece na fila da cozinha. Clique em "Marcar como pronto".
4. Volte para a aba 1: em até 10 s aparece "Pronto no balcão!".
5. Na aba 2, em "Entregas e retiradas", clique em "Retirado e pago" e veja o caixa.

### Por que dá para ter duas contas em duas abas?

No login, o servidor cria um **token** (um código aleatório) e guarda em
`sessoes[token] = (login, horário que expira)`. O navegador guarda esse token no
`sessionStorage`, que é **separado em cada aba**, e manda ele em toda chamada no
cabeçalho `X-Sessao`. A função `usuario_logado()` lê esse cabeçalho para saber
quem está usando aquela aba. Sair numa aba apaga só o token dela.

### Cadastro e login

- O cadastro pede nome, e-mail, telefone, senha e a senha repetida (`/api/cadastro`).
  Se der certo, já entra direto.
- O login aceita e-mail, telefone (com ou sem `+55`, parênteses e traço) ou o
  usuário da equipe. Quem resolve isso é `encontrar_usuario()` no `app.py`.

## 7. Perguntas que o professor pode fazer

- **Por que não tem pagamento online?** Por regra do negócio, o pagamento é sempre
  presencial. A classe `Pagamento` recusa qualquer forma fora de `FORMAS_PRESENCIAIS`.
- **Onde ficam os dados?** Em listas na memória (`BaseDados`). Não há banco de dados.
- **Como o cliente vê o status sem recarregar a página?** Com polling: um `setInterval`
  faz um `fetch` a cada 10 s.
- **O que impede um cliente de ver o pedido de outro?** `pode_ver()` e a rota
  `/meus-pedidos`, que filtra por `p.cliente is usuario`.
- **Por que validar antes de criar o pedido?** Assim, se der erro, o estoque não é
  baixado e nenhum pedido "pela metade" fica salvo.
