const BASE = "/api";
const estado = { usuario: null, csrf: "", carrinho: [], pedidoAtual: null };

const ROTULO_STATUS = {
    recebido: "recebido",
    em_preparo: "em preparo",
    pronto: "pronto",
    entregue: "finalizado",
    cancelado: "cancelado",
};

async function requisitar(caminho, corpo) {
    const opcoes = { headers: { "X-CSRF-Token": estado.csrf } };
    if (corpo !== undefined) {
        opcoes.method = "POST";
        opcoes.headers["Content-Type"] = "application/json";
        opcoes.body = JSON.stringify(corpo);
    }
    const resposta = await fetch(BASE + caminho, opcoes);
    const json = await resposta.json();
    if (resposta.status === 401 && estado.usuario) {
        estado.usuario = null;
        await atualizarTela();
    }
    return json;
}

function criar(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto !== undefined) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
}

function dinheiro(valor) {
    return valor.toFixed(2);
}

function descreverPedido(pedido) {
    const onde = pedido.tipo === "entrega" ? "entrega" : "mesa " + pedido.mesa;
    return "Pedido " + pedido.numero + " — " + onde + " — " + ROTULO_STATUS[pedido.status] + " — R$ " + dinheiro(pedido.valorTotal);
}

// ---------- Acesso ----------

async function carregarSessao() {
    const sessao = await requisitar("/sessao");
    estado.csrf = sessao.csrf;
    estado.usuario = sessao.usuario;
}

document.querySelectorAll(".aba").forEach((aba) => {
    aba.addEventListener("click", () => {
        document.querySelectorAll(".aba").forEach((outra) => outra.classList.toggle("ativa", outra === aba));
        document.getElementById("form-login").hidden = aba.dataset.aba !== "entrar";
        document.getElementById("form-cadastro").hidden = aba.dataset.aba !== "cadastrar";
    });
});

document.getElementById("form-login").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const resposta = await requisitar("/login", {
        email: document.getElementById("login-email").value,
        senha: document.getElementById("login-senha").value,
    });
    if (resposta.erro) {
        alert(resposta.erro);
        return;
    }
    estado.csrf = resposta.csrf;
    estado.usuario = resposta.usuario;
    document.getElementById("form-login").reset();
    await atualizarTela();
});

document.getElementById("form-cadastro").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const senha = document.getElementById("cadastro-senha").value;
    const confirmacao = document.getElementById("cadastro-confirmacao").value;
    if (senha !== confirmacao) {
        alert("As senhas não são iguais.");
        return;
    }
    const resposta = await requisitar("/cadastro", {
        nome: document.getElementById("cadastro-nome").value,
        email: document.getElementById("cadastro-email").value,
        telefone: document.getElementById("cadastro-telefone").value,
        senha: senha,
        confirmarSenha: confirmacao,
    });
    if (resposta.erro) {
        alert(resposta.erro);
        return;
    }
    document.getElementById("form-cadastro").reset();
    document.querySelector('.aba[data-aba="entrar"]').click();
    alert("Conta criada. Entre com o seu e-mail e a senha.");
});

document.getElementById("botao-sair").addEventListener("click", async () => {
    await requisitar("/sair", {});
    estado.carrinho = [];
    estado.pedidoAtual = null;
    await carregarSessao();
    await atualizarTela();
});

// ---------- Cardápio e carrinho ----------

