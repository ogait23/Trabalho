// =====================================================================
//  Fornatta — lógica da página (JavaScript puro)
//  Seções: 1) ajudantes  2) acesso  3) cardápio  4) carrinho e pedido
//          5) meus pedidos + rastreador ao vivo  6) garçom  7) cozinha/gerente
//          8) tela e atualização automática
// =====================================================================

const BASE = "/api";
const INTERVALO_AO_VIVO = 10000; // de quanto em quanto tempo (ms) a página pergunta o status

const estado = {
    usuario: null,
    csrf: "",
    carrinho: [],          // [{ produto, quantidade }]
    produtos: [],
    categoria: "",
    busca: "",
    pedidoAtual: null,     // pedido de mesa aberto na tela do garçom
    produtoPendente: null, // produto clicado antes de fazer login
    statusConhecidos: {},  // { numeroPedido: status } para saber quando o status mudou
};

// Ordem das etapas de qualquer pedido
const ETAPAS = ["recebido", "em_preparo", "pronto", "entregue"];

// Como cada etapa aparece para o cliente, dependendo do tipo do pedido
const NOMES_ETAPAS = {
    entrega:  ["Recebido", "No forno", "Saiu para entrega", "Entregue"],
    retirada: ["Recebido", "No forno", "Pronto no balcão", "Retirado"],
    salao:    ["Recebido", "No forno", "Pronto", "Finalizado"],
};

const NOMES_PAGAMENTO = { dinheiro: "Dinheiro", cartao_debito: "Cartão de débito", cartao_credito: "Cartão de crédito" };

// ---------- 1) Ajudantes ----------

// Faz a chamada para a API. GET quando não tem corpo, POST quando tem.
async function requisitar(caminho, corpo) {
    const opcoes = { headers: { "X-CSRF-Token": estado.csrf } };
    if (corpo !== undefined) {
        opcoes.method = "POST";
        opcoes.headers["Content-Type"] = "application/json";
        opcoes.body = JSON.stringify(corpo);
    }
    try {
        const resposta = await fetch(BASE + caminho, { ...opcoes, signal: AbortSignal.timeout(15000) });
        const json = await resposta.json();
        if (resposta.status === 401 && estado.usuario) {
            // A sessão expirou no servidor: volta para o modo visitante
            estado.usuario = null;
            estado.carrinho = [];
            await carregarSessao();
            await atualizarTela();
            notificar("Sua sessão expirou. Entre novamente para continuar.");
        }
        if (!resposta.ok && corpo === undefined) throw new Error(json.erro || "Não foi possível carregar os dados.");
        return json;
    } catch (erro) {
        const mensagem = "Não foi possível conectar à pizzaria. Tente novamente.";
        if (corpo !== undefined) return { erro: mensagem };
        throw new Error(mensagem, { cause: erro });
    }
}

// Trava o botão enquanto a ação roda, para não enviar duas vezes.
function acaoSegura(acao) {
    return async (evento) => {
        evento.preventDefault();
        const alvo = evento.currentTarget;
        if (alvo.dataset.ocupado) return;
        alvo.dataset.ocupado = "true";
        const botoes = alvo.matches("button") ? [alvo] : [...alvo.querySelectorAll('button[type="submit"]')];
        botoes.forEach(botao => botao.disabled = true);
        try { await acao(evento); }
        catch (erro) { notificar(erro.message || "Não foi possível concluir. Tente novamente."); }
        finally {
            delete alvo.dataset.ocupado;
            botoes.forEach(botao => botao.disabled = false);
            if (alvo.id === "form-pedido") renderCarrinho();
        }
    };
}

function criar(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto !== undefined) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
}

function botao(texto, classe, aoClicar) {
    const elemento = criar("button", texto, classe);
    elemento.type = "button";
    if (aoClicar) elemento.addEventListener("click", aoClicar);
    return elemento;
}

