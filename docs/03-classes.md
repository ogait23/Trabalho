# Classes do domínio — Pizzaria Fornatta

Refinamento do esboço da primeira entrega (Mesa, Pedido, Produto, Categoria,
Garçom, Pagamento, Cozinha, Caixa, Estoque), mantendo o que já foi aprovado e
justificando cada mudança.

## O que mudou em relação ao esboço e por quê

- **Cozinha deixa de ser classe.** Uma classe precisa ter estado próprio
  (atributos que mudam e são consultados). A "cozinha" não guarda nenhum dado
  que não esteja já no `Pedido` — o que ela faz é agir sobre o `status` do
  pedido (recebido → em preparo → pronto). Ela vira **ator** no caso de uso
  "marcar pedido como pronto" e some como classe.
- **Caixa deixa de ser classe.** Pelo mesmo motivo: "fechar a conta no caixa"
  é um processo (uma ação do Atendente sobre o `Pedido`), e o dado que
  precisa ficar registrado — forma de pagamento e valor — já vira a classe
  `Pagamento`. Caixa também vira ator/processo, não objeto.
- **ItemPedido entra como classe nova.** A relação Pedido–Produto não é
  simplesmente 1 para muitos: um mesmo pedido tem vários produtos, e um
  mesmo produto aparece em vários pedidos — é muitos para muitos. E essa
  relação carrega dado próprio (quantidade, tamanho escolhido, preço
  cobrado naquele momento), que não cabe nem em Pedido nem em Produto. Isso
  é o caso clássico em que a relação muitos-para-muitos vira uma classe
  associativa.
- **Tamanho entra como classe nova**, porque pizza é vendida por tamanho e o
  preço muda de acordo com ele.
- **Cliente entra como classe nova**, necessário para os pedidos de entrega
  (nome, telefone, endereço) — o pedido de mesa não precisa de um Cliente
  cadastrado, só do Garçom e da Mesa.
- **Pagamento permanece como classe.** Diferente de Cozinha e Caixa, ela tem
  estado próprio de verdade (forma de pagamento, valor, data), e faz sentido
  existir como um registro separado do Pedido.
- **Estoque fica fora desta entrega.** O escopo aprovado cita estoque como
  uma das seis partes do sistema, mas nenhum requisito funcional aprovado
  até agora fala em controlar estoque (a lista aprovada é: mesas, pedidos,
  produtos/categorias, envio à cozinha, garçom responsável, fechamento de
  caixa, forma de pagamento). Sem um requisito que use estoque, modelar essa
  classe agora seria inventar regra de negócio que ninguém pediu. Fica citada
  aqui como pendência para uma entrega futura, não descartada do escopo.
- **Mesa, Pedido, Produto, Categoria e Garçom permanecem**, com ajustes de
  atributo descritos abaixo.

## Lista de classes

### Categoria

| Atributo | Tipo | Descrição |
|---|---|---|
| nome | string | Nome de exibição (ex.: "Pizza Salgada"). |
| tipo | string | pizza salgada, pizza doce, bebida ou porção. |

### Produto

| Atributo | Tipo | Descrição |
|---|---|---|
| nome | string | Nome do produto. |
| descricao | texto | Descrição livre. |
| categoria | Categoria | Categoria à qual pertence. |
| preco | decimal | Preço base (o preço do sabor, no caso de pizza). |
| disponivel | booleano | Se falso, some do cardápio. |

### Tamanho

| Atributo | Tipo | Descrição |
|---|---|---|
| nome | string | Nome do tamanho (P, M, G...). |
| preco_adicional | decimal | Valor somado ao preço do sabor nesse tamanho. |
| ordem | inteiro | Ordem de exibição. |

Só se aplica a pizza.

### Mesa

| Atributo | Tipo | Descrição |
|---|---|---|
| numero | inteiro | Número de identificação da mesa. |
| status | string | livre, ocupada ou reservada. |

### Garcom

| Atributo | Tipo | Descrição |
|---|---|---|
| nome | string | Nome do garçom. |

Mínimo necessário para "registrar o garçom responsável pela mesa e pelo
pedido" — sem login próprio, porque quem acessa o sistema é o Atendente.

### Cliente

| Atributo | Tipo | Descrição |
|---|---|---|
| nome | string | Nome do cliente. |
| telefone | string | Identifica o cliente entre pedidos de entrega. |
| endereco_entrega | string | Endereço usado na entrega. |

Só é usado em pedidos de entrega; pedido de mesa não referencia Cliente.

### Pedido

