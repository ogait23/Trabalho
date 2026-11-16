// =====================================================================
//  comum.js — coisas usadas pela loja (index.html) e pelo painel (equipe.html)
// =====================================================================

const BASE = "/api";
const INTERVALO_AO_VIVO = 8000; // de quanto em quanto tempo (ms) a página pergunta se algo mudou

// ---------- Login por aba ----------
// O token fica no sessionStorage, que é SEPARADO em cada aba do navegador.
// Por isso dá para ter uma aba como cliente e outra como admin ao mesmo tempo.
function lerToken() {
    try { return sessionStorage.getItem("fornatta-token") || ""; } catch (erro) { return ""; }
}

function salvarToken(token) {
    sessao.token = token;
    try {
        if (token) sessionStorage.setItem("fornatta-token", token);
        else sessionStorage.removeItem("fornatta-token");
    } catch (erro) { /* navegador bloqueou: o login vale até recarregar */ }
}

const sessao = { token: lerToken(), csrf: "", usuario: null };

// Cada página pode trocar esta função para reagir quando o login expira
let aoPerderSessao = () => {};

// ---------- Conversa com o servidor ----------
// Sem corpo = GET (buscar). Com corpo = POST (enviar).
async function requisitar(caminho, corpo) {
    const opcoes = { headers: { "X-CSRF-Token": sessao.csrf, "X-Sessao": sessao.token } };
    if (corpo !== undefined) {
        opcoes.method = "POST";
        opcoes.headers["Content-Type"] = "application/json";
        opcoes.body = JSON.stringify(corpo);
    }
    try {
        const resposta = await fetch(BASE + caminho, { ...opcoes, signal: AbortSignal.timeout(15000) });
        const json = await resposta.json();
        if (resposta.status === 401 && sessao.usuario) {
            sessao.usuario = null;
            salvarToken("");
            notificar("Sua sessão expirou. Entre novamente.");
            aoPerderSessao();
        }
        if (!resposta.ok && corpo === undefined) throw new Error(json.erro || "Não foi possível carregar os dados.");
        return json;
    } catch (erro) {
        const mensagem = "Não foi possível conectar à pizzaria. Tente novamente.";
        if (corpo !== undefined) return { erro: mensagem };
        throw new Error(mensagem, { cause: erro });
    }
}

async function carregarSessao() {
    const dados = await requisitar("/sessao");
    sessao.csrf = dados.csrf;
    sessao.usuario = dados.usuario;
}

async function entrar(login, senha) {
    const resposta = await requisitar("/login", { login, senha });
    if (!resposta.erro) guardarLogin(resposta);
    return resposta;
}

function guardarLogin(resposta) {
    salvarToken(resposta.token);
    sessao.csrf = resposta.csrf;
    sessao.usuario = resposta.usuario;
}

async function sair() {
    await requisitar("/sair", {});
    salvarToken("");
    sessao.usuario = null;
}

// Trava o botão enquanto a ação roda, para não enviar duas vezes
function acaoSegura(acao) {
    return async (evento) => {
        evento.preventDefault();
        const alvo = evento.currentTarget;
        if (alvo.dataset.ocupado) return;
        alvo.dataset.ocupado = "true";
        const botoes = alvo.matches("button") ? [alvo] : [...alvo.querySelectorAll('button[type="submit"]')];
        botoes.forEach(b => b.disabled = true);
        try { await acao(evento); }
        catch (erro) { notificar(erro.message || "Não foi possível concluir. Tente novamente."); }
        finally {
            delete alvo.dataset.ocupado;
            botoes.forEach(b => b.disabled = false);
        }
    };
}

// ---------- Ajudantes de tela ----------
function criar(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto !== undefined) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
}

function botao(texto, classe, aoClicar) {
    const b = criar("button", texto, classe);
    b.type = "button";
    if (aoClicar) b.addEventListener("click", aoClicar);
    return b;
}

function dinheiro(valor) {
    return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Reinicia uma animação CSS (ex.: contador da sacola "pulando")
function animar(elemento, classe) {
    elemento.classList.remove(classe);
    void elemento.offsetWidth;
    elemento.classList.add(classe);
}

let timerAviso;
function notificar(mensagem) {
    const toast = document.getElementById("notificacoes");
    clearTimeout(timerAviso);
    toast.textContent = mensagem;
    animar(toast, "show");
    timerAviso = setTimeout(() => { toast.textContent = ""; toast.classList.remove("show"); }, 4500);
}

// ---------- Janelas (dialog) ----------
function abrirDialogo(id) {
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    document.getElementById(id).showModal();
}

document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => abrirDialogo(b.dataset.open)));
document.querySelectorAll("dialog").forEach(dialog => {
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    // clicar fora da janela fecha
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
});

// Botão Mostrar/Ocultar senha
document.querySelectorAll(".show-pass").forEach(b => b.addEventListener("click", () => {
    const input = b.previousElementSibling;
    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    b.textContent = mostrar ? "Ocultar" : "Mostrar";
}));

// Erro mostrado dentro do formulário
function mostrarErro(form, mensagem, campo) {
    const caixa = form.querySelector(".form-error");
    caixa.textContent = mensagem;
    caixa.hidden = false;
    animar(caixa, "shake");
    const input = campo ? form.querySelector('[name="' + campo + '"]') : null;
    if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); }
}

function limparErro(form) {
    form.querySelector(".form-error").hidden = true;
    form.querySelectorAll("[aria-invalid]").forEach(i => i.removeAttribute("aria-invalid"));
}

// ---------- Pedidos: nomes que aparecem na tela ----------
const ETAPAS = ["recebido", "em_preparo", "pronto", "entregue"];
const NOMES_ETAPAS = {
    entrega:  ["Recebido", "No forno", "Saiu para entrega", "Entregue"],
    retirada: ["Recebido", "No forno", "Pronto no balcão", "Retirado"],
    salao:    ["Aberto", "No forno", "Pronto", "Pago"],
};
const NOMES_PAGAMENTO = { dinheiro: "Dinheiro", cartao_debito: "Débito", cartao_credito: "Crédito" };

function nomeEtapa(pedido) {
    if (pedido.status === "cancelado") return "Cancelado";
    return NOMES_ETAPAS[pedido.tipo][ETAPAS.indexOf(pedido.status)];
}

function ondeEsta(pedido) {
    if (pedido.tipo === "entrega") return "Entrega";
    if (pedido.tipo === "retirada") return "Balcão";
    return "Mesa " + pedido.mesa;
}

function textoPagamento(pedido) {
    let texto = (pedido.tipo === "entrega" ? "Paga na entrega: " : "Paga no balcão: ") + (NOMES_PAGAMENTO[pedido.formaPagamento] || "-");
    if (pedido.trocoPara) texto += " · troco p/ R$ " + dinheiro(pedido.trocoPara);
    return texto;
}

const EH_EQUIPE = (usuario) => Boolean(usuario) && usuario.perfil !== "cliente";
