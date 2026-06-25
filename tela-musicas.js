/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-musicas.js
 *  Catálogo de Músicas
 *
 *  Funcionalidades:
 *    • Lista todas as músicas do banco local
 *    • Busca em tempo real por título ou autor
 *    • Filtro por tom
 *    • Card de cada música: título, autor, tom, tags
 *    • Gestor: formulário de cadastro/edição de música
 *    • Gestor: remoção de música (com confirmação)
 *    • Acesso direto à cifra por cada card
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { DB }     from './db.js';
import { Cifras } from './cifras.js';

const ID_TELA = 'tela-musicas';

const IC = Object.freeze({
  busca:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  mais:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  cifra:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  lixo:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  editar:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  fechar:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
});


/* ═══════════════════════════════════════════════════════════════════
   ■ ESTADO LOCAL DA TELA
═══════════════════════════════════════════════════════════════════ */
const _estado = {
  todas:    [],   // todas as músicas carregadas
  filtradas:[],   // músicas após filtro/busca
  termoBusca: '',
  tomFiltro:  '',
};


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
  s.setAttribute('data-tela', 'musicas');
  s.setAttribute('aria-hidden', 'true');
  c.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ FILTROS
═══════════════════════════════════════════════════════════════════ */
function normalizar(str) {
  return (str ?? '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
}

function aplicarFiltros() {
  const termo = normalizar(_estado.termoBusca);
  const tom   = _estado.tomFiltro;

  _estado.filtradas = _estado.todas.filter(m => {
    const matchTermo = !termo
      || normalizar(m.titulo).includes(termo)
      || normalizar(m.autor).includes(termo);
    const matchTom = !tom || m.tom === tom;
    return matchTermo && matchTom;
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES HTML
═══════════════════════════════════════════════════════════════════ */
function htmlBarraFiltros(podeGer) {
  const optsTom = ['', ...Cifras.TONS_DISPONIVEIS]
    .map(t => `<option value="${t}"${t === _estado.tomFiltro ? ' selected' : ''}>${t || 'Todos os tons'}</option>`)
    .join('');

  return `
    <div class="musicas-barra">
      <div class="campo-input-wrapper musicas-busca-wrapper">
        <span class="campo-icone campo-icone-esquerda">${IC.busca}</span>
        <input
          id="input-busca-musica"
          class="campo-input campo-input-com-icone"
          type="search"
          placeholder="Buscar por título ou autor…"
          value="${_estado.termoBusca}"
          aria-label="Buscar músicas"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <select id="select-tom-filtro" class="cifra-tom-select" aria-label="Filtrar por tom">
        ${optsTom}
      </select>
      ${podeGer ? `
        <button class="btn-acao-pequeno btn-nova-musica" id="btn-nova-musica"
          type="button" aria-label="Cadastrar nova música">
          ${IC.mais} Nova
        </button>
      ` : ''}
    </div>
  `;
}

function htmlCardMusica(m, podeGer) {
  const tags = (m.tags ?? []).map(t =>
    `<span class="musica-tag">${t}</span>`
  ).join('');

  return `
    <li class="musica-card" data-id="${m.id}">
      <div class="musica-card-corpo">
        <div class="musica-card-info">
          <span class="musica-card-titulo">${m.titulo}</span>
          <span class="musica-card-autor">${m.autor || '—'}</span>
          ${tags ? `<div class="musica-card-tags">${tags}</div>` : ''}
        </div>
        ${m.tom ? `<span class="musica-tom musica-tom-destaque">${m.tom}</span>` : ''}
      </div>
      <div class="musica-card-acoes">
        <button class="btn-link btn-ver-cifra" type="button"
          data-navegar="cifra" data-params='{"id":"${m.id}"}'
          aria-label="Ver cifra de ${m.titulo}">
          ${IC.cifra} Cifra
        </button>
        ${podeGer ? `
          <button class="btn-icone btn-editar-musica" type="button"
            data-id="${m.id}" aria-label="Editar ${m.titulo}">
            ${IC.editar}
          </button>
          <button class="btn-icone btn-icone-perigoso btn-remover-musica" type="button"
            data-id="${m.id}" data-titulo="${m.titulo}" aria-label="Remover ${m.titulo}">
            ${IC.lixo}
          </button>
        ` : ''}
      </div>
    </li>
  `;
}

function htmlListaMusicas(podeGer) {
  if (!_estado.filtradas.length) {
    return `<p class="escala-vazio" id="musicas-vazio">
      ${_estado.termoBusca || _estado.tomFiltro
        ? 'Nenhuma música encontrada para este filtro.'
        : 'Nenhuma música cadastrada ainda.'}
    </p>`;
  }
  return `
    <ul class="musicas-lista" role="list" aria-label="Lista de músicas"
      aria-live="polite" aria-atomic="false">
      ${_estado.filtradas.map(m => htmlCardMusica(m, podeGer)).join('')}
    </ul>
  `;
}

function htmlFormMusica(musica = null) {
  const edit = !!musica;
  const v    = musica ?? {};
  return `
    <div class="modal-overlay" id="modal-musica" role="dialog"
      aria-modal="true" aria-labelledby="modal-musica-titulo">
      <div class="modal-caixa">
        <div class="modal-cabecalho">
          <h2 id="modal-musica-titulo">${edit ? 'Editar Música' : 'Nova Música'}</h2>
          <button class="btn-icone" id="btn-fechar-modal" type="button" aria-label="Fechar">
            ${IC.fechar}
          </button>
        </div>
        <form id="form-musica" novalidate>
          <input type="hidden" name="id" value="${v.id ?? ''}">

          <div class="campo-grupo">
            <label class="campo-label" for="fm-titulo">Título *</label>
            <input id="fm-titulo" name="titulo" class="campo-input"
              type="text" required value="${v.titulo ?? ''}"
              placeholder="Nome da música" autocomplete="off"/>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fm-autor">Autor / Banda</label>
            <input id="fm-autor" name="autor" class="campo-input"
              type="text" value="${v.autor ?? ''}"
              placeholder="Ex: Ministério Ipiranga" autocomplete="off"/>
          </div>

          <div class="modal-linha-dupla">
            <div class="campo-grupo">
              <label class="campo-label" for="fm-tom">Tom original</label>
              <select id="fm-tom" name="tom" class="cifra-tom-select">
                <option value="">—</option>
                ${Cifras.TONS_DISPONIVEIS.map(t =>
                  `<option value="${t}"${t === (v.tom ?? '') ? ' selected' : ''}>${t}</option>`
                ).join('')}
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-label" for="fm-tags">Tags</label>
              <input id="fm-tags" name="tags" class="campo-input"
                type="text" value="${(v.tags ?? []).join(', ')}"
                placeholder="adoração, comunhão…"/>
            </div>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fm-cifra">Cifra</label>
            <textarea id="fm-cifra" name="cifra" class="campo-input campo-textarea"
              rows="10" placeholder="Cole ou digite a cifra aqui…
[G]Bênção da [Em]paz de Deus…"
              spellcheck="false">${v.cifra ?? ''}</textarea>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fm-pdf">URL da partitura (PDF)</label>
            <input id="fm-pdf" name="urlPartitura" class="campo-input"
              type="url" value="${v.urlPartitura ?? ''}"
              placeholder="https://…/partitura.pdf"/>
          </div>

          <div class="modal-rodape">
            <button type="button" class="btn-secundario" id="btn-cancelar-modal">Cancelar</button>
            <button type="submit" class="btn-primario" id="btn-salvar-musica">
              ${edit ? 'Salvar alterações' : 'Cadastrar música'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ RENDERIZAÇÃO PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
async function renderizar() {
  const tela = document.getElementById(ID_TELA);
  if (!tela) return;

  tela.innerHTML = `
    <div class="inner-page">
      <div class="dash-skeleton" style="height:52px"></div>
      <div class="dash-skeleton" style="height:340px"></div>
    </div>`;

  try {
    _estado.todas = await DB.musicas.listarTodas();
    aplicarFiltros();

    const podeGer = Auth.podeGerenciar();

    tela.innerHTML = `
      <div class="inner-page musicas-inner">
        <h1 class="dash-secao-titulo">Músicas
          <span class="escala-secao-contagem">${_estado.todas.length}</span>
        </h1>
        ${htmlBarraFiltros(podeGer)}
        <div id="musicas-resultado">
          ${htmlListaMusicas(podeGer)}
        </div>
      </div>
    `;

    _vincularEventos(tela, podeGer);

  } catch (erro) {
    console.error('[TelaMusicas 7° Tom]', erro);
    tela.innerHTML = `<div class="inner-page"><p class="dash-erro">${erro.message}</p></div>`;
  }
}

/** Apenas reaplica filtro e atualiza a lista, sem recarregar tudo */
function _atualizarLista(podeGer) {
  aplicarFiltros();
  const resultado = document.getElementById('musicas-resultado');
  if (resultado) {
    resultado.innerHTML = htmlListaMusicas(podeGer);
    _vincularListaEventos(resultado, podeGer);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS
═══════════════════════════════════════════════════════════════════ */
function _vincularEventos(tela, podeGer) {
  let timerBusca;

  // Busca com debounce
  tela.querySelector('#input-busca-musica')?.addEventListener('input', ev => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => {
      _estado.termoBusca = ev.target.value;
      _atualizarLista(podeGer);
    }, 260);
  });

  // Filtro por tom
  tela.querySelector('#select-tom-filtro')?.addEventListener('change', ev => {
    _estado.tomFiltro = ev.target.value;
    _atualizarLista(podeGer);
  });

  // Nova música
  tela.querySelector('#btn-nova-musica')?.addEventListener('click', () => {
    _abrirModal(tela, null, podeGer);
  });

  _vincularListaEventos(tela.querySelector('#musicas-resultado'), podeGer);
}

function _vincularListaEventos(container, podeGer) {
  if (!container) return;

  // Navegar para cifra
  container.querySelectorAll('[data-navegar]').forEach(btn => {
    btn.addEventListener('click', () => {
      let params = {};
      try { if (btn.dataset.params) params = JSON.parse(btn.dataset.params); } catch {}
      Router.navegar(btn.dataset.navegar, params);
    });
  });

  if (!podeGer) return;

  // Editar
  container.querySelectorAll('.btn-editar-musica').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = await DB.musicas.buscarPorId(Number(btn.dataset.id));
      if (m) _abrirModal(document.getElementById(ID_TELA), m, podeGer);
    });
  });

  // Remover
  container.querySelectorAll('.btn-remover-musica').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirma = window.confirm(
        `Remover "${btn.dataset.titulo}" do catálogo? Esta ação não pode ser desfeita.`
      );
      if (!confirma) return;
      await DB.musicas.remover(Number(btn.dataset.id));
      _estado.todas = _estado.todas.filter(m => m.id !== Number(btn.dataset.id));
      _atualizarLista(podeGer);
    });
  });
}

function _abrirModal(tela, musica, podeGer) {
  // Remove modal anterior se existir
  document.getElementById('modal-musica')?.remove();
  tela.insertAdjacentHTML('beforeend', htmlFormMusica(musica));

  const modal = document.getElementById('modal-musica');
  const form  = document.getElementById('form-musica');

  const fechar = () => modal.remove();

  document.getElementById('btn-fechar-modal')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-modal')?.addEventListener('click', fechar);
  modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd     = new FormData(form);
    const id     = fd.get('id') ? Number(fd.get('id')) : undefined;
    const tagsRaw = (fd.get('tags') ?? '').split(',').map(t => t.trim()).filter(Boolean);

    const dados = {
      ...(id ? { id } : {}),
      titulo:       (fd.get('titulo') ?? '').trim(),
      autor:        (fd.get('autor')  ?? '').trim(),
      tom:          fd.get('tom') ?? '',
      cifra:        fd.get('cifra') ?? '',
      urlPartitura: fd.get('urlPartitura') ?? '',
      tags:         tagsRaw,
    };

    if (!dados.titulo) {
      form.querySelector('#fm-titulo')?.classList.add('estado-erro');
      form.querySelector('#fm-titulo')?.focus();
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-musica');
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando…'; }

    try {
      await DB.musicas.salvar(dados);
      _estado.todas = await DB.musicas.listarTodas();
      _atualizarLista(podeGer);
      fechar();
    } catch (e) {
      console.error('[TelaMusicas] Erro ao salvar:', e);
      if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Tentar novamente'; }
    }
  });

  // Foco no primeiro campo
  requestAnimationFrame(() => document.getElementById('fm-titulo')?.focus());
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();
  document.addEventListener('7tom:rota-entrada', ev => {
    if (ev.detail.rota === 'musicas') renderizar();
  });
}

export const TelaMusicas = { init, renderizar };
