// ============================================================
// admin.js — Controlador principal do SPA admin
// Responsável por: sessão, navegação entre secções, toast
// ============================================================

import { supabase } from './config.js';
import { signOut, checkSession } from './auth.js';
import { initClientes } from './clientes.js';
import { initDashboards } from './dashboards.js';
import { initMetas } from './metas.js';
import { initPlanejamentos } from './planejamentos.js';
import { initRazonete } from './razonete.js';

// ── Estado global da aplicação ───────────────────────────────
export let currentAdmin = null;
export let allClientes  = [];

// ── Inicialização ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Verifica sessão activa
  const session = await checkSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  // Carrega perfil do admin
  await loadAdminProfile(session.user);

  // Carrega clientes do admin (compartilhado entre módulos)
  await loadAllClientes();

  // Inicializa módulos
  initClientes();
  initDashboards();
  initMetas();
  initPlanejamentos();
  initRazonete();

  // Navegação sidebar
  setupNavigation();

  // Botão sair
  document.getElementById('btn-sair').addEventListener('click', () => signOut());

  // Fecha modais ao clicar no overlay ou no botão ✕
  setupModalClose();
});

// ── Carrega perfil do administrador ──────────────────────────
async function loadAdminProfile(user) {
  const { data } = await supabase
    .from('perfis')
    .select('nome, email, role')
    .eq('id', user.id)
    .single();

  if (data?.role !== 'admin') {
    // Utilizador não é admin — redireciona
    window.location.href = 'dashboard.html';
    return;
  }

  currentAdmin = { id: user.id, ...data };

  // Preenche informações do perfil
  document.getElementById('perfil-nome').textContent  = data.nome  || '—';
  document.getElementById('perfil-email').textContent = data.email || user.email || '—';
  document.getElementById('admin-subtitle').textContent = `Gerenciando seus clientes`;
}

// ── Carrega todos os clientes vinculados a este admin ────────
export async function loadAllClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, email, cpf, telefone')
    .eq('admin_id', currentAdmin?.id)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar clientes:', error);
    return;
  }

  allClientes = data || [];

  // Atualiza subtítulo com total
  document.getElementById('admin-subtitle').textContent =
    `Gerenciando ${allClientes.length} cliente(s)`;

  return allClientes;
}

// ── Navegação entre secções ────────────────────────────────
function setupNavigation() {
  const navItems  = document.querySelectorAll('.nav-item[data-section]');
  const sections  = document.querySelectorAll('.section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.section;

      // Atualiza botões
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Mostra secção correcta
      sections.forEach(s => s.classList.remove('active'));
      const targetSection = document.getElementById(`section-${target}`);
      if (targetSection) targetSection.classList.add('active');

      // Dispara evento para o módulo reinicializar o conteúdo
      window.dispatchEvent(new CustomEvent('section:change', { detail: { section: target } }));
    });
  });
}

// ── Fecha modais ──────────────────────────────────────────────
function setupModalClose() {
  // Botões com data-modal
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      closeModal(modalId);
    });
  });

  // Clique no overlay escuro
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

// ── Funções utilitárias exportadas para os módulos ───────────

export function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}
