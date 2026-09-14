class Mesa {
    constructor(numero, capacidade, status) {
        this.numero = numero;
        this.capacidade = capacidade;
        this.status = status || "livre";
    }

    ocupar() {
        if (this.status === "ocupada") {
            throw new Error("Mesa " + this.numero + " já está ocupada.");
        }
        this.status = "ocupada";
    }

    liberar() {
        this.status = "livre";
    }
}

class Categoria {
    constructor(nome) {
        this.nome = nome;
        this.produtos = [];
    }

    listarProdutos() {
        return this.produtos;
    }
}

class Produto {
    constructor(nome, preco, categoria) {
        this.nome = nome;
        this.preco = preco;
        this.categoria = categoria;
        categoria.produtos.push(this);
    }

    atualizarPreco(novoPreco) {
        this.preco = novoPreco;
    }
}

class Garcom {
    constructor(nome) {
        this.nome = nome;
        this.mesasAtendidas = [];
    }

    atenderMesa(mesa) {
        this.mesasAtendidas.push(mesa);
    }
}

class Pagamento {
    constructor(forma, valor, pedido) {
        this.forma = forma;
        this.valor = valor;
        this.pedido = pedido;
    }

    registrarPagamento(caixa) {
        caixa.totalRecebido += this.valor;
    }
}

const STATUS_FINALIZADOS = ["entregue", "cancelado"];

class Pedido {
    constructor(numero, mesa) {
        this.numero = numero;
        this.mesa = mesa;
        this.itens = [];
        this.status = null;
        this.valorTotal = 0;
        this.pagamento = null;
    }

    lancarPedido() {
        this.status = "recebido";
    }

    adicionarItem(produto, quantidade) {
        if (STATUS_FINALIZADOS.includes(this.status)) {
            throw new Error("Pedido " + this.numero + " já foi finalizado.");
        }
        this.itens.push({ produto: produto, quantidade: quantidade, precoUnitario: produto.preco });
        this.valorTotal = this.itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
    }

    fecharConta(formaPagamento, caixa) {
        if (STATUS_FINALIZADOS.includes(this.status)) {
            throw new Error("Pedido " + this.numero + " já foi finalizado.");
        }
        this.status = "entregue";
        this.mesa.liberar();
        const pagamento = new Pagamento(formaPagamento, this.valorTotal, this);
        pagamento.registrarPagamento(caixa);
        this.pagamento = pagamento;
        return pagamento;
    }
}

class Cozinha {
    constructor() {
        this.pedidosPendentes = [];
    }

    prepararPedido(pedido) {
        const indice = this.pedidosPendentes.indexOf(pedido);
        if (indice === -1) {
            throw new Error("Pedido " + pedido.numero + " não está na fila da cozinha.");
        }
        this.pedidosPendentes.splice(indice, 1);
        pedido.status = "pronto";
    }
}

class Caixa {
    constructor() {
        this.totalRecebido = 0;
    }

    fecharCaixa() {
        const total = this.totalRecebido;
        this.totalRecebido = 0;
        return total;
    }
}

class Estoque {
    constructor(produto, quantidade, quantidadeMinima) {
        this.produto = produto;
        this.quantidade = quantidade;
        this.quantidadeMinima = quantidadeMinima;
    }

    atualizarQuantidade(variacao) {
        this.quantidade += variacao;
    }

    verificarEstoqueBaixo() {
        return this.quantidade <= this.quantidadeMinima;
    }
}

function criarProduto(dados, nome, preco, categoria, quantidadeEstoque, quantidadeMinima) {
    const produto = new Produto(nome, preco, categoria);
    dados.produtos.push(produto);
    dados.estoques.push(new Estoque(produto, quantidadeEstoque, quantidadeMinima));
    return produto;
}

