/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — db.js
 *  Camada de abstração do IndexedDB (Offline-First)
 *
 *  Stores (tabelas):
 *    usuarios    → membros da equipe (CPF como keyPath)
 *    musicas     → catálogo de músicas com cifra e tom
 *    escalas     → cada culto/ensaio com sua lista de músicas
 *    alocacoes   → quem está em qual escala (N:N)
 *    eventos     → ensaios extras e eventos especiais
 *    respostas   → confirmações voluntárias de presença em eventos extras
 *    config      → configurações locais do app (chave-valor)
 *
 *  API exportada (todas as funções retornam Promises):
 *    DB.abrirConexao()
 *    DB.usuarios.{buscarPorCPF, salvar, listarTodos, remover}
 *    DB.musicas.{buscarPorId, salvar, listarTodas, buscarPorTitulo, remover}
 *    DB.escalas.{buscarPorId, salvar, listarPorPeriodo, listarFuturas, remover}
 *    DB.alocacoes.{salvar, buscarPorEscala, buscarPorUsuario, remover}
 *    DB.eventos.{salvar, buscarPorId, listarFuturos, remover}
 *    DB.respostas.{salvar, buscarPorEvento, buscarPorUsuario, remover}
 *    DB.config.{get, set, remover}
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';


/* ═══════════════════════════════════════════════════════════════════
   ■ CONFIGURAÇÃO DO BANCO
═══════════════════════════════════════════════════════════════════ */
const NOME_BANCO = '7tom-db';
const VERSAO_BANCO = 1;

// Singleton da conexão
let _db = null;


/* ═══════════════════════════════════════════════════════════════════
   ■ SCHEMAS DAS STORES
   Define cada objeto store e seus índices.
═══════════════════════════════════════════════════════════════════ */
const SCHEMA = [

  {
    nome: 'usuarios',
    opcoes: { keyPath: 'cpf' },            // CPF é a chave primária
    indices: [
      { nome: 'por_nome',    campo: 'nome',    unico: false },
      { nome: 'por_papel',   campo: 'papel',   unico: false },
      { nome: 'por_ativo',   campo: 'ativo',   unico: false },
    ],
  },

  {
    nome: 'musicas',
    opcoes: { keyPath: 'id', autoIncrement: true },
    indices: [
      { nome: 'por_titulo',  campo: 'titulo',  unico: false },
      { nome: 'por_tom',     campo: 'tom',     unico: false },
      { nome: 'por_autor',   campo: 'autor',   unico: false },
      { nome: 'por_tag',     campo: 'tags',    unico: false, multiEntry: true },
    ],
  },

  {
    nome: 'escalas',
    opcoes: { keyPath: 'id', autoIncrement: true },
    indices: [
      { nome: 'por_tipo',     campo: 'tipo',       unico: false },
      { nome: 'por_data',     campo: 'dataISO',    unico: false },
      { nome: 'por_culto',    campo: 'tipoCulto',  unico: false },
    ],
  },

  {
    nome: 'alocacoes',
    // Chave composta: [escalaId, cpf] — garante unicidade de vínculo
    opcoes: { keyPath: ['escalaId', 'cpf'] },
    indices: [
      { nome: 'por_escala',   campo: 'escalaId',   unico: false },
      { nome: 'por_usuario',  campo: 'cpf',        unico: false },
      { nome: 'por_instrumento', campo: 'instrumento', unico: false },
    ],
  },

  {
    nome: 'eventos',
    opcoes: { keyPath: 'id', autoIncrement: true },
    indices: [
      { nome: 'por_tipo',     campo: 'tipo',       unico: false },
      { nome: 'por_data',     campo: 'dataISO',    unico: false },
      { nome: 'por_criador',  campo: 'criadorCPF', unico: false },
    ],
  },

  {
    nome: 'respostas',
    opcoes: { keyPath: ['eventoId', 'cpf'] },
    indices: [
      { nome: 'por_evento',   campo: 'eventoId',   unico: false },
      { nome: 'por_usuario',  campo: 'cpf',        unico: false },
      { nome: 'por_status',   campo: 'status',     unico: false },
    ],
  },

  {
    nome: 'config',
    opcoes: { keyPath: 'chave' },
    indices: [],
  },

];


