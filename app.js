/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — app.js
 *  Ponto de entrada da SPA
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { DB }            from './db.js';
import { Auth }          from './auth.js';
import { Router }        from './router.js';
import { TelaDashboard } from './tela-dashboard.js';
import { TelaEscalas }   from './tela-escalas.js';
import { TelaEscala }    from './tela-escala.js';
import { TelaCifra }     from './tela-cifra.js';
import { TelaMusicas }   from './tela-musicas.js';
import { TelaEquipe }    from './tela-equipe.js';
import { TelaEventos }   from './tela-eventos.js';
import { TelaPerfil }    from './tela-perfil.js';

const CONFIG = Object.freeze({
  CHAVE_TEMA:    '7tom:tema',
  TEMA_ESCURO:   'tema-escuro',
  TEMA_CLARO:    'tema-claro',
  TOAST_DURACAO: 4000,
  TOAST_SAIDA:   220,
});

/* ─── Tema ───────────────────────────────────────────────────────── */

const ModuloTema = (() => {
  let body = null;
  let btn  = null;

  function lerPreferencia() {
    const salvo = localStorage.getItem(CONFIG.CHAVE_TEMA);
    if (salvo === CONFIG.TEMA_ESCURO || salvo === CONFIG.TEMA_CLARO) return salvo;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? CONFIG.TEMA_ESCURO : CONFIG.TEMA_CLARO;
  }

  function aplicar(tema) {
    const escuro = tema === CONFIG.TEMA_ESCURO;
    body.classList.toggle(CONFIG.TEMA_ESCURO,  escuro);
    body.classList.toggle(CONFIG.TEMA_CLARO,  !escuro);
    if (btn) {
      btn.setAttribute('aria-label', escuro ? 'Alternar para modo claro' : 'Alternar para modo escuro');
      btn.setAttribute('title', escuro ? 'Modo claro' : 'Modo escuro');
    }
  }

  function alternar() {
    const novo = body.classList.contains(CONFIG.TEMA_ESCURO) ? CONFIG.TEMA_CLARO : CONFIG.TEMA_ESCURO;
    aplicar(novo);
    localStorage.setItem(CONFIG.CHAVE_TEMA, novo);
  }

  function init() {
    body = document.body;
    btn  = document.getElementById('btn-tema');
    body.style.transition = 'none';
    aplicar(lerPreferencia());
    void body.offsetHeight;
    body.style.transition = '';
    btn?.addEventListener('click', alternar);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ev => {
      if (!localStorage.getItem(CONFIG.CHAVE_TEMA))
        aplicar(ev.matches ? CONFIG.TEMA_ESCURO : CONFIG.TEMA_CLARO);
    });
  }

  return { init };
})();

/* ─── Toast ──────────────────────────────────────────────────────── */

const ModuloToast = (() => {
  let area = null;

  function exibir(mensagem, tipo = 'info') {
    if (!area) return;
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    el.textContent = mensagem;
    area.appendChild(el);
    const t = setTimeout(() => _remover(el), CONFIG.TOAST_DURACAO);
    el.addEventListener('click', () => { clearTimeout(t); _remover(el); }, { once: true });
  }

  function _remover(el) {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), CONFIG.TOAST_SAIDA);
  }

  function init() { area = document.getElementById('area-toast'); }

  return { init, exibir };
})();

window.__7tomToast = ModuloToast;

/* ─── CPF ────────────────────────────────────────────────────────── */

