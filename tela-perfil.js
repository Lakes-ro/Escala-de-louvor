/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — tela-perfil.js
 *  Perfil do Usuário Logado
 *
 *  Seções:
 *    • Avatar com iniciais e dados do usuário (nome, papel, CPF)
 *    • Lista de instrumentos
 *    • Histórico: escalas em que o usuário participou
 *    • Edição de nome e instrumentos (o papel só o gestor altera)
 *    • Preferências do app (tema — redundância com o header)
 *    • Botão "Sair" com confirmação (encerra sessão e volta ao login)
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { Auth }   from './auth.js';
import { Router } from './router.js';
import { DB }     from './db.js';
import { Agenda } from './agenda.js';

const ID_TELA = 'tela-perfil';

const IC = Object.freeze({
  usuario:  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  editar:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  sair:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  seta:     `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  fechar:   `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  historico:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`,
  check:    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
});

const NOME_PAPEL = Object.freeze({
  diretor:   'Diretor de Louvor',
  associado: 'Associado',
  musico:    'Músico',
  convidado: 'Convidado',
});

const INSTRUMENTOS_LISTA = [
  'Vocal', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Piano',
  'Bateria', 'Percussão', 'Violino', 'Violoncelo', 'Flauta',
  'Trompete', 'Saxofone', 'Contrabaixo', 'Cajon', 'Pandeiro',
];


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
  s.setAttribute('data-tela', 'perfil');
  s.setAttribute('aria-hidden', 'true');
  c.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS
═══════════════════════════════════════════════════════════════════ */
function iniciais(nome = '') {
  return nome.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function formatarCPF(cpf = '') {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTRUTORES HTML
═══════════════════════════════════════════════════════════════════ */
function htmlCabecalhoPerfil(usuario) {
  const papel = NOME_PAPEL[usuario.papel] ?? usuario.papel;
  const instrs = (usuario.instrumentos ?? []).join(' · ') || 'Nenhum cadastrado';

  return `
    <div class="perfil-hero">
      <div class="perfil-avatar" aria-hidden="true">
        ${iniciais(usuario.nome)}
      </div>
      <div class="perfil-info">
        <h1 class="perfil-nome">${usuario.nome}</h1>
        <span class="perfil-papel">${papel}</span>
        <span class="perfil-cpf">${formatarCPF(usuario.cpf)}</span>
      </div>
    </div>

    <div class="perfil-card">
      <div class="perfil-card-linha">
        <span class="perfil-card-rotulo">Instrumentos</span>
        <span class="perfil-card-valor">${instrs}</span>
      </div>
      <div class="perfil-card-linha">
        <span class="perfil-card-rotulo">Papel</span>
        <span class="perfil-card-valor">${papel}</span>
      </div>
    </div>
  `;
}

function htmlAcoesRapidas() {
  return `
    <div class="perfil-acoes">
      <button class="perfil-acao-btn" id="btn-editar-perfil" type="button"
        aria-label="Editar meu perfil">
        <span class="perfil-acao-icone">${IC.editar}</span>
        <span class="perfil-acao-texto">
          <strong>Editar perfil</strong>
          <span>Alterar nome e instrumentos</span>
        </span>
        ${IC.seta}
      </button>

      <button class="perfil-acao-btn perfil-acao-sair" id="btn-sair"
        type="button" aria-label="Sair do aplicativo">
        <span class="perfil-acao-icone perfil-acao-icone-sair">${IC.sair}</span>
        <span class="perfil-acao-texto">
          <strong>Sair</strong>
          <span>Encerrar esta sessão</span>
        </span>
        ${IC.seta}
      </button>
    </div>
  `;
}

function htmlHistoricoParticipacoes(alocacoes, escalas) {
  if (!alocacoes.length) {
    return `
      <section class="dash-secao" aria-labelledby="titulo-hist">
        <h2 id="titulo-hist" class="dash-secao-titulo">
          ${IC.historico} Meu histórico
        </h2>
        <p class="escala-vazio">Você ainda não foi escalado para nenhum culto.</p>
      </section>
    `;
  }

  // Cruza alocações com escalas para pegar título e data
  const mapaEscalas = new Map(escalas.map(e => [e.id, e]));
  const itens = alocacoes
    .map(a => {
      const escala = mapaEscalas.get(a.escalaId);
      if (!escala) return null;
      return { ...a, escala };
    })
    .filter(Boolean)
    .sort((a, b) => b.escala.dataISO.localeCompare(a.escala.dataISO))
    .slice(0, 20); // últimas 20 participações

  const listaHTML = itens.map(item => {
    const titulo  = item.escala.titulo || item.escala.tipoCulto;
    const data    = Agenda.formatarDataExibicao(item.escala.dataISO);
    const instr   = item.instrumento || 'Instrumento não definido';
    const passado = item.escala.dataISO < Agenda.paraISO(new Date());

    return `
      <li class="hist-item ${passado ? 'hist-item-passado' : ''}">
        <div class="hist-item-data">
          <span class="agenda-dia-semana">
            ${Agenda.NOMES_DIA[Agenda.deISO(item.escala.dataISO).getDay()].slice(0,3)}
          </span>
          <span class="agenda-dia-num">${item.escala.dataISO.slice(8)}</span>
        </div>
        <div class="hist-item-info">
          <span class="hist-item-titulo">${titulo}</span>
          <span class="hist-item-sub">${data} · ${instr}</span>
        </div>
        <button class="btn-icone hist-item-btn"
          type="button"
          data-navegar="escala"
          data-params='{"id":"${item.escalaId}"}'
          aria-label="Ver escala de ${titulo}">
          ${IC.seta}
        </button>
      </li>
    `;
  }).join('');

  return `
    <section class="dash-secao" aria-labelledby="titulo-hist">
      <h2 id="titulo-hist" class="dash-secao-titulo">
        ${IC.historico} Meu histórico
        <span class="escala-secao-contagem">${itens.length}</span>
      </h2>
      <ul class="hist-lista" role="list" aria-label="Histórico de participações">
        ${listaHTML}
      </ul>
    </section>
  `;
}

function htmlFormEdicao(usuario) {
  const instrCheck = i =>
    (usuario.instrumentos ?? []).includes(i) ? 'checked' : '';

  return `
    <div class="modal-overlay" id="modal-editar-perfil" role="dialog"
      aria-modal="true" aria-labelledby="modal-editar-titulo">
      <div class="modal-caixa">
        <div class="modal-cabecalho">
          <h2 id="modal-editar-titulo">Editar perfil</h2>
          <button class="btn-icone" id="btn-fechar-editar"
            type="button" aria-label="Fechar">${IC.fechar}</button>
        </div>

        <form id="form-editar-perfil" novalidate>

          <div class="campo-grupo">
            <label class="campo-label" for="fp-nome">Nome completo *</label>
            <input id="fp-nome" name="nome" class="campo-input"
              type="text" required value="${usuario.nome ?? ''}"
              autocomplete="name" />
          </div>

          <div class="campo-grupo">
            <span class="campo-label">Instrumentos</span>
            <div class="checkbox-grupo" role="group" aria-label="Meus instrumentos">
              ${INSTRUMENTOS_LISTA.map(i => `
                <label class="checkbox-label">
                  <input type="checkbox" name="instrumento"
                    value="${i}" ${instrCheck(i)} />
                  ${i}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="modal-rodape">
            <button type="button" class="btn-secundario"
              id="btn-cancelar-editar">Cancelar</button>
            <button type="submit" class="btn-primario" id="btn-salvar-perfil">
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function htmlConfirmacaoSaida() {
  return `
    <div class="modal-overlay" id="modal-sair" role="dialog"
      aria-modal="true" aria-labelledby="modal-sair-titulo">
      <div class="modal-caixa" style="max-width:380px">
        <div class="modal-cabecalho">
          <h2 id="modal-sair-titulo">Sair do 7° Tom?</h2>
        </div>
        <p style="font-size:var(--texto-sm);color:var(--cor-texto-secundario);margin-bottom:var(--esp-4)">
          Sua sessão será encerrada. Para voltar, basta inserir seu CPF novamente.
        </p>
        <div class="modal-rodape">
          <button type="button" class="btn-secundario" id="btn-cancelar-sair">
            Cancelar
          </button>
          <button type="button" class="btn-primario btn-confirmar-sair"
            id="btn-confirmar-sair">
            ${IC.sair} Confirmar saída
          </button>
        </div>
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

  const sessao = Auth.usuario;
  if (!sessao) { Router.navegar('acesso', {}, true); return; }

  tela.innerHTML = `<div class="inner-page">
    <div class="dash-skeleton" style="height:140px"></div>
    <div class="dash-skeleton" style="height:100px"></div>
    <div class="dash-skeleton" style="height:260px"></div>
  </div>`;

  try {
    // Carrega dados completos do usuário do banco e o histórico
    const [usuario, alocacoes] = await Promise.all([
      DB.usuarios.buscarPorCPF(sessao.cpf),
      DB.alocacoes.buscarPorUsuario(sessao.cpf),
    ]);

    const usuarioFinal = usuario ?? sessao;

    // Carrega escalas correspondentes às alocações
    const escalas = alocacoes.length
      ? (await Promise.all(
          [...new Set(alocacoes.map(a => a.escalaId))]
            .map(id => DB.escalas.buscarPorId(id))
        )).filter(Boolean)
      : [];

    tela.innerHTML = `
      <div class="inner-page perfil-inner">
        ${htmlCabecalhoPerfil(usuarioFinal)}
        ${htmlAcoesRapidas()}
        ${htmlHistoricoParticipacoes(alocacoes, escalas)}
      </div>
    `;

    _vincularEventos(tela, usuarioFinal);

  } catch (erro) {
    console.error('[TelaPerfil 7° Tom]', erro);
    tela.innerHTML = `<div class="inner-page">
      <p class="dash-erro">${erro.message}</p>
    </div>`;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ LISTENERS
═══════════════════════════════════════════════════════════════════ */
function _vincularEventos(tela, usuario) {
  // Navegar para escalas do histórico
  tela.querySelectorAll('[data-navegar]').forEach(btn => {
    btn.addEventListener('click', () => {
      let params = {};
      try { if (btn.dataset.params) params = JSON.parse(btn.dataset.params); } catch {}
      Router.navegar(btn.dataset.navegar, params);
    });
  });

  // Editar perfil
  tela.querySelector('#btn-editar-perfil')?.addEventListener('click', () => {
    _abrirModalEdicao(tela, usuario);
  });

  // Sair
  tela.querySelector('#btn-sair')?.addEventListener('click', () => {
    _abrirConfirmacaoSaida(tela);
  });
}

function _abrirModalEdicao(tela, usuario) {
  document.getElementById('modal-editar-perfil')?.remove();
  tela.insertAdjacentHTML('beforeend', htmlFormEdicao(usuario));

  const modal = document.getElementById('modal-editar-perfil');
  const form  = document.getElementById('form-editar-perfil');

  const fechar = () => modal.remove();
  document.getElementById('btn-fechar-editar')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-editar')?.addEventListener('click', fechar);
  modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });

  form?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd   = new FormData(form);
    const nome = (fd.get('nome') ?? '').trim();
    if (!nome) { form.querySelector('#fp-nome')?.focus(); return; }

    const instrumentos = [...form.querySelectorAll('[name="instrumento"]:checked')]
      .map(cb => cb.value);

    const btn = document.getElementById('btn-salvar-perfil');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

    try {
      await DB.usuarios.salvar({ ...usuario, nome, instrumentos });

      // Feedback visual antes de fechar
      if (btn) {
        btn.innerHTML = `${IC.check} Salvo!`;
        btn.style.background = 'var(--cor-sucesso-bg)';
        btn.style.color = 'var(--cor-sucesso)';
      }
      setTimeout(() => { fechar(); renderizar(); }, 900);
    } catch (e) {
      console.error('[TelaPerfil] Erro ao salvar:', e);
      if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
    }
  });

  requestAnimationFrame(() => form?.querySelector('#fp-nome')?.focus());
}

function _abrirConfirmacaoSaida(tela) {
  document.getElementById('modal-sair')?.remove();
  tela.insertAdjacentHTML('beforeend', htmlConfirmacaoSaida());

  const modal = document.getElementById('modal-sair');
  const fechar = () => modal.remove();

  document.getElementById('btn-cancelar-sair')?.addEventListener('click', fechar);
  modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });

  document.getElementById('btn-confirmar-sair')?.addEventListener('click', () => {
    fechar();
    Auth.sair(); // limpa sessão e navega para #acesso via Router
  });

  requestAnimationFrame(() =>
    document.getElementById('btn-cancelar-sair')?.focus()
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ■ INIT
═══════════════════════════════════════════════════════════════════ */
function init() {
  garantirTelaNoDom();
  document.addEventListener('7tom:rota-entrada', ev => {
    if (ev.detail.rota === 'perfil') renderizar();
  });
}

export const TelaPerfil = { init, renderizar };
