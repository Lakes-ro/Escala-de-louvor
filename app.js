/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — app.js
 *  Motor principal da SPA. ES Modules puro — zero dependências.
 *
 *  Módulos inicializados neste arquivo:
 *    1. Tema (claro/escuro) — persiste em localStorage
 *    2. Máscara de CPF em tempo real (000.000.000-00)
 *    3. Validação do formulário de acesso
 *    4. Sistema de Toast (notificações)
 *    5. Registro do Service Worker (PWA)
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';


/* ═══════════════════════════════════════════════════════════════════
   ■ CONSTANTES & CONFIGURAÇÃO
═══════════════════════════════════════════════════════════════════ */
const CONFIG = Object.freeze({
  CHAVE_TEMA:      '7tom:tema',
  TEMA_ESCURO:     'tema-escuro',
  TEMA_CLARO:      'tema-claro',
  CPF_LIMPO_LEN:   11,            // CPF sem pontuação tem 11 dígitos
  TOAST_DURACAO:   4000,          // ms antes do toast desaparecer
  TOAST_SAIDA:     220,           // ms da animação de saída
});


/* ═══════════════════════════════════════════════════════════════════
   ■ MÓDULO: TEMA
   Responsabilidade única: alternar e persistir preferência de tema.
═══════════════════════════════════════════════════════════════════ */
const ModuloTema = (() => {

  let body = null;
  let btnTema = null;

  /**
   * Lê a preferência salva ou detecta a do sistema operacional.
   * @returns {'tema-escuro'|'tema-claro'}
   */
  function lerPreferencia() {
    const salvo = localStorage.getItem(CONFIG.CHAVE_TEMA);

    if (salvo === CONFIG.TEMA_ESCURO || salvo === CONFIG.TEMA_CLARO) {
      return salvo;
    }

    // Sem preferência salva: respeita configuração do SO
    const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefereEscuro ? CONFIG.TEMA_ESCURO : CONFIG.TEMA_CLARO;
  }

  /**
   * Aplica o tema ao <body> e atualiza os atributos de acessibilidade.
   * @param {'tema-escuro'|'tema-claro'} tema
   */
  function aplicarTema(tema) {
    const eEscuro = tema === CONFIG.TEMA_ESCURO;

    body.classList.toggle(CONFIG.TEMA_ESCURO, eEscuro);
    body.classList.toggle(CONFIG.TEMA_CLARO,  !eEscuro);

    // Atualiza meta theme-color para mobile (barra do navegador)
    const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaTheme) {
      metaTheme.content = eEscuro ? '#1e1d2e' : '#ffffff';
    }

    if (btnTema) {
      btnTema.setAttribute(
        'aria-label',
        eEscuro ? 'Alternar para modo claro' : 'Alternar para modo escuro'
      );
      btnTema.setAttribute('title',
        eEscuro ? 'Modo claro' : 'Modo escuro'
      );
    }
  }

  /**
   * Alterna entre os dois temas e salva a escolha.
   */
  function alternar() {
    const temaAtual = body.classList.contains(CONFIG.TEMA_ESCURO)
      ? CONFIG.TEMA_ESCURO
      : CONFIG.TEMA_CLARO;

    const novoTema = temaAtual === CONFIG.TEMA_ESCURO
      ? CONFIG.TEMA_CLARO
      : CONFIG.TEMA_ESCURO;

    aplicarTema(novoTema);
    localStorage.setItem(CONFIG.CHAVE_TEMA, novoTema);
  }

  /**
   * Inicializa o módulo. Deve ser chamado após o DOM estar pronto.
   */
  function init() {
    body    = document.body;
    btnTema = document.getElementById('btn-tema');

    if (!body) return;

    // Aplica tema inicial sem transição (evita flash na carga)
    body.style.transition = 'none';
    aplicarTema(lerPreferencia());
    // Força reflow e reativa transições
    void body.offsetHeight;
    body.style.transition = '';

    if (btnTema) {
      btnTema.addEventListener('click', alternar);
    }

    // Observa mudanças na preferência do SO (sem sobrescrever escolha manual)
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (evento) => {
        const temaSalvo = localStorage.getItem(CONFIG.CHAVE_TEMA);
        // Só reage se o usuário nunca escolheu manualmente
        if (!temaSalvo) {
          aplicarTema(evento.matches ? CONFIG.TEMA_ESCURO : CONFIG.TEMA_CLARO);
        }
      });
  }

  return { init };

})();


