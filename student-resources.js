// student-resources.js
// Biblioteca de Resúmenes / PDFs / GPC (usa el 2° proyecto Firebase: pagina-buena)
// ✅ CAMBIO SOLICITADO: SOLO PDFs tienen VISTA PREVIA.
// - Todo lo demás (Docs/Word/GPC/Otros) NO tiene vista previa para evitar bug.
// - Mantiene "Abrir en pestaña nueva" para TODOS.
// - No modifica tu BD ni Firestore.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/****************************************************
 * Firebase (proyecto de BIBLIOTECA)
 ****************************************************/
const RESOURCES_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCgxVWMPttDzvGxqo7jaP-jKgS4Cj8P30I",
  authDomain: "pagina-buena.firebaseapp.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.appspot.com",
  messagingSenderId: "1031211281182",
  appId: "1:1031211281182:web:c1e26006b68b189acc4efd",
};

let resourcesDb = null;
function ensureResourcesDb() {
  if (resourcesDb) return resourcesDb;

  const exists = getApps().some((a) => a.name === "resourcesApp");
  const app = exists
    ? getApp("resourcesApp")
    : initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");

  resourcesDb = getFirestore(app);
  return resourcesDb;
}

/****************************************************
 * Estado
 ****************************************************/
let _uiInitialized = false;
let _dataLoaded = false;
let _allTopics = [];

let selectedSpecialtyKey = "";
let searchQuery = "";

// navegación
let _selectedTopicId = null;

// open/preview seleccionado
let _selectedOpenUrl = "";
let _selectedPreviewUrl = "";

// progreso (localStorage por usuario)
let _currentUserKey = "anon";

let viewEl, searchEl, specialtyEl, listEl, detailEl, countEl, emptyEl, loadingEl;

let modalRoot = null; // se conserva (no se usa)

let _iframeEl = null;
let _iframeContainerEl = null;
let _iframeStatusEl = null;
let _iframeFallbackEl = null;

let _activeLoadToken = 0;
let _loadTimer = null;

let _isIframeLoading = false;
let _pendingOpenUrl = "";
let _pendingPreviewUrl = "";

/****************************************************
 * Normalización y mapeo
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
  if (n.includes("medicina interna") || (n.includes("medicina") && n.includes("interna")))
    return "medicina_interna";
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
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/****************************************************
 * Clasificación de links
 ****************************************************/
function guessLinkType(label, url) {
  const l = normalizeText(label);
  const u = normalizeText(url);

  if (
    l.includes("resumen") ||
    l.includes("word") ||
    u.includes("docs.google.com/document") ||
    u.includes(".doc") ||
    u.includes(".docx")
  ) {
    return "resumen";
  }

  if (l.includes("gpc") || l.includes("guia") || l.includes("practica clinica")) return "gpc";

  if (l.includes("pdf") || u.includes(".pdf") || u.includes("application/pdf")) return "pdf";
  if (u.includes("drive.google.com/file")) return "pdf";

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
  } catch {}
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
 * Preview helpers (Drive PDFs)
 * ✅ Solo usamos preview cuando es PDF.
 ****************************************************/
function extractDriveFileId(url) {
  const u = String(url || "");

  const m1 = u.match(/\/file\/d\/([^/]+)/i);
  if (m1 && m1[1]) return m1[1];

  const m2 = u.match(/[?&]id=([^&]+)/i);
  if (m2 && m2[1]) return m2[1];

  const m3 = u.match(/\/uc\?(?:.*&)?id=([^&]+)/i);
  if (m3 && m3[1]) return m3[1];

  return "";
}

function looksLikePdf(url) {
  const u = normalizeText(url);
  return u.includes(".pdf") || u.includes("application/pdf") || u.includes("drive.google.com/file");
}

