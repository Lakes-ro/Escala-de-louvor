/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-equipe.js
 *  Gestão da Equipe de Louvor
 *  Acesso restrito: diretor e associado (mesmos privilégios locais)
 *
 *  Funcionalidades:
 *    • Lista todos os membros ativos com papel e instrumentos
 *    • Busca por nome
 *    • Formulário de cadastro/edição de membro
 *    • Entrada por CPF (único identificador — sem CNPJ, sem cobrança)
 *    • Papéis: Diretor, Associado, Músico, Convidado
 *    • Múltiplos instrumentos por membro
 *    • Ativar/inativar membro (nunca deleta o histórico)
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { DB }     from './db.js';

const ID_TELA = 'tela-equipe';

const IC = Object.freeze({
  mais:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  editar:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  fechar:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  busca:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
});

const PAPEIS = Object.freeze([
  { valor: 'musico',    label: 'Músico' },
  { valor: 'associado', label: 'Associado' },
  { valor: 'diretor',   label: 'Diretor' },
  { valor: 'convidado', label: 'Convidado' },
]);

const COR_PAPEL = Object.freeze({
  diretor:   'badge-evento',
  associado: 'badge-ensaio',
  musico:    'badge-culto',
  convidado: '',
});

const INSTRUMENTOS_SUGERIDOS = [
  'Vocal', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Piano',
  'Bateria', 'Percussão', 'Violino', 'Violoncelo', 'Flauta',
  'Trompete', 'Saxofone', 'Contrabaixo', 'Cajon', 'Pandeiro',
];


