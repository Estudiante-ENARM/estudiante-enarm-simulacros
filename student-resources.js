// student-resources.js
// Biblioteca de Resúmenes / PDFs / GPC (usa el 2° proyecto Firebase: pagina-buena)
// Objetivo: UI moderna + filtros robustos (sin romper simulacros).
// OPT PRO: iOS-safe preview (1 iframe + throttle + hard reset) + event delegation.
// REQ: SOLO PDFs en vista previa. Resto SOLO pestaña nueva. NO descargas automáticas.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

function makePreviewUrl(url) {
  const raw = String(url || "").trim();
  const n = normalizeText(raw);

  if (!raw) return "";

  // Si ya es un viewer, lo respetamos
  if (n.includes("docs.google.com/gview?embedded=1")) return raw;
  if (n.includes("drive.google.com/file") && n.includes("/preview")) return raw;

  // Drive (file o uc): SIEMPRE usar /preview
  if (n.includes("drive.google.com")) {
    const id = extractDriveFileId(raw);
    if (id) return makeDrivePreviewViewerUrl(id);
    return "";
  }

  // PDF directo: usar gview para evitar descarga automática
  if (n.includes(".pdf") || n.includes("application/pdf")) {
    return makeGoogleGviewUrl(raw);
  }

  return "";
}

function makeOpenUrl(url) {
  const raw = String(url || "").trim();
  const n = normalizeText(raw);
  if (!raw) return "";

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
      // DETAIL VIEW: iniciar mini-examen del tema
      if (target?.closest?.("#student-resources-start-topic-exam")) {
        e.preventDefault();
        try {
          const db = await ensureResourcesDb();
          const ref = doc(db, "topic_exams", String(_selectedTopicId));
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            alert("Este tema aún no tiene mini-examen configurado.");
            return;
          }
          const data = snap.data() || {};
          const cases = Array.isArray(data.cases) ? data.cases : [];
          const topic = _allTopics.find((t) => String(t.id) === String(_selectedTopicId));
          const topicTitle = topic?.title || "Mini-examen del tema";

          window.dispatchEvent(
            new CustomEvent("student:openTopicExam", {
              detail: { topicId: String(_selectedTopicId), topicTitle, cases },
            })
          );
        } catch (err) {
          console.error(err);
          alert("No se pudo iniciar el mini-examen. Intenta de nuevo.");
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

        // Abrir en nueva pestaña: preferimos viewer (no download)
        _selectedOpenUrl = makeOpenUrl(raw);

        // Preview: SIEMPRE viewer (no download)
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

  // Si el tab se oculta, corta el iframe (reduce freezes en iOS)
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

  // ✅ Al abrir el tema: cargar preview AUTOMÁTICO del primer PDF (viewer, sin download)
  if (!_selectedOpenUrl) {
    const firstPdf = groups.pdf[0]?.url || "";
    if (firstPdf) {
      _selectedOpenUrl = makeOpenUrl(firstPdf);
      _selectedPreviewUrl = makePreviewUrl(firstPdf);
    } else {
      _selectedOpenUrl = "";
      _selectedPreviewUrl = "";
    }
  }

  // Si no hay PDF, aseguramos que no intente previsualizar nada
  if (!groups.pdf.length) {
    _selectedOpenUrl = "";
    _selectedPreviewUrl = "";
  }

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

  // Resúmenes: abrir en pestaña nueva
  const resumenLinks = newTabLinks(groups.resumen);

  // PDFs: botones de vista previa
  const previewButtons = (items) =>
    (items || [])
      .map(
        (l) => `
      <button
        class="btn btn-outline btn-sm btn-preview"
        data-preview-url="${escapeHtml(l.url)}"
        type="button"
        aria-pressed="false"
      >${escapeHtml(l.label)}</button>
    `
      )
      .join("");

  const pdfBtns = previewButtons(groups.pdf);

  // GPC/Otros: NO se previsualizan. Solo pestaña nueva.
  const gpcLinks = newTabLinks(groups.gpc);
  const otherLinks = newTabLinks(groups.otro);

  const previewBlock = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:14px;">Vista previa</div>
          <div class="panel-subtitle" id="student-resources-preview-note" style="margin-top:4px;">Vista previa (PDF)</div>
        </div>

        <a
          id="student-resources-open-newtab"
          class="btn btn-primary btn-sm hidden"
          href="#"
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
        ></iframe>
      </div>
    </div>
  `;

  // ✅ Un solo bloque "Recursos" sin textos extra / sin paréntesis.
  // Orden: PDFs (preview) -> Resúmenes -> GPC -> Otros
  const allButtons = [pdfBtns, resumenLinks, gpcLinks, otherLinks].filter(Boolean).join("");

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
      <div style="font-weight:700;font-size:14px;">Mini-examen del tema</div>
      <div class="panel-subtitle" style="margin-top:4px;">Resuelve un caso clínico con preguntas de este tema.</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="student-resources-start-topic-exam" class="btn btn-primary btn-sm" type="button">Iniciar mini-examen</button>
      </div>
    </div>

  `;

  cachePreviewDomRefs();

  // Marca inicial active (si existe) - SOLO PDFs
  if (_selectedOpenUrl && groups.pdf.length) {
    const firstRaw = groups.pdf[0]?.url || "";
    if (firstRaw) {
      const matchBtn = listEl.querySelector(`button[data-preview-url="${CSS.escape(firstRaw)}"]`);
      if (matchBtn) matchBtn.setAttribute("aria-pressed", "true");
    }
  }

  schedulePreviewUpdate();
}