/* ═══════════════════════════════════════════════════════════════════
   ■ MÓDULO: MÁSCARA DE CPF
   Responsabilidade: formatar 000.000.000-00 enquanto o usuário digita.
═══════════════════════════════════════════════════════════════════ */
const ModuloCPF = (() => {

  /**
   * Remove tudo que não for dígito.
   * @param {string} valor
   * @returns {string}
   */
  function apenasDigitos(valor) {
    return valor.replace(/\D/g, '');
  }

  /**
   * Aplica a máscara 000.000.000-00 a uma string de dígitos.
   * @param {string} digitos — somente números
   * @returns {string}
   */
  function aplicarMascara(digitos) {
    // Limita a 11 dígitos
    const d = digitos.slice(0, CONFIG.CPF_LIMPO_LEN);

    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;

    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }

  /**
   * Valida algoritmicamente um CPF (dígitos verificadores).
   * @param {string} digitos — 11 dígitos sem pontuação
   * @returns {boolean}
   */
  function validar(digitos) {
    if (digitos.length !== CONFIG.CPF_LIMPO_LEN) return false;

    // Rejeita sequências triviais (111.111.111-11 etc.)
    if (/^(\d)\1{10}$/.test(digitos)) return false;

    function calcularDigito(parcial, pesoInicial) {
      let soma = 0;
      for (let i = 0; i < parcial.length; i++) {
        soma += parseInt(parcial[i], 10) * (pesoInicial - i);
      }
      const resto = (soma * 10) % 11;
      return resto >= 10 ? 0 : resto;
    }

    const digito1 = calcularDigito(digitos.slice(0, 9), 10);
    if (digito1 !== parseInt(digitos[9], 10)) return false;

    const digito2 = calcularDigito(digitos.slice(0, 10), 11);
    if (digito2 !== parseInt(digitos[10], 10)) return false;

    return true;
  }

  /**
   * Handler do evento 'input' no campo de CPF.
   * Aplica a máscara preservando a posição do cursor.
   * @param {InputEvent} evento
   */
  function aoDigitar(evento) {
    const input   = evento.target;
    const digitos = apenasDigitos(input.value);
    const mascarado = aplicarMascara(digitos);

    // Só atualiza se o valor mudou (evita loop de evento)
    if (input.value !== mascarado) {
      // Salva a posição do cursor antes de alterar o valor
      const posAnterior = input.selectionStart;
      const tamanhoAnterior = input.value.length;

      input.value = mascarado;

      // Restaura posição do cursor de forma aproximada
      const delta = mascarado.length - tamanhoAnterior;
      const novaPosicao = Math.max(0, posAnterior + delta);
      input.setSelectionRange(novaPosicao, novaPosicao);
    }

    // Remove estado de erro enquanto o usuário corrige
    limparErro(input);
  }

  /**
   * Handler do evento 'paste' — garante que só dígitos entrem.
   * @param {ClipboardEvent} evento
   */
  function aoColar(evento) {
    evento.preventDefault();
    const colado   = (evento.clipboardData || window.clipboardData).getData('text');
    const digitos  = apenasDigitos(colado);
    evento.target.value = aplicarMascara(digitos);
    limparErro(evento.target);
  }

  /**
   * Remove estado visual de erro do campo.
   * @param {HTMLInputElement} input
   */
  function limparErro(input) {
    input.classList.remove('estado-erro');
    const idErro = input.getAttribute('aria-describedby')
      ?.split(' ')
      .find(id => id.includes('erro'));
    if (idErro) {
      const elErro = document.getElementById(idErro);
      if (elErro) {
        elErro.textContent = '';
        elErro.hidden = true;
      }
    }
  }

  /**
   * Inicializa a máscara no input de CPF.
   */
  function init() {
    const input = document.getElementById('input-cpf');
    if (!input) return;

    input.addEventListener('input', aoDigitar);
    input.addEventListener('paste', aoColar);
  }

  // Exporta a função de validação para uso externo (formulário)
  return { init, validar, apenasDigitos };

})();


/* ═══════════════════════════════════════════════════════════════════
   ■ MÓDULO: TOAST
   Notificações não-intrusivas na tela.
═══════════════════════════════════════════════════════════════════ */
const ModuloToast = (() => {

  let areaToast = null;

  /**
   * Exibe um toast.
   * @param {string} mensagem
   * @param {'info'|'sucesso'|'aviso'|'erro'} tipo
   */
  function exibir(mensagem, tipo = 'info') {
    if (!areaToast) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    toast.textContent = mensagem;

    areaToast.appendChild(toast);

    // Remove após a duração definida
    const timer = setTimeout(() => {
      remover(toast);
    }, CONFIG.TOAST_DURACAO);

    // Permite dispensar com clique
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      remover(toast);
    }, { once: true });
  }

  function remover(toast) {
    toast.classList.add('saindo');
    setTimeout(() => toast.remove(), CONFIG.TOAST_SAIDA);
  }

  function init() {
    areaToast = document.getElementById('area-toast');
  }

  return { init, exibir };

})();