function makePdfPreviewUrl(url) {
  const u = String(url || "").trim();
  const n = normalizeText(u);

  // Drive file -> /preview
  if (n.includes("drive.google.com")) {
    const fileId = extractDriveFileId(u);
    if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  // PDF directo
  if (n.endsWith(".pdf") || n.includes(".pdf?")) return u;

  return "";
}

/****************************************************
 * Modal (se conserva)
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
    if (e.key === "Escape" && modalRoot && !modalRoot.classList.contains("hidden")) {
      closeModal();
    }
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

  if (viewEl) viewEl.setAttribute("data-ui", "cards");

  // Oculta panel derecho
  if (detailEl) {
    detailEl.innerHTML = "";
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
      _selectedOpenUrl = "";
      _selectedPreviewUrl = "";
      _activeLoadToken += 1;
      clearLoadTimer();
      _isIframeLoading = false;
      _pendingOpenUrl = "";
      _pendingPreviewUrl = "";
      render();
    });
  }

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", () => {
      searchQuery = String(searchEl.value || "").trim();
      _selectedTopicId = null;
      _selectedOpenUrl = "";
      _selectedPreviewUrl = "";
      _activeLoadToken += 1;
      clearLoadTimer();
      _isIframeLoading = false;
      _pendingOpenUrl = "";
      _pendingPreviewUrl = "";
      render();
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
          links: Array.isArray(data.links) ? data.links : [],
        };
      });

      _dataLoaded = true;
    }

    render();
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
 * API opcional: identidad usuario
 ****************************************************/
export function setStudentResourcesUserIdentity(emailOrUid) {
  _currentUserKey = normalizeText(emailOrUid || "anon") || "anon";
}

/****************************************************
 * iframe manager
 ****************************************************/
function clearLoadTimer() {
  if (_loadTimer) {
    clearTimeout(_loadTimer);
    _loadTimer = null;
  }
}

function ensurePreviewElements() {
  if (!_iframeContainerEl) _iframeContainerEl = listEl?.querySelector("[data-preview-container]") || null;
  if (!_iframeStatusEl) _iframeStatusEl = listEl?.querySelector("[data-preview-status]") || null;
  if (!_iframeFallbackEl) _iframeFallbackEl = listEl?.querySelector("[data-preview-fallback]") || null;
  if (_iframeContainerEl && !_iframeEl) {
    _iframeEl = _iframeContainerEl.querySelector("iframe");
  }
}

function wireIframeLoadOnce(iframe) {
  if (!iframe) return;
  iframe.addEventListener("load", () => {
    const token = Number(iframe.getAttribute("data-load-token") || "0");
    if (token !== _activeLoadToken) return;

    clearLoadTimer();

    if (_iframeStatusEl) _iframeStatusEl.textContent = "Cargado.";
    if (_iframeFallbackEl) _iframeFallbackEl.classList.add("hidden");

    _isIframeLoading = false;

    if (_pendingPreviewUrl && _pendingOpenUrl) {
      const nextPreview = _pendingPreviewUrl;
      const nextOpen = _pendingOpenUrl;
      _pendingPreviewUrl = "";
      _pendingOpenUrl = "";
      setTimeout(() => startIframeLoad(nextPreview, nextOpen), 120);
    }
  });
}

function recreateIframe() {
  ensurePreviewElements();
  if (!_iframeContainerEl) return null;

  const old = _iframeContainerEl.querySelector("iframe");
  if (old) {
    try { old.src = "about:blank"; } catch {}
    try { old.remove(); } catch {}
  }

  const iframe = document.createElement("iframe");
  iframe.title = "Vista previa";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "no-referrer";
  iframe.src = "about:blank";

  _iframeContainerEl.appendChild(iframe);
  _iframeEl = iframe;

  wireIframeLoadOnce(iframe);
  return iframe;
}

function startIframeLoad(previewUrl, openUrl) {
  ensurePreviewElements();
  if (!_iframeContainerEl) return;

  _isIframeLoading = true;
  _pendingOpenUrl = "";
  _pendingPreviewUrl = "";

  _activeLoadToken += 1;
  const myToken = _activeLoadToken;

  if (_iframeStatusEl) _iframeStatusEl.textContent = "Cargando…";
  if (_iframeFallbackEl) {
    _iframeFallbackEl.classList.add("hidden");
    const a = _iframeFallbackEl.querySelector("a[data-fallback-open]");
    if (a && openUrl) a.setAttribute("href", openUrl);
  }

  clearLoadTimer();

  const iframe = recreateIframe();
  if (!iframe) return;

  _loadTimer = setTimeout(() => {
    if (myToken !== _activeLoadToken) return;

    if (_iframeStatusEl) {
      _iframeStatusEl.textContent =
        "No se pudo cargar la vista previa (Drive/Safari puede bloquear).";
    }
    if (_iframeFallbackEl) _iframeFallbackEl.classList.remove("hidden");

    _isIframeLoading = false;

    if (_pendingPreviewUrl && _pendingOpenUrl) {
      const nextPreview = _pendingPreviewUrl;
      const nextOpen = _pendingOpenUrl;
      _pendingPreviewUrl = "";
      _pendingOpenUrl = "";
      setTimeout(() => startIframeLoad(nextPreview, nextOpen), 120);
    }
  }, 9000);

  requestAnimationFrame(() => {
    if (myToken !== _activeLoadToken) return;
    try {
      iframe.setAttribute("data-load-token", String(myToken));
      iframe.src = previewUrl;
    } catch {
      clearLoadTimer();
      if (_iframeStatusEl) _iframeStatusEl.textContent = "No se pudo cargar.";
      if (_iframeFallbackEl) _iframeFallbackEl.classList.remove("hidden");

      _isIframeLoading = false;

      if (_pendingPreviewUrl && _pendingOpenUrl) {
        const nextPreview = _pendingPreviewUrl;
        const nextOpen = _pendingOpenUrl;
        _pendingPreviewUrl = "";
        _pendingOpenUrl = "";
        setTimeout(() => startIframeLoad(nextPreview, nextOpen), 120);
      }
    }
  });
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

function render() {
  if (!listEl) return;

  const filtered = applyFilters(_allTopics);

  if (countEl) {
    countEl.textContent = `${filtered.length} tema${filtered.length === 1 ? "" : "s"}`;
  }

  const selected = getSelectedTopic();
  if (selected) {
    hide(emptyEl);
    renderTopicDetail(selected);
    return;
  }

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
    card.className = "resource-card";
    card.innerHTML = `
      <div class="resource-card__top">
        <div class="resource-card__meta">
          <div class="resource-card__specialty">${escapeHtml(spLabel)}</div>
          <div class="resource-card__title">${escapeHtml(t.title)}</div>
        </div>
        <button class="btn btn-primary btn-sm resource-card__open">Abrir</button>
      </div>
      <div class="resource-card__badges">${badges.join("")}</div>
    `;

    const go = () => {
      _selectedTopicId = t.id;
      _selectedOpenUrl = "";
      _selectedPreviewUrl = "";
      _activeLoadToken += 1;
      clearLoadTimer();
      _isIframeLoading = false;
      _pendingOpenUrl = "";
      _pendingPreviewUrl = "";
      render();
    };

    card.querySelector(".resource-card__open")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      go();
    });

    card.addEventListener("click", go);

    frag.appendChild(card);
  });

  listEl.innerHTML = "";
  listEl.appendChild(frag);
}

