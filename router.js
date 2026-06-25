/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — router.js
 *  Roteador de tela para a SPA (Single Page Application)
 *
 *  Funcionamento:
 *    • Hash-based routing (#acesso, #dashboard, #escala, etc.)
 *    • Cada "tela" é um <section data-tela="nome"> no index.html
 *    • O router ativa/desativa telas via classe CSS .tela-ativa
 *    • Guarda guards por papel (diretor, musico, etc.)
 *    • Emite eventos customizados para que módulos reajam
 *      à entrada/saída de cada tela sem acoplamento direto
 *
 *  Rotas registradas:
 *    #acesso          → tela de login por CPF
 *    #dashboard       → painel principal do usuário logado
 *    #escala          → visualização de escala específica
 *    #escalas         → lista de escalas (baú)
 *    #musicas         → catálogo de músicas
 *    #cifra           → leitura de cifra individual
 *    #eventos         → ensaios extras e eventos especiais
 *    #equipe          → gestão da equipe (diretor/associado)
 *    #perfil          → perfil do usuário logado
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';


/* ═══════════════════════════════════════════════════════════════════
   ■ DEFINIÇÃO DAS ROTAS
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Rota
 * @property {string}   tela      — id do <section data-tela="">
 * @property {string}   titulo    — título da página (document.title)
 * @property {string[]} papeis    — papeis com acesso ('*' = todos logados)
 * @property {boolean}  publica   — true = não exige login
 */

/** @type {Map<string, Rota>} */
const ROTAS = new Map([

  ['acesso', {
    tela:    'tela-acesso',
    titulo:  '7° Tom — Acesso',
    papeis:  [],
    publica: true,
  }],

  ['dashboard', {
    tela:    'tela-dashboard',
    titulo:  '7° Tom — Painel',
    papeis:  ['*'],
    publica: false,
  }],

  ['escalas', {
    tela:    'tela-escalas',
    titulo:  '7° Tom — Escalas',
    papeis:  ['*'],
    publica: false,
  }],

  ['escala', {
    tela:    'tela-escala',
    titulo:  '7° Tom — Escala',
    papeis:  ['*'],
    publica: false,
  }],

  ['musicas', {
    tela:    'tela-musicas',
    titulo:  '7° Tom — Músicas',
    papeis:  ['*'],
    publica: false,
  }],

  ['cifra', {
    tela:    'tela-cifra',
    titulo:  '7° Tom — Cifra',
    papeis:  ['*'],
    publica: false,
  }],

  ['eventos', {
    tela:    'tela-eventos',
    titulo:  '7° Tom — Eventos',
    papeis:  ['*'],
    publica: false,
  }],

  ['equipe', {
    tela:    'tela-equipe',
    titulo:  '7° Tom — Equipe',
    papeis:  ['diretor', 'associado'],
    publica: false,
  }],

  ['perfil', {
    tela:    'tela-perfil',
    titulo:  '7° Tom — Perfil',
    papeis:  ['*'],
    publica: false,
  }],

]);

/** Rota padrão quando nenhum hash é encontrado */
const ROTA_PADRAO   = 'acesso';
/** Rota de destino após login bem-sucedido */
const ROTA_POS_LOGIN = 'dashboard';
/** Rota de redirecionamento quando sem permissão */
const ROTA_SEM_ACESSO = 'acesso';


/* ═══════════════════════════════════════════════════════════════════
   ■ ESTADO INTERNO
═══════════════════════════════════════════════════════════════════ */
const _estado = {
  rotaAtual:    null,   // string — nome da rota atual
  parametros:   {},     // objeto de query params do hash
  historico:    [],     // string[] — histórico simples de navegação
  usuario:      null,   // objeto do usuário logado (vindo do auth.js)
};


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS
═══════════════════════════════════════════════════════════════════ */

/**
 * Extrai nome de rota e parâmetros do hash atual.
 * Formato: #nome-rota?chave=valor&chave2=valor2
 * @returns {{ nome: string, params: Object }}
 */
function parsearHash() {
  const hash = window.location.hash.slice(1) || ROTA_PADRAO;
  const [nome, queryString = ''] = hash.split('?');

  const params = {};
  if (queryString) {
    queryString.split('&').forEach(par => {
      const [chave, valor] = par.split('=').map(decodeURIComponent);
      if (chave) params[chave] = valor ?? true;
    });
  }

  return { nome: nome || ROTA_PADRAO, params };
}

/**
 * Emite um evento customizado no document.
 * @param {string} tipo   — nome do evento
 * @param {any}    detalhe — dado carregado
 */
function emitir(tipo, detalhe = {}) {
  document.dispatchEvent(new CustomEvent(tipo, {
    detail:  detalhe,
    bubbles: false,
  }));
}

/**
 * Ativa/desativa as telas no DOM.
 * @param {string} idTelaAtiva — id do <section> a exibir
 */
function comutar(idTelaAtiva) {
  const todasTelas = document.querySelectorAll('[data-tela]');

  todasTelas.forEach(tela => {
    const ativa = tela.id === idTelaAtiva;
    tela.classList.toggle('tela-ativa', ativa);

    // Acessibilidade: esconde telas inativas de leitores de tela
    tela.setAttribute('aria-hidden', String(!ativa));

    // Gerencia foco: move para o primeiro elemento focável na tela ativa
    if (ativa) {
      requestAnimationFrame(() => {
        const focavel = tela.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focavel?.focus({ preventScroll: false });
      });
    }
  });

  // Mostra/oculta a barra de navegação inferior
  const navInferior = document.getElementById('nav-inferior');
  if (navInferior) {
    const rotaAtual = [...ROTAS.entries()].find(([, r]) => r.tela === idTelaAtiva)?.[0];
    const rota      = ROTAS.get(rotaAtual ?? '');
    const exibirNav = rota && !rota.publica && _estado.usuario;
    navInferior.hidden = !exibirNav;
  }
}

/**
 * Verifica se o usuário tem permissão para acessar a rota.
 * @param {Rota} rota
 * @returns {boolean}
 */
function temAcesso(rota) {
  if (rota.publica) return true;
  if (!_estado.usuario) return false;
  if (rota.papeis.includes('*')) return true;
  return rota.papeis.includes(_estado.usuario.papel);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ NÚCLEO DE NAVEGAÇÃO
═══════════════════════════════════════════════════════════════════ */

/**
 * Navega para uma rota pelo nome.
 * @param {string} nome       — nome da rota (ex: 'dashboard')
 * @param {Object} [params]   — parâmetros opcionais (ex: { id: '42' })
 * @param {boolean} [replace] — usa replaceState ao invés de pushState
 */
function navegar(nome, params = {}, replace = false) {
  const rota = ROTAS.get(nome);

  if (!rota) {
    console.warn(`[Router 7° Tom] Rota desconhecida: "${nome}"`);
    navegar(ROTA_PADRAO, {}, true);
    return;
  }

  // Controle de acesso
  if (!temAcesso(rota)) {
    console.info(`[Router 7° Tom] Acesso negado à rota "${nome}". Redirecionando.`);
    navegar(ROTA_SEM_ACESSO, {}, true);
    return;
  }

  // Monta o hash com parâmetros
  const queryString = Object.keys(params).length
    ? '?' + Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';

  const novoHash = `#${nome}${queryString}`;

  // Atualiza a URL sem recarregar a página
  if (replace) {
    window.history.replaceState(null, '', novoHash);
  } else {
    window.history.pushState(null, '', novoHash);
  }

  _ativarRota(nome, params);
}

/**
 * Aplica a rota no DOM e emite eventos de ciclo de vida.
 * @param {string} nome
 * @param {Object} params
 */
function _ativarRota(nome, params) {
  const rota = ROTAS.get(nome);
  if (!rota) return;

  const rotaAnterior = _estado.rotaAtual;

  // Emite evento de saída da rota anterior
  if (rotaAnterior && rotaAnterior !== nome) {
    emitir('7tom:rota-saida', {
      rota:   rotaAnterior,
      params: _estado.parametros,
    });
  }

  // Atualiza estado interno
  _estado.rotaAtual  = nome;
  _estado.parametros = params;
  _estado.historico.push(nome);

  // Atualiza o título da aba
  document.title = rota.titulo;

  // Commuta as telas no DOM
  comutar(rota.tela);

  // Emite evento de entrada na nova rota
  emitir('7tom:rota-entrada', {
    rota:     nome,
    params,
    anterior: rotaAnterior,
  });

  console.info(`[Router 7° Tom] → ${nome}`, params);
}

/**
 * Volta à tela anterior no histórico interno.
 * Se não houver histórico, vai para o dashboard.
 */
function voltar() {
  if (_estado.historico.length > 1) {
    _estado.historico.pop(); // remove atual
    const anterior = _estado.historico[_estado.historico.length - 1];
    navegar(anterior, {}, true);
  } else {
    navegar(_estado.usuario ? ROTA_POS_LOGIN : ROTA_PADRAO, {}, true);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ REAÇÃO AO BOTÃO VOLTAR DO BROWSER
═══════════════════════════════════════════════════════════════════ */
window.addEventListener('popstate', () => {
  const { nome, params } = parsearHash();
  const rota = ROTAS.get(nome);

  if (!rota) {
    navegar(ROTA_PADRAO, {}, true);
    return;
  }

  if (!temAcesso(rota)) {
    navegar(ROTA_SEM_ACESSO, {}, true);
    return;
  }

  _ativarRota(nome, params);
});


/* ═══════════════════════════════════════════════════════════════════
   ■ INICIALIZAÇÃO
═══════════════════════════════════════════════════════════════════ */

/**
 * Inicia o roteador. Deve ser chamado após o DOM carregar e
 * após o módulo de autenticação definir o usuário (se houver).
 * @param {Object|null} usuarioLogado — objeto de usuário ou null
 */
function init(usuarioLogado = null) {
  _estado.usuario = usuarioLogado;

  const { nome, params } = parsearHash();
  const rota = ROTAS.get(nome);

  if (!rota || !temAcesso(rota)) {
    // Se já há usuário, vai para o dashboard; senão, tela de acesso
    navegar(
      usuarioLogado ? ROTA_POS_LOGIN : ROTA_PADRAO,
      {},
      true
    );
    return;
  }

  _ativarRota(nome, params);
}

/**
 * Atualiza o usuário logado no estado do router.
 * Chamado pelo módulo de auth após login/logout.
 * @param {Object|null} usuario
 */
function definirUsuario(usuario) {
  _estado.usuario = usuario;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EXPORTAÇÃO
═══════════════════════════════════════════════════════════════════ */
export const Router = {
  init,
  navegar,
  voltar,
  definirUsuario,

  /** Retorna o nome da rota atual */
  get rotaAtual()  { return _estado.rotaAtual; },

  /** Retorna os parâmetros da rota atual */
  get parametros() { return { ..._estado.parametros }; },

  /** Retorna o usuário logado (ou null) */
  get usuario()    { return _estado.usuario; },

  /** Constantes úteis para outros módulos */
  ROTAS,
  ROTA_POS_LOGIN,
  ROTA_PADRAO,
};