| Atributo | Tipo | Descrição |
|---|---|---|
| tipo | string | "mesa" ou "entrega" — nunca os dois. |
| mesa | Mesa (opcional) | Preenchido só quando tipo é "mesa". |
| cliente | Cliente (opcional) | Preenchido só quando tipo é "entrega". |
| garcom | Garçom (opcional) | Preenchido só quando tipo é "mesa". |
| data_criacao | data/hora | Quando o pedido foi aberto. |
| forma_pagamento | string | dinheiro, cartão ou pix (confirmada no fechamento). |
| status | string | recebido, em preparo, pronto, entregue ou cancelado. |
| taxa_entrega | decimal | Só cobrada quando tipo é "entrega". |
| total | decimal | Soma dos itens, mais taxa de entrega quando for o caso. |

### ItemPedido

| Atributo | Tipo | Descrição |
|---|---|---|
| pedido | Pedido | Pedido ao qual pertence. |
| produto | Produto | Sabor principal (ou o produto único, se não for pizza). |
| segundo_sabor | Produto (opcional) | Segundo sabor da pizza, quando houver. |
| tamanho | Tamanho (opcional) | Tamanho escolhido, só para pizza. |
| quantidade | inteiro | Quantidade desse item. |
| preco_unitario | decimal | Preço calculado e congelado no momento do pedido. |

`segundo_sabor` não estava pedido explicitamente, mas sem ele um item só
guardaria um sabor por vez, e a regra de até dois sabores por pizza fica
impossível de representar.

### Pagamento

| Atributo | Tipo | Descrição |
|---|---|---|
| pedido | Pedido | Pedido a que se refere. |
| forma | string | dinheiro, cartão ou pix. |
| valor | decimal | Valor efetivamente pago (igual ao total do pedido). |
| data_pagamento | data/hora | Quando o pagamento foi registrado. |

## Relacionamentos

| Relação | Cardinalidade | Tipo | Justificativa |
|---|---|---|---|
| Categoria — Produto | 1 para 0..* | Associação | Ciclos de vida independentes. |
| Produto — ItemPedido (papel "produto") | 1 para 0..* | Associação | Item depende do produto existir, produto não depende do item. |
| Produto — ItemPedido (papel "segundo_sabor") | 0..1 para 0..* | Associação | Segunda referência opcional à mesma classe. |
| Tamanho — ItemPedido | 0..1 para 0..* | Associação | Só existe quando o item é pizza. |
| Pedido — ItemPedido | 1 para 1..* | **Composição** | Item não existe fora do pedido; excluir o pedido apaga os itens. Única composição do modelo. |
| Cliente — Pedido | 0..1 para 0..* | Associação | Só pedidos de entrega referenciam cliente; cliente existe fora do pedido. |
| Mesa — Pedido | 0..1 para 0..* | Associação | Só pedidos de mesa referenciam mesa; mesa existe fora do pedido. |
| Garcom — Pedido | 0..1 para 0..* | Associação | Garçom existe fora do pedido específico; só pedidos de mesa o referenciam. |
| Pedido — Pagamento | 1 para 0..1 | **Composição** | O pagamento é o registro de fechamento de um pedido específico; não existe pagamento sem pedido, e o pedido pode ainda não ter sido pago. |

Não há agregação neste modelo: agregação pede uma relação de todo-e-partes em
que a parte é compartilhável e sobrevive fora do todo de forma natural (como
uma mesa que "tem" cadeiras). Nenhuma relação daqui tem essa forma — ou é uma
referência simples entre objetos independentes (associação) ou uma
dependência de existência (composição).

## Regras de negócio por classe

- **Categoria**: define se a categoria usa tamanho (pizzas) ou não.
- **Produto**: indisponível não aparece no cardápio.
- **Tamanho**: obrigatório em pizza, proibido nos demais produtos.
- **Mesa**: uma mesa ocupada não pode ser ocupada de novo (só volta a aceitar
  pedido novo quando o pedido atual for encerrado e ela voltar a "livre").
- **Garcom**: registrado no pedido de mesa como responsável pelo atendimento.
- **Cliente**: identificado pelo telefone; reaproveitado entre pedidos de
  entrega.
- **Pedido**:
  - é de mesa ou de entrega, nunca os dois — por isso `mesa` e `cliente` são
    mutuamente exclusivos no mesmo pedido;
  - precisa ter pelo menos um ItemPedido;
  - `total` = soma de `preco_unitario × quantidade` dos itens, mais
    `taxa_entrega` só quando `tipo` é "entrega";
  - passa pelos status recebido, em preparo, pronto, entregue e cancelado,
    nessa ordem (exceto o cancelamento, que pode ocorrer a qualquer momento
    antes de entregue);
  - uma vez entregue ou cancelado, não pode mais ser alterado.
- **ItemPedido**:
  - não existe sem um Pedido;
  - `segundo_sabor`, quando informado, precisa ser da mesma categoria do
    `produto`;
  - `preco_unitario` é o maior preço entre os sabores, mais o adicional do
    tamanho, calculado uma vez na criação do item e nunca mais recalculado.
- **Pagamento**: só é criado quando o pedido é fechado; a forma de pagamento
  registrada aqui é a que efetivamente foi usada no fechamento.
