// student-resources.js
// Biblioteca de Resúmenes / PDFs / GPC (usa el 2° proyecto Firebase: pagina-buena)
// Objetivo: UI moderna + filtros robustos (sin romper simulacros).
// OPT PRO: iOS-safe preview (1 iframe + throttle + hard reset) + event delegation.
// REQ: SOLO PDFs en vista previa. Resto SOLO pestaña nueva. NO descargas automáticas.
// ✅ V5: Visor propio con PDF.js (pdf-viewer.html) para:
//    - evitar "pantalla en blanco" al cambiar de pestaña
//    - arreglar iPhone/Android (no solo primera página)
//    - controlar UI (sin imprimir/descargar/subrayar etc)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

/****************************************************
 * Firebase (proyecto de BIBLIOTECA) - pagina-buena
 * ✅ CONFIG COMPLETA (NO solo apiKey)
 ****************************************************/
const RESOURCES_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQsx1UlomuEw",
  authDomain: "pagina-buena.firebaseapp.com",
  databaseURL: "https://pagina-buena-default-rtdb.firebaseio.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.firebasestorage.app",
  messagingSenderId: "810208199031",
  appId: "1:810208199031:web:707a76b931ee7d2f002172",
};

let resourcesApp = null;
let resourcesDb = null;
function ensureResourcesDb() {
  if (resourcesDb) return resourcesDb;

  const exists = getApps().some((a) => a.name === "resourcesApp");
  const app = exists ? getApp("resourcesApp") : initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");

  resourcesApp = app;

  resourcesDb = getFirestore(app);
  return resourcesDb;
}

/****************************************************
 * ✅ Firebase Storage (proyecto de BIBLIOTECA)
 ****************************************************/
let resourcesStorage = null;

function ensureResourcesStorage() {
  if (resourcesStorage) return resourcesStorage;
  // ensureResourcesDb garantiza que resourcesApp exista
  ensureResourcesDb();
  resourcesStorage = getStorage(resourcesApp);
  return resourcesStorage;
}

/****************************************************
 * ✅ PDF de vista previa (desde Storage)
 * Firestore: temas/<id>.previewPdf puede ser:
 *   - (LEGACY Storage) { path, version, bytes, updatedAt }
 *   - (GitHub Pages)   { url, version, updatedAt }
 * También soporta campos legacy: previewPdfUrl / previewPdfVersion
 ****************************************************/
const _previewPdfUrlByPath = new Map(); // path -> downloadURL

async function getPreviewPdfDownloadUrl(path) {
  const p = String(path || "").trim();
  if (!p) return "";
  if (_previewPdfUrlByPath.has(p)) return _previewPdfUrlByPath.get(p);

  try {
    const storage = ensureResourcesStorage();
    const url = await getDownloadURL(storageRef(storage, p));
    _previewPdfUrlByPath.set(p, url);
    return url;
  } catch (err) {
    console.warn("No se pudo obtener el downloadURL del PDF de vista previa:", err);
    return "";
  }
}

async function hydrateSelectedTopicPreviewPdf(topic) {
  const topicId = String(topic?.id || "");
  if (!topicId || topicId !== String(_selectedTopicId || "")) return;

  cachePreviewDomRefs();

  // ✅ URL del PDF para vista previa (GitHub Pages o URL directa)
  const rawUrl = (topic?.previewPdf && typeof topic.previewPdf === "object" && topic.previewPdf.url)
    ? String(topic.previewPdf.url || "").trim()
    : String(topic?.previewPdfUrl || "").trim();

  const version = (topic?.previewPdf && typeof topic.previewPdf === "object" && topic.previewPdf.version != null)
    ? String(topic.previewPdf.version || "").trim()
    : String(topic?.previewPdfVersion || "").trim();

  if (rawUrl) {
    const withV = appendVersionParam(rawUrl, version);
    const viewer = makePreviewUrl(withV);
    _selectedPreviewUrl = viewer || "";

    if (!_selectedPreviewUrl) {
      showPreviewUnavailableNote("No se pudo cargar el PDF de vista previa.");
      return;
    }

    // Si no hay PDF externo, el botón "Abrir PDF" abre el mismo PDF de vista previa
    if (!_selectedOpenUrl) _selectedOpenUrl = makeOpenUrl(withV) || withV;

    schedulePreviewUpdate();
    return;
  }

  // ✅ LEGACY: PDF de vista previa desde Firebase Storage (si todavía tienes temas viejos)
  const path = topic?.previewPdf?.path || "";

  if (!path) {
    _selectedPreviewUrl = "";
    showPreviewUnavailableNote("Este tema no tiene PDF para vista previa.");
    return;
  }

  const url = await getPreviewPdfDownloadUrl(path);

  if (String(_selectedTopicId || "") !== topicId) return;

  const viewer = makePreviewUrl(url);
  _selectedPreviewUrl = viewer || "";

  if (!_selectedPreviewUrl) {
    showPreviewUnavailableNote("No se pudo cargar el PDF de vista previa.");
    return;
  }

  if (!_selectedOpenUrl) _selectedOpenUrl = makeOpenUrl(url) || url;

  schedulePreviewUpdate();
}

/****************************************************
 * ✅ Repaso del tema (topic_exams)
 ****************************************************/
const _topicExamCache = new Map(); // topicId -> { exists: boolean, cases: [] }

function applyTopicExamButtonState(topicId) {
  const btn = document.getElementById("student-resources-start-topic-exam");
  if (!btn) return;

  const entry = _topicExamCache.get(String(topicId || ""));
  const ready = !!entry?.exists;

  if (ready) {
    btn.disabled = false;
    btn.textContent = "Iniciar repaso del tema";
    btn.classList.add("btn-primary");
    btn.classList.remove("btn-outline");
  } else {
    btn.disabled = true;
    btn.textContent = "En proceso";
    btn.classList.add("btn-outline");
    btn.classList.remove("btn-primary");
  }
}

