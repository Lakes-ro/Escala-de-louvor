/**
 * ═══════════════════════════════════════════════════════════════════
 *  7° TOM — sw.js
 *  Service Worker — Estratégia Offline-First
 *
 *  Camadas de cache:
 *    SHELL   → arquivos do app (HTML, CSS, JS, manifest, fontes)
 *             Estratégia: Cache First — serve local, atualiza em bg
 *    DADOS   → cifras e escalas (gerados pelo app e salvos via IDB)
 *             O SW não gerencia IDB diretamente; cuida só dos assets.
 *    IMAGENS → partituras PDF e ícones
 *             Estratégia: Cache First com fallback de rede
 *    FONTES  → Google Fonts (cross-origin)
 *             Estratégia: Cache First (stale-while-revalidate)
 *
 *  Ciclo de vida:
 *    install  → pré-cacheia o Shell obrigatório
 *    activate → limpa caches antigos, reivindica clientes
 *    fetch    → intercepta requisições e aplica estratégia correta
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';


/* ═══════════════════════════════════════════════════════════════════
   ■ VERSÃO & NOMES DE CACHE
   Incrementar VERSAO_CACHE invalida e reconstrói todos os caches.
═══════════════════════════════════════════════════════════════════ */
const VERSAO_CACHE   = 'v2';
const CACHE_SHELL    = `7tom-shell-${VERSAO_CACHE}`;
const CACHE_ASSETS   = `7tom-assets-${VERSAO_CACHE}`;
const CACHE_FONTES   = `7tom-fontes-${VERSAO_CACHE}`;

// Todos os caches que pertencem a esta versão
const CACHES_VALIDOS = [CACHE_SHELL, CACHE_ASSETS, CACHE_FONTES];


/* ═══════════════════════════════════════════════════════════════════
   ■ SHELL OBRIGATÓRIO
   Estes arquivos DEVEM estar em cache para o app funcionar offline.
   Se qualquer um falhar no install, o SW é rejeitado.
═══════════════════════════════════════════════════════════════════ */
const SHELL_OBRIGATORIO = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
];

/* Assets opcionais — falha não impede a instalação */
const ASSETS_OPCIONAIS = [
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
];

/* Origens externas permitidas para cache de fontes */
const ORIGENS_FONTES = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];


/* ═══════════════════════════════════════════════════════════════════
   ■ EVENTO: INSTALL
   Pré-cacheia o shell. Usa waitUntil para travar a instalação até
   que todos os arquivos obrigatórios estejam em cache.
═══════════════════════════════════════════════════════════════════ */
self.addEventListener('install', (evento) => {
  console.info(`[SW 7° Tom] Instalando ${VERSAO_CACHE}…`);

  evento.waitUntil(
    (async () => {
      // Cache do shell (crítico — falha bloqueia instalação)
      const cacheShell = await caches.open(CACHE_SHELL);
      await cacheShell.addAll(SHELL_OBRIGATORIO);
      console.info('[SW 7° Tom] Shell obrigatório em cache.');

      // Cache de assets opcionais (ignora falhas individuais)
      const cacheAssets = await caches.open(CACHE_ASSETS);
      await Promise.allSettled(
        ASSETS_OPCIONAIS.map(url =>
          cacheAssets.add(url).catch(erro =>
            console.warn(`[SW 7° Tom] Asset opcional falhou: ${url}`, erro)
          )
        )
      );

      // Ativa imediatamente sem esperar o tab fechar
      await self.skipWaiting();
      console.info('[SW 7° Tom] Instalação concluída.');
    })()
  );
});


