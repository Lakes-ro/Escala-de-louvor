/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-dashboard.js
 *  Tela Principal (Dashboard) — exibida após o login
 *
 *  Seções:
 *    1. Saudação personalizada com nome e papel do usuário
 *    2. Card "Próximo Evento" — o que vem aí (culto/ensaio)
 *    3. Agenda da semana — todos os eventos da semana atual
 *    4. Atalhos rápidos — Cifras, Escalas, Equipe (se gestor)
 *    5. Alerta de músicas repetidas no mesmo dia (badge visual)
 *
 *  Estratégia de renderização:
 *    • Gera o HTML da tela dinamicamente e injeta no container
 *    • Usa dados do IndexedDB via módulos DB e Agenda
 *    • Reage aos eventos do Router (7tom:rota-entrada) para
 *      atualizar os dados quando o usuário volta para esta tela
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { Agenda } from './agenda.js';
import { DB }     from './db.js';


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTANTES
═══════════════════════════════════════════════════════════════════ */
const ID_TELA       = 'tela-dashboard';
const ID_CONTAINER  = 'container-app';

const ICONES = Object.freeze({
  calendario:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  musica:      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  equipe:      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  cifra:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  evento:      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  seta:        `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  aviso:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
});

const LABEL_TIPO = Object.freeze({
  'culto':           'Culto',
  'ensaio-oficial':  'Ensaio Oficial',
  'ensaio-extra':    'Ensaio Extra',
  'evento-especial': 'Evento Especial',
  'sabado-manha':    'Culto de Sábado',
  'domingo-noite':   'Culto de Domingo',
  'quarta-noite':    'Culto de Quarta',
  'ensaio-sexta':    'Ensaio (Sexta)',
});

const SAUDACAO_PAPEL = Object.freeze({
  'diretor':   'Diretor de Louvor',
  'associado': 'Associado',
  'musico':    'Músico',
  'convidado': 'Convidado',
});


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS
═══════════════════════════════════════════════════════════════════ */

/**
 * Retorna a saudação baseada na hora do dia.
 * @returns {string}
 */
function saudacaoHoraria() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Retorna apenas o primeiro nome de uma string.
 * @param {string} nomeCompleto
 * @returns {string}
 */
function primeiroNome(nomeCompleto = '') {
  return nomeCompleto.trim().split(' ')[0];
}

/**
 * Gera o badge de tipo de evento para exibição.
 * @param {string} tipo
 * @param {string} tipoCulto
 * @returns {string}
 */
function badgeTipo(tipo, tipoCulto) {
  const label = LABEL_TIPO[tipoCulto] ?? LABEL_TIPO[tipo] ?? tipo;
  const cls   = tipo === 'culto'
    ? 'badge-culto'
    : tipo === 'ensaio-oficial'
    ? 'badge-ensaio'
    : 'badge-evento';
  return `<span class="badge ${cls}">${label}</span>`;
}

/**
 * Injecta a estrutura da tela no DOM se ainda não existir.
 */
function garantirTelaNoDom() {
  const container = document.getElementById(ID_CONTAINER);
  if (!container) return;

  if (document.getElementById(ID_TELA)) return;

  const section = document.createElement('section');
  section.id = ID_TELA;
  section.className = 'tela';
  section.setAttribute('data-tela', 'dashboard');
  section.setAttribute('aria-labelledby', 'titulo-dashboard');
  section.setAttribute('aria-hidden', 'true');

  container.appendChild(section);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES DE HTML POR SEÇÃO
═══════════════════════════════════════════════════════════════════ */

/**
 * Seção de saudação.
 * @param {Object} usuario
 * @returns {string}
 */
function htmlSaudacao(usuario) {
  const saudacao = saudacaoHoraria();
  const nome     = primeiroNome(usuario.nome);
  const papel    = SAUDACAO_PAPEL[usuario.papel] ?? usuario.papel;

  return `
    <div class="dash-saudacao">
      <p class="dash-saudacao-texto">${saudacao},</p>
      <h1 id="titulo-dashboard" class="dash-saudacao-nome">${nome}</h1>
      <span class="dash-saudacao-papel">${papel}</span>
    </div>
  `;
}

/**
 * Card do próximo evento.
 * @param {import('./agenda.js').ItemAgenda|null} proximo
 * @returns {string}
 */
function htmlProximoEvento(proximo) {
  if (!proximo) {
    return `
      <div class="dash-card dash-proximo vazio">
        <p class="dash-card-vazio-texto">Nenhum evento nos próximos dias.</p>
      </div>
    `;
  }

  const temEscala = proximo.escalaId !== null;
  const qtdMusicas = proximo.musicaIds?.length ?? 0;

  return `
    <div class="dash-card dash-proximo" role="region" aria-label="Próximo evento">
      <div class="dash-card-cabecalho">
        <span class="dash-card-rotulo">Próximo</span>
        ${badgeTipo(proximo.tipo, proximo.tipoCulto)}
      </div>
      <p class="dash-proximo-titulo">${proximo.titulo}</p>
      <div class="dash-proximo-meta">
        <span class="dash-meta-item">
          ${ICONES.calendario}
          ${proximo.dataExibicao} · ${proximo.hora}
        </span>
        ${temEscala ? `
          <span class="dash-meta-item">
            ${ICONES.musica}
            ${qtdMusicas} ${qtdMusicas === 1 ? 'música' : 'músicas'}
          </span>
        ` : `
          <span class="dash-meta-item dash-meta-sem-escala">
            ${ICONES.aviso}
            Escala ainda não definida
          </span>
        `}
      </div>
      ${temEscala ? `
        <button
          class="btn-link dash-proximo-acao"
          data-navegar="escala"
          data-params='{"id":"${proximo.escalaId}"}'
          type="button"
        >
          Ver escala completa ${ICONES.seta}
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Linha de item da agenda semanal.
 * @param {import('./agenda.js').ItemAgenda} item
 * @param {boolean} ehHoje
 * @returns {string}
 */
function htmlItemSemana(item, ehHoje) {
  const clsHoje = ehHoje ? ' agenda-item-hoje' : '';

  return `
    <li class="agenda-item${clsHoje}" data-tipo="${item.tipo}">
      <div class="agenda-item-data">
        <span class="agenda-dia-semana">${item.diaSemanaLabel.slice(0, 3)}</span>
        <span class="agenda-dia-num">${item.dataISO.slice(8)}</span>
      </div>
      <div class="agenda-item-corpo">
        <span class="agenda-item-titulo">${item.titulo}</span>
        <span class="agenda-item-hora">${item.hora}</span>
      </div>
      <div class="agenda-item-direita">
        ${badgeTipo(item.tipo, item.tipoCulto)}
        ${item.escalaId ? `
          <button
            class="btn-link agenda-item-link"
            data-navegar="escala"
            data-params='{"id":"${item.escalaId}"}'
            type="button"
            aria-label="Ver escala de ${item.titulo}"
          >${ICONES.seta}</button>
        ` : ''}
      </div>
    </li>
  `;
}

/**
 * Seção da agenda da semana.
 * @param {import('./agenda.js').ItemAgenda[]} itens
 * @returns {string}
 */
function htmlAgendaSemana(itens) {
  const isoHoje = Agenda.paraISO(new Date());

  if (!itens.length) {
    return `
      <section class="dash-secao" aria-labelledby="titulo-semana">
        <h2 id="titulo-semana" class="dash-secao-titulo">Esta semana</h2>
        <p class="dash-vazio">Nenhum evento esta semana.</p>
      </section>
    `;
  }

  const listaHTML = itens
    .map(item => htmlItemSemana(item, item.dataISO === isoHoje))
    .join('');

  return `
    <section class="dash-secao" aria-labelledby="titulo-semana">
      <h2 id="titulo-semana" class="dash-secao-titulo">Esta semana</h2>
      <ul class="agenda-lista" role="list">
        ${listaHTML}
      </ul>
    </section>
  `;
}

/**
 * Grade de atalhos rápidos.
 * @param {boolean} podeGerenciar
 * @returns {string}
 */
function htmlAtalhos(podeGerenciar) {
  const atalhos = [
    {
      id:     'atalho-cifras',
      rota:   'musicas',
      icone:  ICONES.cifra,
      label:  'Cifras',
      desc:   'Catálogo de músicas',
    },
    {
      id:     'atalho-escalas',
      rota:   'escalas',
      icone:  ICONES.calendario,
      label:  'Escalas',
      desc:   'Baú de escalas',
    },
    {
      id:     'atalho-eventos',
      rota:   'eventos',
      icone:  ICONES.evento,
      label:  'Eventos',
      desc:   'Ensaios extras',
    },
  ];

  if (podeGerenciar) {
    atalhos.push({
      id:    'atalho-equipe',
      rota:  'equipe',
      icone: ICONES.equipe,
      label: 'Equipe',
      desc:  'Gestão de membros',
    });
  }

  const botoesHTML = atalhos.map(a => `
    <button
      id="${a.id}"
      class="atalho-btn"
      type="button"
      data-navegar="${a.rota}"
      aria-label="${a.label} — ${a.desc}"
    >
      <span class="atalho-icone">${a.icone}</span>
      <span class="atalho-label">${a.label}</span>
    </button>
  `).join('');

  return `
    <section class="dash-secao" aria-labelledby="titulo-atalhos">
      <h2 id="titulo-atalhos" class="dash-secao-titulo sr-only">Atalhos rápidos</h2>
      <div class="atalhos-grade" role="navigation" aria-label="Atalhos">
        ${botoesHTML}
      </div>
    </section>
  `;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ RENDERIZAÇÃO PRINCIPAL
═══════════════════════════════════════════════════════════════════ */

/**
 * Carrega todos os dados necessários e renderiza a tela.
 */
async function renderizar() {
  const tela = document.getElementById(ID_TELA);
  if (!tela) return;

  const usuario = Auth.usuario;
  if (!usuario) {
    Router.navegar('acesso', {}, true);
    return;
  }

  // Estado de carregamento
  tela.innerHTML = `
    <div class="dash-carregando" role="status" aria-live="polite">
      <span class="sr-only">Carregando painel…</span>
      <div class="dash-skeleton dash-skeleton-saudacao"></div>
      <div class="dash-skeleton dash-skeleton-card"></div>
      <div class="dash-skeleton dash-skeleton-lista"></div>
    </div>
  `;

  try {
    // Carrega agenda da semana e próximo evento em paralelo
    const [itensSemana, proximoItem] = await Promise.all([
      (async () => {
        const itens = Agenda.agendaDaSemana();
        return Agenda.enriquecerComBanco(itens);
      })(),
      (async () => {
        const proximo = Agenda.proximoItemFixo();
        if (!proximo) return null;
        const enriched = await Agenda.enriquecerComBanco([proximo]);
        return enriched[0];
      })(),
    ]);

    // Verifica repetições de músicas para alerta
    const itensComEscala = itensSemana.filter(i => i.escalaId);
    if (itensComEscala.length) {
      Agenda.verificarRepeticoes(itensComEscala);
    }

    // Monta o HTML final
    const html = `
      <div class="dash-inner">
        ${htmlSaudacao(usuario)}
        ${htmlProximoEvento(proximoItem)}
        ${htmlAtalhos(Auth.podeGerenciar())}
        ${htmlAgendaSemana(itensSemana)}
      </div>
    `;

    tela.innerHTML = html;

    // Registra listeners nos botões de navegação
    _vincularNavegacao(tela);

  } catch (erro) {
    console.error('[Dashboard 7° Tom] Erro ao renderizar:', erro);
    tela.innerHTML = `
      <div class="dash-inner">
        <div class="dash-erro" role="alert">
          <p>Não foi possível carregar o painel.</p>
          <button class="btn-link" id="btn-tentar-novamente" type="button">
            Tentar novamente
          </button>
        </div>
      </div>
    `;
    document.getElementById('btn-tentar-novamente')
      ?.addEventListener('click', renderizar, { once: true });
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS INTERNOS
═══════════════════════════════════════════════════════════════════ */

/**
 * Vincula todos os botões [data-navegar] ao Router.
 * @param {HTMLElement} escopo
 */
function _vincularNavegacao(escopo) {
  escopo.querySelectorAll('[data-navegar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rota   = btn.dataset.navegar;
      let params = {};
      try {
        if (btn.dataset.params) params = JSON.parse(btn.dataset.params);
      } catch { /* params inválidos — ignora */ }
      Router.navegar(rota, params);
    });
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INICIALIZAÇÃO DO MÓDULO
═══════════════════════════════════════════════════════════════════ */

/**
 * Registra os listeners de ciclo de vida e prepara a tela.
 * Chamado uma única vez pelo app.js.
 */
function init() {
  // Garante que a <section> existe no DOM
  garantirTelaNoDom();

  // Renderiza sempre que o router entrar nesta tela
  document.addEventListener('7tom:rota-entrada', (evento) => {
    if (evento.detail.rota === 'dashboard') {
      renderizar();
    }
  });

  // Atualiza ao receber alerta de música repetida
  document.addEventListener('7tom:musica-repetida', (evento) => {
    const aviso = document.querySelector('.dash-aviso-repeticao');
    if (aviso) {
      aviso.textContent =
        `⚠ Música repetida no mesmo dia: verifique as escalas.`;
      aviso.hidden = false;
    }
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EXPORTAÇÃO
═══════════════════════════════════════════════════════════════════ */
export const TelaDashboard = { init, renderizar };