function dinheiro(valor) {
    return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nomeEtapa(pedido) {
    if (pedido.status === "cancelado") return "Cancelado";
    return NOMES_ETAPAS[pedido.tipo][ETAPAS.indexOf(pedido.status)];
}

function ondeEsta(pedido) {
    if (pedido.tipo === "entrega") return "Entrega";
    if (pedido.tipo === "retirada") return "Retirada no balcão";
    return "Mesa " + pedido.mesa;
}

// Reinicia uma animação CSS (ex.: o contador do carrinho "pulando")
function animar(elemento, classe) {
    elemento.classList.remove(classe);
    void elemento.offsetWidth;
    elemento.classList.add(classe);
}

// ---------- 2) Acesso ----------

async function carregarSessao() {
    const sessao = await requisitar("/sessao");
    estado.csrf = sessao.csrf;
    estado.usuario = sessao.usuario;
}

document.getElementById("form-login").addEventListener("submit", acaoSegura(async () => {
    const resposta = await requisitar("/login", {
        login: document.getElementById("login-usuario").value,
        senha: document.getElementById("login-senha").value,
    });
    if (resposta.erro) { notificar(resposta.erro); return; }

    estado.csrf = resposta.csrf;
    estado.usuario = resposta.usuario;
    document.getElementById("form-login").reset();
    document.getElementById("acesso-dialog").close();
    await atualizarTela();
    if (estado.usuario.perfil === "cliente" && estado.produtoPendente) adicionarAoCarrinho(estado.produtoPendente);
    estado.produtoPendente = null;
    if (estado.usuario.perfil !== "cliente") document.getElementById("area-operacional").scrollIntoView();
}));

document.getElementById("form-cadastro").addEventListener("submit", acaoSegura(async () => {
    const resposta = await requisitar("/cadastro", {
        nome: document.getElementById("cadastro-nome").value,
        telefone: document.getElementById("cadastro-telefone").value,
        senha: document.getElementById("cadastro-senha").value,
    });
    if (resposta.erro) { notificar(resposta.erro); return; }

    document.getElementById("login-usuario").value = document.getElementById("cadastro-telefone").value.replace(/\D/g, "");
    document.getElementById("form-cadastro").reset();
    document.querySelector("#secao-acesso details").open = false;
    document.getElementById("login-senha").focus();
    notificar("Conta criada. Entre com o seu telefone e a senha.");
}));

document.getElementById("botao-sair").addEventListener("click", acaoSegura(async () => {
    const resposta = await requisitar("/sair", {});
    if (resposta.erro) { notificar(resposta.erro); return; }
    estado.carrinho = [];
    estado.pedidoAtual = null;
    estado.statusConhecidos = {};
    await carregarSessao();
    await atualizarTela();
}));

// ---------- 3) Cardápio ----------

const rotulosCategorias = { "Pizzas Tradicionais": "Tradicionais", "Pizzas Especiais": "Especiais", "Pizzas Doces": "Doces", "Bebidas": "Bebidas", "Porções": "Para acompanhar", "Sobremesas": "Sobremesas" };
const FOTOS = ["assets/pizza-forno.jpg", "assets/pizza-hero.jpg", "assets/pizza-margherita.jpg"];

// Tira acentos e deixa minúsculo, para a busca achar "calabresa" digitando "CALABRESA"
function normalizar(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function produtosVisiveis() {
    if (estado.busca) {
        const termo = normalizar(estado.busca);
        return estado.produtos.filter(p => normalizar(p.nome + " " + p.descricao).includes(termo));
    }
    return estado.produtos.filter(p => p.categoria === estado.categoria);
}

async function renderCardapio() {
    const container = document.getElementById("lista-cardapio");
    container.setAttribute("aria-busy", "true");
    try {
        if (!estado.produtos.length) estado.produtos = await requisitar("/produtos");
        const categorias = [...new Set(estado.produtos.map(p => p.categoria))];
        if (!categorias.includes(estado.categoria)) estado.categoria = categorias[0];

        // Botões de categoria (criados uma vez só)
        const filtros = document.getElementById("filtros-cardapio");
        if (!filtros.children.length) {
            categorias.forEach(categoria => {
                const filtro = botao(rotulosCategorias[categoria] || categoria, "filter-button", () => {
                    estado.categoria = categoria;
                    estado.busca = "";
                    document.getElementById("busca-cardapio").value = "";
                    renderCardapio();
                });
                filtro.dataset.categoria = categoria;
                filtros.appendChild(filtro);
            });
        }
        filtros.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(!estado.busca && b.dataset.categoria === estado.categoria)));

        container.replaceChildren();
        const lista = produtosVisiveis();
        if (!lista.length) container.appendChild(criar("p", "Nenhum sabor encontrado. Que tal tentar outro ingrediente?", "menu-loading"));
        lista.forEach((produto, indice) => container.appendChild(criarCardProduto(produto, indice)));
    } catch (erro) {
        container.replaceChildren();
        const aviso = criar("div", "O cardápio está indisponível no momento.", "menu-error");
        aviso.appendChild(botao("Tentar novamente", "button primary", renderCardapio));
        container.appendChild(aviso);
    } finally { container.setAttribute("aria-busy", "false"); }
}