async function renderCardapio() {
    const produtos = await requisitar("/produtos");
    const container = document.getElementById("lista-cardapio");
    const navegacao = document.getElementById("nav-cardapio");
    container.innerHTML = "";
    navegacao.innerHTML = "";
    const ehCliente = estado.usuario && estado.usuario.perfil === "cliente";
    let categoriaAtual = null;

    produtos.forEach((produto) => {
        if (produto.categoria !== categoriaAtual) {
            categoriaAtual = produto.categoria;
            const id = "cat-" + navegacao.children.length;
            const titulo = criar("h3", categoriaAtual);
            titulo.id = id;
            container.appendChild(titulo);
            const link = criar("a", categoriaAtual);
            link.href = "#" + id;
            navegacao.appendChild(link);
        }

        const item = criar("div", undefined, "produto");
        const linha = criar("div", undefined, "produto-linha");
        linha.append(criar("strong", produto.nome), criar("span", undefined, "pontilhado"), criar("span", "R$ " + dinheiro(produto.preco), "preco"));
        item.append(linha, criar("p", produto.descricao));

        if (ehCliente) {
            const form = criar("form");
            const quantidade = criar("input");
            quantidade.type = "number";
            quantidade.min = 1;
            quantidade.max = 20;
            quantidade.value = 1;
            const botao = criar("button", "Adicionar ao pedido");
            botao.type = "submit";
            form.append(quantidade, botao);
            form.addEventListener("submit", (evento) => {
                evento.preventDefault();
                adicionarAoCarrinho(produto, parseInt(quantidade.value, 10) || 1);
            });
            item.appendChild(form);
        }
        container.appendChild(item);
    });
}

function adicionarAoCarrinho(produto, quantidade) {
    const existente = estado.carrinho.find((item) => item.produto.nome === produto.nome);
    if (existente) {
        existente.quantidade += quantidade;
    } else {
        estado.carrinho.push({ produto: produto, quantidade: quantidade });
    }
    renderCarrinho();
}

function renderCarrinho() {
    const lista = document.getElementById("lista-carrinho");
    lista.innerHTML = "";
    let total = 0;
    estado.carrinho.forEach((item, indice) => {
        total += item.produto.preco * item.quantidade;
        const linha = criar("li", item.quantidade + "x " + item.produto.nome + " — R$ " + dinheiro(item.produto.preco * item.quantidade) + " ");
        const remover = criar("button", "Remover");
        remover.type = "button";
        remover.addEventListener("click", () => {
            estado.carrinho.splice(indice, 1);
            renderCarrinho();
        });
        linha.appendChild(remover);
        lista.appendChild(linha);
    });
    document.getElementById("carrinho-total").textContent = dinheiro(total);
}

document.getElementById("form-entrega").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (estado.carrinho.length === 0) {
        alert("Adicione itens do cardápio ao pedido.");
        return;
    }
    const resposta = await requisitar("/entregas", {
        endereco: document.getElementById("entrega-endereco").value,
        itens: estado.carrinho.map((item) => ({ produto: item.produto.nome, quantidade: item.quantidade })),
    });
    if (resposta.erro) {
        alert(resposta.erro);
        return;
    }
    estado.carrinho = [];
    renderCarrinho();
    await renderMeusPedidos();
    alert("Pedido " + resposta.numero + " recebido. O pagamento é feito na entrega.");
});

async function renderMeusPedidos() {
    const pedidos = await requisitar("/meus-pedidos");
    const container = document.getElementById("lista-meus-pedidos");
    container.innerHTML = "";
    if (pedidos.length === 0) {
        container.appendChild(criar("p", "Você ainda não fez nenhum pedido.", "aviso"));
        return;
    }
    pedidos.forEach((pedido) => container.appendChild(criar("div", descreverPedido(pedido), "linha-pedido")));
}

// ---------- Garçom ----------

async function renderMesas() {
    const mesas = await requisitar("/mesas");
    const container = document.getElementById("lista-mesas");
    container.innerHTML = "";

    mesas.forEach((mesa) => {
        const cartao = criar("div", undefined, "cartao-mesa");
        cartao.appendChild(criar("strong", "Mesa " + mesa.numero + " (" + mesa.capacidade + " lugares) — " + mesa.status));

        const botao = criar("button", mesa.status === "ocupada" ? "Ver pedido" : "Abrir pedido");
        botao.type = "button";
        botao.addEventListener("click", async () => {
            if (mesa.status === "ocupada") {
                abrirPedidoNaTela(mesa.pedidoAberto);
                return;
            }
            const pedido = await requisitar("/mesas/" + mesa.numero + "/pedido", {});
            if (pedido.erro) {
                alert(pedido.erro);
                return;
            }
            await renderMesas();
            abrirPedidoNaTela(pedido.numero);
        });
        cartao.appendChild(botao);
        container.appendChild(cartao);
    });
}