/* ═══════════════════════════════════════════════════════════════════
   ■ EVENTO: ACTIVATE
   Limpa caches de versões antigas e assume o controle de todos
   os clients abertos.
═══════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', (evento) => {
  console.info(`[SW 7° Tom] Ativando ${VERSAO_CACHE}…`);

  evento.waitUntil(
    (async () => {
      // Remove caches de versões anteriores
      const chaves = await caches.keys();
      const parasRemover = chaves.filter(
        chave => !CACHES_VALIDOS.includes(chave)
      );

      await Promise.all(parasRemover.map(chave => {
        console.info(`[SW 7° Tom] Removendo cache antigo: ${chave}`);
        return caches.delete(chave);
      }));

      // Assume controle de todos os clients sem recarregar
      await self.clients.claim();
      console.info('[SW 7° Tom] Ativo e em controle.');

      // Notifica todos os clients sobre a atualização
      const todosClients = await self.clients.matchAll({ type: 'window' });
      todosClients.forEach(client =>
        client.postMessage({
          tipo: '7TOM_SW_ATUALIZADO',
          versao: VERSAO_CACHE,
        })
      );
    })()
  );
});


/* ═══════════════════════════════════════════════════════════════════
   ■ FUNÇÕES DE ESTRATÉGIA
═══════════════════════════════════════════════════════════════════ */

/**
 * Cache First: tenta cache, cai na rede se não encontrar.
 * Usado para o shell e assets estáticos.
 * @param {Request} requisicao
 * @param {string} nomeCache
 * @returns {Promise<Response>}
 */
