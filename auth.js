/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — auth.js
 *  Autenticação local por CPF (IndexedDB — 100% offline)
 *
 *  Fluxo:
 *    1. Usuário digita o CPF na tela de acesso
 *    2. auth.entrar(cpf) consulta o IndexedDB
 *    3. Se o CPF existir → sessão criada em sessionStorage
 *    4. Router é notificado e navega para o dashboard
 *    5. auth.sair() limpa a sessão e volta para #acesso
 *
 *  Sessão:
 *    • Armazenada em sessionStorage (encerra ao fechar o navegador)
 *    • Chave: '7tom:sessao'
 *    • Valor: JSON com cpf, nome, papel, instrumentos, timestamp
 *
 *  Hierarquia de papéis:
 *    diretor   → acesso total (mesmos privilégios que associado + gestão)
 *    associado → acesso total (mesmos privilégios locais que diretor)
 *    musico    → acesso às suas escalas, cifras e eventos
 *    convidado → acesso somente leitura às escalas em que está
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { DB }     from './db.js';
import { Router } from './router.js';


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTANTES
═══════════════════════════════════════════════════════════════════ */
const CHAVE_SESSAO  = '7tom:sessao';
const CHAVE_ULTIMO_CPF = '7tom:ultimo-cpf'; // localStorage — pré-preenche o campo

/** Papéis com privilégios de gestão (equivalentes entre si) */
const PAPEIS_GESTAO = new Set(['diretor', 'associado']);


/* ═══════════════════════════════════════════════════════════════════
   ■ ESTADO INTERNO
═══════════════════════════════════════════════════════════════════ */

/** @type {Object|null} */
let _sessaoAtual = null;


/* ═══════════════════════════════════════════════════════════════════
   ■ SESSÃO
═══════════════════════════════════════════════════════════════════ */

/**
 * Lê a sessão ativa do sessionStorage.
 * @returns {Object|null}
 */
function lerSessao() {
  try {
    const raw = sessionStorage.getItem(CHAVE_SESSAO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persiste a sessão no sessionStorage.
 * @param {Object} usuario
 */
function salvarSessao(usuario) {
  const sessao = {
    cpf:          usuario.cpf,
    nome:         usuario.nome,
    papel:        usuario.papel,
    instrumentos: usuario.instrumentos ?? [],
    iniciadaEm:   new Date().toISOString(),
  };
  sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  _sessaoAtual = sessao;
}

/**
 * Apaga a sessão ativa.
 */
function limparSessao() {
  sessionStorage.removeItem(CHAVE_SESSAO);
  _sessaoAtual = null;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EMISSÃO DE EVENTOS
═══════════════════════════════════════════════════════════════════ */

/**
 * @param {string} tipo
 * @param {any}    detalhe
 */
function emitir(tipo, detalhe = {}) {
  document.dispatchEvent(new CustomEvent(tipo, {
    detail:  detalhe,
    bubbles: false,
  }));
}


/* ═══════════════════════════════════════════════════════════════════
   ■ OPERAÇÕES PÚBLICAS
═══════════════════════════════════════════════════════════════════ */

/**
 * Tenta autenticar um usuário pelo CPF.
 *
 * @param {string} cpf — 11 dígitos sem formatação
 * @returns {Promise<{ ok: boolean, erro?: string, usuario?: Object }>}
 */
async function entrar(cpf) {
  if (!cpf || cpf.length !== 11) {
    return { ok: false, erro: 'CPF inválido.' };
  }

  let usuario;
  try {
    usuario = await DB.usuarios.buscarPorCPF(cpf);
  } catch (e) {
    console.error('[Auth 7° Tom] Erro ao consultar banco:', e);
    return { ok: false, erro: 'Falha ao acessar o banco de dados local.' };
  }

  if (!usuario) {
    return {
      ok:   false,
      erro: 'CPF não encontrado. Peça ao seu Diretor de Louvor para te cadastrar.',
    };
  }

  if (!usuario.ativo) {
    return {
      ok:   false,
      erro: 'Seu acesso está inativo. Fale com o Diretor de Louvor.',
    };
  }

  // Sucesso
  salvarSessao(usuario);

  // Grava o CPF no localStorage para pré-preencher na próxima visita
  localStorage.setItem(CHAVE_ULTIMO_CPF, cpf);

  // Notifica o router e outros módulos
  Router.definirUsuario(_sessaoAtual);
  emitir('7tom:login', { usuario: _sessaoAtual });

  console.info(`[Auth 7° Tom] Login — ${usuario.nome} (${usuario.papel})`);

  return { ok: true, usuario: _sessaoAtual };
}

/**
 * Encerra a sessão do usuário atual.
 */
function sair() {
  const usuarioSaindo = _sessaoAtual;
  limparSessao();

  Router.definirUsuario(null);
  emitir('7tom:logout', { usuario: usuarioSaindo });

  Router.navegar('acesso', {}, true);

  console.info('[Auth 7° Tom] Sessão encerrada.');
}

/**
 * Inicializa o módulo de autenticação.
 * Restaura sessão existente se ainda estiver ativa.
 * @returns {Object|null} — usuário logado ou null
 */
function init() {
  const sessao = lerSessao();

  if (sessao) {
    _sessaoAtual = sessao;
    console.info(`[Auth 7° Tom] Sessão restaurada — ${sessao.nome}`);
    return sessao;
  }

  return null;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS DE PERMISSÃO
═══════════════════════════════════════════════════════════════════ */

/**
 * Verifica se o usuário logado tem papel de gestão.
 * @returns {boolean}
 */
function podeGerenciar() {
  return _sessaoAtual ? PAPEIS_GESTAO.has(_sessaoAtual.papel) : false;
}

/**
 * Verifica se o usuário logado é o mesmo de um CPF dado.
 * @param {string} cpf
 * @returns {boolean}
 */
function ehMesmoUsuario(cpf) {
  return _sessaoAtual?.cpf === cpf;
}

/**
 * Retorna o último CPF usado (para pré-preencher o campo).
 * @returns {string|null}
 */
function ultimoCPF() {
  return localStorage.getItem(CHAVE_ULTIMO_CPF);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EXPORTAÇÃO
═══════════════════════════════════════════════════════════════════ */
export const Auth = {
  init,
  entrar,
  sair,
  podeGerenciar,
  ehMesmoUsuario,
  ultimoCPF,

  /** Retorna o usuário da sessão atual (ou null) */
  get usuario() { return _sessaoAtual ? { ..._sessaoAtual } : null; },

  /** True se houver sessão ativa */
  get logado()  { return _sessaoAtual !== null; },
};
