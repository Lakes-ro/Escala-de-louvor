// ============================================================
// razonete.js — Módulo: Razonete Consolidado
// ============================================================

import { supabase } from './config.js';
import {
  showToast, allClientes, loadAllClientes, formatCurrency, formatDate
} from './admin.js';

export function initRazonete() {
  document.getElementById('razonete-filter-cliente').addEventListener('change', renderRazonete);
  document.getElementById('razonete-filter-tipo').addEventListener('change', renderRazonete);

  window.addEventListener('section:change', ({ detail }) => {
    if (detail.section === 'razonete') {
      popularFiltroClientes();
      renderRazonete();
    }
  });
}

// ── Popula o select de clientes no filtro ─────────────────────
async function popularFiltroClientes() {
  if (!allClientes.length) await loadAllClientes();

  const select = document.getElementById('razonete-filter-cliente');
  const valor  = select.value; // preserva seleção actual

  select.innerHTML = '<option value="">Todos</option>' +
    allClientes.map(c => `<option value="${c.id}" ${valor === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
}

// ── Renderiza lista do razonete ───────────────────────────────
async function renderRazonete() {
  const lista        = document.getElementById('razonete-list');
  const filtroCliente = document.getElementById('razonete-filter-cliente').value;
  const filtroTipo    = document.getElementById('razonete-filter-tipo').value;

  lista.innerHTML = '<p class="empty-state">Carregando...</p>';

  if (!allClientes.length) await loadAllClientes();

  // IDs dos clientes deste admin
  const clienteIds = filtroCliente
    ? [filtroCliente]
    : allClientes.map(c => c.id);

  if (!clienteIds.length) {
    lista.innerHTML = '<p class="empty-state">Nenhum cliente cadastrado.</p>';
    return;
  }

  // Monta query
  let query = supabase
    .from('transacoes')
    .select('id, valor, tipo, categoria, descricao, data, cliente_id')
    .in('cliente_id', clienteIds)
    .order('data', { ascending: false })
    .limit(200);

  if (filtroTipo) query = query.eq('tipo', filtroTipo);

  const { data, error } = await query;

  if (error) {
    showToast('Erro ao carregar razonete: ' + error.message, 'error');
    return;
  }

  if (!data?.length) {
    lista.innerHTML = '<p class="empty-state">Nenhuma transação encontrada.</p>';
    return;
  }

  lista.innerHTML = data.map(t => {
    const cliente   = allClientes.find(c => c.id === t.cliente_id);
    const isReceita = t.tipo === 'receita';
    const valor     = Math.abs(t.valor);

    return `
      <div class="razonete-item ${t.tipo}">
        <div class="razonete-item-info">
          <span class="razonete-cliente-nome ${isReceita ? '' : 'despesa'}">${cliente?.nome || '—'}</span>
          <span class="razonete-descricao">${t.categoria || t.descricao || '—'}</span>
          <span class="razonete-data">${formatDate(t.data)}</span>
        </div>
        <span class="razonete-valor ${isReceita ? 'positivo' : 'negativo'}">
          ${isReceita ? '+' : '-'}${formatCurrency(valor)}
        </span>
      </div>
    `;
  }).join('');
}