async function cacheFirst(requisicao, nomeCache) {
  const cache    = await caches.open(nomeCache);
  const cached   = await cache.match(requisicao);

  if (cached) {
    return cached;
  }

  try {
    const resposta = await fetch(requisicao);
    // Só armazena respostas válidas (não erros de rede/servidor)
    if (resposta && resposta.status === 200 && resposta.type !== 'error') {
      cache.put(requisicao, resposta.clone());
    }
    return resposta;
  } catch (erro) {
    console.warn('[SW 7° Tom] Cache First falhou, sem rede:', requisicao.url);
    // Retorna página offline se o shell estiver em cache
    const offline = await caches.match('./index.html');
    return offline || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network First: tenta rede, cai no cache se offline.
 * Usado para dados que mudam com frequência.
 * @param {Request} requisicao
 * @param {string} nomeCache
 * @returns {Promise<Response>}
 */
async function networkFirst(requisicao, nomeCache) {
  const cache = await caches.open(nomeCache);

  try {
    const resposta = await fetch(requisicao);
    if (resposta && resposta.status === 200) {
      cache.put(requisicao, resposta.clone());
    }
    return resposta;
  } catch (_erro) {
    const cached = await cache.match(requisicao);
    if (cached) {
      console.info('[SW 7° Tom] Network First → servindo do cache:', requisicao.url);
      return cached;
    }
    return new Response(JSON.stringify({ erro: 'offline', dados: null }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Stale While Revalidate: serve cache imediatamente,
 * atualiza em segundo plano. Ideal para fontes externas.
 * @param {Request} requisicao
 * @param {string} nomeCache
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(requisicao, nomeCache) {
  const cache  = await caches.open(nomeCache);
  const cached = await cache.match(requisicao);

  // Dispara a atualização em background (sem await)
  const atualizacaoBackground = fetch(requisicao)
    .then(resposta => {
      if (resposta && resposta.status === 200) {
        cache.put(requisicao, resposta.clone());
      }
      return resposta;
    })
    .catch(() => { /* silencioso quando offline */ });

  // Retorna o que está em cache (ou aguarda a rede na primeira vez)
  return cached || atualizacaoBackground;
}


/* ═══════════════════════════════════════════════════════════════════
   ■ ROTEADOR DE REQUISIÇÕES
   Classifica cada URL e aplica a estratégia correta.
═══════════════════════════════════════════════════════════════════ */

/**
 * Determina se a URL é do shell da aplicação.
 * @param {URL} url
 * @returns {boolean}
 */
function eShell(url) {
  const pathSemBarra = url.pathname.replace(/\/$/, '');
  return (
    url.origin === self.location.origin &&
    (
      SHELL_OBRIGATORIO.some(p => url.pathname.endsWith(p.replace('./', '/'))) ||
      pathSemBarra === new URL('./', self.location).pathname.replace(/\/$/, '')
    )
  );
}

/**
 * Determina se a URL é de uma fonte externa.
 * @param {URL} url
 * @returns {boolean}
 */
function eFonte(url) {
  return ORIGENS_FONTES.some(origem => url.href.startsWith(origem));
}

/**
 * Determina se a URL é de um PDF (partitura).
 * @param {URL} url
 * @returns {boolean}
 */
function ePDF(url) {
  return url.pathname.endsWith('.pdf');
}

/**
 * Determina se a URL é de uma imagem.
 * @param {URL} url
 * @returns {boolean}
 */
function eImagem(url) {
  return /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);
}


/* ═══════════════════════════════════════════════════════════════════
   ■ EVENTO: FETCH
   Intercepta TODAS as requisições e aplica a estratégia correta.
═══════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;

  // Ignora requisições não-GET (POST de sync, etc.)
  if (requisicao.method !== 'GET') return;

  // Ignora requisições de extensões do browser
  if (!requisicao.url.startsWith('http')) return;

  const url = new URL(requisicao.url);

  // ── Fontes externas (Google Fonts) ──
  if (eFonte(url)) {
    evento.respondWith(
      staleWhileRevalidate(requisicao, CACHE_FONTES)
    );
    return;
  }

  // ── Shell da aplicação ──
  if (eShell(url)) {
    evento.respondWith(
      cacheFirst(requisicao, CACHE_SHELL)
    );
    return;
  }

  // ── PDFs de partituras ──
  if (ePDF(url)) {
    evento.respondWith(
      cacheFirst(requisicao, CACHE_ASSETS)
    );
    return;
  }

  // ── Imagens e ícones ──
  if (eImagem(url)) {
    evento.respondWith(
      cacheFirst(requisicao, CACHE_ASSETS)
    );
    return;
  }

  // ── Demais requisições mesma origem ──
  if (url.origin === self.location.origin) {
    evento.respondWith(
      cacheFirst(requisicao, CACHE_SHELL)
    );
    return;
  }

  // Requisições cross-origin não mapeadas: deixa a rede decidir
});


/* ═══════════════════════════════════════════════════════════════════
   ■ EVENTO: MESSAGE
   Canal de comunicação com o app principal.
   Permite forçar atualizações ou limpar caches sob demanda.
═══════════════════════════════════════════════════════════════════ */
self.addEventListener('message', (evento) => {
  const dados = evento.data;
  if (!dados || !dados.acao) return;

  switch (dados.acao) {

    // Força a ativação imediata de um SW em espera
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    // Pré-cacheia um PDF de partitura enviado pelo app
    case 'CACHEAR_PDF':
      if (dados.url) {
        caches.open(CACHE_ASSETS).then(cache => {
          cache.add(dados.url)
            .then(() => console.info(`[SW 7° Tom] PDF cacheado: ${dados.url}`))
            .catch(e => console.warn(`[SW 7° Tom] Falha ao cachear PDF:`, e));
        });
      }
      break;

    // Remove um PDF específico do cache (ex: partitura desatualizada)
    case 'REMOVER_PDF':
      if (dados.url) {
        caches.open(CACHE_ASSETS).then(cache => {
          cache.delete(dados.url)
            .then(() => console.info(`[SW 7° Tom] PDF removido do cache: ${dados.url}`));
        });
      }
      break;

    // Limpa apenas o cache de assets (mantém o shell intacto)
    case 'LIMPAR_ASSETS':
      caches.delete(CACHE_ASSETS).then(() => {
        console.info('[SW 7° Tom] Cache de assets limpo.');
        if (evento.source) {
          evento.source.postMessage({ tipo: '7TOM_ASSETS_LIMPOS' });
        }
      });
      break;

    default:
      console.warn('[SW 7° Tom] Mensagem desconhecida:', dados.acao);
  }
});