async function prefetchTopicExam(topicId) {
  const id = String(topicId || "");
  if (!id) return;

  if (_topicExamCache.has(id)) {
    if (id === String(_selectedTopicId || "")) applyTopicExamButtonState(id);
    return;
  }

  try {
    const db = ensureResourcesDb();
    const ref = doc(db, "topic_exams", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      _topicExamCache.set(id, { exists: false, cases: [] });
    } else {
      const data = snap.data() || {};
      _topicExamCache.set(id, { exists: true, cases: Array.isArray(data.cases) ? data.cases : [] });
    }
  } catch (err) {
    console.warn("No se pudo verificar el repaso del tema:", err);
    _topicExamCache.set(id, { exists: false, cases: [] });
  }

  if (id === String(_selectedTopicId || "")) applyTopicExamButtonState(id);
}

/****************************************************
 * Estado
 ****************************************************/
let _uiInitialized = false;
let _dataLoaded = false;
let _allTopics = [];

function selectedTopicHasDedicatedPreviewPdf() {
  const id = String(_selectedTopicId || "");
  if (!id) return false;
  const t = (_allTopics || []).find((x) => String(x?.id || "") === id);
  const url = (t?.previewPdf && typeof t.previewPdf === "object" && t.previewPdf.url) ? t.previewPdf.url : t?.previewPdfUrl;
  const path = (t?.previewPdf && typeof t.previewPdf === "object" && t.previewPdf.path) ? t.previewPdf.path : "";
  return !!(String(url || "").trim() || String(path || "").trim());
}

let selectedSpecialtyKey = "";
let searchQuery = "";

// navegación (sin modal)
let _selectedTopicId = null;

// guardamos link real y link de preview por separado
let _selectedPreviewUrl = ""; // SIEMPRE viewer (no download)
let _selectedOpenUrl = ""; // para abrir en pestaña nueva

// progreso (localStorage por usuario)
let _currentUserKey = "anon";

let viewEl, searchEl, specialtyEl, listEl, detailEl, countEl, emptyEl, loadingEl;
let progressTextEl, progressBarEl;

let modalRoot = null; // se conserva (no se elimina), pero ya no lo usamos para abrir temas

/****************************************************
 * ✅ Optimización iOS: preview estable (1 iframe + throttle)
 ****************************************************/
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const IS_MOBILE =
  window.matchMedia("(pointer:coarse)").matches ||
  window.matchMedia("(hover: none)").matches ||
  window.matchMedia("(max-width: 900px)").matches;

let _previewFrameEl = null;
let _previewBoxEl = null;
let _previewNoteEl = null;
let _previewOpenBtnEl = null;
let _previewLoadingEl = null;

// Fullscreen buttons (overlay)
let _previewFsOpenBtnEl = null;
let _previewFsCloseBtnEl = null;
let _previewWasBodyOverflow = "";

// tab visibility handling (avoid blank preview after switching tabs)
let _tabWasHidden = false;

let _previewToken = 0;
let _previewTimer = null;
let _previewReadyTimer = null;
let _previewLastSwitchAt = 0;

// render scheduler (evita renders en ráfaga)
let _renderScheduled = false;

// History (Back/gesture) => volver a lista
let __resourcesHistoryBound = false;
let __resourcesPushingState = false;

/****************************************************
 * Normalización y mapeo (FIX del filtro)
 ****************************************************/
function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeSpecialty(raw) {
  const n = normalizeText(raw);

  if (n.includes("acceso gratuito")) return "acceso_gratuito";
  if (n.includes("cirugia")) return "cirugia_general";
  if (n.includes("medicina interna") || (n.includes("medicina") && n.includes("interna"))) return "medicina_interna";
  if (n.includes("pediatr")) return "pediatria";
  if (n.includes("gine") || n.includes("obst")) return "gine_obstetricia";

  return "otros";
}

function specialtyLabelFromKey(key) {
  switch (key) {
    case "medicina_interna":
      return "Medicina interna";
    case "cirugia_general":
      return "Cirugía general";
    case "pediatria":
      return "Pediatría";
    case "gine_obstetricia":
      return "Ginecología y Obstetricia";
    case "acceso_gratuito":
      return "Acceso gratuito limitado";
    default:
      return "Otros";
  }
}

/****************************************************
 * Helpers UI
 ****************************************************/
function show(el) {
  if (el) el.classList.remove("hidden");
}
function hide(el) {
  if (el) el.classList.add("hidden");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function guessLinkType(label, url) {
  const l = normalizeText(label);
  const u = normalizeText(url);

  // Resumen/Word/Docs -> NO se previsualiza (se abre link real)
  if (l.includes("resumen") || l.includes("word") || u.includes("docs.google.com/document") || u.includes(".doc")) {
    return "resumen";
  }

  // GPC: NO preview (solo pestaña nueva) aunque sea PDF
  if (l.includes("gpc") || l.includes("guia") || l.includes("practica clinica")) {
    return "gpc";
  }

  // PDF
  if (l.includes("pdf") || u.includes(".pdf") || u.includes("application/pdf")) {
    return "pdf";
  }
  if (u.includes("drive.google.com/file")) return "pdf";
  if (u.includes("drive.google.com/uc") && u.includes("id=")) return "pdf";

  return "otro";
}

function buildLinkGroups(topic) {
  const links = Array.isArray(topic.links) ? topic.links : [];
  const groups = { resumen: [], pdf: [], gpc: [], otro: [] };

  links.forEach((x) => {
    const label = x?.label || x?.name || x?.title || "Documento";
    const url = x?.url || x?.href || "";
    if (!url) return;

    const type = guessLinkType(label, url);
    groups[type].push({ label, url });
  });

  groups.resumen.sort((a, b) => a.label.localeCompare(b.label));
  groups.pdf.sort((a, b) => a.label.localeCompare(b.label));
  groups.gpc.sort((a, b) => a.label.localeCompare(b.label));
  groups.otro.sort((a, b) => a.label.localeCompare(b.label));

  return groups;
}

/****************************************************
 * Progreso (localStorage)
 ****************************************************/
function getProgressStorageKey() {
  return `resources_completed_${_currentUserKey}`;
}

function loadCompletedSet() {
  try {
    const raw = localStorage.getItem(getProgressStorageKey());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveCompletedSet(set) {
  try {
    localStorage.setItem(getProgressStorageKey(), JSON.stringify(Array.from(set)));
  } catch {
    // no-op
  }
}

function isTopicCompleted(topicId) {
  return loadCompletedSet().has(String(topicId));
}

function toggleTopicCompleted(topicId) {
  const id = String(topicId);
  const set = loadCompletedSet();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  saveCompletedSet(set);
}

/****************************************************
 * Preview helpers (PDF inline SOLAMENTE, sin descargas)
 ****************************************************/
function extractDriveFileId(url) {
  const u = String(url || "");

  // /file/d/<id>
  const m1 = u.match(/\/file\/d\/([^/]+)/i);
  if (m1 && m1[1]) return m1[1];

  // ?id=<id>
  const m2 = u.match(/[?&]id=([^&]+)/i);
  if (m2 && m2[1]) return m2[1];

  return "";
}

function makeDrivePreviewViewerUrl(fileId) {
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function makeDriveViewUrl(fileId) {
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

function makeGoogleGviewUrl(pdfUrl) {
  if (!pdfUrl) return "";
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdfUrl)}`;
}

function toAbsoluteUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    // soporta URLs relativas (./, ../, /path, etc.)
    return new URL(s, window.location.href).toString();
  } catch {
    return "";
  }
}

function appendVersionParam(rawUrl, version) {
  const v = String(version || "").trim();
  if (!rawUrl || !v) return rawUrl;

  // Si ya trae ?v=, lo respetamos
  try {
    const abs = toAbsoluteUrl(rawUrl);
    if (!abs) return rawUrl;
    const u = new URL(abs);
    if (!u.searchParams.has("v")) u.searchParams.set("v", v);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// Normaliza links típicos de GitHub "blob" a URL de GitHub Pages (si aplica)
function normalizeGithubPdfUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  try {
    const u = new URL(s);
    // Si ya es github.io, OK
    if (u.hostname.endsWith("github.io")) return u.toString();

    // Si es github.com/<user>/<repo>/blob/<branch>/<path>
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean); // [user, repo, blob, branch, ...path]
      if (parts.length >= 5 && parts[2] === "blob") {
        const user = parts[0];
        const repo = parts[1];
        const path = parts.slice(4).join("/");
        // asumimos Pages del repo: https://user.github.io/repo/<path>
        return `https://${user}.github.io/${repo}/${path}`;
      }
    }
  } catch {
    // no-op
  }

  return s;
}

