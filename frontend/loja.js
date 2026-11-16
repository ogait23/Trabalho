// =====================================================================
//  loja.js — página do cliente (index.html)
//  1) cardápio  2) sacola  3) entrar/criar conta  4) meus pedidos ao vivo
// =====================================================================

const loja = {
    produtos: [],
    categoria: "",
    busca: "",
    carrinho: [],          // [{ produto, quantidade }] — dá para montar antes de entrar
    statusConhecidos: {},  // { numeroPedido: status } para avisar quando muda
};

const ROTULOS = { "Pizzas Tradicionais": "Tradicionais", "Pizzas Especiais": "Especiais", "Pizzas Doces": "Doces", "Refrigerantes": "Refri" };
const FOTOS = ["assets/pizza-forno.jpg", "assets/pizza-margherita.jpg", "assets/pizza-hero.jpg"];

// ---------- 1) Cardápio ----------

function normalizar(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function produtosVisiveis() {
    if (loja.busca) {
        const termo = normalizar(loja.busca);
        return loja.produtos.filter(p => normalizar(p.nome + " " + p.descricao).includes(termo));
    }
    return loja.produtos.filter(p => p.categoria === loja.categoria);
}

async function renderCardapio() {
    const lista = document.getElementById("lista-cardapio");
    try {
        if (!loja.produtos.length) loja.produtos = await requisitar("/produtos");
    } catch (erro) {
        lista.replaceChildren(criar("p", "O cardápio está indisponível agora. Tente recarregar a página.", "state"));
        return;
    }
    const categorias = [...new Set(loja.produtos.map(p => p.categoria))];
    if (!loja.categoria) loja.categoria = categorias[0];

    const filtros = document.getElementById("filtros-cardapio");
    if (!filtros.children.length) {
        categorias.forEach(categoria => {
            const filtro = botao(ROTULOS[categoria] || categoria, "chip", () => {
                loja.categoria = categoria;
                loja.busca = "";
                document.getElementById("busca-cardapio").value = "";
                renderCardapio();
            });
            filtro.dataset.categoria = categoria;
            filtros.appendChild(filtro);
        });
    }
    filtros.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(!loja.busca && b.dataset.categoria === loja.categoria)));

    lista.replaceChildren();
    const visiveis = produtosVisiveis();
    if (!visiveis.length) lista.appendChild(criar("p", "Nenhum sabor encontrado.", "state"));
    visiveis.forEach((produto, i) => lista.appendChild(criarCard(produto, i)));
}

function criarCard(produto, indice) {
    const ehRefri = produto.categoria === "Refrigerantes";
    const card = criar("article", undefined, "product-card");
    card.style.setProperty("--i", indice); // os cards entram um depois do outro (CSS)

    const foto = criar("div", undefined, "product-photo" + (ehRefri ? " is-drink" : ""));
    const img = criar("img");
    img.src = ehRefri ? "assets/refri.svg" : FOTOS[indice % FOTOS.length];
    img.alt = ehRefri ? "Refrigerante gelado" : "Pizza " + produto.nome;
    img.loading = "lazy";
    foto.append(img, criar("span", ehRefri ? "Gelado" : "35 cm · 8 fatias", "product-tag"));

    const corpo = criar("div", undefined, "product-body");
    const rodape = criar("div", undefined, "product-foot");
    const adicionar = botao("+ Adicionar", "btn btn-red btn-sm", (e) => clicarAdicionar(produto, e.currentTarget));
    adicionar.setAttribute("aria-label", "Adicionar " + produto.nome + " à sacola");
    rodape.append(criar("span", "R$ " + dinheiro(produto.preco), "price"), adicionar);
    corpo.append(criar("h3", produto.nome), criar("p", produto.descricao), rodape);

    card.append(foto, corpo);
    return card;
}

function clicarAdicionar(produto, alvo) {
    if (EH_EQUIPE(sessao.usuario)) {
        notificar("Você está como equipe. Use o Painel da equipe para lançar pedidos.");
        return;
    }
    adicionarNaSacola(produto);
    animar(alvo, "pop");
}

