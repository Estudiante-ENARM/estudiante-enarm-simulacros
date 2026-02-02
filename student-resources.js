// student-resources.js
// Biblioteca de Resúmenes / PDFs / GPC (usa el 2° proyecto Firebase: pagina-buena)
// Objetivo: UI moderna + filtros robustos (sin romper simulacros).
// OPT PRO: iOS-safe preview (1 iframe + throttle + hard reset) + event delegation.
// REQ: SOLO PDFs en vista previa. Resto SOLO pestaña nueva. NO descargas automáticas.

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

  // ✅ NUEVO: URL del PDF para vista previa (GitHub Pages)
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
let _previewFsOpenBtnEl = null;
let _previewFsCloseBtnEl = null;
let _previewWasBodyOverflow = "";

let _previewToken = 0;
let _previewTimer = null;
let _previewLastSwitchAt = 0;

// render scheduler (evita renders en ráfaga)
let _renderScheduled = false;

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




// ✅ PDF.js viewer (mejor en iOS para multi-página + zoom dentro de iframe)
// Nota: usa el viewer oficial alojado en GitHub Pages de Mozilla.
// Requiere que el PDF sea público y permita CORS (GitHub Pages normalmente sí).
function makePdfJsViewerUrl(pdfUrl) {
  const abs = toAbsoluteUrl(pdfUrl);
  if (!abs) return "";
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(abs)}`;
}


function normalizeGithubPdfUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  // Convierte URLs tipo:
  // https://github.com/<owner>/<repo>/blob/<branch>/<path>
  // a:
  // https://<owner>.github.io/<repo>/<path>
  // Esto hace que el PDF sea "directo" y embebible.
  const m = s.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/[^\/]+\/(.+)$/i);
  if (m && m[1] && m[2] && m[3]) {
    const owner = m[1];
    const repo = m[2];
    const path = m[3];
    return `https://${owner}.github.io/${repo}/${path}`;
  }
  return "";
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

function isSameOriginUrl(raw) {
  const abs = toAbsoluteUrl(raw);
  if (!abs) return false;
  try {
    const u = new URL(abs);
    return u.origin === window.location.origin;
  } catch {
    return false;
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


function makeDirectPdfEmbedUrl(rawUrl) {
  const abs = toAbsoluteUrl(rawUrl);
  if (!abs) return "";

  // Si ya trae #, lo respetamos tal cual.
  if (abs.includes("#")) return abs;

  // iOS Safari es frágil embebiendo PDFs con fragmentos: usar URL limpia.
  if (IS_IOS) return abs;

  // En móvil, evitamos esconder el scrollbar (permite scroll multipágina).
  if (IS_MOBILE) return `${abs}#toolbar=0&navpanes=0`;

  // Desktop: UI mínima
  return `${abs}#toolbar=0&navpanes=0&scrollbar=0`;
}


function makePreviewUrl(url) {
  let raw = String(url || "").trim();
  if (!raw) return "";

  // ✅ GitHub: si pegas el link de "blob", lo convertimos a GitHub Pages (directo)
  raw = normalizeGithubPdfUrl(raw) || raw;

  const n = normalizeText(raw);

  // Si ya es un viewer de Drive, lo respetamos
  if (n.includes("drive.google.com/file") && n.includes("/preview")) return raw;

  // Drive (file o uc): SIEMPRE usar /preview
  if (n.includes("drive.google.com")) {
    const id = extractDriveFileId(raw);
    if (id) return makeDrivePreviewViewerUrl(id);
    return "";
  }

  // PDF directo: lo embebemos tal cual.
  // (Ya NO usamos docs.google.com/gview porque hoy suele bloquearse por X-Frame-Options.)
  if (n.includes(".pdf") || n.includes("application/pdf")) {
  // iOS: usar PDF.js viewer para evitar "solo primera página" y zoom raro dentro de iframe.
  if (IS_IOS) return makePdfJsViewerUrl(raw) || makeDirectPdfEmbedUrl(raw);
  return makeDirectPdfEmbedUrl(raw);
}

  return "";
}


function makeOpenUrl(url) {
  let raw = String(url || "").trim();
  if (!raw) return "";

  // ✅ GitHub: si pegas el link de "blob", lo convertimos a GitHub Pages (directo)
  raw = normalizeGithubPdfUrl(raw) || raw;

  const n = normalizeText(raw);

  if (n.includes("drive.google.com")) {
    const id = extractDriveFileId(raw);
    if (id) return makeDriveViewUrl(id);
    return raw;
  }

  return raw;
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

  if (_previewFrameEl && !_previewFrameEl.dataset.bound) {
    _previewFrameEl.dataset.bound = "1";

    _previewFrameEl.addEventListener("load", () => {
      if (!_previewFrameEl) return;
      if (String(_previewToken) !== String(_previewFrameEl.dataset.token || "")) return;
      setPreviewLoading(false);
    });

    _previewFrameEl.addEventListener("error", () => {
      if (!_previewFrameEl) return;
      if (String(_previewToken) !== String(_previewFrameEl.dataset.token || "")) return;
      setPreviewLoading(false);
      showPreviewUnavailableNote();
    });
  }

  // ✅ Fullscreen (sin recargar el iframe)
  if (_previewBoxEl && !_previewBoxEl.dataset.fsBound) {
    _previewBoxEl.dataset.fsBound = "1";
    if (!_previewBoxEl.dataset.baseStyle) _previewBoxEl.dataset.baseStyle = _previewBoxEl.getAttribute("style") || "";

    if (_previewFsOpenBtnEl && !_previewFsOpenBtnEl.dataset.bound) {
      _previewFsOpenBtnEl.dataset.bound = "1";
      _previewFsOpenBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterPreviewFullscreen();
      });
    }

    if (_previewFsCloseBtnEl && !_previewFsCloseBtnEl.dataset.bound) {
      _previewFsCloseBtnEl.dataset.bound = "1";
      _previewFsCloseBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        exitPreviewFullscreen();
      });
    }
  }

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