// URL local del visor (mismo origen) para que el Service Worker pueda cachear PDFs (y evitar el blanco)
function makeLocalPdfViewerUrl(pdfUrl) {
  const absPdf = toAbsoluteUrl(pdfUrl);
  if (!absPdf) return "";

  const viewer = new URL("./pdf-viewer.html", window.location.href);
  viewer.searchParams.set("file", absPdf);
  viewer.searchParams.set("z", "fit");
  return viewer.toString();
}

function makePreviewUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const normalized = normalizeGithubPdfUrl(raw);
  const n = normalizeText(normalized);

  // Si ya es Drive preview, lo respetamos
  if (n.includes("drive.google.com/file") && n.includes("/preview")) return normalized;

  // Drive: usamos /preview (pero esto depende de Drive)
  if (n.includes("drive.google.com")) {
    const id = extractDriveFileId(normalized);
    if (id) return makeDrivePreviewViewerUrl(id);
    return "";
  }

  // PDF directo: SIEMPRE usar visor local (pdf-viewer.html) -> consistente en desktop + móvil
  if (n.includes(".pdf") || n.includes("application/pdf")) {
    return makeLocalPdfViewerUrl(normalized);
  }

  // Fallback: gview (por si acaso)
  return makeGoogleGviewUrl(normalized);
}

function makeOpenUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const normalized = normalizeGithubPdfUrl(raw);
  const n = normalizeText(normalized);

  if (n.includes("drive.google.com")) {
    const id = extractDriveFileId(normalized);
    if (id) return makeDriveViewUrl(id);
    return normalized;
  }

  return normalized;
}

/****************************************************
 * ✅ Preview DOM control (1 iframe + throttle + hard reset)
 ****************************************************/
function cachePreviewDomRefs() {
  if (!listEl) return;

  _previewFrameEl = listEl.querySelector("#student-resources-preview-frame");
  _previewBoxEl = listEl.querySelector("#student-resources-preview-box");
  _previewNoteEl = listEl.querySelector("#student-resources-preview-note");
  _previewOpenBtnEl = listEl.querySelector("#student-resources-open-newtab");
  _previewLoadingEl = listEl.querySelector("#student-resources-preview-loading");

  _previewFsOpenBtnEl = listEl.querySelector("#student-resources-preview-fs-open");
  _previewFsCloseBtnEl = listEl.querySelector("#student-resources-preview-fs-close");

  // Fullscreen buttons
  if (_previewFsOpenBtnEl && !_previewFsOpenBtnEl.dataset.bound) {
    _previewFsOpenBtnEl.dataset.bound = "1";
    _previewFsOpenBtnEl.addEventListener("click", (e) => {
      e.preventDefault();
      enterPreviewFullscreen();
    });
  }
  if (_previewFsCloseBtnEl && !_previewFsCloseBtnEl.dataset.bound) {
    _previewFsCloseBtnEl.dataset.bound = "1";
    _previewFsCloseBtnEl.addEventListener("click", (e) => {
      e.preventDefault();
      exitPreviewFullscreen();
    });
  }

  if (_previewFrameEl && !_previewFrameEl.dataset.bound) {
    _previewFrameEl.dataset.bound = "1";

    _previewFrameEl.addEventListener("load", () => {
      if (!_previewFrameEl) return;
      if (String(_previewToken) !== String(_previewFrameEl.dataset.token || "")) return;

      const srcNow = String(_previewFrameEl.src || "");
      if (!srcNow || srcNow.startsWith("about:blank")) return;

      // Mantener layout correcto del visor según modo actual
      try {
        const mode = _previewBoxEl?.classList?.contains("preview-fullscreen") ? "fullscreen" : "embedded";
        _previewFrameEl?.contentWindow?.postMessage({ type: "ENARM_VIEWER_MODE", mode }, "*");
      } catch {}

      // IMPORTANTE: si es el visor local (pdf-viewer.html), NO apagamos el loader aquí.
      // Esperamos la señal {type:"pdf-ready"} desde el iframe cuando ya pintó una página.
      const isLocalViewer = normalizeText(srcNow).includes("pdf-viewer.html");
      if (!isLocalViewer) setPreviewLoading(false);

    });

    _previewFrameEl.addEventListener("error", () => {
      if (!_previewFrameEl) return;
      if (String(_previewToken) !== String(_previewFrameEl.dataset.token || "")) return;
      setPreviewLoading(false);
      showPreviewUnavailableNote();
    });
  }

  // Listener global para señal de listo/error del visor
  ensurePreviewMessageBridge();

}