document.getElementById("busca-cardapio").addEventListener("input", (e) => {
    loja.busca = e.target.value.trim();
    renderCardapio();
});

// ---------- 2) Sacola ----------

function adicionarNaSacola(produto) {
    const item = loja.carrinho.find(i => i.produto.nome === produto.nome);
    if (item) mudarQuantidade(item, +1);
    else loja.carrinho.push({ produto, quantidade: 1 });
    renderSacola();
    document.querySelectorAll("[data-cart-count]").forEach(c => animar(c, "bump"));
    notificar(produto.nome + " foi pra sacola!");
}

function mudarQuantidade(item, variacao) {
    const nova = item.quantidade + variacao;
    if (nova > 20) { notificar("Máximo de 20 unidades por item."); return; }
    if (nova < 1) loja.carrinho.splice(loja.carrinho.indexOf(item), 1);
    else item.quantidade = nova;
    renderSacola();
}

function renderSacola() {
    const lista = document.getElementById("lista-carrinho");
    lista.replaceChildren();
    const quantidade = loja.carrinho.reduce((soma, i) => soma + i.quantidade, 0);
    document.querySelectorAll("[data-cart-count]").forEach(c => c.textContent = quantidade);

    if (!loja.carrinho.length) lista.appendChild(criar("li", "Sua sacola está vazia. Escolha uma pizza no cardápio!", "empty"));
    let total = 0;
    loja.carrinho.forEach(item => {
        const subtotal = item.produto.preco * item.quantidade;
        total += subtotal;
        const stepper = criar("span", undefined, "stepper");
        const menos = botao("−", "", () => mudarQuantidade(item, -1));
        const mais = botao("+", "", () => mudarQuantidade(item, +1));
        menos.setAttribute("aria-label", "Diminuir " + item.produto.nome);
        mais.setAttribute("aria-label", "Aumentar " + item.produto.nome);
        stepper.append(menos, criar("b", String(item.quantidade)), mais);
        const linha = criar("li");
        linha.append(criar("span", item.produto.nome, "cart-name"), stepper, criar("span", "R$ " + dinheiro(subtotal), "cart-price"));
        lista.appendChild(linha);
    });
    document.getElementById("carrinho-total").textContent = dinheiro(total);
    document.querySelector('#form-pedido button[type="submit"]').disabled = !loja.carrinho.length;
}

function atualizarFormularioPedido() {
    const form = document.getElementById("form-pedido");
    const ehEntrega = form.tipo.value === "entrega";
    document.getElementById("campo-endereco").hidden = !ehEntrega;
    document.getElementById("campo-troco").hidden = form.pagamento.value !== "dinheiro";
    document.getElementById("onde-paga").textContent = ehEntrega ? "Na entrega, direto ao entregador." : "No balcão, na hora de retirar.";
}
document.getElementById("form-pedido").addEventListener("change", atualizarFormularioPedido);

document.getElementById("form-pedido").addEventListener("submit", acaoSegura(async () => {
    const form = document.getElementById("form-pedido");
    if (!loja.carrinho.length) { notificar("Sua sacola está vazia."); return; }
    const resposta = await requisitar("/meus-pedidos", {
        tipo: form.tipo.value,
        endereco: document.getElementById("entrega-endereco").value,
        formaPagamento: form.pagamento.value,
        trocoPara: document.getElementById("troco").value,
        observacao: document.getElementById("observacao").value,
        itens: loja.carrinho.map(i => ({ produto: i.produto.nome, quantidade: i.quantidade })),
    });
    if (resposta.erro) { notificar(resposta.erro); return; }
    loja.carrinho = [];
    document.getElementById("troco").value = "";
    document.getElementById("observacao").value = "";
    renderSacola();
    await renderMeusPedidos();
    notificar("Pedido " + resposta.numero + " confirmado! É só pagar " + (resposta.tipo === "entrega" ? "na entrega." : "no balcão."));
}));

// ---------- 3) Entrar e criar conta ----------

