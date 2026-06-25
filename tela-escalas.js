/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-escalas.js
 *  Baú de Escalas — lista, filtro e criação
 *
 *  Seções:
 *    • Filtro por período (semana atual, próximas 4 semanas, mês)
 *    • Agenda fixa enriquecida (mostra se a escala já foi criada)
 *    • Histórico: escalas passadas (colapsável)
 *    • Gestor: botão "Criar escala" para qualquer item fixo pendente
 *    • Gestor: botão "Nova escala avulsa" para datas extras
 *    • Alerta de músicas repetidas no mesmo dia
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { DB }     from './db.js';
import { Agenda } from './agenda.js';

const ID_TELA = 'tela-escalas';

const IC = Object.freeze({
  mais:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  fechar:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  seta:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  calendario: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  musica:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  aviso:      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  historico:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`,
  lock:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
});

const LABEL_TIPO = Object.freeze({
  'culto':           'Culto',
  'ensaio-oficial':  'Ensaio Oficial',
  'ensaio-extra':    'Ensaio Extra',
  'evento-especial': 'Evento Especial',
  'sabado-manha':    'Sábado manhã',
  'domingo-noite':   'Domingo noite',
  'quarta-noite':    'Quarta noite',
  'ensaio-sexta':    'Sexta (Ensaio)',
});

const BADGE_CLS = Object.freeze({
  'culto':          'badge-culto',
  'ensaio-oficial': 'badge-ensaio',
  'ensaio-extra':   'badge-evento',
  'evento-especial':'badge-evento',
});

/* ─── Períodos de filtro ─── */
const PERIODOS = Object.freeze([
  { valor: 'semana',    label: 'Esta semana' },
  { valor: 'proximo30', label: 'Próximos 30 dias' },
  { valor: 'passados',  label: 'Histórico' },
]);


/* ═══════════════════════════════════════════════════════════════════
   ■ ESTADO LOCAL
═══════════════════════════════════════════════════════════════════ */
const _estado = {
  periodo: 'semana',
};


/* ═══════════════════════════════════════════════════════════════════
   ■ INJEÇÃO NO DOM
═══════════════════════════════════════════════════════════════════ */
function garantirTelaNoDom() {
  if (document.getElementById(ID_TELA)) return;
  const c = document.getElementById('container-app');
  if (!c) return;
  const s = document.createElement('section');
  s.id = ID_TELA;
  s.className = 'tela';
  s.setAttribute('data-tela', 'escalas');
  s.setAttribute('aria-hidden', 'true');
  c.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS DE DATA
═══════════════════════════════════════════════════════════════════ */
function calcularIntervalo(periodo) {
  const hoje  = new Date();
  const iso   = Agenda.paraISO(hoje);

  if (periodo === 'passados') {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 180); // últimos 6 meses
    return { inicio: Agenda.paraISO(inicio), fim: iso };
  }

  if (periodo === 'proximo30') {
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + 30);
    return { inicio: iso, fim: Agenda.paraISO(fim) };
  }

  // semana: segunda–domingo da semana atual
  const diaSemana = hoje.getDay(); // 0=dom
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  return { inicio: Agenda.paraISO(segunda), fim: Agenda.paraISO(domingo) };
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES HTML
═══════════════════════════════════════════════════════════════════ */
function htmlFiltros(podeGer) {
  const botoes = PERIODOS.map(p => `
    <button
      class="filtro-btn ${_estado.periodo === p.valor ? 'filtro-btn-ativo' : ''}"
      type="button"
      data-periodo="${p.valor}"
      aria-pressed="${_estado.periodo === p.valor}"
    >${p.label}</button>
  `).join('');

  return `
    <div class="escalas-barra">
      <div class="filtro-grupo" role="group" aria-label="Filtrar escalas por período">
        ${botoes}
      </div>
      ${podeGer ? `
        <button class="btn-acao-pequeno" id="btn-nova-escala-avulsa"
          type="button" aria-label="Criar escala avulsa">
          ${IC.mais} Nova
        </button>
      ` : ''}
    </div>
  `;
}

function htmlItemEscala(item, podeGer, isoHoje) {
  const temEscala   = item.escalaId !== null;
  const badgeCls    = BADGE_CLS[item.tipo] ?? 'badge-culto';
  const labelTipo   = LABEL_TIPO[item.tipoCulto] ?? LABEL_TIPO[item.tipo] ?? item.tipo;
  const ehHoje      = item.dataISO === isoHoje;
  const ehPassado   = item.dataISO < isoHoje;
  const qtdMusicas  = item.musicaIds?.length ?? 0;

  return `
    <li class="escala-lista-item ${ehHoje ? 'escala-item-hoje' : ''} ${ehPassado ? 'escala-item-passado' : ''}"
      data-item-id="${item.id}">

      <!-- Data lateral -->
      <div class="escala-item-data">
        <span class="agenda-dia-semana">${item.diaSemanaLabel.slice(0,3)}</span>
        <span class="agenda-dia-num">${item.dataISO.slice(8)}</span>
        <span class="escala-item-mes">${Agenda.NOMES_MES[Number(item.dataISO.slice(5,7))-1]}</span>
      </div>

      <!-- Corpo -->
      <div class="escala-item-corpo">
        <div class="escala-item-topo">
          <span class="badge ${badgeCls}">${labelTipo}</span>
          ${ehHoje ? '<span class="badge badge-hoje">Hoje</span>' : ''}
        </div>
        <span class="escala-item-titulo">${item.titulo}</span>
        <span class="escala-item-hora">${item.hora}</span>

        ${temEscala ? `
          <span class="escala-item-musicas">
            ${IC.musica}
            ${qtdMusicas} ${qtdMusicas === 1 ? 'música' : 'músicas'}
          </span>
        ` : `
          <span class="escala-item-pendente">
            Escala não criada
          </span>
        `}
      </div>

      <!-- Ação direita -->
      <div class="escala-item-acao">
        ${temEscala ? `
          <button class="btn-icone escala-item-btn-ver"
            type="button"
            data-navegar="escala"
            data-params='{"id":"${item.escalaId}"}'
            aria-label="Ver escala de ${item.titulo}">
            ${IC.seta}
          </button>
        ` : podeGer ? `
          <button class="btn-acao-pequeno escala-item-btn-criar"
            type="button"
            data-item='${JSON.stringify({ tipo: item.tipo, tipoCulto: item.tipoCulto, titulo: item.titulo, dataISO: item.dataISO, hora: item.hora })}'
            aria-label="Criar escala para ${item.titulo}">
            ${IC.mais} Criar
          </button>
        ` : ''}
      </div>

    </li>
  `;
}

function htmlListaVazia(periodo) {
  const msg = periodo === 'passados'
    ? 'Nenhuma escala no histórico.'
    : 'Nenhum evento neste período.';
  return `<p class="escala-vazio">${msg}</p>`;
}

function htmlAvisoRepeticao(conflitos) {
  if (!conflitos.length) return '';
  return `
    <div class="escala-alerta" role="alert">
      ${IC.aviso}
      <div>
        <strong>Música repetida no mesmo dia!</strong>
        <p style="margin-top:var(--esp-1);font-size:var(--texto-xs)">
          Verifique as escalas desta semana — uma ou mais músicas aparecem em cultos do mesmo dia.
        </p>
      </div>
    </div>
  `;
}

function htmlFormEscalaAvulsa() {
  const hoje = Agenda.paraISO(new Date());
  const TIPOS_CULTO = [
    { valor: 'sabado-manha',  label: 'Culto de Sábado (manhã)' },
    { valor: 'domingo-noite', label: 'Culto de Domingo (noite)' },
    { valor: 'quarta-noite',  label: 'Culto de Quarta (noite)' },
    { valor: 'ensaio-sexta',  label: 'Ensaio Oficial (Sexta)' },
    { valor: 'ensaio-extra',  label: 'Ensaio Extra' },
    { valor: 'evento-especial', label: 'Evento Especial' },
  ];

  return `
    <div class="modal-overlay" id="modal-escala" role="dialog"
      aria-modal="true" aria-labelledby="modal-escala-titulo">
      <div class="modal-caixa">
        <div class="modal-cabecalho">
          <h2 id="modal-escala-titulo">Nova Escala</h2>
          <button class="btn-icone" id="btn-fechar-modal-escala"
            type="button" aria-label="Fechar">${IC.fechar}</button>
        </div>

        <form id="form-escala" novalidate>

          <div class="campo-grupo">
            <label class="campo-label" for="fes-tipo">Tipo de culto *</label>
            <select id="fes-tipo" name="tipoCulto" class="cifra-tom-select">
              ${TIPOS_CULTO.map(t =>
                `<option value="${t.valor}">${t.label}</option>`
              ).join('')}
            </select>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fes-titulo">Título (opcional)</label>
            <input id="fes-titulo" name="titulo" class="campo-input"
              type="text" placeholder="Deixe em branco para usar o padrão"
              autocomplete="off" />
          </div>

          <div class="modal-linha-dupla">
            <div class="campo-grupo">
              <label class="campo-label" for="fes-data">Data *</label>
              <input id="fes-data" name="dataISO" class="campo-input"
                type="date" required min="${hoje}" />
            </div>
            <div class="campo-grupo">
              <label class="campo-label" for="fes-hora">Hora</label>
              <input id="fes-hora" name="horaInicio" class="campo-input"
                type="time" value="09:00" />
            </div>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fes-obs">Observações</label>
            <textarea id="fes-obs" name="observacoes"
              class="campo-input campo-textarea" rows="3"
              placeholder="Anotações para este culto…"></textarea>
          </div>

          <div class="modal-rodape">
            <button type="button" class="btn-secundario"
              id="btn-cancelar-escala">Cancelar</button>
            <button type="submit" class="btn-primario">Criar escala</button>
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

  tela.innerHTML = `<div class="inner-page">
    <div class="dash-skeleton" style="height:52px"></div>
    <div class="dash-skeleton" style="height:300px"></div>
  </div>`;

  try {
    const { inicio, fim } = calcularIntervalo(_estado.periodo);
    const podeGer = Auth.podeGerenciar();
    const isoHoje = Agenda.paraISO(new Date());

    // Para histórico usa só o banco; para futuro usa agenda completa
    let itens;
    if (_estado.periodo === 'passados') {
      const escalasDB = await DB.escalas.listarPorPeriodo(inicio, fim);
      itens = escalasDB.map(e => ({
        id:             `db-${e.id}`,
        tipo:           e.tipo,
        tipoCulto:      e.tipoCulto,
        titulo:         e.titulo || LABEL_TIPO[e.tipoCulto] || e.tipo,
        dataISO:        e.dataISO,
        hora:           e.horaInicio ?? '—',
        diaSemanaLabel: Agenda.NOMES_DIA[Agenda.deISO(e.dataISO).getDay()],
        dataExibicao:   Agenda.formatarDataExibicao(e.dataISO),
        fixo:           false,
        escalaId:       e.id,
        musicaIds:      e.musicaIds ?? [],
      })).sort((a, b) => b.dataISO.localeCompare(a.dataISO)); // mais recente primeiro
    } else {
      itens = await Agenda.agendaCompleta(inicio, fim);
    }

    // Verifica repetições apenas para escalas futuras
    let conflitos = [];
    if (_estado.periodo !== 'passados') {
      const comEscala = itens.filter(i => i.escalaId && i.musicaIds?.length);
      if (comEscala.length > 1) {
        conflitos = Agenda.verificarRepeticoes(
          comEscala.map(i => ({
            dataISO:  i.dataISO,
            titulo:   i.titulo,
            musicaIds: i.musicaIds,
          }))
        );
      }
    }

    const listaHTML = itens.length
      ? `<ul class="escalas-lista" role="list" aria-label="Lista de escalas">
          ${itens.map(i => htmlItemEscala(i, podeGer, isoHoje)).join('')}
         </ul>`
      : htmlListaVazia(_estado.periodo);

    tela.innerHTML = `
      <div class="inner-page escalas-inner">
        <h1 class="dash-secao-titulo">${IC.historico} Escalas</h1>
        ${htmlFiltros(podeGer)}
        ${htmlAvisoRepeticao(conflitos)}
        <div id="escalas-resultado" aria-live="polite">
          ${listaHTML}
        </div>
      </div>
    `;

    _vincularEventos(tela, podeGer);

  } catch (erro) {
    console.error('[TelaEscalas 7° Tom]', erro);
    tela.innerHTML = `<div class="inner-page">
      <p class="dash-erro">${erro.message}</p>
    </div>`;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS
═══════════════════════════════════════════════════════════════════ */
function _vincularEventos(tela, podeGer) {
  // Filtros de período
  tela.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _estado.periodo = btn.dataset.periodo;
      renderizar();
    });
  });

  // Navegar para escala
  tela.querySelectorAll('[data-navegar]').forEach(btn => {
    btn.addEventListener('click', () => {
      let params = {};
      try { if (btn.dataset.params) params = JSON.parse(btn.dataset.params); } catch {}
      Router.navegar(btn.dataset.navegar, params);
    });
  });

  if (!podeGer) return;

  // Criar escala para item fixo pendente
  tela.querySelectorAll('.escala-item-btn-criar').forEach(btn => {
    btn.addEventListener('click', async () => {
      let dadosItem = {};
      try { dadosItem = JSON.parse(btn.dataset.item); } catch {}
      await _criarEscalaRapida(dadosItem);
    });
  });

  // Nova escala avulsa
  tela.querySelector('#btn-nova-escala-avulsa')
    ?.addEventListener('click', () => _abrirModalEscala(tela));
}