function enterPreviewFullscreen() {
  if (!_previewBoxEl) return;

  _previewWasBodyOverflow = document.body.style.overflow || "";
  document.body.style.overflow = "hidden";

  _previewBoxEl.classList.add("preview-fullscreen");
  if (_previewFsCloseBtnEl) _previewFsCloseBtnEl.classList.remove("hidden");

  // Avisar al visor (iframe) para reservar espacio del botón cerrar
  try {
    _previewFrameEl?.contentWindow?.postMessage({ type: "ENARM_VIEWER_MODE", mode: "fullscreen" }, "*");
  } catch {}
}

function exitPreviewFullscreen() {
  if (!_previewBoxEl) return;

  document.body.style.overflow = _previewWasBodyOverflow;

  _previewBoxEl.classList.remove("preview-fullscreen");
  if (_previewFsCloseBtnEl) _previewFsCloseBtnEl.classList.add("hidden");

  // Regresar a modo embedded
  try {
    _previewFrameEl?.contentWindow?.postMessage({ type: "ENARM_VIEWER_MODE", mode: "embedded" }, "*");
  } catch {}
}

function setPreviewLoading(on) {
  if (!_previewLoadingEl) return;
  if (on) _previewLoadingEl.classList.remove("hidden");
  else _previewLoadingEl.classList.add("hidden");
}

function showPreviewUnavailableNote(customText) {
  if (_previewNoteEl) {
    _previewNoteEl.textContent = customText || "No se pudo mostrar el PDF aquí. Ábrelo en pestaña nueva.";
  }
  if (_previewBoxEl) _previewBoxEl.classList.add("hidden");
}

function disposeInlinePreview() {
  try {
    if (_previewFrameEl) _previewFrameEl.src = "about:blank";
  } catch {}
  setPreviewLoading(false);
  clearPreviewReadyTimeout();
  clearTimeout(_previewTimer);
  _previewTimer = null;
}

// Ping/refresh al visor local para evitar "blanco" tras cambiar de pestaña
function postPdfViewerMessage(type, payload = {}) {
  try {
    if (!_previewFrameEl) return false;
    const win = _previewFrameEl.contentWindow;
    if (!win) return false;
    win.postMessage({ type, ...payload }, "*");
    return true;
  } catch {
    return false;
  }
}

async function pingPdfViewer(timeoutMs = 350) {
  if (!_previewFrameEl || !_previewFrameEl.contentWindow) return false;

  return new Promise((resolve) => {
    let done = false;

    const token = String(Date.now());
    const onMsg = (e) => {
      const data = e?.data || {};
      if (data && data.type === "pdfViewer:pong" && data.token === token) {
        done = true;
        window.removeEventListener("message", onMsg);
        resolve(true);
      }
    };

    window.addEventListener("message", onMsg);

    // send ping
    postPdfViewerMessage("pdfViewer:ping", { token });

    setTimeout(() => {
      if (done) return;
      window.removeEventListener("message", onMsg);
      resolve(false);
    }, timeoutMs);
  });
}

function refreshPreviewAfterTabReturn() {
  // Si no hay preview cargado, no hacemos nada
  if (!_previewFrameEl || !_selectedPreviewUrl) return;

  // Si es visor local, intentamos refrescar dentro del iframe sin recargar src
  const src = String(_previewFrameEl.src || "");
  const isLocalViewer = normalizeText(src).includes("pdf-viewer.html");

  if (isLocalViewer) {
    // si responde al ping, solo pedimos refresh interno
    pingPdfViewer(450).then((ok) => {
      if (ok) {
        setPreviewLoading(false);
        postPdfViewerMessage("pdfViewer:refresh");
      } else {
        // fallback: recargar el iframe (usa SW cache)
        schedulePreviewUpdate(true /*force*/);
      }
    });
    return;
  }

  // si no es local, fallback recarga
  schedulePreviewUpdate(true);
}


/****************************************************
 * ✅ Señal real de "PDF listo" (evita blanco / iOS)
 ****************************************************/
let __previewBridgeBound = false;

function clearPreviewReadyTimeout() {
  if (_previewReadyTimer) clearTimeout(_previewReadyTimer);
  _previewReadyTimer = null;
}

function armPreviewReadyTimeout(token) {
  clearPreviewReadyTimeout();
  _previewReadyTimer = setTimeout(() => {
    if (String(_previewToken) !== String(token)) return;

    // Si sigue cargando, quitamos overlay y dejamos nota (sin romper UI)
    setPreviewLoading(false);
    if (_previewNoteEl) {
      _previewNoteEl.textContent = "La vista previa tardó demasiado. Usa “Abrir PDF”.";
    }
  }, 20000);
}

function ensurePreviewMessageBridge() {
  if (__previewBridgeBound) return;
  __previewBridgeBound = true;

  window.addEventListener("message", (e) => {
    const data = e?.data || {};
    if (!data || (data.type !== "pdf-ready" && data.type !== "pdf-error")) return;

    if (!_previewFrameEl || e.source !== _previewFrameEl.contentWindow) return;

    const tok = String(data.token || "");
    const expected = String(_previewFrameEl.dataset.token || "");
    if (tok && expected && tok !== expected) return;

    clearPreviewReadyTimeout();
    setPreviewLoading(false);

    if (data.type === "pdf-error") {
      if (_previewNoteEl) {
        _previewNoteEl.textContent = String(data.message || "No se pudo cargar la vista previa. Usa “Abrir PDF”.");
      }
    }
  });
}