function criarCardProduto(produto, indice) {
    const temFoto = produto.categoria.startsWith("Pizzas") && produto.categoria !== "Pizzas Doces";
    const card = criar("article", undefined, "menu-card" + (temFoto ? "" : " no-photo"));
    card.style.setProperty("--i", indice); // usado no CSS para os cards entrarem um depois do outro

    if (temFoto) {
        const foto = criar("div", undefined, "menu-card-photo");
        const img = criar("img");
        img.src = FOTOS[indice % FOTOS.length];
        img.alt = "Pizza em apresentação ilustrativa";
        img.loading = "lazy";
        img.width = 600; img.height = 400;
        foto.append(img, criar("span", "35 cm · 8 fatias", "product-tag"));
        card.appendChild(foto);
    }

    const corpo = criar("div", undefined, "menu-card-body");
    corpo.append(criar("h3", produto.nome), criar("p", produto.descricao));
    const rodape = criar("div", undefined, "menu-card-bottom");
    const preco = criar("span", undefined, "preco");
    preco.append(criar("small", "R$"), document.createTextNode(dinheiro(produto.preco)));

    const adicionar = botao("+", "add-product", (evento) => {
        if (!estado.usuario) {
            estado.produtoPendente = produto;
            abrirDialogo("acesso-dialog");
            notificar("Entre ou crie uma conta para adicionar " + produto.nome + ".");
        } else if (estado.usuario.perfil === "cliente") {
            adicionarAoCarrinho(produto);
            animar(evento.currentTarget, "added");
        } else {
            notificar("Use a área da equipe para lançar os pedidos das mesas.");
            document.getElementById("area-operacional").scrollIntoView({ behavior: "smooth" });
        }
    });
    adicionar.setAttribute("aria-label", "Adicionar " + produto.nome + " ao pedido");

    rodape.append(preco, adicionar);
    corpo.appendChild(rodape);
    card.appendChild(corpo);
    return card;
}

document.getElementById("busca-cardapio").addEventListener("input", (evento) => {
    estado.busca = evento.target.value.trim();
    renderCardapio();
});

// ---------- 4) Carrinho e novo pedido ----------

function adicionarAoCarrinho(produto) {
    const item = estado.carrinho.find(i => i.produto.nome === produto.nome);
    if (item) mudarQuantidade(item, +1);
    else estado.carrinho.push({ produto, quantidade: 1 });
    renderCarrinho();
    animar(document.getElementById("cart-count"), "bump");
    notificar(produto.nome + " entrou no seu pedido.");
}

function mudarQuantidade(item, variacao) {
    const nova = item.quantidade + variacao;
    if (nova > 20) { notificar("Você pode adicionar até 20 unidades de cada item."); return; }
    if (nova < 1) estado.carrinho.splice(estado.carrinho.indexOf(item), 1);
    else item.quantidade = nova;
    renderCarrinho();
}

