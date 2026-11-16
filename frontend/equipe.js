// =====================================================================
//  equipe.js — painel da equipe (equipe.html)
//  Abas: Cozinha · Salão · Entregas e balcão · Estoque · Caixa
//  Cada perfil vê só as abas dele. Admin/gerente vê tudo.
// =====================================================================

const painel = {
    aba: "",
    produtos: [],
    mesaAberta: null,     // número do pedido da mesa que está aberta no painel lateral
    mesaNumero: null,
    categoriaMesa: "Pizzas Tradicionais", // filtro dos botões de produto na mesa
    filaAnterior: null,   // para avisar "novo pedido na cozinha"
};

// Quais abas cada perfil pode ver
function podeVer(perfisDaAba) {
    const perfil = sessao.usuario?.perfil;
    return perfil === "gerente" || perfisDaAba.split(" ").includes(perfil);
}

// ---------- Login da equipe ----------

document.getElementById("form-equipe").addEventListener("input", (e) => limparErro(e.currentTarget));
document.getElementById("form-equipe").addEventListener("submit", acaoSegura(async () => {
    const form = document.getElementById("form-equipe");
    const login = document.getElementById("equipe-usuario").value.trim();
    const senha = document.getElementById("equipe-senha").value;
    if (!login || !senha) { mostrarErro(form, "Preencha usuário e senha."); return; }
    const resposta = await entrar(login, senha);
    if (resposta.erro) { mostrarErro(form, resposta.erro); return; }
    if (!EH_EQUIPE(sessao.usuario)) {
        await sair();
        mostrarErro(form, "Essa é uma conta de cliente. Use a loja para fazer pedidos.");
        return;
    }
    form.reset();
    await mostrarTela();
}));

document.getElementById("botao-sair").addEventListener("click", acaoSegura(async () => {
    await sair();
    await mostrarTela();
}));

// ---------- Abas ----------

