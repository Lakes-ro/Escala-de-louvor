/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — agenda.js
 *  Motor de Agenda — Piloto Automático + Eventos Dinâmicos
 *
 *  AGENDA FIXA (Piloto Automático):
 *    Gera automaticamente os cultos e o ensaio oficial padrão
 *    para qualquer janela de datas solicitada.
 *
 *    Cultos fixos (semanais):
 *      • Sábado de manhã  (sáb, 09:00) → tipo: 'sabado-manha'
 *      • Domingo à noite  (dom, 19:00) → tipo: 'domingo-noite'
 *      • Quarta à noite   (qua, 19:30) → tipo: 'quarta-noite'
 *
 *    Ensaio Oficial (gerado automaticamente junto com o Sábado):
 *      • Sexta-feira à noite (sex, 19:30) → tipo: 'ensaio-oficial'
 *      Regra: quem está na escala do sábado está no ensaio de sexta.
 *
 *  AGENDA DINÂMICA (Eventos Extras):
 *    O líder cria "Ensaios Extras" ou "Eventos Especiais" avulsos.
 *    Esses eventos disparam um convite aberto para confirmação
 *    voluntária da equipe (sem coerção).
 *
 *  ALERTA DE REPETIÇÃO:
 *    Se uma música aparecer mais de uma vez no mesmo dia de culto,
 *    o motor emite um alerta visual via evento customizado.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

import { DB } from './db.js';


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTANTES
═══════════════════════════════════════════════════════════════════ */

/** Dias da semana (0 = dom, 1 = seg, … 6 = sáb) */
const DIA = Object.freeze({
  DOMINGO:       0,
  SEGUNDA:       1,
  TERCA:         2,
  QUARTA:        3,
  QUINTA:        4,
  SEXTA:         5,
  SABADO:        6,
});

/**
 * Definição dos cultos e ensaios fixos.
 * @type {Array<{ tipoCulto: string, diaSemana: number, hora: string, titulo: string, tipo: string }>}
 */
const AGENDA_FIXA = Object.freeze([
  {
    tipo:      'culto',
    tipoCulto: 'sabado-manha',
    diaSemana: DIA.SABADO,
    hora:      '09:00',
    titulo:    'Culto de Sábado de manhã',
  },
  {
    tipo:      'ensaio-oficial',
    tipoCulto: 'ensaio-sexta',
    diaSemana: DIA.SEXTA,
    hora:      '19:30',
    titulo:    'Ensaio Oficial (Sexta)',
  },
  {
    tipo:      'culto',
    tipoCulto: 'domingo-noite',
    diaSemana: DIA.DOMINGO,
    hora:      '19:00',
    titulo:    'Culto de Domingo à noite',
  },
  {
    tipo:      'culto',
    tipoCulto: 'quarta-noite',
    diaSemana: DIA.QUARTA,
    hora:      '19:30',
    titulo:    'Culto de Quarta à noite',
  },
]);

/**
 * @typedef {Object} ItemAgenda
 * @property {string}  id          — identificador único gerado
 * @property {string}  tipo        — 'culto' | 'ensaio-oficial' | 'ensaio-extra' | 'evento-especial'
 * @property {string}  tipoCulto   — subtipo específico
 * @property {string}  titulo
 * @property {string}  dataISO     — 'YYYY-MM-DD'
 * @property {string}  hora
 * @property {string}  diaSemanaLabel — 'Sábado', 'Sexta', etc.
 * @property {boolean} fixo        — true = gerado pelo piloto automático
 * @property {number|null} escalaId — ID da escala no IDB (null se não criada)
 */


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS DE DATA
═══════════════════════════════════════════════════════════════════ */

const NOMES_DIA = Object.freeze([
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
]);

const NOMES_MES = Object.freeze([
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]);

/**
 * Formata uma data para string ISO (YYYY-MM-DD) sem conversão de fuso.
 * @param {Date} data
 * @returns {string}
 */