function mostrarAba(nome) {
    const ehCadastro = nome === "cadastro";
    document.getElementById("form-login").hidden = ehCadastro;
    document.getElementById("form-cadastro").hidden = !ehCadastro;
    document.getElementById("aba-entrar").setAttribute("aria-selected", String(!ehCadastro));
    document.getElementById("aba-cadastro").setAttribute("aria-selected", String(ehCadastro));
    document.querySelector("#acesso-dialog .tabs").dataset.aba = nome;
}
document.querySelectorAll("#acesso-dialog [data-aba]").forEach(b => b.addEventListener("click", () => mostrarAba(b.dataset.aba)));
document.querySelectorAll("#form-login, #form-cadastro").forEach(f => f.addEventListener("input", () => limparErro(f)));

// Máscara: 18999991234 vira (18) 99999-1234
function formatarTelefone(texto) {
    const n = texto.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
    if (n.length <= 2) return n.length ? "(" + n : "";
    if (n.length <= 6) return "(" + n.slice(0, 2) + ") " + n.slice(2);
    if (n.length <= 10) return "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6);
    return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
}
document.getElementById("cadastro-telefone").addEventListener("input", (e) => { e.target.value = formatarTelefone(e.target.value); });

// Barrinha de força da senha + conferência da senha repetida
function conferirSenhas() {
    const senha = document.getElementById("cadastro-senha").value;
    const repetida = document.getElementById("cadastro-confirmacao").value;
    const aviso = document.getElementById("confere-texto");
    aviso.className = "hint";
    if (!repetida) { aviso.textContent = ""; return; }
    const iguais = senha === repetida;
    aviso.textContent = iguais ? "✓ As senhas são iguais." : "✗ As senhas ainda não são iguais.";
    aviso.classList.add(iguais ? "ok" : "ruim");
}

document.getElementById("cadastro-senha").addEventListener("input", (e) => {
    const senha = e.target.value;
    let nivel = 0;
    if (senha.length >= 8) nivel = 1;
    if (senha.length >= 8 && /\d/.test(senha) && /[a-z]/i.test(senha)) nivel = 2;
    if (senha.length >= 12 && /\d/.test(senha) && /[^a-z0-9]/i.test(senha)) nivel = 3;
    const textos = ["Faltam " + Math.max(0, 8 - senha.length) + " caracteres.", "Ok. Misture letras e números.", "Boa senha!", "Senha forte!"];
    document.getElementById("forca-barra").dataset.nivel = senha ? nivel : "";
    document.getElementById("forca-texto").textContent = senha ? textos[nivel] : "Mínimo de 8 caracteres.";
    conferirSenhas();
});
document.getElementById("cadastro-confirmacao").addEventListener("input", conferirSenhas);

async function depoisDeEntrar() {
    document.getElementById("form-login").reset();
    document.getElementById("form-cadastro").reset();
    document.getElementById("acesso-dialog").close();
    // equipe vai direto para o painel
    if (EH_EQUIPE(sessao.usuario)) { window.location.href = "equipe.html"; return; }
    notificar("Olá, " + sessao.usuario.nome.split(" ")[0] + "! Bora pedir?");
    await atualizarTela();
}

document.getElementById("form-login").addEventListener("submit", acaoSegura(async () => {
    const form = document.getElementById("form-login");
    const login = document.getElementById("login-usuario").value.trim();
    const senha = document.getElementById("login-senha").value;
    if (!login || !senha) { mostrarErro(form, "Preencha o e-mail (ou telefone) e a senha."); return; }
    const resposta = await entrar(login, senha);
    if (resposta.erro) { mostrarErro(form, resposta.erro); return; }
    await depoisDeEntrar();
}));

document.getElementById("form-cadastro").addEventListener("submit", acaoSegura(async () => {
    const form = document.getElementById("form-cadastro");
    const resposta = await requisitar("/cadastro", {
        nome: document.getElementById("cadastro-nome").value,
        email: document.getElementById("cadastro-email").value,
        telefone: document.getElementById("cadastro-telefone").value,
        senha: document.getElementById("cadastro-senha").value,
        confirmacao: document.getElementById("cadastro-confirmacao").value,
    });
    if (resposta.erro) { mostrarErro(form, resposta.erro, resposta.campo); return; }
    guardarLogin(resposta);
    await depoisDeEntrar();
}));