/* ═══════════════════════════════════════════════════════════════════
   ■ NÚCLEO: ABERTURA E MIGRAÇÃO
═══════════════════════════════════════════════════════════════════ */

/**
 * Abre (ou reaproveita) a conexão com o IndexedDB.
 * Cria/migra o schema automaticamente via onupgradeneeded.
 * @returns {Promise<IDBDatabase>}
 */
function abrirConexao() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const requisicao = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    // Criação / migração do schema
    requisicao.onupgradeneeded = (evento) => {
      const db     = evento.target.result;
      const tx     = evento.target.transaction;
      const versaoAntiga = evento.oldVersion;

      console.info(`[DB 7° Tom] Migrando do v${versaoAntiga} para v${VERSAO_BANCO}…`);

      SCHEMA.forEach(({ nome, opcoes, indices }) => {
        let store;

        if (!db.objectStoreNames.contains(nome)) {
          store = db.createObjectStore(nome, opcoes);
          console.info(`[DB 7° Tom] Store criada: ${nome}`);
        } else {
          store = tx.objectStore(nome);
        }

        // Cria índices que ainda não existem
        indices.forEach(({ nome: nomeIdx, campo, unico, multiEntry }) => {
          if (!store.indexNames.contains(nomeIdx)) {
            store.createIndex(nomeIdx, campo, {
              unique:     unico       ?? false,
              multiEntry: multiEntry  ?? false,
            });
          }
        });
      });
    };

    requisicao.onsuccess = (evento) => {
      _db = evento.target.result;

      // Trata fechamentos inesperados (browser vai encerrar o DB)
      _db.onversionchange = () => {
        _db.close();
        _db = null;
        console.warn('[DB 7° Tom] Banco fechado por atualização de versão.');
      };

      _db.onclose = () => {
        _db = null;
        console.info('[DB 7° Tom] Conexão encerrada.');
      };

      console.info(`[DB 7° Tom] Conectado — v${VERSAO_BANCO}`);
      resolve(_db);
    };

    requisicao.onerror = (evento) => {
      console.error('[DB 7° Tom] Falha ao abrir banco:', evento.target.error);
      reject(evento.target.error);
    };

    requisicao.onblocked = () => {
      console.warn('[DB 7° Tom] Abertura bloqueada por outra aba. Feche e reabra o app.');
    };
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIO: WRAPPER DE TRANSAÇÃO
   Centraliza a abertura de transações e elimina boilerplate.
═══════════════════════════════════════════════════════════════════ */

/**
 * Executa uma operação dentro de uma transação gerenciada.
 * @param {string|string[]} stores — nome(s) da(s) store(s)
 * @param {'readonly'|'readwrite'} modo
 * @param {(tx: IDBTransaction) => IDBRequest|Promise} operacao
 * @returns {Promise<any>}
 */
async function executar(stores, modo, operacao) {
  const db = await abrirConexao();

  return new Promise((resolve, reject) => {
    const tx        = db.transaction(stores, modo);
    const resultado = operacao(tx);

    // Se a operação retornou um IDBRequest, aguarda seu evento
    if (resultado && typeof resultado.onsuccess !== 'undefined') {
      resultado.onsuccess = () => resolve(resultado.result);
      resultado.onerror   = () => reject(resultado.error);
    } else {
      // Aguarda a transação completar (para operações sem resultado direto)
      tx.oncomplete = () => resolve(resultado);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(new Error('Transação abortada.'));
    }
  });
}

/**
 * Retorna todos os registros de uma store via cursor.
 * Mais eficiente que getAll() para stores muito grandes.
 * @param {string} nomeStore
 * @param {string|null} nomeIndice — usa índice se fornecido
 * @param {IDBKeyRange|null} range
 * @returns {Promise<Array>}
 */
