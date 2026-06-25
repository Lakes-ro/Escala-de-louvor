/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — auth.js
 *  Autenticação via Supabase RPC (CPF + Senha com hash bcrypt)
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { supabase } from './db-supabase.js';
import { Router }   from './router.js';

const CHAVE_SESSAO     = '7tom:sessao';
const CHAVE_ULTIMO_CPF = '7tom:ultimo-cpf';
const PAPEIS_GESTAO    = new Set(['lider', 'diretor', 'associado']);

let _sessaoAtual = null;

function lerSessao() {
  try {
    const raw = sessionStorage.getItem(CHAVE_SESSAO);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function salvarSessao(usuario) {
  const sessao = {
    cpf:                   usuario.cpf,
    nome:                  usuario.nome,
    email:                 usuario.email,
    funcao_id:             usuario.funcao_id,
    instrumento_principal: usuario.instrumento_principal ?? null,
    path:                  usuario.path,
    iniciadaEm:            new Date().toISOString(),
  };
  sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  _sessaoAtual = sessao;
}

function limparSessao() {
  sessionStorage.removeItem(CHAVE_SESSAO);
  _sessaoAtual = null;
}

function emitir(tipo, detalhe = {}) {
  document.dispatchEvent(new CustomEvent(tipo, { detail: detalhe, bubbles: false }));
}

async function entrar(cpf, senha) {
  if (!cpf || cpf.length !== 11) return { ok: false, erro: 'CPF inválido.' };
  if (!senha || !senha.trim())   return { ok: false, erro: 'Digite sua senha.' };

  let data, error;
  try {
    ({ data, error } = await supabase.rpc('autenticar_usuario', {
      cpf_input:   cpf,
      senha_input: senha,
    }));
  } catch (e) {
    console.error('[Auth] Falha de rede:', e);
    return { ok: false, erro: 'Sem conexão com o servidor. Verifique sua internet.' };
  }

  if (error) {
    console.error('[Auth] Erro Supabase:', error.message);
    return { ok: false, erro: 'Não foi possível entrar. Tente novamente em instantes.' };
  }

  if (!data || data.length === 0) {
    return { ok: false, erro: 'CPF ou senha incorretos.' };
  }

  salvarSessao(data[0]);
  localStorage.setItem(CHAVE_ULTIMO_CPF, cpf);
  Router.definirUsuario(_sessaoAtual);
  emitir('7tom:login', { usuario: _sessaoAtual });
  console.info(`[Auth] Login — ${data[0].nome} (${data[0].funcao_id})`);

  return { ok: true, usuario: _sessaoAtual };
}

function sair() {
  const saindo = _sessaoAtual;
  limparSessao();
  Router.definirUsuario(null);
  emitir('7tom:logout', { usuario: saindo });
  Router.navegar('acesso', {}, true);
  console.info('[Auth] Sessão encerrada.');
}

function init() {
  const sessao = lerSessao();
  if (sessao) {
    _sessaoAtual = sessao;
    console.info(`[Auth] Sessão restaurada — ${sessao.nome}`);
    return sessao;
  }
  return null;
}

function podeGerenciar() {
  return _sessaoAtual ? PAPEIS_GESTAO.has(_sessaoAtual.funcao_id) : false;
}

function ehMesmoUsuario(cpf) { return _sessaoAtual?.cpf === cpf; }
function ultimoCPF()         { return localStorage.getItem(CHAVE_ULTIMO_CPF); }

export const Auth = {
  init, entrar, sair, podeGerenciar, ehMesmoUsuario, ultimoCPF,
  get usuario() { return _sessaoAtual ? { ..._sessaoAtual } : null; },
  get logado()  { return _sessaoAtual !== null; },
};