function abrirPedidoNaTela(numero) {
    estado.pedidoAtual = numero;
    document.getElementById("secao-pedido").hidden = false;
    renderPedido();
}

async function renderPedido() {
    if (!estado.pedidoAtual) return;
    const pedido = await requisitar("/pedidos/" + estado.pedidoAtual);
    if (pedido.erro) return;

    document.getElementById("pedido-numero").textContent = pedido.numero;
    document.getElementById("pedido-mesa").textContent = pedido.mesa;
    document.getElementById("pedido-status").textContent = ROTULO_STATUS[pedido.status];
    document.getElementById("pedido-total").textContent = dinheiro(pedido.valorTotal);

    const lista = document.getElementById("lista-itens");
    lista.innerHTML = "";
    pedido.itens.forEach((item) => {
        lista.appendChild(criar("li", item.quantidade + "x " + item.produto + " — R$ " + dinheiro(item.precoUnitario * item.quantidade)));
    });

    const finalizado = pedido.status === "entregue" || pedido.status === "cancelado";
    document.getElementById("form-item").hidden = finalizado;
    document.getElementById("botao-enviar-cozinha").hidden = finalizado || pedido.status !== "recebido";
    document.getElementById("form-fechar-conta").hidden = finalizado || pedido.status !== "pronto";
}

async function popularSelectProdutos() {
    const produtos = await requisitar("/produtos");
    const select = document.getElementById("select-produto");
    select.innerHTML = "";
    produtos.forEach((produto) => {
        const opcao = criar("option", produto.nome + " — R$ " + dinheiro(produto.preco));
        opcao.value = produto.nome;
        select.appendChild(opcao);
    });
}

async function renderEntregas() {
    const entregas = await requisitar("/entregas");
    const container = document.getElementById("lista-entregas");
    container.innerHTML = "";
    if (entregas.length === 0) {
        container.appendChild(criar("p", "Nenhuma entrega em andamento.", "aviso"));
        return;
    }

    entregas.forEach((pedido) => {
        const linha = criar("div", undefined, "linha-pedido");
        linha.appendChild(criar("strong", descreverPedido(pedido)));
        linha.appendChild(criar("span", pedido.cliente + " — " + pedido.telefone + " — " + pedido.endereco));

        if (pedido.status === "pronto") {
            const form = criar("form");
            const select = criar("select");
            [["dinheiro", "Dinheiro"], ["cartao_debito", "Cartão de débito"], ["cartao_credito", "Cartão de crédito"]].forEach(([valor, rotulo]) => {
                const opcao = criar("option", rotulo);
                opcao.value = valor;
                select.appendChild(opcao);
            });
            const botao = criar("button", "Entregue e pago");
            botao.type = "submit";
            form.append(select, botao);
            form.addEventListener("submit", async (evento) => {
                evento.preventDefault();
                const resposta = await requisitar("/pedidos/" + pedido.numero + "/fechar", { formaPagamento: select.value });
                if (resposta.erro) {
                    alert(resposta.erro);
                    return;
                }
                await renderEntregas();
                await renderCaixa();
            });
            linha.appendChild(form);
        }
        container.appendChild(linha);
    });
}

document.getElementById("form-item").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const resultado = await requisitar("/pedidos/" + estado.pedidoAtual + "/itens", {
        produto: document.getElementById("select-produto").value,
        quantidade: parseInt(document.getElementById("input-quantidade").value, 10),
    });
    if (resultado.erro) {
        alert(resultado.erro);
        return;
    }
    await renderPedido();
});

