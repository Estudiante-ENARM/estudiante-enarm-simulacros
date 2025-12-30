// student-resources.js
// Biblioteca de Resúmenes / PDFs / GPC (usa el 2° proyecto Firebase: pagina-buena)
// Objetivo: UI moderna + filtros robustos (sin romper simulacros).

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
  appId: "1:1031211281182:web:c1e26006b68b189acc4efd"
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

// navegación (sin modal)
let _selectedTopicId = null;

// guardamos link real y link de preview por separado
let _selectedPreviewUrl = "";
let _selectedOpenUrl = "";

// progreso (localStorage por usuario)
let _currentUserKey = "anon";

let viewEl, searchEl, specialtyEl, listEl, detailEl, countEl, emptyEl, loadingEl;

let modalRoot = null; // se conserva (no se elimina), pero ya no lo usamos para abrir temas

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
    case "medicina_interna": return "Medicina interna";
    case "cirugia_general": return "Cirugía general";
    case "pediatria": return "Pediatría";
    case "gine_obstetricia": return "Ginecología y Obstetricia";
    case "acceso_gratuito": return "Acceso gratuito limitado";
    default: return "Otros";
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

function isDocxUrl(url) {
  const u = String(url || "").toLowerCase();
  return u.includes(".docx") || u.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

function guessLinkType(label, url) {
  const l = normalizeText(label);
  const u = normalizeText(url);

  // Resumen/Word/Docs
  if (l.includes("resumen") || l.includes("word") || u.includes(".docx") || u.includes(".doc") || u.includes("docs.google.com/document")) {
    return "resumen";
  }
  if (l.includes("gpc") || l.includes("guia") || l.includes("practica clinica")) {
    return "gpc";
  }
  if (l.includes("pdf") || u.includes(".pdf") || u.includes("application/pdf")) {
    return "pdf";
  }
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
 * Preview helpers (PDF/GPC/Word inline)
 ****************************************************/
function extractDriveFileId(url) {
  const u = String(url || "");
  const m1 = u.match(/\/file\/d\/([^/]+)/i);
  if (m1 && m1[1]) return m1[1];

  const m2 = u.match(/[?&]id=([^&]+)/i);
  if (m2 && m2[1]) return m2[1];

  return "";
}

function looksLikePdf(url) {
  const u = normalizeText(url);
  return u.includes(".pdf") || u.includes("applicationøpdf") || u.includes("application/pdf") || u.includes("drive.google.com/file");
}

/**
 * Office Viewer:
 * Solo funciona si `src` es accesible públicamente (sin login).
 */
function makeOfficeEmbedUrl(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(s)}`;
}

/**
 * Drive "direct download" (OJO: si es privado, pedirá login y NO servirá para office viewer)
 */
function makeDriveDirectDownloadUrl(driveUrl) {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) return "";
  // Descarga directa. Si el archivo NO es público, requerirá sesión y no funcionará para Office Viewer.
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

function makePreviewUrl(url) {
  const u = String(url || "");
  const n = normalizeText(u);

  // 1) DOCX -> intentar Office Viewer
  //    - Si es Drive, intentamos convertirlo a "uc?export=download&id=..."
  //      (solo funcionará si el archivo es accesible sin login).
  if (isDocxUrl(u)) {
    if (n.includes("drive.google.com")) {
      const direct = makeDriveDirectDownloadUrl(u);
      return direct ? makeOfficeEmbedUrl(direct) : "";
    }
    // Si ya es una URL pública (Firebase Storage con token, CDN, etc.)
    return makeOfficeEmbedUrl(u);
  }

  // 2) Google Drive file -> /preview (útil para PDF, pero puede bloquearse por CSP/cookies)
  if (n.includes("drive.google.com")) {
    const fileId = extractDriveFileId(u);
    if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;

    if (n.includes("docs.google.com/document/d/")) {
      return u.replace(/\/edit(\?.*)?$/i, "/preview").replace(/\/view(\?.*)?$/i, "/preview");
    }
    if (n.includes("docs.google.com/presentation/d/")) {
      return u.replace(/\/edit(\?.*)?$/i, "/preview").replace(/\/view(\?.*)?$/i, "/preview");
    }
    if (n.includes("docs.google.com/spreadsheets/d/")) {
      return u.replace(/\/edit(\?.*)?$/i, "/preview").replace(/\/view(\?.*)?$/i, "/preview");
    }
  }

  // 3) PDF directo
  if (n.endsWith(".pdf") || n.includes(".pdf?")) return u;

  return "";
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
  if (detailEl) detailEl.innerHTML = "";

  // Ocultar columna derecha (si existe) y usar todo el ancho para lista en modo "lista"
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
      render();
    });
  }

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", () => {
      searchQuery = String(searchEl.value || "").trim();
      _selectedTopicId = null;
      _selectedPreviewUrl = "";
      _selectedOpenUrl = "";
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
  return _allTopics.find(t => String(t.id) === String(_selectedTopicId)) || null;
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
    card.className = `resource-card ${completed ? "resource-card--completed" : ""}`;
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

    card.querySelector(".resource-card__open")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      _selectedTopicId = t.id;
      _selectedPreviewUrl = "";
      _selectedOpenUrl = "";
      render();
    });

    card.addEventListener("click", () => {
      _selectedTopicId = t.id;
      _selectedPreviewUrl = "";
      _selectedOpenUrl = "";
      render();
    });

    frag.appendChild(card);
  });

  listEl.innerHTML = "";
  listEl.appendChild(frag);
}

function renderTopicDetail(topic) {
  const spLabel = specialtyLabelFromKey(topic.specialtyKey);
  const groups = buildLinkGroups(topic);

  // Preferencia inicial: primer PDF/GPC si existe, si no, primer Resumen
  if (!_selectedOpenUrl) {
    const firstPdf = (groups.pdf[0]?.url) || "";
    const firstGpc = (groups.gpc[0]?.url) || "";
    const firstResumen = (groups.resumen[0]?.url) || "";
    const candidateRaw = firstPdf || firstGpc || firstResumen || "";
    _selectedOpenUrl = candidateRaw || "";
    _selectedPreviewUrl = makePreviewUrl(candidateRaw) || "";
  }

  const completed = isTopicCompleted(topic.id);

  const buildUnifiedPanel = () => {
    const sectionHtml = (label, inner) => {
      if (!inner) return "";
      return `
        <div class="resource-unified-group">
          <div class="resource-unified-group__label">${escapeHtml(label)}</div>
          <div class="resource-unified-group__buttons">${inner}</div>
        </div>
      `;
    };

    // AHORA: Resúmenes también van a preview (para DOCX)
    const previewButtons = (items) => (items || []).map((l) => `
      <button
        class="btn btn-outline btn-sm"
        data-preview-url="${escapeHtml(l.url)}"
        type="button"
      >${escapeHtml(l.label)}</button>
    `).join("");

    const resumenBtns = previewButtons(groups.resumen);
    const pdfBtns = previewButtons(groups.pdf);
    const gpcBtns = previewButtons(groups.gpc);
    const otherBtns = previewButtons(groups.otro);

    return `
      <div class="card resource-unified-card" style="margin-top:12px;">
        <div class="resource-unified-card__header">
          <div class="resource-unified-card__title">Recursos</div>
          <div class="panel-subtitle" style="margin-top:4px;">
            Todo en un solo panel: Resúmenes (Word), PDFs, GPC y Otros.
          </div>
        </div>
        <div class="resource-unified-card__body">
          ${sectionHtml("Resúmenes", resumenBtns)}
          ${sectionHtml("PDFs", pdfBtns)}
          ${sectionHtml("GPC", gpcBtns)}
          ${sectionHtml("Otros", otherBtns)}
        </div>
      </div>
    `;
  };

  const previewBlock = (() => {
    if (!_selectedPreviewUrl) {
      return `
        <div class="card" style="margin-top:12px;">
          <div style="font-weight:700;font-size:14px;">Vista previa</div>
          <div class="panel-subtitle" style="margin-top:6px;">
            Este recurso no se puede previsualizar aquí (Drive privado / bloqueo de terceros). Ábrelo en una pestaña nueva.
          </div>
          ${_selectedOpenUrl ? `
            <div style="margin-top:10px;">
              <a class="btn btn-primary btn-sm" href="${escapeHtml(_selectedOpenUrl)}" target="_blank" rel="noopener noreferrer">
                Abrir en pestaña nueva
              </a>
            </div>
          ` : ``}
        </div>
      `;
    }

    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:14px;">Vista previa</div>
            <div class="panel-subtitle" style="margin-top:4px;">
              Si no carga, abre en una pestaña nueva.
            </div>
          </div>
          ${_selectedOpenUrl ? `
            <a class="btn btn-primary btn-sm" href="${escapeHtml(_selectedOpenUrl)}" target="_blank" rel="noopener noreferrer">
              Abrir en pestaña nueva
            </a>
          ` : ``}
        </div>
        <div style="margin-top:12px; width:100%; height:70vh; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
          <iframe
            title="Vista previa"
            src="${escapeHtml(_selectedPreviewUrl)}"
            style="width:100%;height:100%;border:0;"
            loading="lazy"
          ></iframe>
        </div>
      </div>
    `;
  })();

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

    ${buildUnifiedPanel()}
    ${previewBlock}
  `;

  // volver
  listEl.querySelector("#student-resources-back")?.addEventListener("click", () => {
    _selectedTopicId = null;
    _selectedPreviewUrl = "";
    _selectedOpenUrl = "";
    render();
  });

  // completado
  listEl.querySelector("#student-resources-complete")?.addEventListener("click", () => {
    toggleTopicCompleted(topic.id);
    render();
  });

  // preview buttons (incluye Resúmenes/Word)
  listEl.querySelectorAll("button[data-preview-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.getAttribute("data-preview-url") || "";

      _selectedOpenUrl = raw;

      const preview = makePreviewUrl(raw);

      if (preview) {
        _selectedPreviewUrl = preview;
      } else if (looksLikePdf(raw)) {
        _selectedPreviewUrl = raw;
      } else {
        _selectedPreviewUrl = "";
      }

      render();
    });
  });
}
