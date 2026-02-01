/* service-worker.js
   Cache de PDFs (vista previa) para reducir descargas repetidas.
   Funciona SOLO si el PDF está en el MISMO ORIGEN que la página (GitHub Pages).

   TTL objetivo: 9 meses (aprox 270 días). Nota: el navegador puede limpiar caché
   por falta de espacio; no es garantía absoluta.
*/
const CACHE_VERSION = "v1";
const PDF_CACHE = `pdf-preview-${CACHE_VERSION}`;
const META_CACHE = `pdf-preview-meta-${CACHE_VERSION}`;

// 270 días ~ 9 meses
const TTL_MS = 270 * 24 * 60 * 60 * 1000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Limpieza de caches antiguos
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith("pdf-preview-") && k !== PDF_CACHE) return caches.delete(k);
      if (k.startsWith("pdf-preview-meta-") && k !== META_CACHE) return caches.delete(k);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

function isPdfRequest(req) {
  try {
    const url = new URL(req.url);
    // Solo cachear PDFs del mismo origen
    if (url.origin !== self.location.origin) return false;
    return url.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

async function getMeta(url) {
  const cache = await caches.open(META_CACHE);
  const res = await cache.match(url);
  if (!res) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function setMeta(url, meta) {
  const cache = await caches.open(META_CACHE);
  await cache.put(url, new Response(JSON.stringify(meta), {
    headers: { "Content-Type": "application/json" },
  }));
}

async function cacheFreshPdf(request) {
  const cache = await caches.open(PDF_CACHE);
  const meta = await getMeta(request.url);
  const cached = await cache.match(request);

  if (cached && meta && typeof meta.cachedAt === "number") {
    const age = Date.now() - meta.cachedAt;
    if (age <= TTL_MS) {
      return cached;
    }
    // expirado: borrar
    await cache.delete(request);
  }

  // red: obtener y guardar
  const network = await fetch(request);
  // Solo cachear respuestas OK
  if (network && (network.status === 200 || network.status === 0)) {
    await cache.put(request, network.clone());
    await setMeta(request.url, { cachedAt: Date.now() });
  }
  return network;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!isPdfRequest(req)) return;

  event.respondWith((async () => {
    try {
      return await cacheFreshPdf(req);
    } catch (e) {
      // Offline: intenta devolver cache aunque esté viejo
      const cache = await caches.open(PDF_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      throw e;
    }
  })());
});