function applyPreviewToDom(token) {
  if (!_previewFrameEl) return;

  // botón abrir (solo si hay PDF seleccionado)
  if (_previewOpenBtnEl) {
    if (_selectedOpenUrl) {
      _previewOpenBtnEl.classList.remove("hidden");
      _previewOpenBtnEl.setAttribute("href", _selectedOpenUrl);
    } else {
      _previewOpenBtnEl.classList.add("hidden");
      _previewOpenBtnEl.removeAttribute("href");
    }
  }

  // si no hay preview (no hay PDFs o no se pudo construir URL)
  if (!_selectedPreviewUrl) {
    _previewFrameEl.src = "about:blank";
    showPreviewUnavailableNote("Este tema no tiene PDF para vista previa.");
    return;
  }

  if (_previewBoxEl) _previewBoxEl.classList.remove("hidden");
  if (_previewNoteEl) _previewNoteEl.textContent = "Vista previa (PDF)";

  // En cambios normales sí mostramos overlay breve
  setPreviewLoading(true);

  // HARD RESET
  _previewFrameEl.dataset.token = String(token);
  _previewFrameEl.src = "about:blank";

  requestAnimationFrame(() => {
    if (token !== _previewToken) return;

    let url = _selectedPreviewUrl;

    // Adjuntar token al visor local para validar pdf-ready
    try {
      if (normalizeText(url).includes("pdf-viewer.html")) {
        const u = new URL(url, window.location.href);
        u.searchParams.set("token", String(token));
        url = u.toString();
      }
    } catch {}

    _previewFrameEl.dataset.token = String(token);
    _previewFrameEl.src = url;

    // Esperar señal real de "listo"
    armPreviewReadyTimeout(token);
  });
}

function schedulePreviewUpdate(force = false) {
  if (!_previewFrameEl) return;

  const now = performance.now();
  const minGap = IS_IOS ? 650 : IS_MOBILE ? 450 : 150;
  const wait = force ? 0 : Math.max(0, minGap - (now - _previewLastSwitchAt));
  _previewLastSwitchAt = now;

  clearTimeout(_previewTimer);
  const token = ++_previewToken;

  _previewTimer = setTimeout(() => {
    applyPreviewToDom(token);
  }, wait);
}

/****************************************************
 * Modal (SE CONSERVA)
 ****************************************************/
function ensureModal() {
  if (modalRoot) return;

  modalRoot = document.createElement("div");
  modalRoot.id = "student-resources-modal";
  modalRoot.className = "resources-modal hidden";
  modalRoot.setAttribute("aria-hidden", "true");

  modalRoot.innerHTML = `
    <div class="resources-modal__overlay" data-close="1"></div>
    <div class="resources-modal__panel" role="dialog" aria-modal="true" aria-label="Biblioteca de recursos">
      <div class="resources-modal__header">
        <div class="resources-modal__headtext">
          <div class="resources-modal__badge" id="student-resources-modal-specialty">—</div>
          <div class="resources-modal__title" id="student-resources-modal-title">—</div>
        </div>
        <button class="btn btn-outline btn-sm" id="student-resources-modal-close">Cerrar</button>
      </div>
      <div class="resources-modal__body" id="student-resources-modal-body"></div>
    </div>
  `;

  document.body.appendChild(modalRoot);

  const closeBtn = modalRoot.querySelector("#student-resources-modal-close");
  const overlay = modalRoot.querySelector("[data-close='1']");

  closeBtn?.addEventListener("click", closeModal);
  overlay?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalRoot && !modalRoot.classList.contains("hidden")) closeModal();
  });
}

function closeModal() {
  if (!modalRoot) return;
  modalRoot.classList.add("hidden");
  modalRoot.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}


/****************************************************
 * History helpers (Back/gesture)
 ****************************************************/
function ensureResourcesHistory() {
  if (__resourcesHistoryBound) return;
  __resourcesHistoryBound = true;

  // Asegura estado base "list" para que Back cierre el detalle
  try {
    const st = history.state || {};
    if (!st || st.__resources !== true) {
      history.replaceState({ ...st, __resources: true, view: "list" }, "", location.href);
    }
  } catch {}

  window.addEventListener("popstate", (e) => {
    const st = e.state || {};
    if (!st || st.__resources !== true) return;

    if (st.view === "list") {
      if (_selectedTopicId) {
        // En algunos navegadores/gestos, el estado cambia antes de que el UI cierre.
        // Preferimos disparar el mismo flujo que el botón "Volver".
        const btn = document.getElementById("student-resources-back");
        if (btn) {
          btn.click();
          return;
        }

        disposeInlinePreview();
        _selectedTopicId = null;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        scheduleRender();
      }
    }
  });

  // Fallback: algunos gestos en móvil/trackpad disparan hashchange sin popstate consistente.
  window.addEventListener("hashchange", () => {
    try {
      if (__resourcesPushingState) return;
      const hasTema = /tema=/.test(String(location.hash || ""));
      if (!hasTema && _selectedTopicId) {
        const btn = document.getElementById("student-resources-back");
        if (btn) {
          btn.click();
          return;
        }
        disposeInlinePreview();
        _selectedTopicId = null;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        scheduleRender();
      }
    } catch {}
  });

  // iOS/Safari: a veces vuelve desde BFCache y NO dispara popstate; usamos pageshow/focus.
  window.addEventListener("pageshow", () => {
    try {
      if (__resourcesPushingState) return;
      const hasTema = /tema=/.test(String(location.hash || ""));
      if (!hasTema && _selectedTopicId) {
        const btn = document.getElementById("student-resources-back");
        if (btn) btn.click();
      }
    } catch {}
  });

  window.addEventListener("focus", () => {
    try {
      if (__resourcesPushingState) return;
      const hasTema = /tema=/.test(String(location.hash || ""));
      if (!hasTema && _selectedTopicId) {
        const btn = document.getElementById("student-resources-back");
        if (btn) btn.click();
      }
    } catch {}
  });

}

function pushTopicState(topicId) {
  if (!topicId) return;
  try {
    __resourcesPushingState = true;
    const url = new URL(location.href);
    url.hash = "tema=" + encodeURIComponent(String(topicId));
    history.pushState({ ...(history.state || {}), __resources: true, view: "detail", topicId: String(topicId) }, "", url.toString());
  } catch {
    // ignore
  } finally {
    __resourcesPushingState = false;
  }
}

/****************************************************
 * UI init
 ****************************************************/