const ModuloCPF = (() => {
  function digitos(v) { return v.replace(/\D/g, ''); }

  function mascarar(d) {
    const s = d.slice(0, 11);
    if (s.length <= 3) return s;
    if (s.length <= 6) return `${s.slice(0,3)}.${s.slice(3)}`;
    if (s.length <= 9) return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6)}`;
    return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;
  }

  function validar(d) {
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const calc = (p, peso) => {
      let s = 0;
      for (let i = 0; i < p.length; i++) s += +p[i] * (peso - i);
      const r = (s * 10) % 11;
      return r >= 10 ? 0 : r;
    };
    return calc(d.slice(0,9), 10) === +d[9] && calc(d.slice(0,10), 11) === +d[10];
  }

  function _limparErro(input) {
    input.classList.remove('estado-erro');
    const erroId = input.getAttribute('aria-describedby')?.split(' ').find(id => id.includes('erro'));
    if (erroId) {
      const el = document.getElementById(erroId);
      if (el) { el.textContent = ''; el.hidden = true; }
    }
  }

  function aoDigitar(ev) {
    const input = ev.target;
    const d = digitos(input.value);
    const novo = mascarar(d);
    if (input.value !== novo) {
      const pos = input.selectionStart;
      const dt  = novo.length - input.value.length;
      input.value = novo;
      input.setSelectionRange(Math.max(0, pos + dt), Math.max(0, pos + dt));
    }
    _limparErro(input);
  }

  function aoColar(ev) {
    ev.preventDefault();
    const colado = (ev.clipboardData || window.clipboardData).getData('text');
    ev.target.value = mascarar(digitos(colado));
    _limparErro(ev.target);
  }

  function init() {
    const input = document.getElementById('input-cpf');
    if (!input) return;
    input.addEventListener('input', aoDigitar);
    input.addEventListener('paste', aoColar);
    const ultimo = Auth.ultimoCPF();
    if (ultimo && !input.value) input.value = mascarar(ultimo);
  }

  return { init, validar, digitos, mascarar };
})();

/* ─── Tela de Acesso ─────────────────────────────────────────────── */

const ModuloAcesso = (() => {
  function mostrarErro(msg) {
    const erro  = document.getElementById('cpf-erro');
    const input = document.getElementById('input-cpf');
    input?.classList.add('estado-erro');
    if (erro) { erro.textContent = msg; erro.hidden = false; }
  }

  function limparErro() {
    const erro  = document.getElementById('cpf-erro');
    const input = document.getElementById('input-cpf');
    input?.classList.remove('estado-erro');
    if (erro) { erro.textContent = ''; erro.hidden = true; }
  }

  function setCarregando(ativo) {
    const btn     = document.getElementById('btn-entrar');
    const spinner = btn?.querySelector('.btn-spinner');
    const texto   = btn?.querySelector('.btn-texto');
    if (!btn) return;
    btn.disabled = ativo;
    btn.classList.toggle('carregando', ativo);
    if (spinner) spinner.hidden = !ativo;
    if (texto)   texto.textContent = ativo ? 'Verificando…' : 'Entrar';
  }

  async function aoSubmeter(ev) {
    ev.preventDefault();
    limparErro();

    const inputCPF   = document.getElementById('input-cpf');
    const inputSenha = document.getElementById('input-senha');
    if (!inputCPF) return;

    const d     = ModuloCPF.digitos(inputCPF.value);
    const senha = inputSenha?.value ?? '';

    if (!d.length)             return mostrarErro('Informe seu CPF para continuar.');
    if (d.length < 11)         return mostrarErro('CPF incompleto.');
    if (!ModuloCPF.validar(d)) return mostrarErro('CPF inválido. Confira os números.');
    if (!senha.trim())         return mostrarErro('Digite sua senha.');

    setCarregando(true);
    const resultado = await Auth.entrar(d, senha);
    setCarregando(false);

    if (resultado.ok) {
      Router.navegar('dashboard', {}, true);
    } else {
      mostrarErro(resultado.erro ?? 'Não foi possível acessar o sistema.');
    }
  }

  function init() {
    document.getElementById('form-acesso')?.addEventListener('submit', aoSubmeter);
  }

  return { init };
})();

/* ─── NavBar ─────────────────────────────────────────────────────── */

const ModuloNavBar = (() => {
  function init() {
    document.querySelectorAll('[data-nav-rota]').forEach(btn => {
      btn.addEventListener('click', () => Router.navegar(btn.dataset.navRota));
    });
    document.addEventListener('7tom:rota-entrada', ev => {
      document.querySelectorAll('[data-nav-rota]').forEach(btn => {
        const ativo = btn.dataset.navRota === ev.detail.rota;
        btn.classList.toggle('nav-ativo', ativo);
        btn.setAttribute('aria-current', ativo ? 'page' : 'false');
      });
    });
  }
  return { init };
})();

/* ─── PWA ────────────────────────────────────────────────────────── */

const ModuloPWA = (() => {
  async function registrar() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.info('[7° Tom] SW registrado:', reg.scope);
      navigator.serviceWorker.addEventListener('message', ev => {
        if (ev.data?.tipo === '7TOM_SW_ATUALIZADO')
          ModuloToast.exibir('Atualização disponível. Recarregue para usar.', 'info');
      });
    } catch (e) {
      console.warn('[7° Tom] Falha ao registrar SW:', e);
    }
  }
  return { registrar };
})();

/* ─── Bootstrap ──────────────────────────────────────────────────── */

async function inicializar() {
  ModuloTema.init();
  ModuloToast.init();

  DB.abrirConexao().catch(e => {
    console.error('[7° Tom] Falha IndexedDB:', e);
    ModuloToast.exibir('Erro ao acessar banco local. Recarregue.', 'erro');
  });

  const usuarioLogado = Auth.init();

  TelaDashboard.init();
  TelaEscalas.init();
  TelaEscala.init();
  TelaCifra.init();
  TelaMusicas.init();
  TelaEquipe.init();
  TelaEventos.init();
  TelaPerfil.init();

  ModuloCPF.init();
  ModuloAcesso.init();
  ModuloNavBar.init();

  Router.init(usuarioLogado);
  ModuloPWA.registrar();

  console.info('[7° Tom] Pronto.', usuarioLogado?.nome ?? 'Sem sessão.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}