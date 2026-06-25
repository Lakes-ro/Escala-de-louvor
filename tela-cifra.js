/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-cifra.js
 *  Tela de Leitura de Cifra
 *
 *  Funcionalidades:
 *    • Exibe a cifra completa com acordes renderizados
 *    • Transpositor de tom: sobe/desce 1 semitom por toque
 *    • Seletor direto de tom (lista completa)
 *    • Botão "Só letra" oculta acordes para quem só canta
 *    • Controle de tamanho de fonte (A- / A+)
 *    • Sugestão de Capo para o tom atual
 *    • Visualizador de partitura PDF integrado (se houver)
 *    • Wake Lock: tela não apaga durante a leitura no celular
 *    • Impressão limpa via @media print
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Router } from './router.js';
import { DB }     from './db.js';
import { Cifras } from './cifras.js';

const ID_TELA = 'tela-cifra';

const IC = Object.freeze({
  voltar:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`,
  mais:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  menos:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  pdf:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  imprimir:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  nota:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
});

/* Wake Lock handle */
let _wakeLock = null;

async function ativarWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* ignora — funcionalidade não crítica */ }
}

async function liberarWakeLock() {
  if (_wakeLock) { await _wakeLock.release(); _wakeLock = null; }
}

/* Reativa wake lock se a aba voltar ao foco */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.getElementById(ID_TELA)?.classList.contains('tela-ativa')) {
    ativarWakeLock();
  }
});


/* ═══════════════════════════════════════════════════════════════════
   ■ GARANTIA DE TELA NO DOM
═══════════════════════════════════════════════════════════════════ */
function garantirTelaNoDom() {
  if (document.getElementById(ID_TELA)) return;
  const c = document.getElementById('container-app');
  if (!c) return;
  const s = document.createElement('section');
  s.id = ID_TELA;
  s.className = 'tela';
  s.setAttribute('data-tela', 'cifra');
  s.setAttribute('aria-hidden', 'true');
  c.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ SELETOR DE TOM
═══════════════════════════════════════════════════════════════════ */
function htmlSeletorTom(tomAtual) {
  const opcoes = Cifras.TONS_DISPONIVEIS.map(t =>
    `<option value="${t}"${t === tomAtual ? ' selected' : ''}>${t}</option>`
  ).join('');

  return `
    <div class="cifra-tom-wrapper">
      <span class="cifra-tom-label">Tom:</span>
      <select id="select-tom" class="cifra-tom-select" aria-label="Selecionar tom">
        ${opcoes}
      </select>
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ BARRA DE CONTROLES
═══════════════════════════════════════════════════════════════════ */
function htmlControles(musica, tomAtual) {
  const sugestoes = Cifras.sugerirCapo(tomAtual);
  const capoHtml = sugestoes.length
    ? sugestoes.map(s =>
        `<span class="cifra-capo-item">Capo ${s.casa} → tocar em <strong>${s.tocarEm}</strong></span>`
      ).join('')
    : '';

  return `
    <div class="cifra-controles" role="toolbar" aria-label="Controles da cifra">

      <!-- Tom -->
      <div class="cifra-ctrl-grupo cifra-ctrl-tom">
        <button class="btn-ctrl" id="btn-tom-menos" type="button" aria-label="Descer 1 semitom">
          <span aria-hidden="true">−1</span>
        </button>
        ${htmlSeletorTom(tomAtual)}
        <button class="btn-ctrl" id="btn-tom-mais" type="button" aria-label="Subir 1 semitom">
          <span aria-hidden="true">+1</span>
        </button>
      </div>

      <!-- Divisor -->
      <div class="cifra-ctrl-divisor" aria-hidden="true"></div>

      <!-- Fonte -->
      <div class="cifra-ctrl-grupo">
        <button class="btn-ctrl" id="btn-fonte-menos" type="button" aria-label="Diminuir fonte">
          <span class="btn-ctrl-fonte-a btn-ctrl-fonte-a-pequeno">A</span>
        </button>
        <button class="btn-ctrl" id="btn-fonte-mais" type="button" aria-label="Aumentar fonte">
          <span class="btn-ctrl-fonte-a btn-ctrl-fonte-a-grande">A</span>
        </button>
      </div>

      <!-- Divisor -->
      <div class="cifra-ctrl-divisor" aria-hidden="true"></div>

      <!-- Modo -->
      <button class="btn-ctrl btn-ctrl-toggle" id="btn-so-letra"
        type="button" aria-pressed="false" aria-label="Alternar modo só letra">
        Só letra
      </button>

      <!-- Imprimir -->
      <button class="btn-icone" id="btn-imprimir-cifra" type="button" aria-label="Imprimir cifra">
        ${IC.imprimir}
      </button>

    </div>

    <!-- Sugestões de capo -->
    ${capoHtml ? `
      <div class="cifra-capo" id="cifra-capo-info" aria-label="Sugestões de capo">
        <span class="cifra-capo-titulo">Capo sugerido:</span>
        ${capoHtml}
      </div>
    ` : ''}
  `;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ RENDERIZAÇÃO PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
async function renderizar(params = {}) {
  const tela = document.getElementById(ID_TELA);
  if (!tela) return;

  const musicaId = params.id ? Number(params.id) : null;

  tela.innerHTML = `
    <div class="inner-page">
      <div class="dash-skeleton" style="height:56px"></div>
      <div class="dash-skeleton" style="height:80px"></div>
      <div class="dash-skeleton" style="height:400px"></div>
    </div>`;

  // Ativa wake lock para não apagar tela durante a leitura
  ativarWakeLock();

  try {
    if (!musicaId) throw new Error('ID de música não fornecido.');

    const musica = await DB.musicas.buscarPorId(musicaId);
    if (!musica) throw new Error('Música não encontrada.');

    const tomInicial  = musica.tom || Cifras.detectarTom(musica.cifra) || 'C';
    const nomeTom     = Cifras.NOME_TOM[tomInicial] ?? tomInicial;

    tela.innerHTML = `
      <div class="cifra-tela-inner">

        <!-- Cabeçalho fixo -->
        <div class="cifra-header" role="banner">
          <button class="btn-icone btn-voltar" id="btn-voltar-cifra"
            type="button" aria-label="Voltar">
            ${IC.voltar}
          </button>
          <div class="cifra-header-info">
            <h1 class="cifra-titulo">${musica.titulo}</h1>
            <p class="cifra-subtitulo">${musica.autor || ''}</p>
          </div>
          ${musica.urlPartitura ? `
            <button class="btn-icone" id="btn-toggle-pdf"
              type="button" aria-label="Ver partitura PDF" aria-pressed="false">
              ${IC.pdf}
            </button>
          ` : ''}
        </div>

        <!-- Barra de controles -->
        ${htmlControles(musica, tomInicial)}

        <!-- Visor da cifra -->
        <div class="cifra-visor" id="cifra-visor" aria-label="Cifra de ${musica.titulo}">
        </div>

        <!-- Visor PDF (oculto por padrão) -->
        ${musica.urlPartitura ? `
          <div class="cifra-pdf-visor" id="cifra-pdf-visor" hidden
            aria-label="Partitura PDF de ${musica.titulo}">
            <iframe
              src="${musica.urlPartitura}"
              class="cifra-pdf-frame"
              title="Partitura: ${musica.titulo}"
              aria-label="Partitura em PDF"
              loading="lazy"
            ></iframe>
          </div>
        ` : ''}

      </div>
    `;

    // Monta o componente de cifra interativo
    const visor      = tela.querySelector('#cifra-visor');
    const componente = Cifras.criarComponenteCifra(visor, musica);
    if (!componente) throw new Error('Erro ao criar componente de cifra.');

    _vincularControles(tela, componente, musica);

  } catch (erro) {
    console.error('[TelaCifra 7° Tom]', erro);
    liberarWakeLock();
    tela.innerHTML = `
      <div class="inner-page">
        <button class="btn-link" type="button" id="btn-voltar-erro">
          ${IC.voltar} Voltar
        </button>
        <p class="dash-erro">${erro.message}</p>
      </div>`;
    document.getElementById('btn-voltar-erro')
      ?.addEventListener('click', () => Router.voltar(), { once: true });
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ VINCULAÇÃO DE CONTROLES
═══════════════════════════════════════════════════════════════════ */
function _vincularControles(tela, componente, musica) {
  const selectTom  = tela.querySelector('#select-tom');
  const btnTomMais = tela.querySelector('#btn-tom-mais');
  const btnTomMenos= tela.querySelector('#btn-tom-menos');
  const btnFntMais = tela.querySelector('#btn-fonte-mais');
  const btnFntMenos= tela.querySelector('#btn-fonte-menos');
  const btnLetra   = tela.querySelector('#btn-so-letra');
  const btnPDF     = tela.querySelector('#btn-toggle-pdf');
  const visorPDF   = tela.querySelector('#cifra-pdf-visor');
  const capoInfo   = tela.querySelector('#cifra-capo-info');

  /** Atualiza o select de tom e o capo sempre que o componente muda */
  function atualizarUI() {
    if (selectTom) selectTom.value = componente.tomAtual;

    // Atualiza sugestões de capo
    if (capoInfo) {
      const sugestoes = Cifras.sugerirCapo(componente.tomAtual);
      if (sugestoes.length) {
        capoInfo.innerHTML = `<span class="cifra-capo-titulo">Capo sugerido:</span>`
          + sugestoes.map(s =>
              `<span class="cifra-capo-item">Capo ${s.casa} → tocar em <strong>${s.tocarEm}</strong></span>`
            ).join('');
        capoInfo.hidden = false;
      } else {
        capoInfo.hidden = true;
      }
    }
  }

  // Transpor pelo seletor
  selectTom?.addEventListener('change', () => {
    const semitons = Cifras.calcularSemitons(componente.tomOriginal, selectTom.value);
    const atual    = Cifras.calcularSemitons(componente.tomOriginal, componente.tomAtual);
    componente.transporPor(semitons - atual);
    atualizarUI();
  });

  // +1 / -1 semitom
  btnTomMais?.addEventListener('click', () => { componente.transporPor(1);  atualizarUI(); });
  btnTomMenos?.addEventListener('click',() => { componente.transporPor(-1); atualizarUI(); });

  // Fonte
  btnFntMais?.addEventListener('click',  () => componente.aumentarFonte());
  btnFntMenos?.addEventListener('click', () => componente.diminuirFonte());

  // Só letra
  btnLetra?.addEventListener('click', () => {
    componente.alternarSoLetra();
    const ativo = componente.soLetra;
    btnLetra.setAttribute('aria-pressed', String(ativo));
    btnLetra.classList.toggle('btn-ctrl-toggle-ativo', ativo);
  });

  // Toggle PDF
  btnPDF?.addEventListener('click', () => {
    const aberto = visorPDF && !visorPDF.hidden;
    if (visorPDF) visorPDF.hidden = aberto;
    btnPDF.setAttribute('aria-pressed', String(!aberto));
    btnPDF.classList.toggle('btn-icone-ativo', !aberto);
    tela.querySelector('.cifra-visor').hidden = !aberto;
  });

  // Imprimir
  tela.querySelector('#btn-imprimir-cifra')
    ?.addEventListener('click', () => window.print());

  // Voltar
  tela.querySelector('#btn-voltar-cifra')
    ?.addEventListener('click', () => { liberarWakeLock(); Router.voltar(); });

  // Swipe horizontal para transpor (gesture mobile)
  _registrarSwipe(tela.querySelector('.cifra-visor'), componente, atualizarUI);
}

/**
 * Registra gesto de swipe horizontal para transpor tom no mobile.
 * Swipe direita = +1 semitom | Swipe esquerda = -1 semitom
 */
function _registrarSwipe(el, componente, cb) {
  if (!el) return;
  let startX = 0;
  const LIMIAR = 60; // px

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) < LIMIAR) return;
    componente.transporPor(delta > 0 ? 1 : -1);
    cb();
  }, { passive: true });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();

  document.addEventListener('7tom:rota-entrada', (ev) => {
    if (ev.detail.rota === 'cifra') renderizar(ev.detail.params);
  });

  document.addEventListener('7tom:rota-saida', (ev) => {
    if (ev.detail.rota === 'cifra') liberarWakeLock();
  });
}

export const TelaCifra = { init, renderizar };