/* ═══════════════════════════════════════════════════════════════════
   ■ ESTADO LOCAL
═══════════════════════════════════════════════════════════════════ */
const _estado = {
  membros:   [],
  filtrados: [],
  termoBusca:'',
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
  s.setAttribute('data-tela', 'equipe');
  s.setAttribute('aria-hidden', 'true');
  c.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ FILTROS
═══════════════════════════════════════════════════════════════════ */
function normalizar(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
}

function aplicarFiltros() {
  const t = normalizar(_estado.termoBusca);
  _estado.filtrados = t
    ? _estado.membros.filter(m => normalizar(m.nome).includes(t))
    : [..._estado.membros];
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES HTML
═══════════════════════════════════════════════════════════════════ */
function iniciais(nome = '') {
  return nome.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function htmlCardMembro(m) {
  const instrs = (m.instrumentos ?? []).join(', ') || '—';
  const cls    = COR_PAPEL[m.papel] ?? '';

  return `
    <li class="membro-card ${m.ativo ? '' : 'membro-card-inativo'}" data-cpf="${m.cpf}">
      <span class="membro-avatar membro-avatar-lg" aria-hidden="true">${iniciais(m.nome)}</span>
      <div class="membro-card-info">
        <span class="membro-card-nome">${m.nome}</span>
        <span class="membro-card-instrs">${instrs}</span>
        <div class="membro-card-badges">
          <span class="badge ${cls}">${PAPEIS.find(p => p.valor === m.papel)?.label ?? m.papel}</span>
          ${!m.ativo ? '<span class="badge">Inativo</span>' : ''}
        </div>
      </div>
      <button class="btn-icone btn-editar-membro" type="button"
        data-cpf="${m.cpf}" aria-label="Editar ${m.nome}">
        ${IC.editar}
      </button>
    </li>
  `;
}

function htmlFormMembro(membro = null) {
  const edit = !!membro;
  const v    = membro ?? {};
  const cpfFormatado = v.cpf
    ? v.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : '';
  const instrCheck = (instr) =>
    (v.instrumentos ?? []).includes(instr) ? 'checked' : '';

  const opcoesInstr = INSTRUMENTOS_SUGERIDOS.map(i => `
    <label class="checkbox-label">
      <input type="checkbox" name="instrumento" value="${i}" ${instrCheck(i)} />
      ${i}
    </label>
  `).join('');

  const opcoesPapel = PAPEIS.map(p =>
    `<option value="${p.valor}"${p.valor === (v.papel ?? 'musico') ? ' selected' : ''}>${p.label}</option>`
  ).join('');

  return `
    <div class="modal-overlay" id="modal-membro" role="dialog"
      aria-modal="true" aria-labelledby="modal-membro-titulo">
      <div class="modal-caixa">
        <div class="modal-cabecalho">
          <h2 id="modal-membro-titulo">${edit ? 'Editar Membro' : 'Convidar Membro'}</h2>
          <button class="btn-icone" id="btn-fechar-modal-membro" type="button" aria-label="Fechar">
            ${IC.fechar}
          </button>
        </div>

        <form id="form-membro" novalidate>

          <div class="campo-grupo">
            <label class="campo-label" for="fm-nome">Nome completo *</label>
            <input id="fm-nome" name="nome" class="campo-input" type="text"
              required value="${v.nome ?? ''}" placeholder="Nome do músico"
              autocomplete="name" />
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fm-cpf">CPF *</label>
            <input id="fm-cpf" name="cpf" class="campo-input"
              type="text" inputmode="numeric" maxlength="14"
              required value="${cpfFormatado}"
              placeholder="000.000.000-00"
              ${edit ? 'readonly aria-describedby="cpf-readonly-aviso"' : ''}
              autocomplete="off" />
            ${edit ? `<span id="cpf-readonly-aviso" class="campo-dica">O CPF não pode ser alterado.</span>` : ''}
            <span class="campo-erro" id="fm-cpf-erro" hidden></span>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="fm-papel">Papel na equipe</label>
            <select id="fm-papel" name="papel" class="cifra-tom-select">
              ${opcoesPapel}
            </select>
            <span class="campo-dica">Diretor e Associado têm os mesmos privilégios no app.</span>
          </div>

          <div class="campo-grupo">
            <span class="campo-label">Instrumentos</span>
            <div class="checkbox-grupo" role="group" aria-label="Instrumentos do membro">
              ${opcoesInstr}
            </div>
          </div>

          ${edit ? `
            <div class="campo-grupo">
              <label class="checkbox-label campo-label-toggle">
                <input type="checkbox" name="ativo" ${v.ativo ? 'checked' : ''} />
                Membro ativo
              </label>
              <span class="campo-dica">Membros inativos não aparecem nas escalas mas preservam o histórico.</span>
            </div>
          ` : ''}

          <div class="modal-rodape">
            <button type="button" class="btn-secundario" id="btn-cancelar-membro">Cancelar</button>
            <button type="submit" class="btn-primario">
              ${edit ? 'Salvar alterações' : 'Adicionar à equipe'}
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

  // Guard: apenas gestores
  if (!Auth.podeGerenciar()) {
    Router.navegar('dashboard', {}, true);
    return;
  }

  tela.innerHTML = `<div class="inner-page">
    <div class="dash-skeleton" style="height:52px"></div>
    <div class="dash-skeleton" style="height:320px"></div>
  </div>`;

  try {
    _estado.membros = await DB.usuarios.listarTodos();
    aplicarFiltros();

    tela.innerHTML = `
      <div class="inner-page equipe-inner">
        <h1 class="dash-secao-titulo">Equipe
          <span class="escala-secao-contagem">${_estado.membros.length}</span>
        </h1>

        <div class="musicas-barra">
          <div class="campo-input-wrapper musicas-busca-wrapper">
            <span class="campo-icone campo-icone-esquerda">${IC.busca}</span>
            <input id="input-busca-membro" class="campo-input campo-input-com-icone"
              type="search" placeholder="Buscar por nome…"
              value="${_estado.termoBusca}" aria-label="Buscar membros"
              autocomplete="off" />
          </div>
          <button class="btn-acao-pequeno" id="btn-novo-membro" type="button"
            aria-label="Convidar novo membro">
            ${IC.mais} Convidar
          </button>
        </div>

        <div id="equipe-resultado">
          ${_htmlLista()}
        </div>

        <p class="campo-dica" style="text-align:center;margin-top:var(--esp-4)">
          A entrada no sistema é feita exclusivamente pelo CPF.
          Nenhuma cobrança de presença — a participação é voluntária.
        </p>
      </div>
    `;

    _vincularEventos(tela);

  } catch (erro) {
    console.error('[TelaEquipe 7° Tom]', erro);
    tela.innerHTML = `<div class="inner-page"><p class="dash-erro">${erro.message}</p></div>`;
  }
}

function _htmlLista() {
  if (!_estado.filtrados.length) {
    return `<p class="escala-vazio">
      ${_estado.termoBusca ? 'Nenhum membro encontrado.' : 'Equipe vazia. Convide o primeiro membro!'}
    </p>`;
  }
  return `<ul class="membros-lista" role="list" aria-label="Membros da equipe" aria-live="polite">
    ${_estado.filtrados.map(m => htmlCardMembro(m)).join('')}
  </ul>`;
}

function _atualizarLista() {
  aplicarFiltros();
  const el = document.getElementById('equipe-resultado');
  if (el) {
    el.innerHTML = _htmlLista();
    _vincularListaEventos(el);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS
═══════════════════════════════════════════════════════════════════ */
function _vincularEventos(tela) {
  let timer;
  tela.querySelector('#input-busca-membro')?.addEventListener('input', ev => {
    clearTimeout(timer);
    timer = setTimeout(() => { _estado.termoBusca = ev.target.value; _atualizarLista(); }, 260);
  });

  tela.querySelector('#btn-novo-membro')?.addEventListener('click', () => {
    _abrirModal(tela, null);
  });

  _vincularListaEventos(tela.querySelector('#equipe-resultado'));
}

function _vincularListaEventos(container) {
  if (!container) return;
  container.querySelectorAll('.btn-editar-membro').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = await DB.usuarios.buscarPorCPF(btn.dataset.cpf);
      if (m) _abrirModal(document.getElementById(ID_TELA), m);
    });
  });
}

function _abrirModal(tela, membro) {
  document.getElementById('modal-membro')?.remove();
  tela.insertAdjacentHTML('beforeend', htmlFormMembro(membro));

  const modal = document.getElementById('modal-membro');
  const form  = document.getElementById('form-membro');

  // Máscara CPF
  const campoCPF = form?.querySelector('#fm-cpf');
  if (campoCPF && !membro) {
    campoCPF.addEventListener('input', ev => {
      const d = ev.target.value.replace(/\D/g, '').slice(0, 11);
      let m = d;
      if (d.length > 3)  m = d.slice(0,3) + '.' + d.slice(3);
      if (d.length > 6)  m = d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
      if (d.length > 9)  m = d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
      ev.target.value = m;
    });
  }

  const fechar = () => modal.remove();
  document.getElementById('btn-fechar-modal-membro')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-membro')?.addEventListener('click', fechar);
  modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd  = new FormData(form);
    const cpf = (fd.get('cpf') ?? '').replace(/\D/g, '');
    const nome = (fd.get('nome') ?? '').trim();

    const erroEl = document.getElementById('fm-cpf-erro');

    if (!nome) {
      form.querySelector('#fm-nome')?.focus();
      return;
    }

    if (!membro && cpf.length !== 11) {
      if (erroEl) { erroEl.textContent = 'CPF inválido.'; erroEl.hidden = false; }
      campoCPF?.focus();
      return;
    }

    const instrumentos = [...form.querySelectorAll('[name="instrumento"]:checked')]
      .map(cb => cb.value);

    const ativo = membro ? !!form.querySelector('[name="ativo"]')?.checked : true;

    try {
      await DB.usuarios.salvar({
        ...(membro ?? {}),
        cpf:         membro ? membro.cpf : cpf,
        nome,
        papel:       fd.get('papel') ?? 'musico',
        instrumentos,
        ativo,
      });
      _estado.membros = await DB.usuarios.listarTodos();
      _atualizarLista();
      fechar();
    } catch (e) {
      console.error('[TelaEquipe] Erro ao salvar:', e);
    }
  });

  requestAnimationFrame(() => form?.querySelector('#fm-nome')?.focus());
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();
  document.addEventListener('7tom:rota-entrada', ev => {
    if (ev.detail.rota === 'equipe') renderizar();
  });
}

export const TelaEquipe = { init, renderizar };