function montarDadosIniciais() {
    const dados = {
        categorias: [],
        produtos: [],
        mesas: [],
        garcons: [],
        estoques: [],
        pedidos: [],
        cozinha: new Cozinha(),
        caixa: new Caixa(),
    };

    const pizzaSalgada = new Categoria("Pizza Salgada");
    const pizzaDoce = new Categoria("Pizza Doce");
    const bebida = new Categoria("Bebida");
    const porcao = new Categoria("Porção");
    dados.categorias.push(pizzaSalgada, pizzaDoce, bebida, porcao);

    criarProduto(dados, "Calabresa", 28.0, pizzaSalgada, 20, 5);
    criarProduto(dados, "Quatro Queijos", 32.0, pizzaSalgada, 15, 5);
    criarProduto(dados, "Frango com Catupiry", 30.0, pizzaSalgada, 15, 5);
    criarProduto(dados, "Chocolate", 30.0, pizzaDoce, 10, 3);
    criarProduto(dados, "Banana com Canela", 26.0, pizzaDoce, 10, 3);
    criarProduto(dados, "Refrigerante 2L", 10.0, bebida, 30, 10);
    criarProduto(dados, "Água Mineral", 5.0, bebida, 40, 10);
    criarProduto(dados, "Cerveja Long Neck", 12.0, bebida, 24, 6);
    criarProduto(dados, "Batata Frita", 22.0, porcao, 20, 5);
    criarProduto(dados, "Calabresa Acebolada", 24.0, porcao, 20, 5);
    criarProduto(dados, "Frango a Passarinho", 26.0, porcao, 15, 5);
    criarProduto(dados, "Anéis de Cebola", 20.0, porcao, 15, 5);
    criarProduto(dados, "Pão de Alho", 14.0, porcao, 25, 8);

    for (let numero = 1; numero <= 6; numero++) {
        dados.mesas.push(new Mesa(numero, 4));
    }

    dados.garcons.push(new Garcom("Carlos"));
    dados.garcons.push(new Garcom("Fernanda"));

    return dados;
}

const dados = montarDadosIniciais();
let pedidoAtual = null;

function renderMesas() {
    const container = document.getElementById("lista-mesas");
    container.innerHTML = "";

    dados.mesas.forEach((mesa) => {
        const cartao = document.createElement("div");
        cartao.className = "cartao-mesa";

        const titulo = document.createElement("strong");
        titulo.textContent = "Mesa " + mesa.numero + " (" + mesa.capacidade + " lugares) — " + mesa.status;
        cartao.appendChild(titulo);

        if (mesa.status === "ocupada") {
            const pedido = dados.pedidos.find((p) => p.mesa === mesa && !STATUS_FINALIZADOS.includes(p.status));
            const botao = document.createElement("button");
            botao.textContent = "Ver pedido";
            botao.addEventListener("click", () => abrirPedidoNaTela(pedido));
            cartao.appendChild(botao);
        } else {
            const select = document.createElement("select");
            dados.garcons.forEach((garcom) => {
                const opcao = document.createElement("option");
                opcao.value = garcom.nome;
                opcao.textContent = garcom.nome;
                select.appendChild(opcao);
            });

            const botao = document.createElement("button");
            botao.textContent = "Abrir pedido";
            botao.addEventListener("click", () => {
                const garcom = dados.garcons.find((g) => g.nome === select.value);
                lancarPedido(mesa, garcom);
            });

            cartao.appendChild(select);
            cartao.appendChild(botao);
        }

        container.appendChild(cartao);
    });
}

function lancarPedido(mesa, garcom) {
    mesa.ocupar();
    garcom.atenderMesa(mesa);

    const pedido = new Pedido(dados.pedidos.length + 1, mesa);
    pedido.lancarPedido();
    dados.pedidos.push(pedido);

    renderMesas();
    abrirPedidoNaTela(pedido);
}

function abrirPedidoNaTela(pedido) {
    pedidoAtual = pedido;
    document.getElementById("secao-pedido").hidden = false;
    renderPedido();
}