function paraISO(data) {
  const ano  = data.getFullYear();
  const mes  = String(data.getMonth() + 1).padStart(2, '0');
  const dia  = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Constrói um objeto Date a partir de uma string ISO (sem conversão de fuso).
 * @param {string} iso — 'YYYY-MM-DD'
 * @returns {Date}
 */
function deISO(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Formata uma data para exibição legível em pt-BR.
 * @param {string} iso
 * @returns {string} — ex: 'Sábado, 16 ago'
 */
function formatarDataExibicao(iso) {
  const d = deISO(iso);
  return `${NOMES_DIA[d.getDay()]}, ${d.getDate()} ${NOMES_MES[d.getMonth()]}`;
}

/**
 * Retorna a data ISO do início (segunda-feira) da semana de uma data.
 * @param {Date} data
 * @returns {Date}
 */
function inicioSemana(data) {
  const d    = new Date(data);
  const dia  = d.getDay(); // 0 = dom
  const diff = dia === 0 ? -6 : 1 - dia; // segunda como início
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Retorna a próxima ocorrência de um dia da semana a partir de uma data.
 * @param {Date}   dataBase
 * @param {number} diaSemana — 0–6
 * @returns {Date}
 */
function proximoDiaSemana(dataBase, diaSemana) {
  const d    = new Date(dataBase);
  const atual = d.getDay();
  let diff    = diaSemana - atual;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 7; // já passou hoje, pega a próxima
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Verifica se duas strings ISO representam o mesmo dia.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function mesmaData(a, b) {
  return a.slice(0, 10) === b.slice(0, 10);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ GERADOR DA AGENDA FIXA (Piloto Automático)
═══════════════════════════════════════════════════════════════════ */

/**
 * Gera todos os itens da agenda fixa para um intervalo de datas.
 *
 * @param {string} dataInicio — ISO 'YYYY-MM-DD'
 * @param {string} dataFim    — ISO 'YYYY-MM-DD'
 * @returns {ItemAgenda[]}
 */
function gerarAgendaFixa(dataInicio, dataFim) {
  const inicio = deISO(dataInicio);
  const fim    = deISO(dataFim);
  const itens  = [];

  // Para cada definição fixa, gera todas as ocorrências no período
  AGENDA_FIXA.forEach(def => {
    let cursor = new Date(inicio);
    const diaAtual = cursor.getDay();
    const diff     = ((def.diaSemana - diaAtual) + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= fim) {
      const iso = paraISO(cursor);

      itens.push({
        id:             `fixo-${def.tipoCulto}-${iso}`,
        tipo:           def.tipo,
        tipoCulto:      def.tipoCulto,
        titulo:         def.titulo,
        dataISO:        iso,
        hora:           def.hora,
        diaSemanaLabel: NOMES_DIA[cursor.getDay()],
        dataExibicao:   formatarDataExibicao(iso),
        fixo:           true,
        escalaId:       null,  // será preenchido ao cruzar com IDB
      });

      cursor.setDate(cursor.getDate() + 7);
    }
  });

  // Ordena por data e hora
  itens.sort((a, b) => {
    const cmpData = a.dataISO.localeCompare(b.dataISO);
    if (cmpData !== 0) return cmpData;
    return a.hora.localeCompare(b.hora);
  });

  return itens;
}

/**
 * Gera a agenda de uma semana específica a partir de qualquer data nela.
 * @param {Date|string} [referencia] — data de referência (default: hoje)
 * @returns {ItemAgenda[]}
 */
function agendaDaSemana(referencia) {
  const base  = referencia ? (typeof referencia === 'string' ? deISO(referencia) : referencia) : new Date();
  const inicio = inicioSemana(base);
  const fim    = new Date(inicio);
  fim.setDate(fim.getDate() + 6);
  return gerarAgendaFixa(paraISO(inicio), paraISO(fim));
}

/**
 * Retorna o próximo item fixo da agenda a partir de hoje.
 * @returns {ItemAgenda|null}
 */
function proximoItemFixo() {
  const hoje = new Date();
  const iso  = paraISO(hoje);
  const proximas = gerarAgendaFixa(iso, (() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 14);
    return paraISO(d);
  })());

  const agora = hoje.getHours() * 60 + hoje.getMinutes();

  return proximas.find(item => {
    if (item.dataISO > iso) return true;
    if (item.dataISO === iso) {
      const [h, m] = item.hora.split(':').map(Number);
      return (h * 60 + m) > agora;
    }
    return false;
  }) ?? null;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CRUZAMENTO COM O BANCO (enrichment)
   Carrega escalas salvas no IDB e as vincula aos itens da agenda.
═══════════════════════════════════════════════════════════════════ */

/**
 * Enriquece uma lista de itens da agenda com dados do IDB.
 * Adiciona escalaId, músicas e alocações onde existirem.
 *
 * @param {ItemAgenda[]} itens
 * @returns {Promise<ItemAgenda[]>}
 */
async function enriquecerComBanco(itens) {
  if (!itens.length) return itens;

  const dataMin = itens[0].dataISO;
  const dataMax = itens[itens.length - 1].dataISO;

  let escalasDB;
  try {
    escalasDB = await DB.escalas.listarPorPeriodo(dataMin, dataMax);
  } catch {
    // Banco ainda não tem dados — retorna itens sem enriquecimento
    return itens;
  }

  // Mapeia por tipoCulto+data para busca rápida
  const mapa = new Map();
  escalasDB.forEach(e => {
    mapa.set(`${e.tipoCulto}-${e.dataISO}`, e);
  });

  return itens.map(item => {
    const chave   = `${item.tipoCulto}-${item.dataISO}`;
    const escala  = mapa.get(chave);
    if (escala) {
      return { ...item, escalaId: escala.id, musicaIds: escala.musicaIds ?? [] };
    }
    return item;
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ■ REGRA: ENSAIO DE SEXTA VINCULADO AO SÁBADO
   Quem está na escala do sábado está automaticamente no ensaio de sexta.
═══════════════════════════════════════════════════════════════════ */

/**
 * Dado um item de ensaio de sexta, retorna a escalaId do sábado
 * correspondente (mesma semana).
 * @param {ItemAgenda} itemSexta
 * @param {ItemAgenda[]} todosItens
 * @returns {ItemAgenda|undefined}
 */
function sabadoDaMesmaSemana(itemSexta, todosItens) {
  const sexta  = deISO(itemSexta.dataISO);
  const sabado = new Date(sexta);
  sabado.setDate(sabado.getDate() + 1); // sexta + 1 = sábado
  const isoSabado = paraISO(sabado);

  return todosItens.find(
    i => i.tipoCulto === 'sabado-manha' && i.dataISO === isoSabado
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ■ ALERTA DE REPETIÇÃO DE MÚSICA
═══════════════════════════════════════════════════════════════════ */

/**
 * Verifica se alguma música se repete no mesmo dia entre as escalas informadas.
 * Emite evento '7tom:musica-repetida' para cada conflito encontrado.
 *
 * @param {Array<{ dataISO: string, titulo: string, musicaIds: number[] }>} escalas
 * @returns {Array<{ musicaId: number, datas: string[], titulos: string[] }>}
 */
function verificarRepeticoes(escalas) {
  // Agrupa músicas por data
  /** @type {Map<string, Map<number, string[]>>} */
  const porData = new Map();

  escalas.forEach(({ dataISO, titulo, musicaIds = [] }) => {
    if (!porData.has(dataISO)) porData.set(dataISO, new Map());
    const mapaDia = porData.get(dataISO);

    musicaIds.forEach(id => {
      if (!mapaDia.has(id)) mapaDia.set(id, []);
      mapaDia.get(id).push(titulo);
    });
  });

  const conflitos = [];

  porData.forEach((mapaDia, dataISO) => {
    mapaDia.forEach((titulos, musicaId) => {
      if (titulos.length > 1) {
        const conflito = { musicaId, dataISO, titulos };
        conflitos.push(conflito);

        // Emite evento para a UI exibir o alerta
        document.dispatchEvent(new CustomEvent('7tom:musica-repetida', {
          detail:  conflito,
          bubbles: false,
        }));

        console.warn(
          `[Agenda 7° Tom] Música ID ${musicaId} repetida em ${dataISO}:`,
          titulos.join(', ')
        );
      }
    });
  });

  return conflitos;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ AGENDA DINÂMICA — EVENTOS EXTRAS
═══════════════════════════════════════════════════════════════════ */

/**
 * Cria um evento dinâmico (ensaio extra ou evento especial) no IDB.
 * @param {{
 *   tipo:       'ensaio-extra'|'evento-especial',
 *   titulo:     string,
 *   dataISO:    string,
 *   horaInicio: string,
 *   local?:     string,
 *   descricao?: string,
 *   criadorCPF: string,
 * }} dados
 * @returns {Promise<number>} — id do evento criado
 */
async function criarEventoDinamico(dados) {
  const id = await DB.eventos.salvar({
    ...dados,
    aberto: true,
  });

  // Notifica outros módulos sobre o novo evento
  document.dispatchEvent(new CustomEvent('7tom:evento-criado', {
    detail:  { id, ...dados },
    bubbles: false,
  }));

  console.info(`[Agenda 7° Tom] Evento criado: "${dados.titulo}" em ${dados.dataISO}`);
  return id;
}

/**
 * Registra (ou atualiza) a resposta voluntária de um usuário a um evento.
 * @param {{
 *   eventoId:  number,
 *   cpf:       string,
 *   status:    'confirmado'|'talvez'|'nao-posso',
 *   mensagem?: string,
 * }} dados
 * @returns {Promise<void>}
 */
async function responderEvento(dados) {
  await DB.respostas.salvar(dados);

  document.dispatchEvent(new CustomEvent('7tom:resposta-salva', {
    detail:  dados,
    bubbles: false,
  }));
}

/**
 * Carrega os eventos dinâmicos futuros e os formata para exibição.
 * @returns {Promise<Array>}
 */
async function listarEventosDinamicos() {
  try {
    const eventos = await DB.eventos.listarFuturos();
    return eventos.map(e => ({
      ...e,
      dataExibicao: formatarDataExibicao(e.dataISO),
      diaSemanaLabel: NOMES_DIA[deISO(e.dataISO).getDay()],
    }));
  } catch {
    return [];
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ■ AGENDA COMPLETA (fixa + dinâmica)
   Mescla e ordena tudo para um período.
═══════════════════════════════════════════════════════════════════ */

/**
 * Retorna a agenda completa (fixa enriquecida + eventos dinâmicos)
 * para um intervalo de datas.
 *
 * @param {string} dataInicio
 * @param {string} dataFim
 * @returns {Promise<ItemAgenda[]>}
 */
async function agendaCompleta(dataInicio, dataFim) {
  // Gera e enriquece a agenda fixa
  const fixos    = gerarAgendaFixa(dataInicio, dataFim);
  const fixosRich = await enriquecerComBanco(fixos);

  // Carrega eventos dinâmicos do banco
  let dinamicos = [];
  try {
    const eventosDB = await DB.eventos.listarFuturos();
    dinamicos = eventosDB
      .filter(e => e.dataISO >= dataInicio && e.dataISO <= dataFim)
      .map(e => ({
        id:             `evento-${e.id}`,
        tipo:           e.tipo,
        tipoCulto:      e.tipo,
        titulo:         e.titulo,
        dataISO:        e.dataISO,
        hora:           e.horaInicio,
        diaSemanaLabel: NOMES_DIA[deISO(e.dataISO).getDay()],
        dataExibicao:   formatarDataExibicao(e.dataISO),
        fixo:           false,
        escalaId:       null,
        eventoId:       e.id,
        aberto:         e.aberto,
      }));
  } catch { /* banco vazio — ignora */ }

  // Mescla e ordena
  const todos = [...fixosRich, ...dinamicos];
  todos.sort((a, b) => {
    const cmpData = a.dataISO.localeCompare(b.dataISO);
    if (cmpData !== 0) return cmpData;
    return a.hora.localeCompare(b.hora);
  });

  return todos;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EXPORTAÇÃO
═══════════════════════════════════════════════════════════════════ */
export const Agenda = {
  // Agenda fixa
  gerarAgendaFixa,
  agendaDaSemana,
  proximoItemFixo,
  enriquecerComBanco,
  sabadoDaMesmaSemana,

  // Agenda dinâmica
  criarEventoDinamico,
  responderEvento,
  listarEventosDinamicos,

  // Agenda completa
  agendaCompleta,

  // Alertas
  verificarRepeticoes,

  // Utilitários de data (úteis para telas)
  paraISO,
  deISO,
  formatarDataExibicao,
  mesmaData,
  NOMES_DIA,
  NOMES_MES,
};