/**
 * Cria uma escala para um item fixo com valores padrão.
 */
async function _criarEscalaRapida(item) {
  try {
    const HORAS_PADRAO = {
      'sabado-manha':   '09:00',
      'ensaio-sexta':   '19:30',
      'domingo-noite':  '19:00',
      'quarta-noite':   '19:30',
    };
    const id = await DB.escalas.salvar({
      tipo:        item.tipo ?? 'culto',
      tipoCulto:   item.tipoCulto,
      titulo:      item.titulo,
      dataISO:     item.dataISO,
      horaInicio:  item.hora ?? HORAS_PADRAO[item.tipoCulto] ?? '09:00',
      musicaIds:   [],
      observacoes: '',
    });
    Router.navegar('escala', { id: String(id) });
  } catch (e) {
    console.error('[TelaEscalas] Erro ao criar escala rápida:', e);
  }
}

function _abrirModalEscala(tela) {
  document.getElementById('modal-escala')?.remove();
  tela.insertAdjacentHTML('beforeend', htmlFormEscalaAvulsa());

  const modal = document.getElementById('modal-escala');
  const form  = document.getElementById('form-escala');

  const fechar = () => modal.remove();
  document.getElementById('btn-fechar-modal-escala')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-escala')?.addEventListener('click', fechar);
  modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(form);

    const TITULO_PADRAO = {
      'sabado-manha':   'Culto de Sábado de manhã',
      'domingo-noite':  'Culto de Domingo à noite',
      'quarta-noite':   'Culto de Quarta à noite',
      'ensaio-sexta':   'Ensaio Oficial (Sexta)',
      'ensaio-extra':   'Ensaio Extra',
      'evento-especial':'Evento Especial',
    };

    const tipoCulto = fd.get('tipoCulto');
    const titulo    = (fd.get('titulo') ?? '').trim()
      || TITULO_PADRAO[tipoCulto]
      || 'Nova Escala';

    const dados = {
      tipo:        ['ensaio-extra','evento-especial'].includes(tipoCulto) ? tipoCulto : 'culto',
      tipoCulto,
      titulo,
      dataISO:     fd.get('dataISO'),
      horaInicio:  fd.get('horaInicio') ?? '09:00',
      observacoes: fd.get('observacoes') ?? '',
      musicaIds:   [],
    };

    if (!dados.dataISO) {
      form.querySelector('#fes-data')?.focus();
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Criando…'; }

    try {
      const id = await DB.escalas.salvar(dados);
      fechar();
      Router.navegar('escala', { id: String(id) });
    } catch (e) {
      console.error('[TelaEscalas] Erro ao criar:', e);
      if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
    }
  });

  requestAnimationFrame(() => form?.querySelector('#fes-data')?.focus());
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();
  document.addEventListener('7tom:rota-entrada', ev => {
    if (ev.detail.rota === 'escalas') renderizar();
  });
}

export const TelaEscalas = { init, renderizar };
