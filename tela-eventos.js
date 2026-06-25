/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-eventos.js
 *  Tela de Eventos Dinâmicos
 *
 *  Exibe ensaios extras e eventos especiais criados pelo líder.
 *  A confirmação de presença é 100% voluntária — sem coerção.
 *
 *  Para membros:
 *    • Lista de eventos futuros com data, hora, local
 *    • Botões de resposta: Vou / Talvez / Não posso
 *    • Contagem de confirmados exibida publicamente
 *    • Mensagem opcional junto à resposta
 *
 *  Para gestores (diretor/associado):
 *    • Tudo acima +
 *    • Formulário de criação de evento
 *    • Encerrar inscrições (aberto → fechado)
 *    • Ver lista de quem confirmou
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { DB }     from './db.js';
import { Agenda } from './agenda.js';

const ID_TELA = 'tela-eventos';

const IC = Object.freeze({
  mais:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  fechar:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  calendario: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  local:      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  equipe:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  check:      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  lock:       `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  evento:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
});

const STATUS_LABEL = Object.freeze({
  'confirmado': 'Vou',
  'talvez':     'Talvez',
  'nao-posso':  'Não posso',
});

const STATUS_CLASSE = Object.freeze({
  'confirmado': 'resposta-confirmado',
  'talvez':     'resposta-talvez',
  'nao-posso':  'resposta-nao',
});

const STATUS_ICONE = Object.freeze({
  'confirmado': IC.check,
  'talvez':     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  'nao-posso':  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
});


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
  s.setAttribute('data-tela', 'eventos');
  s.setAttribute('aria-hidden', 'true');
  c.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES HTML
═══════════════════════════════════════════════════════════════════ */

/**
 * Card de um evento individual.
 * @param {Object}      evento
 * @param {Object|null} minhaResposta — resposta do usuário logado (ou null)
 * @param {number}      totalConfirmados
 * @param {boolean}     podeGer
 * @param {Object[]}    respostas — todas as respostas (para gestores)
 */
function htmlCardEvento(evento, minhaResposta, totalConfirmados, podeGer, respostas) {
  const tipoLabel = evento.tipo === 'ensaio-extra' ? 'Ensaio Extra' : 'Evento Especial';
  const badgeCls  = evento.tipo === 'ensaio-extra' ? 'badge-ensaio' : 'badge-evento';
  const encerrado = !evento.aberto;

  /* Botões de resposta */
  const botoesResposta = encerrado
    ? `<p class="evento-encerrado">${IC.lock} Inscrições encerradas</p>`
    : `
      <div class="evento-respostas-btns" role="group" aria-label="Sua resposta">
        ${['confirmado', 'talvez', 'nao-posso'].map(s => `
          <button
            class="btn-resposta ${STATUS_CLASSE[s]} ${minhaResposta?.status === s ? 'btn-resposta-ativo' : ''}"
            type="button"
            data-evento-id="${evento.id}"
            data-status="${s}"
            aria-pressed="${minhaResposta?.status === s}"
            aria-label="${STATUS_LABEL[s]}"
          >
            ${STATUS_ICONE[s]} ${STATUS_LABEL[s]}
          </button>
        `).join('')}
      </div>
      ${minhaResposta && minhaResposta.status !== 'nao-posso' ? `
        <p class="evento-resposta-confirmada">
          ${IC.check} Sua presença está registrada como
          <strong>${STATUS_LABEL[minhaResposta.status]}</strong>.
        </p>
      ` : ''}
    `;

  /* Lista de confirmados (só gestor vê lista completa) */
  const listaConfirmados = podeGer && respostas.length
    ? `
      <details class="evento-detalhes-respostas">
        <summary class="evento-respostas-summary">
          Ver ${respostas.length} ${respostas.length === 1 ? 'resposta' : 'respostas'}
        </summary>
        <ul class="evento-respostas-lista">
          ${respostas.map(r => `
            <li class="evento-resposta-item">
              <span class="evento-resposta-cpf">${r.cpf}</span>
              <span class="badge ${STATUS_CLASSE[r.status]}">${STATUS_LABEL[r.status]}</span>
              ${r.mensagem ? `<span class="evento-resposta-msg">"${r.mensagem}"</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </details>
    `
    : '';

  /* Ações do gestor */
  const acoesGestor = podeGer
    ? `
      <div class="evento-acoes-gestor">
        ${evento.aberto ? `
          <button class="btn-acao-pequeno btn-encerrar-inscricoes"
            type="button" data-evento-id="${evento.id}"
            aria-label="Encerrar inscrições para ${evento.titulo}">
            ${IC.lock} Encerrar inscrições
          </button>
        ` : ''}
      </div>
    `
    : '';

  return `
    <article class="evento-card ${encerrado ? 'evento-card-encerrado' : ''}"
      data-evento-id="${evento.id}" aria-label="${evento.titulo}">

      <div class="evento-card-topo">
        <span class="badge ${badgeCls}">${tipoLabel}</span>
        <div class="evento-confirmados">
          ${IC.equipe}
          <span>${totalConfirmados} ${totalConfirmados === 1 ? 'confirmado' : 'confirmados'}</span>
        </div>
      </div>

      <h2 class="evento-titulo">${evento.titulo}</h2>

      <div class="evento-meta">
        <span class="dash-meta-item">
          ${IC.calendario}
          ${evento.dataExibicao} · ${evento.hora ?? evento.horaInicio}
        </span>
        ${evento.local ? `
          <span class="dash-meta-item">
            ${IC.local} ${evento.local}
          </span>
        ` : ''}
      </div>

      ${evento.descricao ? `<p class="evento-descricao">${evento.descricao}</p>` : ''}

      <div class="evento-resposta-area">
        ${botoesResposta}
      </div>

      ${listaConfirmados}
      ${acoesGestor}

    </article>
  `;
}

function htmlFormEvento() {
  const hoje = Agenda.paraISO(new Date());
  return `
    <div class="modal-overlay" id="modal-evento" role="dialog"
      aria-modal="true" aria-labelledby="modal-evento-titulo">
      <div class="modal-caixa">
        <div class="modal-cabecalho">
          <h2 id="modal-evento-titulo">Criar Evento</h2>
          <button class="btn-icone" id="btn-fechar-modal-evento"
            type="button" aria-label="Fechar">${IC.fechar}</button>
        </div>

        <form id="form-evento" novalidate>

          <div class="campo-grupo">
            <label class="campo-label" for="fev-tipo">Tipo *</label>
            <select id="fev-tipo" name="tipo" class="cifra-tom-select">
              <option value="ensaio-extra">Ensaio Extra</option>
              <option value="evento-especial">Evento Especial</option>
            </select>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fev-titulo">Título *</label>
            <input id="fev-titulo" name="titulo" class="campo-input"
              type="text" required placeholder="Ex: Ensaio pós-culto de quarta"
              autocomplete="off" />
          </div>

          <div class="modal-linha-dupla">
            <div class="campo-grupo">
              <label class="campo-label" for="fev-data">Data *</label>
              <input id="fev-data" name="dataISO" class="campo-input"
                type="date" required min="${hoje}" />
            </div>
            <div class="campo-grupo">
              <label class="campo-label" for="fev-hora">Hora *</label>
              <input id="fev-hora" name="horaInicio" class="campo-input"
                type="time" required value="19:30" />
            </div>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fev-local">Local</label>
            <input id="fev-local" name="local" class="campo-input"
              type="text" placeholder="Ex: Templo principal, Sala dos jovens…"
              autocomplete="off" />
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fev-descricao">Descrição / observações</label>
            <textarea id="fev-descricao" name="descricao"
              class="campo-input campo-textarea" rows="3"
              placeholder="Detalhes adicionais para a equipe…"></textarea>
          </div>

          <div class="modal-rodape">
            <button type="button" class="btn-secundario" id="btn-cancelar-evento">Cancelar</button>
            <button type="submit" class="btn-primario">Criar evento</button>
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
    <div class="dash-skeleton" style="height:260px"></div>
    <div class="dash-skeleton" style="height:220px"></div>
  </div>`;

  try {
    const [eventosBrutos, minhasRespostasBrutos] = await Promise.all([
      DB.eventos.listarFuturos(),
      Auth.usuario ? DB.respostas.buscarPorUsuario(Auth.usuario.cpf) : Promise.resolve([]),
    ]);

    // Enriquece eventos com data de exibição
    const eventos = eventosBrutos.map(e => ({
      ...e,
      dataExibicao: Agenda.formatarDataExibicao(e.dataISO),
    }));

    // Mapa: eventoId → minha resposta
    const mapaMinhas = new Map(minhasRespostasBrutos.map(r => [r.eventoId, r]));

    // Para cada evento, carrega respostas (total + lista para gestores)
    const podeGer = Auth.podeGerenciar();
    const dadosEventos = await Promise.all(eventos.map(async ev => {
      const todasRespostas = await DB.respostas.buscarPorEvento(ev.id);
      const confirmados    = todasRespostas.filter(r => r.status === 'confirmado').length;
      return {
        evento:            ev,
        minhaResposta:     mapaMinhas.get(ev.id) ?? null,
        totalConfirmados:  confirmados,
        respostas:         podeGer ? todasRespostas : [],
      };
    }));

    const podeGerenciar = Auth.podeGerenciar();

    const listaHTML = dadosEventos.length
      ? dadosEventos.map(({ evento, minhaResposta, totalConfirmados, respostas }) =>
          htmlCardEvento(evento, minhaResposta, totalConfirmados, podeGerenciar, respostas)
        ).join('')
      : `<div class="dash-card vazio" style="margin-top:var(--esp-4)">
           <p class="dash-card-vazio-texto">Nenhum evento próximo. Tudo tranquilo! 🎵</p>
         </div>`;

    tela.innerHTML = `
      <div class="inner-page eventos-inner">
        <div class="escala-secao-header" style="margin-bottom:var(--esp-2)">
          <h1 class="dash-secao-titulo">Eventos
            <span class="escala-secao-contagem">${eventos.length}</span>
          </h1>
          ${podeGerenciar ? `
            <button class="btn-acao-pequeno" id="btn-novo-evento"
              type="button" aria-label="Criar novo evento">
              ${IC.mais} Criar
            </button>
          ` : ''}
        </div>

        <p class="campo-dica" style="margin-bottom:var(--esp-2)">
          Confirme sua presença voluntariamente. Não há cobrança.
        </p>

        <div id="eventos-lista" aria-live="polite">
          ${listaHTML}
        </div>
      </div>
    `;

    _vincularEventos(tela, dadosEventos);

  } catch (erro) {
    console.error('[TelaEventos 7° Tom]', erro);
    tela.innerHTML = `<div class="inner-page"><p class="dash-erro">${erro.message}</p></div>`;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS
═══════════════════════════════════════════════════════════════════ */
function _vincularEventos(tela, dadosEventos) {
  // Criar evento (gestor)
  tela.querySelector('#btn-novo-evento')?.addEventListener('click', () => {
    _abrirModalEvento(tela);
  });

  // Botões de resposta
  tela.querySelectorAll('.btn-resposta').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!Auth.usuario) return;

      const eventoId = Number(btn.dataset.eventoId);
      const status   = btn.dataset.status;

      // Toggle: clicar na resposta ativa a remove
      const dados = dadosEventos.find(d => d.evento.id === eventoId);
      const jaAtivo = dados?.minhaResposta?.status === status;

      try {
        if (jaAtivo) {
          await DB.respostas.remover(eventoId, Auth.usuario.cpf);
        } else {
          await Agenda.responderEvento({
            eventoId,
            cpf:    Auth.usuario.cpf,
            status,
          });
        }
        // Re-renderiza apenas este card
        renderizar();
      } catch (e) {
        console.error('[TelaEventos] Falha ao registrar resposta:', e);
      }
    });
  });

  // Encerrar inscrições (gestor)
  tela.querySelectorAll('.btn-encerrar-inscricoes').forEach(btn => {
    btn.addEventListener('click', async () => {
      const eventoId = Number(btn.dataset.eventoId);
      const ev       = await DB.eventos.buscarPorId(eventoId);
      if (!ev) return;
      ev.aberto = false;
      await DB.eventos.salvar(ev);
      renderizar();
    });
  });
}

function _abrirModalEvento(tela) {
  document.getElementById('modal-evento')?.remove();
  tela.insertAdjacentHTML('beforeend', htmlFormEvento());

  const modal = document.getElementById('modal-evento');
  const form  = document.getElementById('form-evento');

  const fechar = () => modal.remove();
  document.getElementById('btn-fechar-modal-evento')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-evento')?.addEventListener('click', fechar);
  modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(form);

    const dados = {
      tipo:       fd.get('tipo'),
      titulo:     (fd.get('titulo') ?? '').trim(),
      dataISO:    fd.get('dataISO'),
      horaInicio: fd.get('horaInicio'),
      local:      (fd.get('local') ?? '').trim(),
      descricao:  (fd.get('descricao') ?? '').trim(),
      criadorCPF: Auth.usuario?.cpf ?? '',
      aberto:     true,
    };

    if (!dados.titulo || !dados.dataISO || !dados.horaInicio) {
      form.querySelector('[required]:invalid')?.focus();
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Criando…'; }

    try {
      await Agenda.criarEventoDinamico(dados);
      fechar();
      renderizar();
    } catch (e) {
      console.error('[TelaEventos] Erro ao criar evento:', e);
      if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
    }
  });

  requestAnimationFrame(() => form?.querySelector('#fev-titulo')?.focus());
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();
  document.addEventListener('7tom:rota-entrada', ev => {
    if (ev.detail.rota === 'eventos') renderizar();
  });
}

export const TelaEventos = { init, renderizar };
