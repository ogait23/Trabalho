const BASE = "/api";
let pedidoAtualNumero = null;

async function requisitar(caminho, opcoes) {
    const resposta = await fetch(BASE + caminho, opcoes);
    return resposta.json();
}

function apiObterMesas() {
    return requisitar("/mesas");
}

function apiObterProdutos() {
    return requisitar("/produtos");
}

function apiObterGarcons() {
    return requisitar("/garcons");
}

function apiObterEstoque() {
    return requisitar("/estoque");
}

function apiObterCozinha() {
    return requisitar("/cozinha");
}

function apiObterCaixa() {
    return requisitar("/caixa");
}

function apiObterPedido(numero) {
    return requisitar("/pedidos/" + numero);
}

function apiAbrirPedido(numeroMesa, garcom) {
    return requisitar("/mesas/" + numeroMesa + "/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garcom: garcom }),
    });
}

function apiAdicionarItem(numeroPedido, produto, quantidade) {
    return requisitar("/pedidos/" + numeroPedido + "/itens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produto: produto, quantidade: quantidade }),
    });
}

function apiEnviarParaCozinha(numeroPedido) {
    return requisitar("/pedidos/" + numeroPedido + "/cozinha", { method: "POST" });
}

function apiPrepararPedido(numeroPedido) {
    return requisitar("/pedidos/" + numeroPedido + "/preparar", { method: "POST" });
}

function apiFecharConta(numeroPedido, formaPagamento) {
    return requisitar("/pedidos/" + numeroPedido + "/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formaPagamento: formaPagamento }),
    });
}

function apiFecharCaixa() {
    return requisitar("/caixa/fechar", { method: "POST" });
}

async function renderMesas() {
    const mesas = await apiObterMesas();
    const garcons = await apiObterGarcons();
    const container = document.getElementById("lista-mesas");
    container.innerHTML = "";

    mesas.forEach((mesa) => {
        const cartao = document.createElement("div");
        cartao.className = "cartao-mesa";

        const titulo = document.createElement("strong");
        titulo.textContent = "Mesa " + mesa.numero + " (" + mesa.capacidade + " lugares) — " + mesa.status;
        cartao.appendChild(titulo);

        if (mesa.status === "ocupada") {
            const botao = document.createElement("button");
            botao.textContent = "Ver pedido";
            botao.addEventListener("click", () => abrirPedidoNaTela(mesa.pedidoAberto));
            cartao.appendChild(botao);
        } else {
            const select = document.createElement("select");
            garcons.forEach((nome) => {
                const opcao = document.createElement("option");
                opcao.value = nome;
                opcao.textContent = nome;
                select.appendChild(opcao);
            });

            const botao = document.createElement("button");
            botao.textContent = "Abrir pedido";
            botao.addEventListener("click", async () => {
                const pedido = await apiAbrirPedido(mesa.numero, select.value);
                if (pedido.erro) {
                    alert(pedido.erro);
                    return;
                }
                await renderMesas();
                abrirPedidoNaTela(pedido.numero);
            });

            cartao.appendChild(select);
            cartao.appendChild(botao);
        }

        container.appendChild(cartao);
    });
}

function abrirPedidoNaTela(numero) {
    pedidoAtualNumero = numero;
    document.getElementById("secao-pedido").hidden = false;
    renderPedido();
}

async function renderPedido() {
    if (!pedidoAtualNumero) {
        return;
    }

    const pedido = await apiObterPedido(pedidoAtualNumero);

    document.getElementById("pedido-numero").textContent = pedido.numero;
    document.getElementById("pedido-mesa").textContent = pedido.mesa;
    document.getElementById("pedido-status").textContent = pedido.status;
    document.getElementById("pedido-total").textContent = pedido.valorTotal.toFixed(2);

    const lista = document.getElementById("lista-itens");
    lista.innerHTML = "";
    pedido.itens.forEach((item) => {
        const linha = document.createElement("li");
        linha.textContent = item.quantidade + "x " + item.produto + " — R$ " + (item.precoUnitario * item.quantidade).toFixed(2);
        lista.appendChild(linha);
    });

    const finalizado = pedido.status === "entregue" || pedido.status === "cancelado";
    document.getElementById("form-item").hidden = finalizado;
    document.getElementById("botao-enviar-cozinha").hidden = finalizado || pedido.status !== "recebido";
    document.getElementById("form-fechar-conta").hidden = finalizado || pedido.status !== "pronto";
}

async function popularSelectProdutos() {
    const produtos = await apiObterProdutos();
    const select = document.getElementById("select-produto");
    select.innerHTML = "";
    produtos.forEach((produto) => {
        const opcao = document.createElement("option");
        opcao.value = produto.nome;
        opcao.textContent = produto.nome + " — R$ " + produto.preco.toFixed(2);
        select.appendChild(opcao);
    });
}

async function renderCozinha() {
    const pendentes = await apiObterCozinha();
    const container = document.getElementById("lista-cozinha");
    container.innerHTML = "";

    pendentes.forEach((pedido) => {
        const linha = document.createElement("div");
        linha.textContent = "Pedido " + pedido.numero + " — mesa " + pedido.mesa + " ";

        const botao = document.createElement("button");
        botao.textContent = "Preparar";
        botao.addEventListener("click", async () => {
            await apiPrepararPedido(pedido.numero);
            await renderCozinha();
            await renderPedido();
        });

        linha.appendChild(botao);
        container.appendChild(linha);
    });
}

async function renderCaixa() {
    const caixa = await apiObterCaixa();
    document.getElementById("caixa-total").textContent = caixa.totalRecebido.toFixed(2);
}

async function renderEstoque() {
    const estoques = await apiObterEstoque();
    const container = document.getElementById("lista-estoque");
    container.innerHTML = "";

    estoques.forEach((estoque) => {
        const linha = document.createElement("div");
        const aviso = estoque.baixo ? " (ESTOQUE BAIXO)" : "";
        linha.textContent = estoque.produto + ": " + estoque.quantidade + " unidades" + aviso;
        container.appendChild(linha);
    });
}

document.getElementById("form-item").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const produto = document.getElementById("select-produto").value;
    const quantidade = parseInt(document.getElementById("input-quantidade").value, 10);

    const resultado = await apiAdicionarItem(pedidoAtualNumero, produto, quantidade);
    if (resultado.erro) {
        alert(resultado.erro);
        return;
    }

    await renderPedido();
    await renderEstoque();
});

document.getElementById("botao-enviar-cozinha").addEventListener("click", async () => {
    await apiEnviarParaCozinha(pedidoAtualNumero);
    await renderPedido();
    await renderCozinha();
});

document.getElementById("form-fechar-conta").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const forma = document.getElementById("select-pagamento").value;
    const resultado = await apiFecharConta(pedidoAtualNumero, forma);
    if (resultado.erro) {
        alert(resultado.erro);
        return;
    }

    await renderPedido();
    await renderMesas();
    await renderCaixa();
});

document.getElementById("botao-fechar-caixa").addEventListener("click", async () => {
    const resultado = await apiFecharCaixa();
    alert("Total recebido: R$ " + resultado.total.toFixed(2));
    await renderCaixa();
});

async function iniciar() {
    await popularSelectProdutos();
    await renderMesas();
    await renderCozinha();
    await renderCaixa();
    await renderEstoque();
}

iniciar();
