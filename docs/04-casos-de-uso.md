# Casos de uso — Pizzaria Fornatta

## Atores

- **Cliente**: acessa o site para ver o cardápio e fazer um pedido de entrega. Não precisa de login.
- **Garçom**: atende as mesas do salão e lança os pedidos na administração.
- **Atendente**: administra o cardápio, fecha contas e acompanha todos os pedidos. Acessa com login.
- **Cozinha**: recebe os pedidos enviados e marca quando estão prontos.

## Casos de uso do salão

### UC01 — Gerenciar mesas

- **Ator**: Atendente
- **Pré-condição**: Atendente autenticado.
- **Fluxo principal**:
  1. Atendente acessa o painel de mesas.
  2. Atendente cadastra uma mesa (número) ou altera o status de uma existente (livre, ocupada, reservada).
  3. Sistema grava a alteração.
- **Fluxo alternativo**: nenhum.

### UC02 — Lançar pedido de mesa

- **Ator**: Garçom
- **Pré-condição**: a mesa está livre ou reservada para o cliente atual.
- **Fluxo principal**:
  1. Garçom abre um novo pedido para uma mesa e se identifica como responsável.
  2. Sistema muda o status da mesa para "ocupada".
  3. Garçom adiciona produtos ao pedido (com tamanho e segundo sabor quando for pizza).
  4. Sistema calcula o preço de cada item e o total do pedido.
- **Fluxo alternativo**: mesa já ocupada — sistema recusa abrir um novo pedido para ela.

### UC03 — Enviar pedido para a cozinha

- **Ator**: Garçom
- **Pré-condição**: o pedido tem pelo menos um item e está com status "recebido".
- **Fluxo principal**:
  1. Garçom confirma o envio do pedido.
  2. Sistema muda o status do pedido para "em preparo".
- **Fluxo alternativo**: nenhum.

### UC04 — Marcar pedido como pronto

- **Ator**: Cozinha
- **Pré-condição**: o pedido está com status "em preparo".
- **Fluxo principal**:
  1. Cozinha marca o pedido como concluído.
  2. Sistema muda o status do pedido para "pronto".
- **Fluxo alternativo**: nenhum.

### UC05 — Fechar conta e registrar pagamento

- **Ator**: Atendente
- **Pré-condição**: o pedido está com status "pronto" ou "entregue" e ainda não está fechado.
- **Fluxo principal**:
  1. Atendente abre o pedido da mesa e escolhe fechar a conta.
  2. Atendente informa a forma de pagamento.
  3. Sistema cria o registro de pagamento com o valor igual ao total do pedido.
  4. Sistema muda o status do pedido para "entregue" e libera a mesa (volta para "livre").
- **Fluxo alternativo**: pedido já entregue ou cancelado — sistema recusa fechar de novo.

## Casos de uso de cadastro

### UC06 — Cadastrar produtos e categorias

- **Ator**: Atendente
- **Pré-condição**: Atendente autenticado.
- **Fluxo principal**:
  1. Atendente acessa a lista de produtos, categorias ou tamanhos.
  2. Atendente cadastra, edita ou exclui um item.
  3. Sistema grava a alteração.
- **Fluxo alternativo**: exclusão de um produto ou tamanho já usado em algum pedido — sistema recusa e sugere marcar como indisponível.

## Casos de uso do site (entrega)

### UC07 — Consultar cardápio

- **Ator**: Cliente
- **Pré-condição**: nenhuma.
- **Fluxo principal**:
  1. Cliente acessa a página inicial do site.
  2. Sistema mostra os produtos disponíveis agrupados por categoria.
- **Fluxo alternativo**: categoria sem produto disponível não aparece.

### UC08 — Montar carrinho

- **Ator**: Cliente
- **Pré-condição**: o produto escolhido está disponível.
- **Fluxo principal**:
  1. Cliente abre a página de um produto.
  2. Se for pizza, escolhe o tamanho e, opcionalmente, um segundo sabor da mesma categoria.
  3. Cliente informa a quantidade e adiciona ao carrinho.
  4. Sistema valida a seleção e calcula o preço do item.
- **Fluxo alternativo**: seleção inválida — sistema recusa e explica o motivo.

### UC09 — Finalizar pedido de entrega

- **Ator**: Cliente
- **Pré-condição**: o carrinho tem pelo menos um item.
- **Fluxo principal**:
  1. Cliente informa nome, telefone, endereço e forma de pagamento.
  2. Sistema localiza o cliente pelo telefone ou cadastra um novo.
  3. Sistema cria o pedido com tipo "entrega" e status "recebido", copiando o preço atual de cada item.
  4. Sistema calcula o total (itens mais taxa de entrega).
  5. Sistema mostra a confirmação com o número do pedido.
- **Fluxo alternativo**: carrinho vazio ou dado obrigatório ausente — sistema pede para completar antes de prosseguir.

## Caso de uso comum aos dois fluxos

### UC10 — Acompanhar pedido

- **Ator**: Cliente, Garçom ou Atendente
- **Pré-condição**: o pedido já foi criado.
- **Fluxo principal**:
  1. Ator consulta o pedido (pelo número, no caso do Cliente; pela listagem, no caso de Garçom e Atendente).
  2. Sistema mostra o status atual e o resumo dos itens e valores.
- **Fluxo alternativo**: pedido inexistente — sistema informa que não foi encontrado.
