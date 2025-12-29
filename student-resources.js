// student-resources.js
// Biblioteca (Resúmenes/PDF/GPC) sin modales: abre inline en cada tarjeta.
// Incluye filtro robusto (cirugía general + medicina interna ya no fallan).

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
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
  const app = initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");
  resourcesDb = getFirestore(app);
  return resourcesDb;
}

/****************************************************
 * Estado
 ****************************************************/
let _uiInitialized = false;
let _dataLoaded = false;
let _allTopics = [];
let _openTopicId = null;

let selectedSpecialtyKey = "";
let searchQuery = "";

let viewEl, searchEl, specialtyEl, listEl, countEl, emptyEl, loadingEl;

/****************************************************
 * Normalización y mapeo (FIX filtro)
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
  if (n.includes("medicina interna") || (n.includes("medicina") && n.includes("interna"))) {
    return "medicina_interna";
  }
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

  if (l.includes("resumen") || l.includes("word") || u.includes("docs.google.com/document") || u.includes(".doc")) {
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

  Object.keys(groups).forEach((k) => groups[k].sort((a, b) => a.label.localeCompare(b.label)));
  return groups;
}

/****************************************************
 * Init UI
 ****************************************************/
export function initStudentResourcesUI() {
  if (_uiInitialized) return;
  _uiInitialized = true;

  viewEl = document.getElementById("student-resources-view");
  searchEl = document.getElementById("student-resources-search");
  specialtyEl = document.getElementById("student-resources-specialty");
  listEl = document.getElementById("student-resources-list");
  countEl = document.getElementById("student-resources-count");
  emptyEl = document.getElementById("student-resources-empty");
  loadingEl = document.getElementById("student-resources-loading");

  if (viewEl) viewEl.setAttribute("data-ui", "cards-inline");

  if (specialtyEl && !specialtyEl.dataset.bound) {
    specialtyEl.dataset.bound = "1";
    // Si ya tienes estas opciones en HTML, igual no pasa nada; esto las asegura consistentes.
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
      _openTopicId = null; // cierra cualquier expandido al filtrar
      render();
    });
  }

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", () => {
      searchQuery = String(searchEl.value || "").trim();
      _openTopicId = null;
      render();
    });
  }
}

/****************************************************
 * Activar + cargar data
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
 * Render
 ****************************************************/
function applyFilters(topics) {
  const q = normalizeText(searchQuery);
  const selected = selectedSpecialtyKey || "";

  return topics.filter((t) => {
    // “Todas” excluye acceso_gratuito (como tu lógica original)
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

function sectionHtml(titleText, items) {
  if (!items.length) return "";
  return `
    <div class="resource-expand__section">
      <div class="resource-expand__section-title">${escapeHtml(titleText)}</div>
      <div class="resource-expand__buttons">
        ${items
          .map(
            (l) => `
            <a class="resource-btn-inline" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(l.label)}
            </a>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function render() {
  if (!listEl) return;

  const filtered = applyFilters(_allTopics);

  if (countEl) {
    countEl.textContent = `${filtered.length} tema${filtered.length === 1 ? "" : "s"}`;
  }

  if (!filtered.length) {
    listEl.innerHTML = "";
    show(emptyEl);
    return;
  }

  hide(emptyEl);

  // Auto-fill: usa TODO el ancho, no se queda en 2 columnas
  listEl.classList.add("resources-grid-autofill");

  const frag = document.createDocumentFragment();

  filtered.forEach((t) => {
    const groups = buildLinkGroups(t);

    const hasResumen = groups.resumen.length > 0;
    const pdfCount = groups.pdf.length;
    const gpcCount = groups.gpc.length;
    const otherCount = groups.otro.length;

    const spLabel = specialtyLabelFromKey(t.specialtyKey);

    const badges = [];
    if (hasResumen) badges.push(`<span class="resource-badge">Resumen</span>`);
    if (pdfCount) badges.push(`<span class="resource-badge">PDF ${pdfCount}</span>`);
    if (gpcCount) badges.push(`<span class="resource-badge">GPC ${gpcCount}</span>`);
    if (otherCount) badges.push(`<span class="resource-badge resource-badge--muted">Otros ${otherCount}</span>`);

    const isOpen = _openTopicId === t.id;

    const card = document.createElement("div");
    card.className = "resource-card";
    if (isOpen) card.classList.add("resource-card--open");

    card.innerHTML = `
      <div class="resource-card__top">
        <div class="resource-card__meta">
          <div class="resource-card__specialty">${escapeHtml(spLabel)}</div>
          <div class="resource-card__title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
        </div>

        <button class="btn btn-outline btn-sm resource-card__toggle" type="button" aria-expanded="${isOpen ? "true" : "false"}">
          ${isOpen ? "Cerrar" : "Ver"}
        </button>
      </div>

      <div class="resource-card__badges">${badges.join("")}</div>

      <div class="resource-card__expand" ${isOpen ? "" : 'style="display:none;"'}>
        ${sectionHtml(groups.resumen.length > 1 ? "Resúmenes" : "Resumen", groups.resumen)}
        ${sectionHtml(groups.pdf.length > 1 ? "PDFs" : "PDF", groups.pdf)}
        ${sectionHtml("GPC", groups.gpc)}
        ${sectionHtml("Otros", groups.otro)}
      </div>
    `;

    const toggleBtn = card.querySelector(".resource-card__toggle");
    const expand = card.querySelector(".resource-card__expand");

    const toggle = () => {
      // Cierra el anterior y abre este (solo 1 abierto a la vez)
      if (_openTopicId === t.id) {
        _openTopicId = null;
      } else {
        _openTopicId = t.id;
      }
      render();
    };

    toggleBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    // Click sobre tarjeta: también toggle (excepto si se clickea un link)
    card.addEventListener("click", (e) => {
      const a = e.target?.closest?.("a");
      if (a) return; // no cierres al abrir un link
      toggle();
    });

    frag.appendChild(card);
  });

  listEl.innerHTML = "";
  listEl.appendChild(frag);
}