function renderCarrinho() {
    const lista = document.getElementById("lista-carrinho");
    lista.replaceChildren();
    document.getElementById("cart-count").textContent = estado.carrinho.reduce((soma, item) => soma + item.quantidade, 0);
    document.querySelector('#form-pedido button[type="submit"]').disabled = estado.carrinho.length === 0;

    if (!estado.carrinho.length) {
        lista.appendChild(criar("li", "Seu pedido está esperando a primeira fatia. Escolha no cardápio!", "aviso"));
    }
    let total = 0;
    estado.carrinho.forEach(item => {
        const subtotal = item.produto.preco * item.quantidade;
        total += subtotal;
        const linha = criar("li");
        const nome = criar("span", item.produto.nome, "cart-name");
        const contador = criar("span", undefined, "stepper");
        contador.append(
            botao("−", "", () => mudarQuantidade(item, -1)),
            criar("b", String(item.quantidade)),
            botao("+", "", () => mudarQuantidade(item, +1)),
        );
        contador.firstChild.setAttribute("aria-label", "Diminuir " + item.produto.nome);
        contador.lastChild.setAttribute("aria-label", "Aumentar " + item.produto.nome);
        linha.append(nome, contador, criar("span", "R$ " + dinheiro(subtotal), "cart-price"));
        lista.appendChild(linha);
    });
    document.getElementById("carrinho-total").textContent = dinheiro(total);
}

// Mostra/esconde campos conforme as escolhas (entrega x retirada, dinheiro x cartão)
function atualizarFormularioPedido() {
    const form = document.getElementById("form-pedido");
    const ehEntrega = form.tipo.value === "entrega";
    document.getElementById("campo-endereco").hidden = !ehEntrega;
    document.getElementById("entrega-endereco").required = ehEntrega;
    document.getElementById("campo-troco").hidden = form.pagamento.value !== "dinheiro";
    document.getElementById("onde-paga").textContent = ehEntrega
        ? "Na entrega, direto ao entregador."
        : "No balcão, na hora de retirar.";
}
document.getElementById("form-pedido").addEventListener("change", atualizarFormularioPedido);

document.getElementById("form-pedido").addEventListener("submit", acaoSegura(async () => {
    const form = document.getElementById("form-pedido");
    if (!estado.carrinho.length) { notificar("Adicione itens do cardápio ao pedido."); return; }

    const resposta = await requisitar("/meus-pedidos", {
        tipo: form.tipo.value,
        endereco: document.getElementById("entrega-endereco").value,
        formaPagamento: form.pagamento.value,
        trocoPara: document.getElementById("troco").value,
        observacao: document.getElementById("observacao").value,
        itens: estado.carrinho.map(item => ({ produto: item.produto.nome, quantidade: item.quantidade })),
    });
    if (resposta.erro) { notificar(resposta.erro); return; }

    estado.carrinho = [];
    document.getElementById("troco").value = "";
    document.getElementById("observacao").value = "";
    renderCarrinho();
    await renderMeusPedidos();
    const onde = resposta.tipo === "entrega" ? "na entrega" : "no balcão";
    notificar("Pedido " + resposta.numero + " recebido! É só pagar " + onde + ".");
}));

// ---------- 5) Meus pedidos + rastreador ao vivo (upgrade) ----------

// Linha do tempo: ● Recebido — ● No forno — ○ Saiu para entrega — ○ Entregue
function criarLinhaDoTempo(pedido) {
    const lista = criar("ol", undefined, "timeline");
    const atual = ETAPAS.indexOf(pedido.status);
    NOMES_ETAPAS[pedido.tipo].forEach((nome, indice) => {
        const etapa = criar("li", nome);
        if (indice < atual) etapa.className = "feito";
        if (indice === atual) etapa.className = "agora";
        lista.appendChild(etapa);
    });
    return lista;
}

function textoPagamento(pedido) {
    let texto = (pedido.tipo === "entrega" ? "Paga na entrega: " : "Paga no balcão: ") + (NOMES_PAGAMENTO[pedido.formaPagamento] || "-");
    if (pedido.trocoPara) texto += " (troco para R$ " + dinheiro(pedido.trocoPara) + ")";
    return texto;
}

async function renderMeusPedidos() {
    const pedidos = await requisitar("/meus-pedidos");
    const container = document.getElementById("lista-meus-pedidos");
    container.replaceChildren();
    if (!pedidos.length) container.appendChild(criar("p", "Você ainda não fez nenhum pedido.", "aviso"));

    pedidos.forEach(pedido => {
        const card = criar("article", undefined, "order-card");
        const topo = criar("div", undefined, "order-top");
        topo.append(criar("strong", "Pedido " + pedido.numero + " · " + ondeEsta(pedido)), criar("span", "R$ " + dinheiro(pedido.valorTotal)));
        card.append(topo, criarLinhaDoTempo(pedido), criar("small", textoPagamento(pedido)));
        container.appendChild(card);
    });

    avisarMudancas(pedidos);
    renderRastreador(pedidos);
}