function enterPreviewFullscreen() {
  if (!_previewBoxEl) return;
  if (_previewBoxEl.classList.contains("hidden")) return;
  if (_previewBoxEl.dataset.fullscreen === "1") return;

  _previewBoxEl.dataset.fullscreen = "1";

  // Guardar y bloquear scroll del body
  _previewWasBodyOverflow = document.body.style.overflow || "";
  document.body.style.overflow = "hidden";

  // Guardar estilo base para restaurar al cerrar
  const base = _previewBoxEl.dataset.baseStyle || (_previewBoxEl.getAttribute("style") || "");
  _previewBoxEl.dataset.baseStyle = base;

  // Aplicar fullscreen
  _previewBoxEl.setAttribute(
    "style",
    base +
      "; position:fixed; inset:0; width:100vw; height:100vh; margin:0 !important; border-radius:0 !important; z-index:9999;"
  );

  if (_previewFsOpenBtnEl) _previewFsOpenBtnEl.classList.add("hidden");
  if (_previewFsCloseBtnEl) _previewFsCloseBtnEl.classList.remove("hidden");
}

function exitPreviewFullscreen() {
  if (!_previewBoxEl) return;
  if (_previewBoxEl.dataset.fullscreen !== "1") return;

  _previewBoxEl.dataset.fullscreen = "0";

  // Restaurar body
  document.body.style.overflow = _previewWasBodyOverflow || "";

  // Restaurar estilo base
  const base = _previewBoxEl.dataset.baseStyle || "";
  if (base) _previewBoxEl.setAttribute("style", base);
  else _previewBoxEl.removeAttribute("style");

  if (_previewFsOpenBtnEl) _previewFsOpenBtnEl.classList.remove("hidden");
  if (_previewFsCloseBtnEl) _previewFsCloseBtnEl.classList.add("hidden");
}

function disposeInlinePreview() {
  try {
    if (_previewFrameEl) _previewFrameEl.src = "about:blank";
  } catch {}
  exitPreviewFullscreen();
  setPreviewLoading(false);
  clearTimeout(_previewTimer);
  _previewTimer = null;
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

  setPreviewLoading(true);

  // HARD RESET
  _previewFrameEl.dataset.token = String(token);
  _previewFrameEl.src = "about:blank";

  requestAnimationFrame(() => {
    if (token !== _previewToken) return;

    const url = _selectedPreviewUrl;

    _previewFrameEl.dataset.token = String(token);
    _previewFrameEl.src = url;
  });
}