document.getElementById("botao-sair").addEventListener("click", acaoSegura(async () => {
    await sair();
    loja.carrinho = [];
    loja.statusConhecidos = {};
    renderSacola();
    await atualizarTela();
    notificar("Você saiu da conta.");
}));

// ---------- 4) Meus pedidos + rastreador ao vivo ----------

function criarLinhaDoTempo(pedido) {
    const lista = criar("ol", undefined, "timeline");
    const atual = ETAPAS.indexOf(pedido.status);
    NOMES_ETAPAS[pedido.tipo].forEach((nome, i) => {
        const etapa = criar("li", nome);
        if (i < atual) etapa.className = "feito";
        if (i === atual) etapa.className = "agora";
        lista.appendChild(etapa);
    });
    return lista;
}

async function renderMeusPedidos() {
    const pedidos = await requisitar("/meus-pedidos");
    const container = document.getElementById("lista-meus-pedidos");
    container.replaceChildren();
    if (!pedidos.length) container.appendChild(criar("p", "Você ainda não fez nenhum pedido.", "empty"));
    pedidos.forEach(pedido => {
        const card = criar("article", undefined, "order-card");
        const topo = criar("div", undefined, "order-top");
        topo.append(criar("strong", "Pedido #" + pedido.numero + " · " + ondeEsta(pedido)), criar("span", "R$ " + dinheiro(pedido.valorTotal)));
        card.append(topo, criarLinhaDoTempo(pedido), criar("small", textoPagamento(pedido)));
        container.appendChild(card);
    });

    // avisa quando um status muda
    pedidos.forEach(p => {
        const antes = loja.statusConhecidos[p.numero];
        if (antes && antes !== p.status) notificar("Pedido #" + p.numero + ": " + nomeEtapa(p) + "!");
        loja.statusConhecidos[p.numero] = p.status;
    });
    renderRastreador(pedidos);
}

function renderRastreador(pedidos) {
    const rastreador = document.getElementById("rastreador");
    const ativo = pedidos.find(p => p.status !== "entregue" && p.status !== "cancelado");
    rastreador.hidden = !ativo;
    document.body.classList.toggle("tem-rastreador", Boolean(ativo));
    if (!ativo) return;
    document.getElementById("rastreador-titulo").textContent = "Pedido #" + ativo.numero;
    document.getElementById("rastreador-status").textContent = nomeEtapa(ativo);
    document.getElementById("rastreador-progresso").style.setProperty("--progresso", (ETAPAS.indexOf(ativo.status) + 1) / ETAPAS.length);
}

// ---------- Tela ----------

async function atualizarTela() {
    const usuario = sessao.usuario;
    const ehCliente = usuario?.perfil === "cliente";
    document.getElementById("botao-entrar").hidden = Boolean(usuario);
    document.getElementById("botao-sair").hidden = !usuario;
    document.getElementById("link-painel").hidden = !EH_EQUIPE(usuario);
    const chip = document.getElementById("usuario-chip");
    chip.hidden = !usuario;
    chip.textContent = usuario ? "Olá, " + usuario.nome.split(" ")[0] : "";

    document.getElementById("cart-guest").hidden = ehCliente;
    document.getElementById("form-pedido").hidden = !ehCliente;
    document.getElementById("secao-meus-pedidos").hidden = !ehCliente;
    if (!ehCliente) { document.getElementById("rastreador").hidden = true; document.body.classList.remove("tem-rastreador"); }

    renderSacola();
    atualizarFormularioPedido();
    await renderCardapio();
    if (ehCliente) await renderMeusPedidos();
}

aoPerderSessao = atualizarTela;

// A cada 8 segundos pergunta ao servidor o status dos pedidos
setInterval(async () => {
    if (sessao.usuario?.perfil !== "cliente" || document.hidden) return;
    try { await renderMeusPedidos(); } catch (erro) { /* sem conexão agora; tenta na próxima */ }
}, INTERVALO_AO_VIVO);

(async function iniciar() {
    try { await carregarSessao(); } catch (erro) { notificar("A pizzaria está fora do ar. Tente em instantes."); }
    await atualizarTela();
})();