// Compara o status novo com o que já sabíamos. Se mudou, avisa o cliente.
function avisarMudancas(pedidos) {
    pedidos.forEach(pedido => {
        const antes = estado.statusConhecidos[pedido.numero];
        if (antes && antes !== pedido.status) {
            notificar("Pedido " + pedido.numero + ": " + nomeEtapa(pedido) + "!");
        }
        estado.statusConhecidos[pedido.numero] = pedido.status;
    });
}

// Barrinha flutuante com o pedido mais recente que ainda não terminou
function renderRastreador(pedidos) {
    const rastreador = document.getElementById("rastreador");
    const ativo = pedidos.find(p => p.status !== "entregue" && p.status !== "cancelado");
    rastreador.hidden = !ativo;
    document.body.classList.toggle("tem-rastreador", Boolean(ativo));
    if (!ativo) return;

    const passo = ETAPAS.indexOf(ativo.status) + 1;
    document.getElementById("rastreador-titulo").textContent = "Pedido " + ativo.numero;
    document.getElementById("rastreador-status").textContent = nomeEtapa(ativo);
    document.getElementById("rastreador-progresso").style.setProperty("--progresso", passo / ETAPAS.length);
    rastreador.setAttribute("aria-label", "Pedido " + ativo.numero + ": " + nomeEtapa(ativo) + ". Abrir meu pedido");
}

// ---------- 6) Garçom ----------