function renderTopicDetail(topic) {
  const spLabel = specialtyLabelFromKey(topic.specialtyKey);
  const groups = buildLinkGroups(topic);

  // Default: primer PDF si existe para preview, si no, primero lo que haya
  if (!_selectedOpenUrl) {
    const firstPdf = groups.pdf[0]?.url || "";
    const firstResumen = groups.resumen[0]?.url || "";
    const firstGpc = groups.gpc[0]?.url || "";
    const firstOther = groups.otro[0]?.url || "";
    _selectedOpenUrl = firstPdf || firstResumen || firstGpc || firstOther || "";

    // ✅ SOLO PDF PREVIEW
    _selectedPreviewUrl = looksLikePdf(_selectedOpenUrl) ? (makePdfPreviewUrl(_selectedOpenUrl) || "") : "";
  }

  const completed = isTopicCompleted(topic.id);

  const buildSection = (items, title) => {
    if (!items.length) return "";
    return `
      <div style="margin-top:12px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;">${escapeHtml(title)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${items.map((l) => `
            <button
              class="btn btn-outline btn-sm"
              type="button"
              data-open-url="${escapeHtml(l.url)}"
            >${escapeHtml(l.label)}</button>
          `).join("")}
        </div>
      </div>
    `;
  };

  const previewMessage = (() => {
    if (!_selectedOpenUrl) return "Selecciona un archivo para abrir.";
    if (!looksLikePdf(_selectedOpenUrl)) {
      return "Vista previa desactivada para este tipo de archivo. Usa “Abrir en pestaña nueva”.";
    }
    return "PDF: si no carga, abre en una pestaña nueva.";
  })();

  const previewBlock = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:14px;">Vista previa</div>
          <div class="panel-subtitle" style="margin-top:6px;" data-preview-status>
            ${escapeHtml(previewMessage)}
          </div>
        </div>

        ${_selectedOpenUrl ? `
          <a class="btn btn-primary btn-sm" href="${escapeHtml(_selectedOpenUrl)}" target="_blank" rel="noopener noreferrer">
            Abrir en pestaña nueva
          </a>
        ` : ""}
      </div>

      <div style="margin-top:12px; width:100%; height:70vh; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;" data-preview-container>
        ${(_selectedPreviewUrl ? `
          <iframe
            title="Vista previa"
            src="about:blank"
            style="width:100%;height:100%;border:0;"
            loading="lazy"
            referrerpolicy="no-referrer"
          ></iframe>
        ` : `
          <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;color:#6b7280;">
            Vista previa desactivada para este archivo.
          </div>
        `)}
      </div>

      <div class="card hidden" style="margin-top:10px; padding:12px; border-left:4px solid #f59e0b;" data-preview-fallback>
        <div style="font-weight:700; font-size:13px; margin-bottom:6px;">Vista previa bloqueada</div>
        <div class="panel-subtitle">
          Drive/Safari puede bloquear el embebido. Abre el archivo en pestaña nueva.
        </div>
        <div style="margin-top:10px;">
          <a class="btn btn-primary btn-sm" data-fallback-open href="${escapeHtml(_selectedOpenUrl)}" target="_blank" rel="noopener noreferrer">
            Abrir en pestaña nueva
          </a>
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
          <div class="panel-subtitle" style="margin-top:6px;">
            Marca como completado cuando termines de estudiar este tema.
          </div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button id="student-resources-back" class="btn btn-outline btn-sm" type="button">← Volver</button>
          <button id="student-resources-complete" class="btn ${completed ? "btn-outline" : "btn-primary"} btn-sm" type="button">
            ${completed ? "Marcar como no completado" : "Marcar como completado"}
          </button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:800;font-size:15px;margin-bottom:6px;">Recursos (todo en un solo recuadro)</div>
      <div class="panel-subtitle" style="margin-bottom:10px;">
        Solo los PDFs tienen vista previa para evitar que la página se trabe. Todo lo demás se abre en pestaña nueva.
      </div>

      ${buildSection(groups.resumen, "Resúmenes")}
      ${buildSection(groups.pdf, "PDFs")}
      ${buildSection(groups.gpc, "GPC")}
      ${buildSection(groups.otro, "Otros")}
    </div>

    ${previewBlock}
  `;

  // reset refs
  _iframeEl = null;
  _iframeContainerEl = null;
  _iframeStatusEl = null;
  _iframeFallbackEl = null;
  ensurePreviewElements();

  // volver
  listEl.querySelector("#student-resources-back")?.addEventListener("click", () => {
    _selectedTopicId = null;
    _selectedOpenUrl = "";
    _selectedPreviewUrl = "";
    _activeLoadToken += 1;
    clearLoadTimer();
    _isIframeLoading = false;
    _pendingOpenUrl = "";
    _pendingPreviewUrl = "";
    render();
  });

  // completado
  listEl.querySelector("#student-resources-complete")?.addEventListener("click", () => {
    toggleTopicCompleted(topic.id);
    render();
  });

  // botones de recursos
  listEl.querySelectorAll("button[data-open-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextOpen = btn.getAttribute("data-open-url") || "";

      // ✅ SOLO PDF PREVIEW
      const nextPreview = looksLikePdf(nextOpen) ? (makePdfPreviewUrl(nextOpen) || "") : "";

      _selectedOpenUrl = nextOpen;
      _selectedPreviewUrl = nextPreview;

      render();

      // Si no hay preview, no hacemos iframe load
      if (!nextPreview) return;

      // Cola (último click gana)
      setTimeout(() => {
        if (_selectedOpenUrl !== nextOpen) return;

        ensurePreviewElements();
        if (!_iframeContainerEl) return;

        if (_isIframeLoading) {
          _pendingOpenUrl = _selectedOpenUrl;
          _pendingPreviewUrl = _selectedPreviewUrl;
          if (_iframeStatusEl) _iframeStatusEl.textContent = "Cargando… (se aplicará tu última selección)";
          return;
        }

        startIframeLoad(_selectedPreviewUrl, _selectedOpenUrl);
      }, 0);
    });
  });

  // carga inicial si hay preview (PDF)
  if (_selectedOpenUrl && _selectedPreviewUrl) {
    startIframeLoad(_selectedPreviewUrl, _selectedOpenUrl);
  } else {
    ensurePreviewElements();
    if (_iframeFallbackEl) _iframeFallbackEl.classList.add("hidden");
  }
}