function schedulePreviewUpdate() {
  if (!_previewFrameEl) return;

  const now = performance.now();
  const minGap = IS_IOS ? 650 : IS_MOBILE ? 450 : 150;
  const wait = Math.max(0, minGap - (now - _previewLastSwitchAt));
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
          scheduleRender();
          return;
        }
      }

      // DETAIL VIEW: back
      if (target?.closest?.("#student-resources-back")) {
        e.preventDefault();
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

  
// ✅ Mantener vista previa al cambiar de pestaña
// Algunos navegadores (Safari/iOS y también algunos desktop) pueden “vaciar” el PDF embebido al volver.
// Solución: NO limpiar al ocultar; al volver, forzamos un refresh suave del iframe.
  if (!document.documentElement.dataset.resourcesVisBound) {
    document.documentElement.dataset.resourcesVisBound = "1";

    let _tabWasHidden = false;

    const refreshPreviewAfterTabReturn = () => {
      try {
        // Solo si estamos viendo un tema con PDF
        if (!_selectedTopicId || !_selectedPreviewUrl) return;

        cachePreviewDomRefs();
        if (!_previewFrameEl || !_previewBoxEl) return;
        if (_previewBoxEl.classList.contains("hidden")) return;

        // Refresh suave: si hay src, re-asignarlo; si está en blanco, aplicar preview normal.
        const currentSrc = String(_previewFrameEl.getAttribute("src") || _previewFrameEl.src || "");
        if (currentSrc && currentSrc !== "about:blank") {
          setPreviewLoading(true);
          _previewFrameEl.dataset.token = String(++_previewToken);
          _previewFrameEl.src = currentSrc;
          return;
        }

        schedulePreviewUpdate();
      } catch {
        // fallback duro
        schedulePreviewUpdate();
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        _tabWasHidden = true;
        return;
      }
      if (_tabWasHidden) {
        _tabWasHidden = false;
        refreshPreviewAfterTabReturn();
      }
    });

    window.addEventListener("focus", () => {
      // En algunos casos no dispara visibilitychange (mobile); focus ayuda.
      refreshPreviewAfterTabReturn();
    });

    window.addEventListener("pageshow", (e) => {
      // Si el navegador regresa desde BFCache, re-hidratar.
      if (e && e.persisted) refreshPreviewAfterTabReturn();
    });
  }


  // ✅ ESC cierra fullscreen del PDF
  if (!document.documentElement.dataset.resourcesFsEscBound) {
    document.documentElement.dataset.resourcesFsEscBound = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") exitPreviewFullscreen();
    });
  }

  ensureModal();
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
          // ✅ NUEVO: soporte directo para GitHub Pages (si guardas el URL como campos simples)
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
          // ✅ NUEVO: soporte directo para GitHub Pages (si guardas el URL como campos simples)
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

  // ✅ Al abrir el tema:
  // - El botón "Abrir PDF" abre el PRIMER PDF (link externo en links[]).
  // - La vista previa se carga desde el PDF dedicado del tema:
  //     * GitHub Pages: previewPdf.url (o previewPdfUrl) + previewPdf.version
  //     * Legacy:      previewPdf.path (Storage)
  //   (si no existe, se muestra un mensaje).
  const firstPdf = groups.pdf[0]?.url || "";
  _selectedOpenUrl = firstPdf ? makeOpenUrl(firstPdf) : "";
  _selectedPreviewUrl = ""; // se hidrata async desde Storage

  const completed = isTopicCompleted(topic.id);

  // Helpers de botones (sin textos extra)
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

  // Links en pestaña nueva
  const pdfLinks = newTabLinks(groups.pdf);       // ✅ ya NO se usan para vista previa
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

      <div
        id="student-resources-preview-box"
        class="hidden"
        style="margin-top:12px; width:100%; height:70vh; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; position:relative;"
      >
        <div
          id="student-resources-preview-loading"
          class="hidden"
          style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.85); z-index:2; font-weight:700;"
        >
          Cargando…
        </div>

        <iframe
          id="student-resources-preview-frame"
          title="Vista previa"
          src="about:blank"
          style="width:100%;height:100%;border:0;"
          loading="eager"
          scrolling="yes"
          allow="fullscreen"
          allowfullscreen
        ></iframe>

        <button
          id="student-resources-preview-fs-open"
          type="button"
          aria-label="Pantalla completa"
          style="position:absolute; right:12px; bottom:12px; z-index:3; width:44px; height:44px; border-radius:12px; border:1px solid rgba(0,0,0,.08); background:rgba(255,255,255,.92); font-size:18px; font-weight:800; cursor:pointer;"
        >⛶</button>

        <button
          id="student-resources-preview-fs-close"
          type="button"
          class="hidden"
          aria-label="Cerrar pantalla completa"
          style="position:absolute; right:12px; top:12px; z-index:4; width:44px; height:44px; border-radius:12px; border:1px solid rgba(0,0,0,.08); background:rgba(255,255,255,.92); font-size:18px; font-weight:800; cursor:pointer;"
        >✕</button>

      </div>
    </div>
  `;

  // ✅ Un solo bloque "Recursos"
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

  // Estado inicial del botón de repaso (cache o default: En proceso)
  applyTopicExamButtonState(topic.id);
  prefetchTopicExam(topic.id);

  // Estado inicial de la vista previa
  showPreviewUnavailableNote("Cargando PDF…");
  hydrateSelectedTopicPreviewPdf(topic);
}

