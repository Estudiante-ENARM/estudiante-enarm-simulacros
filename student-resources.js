// student-resources.js
// REGLAS:
// 1) SOLO links cuyo LABEL contenga "PDF" pueden abrir vista previa inline.
// 2) Vista previa ARRIBA.
// 3) Panel de recursos ABAJO.
// 4) Resúmenes / GPC / Otros: SOLO pestaña nueva.
// 5) NUNCA descargar automático: no usamos uc?export=download y NO auto-cargamos preview al entrar al tema.
// OPT: iOS-safe (1 iframe + throttle + hard reset) + event delegation.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
  const app = exists ? getApp("resourcesApp") : initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");

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

let _selectedTopicId = null;

// link real y link de preview
let _selectedPreviewUrl = "";
let _selectedOpenUrl = "";

let _currentUserKey = "anon";

let viewEl, searchEl, specialtyEl, listEl, detailEl, countEl, emptyEl, loadingEl;

let modalRoot = null;

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

let _previewToken = 0;
let _previewTimer = null;
let _previewLastSwitchAt = 0;

let _renderScheduled = false;

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

/****************************************************
 * Regla clave: SOLO preview si el NOMBRE contiene "PDF"
 ****************************************************/
function isPdfByLabel(label) {
  return normalizeText(label).includes("pdf");
}

/****************************************************
 * Clasificación de links (para badges y panel)
 ****************************************************/