export function initStudentResourcesUI() {
  if (_uiInitialized) return;
  _uiInitialized = true;

  viewEl = document.getElementById("student-resources-view");
  searchEl = document.getElementById("student-resources-search");
  specialtyEl = document.getElementById("student-resources-specialty");
  listEl = document.getElementById("student-resources-list");
  detailEl = document.getElementById("student-resources-detail");
  countEl = document.getElementById("student-resources-count");
  emptyEl = document.getElementById("student-resources-empty");
  loadingEl = document.getElementById("student-resources-loading");
  progressTextEl = document.getElementById("student-resources-progress-text");
  progressBarEl = document.getElementById("student-resources-progress-bar");

  // Bridge para señales del visor PDF (pdf-ready/pdf-error)
  ensurePreviewMessageBridge();

  if (viewEl) viewEl.setAttribute("data-ui", "cards");
  if (detailEl) detailEl.innerHTML = "";

  // Ocultar columna derecha (si existe) y usar todo el ancho para lista
  if (detailEl) {
    const rightCol = detailEl.closest("div");
    if (rightCol) rightCol.classList.add("hidden");
  }
  if (listEl) {
    const leftCol = listEl.closest("div");
    if (leftCol) {
      leftCol.style.flex = "1 1 100%";
      leftCol.style.minWidth = "0";
    }
  }

  if (specialtyEl && !specialtyEl.dataset.bound) {
    specialtyEl.dataset.bound = "1";
    specialtyEl.innerHTML = `
      <option value="">Todas</option>
      <option value="medicina_interna">Medicina interna</option>
      <option value="cirugia_general">Cirugía general</option>
      <option value="pediatria">Pediatría</option>
      <option value="gine_obstetricia">Ginecología y Obstetricia</option>
      <option value="acceso_gratuito">Acceso gratuito limitado</option>
    `;
    specialtyEl.addEventListener("change", () => {
      selectedSpecialtyKey = specialtyEl.value || "";
      _selectedTopicId = null;
      _selectedPreviewUrl = "";
      _selectedOpenUrl = "";
      disposeInlinePreview();
      scheduleRender();
    });
  }

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";

    // debounce liviano para no renderizar en ráfaga
    let t = null;
    searchEl.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        searchQuery = String(searchEl.value || "").trim();
        _selectedTopicId = null;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        disposeInlinePreview();
        scheduleRender();
      }, 120);
    });
  }

  // Event delegation (1 solo listener, más ligero)
  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = "1";

    listEl.addEventListener("click", async (e) => {
      const target = e.target;

      // LIST VIEW: abrir tarjeta
      const openBtn = target?.closest?.(".resource-card__open");
      const card = target?.closest?.(".resource-card");
      if (openBtn || card) {
        const root = openBtn || card;
        const id = root?.getAttribute?.("data-topic-id");
        if (id) {
          e.preventDefault();
          e.stopPropagation();
          disposeInlinePreview();
          _selectedTopicId = id;
          _selectedPreviewUrl = "";
          _selectedOpenUrl = "";
          pushTopicState(id);
          scheduleRender();
          return;
        }
      }

      // DETAIL VIEW: back
      if (target?.closest?.("#student-resources-back")) {
        e.preventDefault();
        // Si venimos de un pushState (detalle), el Back del navegador debe devolvernos a lista
        try {
          const st = history.state || {};
          if (st.__resources === true && st.view === "detail") {
            history.back();
            return;
          }
        } catch {}

        disposeInlinePreview();
        _selectedTopicId = null;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        scheduleRender();
        return;
      }
      // DETAIL VIEW: iniciar repaso del tema
      if (target?.closest?.("#student-resources-start-topic-exam")) {
        e.preventDefault();

        const id = String(_selectedTopicId || "");
        if (!id) return;

        try {
          let entry = _topicExamCache.get(id);

          // Si no está cacheado, lo consultamos
          if (!entry) {
            const db = await ensureResourcesDb();
            const ref = doc(db, "topic_exams", id);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
              _topicExamCache.set(id, { exists: false, cases: [] });
              applyTopicExamButtonState(id);
              alert("Este repaso del tema está en proceso.");
              return;
            }

            const data = snap.data() || {};
            entry = { exists: true, cases: Array.isArray(data.cases) ? data.cases : [] };
            _topicExamCache.set(id, entry);
            applyTopicExamButtonState(id);
          }

          if (!entry?.exists) {
            alert("Este repaso del tema está en proceso.");
            return;
          }

          const topic = _allTopics.find((t) => String(t.id) === id);
          const topicTitle = topic?.title || "Repaso del tema";

          window.dispatchEvent(
            new CustomEvent("student:openTopicExam", {
              detail: { topicId: id, topicTitle, cases: entry.cases || [] },
            })
          );
        } catch (err) {
          console.error(err);
          alert("No se pudo iniciar el repaso del tema. Intenta de nuevo.");
        }
        return;
      }

      // DETAIL VIEW: complete
      if (target?.closest?.("#student-resources-complete")) {
        e.preventDefault();
        const topic = getSelectedTopic();
        if (topic) {
          toggleTopicCompleted(topic.id);
          scheduleRender();
        }
        return;
      }

      // DETAIL VIEW: preview button (SOLO PDFs)
      const previewBtn = target?.closest?.("button[data-preview-url]");
      if (previewBtn) {
        e.preventDefault();

        const raw = previewBtn.getAttribute("data-preview-url") || "";
        if (!raw) return;

        // ✅ Nuevo comportamiento para tu flujo:
        // Si el tema tiene un PDF dedicado de vista previa (GitHub/legacy Storage),
        // NO reemplazamos la vista previa con links externos; solo abrimos en nueva pestaña.
        if (selectedTopicHasDedicatedPreviewPdf()) {
          const open = makeOpenUrl(raw) || raw;
          if (open) window.open(open, "_blank", "noopener");
          return;
        }

        // (Fallback) Si NO hay PDF dedicado, permitimos usar el PDF de links[] como vista previa
        _selectedOpenUrl = makeOpenUrl(raw);

        const preview = makePreviewUrl(raw);
        _selectedPreviewUrl = preview || "";

        // Marca visual (ARIA) sin re-render
        listEl.querySelectorAll("button[data-preview-url][aria-pressed='true']").forEach((b) => {
          b.setAttribute("aria-pressed", "false");
        });
        previewBtn.setAttribute("aria-pressed", "true");

        cachePreviewDomRefs();
        schedulePreviewUpdate();
        return;
      }
    });
  }

  // ✅ Evita el "blanco" al cambiar de pestaña:
  // - NO destruimos el iframe en hidden
  // - al volver visible, forzamos refresh interno del visor local
  if (!document.documentElement.dataset.resourcesVisBound) {
    document.documentElement.dataset.resourcesVisBound = "1";
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        _tabWasHidden = true;
        return;
      }
      if (_tabWasHidden) {
        _tabWasHidden = false;
        // refrescar solo si estamos en detalle con preview
        refreshPreviewAfterTabReturn();
      }
    });
  }

  ensureModal();
  ensureResourcesHistory();
}

