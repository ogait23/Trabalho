# Orientação para a documentação — versão 2 da Fornatta

Este texto lista **o que mudou no sistema** e **o que você precisa atualizar** na
documentação do trabalho (diagramas, casos de uso e requisitos). Não precisa ler o
código: as mudanças estão todas descritas aqui.

## Resumo das mudanças

1. **Retirada no balcão:** além da entrega, o cliente pode pedir pelo site e buscar
   na pizzaria.
2. **Pagamento sempre presencial:** o cliente só *informa* como vai pagar (dinheiro,
   débito ou crédito) e, se for dinheiro, o troco. O pagamento é recebido na entrega
   ou no balcão. Continua **sem pagamento online**.
3. **Observação no pedido:** campo livre de até 140 caracteres (ex.: "sem cebola").
4. **Acompanhamento ao vivo (upgrade):** o cliente vê a linha do tempo do pedido e
   uma barrinha que se atualiza sozinha a cada 10 segundos. O painel da equipe
   também se atualiza sozinho.
5. **Visual:** cardápio com busca, carrinho com botões + e −, animações. Isso não
   muda a modelagem; basta citar no texto, se quiser.

## 1. Diagrama de classes

Só a classe **Pedido** mudou. Atualize assim:

```
Pedido
-------------------------------
- numero: int
- mesa: Mesa                 (opcional)
- tipo: String               "salao" | "entrega" | "retirada"   <- NOVO valor "retirada"
- cliente: Usuario           (opcional)
- endereco: String           (só para entrega)
- formaPagamento: String     <- NOVO  ("dinheiro" | "cartao_debito" | "cartao_credito")
- trocoPara: float           <- NOVO  (só para dinheiro; 0 = sem troco)
- observacao: String         <- NOVO
- itens: List
- status: String
- valorTotal: float
- pagamento: Pagamento
-------------------------------
+ lancarPedido()
+ adicionarItem(produto, quantidade)
+ fecharConta(formaPagamento, caixa): Pagamento
```

As associações continuam iguais: Pedido → Mesa (0..1), Pedido → Usuario/cliente (0..1),
Pedido → Pagamento (0..1), Pedido → Produto (itens, 1..*).

**Pagamento:** não mudou, mas vale anotar no diagrama a restrição
`{forma ∈ dinheiro, cartao_debito, cartao_credito}`, ou seja, só presencial.

## 2. Casos de uso

| Caso de uso | O que fazer |
|---|---|
| "Fazer pedido de entrega" | **Renomear** para **"Fazer pedido pelo site"**, com dois fluxos: entrega e retirada no balcão |
| "Acompanhar pedido" (cliente) | **Atualizar:** o status aparece em linha do tempo e se atualiza sozinho |
| "Receber pagamento / fechar conta" (garçom) | **Atualizar:** vale também para retirada no balcão |
| "Ver entregas" (garçom) | **Renomear** para **"Ver entregas e retiradas"** |

### Fluxo do caso de uso "Fazer pedido pelo site" (sugestão de texto)

**Ator:** Cliente. **Pré-condição:** o cliente está logado.

1. O cliente adiciona produtos ao pedido.
2. O cliente escolhe **Entrega** ou **Retirar no balcão**.
3. Se escolher Entrega, informa o endereço.
4. O cliente escolhe a forma de pagamento: dinheiro, débito ou crédito.
5. Se escolher dinheiro, pode informar o troco.
6. O cliente pode escrever uma observação.
7. O sistema valida os itens, o estoque e o pagamento.
8. O sistema registra o pedido com status "recebido" e o envia para a cozinha ("em preparo").

**Fluxos alternativos:**
- 3a. Endereço com menos de 10 caracteres → o sistema mostra "Informe o endereço completo".
- 5a. Troco menor que o total → o sistema mostra "O troco precisa ser para um valor maior que o total".
- 7a. Falta estoque → o sistema mostra "Estoque insuficiente de X".

**Regra de negócio:** não existe pagamento online. O pagamento é recebido na entrega ou no balcão.

## 3. Diagrama de estados do Pedido

Os estados são os mesmos de antes. Só mudam os nomes que o cliente vê:

```
[recebido] --cozinha recebe--> [em_preparo] --cozinha termina--> [pronto] --pago--> [entregue]
```

| Estado | Entrega mostra | Retirada mostra |
|---|---|---|
| recebido | Recebido | Recebido |
| em_preparo | No forno | No forno |
| pronto | Saiu para entrega | Pronto no balcão |
| entregue | Entregue | Retirado |

## 4. Diagrama de sequência (sugestão: "Retirada no balcão")

```
Cliente -> Site: confirma pedido (retirada, dinheiro, troco 100)
Site -> Servidor: POST /api/meus-pedidos
Servidor -> Pedido: cria (tipo="retirada")
Servidor -> Cozinha: entra na fila (status em_preparo)
Cozinha(ator) -> Servidor: POST /api/pedidos/1/preparar  -> status pronto
Site(cliente) -> Servidor: GET /api/meus-pedidos  (a cada 10 s)  -> "Pronto no balcão"
Garçom -> Servidor: POST /api/pedidos/1/fechar
Servidor -> Pedido: fecharConta() -> Pagamento -> Caixa.totalRecebido += valor
```

## 5. Requisitos

**Novos requisitos funcionais (sugestão de numeração; ajuste para a sua):**
- **RF-novo-1:** o cliente deve poder escolher entre entrega e retirada no balcão.
- **RF-novo-2:** o cliente deve informar a forma de pagamento presencial e, se for dinheiro, o troco.
- **RF-novo-3:** o cliente pode adicionar uma observação ao pedido.
- **RF-novo-4:** o status do pedido deve ser atualizado na tela do cliente sem recarregar a página.
- **RF-novo-5:** o painel da equipe deve se atualizar sozinho.

**Regra de negócio (reforçar):**
- **RN:** o sistema não processa pagamento online. Ele só registra o pagamento recebido
  presencialmente (mesa, entrega ou balcão).

**Requisito não funcional (opcional):**
- Atualização automática a cada 10 segundos (polling).

## 6. Rotas da API (se a documentação tiver essa tabela)

- **Removida:** `POST /api/entregas` e `GET /api/entregas`.
- **Novas:** `POST /api/meus-pedidos` (cria pedido de entrega ou retirada) e
  `GET /api/pedidos-clientes` (o garçom vê entregas e retiradas).
- **Alterada:** `POST /api/pedidos/<n>/fechar`. Se o garçom não enviar a forma de
  pagamento, o sistema usa a que o cliente informou.

## Checklist

- [ ] Diagrama de classes: 3 atributos novos em Pedido e o valor "retirada" em `tipo`
- [ ] Casos de uso: renomear 2 e atualizar 2
- [ ] Fluxo do caso de uso "Fazer pedido pelo site"
- [ ] Diagrama de estados: tabela de nomes por tipo
- [ ] Diagrama de sequência da retirada no balcão
- [ ] Requisitos RF-novo-1 a RF-novo-5 e a regra de negócio do pagamento
- [ ] Tabela de rotas da API (se existir)
- [ ] Prints novos das telas: cardápio com busca, janela do pedido, rastreador e painel da equipe

Qualquer dúvida sobre como algo funciona, veja o [ESTUDO.md](ESTUDO.md).