async function renderMesas() {
    const mesas = await requisitar("/mesas");
    const container = document.getElementById("lista-mesas");
    container.replaceChildren();

    mesas.forEach(mesa => {
        const cartao = criar("div", undefined, "cartao-mesa " + mesa.status);
        cartao.append(
            criar("strong", "Mesa " + mesa.numero),
            criar("span", mesa.capacidade + " lugares · " + mesa.status, "chip"),
        );
        const acao = botao(mesa.status === "ocupada" ? "Ver pedido" : "Abrir pedido", "");
        acao.addEventListener("click", acaoSegura(async () => {
            if (mesa.status === "ocupada") { abrirPedidoNaTela(mesa.pedidoAberto); return; }
            const pedido = await requisitar("/mesas/" + mesa.numero + "/pedido", {});
            if (pedido.erro) { notificar(pedido.erro); return; }
            await renderMesas();
            abrirPedidoNaTela(pedido.numero);
        }));
        cartao.appendChild(acao);
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

    document.getElementById("pedido-numero").textContent = pedido.numero;
    document.getElementById("pedido-mesa").textContent = pedido.mesa;
    const status = document.getElementById("pedido-status");
    status.textContent = nomeEtapa(pedido);
    status.dataset.status = pedido.status;
    document.getElementById("pedido-total").textContent = dinheiro(pedido.valorTotal);

    const lista = document.getElementById("lista-itens");
    lista.replaceChildren();
    pedido.itens.forEach(item => {
        lista.appendChild(criar("li", item.quantidade + "x " + item.produto + " — R$ " + dinheiro(item.precoUnitario * item.quantidade)));
    });

    const finalizado = pedido.status === "entregue" || pedido.status === "cancelado";
    document.getElementById("form-item").hidden = finalizado;
    document.getElementById("botao-enviar-cozinha").hidden = finalizado || pedido.status !== "recebido";
    document.getElementById("form-fechar-conta").hidden = finalizado || pedido.status !== "pronto";
}

async function popularSelectProdutos() {
    const select = document.getElementById("select-produto");
    if (select.options.length) return;
    const produtos = await requisitar("/produtos");
    produtos.forEach(produto => {
        const opcao = criar("option", produto.nome + " — R$ " + dinheiro(produto.preco));
        opcao.value = produto.nome;
        select.appendChild(opcao);
    });
}

// Ticket de um pedido (usado pelo garçom e pela cozinha)
function criarTicket(pedido) {
    const ticket = criar("article", undefined, "ticket " + pedido.tipo);
    const topo = criar("div", undefined, "ticket-top");
    const status = criar("span", nomeEtapa(pedido), "chip");
    status.dataset.status = pedido.status;
    topo.append(criar("strong", "#" + pedido.numero + " · " + ondeEsta(pedido)), status);
    ticket.appendChild(topo);

    const itens = criar("ul", undefined, "ticket-items");
    pedido.itens.forEach(item => itens.appendChild(criar("li", item.quantidade + "x " + item.produto)));
    ticket.appendChild(itens);
    if (pedido.observacao) ticket.appendChild(criar("p", "Obs.: " + pedido.observacao, "ticket-obs"));
    return ticket;
}

async function renderPedidosClientes() {
    const pedidos = await requisitar("/pedidos-clientes");
    const container = document.getElementById("lista-pedidos-clientes");
    container.replaceChildren();
    if (!pedidos.length) { container.appendChild(criar("p", "Nenhuma entrega ou retirada em andamento.", "aviso")); return; }

    pedidos.forEach(pedido => {
        const ticket = criarTicket(pedido);
        const quem = pedido.cliente + " · " + pedido.telefone + (pedido.endereco ? " · " + pedido.endereco : "");
        ticket.append(criar("p", quem, "ticket-info"), criar("p", textoPagamento(pedido) + " · Total R$ " + dinheiro(pedido.valorTotal), "ticket-info"));

        if (pedido.status === "pronto") {
            const form = criar("form");
            const select = criar("select");
            select.setAttribute("aria-label", "Forma de pagamento recebida");
            Object.entries(NOMES_PAGAMENTO).forEach(([valor, rotulo]) => {
                const opcao = criar("option", rotulo);
                opcao.value = valor;
                opcao.selected = valor === pedido.formaPagamento;
                select.appendChild(opcao);
            });
            const confirmar = criar("button", pedido.tipo === "entrega" ? "Entregue e pago" : "Retirado e pago");
            confirmar.type = "submit";
            form.append(select, confirmar);
            form.addEventListener("submit", acaoSegura(async () => {
                const resposta = await requisitar("/pedidos/" + pedido.numero + "/fechar", { formaPagamento: select.value });
                if (resposta.erro) { notificar(resposta.erro); return; }
                await renderPedidosClientes();
                if (estado.usuario?.perfil === "gerente") await renderCaixa();
            }));
            ticket.appendChild(form);
        }
        container.appendChild(ticket);
    });
}

document.getElementById("form-item").addEventListener("submit", acaoSegura(async () => {
    const resultado = await requisitar("/pedidos/" + estado.pedidoAtual + "/itens", {
        produto: document.getElementById("select-produto").value,
        quantidade: parseInt(document.getElementById("input-quantidade").value, 10),
    });
    if (resultado.erro) { notificar(resultado.erro); return; }
    await renderPedido();
}));

document.getElementById("botao-enviar-cozinha").addEventListener("click", acaoSegura(async () => {
    const resultado = await requisitar("/pedidos/" + estado.pedidoAtual + "/cozinha", {});
    if (resultado.erro) { notificar(resultado.erro); return; }
    await renderPedido();
}));

document.getElementById("form-fechar-conta").addEventListener("submit", acaoSegura(async () => {
    const resultado = await requisitar("/pedidos/" + estado.pedidoAtual + "/fechar", {
        formaPagamento: document.getElementById("select-pagamento").value,
    });
    if (resultado.erro) { notificar(resultado.erro); return; }
    await renderPedido();
    await renderMesas();
    if (estado.usuario?.perfil === "gerente") await renderCaixa();
}));

// ---------- 7) Cozinha e gerente ----------

async function renderCozinha() {
    const pendentes = await requisitar("/cozinha");
    const container = document.getElementById("lista-cozinha");
    container.replaceChildren();
    if (!pendentes.length) container.appendChild(criar("p", "Nenhum pedido na fila. Hora de um café!", "aviso"));

    pendentes.forEach(pedido => {
        const ticket = criarTicket(pedido);
        const pronto = botao("Marcar como pronto", "");
        pronto.addEventListener("click", acaoSegura(async () => {
            const resposta = await requisitar("/pedidos/" + pedido.numero + "/preparar", {});
            if (resposta.erro) { notificar(resposta.erro); return; }
            await renderCozinha();
        }));
        ticket.appendChild(pronto);
        container.appendChild(ticket);
    });
}

async function renderEstoque() {
    const estoques = await requisitar("/estoque");
    const container = document.getElementById("lista-estoque");
    container.replaceChildren();
    estoques.forEach(estoque => {
        const linha = criar("div", undefined, "produto" + (estoque.baixo ? " baixo" : ""));
        linha.append(criar("span", estoque.produto), criar("b", estoque.quantidade + (estoque.baixo ? " · baixo" : "")));
        container.appendChild(linha);
    });
}

async function renderCaixa() {
    const caixa = await requisitar("/caixa");
    document.getElementById("caixa-total").textContent = dinheiro(caixa.totalRecebido);
}

document.getElementById("botao-fechar-caixa").addEventListener("click", acaoSegura(async () => {
    const resultado = await requisitar("/caixa/fechar", {});
    if (resultado.erro) { notificar(resultado.erro); return; }
    notificar("Caixa fechado. Total recebido: R$ " + dinheiro(resultado.total));
    await renderCaixa();
}));

// ---------- 8) Tela e atualização automática ----------

// Recarrega só os painéis da equipe (sem mexer no cardápio)
async function atualizarOperacao() {
    const perfil = estado.usuario?.perfil;
    if (perfil === "garcom" || perfil === "gerente") {
        await popularSelectProdutos();
        await renderMesas();
        await renderPedidosClientes();
        await renderPedido();
    }
    if (perfil === "cozinha" || perfil === "gerente") {
        await renderCozinha();
        await renderEstoque();
    }
    if (perfil === "gerente") await renderCaixa();
    document.getElementById("ultima-atualizacao").textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function atualizarTela() {
    const usuario = estado.usuario;
    const perfil = usuario ? usuario.perfil : null;

    document.getElementById("barra-usuario").hidden = !usuario;
    document.querySelectorAll(".login-trigger").forEach(b => b.hidden = Boolean(usuario));
    document.getElementById("area-operacional").hidden = !perfil || perfil === "cliente";
    document.getElementById("cart-guest").hidden = perfil === "cliente";
    document.querySelector(".cart-trigger").hidden = Boolean(perfil && perfil !== "cliente");
    document.getElementById("rastreador").hidden = true;
    document.body.classList.remove("tem-rastreador");
    if (usuario) document.getElementById("usuario-nome").textContent = usuario.nome + " (" + usuario.perfil + ")";

    // Cada <section data-perfis="..."> só aparece para os perfis listados (gerente vê tudo da equipe)
    document.querySelectorAll("[data-perfis]").forEach(secao => {
        const permitidos = secao.dataset.perfis.split(" ");
        const visivel = perfil !== null && (permitidos.includes(perfil) || (perfil === "gerente" && !permitidos.includes("cliente")));
        secao.hidden = !visivel || (secao.id === "secao-pedido" && estado.pedidoAtual === null);
    });

    renderCarrinho();
    atualizarFormularioPedido();
    await renderCardapio();
    if (perfil === "cliente") await renderMeusPedidos();
    else if (perfil) await atualizarOperacao();
}

// A cada 10 segundos pergunta ao servidor se algo mudou.
// Não atualiza se a aba está escondida ou se a equipe está preenchendo um campo.
setInterval(async () => {
    const perfil = estado.usuario?.perfil;
    if (!perfil || document.hidden) return;
    const digitando = document.activeElement?.closest("#area-operacional form");
    try {
        if (perfil === "cliente") await renderMeusPedidos();
        else if (!digitando) await atualizarOperacao();
    } catch (erro) { /* sem conexão agora; tenta de novo na próxima volta */ }
}, INTERVALO_AO_VIVO);

document.getElementById("atualizar-operacao").addEventListener("click", acaoSegura(atualizarOperacao));

async function iniciar() {
    try {
        await carregarSessao();
        await atualizarTela();
    } catch (erro) {
        await renderCardapio();
        notificar("Os pedidos estão indisponíveis no momento. Tente novamente em instantes.");
    }
}

iniciar();
