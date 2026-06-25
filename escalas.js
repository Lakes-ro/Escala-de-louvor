// escalas.js
// Módulo responsável por buscar e renderizar escalas via RPC.
// Importado por app.js quando a rota #/escalas é ativada.

import { supabase } from './db-supabase.js';

// =========================================
// BUSCA REMOTA via RPC
// =========================================

/**
 * Retorna as escalas visíveis para o path do usuário logado.
 * Usa o operador <@ do ltree no banco: vê o próprio nó e todos os filhos.
 * @param {string} pathUsuario  ex: 'brasil.mg.igreja_central'
 * @returns {Promise<Array>}
 */
export async function buscarEscalas(pathUsuario) {
  const { data, error } = await supabase.rpc('listar_escalas_por_path', {
    path_usuario: pathUsuario
  });

  if (error) {
    console.error('[escalas] Erro ao buscar:', error.message);
    return [];
  }

  return data ?? [];
}

// =========================================
// HELPERS DE EXIBIÇÃO
// =========================================

const LABELS_EVENTO = {
  culto_sabado:   'Culto — Sábado',
  culto_domingo:  'Culto — Domingo',
  culto_quarta:   'Culto — Quarta',
  ensaio_oficial: 'Ensaio Oficial',
  ensaio_extra:   'Ensaio Extra',
  evento_especial:'Evento Especial',
};

function labelEvento(tipo) {
  return LABELS_EVENTO[tipo] ?? tipo;
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

// =========================================
// RENDERIZAÇÃO
// =========================================

/**
 * Injeta a lista de escalas num elemento container.
 * @param {HTMLElement} container
 * @param {Array}       escalas    resultado de buscarEscalas()
 */
export function renderizarEscalas(container, escalas) {
  if (!escalas.length) {
    container.innerHTML = `
      <p class="estado-vazio">Nenhuma escala encontrada para sua igreja.</p>
    `;
    return;
  }

  container.innerHTML = escalas
    .map(e => `
      <article class="card-escala" data-id="${e.id}">
        <span class="tag-evento">${labelEvento(e.tipo_evento)}</span>
        <h3 class="data-escala">${formatarData(e.data)}</h3>
        <p class="path-escala">${e.path}</p>
      </article>
    `)
    .join('');
}

// =========================================
// INICIALIZAR TELA DE ESCALAS
// Chamado por app.js ao navegar para #/escalas
// =========================================
export async function inicializarTelaEscalas() {
  const container = document.getElementById('lista-escalas');
  if (!container) return;

  container.innerHTML = `<p class="estado-carregando">Carregando escalas…</p>`;

  const sessao = JSON.parse(localStorage.getItem('7tom:usuario') ?? 'null');

  if (!sessao?.path) {
    container.innerHTML = `<p class="estado-vazio">Sessão inválida. Faça login novamente.</p>`;
    return;
  }

  const escalas = await buscarEscalas(sessao.path);
  renderizarEscalas(container, escalas);
}