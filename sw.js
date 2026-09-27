// Service Worker — Movimento Social-Autonomista
// Estratégia: stale-while-revalidate.
// Visita repetida carrega instantâneo do cache; uma cópia nova é
// buscada em paralelo e fica pronta para a PRÓXIMA visita.
// Isso evita o problema clássico de PWA (site atualizado, visitante
// preso na versão antiga pra sempre) sem exigir bump manual de versão.

const CACHE_NAME = 'msa-movimento-v1';

const CORE_ASSETS = [
  '/',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só GET. POST (ex: futuras chamadas de API) sempre vai direto pra rede.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca cachear chamadas a APIs externas dinâmicas.
  if (
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('api.groq.com') ||
    url.hostname.includes('upstash.io')
  ) {
    return;
  }

  // Mesma origem (o próprio HTML) OU fontes do Google — cache com
  // stale-while-revalidate: responde rápido do cache, atualiza em paralelo.
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  if (isSameOrigin || isGoogleFonts) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached); // offline: fica só com o que já tem
          return cached || network;
        })
      )
    );
  }
  // Qualquer outra origem: deixa o navegador cuidar normalmente.
});
