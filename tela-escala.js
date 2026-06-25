/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-escala.js
 *  Tela de Escala Individual
 *
 *  Exibe uma escala completa com:
 *    • Cabeçalho: data, tipo de culto, hora
 *    • Lista de músicas na ordem definida (reordenável por gestor)
 *    • Lista de membros alocados com instrumento
 *    • Alerta visual se alguma música se repete no mesmo dia
 *    • Botão "Ver Cifra" em cada música
 *    • Ações do gestor: adicionar/remover música, alocar membro
 *    • Observações do culto
 *
 *  Recebe o parâmetro ?id=<escalaId> via Router.
 *  Se id não existir, tenta carregar pelo tipoCulto+data via hash.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { DB }     from './db.js';
import { Agenda } from './agenda.js';

const ID_TELA = 'tela-escala';

/* ── SVGs inline ── */
const IC = Object.freeze({
  musica:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  usuario:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  seta:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  voltar:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`,
  mais:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  lixo:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  aviso:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  imprimir: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
});

const LABEL_TIPO = Object.freeze({
  'sabado-manha':   'Culto de Sábado',
  'domingo-noite':  'Culto de Domingo',
  'quarta-noite':   'Culto de Quarta',
  'ensaio-sexta':   'Ensaio Oficial',
  'ensaio-extra':   'Ensaio Extra',
  'evento-especial':'Evento Especial',
});


/* ═══════════════════════════════════════════════════════════════════
   ■ INJEÇÃO DA TELA NO DOM
═══════════════════════════════════════════════════════════════════ */
function garantirTelaNoDom() {
  if (document.getElementById(ID_TELA)) return;
  const container = document.getElementById('container-app');
  if (!container) return;
  const s = document.createElement('section');
  s.id = ID_TELA;
  s.className = 'tela';
  s.setAttribute('data-tela', 'escala');
  s.setAttribute('aria-hidden', 'true');
  container.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES HTML
═══════════════════════════════════════════════════════════════════ */

function htmlCabecalho(escala, itemAgenda) {
  const label   = LABEL_TIPO[escala.tipoCulto] ?? escala.tipo;
  const dataBR  = itemAgenda?.dataExibicao ?? Agenda.formatarDataExibicao(escala.dataISO);
  const hora    = escala.horaInicio ?? itemAgenda?.hora ?? '';

  return `
    <div class="escala-cabecalho">
      <button class="btn-icone btn-voltar" id="btn-voltar-escala"
        type="button" aria-label="Voltar">
        ${IC.voltar}
      </button>
      <div class="escala-cab-info">
        <span class="escala-cab-label">${label}</span>
        <h1 class="escala-cab-titulo">${escala.titulo || label}</h1>
        <p class="escala-cab-meta">${dataBR}${hora ? ' · ' + hora : ''}</p>
      </div>
      <button class="btn-icone" id="btn-imprimir-escala"
        type="button" aria-label="Imprimir escala">
        ${IC.imprimir}
      </button>
    </div>
  `;
}

function htmlAlertas(alertas) {
  if (!alertas.length) return '';
  const items = alertas.map(a =>
    `<li>Música ID <strong>${a.musicaId}</strong> aparece em mais de uma escala hoje.</li>`
  ).join('');
  return `
    <div class="escala-alerta" role="alert">
      ${IC.aviso}
      <div>
        <strong>Atenção:</strong> músicas repetidas no mesmo dia.
        <ul class="escala-alerta-lista">${items}</ul>
      </div>
    </div>
  `;
}

function htmlItemMusica(musica, idx, podeGerenciar, idEscala) {
  const tom = musica.tom ? `<span class="musica-tom">${musica.tom}</span>` : '';
  return `
    <li class="escala-musica-item" data-musica-id="${musica.id}" data-idx="${idx}">
      <span class="escala-musica-num">${idx + 1}</span>
      <div class="escala-musica-info">
        <span class="escala-musica-titulo">${musica.titulo}</span>
        <span class="escala-musica-autor">${musica.autor || ''}${tom}</span>
      </div>
      <div class="escala-musica-acoes">
        <button class="btn-link escala-btn-cifra"
          type="button"
          data-navegar="cifra"
          data-params='{"id":"${musica.id}","escalaId":"${idEscala}"}'
          aria-label="Ver cifra de ${musica.titulo}">
          Cifra ${IC.seta}
        </button>
        ${podeGerenciar ? `
          <button class="btn-icone btn-icone-perigoso escala-btn-remover-musica"
            type="button"
            data-escala-id="${idEscala}"
            data-musica-id="${musica.id}"
            aria-label="Remover ${musica.titulo} da escala">
            ${IC.lixo}
          </button>
        ` : ''}
      </div>
    </li>
  `;
}

function htmlSecaoMusicas(musicas, podeGerenciar, idEscala) {
  const lista = musicas.length
    ? `<ol class="escala-musicas-lista" role="list" aria-label="Músicas da escala">
        ${musicas.map((m, i) => htmlItemMusica(m, i, podeGerenciar, idEscala)).join('')}
       </ol>`
    : `<p class="escala-vazio">Nenhuma música adicionada ainda.</p>`;

  return `
    <section class="escala-secao" aria-labelledby="titulo-musicas">
      <div class="escala-secao-header">
        <h2 id="titulo-musicas" class="escala-secao-titulo">
          ${IC.musica} Músicas
          <span class="escala-secao-contagem">${musicas.length}</span>
        </h2>
        ${podeGerenciar ? `
          <button class="btn-acao-pequeno" id="btn-adicionar-musica"
            type="button" aria-label="Adicionar música à escala">
            ${IC.mais} Adicionar
          </button>
        ` : ''}
      </div>
      ${lista}
    </section>
  `;
}

function htmlItemMembro(alocacao, usuario) {
  const nome       = usuario?.nome ?? `CPF ${alocacao.cpf}`;
  const instrumento = alocacao.instrumento || 'Não definido';
  const iniciais   = nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return `
    <li class="escala-membro-item" data-cpf="${alocacao.cpf}">
      <span class="membro-avatar" aria-hidden="true">${iniciais}</span>
      <div class="membro-info">
        <span class="membro-nome">${nome}</span>
        <span class="membro-instrumento">${instrumento}</span>
      </div>
    </li>
  `;
}

function htmlSecaoEquipe(alocacoes, usuarios, podeGerenciar, idEscala) {
  const lista = alocacoes.length
    ? `<ul class="escala-membros-lista" role="list" aria-label="Membros escalados">
        ${alocacoes.map(a => {
          const u = usuarios.find(u => u.cpf === a.cpf);
          return htmlItemMembro(a, u);
        }).join('')}
       </ul>`
    : `<p class="escala-vazio">Nenhum membro alocado ainda.</p>`;

  return `
    <section class="escala-secao" aria-labelledby="titulo-equipe">
      <div class="escala-secao-header">
        <h2 id="titulo-equipe" class="escala-secao-titulo">
          ${IC.usuario} Equipe
          <span class="escala-secao-contagem">${alocacoes.length}</span>
        </h2>
        ${podeGerenciar ? `
          <button class="btn-acao-pequeno" id="btn-alocar-membro"
            type="button" aria-label="Alocar membro à escala">
            ${IC.mais} Alocar
          </button>
        ` : ''}
      </div>
      ${lista}
    </section>
  `;
}

function htmlObservacoes(obs, podeGerenciar, idEscala) {
  if (!obs && !podeGerenciar) return '';
  return `
    <section class="escala-secao escala-obs" aria-labelledby="titulo-obs">
      <h2 id="titulo-obs" class="escala-secao-titulo">Observações</h2>
      ${podeGerenciar ? `
        <textarea
          id="campo-observacoes"
          class="campo-input campo-textarea"
          rows="4"
          placeholder="Anotações para este culto…"
          aria-label="Observações da escala"
          data-escala-id="${idEscala}"
        >${obs || ''}</textarea>
        <button class="btn-primario btn-salvar-obs" id="btn-salvar-obs"
          type="button" data-escala-id="${idEscala}">
          Salvar observações
        </button>
      ` : `
        <p class="escala-obs-texto">${obs}</p>
      `}
    </section>
  `;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CARREGAMENTO E RENDERIZAÇÃO
═══════════════════════════════════════════════════════════════════ */
async function renderizar(params = {}) {
  const tela = document.getElementById(ID_TELA);
  if (!tela) return;

  const escalaId = params.id ? Number(params.id) : null;

  tela.innerHTML = `
    <div class="inner-page">
      <div class="dash-skeleton" style="height:80px;border-radius:var(--raio-lg)"></div>
      <div class="dash-skeleton" style="height:200px;border-radius:var(--raio-lg)"></div>
      <div class="dash-skeleton" style="height:160px;border-radius:var(--raio-lg)"></div>
    </div>`;

  try {
    if (!escalaId) throw new Error('ID de escala não fornecido.');

    // Carrega escala, alocações e dados das músicas em paralelo
    const [escala, alocacoesRaw] = await Promise.all([
      DB.escalas.buscarPorId(escalaId),
      DB.alocacoes.buscarPorEscala(escalaId),
    ]);

    if (!escala) throw new Error('Escala não encontrada.');

    // Carrega músicas e usuários em paralelo
    const [musicas, usuarios] = await Promise.all([
      Promise.all((escala.musicaIds ?? []).map(id => DB.musicas.buscarPorId(id))),
      Auth.podeGerenciar() ? DB.usuarios.listarTodos() : Promise.resolve([]),
    ]);

    const musicasValidas = musicas.filter(Boolean);

    // Verifica repetições no mesmo dia
    const isoHoje = Agenda.paraISO(new Date());
    const escalasHoje = escala.dataISO === isoHoje
      ? await DB.escalas.listarPorPeriodo(escala.dataISO, escala.dataISO)
      : [];

    const alertas = escalasHoje.length > 1
      ? Agenda.verificarRepeticoes(escalasHoje.map(e => ({
          dataISO:  e.dataISO,
          titulo:   e.titulo,
          musicaIds: e.musicaIds ?? [],
        })))
      : [];

    const podeGer = Auth.podeGerenciar();

    const html = `
      <div class="inner-page escala-inner">
        ${htmlCabecalho(escala, null)}
        ${htmlAlertas(alertas)}
        ${htmlSecaoMusicas(musicasValidas, podeGer, escalaId)}
        ${htmlSecaoEquipe(alocacoesRaw, usuarios, podeGer, escalaId)}
        ${htmlObservacoes(escala.observacoes, podeGer, escalaId)}
      </div>
    `;

    tela.innerHTML = html;
    _vincularEventos(tela, escala);

  } catch (erro) {
    console.error('[TelaEscala 7° Tom]', erro);
    tela.innerHTML = `
      <div class="inner-page">
        <button class="btn-link" id="btn-voltar-erro" type="button">
          ${IC.voltar} Voltar
        </button>
        <p class="dash-erro">${erro.message}</p>
      </div>`;
    document.getElementById('btn-voltar-erro')
      ?.addEventListener('click', () => Router.voltar(), { once: true });
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS
═══════════════════════════════════════════════════════════════════ */
function _vincularEventos(tela, escala) {
  // Voltar
  tela.querySelector('#btn-voltar-escala')
    ?.addEventListener('click', () => Router.voltar());

  // Imprimir
  tela.querySelector('#btn-imprimir-escala')
    ?.addEventListener('click', () => window.print());

  // Navegar (cifra, etc.)
  tela.querySelectorAll('[data-navegar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rota = btn.dataset.navegar;
      let params = {};
      try { if (btn.dataset.params) params = JSON.parse(btn.dataset.params); } catch {}
      Router.navegar(rota, params);
    });
  });

  // Remover música (gestor)
  tela.querySelectorAll('.escala-btn-remover-musica').forEach(btn => {
    btn.addEventListener('click', async () => {
      const escId   = Number(btn.dataset.escalaId);
      const musId   = Number(btn.dataset.musicaId);
      const escala  = await DB.escalas.buscarPorId(escId);
      if (!escala) return;
      escala.musicaIds = (escala.musicaIds ?? []).filter(id => id !== musId);
      await DB.escalas.salvar(escala);
      renderizar({ id: String(escId) });
    });
  });

  // Salvar observações
  tela.querySelector('#btn-salvar-obs')?.addEventListener('click', async (ev) => {
    const escId = Number(ev.target.dataset.escalaId);
    const obs   = tela.querySelector('#campo-observacoes')?.value ?? '';
    const escala = await DB.escalas.buscarPorId(escId);
    if (!escala) return;
    escala.observacoes = obs;
    await DB.escalas.salvar(escala);
    _mostrarFeedback(ev.target, 'Salvo!');
  });
}

function _mostrarFeedback(btn, msg) {
  const original = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1800);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();
  document.addEventListener('7tom:rota-entrada', (ev) => {
    if (ev.detail.rota === 'escala') renderizar(ev.detail.params);
  });
}

export const TelaEscala = { init, renderizar };