function trocarAba(nome) {
    painel.aba = nome;
    document.querySelectorAll(".staff-tabs [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === nome)));
    document.querySelectorAll(".tab-panel").forEach(p => p.hidden = p.id !== "painel-" + nome);
    atualizar();
}
document.querySelectorAll(".staff-tabs [data-tab]").forEach(b => b.addEventListener("click", () => trocarAba(b.dataset.tab)));

// ---------- Números do topo ----------

function cardNumero(rotulo, valor, destaque) {
    const card = criar("div", undefined, "stat" + (destaque ? " stat-hot" : ""));
    card.append(criar("span", rotulo), criar("strong", String(valor)));
    return card;
}

async function renderStats() {
    const cards = [];
    if (podeVer("cozinha")) {
        const fila = await requisitar("/cozinha");
        document.getElementById("conta-cozinha").textContent = fila.length;
        if (painel.filaAnterior !== null && fila.length > painel.filaAnterior) notificar("🔔 Novo pedido na cozinha!");
        painel.filaAnterior = fila.length;
        cards.push(cardNumero("No forno", fila.length, fila.length > 0));
    }
    if (podeVer("garcom")) {
        const mesas = await requisitar("/mesas");
        const clientes = await requisitar("/pedidos-clientes");
        const prontos = clientes.filter(p => p.status === "pronto").length;
        document.getElementById("conta-clientes").textContent = clientes.length;
        cards.push(cardNumero("Mesas ocupadas", mesas.filter(m => m.status === "ocupada").length + " / " + mesas.length));
        cards.push(cardNumero("Prontos p/ entregar", prontos, prontos > 0));
    }
    if (podeVer("gerente")) {
        const caixa = await requisitar("/caixa");
        cards.push(cardNumero("Caixa de hoje", "R$ " + dinheiro(caixa.totalRecebido)));
    }
    document.getElementById("stats").replaceChildren(...cards);
}

// ---------- Ticket de pedido (cozinha e entregas) ----------

function criarTicket(pedido) {
    const ticket = criar("article", undefined, "ticket ticket-" + pedido.tipo);
    const topo = criar("div", undefined, "ticket-top");
    const status = criar("span", nomeEtapa(pedido), "status");
    status.dataset.status = pedido.status;
    topo.append(criar("strong", "#" + pedido.numero), criar("span", ondeEsta(pedido), "ticket-type"), status);
    const itens = criar("ul", undefined, "ticket-items");
    pedido.itens.forEach(item => {
        const li = criar("li");
        li.append(criar("b", item.quantidade + "x"), document.createTextNode(" " + item.produto));
        itens.appendChild(li);
    });
    ticket.append(topo, itens);
    if (pedido.observacao) ticket.appendChild(criar("p", "⚠ " + pedido.observacao, "ticket-obs"));
    return ticket;
}

// ---------- Cozinha ----------

async function renderCozinha() {
    const fila = await requisitar("/cozinha");
    const lista = document.getElementById("lista-cozinha");
    lista.replaceChildren();
    if (!fila.length) { lista.appendChild(criar("p", "Nenhuma pizza na fila. Forno livre! 🍕", "empty big")); return; }
    fila.forEach((pedido, i) => {
        const ticket = criarTicket(pedido);
        if (i === 0) ticket.classList.add("ticket-next");
        const pronto = botao("✓ Pronto", "btn btn-green btn-block");
        pronto.addEventListener("click", acaoSegura(async () => {
            const r = await requisitar("/pedidos/" + pedido.numero + "/preparar", {});
            if (r.erro) { notificar(r.erro); return; }
            notificar("Pedido #" + pedido.numero + " pronto!");
            await atualizar();
        }));
        ticket.appendChild(pronto);
        lista.appendChild(ticket);
    });
}

// ---------- Salão ----------

async function renderMesas() {
    const mesas = await requisitar("/mesas");
    const lista = document.getElementById("lista-mesas");
    lista.replaceChildren();
    mesas.forEach(mesa => {
        const card = botao("", "table-card " + mesa.status);
        if (mesa.numero === painel.mesaNumero) card.classList.add("selected");
        card.append(criar("strong", "Mesa " + mesa.numero), criar("span", mesa.status === "ocupada" ? "Ocupada · #" + mesa.pedidoAberto : "Livre · " + mesa.capacidade + " lugares"));
        card.addEventListener("click", acaoSegura(async () => {
            painel.mesaNumero = mesa.numero;
            if (mesa.status === "ocupada") {
                painel.mesaAberta = mesa.pedidoAberto;
            } else {
                const pedido = await requisitar("/mesas/" + mesa.numero + "/pedido", {});
                if (pedido.erro) { notificar(pedido.erro); return; }
                painel.mesaAberta = pedido.numero;
                notificar("Mesa " + mesa.numero + " aberta.");
            }
            await renderMesas();
            await renderPedidoMesa();
        }));
        lista.appendChild(card);
    });
}

async function renderPedidoMesa() {
    const lateral = document.getElementById("painel-mesa");
    if (!painel.mesaAberta) { lateral.replaceChildren(criar("p", "Escolha uma mesa ao lado.", "muted")); return; }
    const pedido = await requisitar("/pedidos/" + painel.mesaAberta);
    if (!painel.produtos.length) painel.produtos = await requisitar("/produtos");
    lateral.replaceChildren();

    const topo = criar("div", undefined, "table-panel-head");
    const status = criar("span", nomeEtapa(pedido), "status");
    status.dataset.status = pedido.status;
    topo.append(criar("h3", "Mesa " + pedido.mesa + " · #" + pedido.numero), status);
    lateral.appendChild(topo);

    // itens já lançados (antes de ir para a cozinha dá para pôr mais um, tirar um ou remover)
    const editavel = pedido.status === "recebido";
    const itens = criar("ul", undefined, "table-items");
    if (!pedido.itens.length) itens.appendChild(criar("li", "Nenhum item ainda. Toque nos produtos abaixo.", "muted"));
    pedido.itens.forEach((item, indice) => {
        const li = criar("li");
        const nome = criar("span", undefined, "table-item-name");
        nome.append(criar("b", item.quantidade + "x"), document.createTextNode(" " + item.produto));
        li.append(nome);
        if (editavel) {
            const mudar = (nova) => acaoSegura(async () => {
                const r = await requisitar("/pedidos/" + pedido.numero + "/itens/" + indice, { quantidade: nova });
                if (r.erro) { notificar(r.erro); return; }
                await renderPedidoMesa();
            });
            const stepper = criar("span", undefined, "stepper");
            const menos = botao("−", "");
            const mais = botao("+", "");
            const lixo = botao("🗑", "remove-item");
            menos.setAttribute("aria-label", "Tirar uma " + item.produto);
            mais.setAttribute("aria-label", "Pôr mais uma " + item.produto);
            lixo.setAttribute("aria-label", "Remover " + item.produto);
            menos.addEventListener("click", mudar(item.quantidade - 1));
            mais.addEventListener("click", mudar(item.quantidade + 1));
            lixo.addEventListener("click", mudar(0));
            stepper.append(menos, criar("b", String(item.quantidade)), mais);
            li.append(stepper, lixo);
        }
        li.append(criar("span", "R$ " + dinheiro(item.precoUnitario * item.quantidade), "table-item-price"));
        itens.appendChild(li);
    });
    lateral.append(itens, criar("p", "Total: R$ " + dinheiro(pedido.valorTotal), "table-total"));

    if (editavel) {
        // filtro por categoria + botões de produto (um toque = +1 item)
        lateral.appendChild(criar("p", "Adicionar (um toque = 1 unidade)", "label-small"));
        const filtros = criar("div", undefined, "mini-filters");
        const rotulos = { "Pizzas Tradicionais": "Tradicionais", "Pizzas Especiais": "Especiais", "Pizzas Doces": "Doces", "Refrigerantes": "Refri" };
        [...new Set(painel.produtos.map(p => p.categoria))].forEach(categoria => {
            const chip = botao(rotulos[categoria] || categoria, "chip chip-sm", () => { painel.categoriaMesa = categoria; renderPedidoMesa(); });
            chip.setAttribute("aria-pressed", String(categoria === painel.categoriaMesa));
            filtros.appendChild(chip);
        });
        lateral.appendChild(filtros);
        const grade = criar("div", undefined, "product-buttons");
        painel.produtos.filter(p => p.categoria === painel.categoriaMesa).forEach(produto => {
            const b = botao("", "product-button" + (produto.categoria === "Refrigerantes" ? " drink" : ""));
            b.append(criar("span", produto.nome), criar("small", "R$ " + dinheiro(produto.preco)));
            b.addEventListener("click", acaoSegura(async () => {
                const r = await requisitar("/pedidos/" + pedido.numero + "/itens", { produto: produto.nome, quantidade: 1 });
                if (r.erro) { notificar(r.erro); return; }
                await renderPedidoMesa();
            }));
            grade.appendChild(b);
        });
        lateral.appendChild(grade);
        const enviar = botao("Enviar para a cozinha →", "btn btn-red btn-block");
        enviar.disabled = !pedido.itens.length;
        enviar.addEventListener("click", acaoSegura(async () => {
            const r = await requisitar("/pedidos/" + pedido.numero + "/cozinha", {});
            if (r.erro) { notificar(r.erro); return; }
            notificar("Pedido da mesa " + pedido.mesa + " foi para a cozinha.");
            await atualizar();
        }));
        lateral.appendChild(enviar);
    } else if (pedido.status === "em_preparo") {
        lateral.appendChild(criar("p", "🔥 Na cozinha. Assim que ficar pronto, aparece aqui para receber.", "info-box"));
    } else if (pedido.status === "pronto") {
        lateral.appendChild(criarFechamento(pedido, "Receber R$ " + dinheiro(pedido.valorTotal) + " e liberar mesa", async () => {
            painel.mesaAberta = null;
            painel.mesaNumero = null;
        }));
    }
}

// Escolha da forma de pagamento + botão de receber (mesa, entrega e balcão)
function criarFechamento(pedido, textoBotao, depois) {
    const caixa = criar("div", undefined, "pay-box");
    caixa.appendChild(criar("p", "Pagamento na hora:", "label-small"));
    const opcoes = criar("div", undefined, "pay-options");
    let forma = pedido.formaPagamento || "dinheiro";
    Object.entries(NOMES_PAGAMENTO).forEach(([valor, rotulo]) => {
        const b = botao(rotulo, "chip");
        b.setAttribute("aria-pressed", String(valor === forma));
        b.addEventListener("click", () => {
            forma = valor;
            opcoes.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        });
        opcoes.appendChild(b);
    });
    const receber = botao(textoBotao, "btn btn-green btn-block");
    receber.addEventListener("click", acaoSegura(async () => {
        const r = await requisitar("/pedidos/" + pedido.numero + "/fechar", { formaPagamento: forma });
        if (r.erro) { notificar(r.erro); return; }
        notificar("Pedido #" + pedido.numero + " pago e finalizado!");
        if (depois) await depois();
        await atualizar();
    }));
    caixa.append(opcoes, receber);
    return caixa;
}

// ---------- Entregas e balcão ----------

async function renderPedidosClientes() {
    const pedidos = await requisitar("/pedidos-clientes");
    const lista = document.getElementById("lista-pedidos-clientes");
    lista.replaceChildren();
    if (!pedidos.length) { lista.appendChild(criar("p", "Nenhuma entrega ou retirada em andamento.", "empty big")); return; }
    pedidos.forEach(pedido => {
        const ticket = criarTicket(pedido);
        ticket.append(
            criar("p", "👤 " + pedido.cliente + " · " + pedido.telefone, "ticket-info"),
            criar("p", pedido.tipo === "entrega" ? "📍 " + pedido.endereco : "🏪 Retira no balcão", "ticket-info"),
            criar("p", textoPagamento(pedido) + " · Total R$ " + dinheiro(pedido.valorTotal), "ticket-info"),
        );
        if (pedido.status === "pronto") {
            ticket.appendChild(criarFechamento(pedido, pedido.tipo === "entrega" ? "Entregue e pago" : "Retirado e pago"));
        } else {
            ticket.appendChild(criar("p", "🔥 Ainda na cozinha", "info-box"));
        }
        lista.appendChild(ticket);
    });
}

// ---------- Estoque ----------

async function renderEstoque() {
    const estoques = await requisitar("/estoque");
    const lista = document.getElementById("lista-estoque");
    lista.replaceChildren();
    const maior = Math.max(...estoques.map(e => e.quantidade), 1);
    estoques.forEach(e => {
        const linha = criar("div", undefined, "stock-row" + (e.baixo ? " low" : ""));
        const barra = criar("div", undefined, "stock-bar");
        const cheio = criar("span");
        cheio.style.setProperty("--nivel", e.quantidade / maior);
        barra.appendChild(cheio);
        linha.append(criar("span", e.produto, "stock-name"), criar("b", e.quantidade + (e.baixo ? " · baixo" : "")), barra);
        lista.appendChild(linha);
    });
}

// ---------- Caixa ----------

async function renderCaixa() {
    const caixa = await requisitar("/caixa");
    document.getElementById("caixa-total").textContent = dinheiro(caixa.totalRecebido);
}

document.getElementById("botao-fechar-caixa").addEventListener("click", acaoSegura(async () => {
    const r = await requisitar("/caixa/fechar", {});
    if (r.erro) { notificar(r.erro); return; }
    notificar("Caixa fechado. Total do período: R$ " + dinheiro(r.total));
    await atualizar();
}));

// ---------- Atualização ----------

async function atualizar() {
    if (!EH_EQUIPE(sessao.usuario)) return;
    await renderStats();
    if (painel.aba === "cozinha") await renderCozinha();
    if (painel.aba === "salao") { await renderMesas(); await renderPedidoMesa(); }
    if (painel.aba === "clientes") await renderPedidosClientes();
    if (painel.aba === "estoque") await renderEstoque();
    if (painel.aba === "caixa") await renderCaixa();
    document.getElementById("ultima-atualizacao").textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR");
}

document.getElementById("atualizar-agora").addEventListener("click", acaoSegura(atualizar));

async function mostrarTela() {
    const usuario = sessao.usuario;
    const ehEquipe = EH_EQUIPE(usuario);
    document.getElementById("tela-login").hidden = ehEquipe;
    document.getElementById("tela-painel").hidden = !ehEquipe;
    document.getElementById("botao-sair").hidden = !ehEquipe;
    const chip = document.getElementById("usuario-chip");
    chip.hidden = !ehEquipe;
    if (!ehEquipe) { document.getElementById("equipe-usuario").focus(); return; }

    chip.textContent = usuario.nome + " · " + usuario.perfil;
    document.getElementById("data-hoje").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    // mostra só as abas que o perfil pode ver e abre a primeira
    const abas = [...document.querySelectorAll(".staff-tabs [data-tab]")];
    abas.forEach(b => b.hidden = !podeVer(b.dataset.perfis));
    const primeira = abas.find(b => !b.hidden);
    trocarAba(painel.aba && podeVer(abas.find(b => b.dataset.tab === painel.aba).dataset.perfis) ? painel.aba : primeira.dataset.tab);
}

aoPerderSessao = mostrarTela;

// Atualiza sozinho a cada 8 segundos (se a aba do navegador estiver visível)
setInterval(async () => {
    if (!EH_EQUIPE(sessao.usuario) || document.hidden) return;
    try { await atualizar(); } catch (erro) { /* sem conexão agora; tenta de novo */ }
}, INTERVALO_AO_VIVO);

(async function iniciar() {
    try { await carregarSessao(); } catch (erro) { notificar("Servidor fora do ar. Rode python app.py."); }
    await mostrarTela();
})();