document.getElementById("botao-enviar-cozinha").addEventListener("click", async () => {
    const resultado = await requisitar("/pedidos/" + estado.pedidoAtual + "/cozinha", {});
    if (resultado.erro) {
        alert(resultado.erro);
        return;
    }
    await renderPedido();
});

document.getElementById("form-fechar-conta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const resultado = await requisitar("/pedidos/" + estado.pedidoAtual + "/fechar", {
        formaPagamento: document.getElementById("select-pagamento").value,
    });
    if (resultado.erro) {
        alert(resultado.erro);
        return;
    }
    await renderPedido();
    await renderMesas();
    await renderCaixa();
});

// ---------- Cozinha e gerente ----------

async function renderCozinha() {
    const pendentes = await requisitar("/cozinha");
    const container = document.getElementById("lista-cozinha");
    container.innerHTML = "";
    if (pendentes.length === 0) {
        container.appendChild(criar("p", "Nenhum pedido na fila.", "aviso"));
    }

    pendentes.forEach((pedido) => {
        const linha = criar("div", undefined, "linha-pedido");
        const origem = pedido.tipo === "entrega" ? "entrega" : "mesa " + pedido.mesa;
        linha.appendChild(criar("strong", "Pedido " + pedido.numero + " — " + origem));
        pedido.itens.forEach((item) => linha.appendChild(criar("span", item.quantidade + "x " + item.produto)));

        const botao = criar("button", "Marcar como pronto");
        botao.type = "button";
        botao.addEventListener("click", async () => {
            await requisitar("/pedidos/" + pedido.numero + "/preparar", {});
            await renderCozinha();
        });
        linha.appendChild(botao);
        container.appendChild(linha);
    });
}

async function renderEstoque() {
    const estoques = await requisitar("/estoque");
    const container = document.getElementById("lista-estoque");
    container.innerHTML = "";
    estoques.forEach((estoque) => {
        const aviso = estoque.baixo ? " (ESTOQUE BAIXO)" : "";
        container.appendChild(criar("div", estoque.produto + ": " + estoque.quantidade + " unidades" + aviso, "item-estoque"));
    });
}

async function renderCaixa() {
    const caixa = await requisitar("/caixa");
    if (caixa.erro) return;
    document.getElementById("caixa-total").textContent = dinheiro(caixa.totalRecebido);
}

document.getElementById("botao-fechar-caixa").addEventListener("click", async () => {
    const resultado = await requisitar("/caixa/fechar", {});
    if (resultado.erro) {
        alert(resultado.erro);
        return;
    }
    alert("Total recebido: R$ " + dinheiro(resultado.total));
    await renderCaixa();
});

// ---------- Tela ----------

async function atualizarTela() {
    const usuario = estado.usuario;
    const perfil = usuario ? usuario.perfil : null;

    document.getElementById("secao-acesso").hidden = usuario !== null;
    document.getElementById("hero").hidden = perfil !== null && perfil !== "cliente";
    document.getElementById("barra-usuario").hidden = usuario === null;
    if (usuario) {
        document.getElementById("usuario-nome").textContent = usuario.nome + " (" + usuario.perfil + ")";
    }

    document.querySelectorAll("[data-perfis]").forEach((secao) => {
        const permitidos = secao.dataset.perfis.split(" ");
        const visivel = perfil !== null && (perfil === "gerente" || permitidos.includes(perfil));
        secao.hidden = !visivel || (secao.id === "secao-pedido" && estado.pedidoAtual === null);
    });

    await renderCardapio();
    if (perfil === "cliente") {
        renderCarrinho();
        await renderMeusPedidos();
    }
    if (perfil === "garcom" || perfil === "gerente") {
        await popularSelectProdutos();
        await renderMesas();
        await renderEntregas();
    }
    if (perfil === "cozinha" || perfil === "gerente") {
        await renderCozinha();
        await renderEstoque();
    }
    if (perfil === "gerente") {
        await renderCaixa();
    }
}

async function iniciar() {
    await carregarSessao();
    await atualizarTela();
}

iniciar();