async function listarViaCursor(nomeStore, nomeIndice = null, range = null) {
  const db = await abrirConexao();

  return new Promise((resolve, reject) => {
    const tx    = db.transaction(nomeStore, 'readonly');
    const store = tx.objectStore(nomeStore);
    const fonte = nomeIndice ? store.index(nomeIndice) : store;
    const req   = fonte.openCursor(range);
    const itens = [];

    req.onsuccess = (evento) => {
      const cursor = evento.target.result;
      if (cursor) {
        itens.push(cursor.value);
        cursor.continue();
      } else {
        resolve(itens);
      }
    };

    req.onerror = () => reject(req.error);
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: USUÁRIOS
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Usuario
 * @property {string}   cpf         — chave primária (11 dígitos sem formatação)
 * @property {string}   nome        — nome completo
 * @property {string}   papel       — 'diretor' | 'associado' | 'musico' | 'convidado'
 * @property {string[]} instrumentos — ex: ['violão', 'vocal']
 * @property {boolean}  ativo
 * @property {string}   criadoEm    — ISO 8601
 * @property {string}   atualizadoEm
 */

const usuarios = {

  /**
   * Busca um usuário pelo CPF.
   * @param {string} cpf — 11 dígitos
   * @returns {Promise<Usuario|undefined>}
   */
  buscarPorCPF(cpf) {
    return executar('usuarios', 'readonly', (tx) =>
      tx.objectStore('usuarios').get(cpf)
    );
  },

  /**
   * Insere ou atualiza um usuário (upsert).
   * @param {Usuario} usuario
   * @returns {Promise<string>} — CPF do usuário salvo
   */
  salvar(usuario) {
    const agora = new Date().toISOString();
    const registro = {
      ativo: true,
      instrumentos: [],
      ...usuario,
      atualizadoEm: agora,
      criadoEm: usuario.criadoEm || agora,
    };
    return executar('usuarios', 'readwrite', (tx) =>
      tx.objectStore('usuarios').put(registro)
    );
  },

  /**
   * Lista todos os usuários ativos.
   * @returns {Promise<Usuario[]>}
   */
  async listarTodos() {
    const todos = await listarViaCursor('usuarios', 'por_ativo', IDBKeyRange.only(true));
    return todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  /**
   * Lista usuários por papel.
   * @param {'diretor'|'associado'|'musico'|'convidado'} papel
   * @returns {Promise<Usuario[]>}
   */
  listarPorPapel(papel) {
    return listarViaCursor('usuarios', 'por_papel', IDBKeyRange.only(papel));
  },

  /**
   * Remove um usuário pelo CPF.
   * @param {string} cpf
   * @returns {Promise<void>}
   */
  remover(cpf) {
    return executar('usuarios', 'readwrite', (tx) =>
      tx.objectStore('usuarios').delete(cpf)
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: MÚSICAS
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Musica
 * @property {number}   id          — autoincrement
 * @property {string}   titulo
 * @property {string}   autor
 * @property {string}   tom         — ex: 'G', 'Am', 'F#'
 * @property {string}   cifra       — texto completo da cifra
 * @property {string}   urlPartitura — URL local do PDF (opcional)
 * @property {string[]} tags        — ex: ['adoração', 'comunhão']
 * @property {string}   criadoEm
 * @property {string}   atualizadoEm
 */

const musicas = {

  buscarPorId(id) {
    return executar('musicas', 'readonly', (tx) =>
      tx.objectStore('musicas').get(id)
    );
  },

  salvar(musica) {
    const agora = new Date().toISOString();
    const registro = {
      autor: '',
      tom: '',
      cifra: '',
      urlPartitura: '',
      tags: [],
      ...musica,
      atualizadoEm: agora,
      criadoEm: musica.criadoEm || agora,
    };
    return executar('musicas', 'readwrite', (tx) =>
      tx.objectStore('musicas').put(registro)
    );
  },

  async listarTodas() {
    const todas = await listarViaCursor('musicas');
    return todas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  },

  /**
   * Busca músicas por título (busca parcial, case-insensitive).
   * @param {string} termo
   * @returns {Promise<Musica[]>}
   */
  async buscarPorTitulo(termo) {
    const todas = await this.listarTodas();
    const termoLower = termo.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
    return todas.filter(m => {
      const titulo = m.titulo.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
      return titulo.includes(termoLower);
    });
  },

  remover(id) {
    return executar('musicas', 'readwrite', (tx) =>
      tx.objectStore('musicas').delete(id)
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: ESCALAS
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Escala
 * @property {number}    id
 * @property {string}    tipo        — 'culto' | 'ensaio-oficial' | 'ensaio-extra' | 'evento-especial'
 * @property {string}    tipoCulto   — 'sabado-manha' | 'domingo-noite' | 'quarta-noite' | null
 * @property {string}    dataISO     — ex: '2025-08-16'
 * @property {string}    horaInicio  — ex: '09:00'
 * @property {string}    titulo      — descrição livre (opcional)
 * @property {number[]}  musicaIds   — IDs das músicas nesta escala (ordem importa)
 * @property {string}    observacoes
 * @property {string}    criadoEm
 * @property {string}    atualizadoEm
 */

const escalas = {

  buscarPorId(id) {
    return executar('escalas', 'readonly', (tx) =>
      tx.objectStore('escalas').get(id)
    );
  },

  salvar(escala) {
    const agora = new Date().toISOString();
    const registro = {
      tipoCulto:   null,
      titulo:      '',
      musicaIds:   [],
      observacoes: '',
      ...escala,
      atualizadoEm: agora,
      criadoEm: escala.criadoEm || agora,
    };
    return executar('escalas', 'readwrite', (tx) =>
      tx.objectStore('escalas').put(registro)
    );
  },

  /**
   * Lista escalas em um intervalo de datas.
   * @param {string} dataInicio — ISO 8601 'YYYY-MM-DD'
   * @param {string} dataFim    — ISO 8601 'YYYY-MM-DD'
   * @returns {Promise<Escala[]>}
   */
  listarPorPeriodo(dataInicio, dataFim) {
    const range = IDBKeyRange.bound(dataInicio, dataFim + '\uffff');
    return listarViaCursor('escalas', 'por_data', range);
  },

  /**
   * Lista escalas a partir de hoje.
   * @returns {Promise<Escala[]>}
   */
  listarFuturas() {
    const hoje = new Date().toISOString().slice(0, 10);
    const range = IDBKeyRange.lowerBound(hoje);
    return listarViaCursor('escalas', 'por_data', range);
  },

  remover(id) {
    return executar('escalas', 'readwrite', (tx) =>
      tx.objectStore('escalas').delete(id)
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: ALOCAÇÕES (N:N usuário ↔ escala)
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Alocacao
 * @property {number} escalaId
 * @property {string} cpf
 * @property {string} instrumento  — ex: 'violão', 'vocal', 'bateria'
 * @property {string} observacoes
 * @property {string} criadoEm
 */

const alocacoes = {

  salvar(alocacao) {
    const registro = {
      instrumento:  '',
      observacoes:  '',
      ...alocacao,
      criadoEm: alocacao.criadoEm || new Date().toISOString(),
    };
    return executar('alocacoes', 'readwrite', (tx) =>
      tx.objectStore('alocacoes').put(registro)
    );
  },

  /**
   * Lista todas as alocações de uma escala específica.
   * @param {number} escalaId
   * @returns {Promise<Alocacao[]>}
   */
  buscarPorEscala(escalaId) {
    return listarViaCursor('alocacoes', 'por_escala', IDBKeyRange.only(escalaId));
  },

  /**
   * Lista todas as escalas em que um usuário está alocado.
   * @param {string} cpf
   * @returns {Promise<Alocacao[]>}
   */
  buscarPorUsuario(cpf) {
    return listarViaCursor('alocacoes', 'por_usuario', IDBKeyRange.only(cpf));
  },

  /**
   * Remove alocação específica (chave composta).
   * @param {number} escalaId
   * @param {string} cpf
   */
  remover(escalaId, cpf) {
    return executar('alocacoes', 'readwrite', (tx) =>
      tx.objectStore('alocacoes').delete([escalaId, cpf])
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: EVENTOS (ensaios extras / eventos especiais)
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Evento
 * @property {number}  id
 * @property {string}  tipo        — 'ensaio-extra' | 'evento-especial'
 * @property {string}  titulo      — ex: 'Ensaio pós-culto quarta'
 * @property {string}  dataISO
 * @property {string}  horaInicio
 * @property {string}  local
 * @property {string}  descricao
 * @property {string}  criadorCPF  — CPF do diretor que criou
 * @property {boolean} aberto      — true = aceita confirmações
 * @property {string}  criadoEm
 */

const eventos = {

  salvar(evento) {
    const agora = new Date().toISOString();
    const registro = {
      local:      '',
      descricao:  '',
      aberto:     true,
      ...evento,
      criadoEm: evento.criadoEm || agora,
    };
    return executar('eventos', 'readwrite', (tx) =>
      tx.objectStore('eventos').put(registro)
    );
  },

  buscarPorId(id) {
    return executar('eventos', 'readonly', (tx) =>
      tx.objectStore('eventos').get(id)
    );
  },

  listarFuturos() {
    const hoje = new Date().toISOString().slice(0, 10);
    const range = IDBKeyRange.lowerBound(hoje);
    return listarViaCursor('eventos', 'por_data', range);
  },

  remover(id) {
    return executar('eventos', 'readwrite', (tx) =>
      tx.objectStore('eventos').delete(id)
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: RESPOSTAS (confirmações voluntárias)
═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Resposta
 * @property {number} eventoId
 * @property {string} cpf
 * @property {string} status    — 'confirmado' | 'talvez' | 'nao-posso'
 * @property {string} mensagem  — observação voluntária
 * @property {string} criadoEm
 */

const respostas = {

  salvar(resposta) {
    const registro = {
      mensagem: '',
      ...resposta,
      criadoEm: resposta.criadoEm || new Date().toISOString(),
    };
    return executar('respostas', 'readwrite', (tx) =>
      tx.objectStore('respostas').put(registro)
    );
  },

  buscarPorEvento(eventoId) {
    return listarViaCursor('respostas', 'por_evento', IDBKeyRange.only(eventoId));
  },

  buscarPorUsuario(cpf) {
    return listarViaCursor('respostas', 'por_usuario', IDBKeyRange.only(cpf));
  },

  remover(eventoId, cpf) {
    return executar('respostas', 'readwrite', (tx) =>
      tx.objectStore('respostas').delete([eventoId, cpf])
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ STORE: CONFIG (chave-valor para preferências locais)
═══════════════════════════════════════════════════════════════════ */
const config = {

  /**
   * Lê uma configuração pelo nome da chave.
   * @param {string} chave
   * @returns {Promise<any>}
   */
  async get(chave) {
    const registro = await executar('config', 'readonly', (tx) =>
      tx.objectStore('config').get(chave)
    );
    return registro?.valor ?? null;
  },

  /**
   * Grava ou atualiza uma configuração.
   * @param {string} chave
   * @param {any}    valor
   */
  set(chave, valor) {
    return executar('config', 'readwrite', (tx) =>
      tx.objectStore('config').put({ chave, valor, atualizadoEm: new Date().toISOString() })
    );
  },

  remover(chave) {
    return executar('config', 'readwrite', (tx) =>
      tx.objectStore('config').delete(chave)
    );
  },
};


/* ═══════════════════════════════════════════════════════════════════
   ■ EXPORTAÇÃO PÚBLICA
═══════════════════════════════════════════════════════════════════ */
export const DB = {
  abrirConexao,
  usuarios,
  musicas,
  escalas,
  alocacoes,
  eventos,
  respostas,
  config,
};
