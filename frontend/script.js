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

function apiObterCategorias() {
    return requisitar("/categorias");
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

function apiAbrirPedido(numeroMesa, garcom, nomeCliente) {
    return requisitar("/mesas/" + numeroMesa + "/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garcom: garcom, nomeCliente: nomeCliente }),
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

function apiCadastrarProduto(dadosProduto) {
    return requisitar("/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosProduto),
    });
}

async function renderMesas() {
    const mesas = await apiObterMesas();
    const garcons = await apiObterGarcons();
    const container = document.getElementById("lista-mesas");
    container.innerHTML = "";

    mesas.forEach((mesa) => {
        const cartao = document.createElement("div");
        cartao.className = "cartao-mesa";

        const titulo = document.createElement("div");
        titulo.className = "titulo-mesa";

        const nomeMesa = document.createElement("span");
        nomeMesa.textContent = "Mesa " + mesa.numero + " · " + mesa.capacidade + " lugares";

        const selo = document.createElement("span");
        selo.className = "selo selo-" + mesa.status;
        selo.textContent = mesa.status === "ocupada" ? "Ocupada" : "Livre";

        titulo.appendChild(nomeMesa);
        titulo.appendChild(selo);
        cartao.appendChild(titulo);

        if (mesa.status === "ocupada") {
            const info = document.createElement("p");
            info.className = "info-mesa-extra";
            info.innerHTML = "Cliente: <strong>" + mesa.clienteNome + "</strong><br>Garçom: <strong>" + mesa.garcomNome + "</strong>";
            cartao.appendChild(info);

            const botao = document.createElement("button");
            botao.textContent = "Ver pedido";
            botao.addEventListener("click", () => abrirPedidoNaTela(mesa.pedidoAberto));
            cartao.appendChild(botao);
        } else {
            const form = document.createElement("form");
            form.className = "formulario-mesa";

            const inputCliente = document.createElement("input");
            inputCliente.type = "text";
            inputCliente.placeholder = "Nome do cliente";

            const select = document.createElement("select");
            garcons.forEach((nome) => {
                const opcao = document.createElement("option");
                opcao.value = nome;
                opcao.textContent = nome;
                select.appendChild(opcao);
            });

            const botao = document.createElement("button");
            botao.type = "submit";
            botao.className = "botao-garcom";
            botao.textContent = "Mandar garçom";

            form.addEventListener("submit", async (evento) => {
                evento.preventDefault();

                const nomeCliente = inputCliente.value.trim();
                if (!nomeCliente) {
                    alert("Informe o nome do cliente.");
                    return;
                }

                const pedido = await apiAbrirPedido(mesa.numero, select.value, nomeCliente);
                if (pedido.erro) {
                    alert(pedido.erro);
                    return;
                }
                await renderMesas();
                abrirPedidoNaTela(pedido.numero);
            });

            form.appendChild(inputCliente);
            form.appendChild(select);
            form.appendChild(botao);
            cartao.appendChild(form);
        }

        container.appendChild(cartao);
    });
}

function abrirPedidoNaTela(numero) {
    pedidoAtualNumero = numero;
    document.getElementById("secao-pedido").hidden = false;
    document.getElementById("secao-pedido").scrollIntoView({ behavior: "smooth" });
    renderPedido();
}

async function renderPedido() {
    if (!pedidoAtualNumero) {
        return;
    }

    const pedido = await apiObterPedido(pedidoAtualNumero);

    document.getElementById("pedido-numero").textContent = pedido.numero;
    document.getElementById("pedido-mesa").textContent = pedido.mesa;
    document.getElementById("pedido-total").textContent = pedido.valorTotal.toFixed(2);

    const badge = document.getElementById("pedido-status-badge");
    badge.className = "selo selo-" + pedido.status;
    badge.textContent = pedido.status;

    document.getElementById("pedido-cliente-linha").innerHTML =
        "Cliente: <strong>" + pedido.nomeCliente + "</strong> &middot; Garçom: <strong>" + pedido.garcom + "</strong>";

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

async function popularSelectCategorias() {
    const categorias = await apiObterCategorias();
    const select = document.getElementById("produto-categoria");
    select.innerHTML = "";
    categorias.forEach((nome) => {
        const opcao = document.createElement("option");
        opcao.value = nome;
        opcao.textContent = nome;
        select.appendChild(opcao);
    });
}

async function renderCozinha() {
    const pendentes = await apiObterCozinha();
    const container = document.getElementById("lista-cozinha");
    container.innerHTML = "";

    if (pendentes.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "vazio";
        vazio.textContent = "Nenhum pedido na fila.";
        container.appendChild(vazio);
        return;
    }

    pendentes.forEach((pedido) => {
        const linha = document.createElement("div");

        const texto = document.createElement("span");
        texto.textContent = "Pedido " + pedido.numero + " — mesa " + pedido.mesa;

        const botao = document.createElement("button");
        botao.textContent = "Preparar";
        botao.addEventListener("click", async () => {
            await apiPrepararPedido(pedido.numero);
            await renderCozinha();
            await renderPedido();
        });

        linha.appendChild(texto);
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

        const texto = document.createElement("span");
        texto.textContent = estoque.produto + ": " + estoque.quantidade + " unidades";
        if (estoque.baixo) {
            texto.textContent += " (estoque baixo)";
            texto.className = "item-estoque-baixo";
        }

        linha.appendChild(texto);
        container.appendChild(linha);
    });
}

function exibirMensagemProduto(texto, sucesso) {
    const mensagem = document.getElementById("mensagem-produto");
    mensagem.textContent = texto;
    mensagem.className = "mensagem " + (sucesso ? "mensagem-sucesso" : "mensagem-erro");
    mensagem.hidden = false;
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

document.getElementById("form-novo-produto").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const dadosProduto = {
        nome: document.getElementById("produto-nome").value.trim(),
        categoria: document.getElementById("produto-categoria").value,
        preco: parseFloat(document.getElementById("produto-preco").value),
        quantidadeEstoque: parseInt(document.getElementById("produto-estoque").value, 10) || 0,
        quantidadeMinima: parseInt(document.getElementById("produto-estoque-minimo").value, 10) || 0,
    };

    const resultado = await apiCadastrarProduto(dadosProduto);
    if (resultado.erro) {
        exibirMensagemProduto(resultado.erro, false);
        return;
    }

    exibirMensagemProduto("Produto \"" + resultado.nome + "\" cadastrado com sucesso.", true);
    document.getElementById("form-novo-produto").reset();

    await popularSelectProdutos();
    await renderEstoque();
});

async function iniciar() {
    await popularSelectProdutos();
    await popularSelectCategorias();
    await renderMesas();
    await renderCozinha();
    await renderCaixa();
    await renderEstoque();
}

iniciar();