function renderPedido() {
    if (!pedidoAtual) {
        return;
    }

    document.getElementById("pedido-numero").textContent = pedidoAtual.numero;
    document.getElementById("pedido-mesa").textContent = pedidoAtual.mesa.numero;
    document.getElementById("pedido-status").textContent = pedidoAtual.status;
    document.getElementById("pedido-total").textContent = pedidoAtual.valorTotal.toFixed(2);

    const lista = document.getElementById("lista-itens");
    lista.innerHTML = "";
    pedidoAtual.itens.forEach((item) => {
        const linha = document.createElement("li");
        linha.textContent = item.quantidade + "x " + item.produto.nome + " — R$ " + (item.precoUnitario * item.quantidade).toFixed(2);
        lista.appendChild(linha);
    });

    const finalizado = STATUS_FINALIZADOS.includes(pedidoAtual.status);
    document.getElementById("form-item").hidden = finalizado;
    document.getElementById("botao-enviar-cozinha").hidden = finalizado || pedidoAtual.status !== "recebido";
    document.getElementById("form-fechar-conta").hidden = finalizado || pedidoAtual.status !== "pronto";
}

function popularSelectProdutos() {
    const select = document.getElementById("select-produto");
    select.innerHTML = "";
    dados.produtos.forEach((produto) => {
        const opcao = document.createElement("option");
        opcao.value = produto.nome;
        opcao.textContent = produto.nome + " — R$ " + produto.preco.toFixed(2);
        select.appendChild(opcao);
    });
}

function renderCozinha() {
    const container = document.getElementById("lista-cozinha");
    container.innerHTML = "";

    dados.cozinha.pedidosPendentes.forEach((pedido) => {
        const linha = document.createElement("div");
        linha.textContent = "Pedido " + pedido.numero + " — mesa " + pedido.mesa.numero + " ";

        const botao = document.createElement("button");
        botao.textContent = "Preparar";
        botao.addEventListener("click", () => {
            dados.cozinha.prepararPedido(pedido);
            renderCozinha();
            renderPedido();
        });

        linha.appendChild(botao);
        container.appendChild(linha);
    });
}

function renderCaixa() {
    document.getElementById("caixa-total").textContent = dados.caixa.totalRecebido.toFixed(2);
}

function renderEstoque() {
    const container = document.getElementById("lista-estoque");
    container.innerHTML = "";

    dados.estoques.forEach((estoque) => {
        const linha = document.createElement("div");
        const aviso = estoque.verificarEstoqueBaixo() ? " (ESTOQUE BAIXO)" : "";
        linha.textContent = estoque.produto.nome + ": " + estoque.quantidade + " unidades" + aviso;
        container.appendChild(linha);
    });
}

document.getElementById("form-item").addEventListener("submit", (evento) => {
    evento.preventDefault();

    const nomeProduto = document.getElementById("select-produto").value;
    const produto = dados.produtos.find((p) => p.nome === nomeProduto);
    const quantidade = parseInt(document.getElementById("input-quantidade").value, 10);
    const estoque = dados.estoques.find((e) => e.produto === produto);

    if (estoque.quantidade < quantidade) {
        alert("Estoque insuficiente.");
        return;
    }

    pedidoAtual.adicionarItem(produto, quantidade);
    estoque.atualizarQuantidade(-quantidade);

    renderPedido();
    renderEstoque();
});

document.getElementById("botao-enviar-cozinha").addEventListener("click", () => {
    dados.cozinha.pedidosPendentes.push(pedidoAtual);
    pedidoAtual.status = "em_preparo";
    renderPedido();
    renderCozinha();
});

document.getElementById("form-fechar-conta").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const forma = document.getElementById("select-pagamento").value;
    pedidoAtual.fecharConta(forma, dados.caixa);
    renderPedido();
    renderMesas();
    renderCaixa();
});

document.getElementById("botao-fechar-caixa").addEventListener("click", () => {
    const total = dados.caixa.fecharCaixa();
    alert("Total recebido: R$ " + total.toFixed(2));
    renderCaixa();
});

popularSelectProdutos();
renderMesas();
renderCozinha();
renderCaixa();
renderEstoque();