/* ═══════════════════════════════════════════════════════════════════
   ■ MÓDULO: FORMULÁRIO DE ACESSO
   Responsabilidade: validar CPF e iniciar fluxo de autenticação.
═══════════════════════════════════════════════════════════════════ */
const ModuloAcesso = (() => {

  /**
   * Exibe mensagem de erro no campo de CPF.
   * @param {string} mensagem
   */
  function mostrarErroCPF(mensagem) {
    const input  = document.getElementById('input-cpf');
    const elErro = document.getElementById('cpf-erro');

    if (input) input.classList.add('estado-erro');

    if (elErro) {
      elErro.textContent = mensagem;
      elErro.hidden = false;
    }
  }

  /**
   * Alterna o estado de carregamento do botão.
   * @param {boolean} carregando
   */
  function definirCarregando(carregando) {
    const btn     = document.getElementById('btn-entrar');
    const spinner = btn?.querySelector('.btn-spinner');
    const texto   = btn?.querySelector('.btn-texto');

    if (!btn) return;

    btn.disabled = carregando;
    btn.classList.toggle('carregando', carregando);

    if (spinner) spinner.hidden = !carregando;
    if (texto)   texto.textContent = carregando ? 'Verificando...' : 'Entrar';
  }

  /**
   * Handler do submit do formulário.
   * @param {SubmitEvent} evento
   */
  async function aoSubmeter(evento) {
    evento.preventDefault();

    const input   = document.getElementById('input-cpf');
    if (!input) return;

    const digitos = ModuloCPF.apenasDigitos(input.value);

    // ── Validação 1: campo vazio ──
    if (digitos.length === 0) {
      mostrarErroCPF('Informe seu CPF para continuar.');
      input.focus();
      return;
    }

    // ── Validação 2: CPF incompleto ──
    if (digitos.length < CONFIG.CPF_LIMPO_LEN) {
      mostrarErroCPF('CPF incompleto. Verifique os números digitados.');
      input.focus();
      return;
    }

    // ── Validação 3: CPF inválido (dígitos verificadores) ──
    if (!ModuloCPF.validar(digitos)) {
      mostrarErroCPF('CPF inválido. Confira e tente novamente.');
      input.focus();
      return;
    }

    // ── CPF válido: inicia fluxo de autenticação ──
    definirCarregando(true);

    try {
      // Simulação da verificação local (IndexedDB será implementado depois)
      // Por ora, apenas confirma que o CPF é válido estruturalmente.
      await new Promise(resolve => setTimeout(resolve, 800)); // simula I/O

      // TODO: consultar IndexedDB para verificar se CPF está cadastrado
      // Por agora, emite um toast informativo
      ModuloToast.exibir(
        `CPF reconhecido. Carregando seu perfil…`,
        'sucesso'
      );

      // TODO: navegar para a tela de perfil/dashboard
      console.info('[7° Tom] CPF válido. Redirecionar para dashboard.');

    } catch (erro) {
      console.error('[7° Tom] Erro ao verificar CPF:', erro);
      ModuloToast.exibir(
        'Não foi possível verificar o CPF. Tente novamente.',
        'erro'
      );
    } finally {
      definirCarregando(false);
    }
  }

  function init() {
    const form = document.getElementById('form-acesso');
    if (!form) return;

    form.addEventListener('submit', aoSubmeter);
  }

  return { init };

})();


/* ═══════════════════════════════════════════════════════════════════
   ■ MÓDULO: SERVICE WORKER (PWA)
   Registra o SW para funcionamento offline.
═══════════════════════════════════════════════════════════════════ */
const ModuloPWA = (() => {

  async function registrar() {
    if (!('serviceWorker' in navigator)) {
      console.info('[7° Tom] Service Worker não suportado neste navegador.');
      return;
    }

    try {
      const registro = await navigator.serviceWorker.register('sw.js', {
        scope: './'
      });
      console.info('[7° Tom] Service Worker registrado:', registro.scope);
    } catch (erro) {
      console.warn('[7° Tom] Falha ao registrar Service Worker:', erro);
    }
  }

  return { registrar };

})();


/* ═══════════════════════════════════════════════════════════════════
   ■ BOOTSTRAP — Inicialização da aplicação
   Ordem importa: Tema → Toast → CPF → Acesso → PWA
═══════════════════════════════════════════════════════════════════ */
function inicializar() {
  ModuloTema.init();
  ModuloToast.init();
  ModuloCPF.init();
  ModuloAcesso.init();

  // Registra SW de forma não-bloqueante
  ModuloPWA.registrar();

  console.info('[7° Tom] Aplicação inicializada.');
}

// Aguarda o DOM estar completamente carregado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  // DOMContentLoaded já disparou (script deferido ou módulo)
  inicializar();
}