/****************************************************
 * Load data
 ****************************************************/
export async function activateStudentResources() {
  initStudentResourcesUI();

  try {
    show(loadingEl);
    hide(emptyEl);

    if (!_dataLoaded) {
      const db = ensureResourcesDb();
      const q = query(collection(db, "temas"), orderBy("title", "asc"));
      const snap = await getDocs(q);

      _allTopics = snap.docs.map((d) => {
        const data = d.data() || {};
        const specialtyRaw = data.specialty || "";
        return {
          id: d.id,
          title: data.title || "Tema sin título",
          specialty: specialtyRaw,
          specialtyKey: canonicalizeSpecialty(specialtyRaw),
          previewPdf: (data.previewPdf && typeof data.previewPdf === "object") ? data.previewPdf : null,
          // ✅ soporte directo para GitHub Pages (si guardas el URL como campos simples)
          previewPdfUrl: String(data.previewPdfUrl || ""),
          previewPdfVersion: data.previewPdfVersion != null ? String(data.previewPdfVersion) : "",
          links: Array.isArray(data.links) ? data.links : [],
        };
      });

      _dataLoaded = true;
    }

    scheduleRender(true);
  } catch (err) {
    console.error("Error cargando biblioteca (temas):", err);
    if (listEl) {
      listEl.innerHTML = `
        <div class="card" style="padding:12px 14px;">
          <div class="panel-subtitle">No se pudieron cargar los temas. Intenta de nuevo.</div>
        </div>
      `;
    }
  } finally {
    hide(loadingEl);
  }
}

/****************************************************
 * API opcional: setear usuario
 ****************************************************/
export function setStudentResourcesUserIdentity(emailOrUid) {
  _currentUserKey = normalizeText(emailOrUid || "anon") || "anon";
}

/****************************************************
 * API: stats de progreso para la vista "Progreso"
 ****************************************************/
export async function getStudentResourcesProgressStats(options = {}) {
  const { includeAccesoGratuito = false } = options || {};
  try {
    // Cargar data si aún no está
    if (!_dataLoaded) {
      const db = ensureResourcesDb();
      const q = query(collection(db, "temas"), orderBy("title", "asc"));
      const snap = await getDocs(q);

      _allTopics = snap.docs.map((d) => {
        const data = d.data() || {};
        const specialtyRaw = data.specialty || "";
        return {
          id: d.id,
          title: data.title || "Tema sin título",
          specialty: specialtyRaw,
          specialtyKey: canonicalizeSpecialty(specialtyRaw),
          previewPdf: (data.previewPdf && typeof data.previewPdf === "object") ? data.previewPdf : null,
          previewPdfUrl: String(data.previewPdfUrl || ""),
          previewPdfVersion: data.previewPdfVersion != null ? String(data.previewPdfVersion) : "",
          links: Array.isArray(data.links) ? data.links : [],
        };
      });

      _dataLoaded = true;
    }

    const topics = includeAccesoGratuito
      ? _allTopics
      : _allTopics.filter((t) => t.specialtyKey !== "acceso_gratuito");

    const set = loadCompletedSet();
    const topicIds = new Set(topics.map((t) => String(t.id)));

    let completedCount = 0;
    set.forEach((id) => {
      if (topicIds.has(String(id))) completedCount += 1;
    });

    const total = topics.length;
    const percent = total > 0 ? (completedCount / total) * 100 : 0;

    return { totalTopics: total, completedTopics: completedCount, percent };
  } catch (err) {
    console.error("Error obteniendo stats de biblioteca:", err);
    return { totalTopics: 0, completedTopics: 0, percent: 0 };
  }
}

/****************************************************
 * Render
 ****************************************************/
function applyFilters(topics) {
  const q = normalizeText(searchQuery);
  const selected = selectedSpecialtyKey || "";

  return topics.filter((t) => {
    if (!selected) {
      if (t.specialtyKey === "acceso_gratuito") return false;
    } else {
      if (t.specialtyKey !== selected) return false;
    }

    if (!q) return true;

    const title = normalizeText(t.title);
    const sp = normalizeText(t.specialty);
    return title.includes(q) || sp.includes(q);
  });
}

function getSelectedTopic() {
  if (!_selectedTopicId) return null;
  return _allTopics.find((t) => String(t.id) === String(_selectedTopicId)) || null;
}

function scheduleRender(forceImmediate = false) {
  if (!_dataLoaded || !listEl) return;

  if (forceImmediate) {
    _renderScheduled = false;
    render();
    return;
  }

  if (_renderScheduled) return;
  _renderScheduled = true;

  requestAnimationFrame(() => {
    _renderScheduled = false;
    render();
  });
}

