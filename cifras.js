/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — cifras.js
 *  Motor de Cifras: Parser · Transpositor · Renderizador
 *
 *  Funcionalidades:
 *    • Detecta acordes inline no texto da cifra (ex: [G] [Am] [F#m7])
 *    • Transpõe todos os acordes para qualquer tom com um clique
 *    • Renderiza a cifra em HTML com acordes destacados
 *    • Suporta sustenidos (#) e bemóis (b) com conversão automática
 *    • Modo "só letra" (oculta acordes para quem só canta)
 *    • Detecta o tom original da cifra automaticamente
 *    • Capo: calcula qual casa usar para tocar em tom diferente
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';


/* ═══════════════════════════════════════════════════════════════════
   ■ TABELAS CROMÁTICAS
═══════════════════════════════════════════════════════════════════ */

/**
 * Escala cromática com sustenidos (padrão para transposição).
 * Índice 0 = C, índice 1 = C#, …, índice 11 = B
 */
const CROMATICA_S = Object.freeze([
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
]);

/**
 * Escala cromática com bemóis (usada em tons que preferem bemóis).
 */
const CROMATICA_B = Object.freeze([
  'C', 'Db', 'D', 'Eb', 'E', 'F',
  'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
]);

/**
 * Tons que naturalmente usam bemóis na notação.
 */
const TONS_COM_BEMOL = new Set([
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm',
]);

/**
 * Todos os tons principais (maior e menor) para o seletor de tom.
 */
const TONS_DISPONIVEIS = Object.freeze([
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm',
  'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm',
]);

/**
 * Nomes completos dos tons para exibição.
 */
const NOME_TOM = Object.freeze({
  'C': 'Dó maior',    'Cm': 'Dó menor',
  'C#': 'Dó# maior', 'C#m': 'Dó# menor',
  'Db': 'Réb maior',  'Dbm': 'Réb menor',
  'D': 'Ré maior',    'Dm': 'Ré menor',
  'D#': 'Ré# maior', 'D#m': 'Ré# menor',
  'Eb': 'Mib maior',  'Ebm': 'Mib menor',
  'E': 'Mi maior',    'Em': 'Mi menor',
  'F': 'Fá maior',    'Fm': 'Fá menor',
  'F#': 'Fá# maior', 'F#m': 'Fá# menor',
  'Gb': 'Solb maior', 'Gbm': 'Solb menor',
  'G': 'Sol maior',   'Gm': 'Sol menor',
  'G#': 'Sol# maior','G#m': 'Sol# menor',
  'Ab': 'Láb maior',  'Abm': 'Láb menor',
  'A': 'Lá maior',    'Am': 'Lá menor',
  'A#': 'Lá# maior', 'A#m': 'Lá# menor',
  'Bb': 'Sib maior',  'Bbm': 'Sib menor',
  'B': 'Si maior',    'Bm': 'Si menor',
});


/* ═══════════════════════════════════════════════════════════════════
   ■ REGEX PARA DETECÇÃO DE ACORDES
═══════════════════════════════════════════════════════════════════ */

/**
 * Detecta acordes no formato [Acorde] dentro do texto da cifra.
 * Exemplos válidos: [G] [Am] [C#m7] [F#/A#] [Bb/D] [G7M] [Em7(b5)]
 */
const REGEX_ACORDE_COLCHETE = /\[([A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add)?(?:\d+)?(?:[#b]\d+)?(?:\/[A-G][#b]?)?)\]/g;

/**
 * Detecta a nota raiz de um acorde (ex: 'C#' de 'C#m7').
 */
const REGEX_NOTA_RAIZ = /^([A-G][#b]?)/;

/**
 * Detecta se uma linha inteira contém apenas acordes e espaços.
 * Usado para distinguir linhas de acorde de linhas de letra.
 */
const REGEX_LINHA_ACORDE = /^(\s*\[([A-G][#b]?[^\]]*)\])+\s*$/;


/* ═══════════════════════════════════════════════════════════════════
   ■ UTILITÁRIOS DE ACORDE
═══════════════════════════════════════════════════════════════════ */

/**
 * Converte enarmônicos para forma canônica (Db→C#, Eb→D#, etc.)
 * mas respeita a preferência do tom destino.
 * @param {string} nota
 * @returns {string}
 */
function normalizarNota(nota) {
  const mapa = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
  return mapa[nota] ?? nota;
}

/**
 * Retorna o índice cromático de uma nota (0–11).
 * @param {string} nota — ex: 'C', 'F#', 'Bb'
 * @returns {number} — -1 se não encontrado
 */
function indiceCromatico(nota) {
  const normalizada = normalizarNota(nota);
  return CROMATICA_S.indexOf(normalizada);
}

/**
 * Retorna a nota no índice cromático, preferindo bemóis se o tom destino usar.
 * @param {number} indice   — 0–11
 * @param {string} tomDestino — para decidir # ou b
 * @returns {string}
 */
function notaNoIndice(indice, tomDestino = '') {
  const idx = ((indice % 12) + 12) % 12;
  if (TONS_COM_BEMOL.has(tomDestino)) {
    return CROMATICA_B[idx];
  }
  return CROMATICA_S[idx];
}

/**
 * Extrai a nota raiz de um acorde completo.
 * @param {string} acorde — ex: 'C#m7', 'F#/A#'
 * @returns {string} — ex: 'C#'
 */
function extrairRaiz(acorde) {
  const match = acorde.match(REGEX_NOTA_RAIZ);
  return match ? match[1] : acorde;
}

/**
 * Transpõe uma única nota (sem sufixo) por N semitons.
 * @param {string} nota
 * @param {number} semitons
 * @param {string} tomDestino
 * @returns {string}
 */
function transporNota(nota, semitons, tomDestino) {
  const idx = indiceCromatico(nota);
  if (idx === -1) return nota; // nota desconhecida — devolve intacta
  return notaNoIndice(idx + semitons, tomDestino);
}

/**
 * Transpõe um acorde completo (incluindo sufixo e baixo) por N semitons.
 * @param {string} acorde    — ex: 'C#m7/G#'
 * @param {number} semitons
 * @param {string} tomDestino
 * @returns {string}
 */
function transporAcorde(acorde, semitons, tomDestino) {
  if (semitons === 0) return acorde;

  // Trata baixo alternativo (ex: G/B → partes: 'G' e 'B')
  const partes = acorde.split('/');

  return partes.map(parte => {
    const raizMatch = parte.match(REGEX_NOTA_RAIZ);
    if (!raizMatch) return parte;

    const raiz   = raizMatch[1];
    const sufixo = parte.slice(raiz.length);
    const novaRaiz = transporNota(raiz, semitons, tomDestino);
    return novaRaiz + sufixo;
  }).join('/');
}

/**
 * Calcula a diferença em semitons entre dois tons.
 * @param {string} tomOrigem
 * @param {string} tomDestino
 * @returns {number} — 0–11
 */
function calcularSemitons(tomOrigem, tomDestino) {
  const raizOrigem  = extrairRaiz(tomOrigem);
  const raizDestino = extrairRaiz(tomDestino);
  const idxOrigem   = indiceCromatico(raizOrigem);
  const idxDestino  = indiceCromatico(raizDestino);

  if (idxOrigem === -1 || idxDestino === -1) return 0;

  return ((idxDestino - idxOrigem) + 12) % 12;
}

/**
 * Detecta o tom mais provável de uma cifra analisando os acordes.
 * Usa heurística simples: o acorde mais frequente é provavelmente o tom.
 * @param {string} textoCifra
 * @returns {string|null}
 */
function detectarTom(textoCifra) {
  const acordes = [];
  let match;
  const regex = new RegExp(REGEX_ACORDE_COLCHETE.source, 'g');

  while ((match = regex.exec(textoCifra)) !== null) {
    acordes.push(match[1]);
  }

  if (!acordes.length) return null;

  // Conta frequência de cada nota raiz
  const freq = new Map();
  acordes.forEach(acorde => {
    const raiz = extrairRaiz(acorde);
    freq.set(raiz, (freq.get(raiz) ?? 0) + 1);
  });

  // Retorna a nota raiz mais frequente
  let maxFreq = 0;
  let tomDetectado = null;
  freq.forEach((contagem, nota) => {
    if (contagem > maxFreq) {
      maxFreq = contagem;
      tomDetectado = nota;
    }
  });

  return tomDetectado;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ TRANSPOSITORES DE TEXTO COMPLETO
═══════════════════════════════════════════════════════════════════ */

/**
 * Transpõe todos os acordes de um texto de cifra.
 * @param {string} textoCifra     — texto com acordes no formato [Acorde]
 * @param {number} semitons       — quantos semitons subir (positivo) ou descer (negativo)
 * @param {string} [tomDestino]   — tom destino (para decidir # ou b)
 * @returns {string}
 */
function transporCifra(textoCifra, semitons, tomDestino = '') {
  if (semitons === 0) return textoCifra;

  return textoCifra.replace(
    new RegExp(REGEX_ACORDE_COLCHETE.source, 'g'),
    (_, acorde) => `[${transporAcorde(acorde, semitons, tomDestino)}]`
  );
}

/**
 * Transpõe a cifra de um tom de origem para um tom de destino.
 * @param {string} textoCifra
 * @param {string} tomOrigem    — ex: 'G'
 * @param {string} tomDestino   — ex: 'A'
 * @returns {string}
 */
function transporDeTomParaTom(textoCifra, tomOrigem, tomDestino) {
  const semitons = calcularSemitons(tomOrigem, tomDestino);
  return transporCifra(textoCifra, semitons, tomDestino);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ CÁLCULO DE CAPO
═══════════════════════════════════════════════════════════════════ */

/**
 * Sugere o uso de capo para facilitar a digitação.
 * Retorna até 3 opções: casa + tom real resultante.
 *
 * Exemplo: tom original G, musicista quer tocar fácil
 *   → capo 2 toca em A mas soa em G... na verdade:
 *   → capo 5 em D soa como G
 *
 * @param {string} tomOriginal — tom da cifra
 * @returns {Array<{ casa: number, tocarEm: string, soaEm: string }>}
 */
function sugerirCapo(tomOriginal) {
  const TONS_FACEIS = ['C', 'D', 'E', 'G', 'Am', 'Em', 'Dm'];
  const sugestoes = [];

  for (let casa = 1; casa <= 7; casa++) {
    const idxOriginal = indiceCromatico(extrairRaiz(tomOriginal));
    if (idxOriginal === -1) break;

    // O tom para tocar é o original deslocado N semitons para baixo
    const idxTocar = ((idxOriginal - casa) + 12) % 12;
    const tocarEm  = notaNoIndice(idxTocar, '');

    if (TONS_FACEIS.includes(tocarEm) || TONS_FACEIS.includes(tocarEm + 'm')) {
      sugestoes.push({
        casa,
        tocarEm,
        soaEm: tomOriginal,
      });

      if (sugestoes.length >= 3) break;
    }
  }

  return sugestoes;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ RENDERIZADOR HTML
   Converte texto de cifra em HTML semântico e estilizável.
═══════════════════════════════════════════════════════════════════ */

/**
 * Tipos de linha para renderização diferenciada.
 */
const TIPO_LINHA = Object.freeze({
  ACORDE:  'acorde',
  LETRA:   'letra',
  SECAO:   'secao',   // [Intro], [Verso 1], [Refrão], etc.
  VAZIA:   'vazia',
});

/**
 * Classifica uma linha da cifra.
 * @param {string} linha
 * @returns {string} — TIPO_LINHA
 */
function classificarLinha(linha) {
  const trimada = linha.trim();
  if (!trimada) return TIPO_LINHA.VAZIA;

  // Seção: linha entre parênteses ou colchetes sem nota musical
  // ex: (Intro), [Refrão], [Verso 1]
  if (/^\[?[^A-G\[]/.test(trimada) && /^\(.*\)$|^\[(?![A-G]).*\]$/.test(trimada)) {
    return TIPO_LINHA.SECAO;
  }

  // Linha só de acordes: contém [X] e pouca ou nenhuma letra fora deles
  const semAcordes = trimada.replace(REGEX_ACORDE_COLCHETE, '').trim();
  const temAcordes = REGEX_ACORDE_COLCHETE.test(trimada);
  REGEX_ACORDE_COLCHETE.lastIndex = 0; // reset

  if (temAcordes && semAcordes.length === 0) return TIPO_LINHA.ACORDE;

  return TIPO_LINHA.LETRA;
}

/**
 * Renderiza um acorde individual como HTML.
 * @param {string} acorde — sem colchetes
 * @returns {string}
 */
function renderizarAcorde(acorde) {
  return `<span class="cifra-acorde" data-acorde="${acorde}">${acorde}</span>`;
}

/**
 * Renderiza uma linha que mistura letra e acordes inline.
 * @param {string} linha
 * @returns {string}
 */
function renderizarLinhaComAcordes(linha) {
  return linha.replace(
    new RegExp(REGEX_ACORDE_COLCHETE.source, 'g'),
    (_, acorde) => renderizarAcorde(acorde)
  );
}

/**
 * Converte o texto completo de uma cifra em HTML pronto para exibição.
 *
 * @param {string}  textoCifra
 * @param {Object}  [opcoes]
 * @param {boolean} [opcoes.soLetra=false]    — omite linhas de acorde
 * @param {boolean} [opcoes.compacto=false]   — remove linhas vazias extras
 * @returns {string} — HTML string
 */
function renderizarCifra(textoCifra, opcoes = {}) {
  const { soLetra = false, compacto = false } = opcoes;

  if (!textoCifra) return '<p class="cifra-vazia">Cifra não disponível.</p>';

  const linhas = textoCifra.split('\n');
  const partes = [];
  let vaziaConsecutiva = 0;

  linhas.forEach(linha => {
    const tipo = classificarLinha(linha);

    // Em modo compacto, limita linhas vazias consecutivas a 1
    if (tipo === TIPO_LINHA.VAZIA) {
      vaziaConsecutiva++;
      if (!compacto || vaziaConsecutiva <= 1) {
        partes.push('<span class="cifra-linha cifra-linha-vazia">&nbsp;</span>');
      }
      return;
    }
    vaziaConsecutiva = 0;

    // Seção: [Verso 1], (Refrão), etc.
    if (tipo === TIPO_LINHA.SECAO) {
      const texto = linha.trim().replace(/^\[|\]$/g, '').replace(/^\(|\)$/g, '');
      partes.push(`<span class="cifra-linha cifra-secao">${texto}</span>`);
      return;
    }

    // Linha de acordes puros: omite se soLetra=true
    if (tipo === TIPO_LINHA.ACORDE) {
      if (!soLetra) {
        const html = renderizarLinhaComAcordes(linha);
        partes.push(`<span class="cifra-linha cifra-linha-acorde">${html}</span>`);
      }
      return;
    }

    // Linha de letra (pode ter acordes inline)
    const html = renderizarLinhaComAcordes(linha);
    partes.push(`<span class="cifra-linha cifra-linha-letra">${html}</span>`);
  });

  return `<div class="cifra-corpo">${partes.join('\n')}</div>`;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ COMPONENTE DE CIFRA INTERATIVA
   Gerencia o DOM de uma cifra com controles de tom e modo.
═══════════════════════════════════════════════════════════════════ */

/**
 * Cria e gerencia um componente de cifra interativo em um elemento container.
 *
 * @param {HTMLElement} container — onde a cifra será renderizada
 * @param {Object}      musica    — objeto do DB com { titulo, tom, cifra }
 * @returns {Object}              — instância com métodos de controle
 */
function criarComponenteCifra(container, musica) {
  if (!container || !musica) return null;

  let tomAtual   = musica.tom || detectarTom(musica.cifra) || 'C';
  let tomOriginal = tomAtual;
  let soLetra    = false;
  let tamanhoFonte = 16; // px

  const MIN_FONTE = 12;
  const MAX_FONTE = 24;

  /**
   * Re-renderiza a cifra no container com o estado atual.
   */
  function renderizar() {
    const cifraTransposta = tomAtual !== tomOriginal
      ? transporDeTomParaTom(musica.cifra, tomOriginal, tomAtual)
      : musica.cifra;

    const html = renderizarCifra(cifraTransposta, { soLetra });

    // Mantém o container de cifra sem recriar os controles
    let corpoEl = container.querySelector('.cifra-wrapper');
    if (!corpoEl) {
      container.innerHTML = '';
      corpoEl = document.createElement('div');
      corpoEl.className = 'cifra-wrapper';
      container.appendChild(corpoEl);
    }

    corpoEl.innerHTML = html;
    corpoEl.style.fontSize = `${tamanhoFonte}px`;

    // Emite evento de renderização para outros módulos
    container.dispatchEvent(new CustomEvent('cifra:renderizada', {
      detail: { tomAtual, tomOriginal, soLetra },
      bubbles: true,
    }));
  }

  /**
   * Transpõe N semitons em relação ao tom original.
   * @param {number} delta — +1, -1, ou quantidade específica
   */
  function transporPor(delta) {
    const idxAtual = indiceCromatico(extrairRaiz(tomAtual));
    if (idxAtual === -1) return;

    const novoIdx  = ((idxAtual + delta) + 12) % 12;
    const usaBemol = TONS_COM_BEMOL.has(tomAtual);
    tomAtual = usaBemol ? CROMATICA_B[novoIdx] : CROMATICA_S[novoIdx];
    renderizar();
  }

  function aumentarFonte() {
    if (tamanhoFonte < MAX_FONTE) { tamanhoFonte += 1; renderizar(); }
  }

  function diminuirFonte() {
    if (tamanhoFonte > MIN_FONTE) { tamanhoFonte -= 1; renderizar(); }
  }

  function alternarSoLetra() {
    soLetra = !soLetra;
    renderizar();
  }

  function resetarTom() {
    tomAtual = tomOriginal;
    renderizar();
  }

  // Renderiza na primeira chamada
  renderizar();

  return {
    renderizar,
    transporPor,
    aumentarFonte,
    diminuirFonte,
    alternarSoLetra,
    resetarTom,
    get tomAtual()   { return tomAtual; },
    get tomOriginal(){ return tomOriginal; },
    get soLetra()    { return soLetra; },
    get tamanhoFonte(){ return tamanhoFonte; },
  };
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EXPORTAÇÃO
═══════════════════════════════════════════════════════════════════ */
export const Cifras = {
  // Tabelas
  TONS_DISPONIVEIS,
  NOME_TOM,
  CROMATICA_S,
  CROMATICA_B,

  // Utilitários de notas e acordes
  indiceCromatico,
  extrairRaiz,
  transporNota,
  transporAcorde,
  calcularSemitons,
  detectarTom,

  // Transposição de texto
  transporCifra,
  transporDeTomParaTom,

  // Capo
  sugerirCapo,

  // Renderização
  renderizarCifra,
  renderizarAcorde,
  classificarLinha,
  TIPO_LINHA,

  // Componente interativo
  criarComponenteCifra,
};