function guessLinkType(label, url) {
  const l = normalizeText(label);
  const u = normalizeText(url);

  // Resumen/Word/Docs -> resumen (solo pestaña nueva)
  if (l.includes("resumen") || l.includes("word") || u.includes("docs.google.com/document") || u.includes(".doc")) {
    return "resumen";
  }

  // GPC (solo pestaña nueva)
  if (l.includes("gpc") || l.includes("guia") || l.includes("practica clinica")) {
    return "gpc";
  }

  // PDF (para badge/panel): si label dice PDF o URL es pdf/drive-file
  if (l.includes("pdf") || u.includes(".pdf") || u.includes("application/pdf") || u.includes("drive.google.com/file")) {
    return "pdf";
  }

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
 * Preview helpers (SOLO PDFs por label)
 * - NUNCA usamos uc?export=download (evita descargas)
 * - Para Drive usamos /preview?rm=minimal
 ****************************************************/
function extractDriveFileId(url) {
  const u = String(url || "");
  const m1 = u.match(/\/file\/d\/([^/]+)/i);
  if (m1 && m1[1]) return m1[1];

  const m2 = u.match(/[?&]id=([^&]+)/i);
  if (m2 && m2[1]) return m2[1];

  return "";
}

function makePreviewUrlForPdf(rawUrl) {
  const u = String(rawUrl || "");
  const n = normalizeText(u);

  // PDF directo
  if (n.endsWith(".pdf") || n.includes(".pdf?")) return u;

  // Drive file -> preview minimal (NO descarga)
  if (n.includes("drive.google.com")) {
    const fileId = extractDriveFileId(u);
    if (fileId) {
      const base = `https://drive.google.com/file/d/${fileId}/preview`;
      return IS_MOBILE ? `${base}?rm=minimal` : base;
    }
  }

  return "";
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

  if (_previewFrameEl && !_previewFrameEl.dataset.bound) {
    _previewFrameEl.dataset.bound = "1";

    _previewFrameEl.addEventListener("load", () => {
      if (!_previewFrameEl) return;
      if (String(_previewToken) !== String(_previewFrameEl.dataset.token || "")) return;
      setPreviewLoading(false);
      // Nota: si Drive muestra pantalla de permisos (403), no podemos detectarlo por CORS.
      // Por eso siempre dejamos visible el botón "Abrir en pestaña nueva".
    });

    _previewFrameEl.addEventListener("error", () => {
      if (!_previewFrameEl) return;
      if (String(_previewToken) !== String(_previewFrameEl.dataset.token || "")) return;
      setPreviewLoading(false);
      showPreviewUnavailableNote(
        "No se pudo cargar la vista previa. Si ves 403, el archivo no es público. Ábrelo en pestaña nueva o cambia permisos."
      );
    });
  }
}

function setPreviewLoading(on) {
  if (!_previewLoadingEl) return;
  if (on) _previewLoadingEl.classList.remove("hidden");
  else _previewLoadingEl.classList.add("hidden");
}

function showPreviewUnavailableNote(customText) {
  if (_previewNoteEl) {
    _previewNoteEl.textContent =
      customText ||
      "Selecciona un recurso con nombre “PDF” para previsualizar. Si aparece 403, el archivo no es público.";
  }
  if (_previewBoxEl) _previewBoxEl.classList.add("hidden");
}

function disposeInlinePreview() {
  try {
    if (_previewFrameEl) _previewFrameEl.src = "about:blank";
  } catch {}
  setPreviewLoading(false);
  clearTimeout(_previewTimer);
  _previewTimer = null;
}

function applyPreviewToDom(token) {
  if (!_previewFrameEl) return;

  // Botón abrir (siempre disponible cuando hay selección)
  if (_previewOpenBtnEl) {
    if (_selectedOpenUrl) {
      _previewOpenBtnEl.classList.remove("hidden");
      _previewOpenBtnEl.setAttribute("href", _selectedOpenUrl);
    } else {
      _previewOpenBtnEl.classList.add("hidden");
      _previewOpenBtnEl.removeAttribute("href");
    }
  }

  // Sin preview
  if (!_selectedPreviewUrl) {
    if (_previewFrameEl) _previewFrameEl.src = "about:blank";
    showPreviewUnavailableNote();
    return;
  }

  if (_previewBoxEl) _previewBoxEl.classList.remove("hidden");
  if (_previewNoteEl) {
    _previewNoteEl.textContent =
      "Si no carga o ves 403, el PDF no es público. Ábrelo en pestaña nueva o cambia permisos a “Cualquiera con el enlace”.";
  }

  setPreviewLoading(true);

  // HARD RESET (clave en iOS)
  _previewFrameEl.dataset.token = String(token);
  _previewFrameEl.src = "about:blank";

  requestAnimationFrame(() => {
    if (token !== _previewToken) return;

    const url = _selectedPreviewUrl;
    const sep = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${sep}v=${token}`;

    _previewFrameEl.dataset.token = String(token);
    _previewFrameEl.src = finalUrl;
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

  _previewTimer = setTimeout(() => applyPreviewToDom(token), wait);
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

  if (viewEl) viewEl.setAttribute("data-ui", "cards");
  if (detailEl) detailEl.innerHTML = "";

  // Ocultar columna derecha (si existe) y usar todo el ancho
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

  // Event delegation: 1 listener
  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = "1";

    listEl.addEventListener("click", (e) => {
      const target = e.target;

      // LIST VIEW: abrir tema
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

          // IMPORTANTÍSIMO: no auto-preview al entrar al tema
          _selectedPreviewUrl = "";
          _selectedOpenUrl = "";

          scheduleRender();
          return;
        }
      }

      // DETAIL: volver
      if (target?.closest?.("#student-resources-back")) {
        e.preventDefault();
        disposeInlinePreview();
        _selectedTopicId = null;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        scheduleRender();
        return;
      }

      // DETAIL: completado
      if (target?.closest?.("#student-resources-complete")) {
        e.preventDefault();
        const topic = getSelectedTopic();
        if (topic) {
          toggleTopicCompleted(topic.id);
          scheduleRender();
        }
        return;
      }

      // DETAIL: SOLO PDFs (por label) actualizan preview
      const pdfBtn = target?.closest?.("button[data-pdf-label][data-pdf-url]");
      if (pdfBtn) {
        e.preventDefault();

        const rawUrl = pdfBtn.getAttribute("data-pdf-url") || "";
        const rawLabel = pdfBtn.getAttribute("data-pdf-label") || "";

        if (!isPdfByLabel(rawLabel)) return;

        _selectedOpenUrl = rawUrl;
        _selectedPreviewUrl = makePreviewUrlForPdf(rawUrl);

        // UI pressed
        listEl.querySelectorAll("button[data-pdf-label][aria-pressed='true']").forEach((b) => {
          b.setAttribute("aria-pressed", "false");
        });
        pdfBtn.setAttribute("aria-pressed", "true");

        cachePreviewDomRefs();
        schedulePreviewUpdate();
        return;
      }
    });
  }

  // Si el tab se oculta, corta el iframe
  if (!document.documentElement.dataset.resourcesVisBound) {
    document.documentElement.dataset.resourcesVisBound = "1";
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) disposeInlinePreview();
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

  if (countEl) countEl.textContent = `${filtered.length} tema${filtered.length === 1 ? "" : "s"}`;

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
    const completed = isTopicCompleted(t.id);
    const spLabel = specialtyLabelFromKey(t.specialtyKey);

    const pdfCount = (groups.pdf || []).length;
    const gpcCount = (groups.gpc || []).length;
    const resumenCount = (groups.resumen || []).length;
    const otherCount = (groups.otro || []).length;

    const badges = [];
    if (completed) badges.push(`<span class="resource-badge">Completado</span>`);
    if (resumenCount) badges.push(`<span class="resource-badge">Resumen ${resumenCount}</span>`);
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
  const completed = isTopicCompleted(topic.id);

  // Vista previa ARRIBA
  const previewBlock = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:14px;">Vista previa (solo “PDF”)</div>
          <div class="panel-subtitle" id="student-resources-preview-note" style="margin-top:4px;">
            Selecciona un recurso con nombre “PDF” para previsualizar. Si aparece 403, el archivo no es público.
          </div>
        </div>

        <a
          id="student-resources-open-newtab"
          class="btn btn-primary btn-sm hidden"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir en pestaña nueva
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
        ></iframe>
      </div>
    </div>
  `;

  // Panel ABAJO
  const sectionHtml = (label, inner) => {
    if (!inner) return "";
    return `
      <div class="resource-unified-group">
        <div class="resource-unified-group__label">${escapeHtml(label)}</div>
        <div class="resource-unified-group__buttons">${inner}</div>
      </div>
    `;
  };

  // PDFs: si label contiene PDF => botón de preview; si no => pestaña nueva
  const pdfButtons = (groups.pdf || [])
    .map((l) => {
      if (!isPdfByLabel(l.label)) {
        return `
          <a class="btn btn-outline btn-sm" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(l.label)}
          </a>
        `;
      }
      return `
        <button
          class="btn btn-outline btn-sm"
          type="button"
          data-pdf-label="${escapeHtml(l.label)}"
          data-pdf-url="${escapeHtml(l.url)}"
          aria-pressed="false"
        >${escapeHtml(l.label)}</button>
      `;
    })
    .join("");

  const resumenLinks = (groups.resumen || [])
    .map(
      (l) => `
        <a class="btn btn-outline btn-sm" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(l.label)}
        </a>
      `
    )
    .join("");

  const gpcLinks = (groups.gpc || [])
    .map(
      (l) => `
        <a class="btn btn-outline btn-sm" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(l.label)}
        </a>
      `
    )
    .join("");

  const otherLinks = (groups.otro || [])
    .map(
      (l) => `
        <a class="btn btn-outline btn-sm" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(l.label)}
        </a>
      `
    )
    .join("");

  const unifiedPanel = `
    <div class="card resource-unified-card" style="margin-top:12px;">
      <div class="resource-unified-card__header">
        <div class="resource-unified-card__title">Recursos</div>
        <div class="panel-subtitle" style="margin-top:4px;">
          PDFs con nombre “PDF” = vista previa. Todo lo demás = pestaña nueva.
        </div>
      </div>
      <div class="resource-unified-card__body">
        ${sectionHtml("PDFs", pdfButtons)}
        ${sectionHtml("Resúmenes (pestaña nueva)", resumenLinks)}
        ${sectionHtml("GPC (pestaña nueva)", gpcLinks)}
        ${sectionHtml("Otros (pestaña nueva)", otherLinks)}
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
    ${unifiedPanel}
  `;

  cachePreviewDomRefs();

  // NO auto-preview aquí: queda en about:blank hasta que el usuario toque un PDF.
  applyPreviewToDom(++_previewToken);
}