function render() {
  if (!listEl) return;

  const filtered = applyFilters(_allTopics);

  // ✅ Progreso (según filtros actuales)
  if (progressTextEl && progressBarEl) {
    const includeAccesoGratuito = !selectedSpecialtyKey || selectedSpecialtyKey === "acceso_gratuito";
    const topicsForStats = includeAccesoGratuito
      ? _allTopics
      : _allTopics.filter((t) => t.specialtyKey !== "acceso_gratuito");

    const topicIds = new Set(topicsForStats.map((t) => String(t.id)));
    const set = loadCompletedSet();
    let completedCount = 0;
    set.forEach((id) => {
      if (topicIds.has(String(id))) completedCount += 1;
    });

    const total = topicIds.size;
    const pct = total ? Math.round((completedCount / total) * 100) : 0;

    progressTextEl.textContent = `${completedCount} / ${total} (${pct}%)`;
    progressBarEl.style.width = `${pct}%`;
  }

  if (countEl) countEl.textContent = `${filtered.length} tema${filtered.length === 1 ? "" : "s"}`;

  const selected = getSelectedTopic();
  if (selected) {
    hide(emptyEl);
    renderTopicDetail(selected);
    return;
  }

  // list view
  if (!filtered.length) {
    listEl.innerHTML = "";
    show(emptyEl);
    return;
  }

  hide(emptyEl);
  listEl.classList.add("resources-grid");

  const frag = document.createDocumentFragment();

  filtered.forEach((t) => {
    const groups = buildLinkGroups(t);
    const hasResumen = groups.resumen.length > 0;
    const pdfCount = groups.pdf.length;
    const gpcCount = groups.gpc.length;
    const otherCount = groups.otro.length;

    const spLabel = specialtyLabelFromKey(t.specialtyKey);
    const completed = isTopicCompleted(t.id);

    const badges = [];
    if (completed) badges.push(`<span class="resource-badge">Completado</span>`);
    if (hasResumen) badges.push(`<span class="resource-badge">Resumen</span>`);
    if (pdfCount) badges.push(`<span class="resource-badge">PDF ${pdfCount}</span>`);
    if (gpcCount) badges.push(`<span class="resource-badge">GPC ${gpcCount}</span>`);
    if (otherCount) badges.push(`<span class="resource-badge resource-badge--muted">Otros ${otherCount}</span>`);

    const card = document.createElement("div");
    card.className = `resource-card ${completed ? "resource-card--completed" : ""}`;
    card.setAttribute("data-topic-id", String(t.id));
    card.innerHTML = `
      <div class="resource-card__top">
        <div class="resource-card__meta">
          <div class="resource-card__specialty">${escapeHtml(spLabel)}</div>
          <div class="resource-card__title">${escapeHtml(t.title)}</div>
        </div>
        <button class="btn btn-primary btn-sm resource-card__open" type="button" data-topic-id="${escapeHtml(
          String(t.id)
        )}">Abrir</button>
      </div>
      <div class="resource-card__badges">${badges.join("")}</div>
    `;

    frag.appendChild(card);
  });

  listEl.innerHTML = "";
  listEl.appendChild(frag);
}

function renderTopicDetail(topic) {
  const spLabel = specialtyLabelFromKey(topic.specialtyKey);
  const groups = buildLinkGroups(topic);

  const firstPdf = groups.pdf[0]?.url || "";
  _selectedOpenUrl = firstPdf ? makeOpenUrl(firstPdf) : "";
  _selectedPreviewUrl = ""; // se hidrata async desde Storage/GitHub

  const completed = isTopicCompleted(topic.id);

  const newTabLinks = (items) =>
    (items || [])
      .map(
        (l) => `
      <a class="btn btn-outline btn-sm btn-external" href="${escapeHtml(makeOpenUrl(l.url))}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(l.label)} <span class="btn-external__icon" aria-hidden="true">↗</span>
      </a>
    `
      )
      .join("");

  const pdfLinks = newTabLinks(groups.pdf);
  const resumenLinks = newTabLinks(groups.resumen);
  const gpcLinks = newTabLinks(groups.gpc);
  const otherLinks = newTabLinks(groups.otro);

  const previewBlock = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:14px;">Vista previa</div>
          <div class="panel-subtitle" id="student-resources-preview-note" style="margin-top:4px;">Cargando PDF…</div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <a
            id="student-resources-open-newtab"
            class="btn btn-primary btn-sm ${_selectedOpenUrl ? "" : "hidden"}"
            href="${_selectedOpenUrl ? escapeHtml(_selectedOpenUrl) : "#"}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir PDF
          </a>
        </div>
      </div>

      <div
        id="student-resources-preview-box"
        class="hidden preview-box"
      >
        <div
          id="student-resources-preview-loading"
          class="hidden preview-loading"
        >
          Cargando…
        </div>

        <!-- Fullscreen buttons -->
        <button
          id="student-resources-preview-fs-open"
          class="preview-fs-open"
          type="button"
          title="Pantalla completa"
        >⛶</button>

        <button
          id="student-resources-preview-fs-close"
          class="hidden preview-fs-close"
          type="button"
          title="Cerrar"
        >✕</button>

        <iframe
          id="student-resources-preview-frame"
          class="preview-frame"
          title="Vista previa"
          src="about:blank"
          loading="eager"
          referrerpolicy="no-referrer"
          allow="fullscreen"
        ></iframe>
      </div>
    </div>
  `;

  const allButtons = [pdfLinks, resumenLinks, gpcLinks, otherLinks].filter(Boolean).join("");

  const resourcesPanel = `
    <div class="card resource-unified-card" style="margin-top:12px;">
      <div class="resource-unified-card__header">
        <div class="resource-unified-card__title">Recursos</div>
      </div>
      <div class="resource-unified-card__body">
        <div class="resource-unified-buttons">
          ${allButtons || `<div class="panel-subtitle">No hay recursos en este tema.</div>`}
        </div>
      </div>
    </div>
  `;

  listEl.classList.remove("resources-grid");

  listEl.innerHTML = `
    <div class="card" style="padding:14px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="min-width:240px;">
          <div class="panel-subtitle">${escapeHtml(spLabel)}</div>
          <div style="font-weight:800;font-size:18px; margin-top:4px;">${escapeHtml(topic.title)}</div>
          ${completed ? `<div style="margin-top:10px;"><span class="resource-detail-chip">✓ Completado</span></div>` : ``}
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button id="student-resources-back" class="btn btn-outline btn-sm" type="button">← Volver</button>
          <button id="student-resources-complete" class="btn ${completed ? "btn-outline" : "btn-primary"} btn-sm" type="button">
            ${completed ? "Marcar como no completado" : "Marcar como completado"}
          </button>
        </div>
      </div>
    </div>

    ${previewBlock}
    ${resourcesPanel}

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:700;font-size:14px;">Repaso del tema</div>
      <div class="panel-subtitle" style="margin-top:4px;">Resuelve casos clínicos con preguntas de este tema.</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="student-resources-start-topic-exam" class="btn btn-outline btn-sm" type="button" disabled>En proceso</button>
      </div>
    </div>
  `;

  cachePreviewDomRefs();

  applyTopicExamButtonState(topic.id);
  prefetchTopicExam(topic.id);

  showPreviewUnavailableNote("Cargando PDF…");
  hydrateSelectedTopicPreviewPdf(topic);
}
