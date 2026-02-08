// service-worker.js
// Cache de PDFs para GitHub Pages (reduce recargas / consumo de datos)
// Estrategia:
// - PDFs: cache-first con refresh en background (stale-while-revalidate) + TTL 9 meses
// - Viewer local (pdf-viewer.html) y libs PDF.js (/pdfjs/*): cache-first (TTL 30 días)

// ⚠️ IMPORTANT: incrementa SW_VERSION cada vez que cambies pdf-viewer.html o libs.
// Esto invalida caches viejos que pueden dejar al usuario con un visor roto.
const SW_VERSION = "v9";
const PDF_CACHE = `pdf-cache-${SW_VERSION}`;
const META_CACHE = `pdf-meta-${SW_VERSION}`;
const VIEWER_CACHE = `pdf-viewer-${SW_VERSION}`;

// 9 meses (aprox. 270 días)
const PDF_TTL_MS = 270 * 24 * 60 * 60 * 1000;
// Viewer/libs: 30 días
const VIEWER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![PDF_CACHE, META_CACHE, VIEWER_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isPdfRequest(url) {
  return url && url.pathname && url.pathname.toLowerCase().endsWith(".pdf");
}

function isViewerAsset(url) {
  const p = (url && url.pathname) ? url.pathname.toLowerCase() : "";
  if (!p) return false;
  if (p.endsWith("/pdf-viewer.html")) return true;
  if (p.includes("/pdfjs/")) return true;
  return false;
}

async function getTimestamp(metaCache, urlKey) {
  const metaRes = await metaCache.match(urlKey);
  if (!metaRes) return 0;
  try {
    const data = await metaRes.json();
    return Number(data && data.ts) || 0;
  } catch {
    return 0;
  }
}

async function setTimestamp(metaCache, urlKey) {
  await metaCache.put(
    urlKey,
    new Response(JSON.stringify({ ts: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function cacheFirstWithTtl(event, cacheName, ttlMs) {
  const req = event.request;
  const urlKey = req.url;

  const cache = await caches.open(cacheName);
  const meta = await caches.open(META_CACHE);

  const cached = await cache.match(req);
  if (cached) {
    const ts = await getTimestamp(meta, urlKey);
    const fresh = ts && (Date.now() - ts) < ttlMs;

    // Refrescar en background si está viejo (no bloquea)
    if (!fresh) {
      event.waitUntil(
        (async () => {
          try {
            const net = await fetch(req);
            if (net && (net.ok || net.type === "opaque")) {
              await cache.put(req, net.clone());
              await setTimestamp(meta, urlKey);
            }
          } catch {}
        })()
      );
    }

    return cached;
  }

  // No hay cache: ir a red
  try {
    const net = await fetch(req);
    if (net && (net.ok || net.type === "opaque")) {
      await cache.put(req, net.clone());
      await setTimestamp(meta, urlKey);
    }
    return net;
  } catch (err) {
    // offline sin cache
    return new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET
  if (!req || req.method !== "GET") return;

  const url = new URL(req.url);

  // PDFs (mismo origen o externo): cache-first + TTL largo
  // ⚠️ PDF.js usa "Range requests" (206 Partial Content) para pedir chunks.
  // Si respondemos desde cache a una request con Range, puede romper offsets y dar:
  //   "Bad end offset" (pdf.worker)
  // Por eso: si viene Range, NO tocamos cache; dejamos ir directo a red.
  if (isPdfRequest(url)) {
    const hasRange = req.headers.has("range") || req.headers.has("Range");
    if (hasRange) {
      event.respondWith(fetch(req));
      return;
    }

    event.respondWith(cacheFirstWithTtl(event, PDF_CACHE, PDF_TTL_MS));
    return;
  }

  // Viewer y libs (mismo origen): cache-first + TTL medio
  if (url.origin === self.location.origin && isViewerAsset(url)) {
    event.respondWith(cacheFirstWithTtl(event, VIEWER_CACHE, VIEWER_TTL_MS));
    return;
  }
});
