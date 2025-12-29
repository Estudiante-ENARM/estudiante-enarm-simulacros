// student-resources.js
// Módulo NUEVO: UI de "Resúmenes y GPC" dentro del portal del estudiante.
// No toca nada existente. Se activa desde student.js cuando el alumno entra a la vista.

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { libraryDb } from "./library-firebase.js";

/**
 * IDs esperados en student.html:
 * - student-resources-view
 * - student-resources-search
 * - student-resources-specialty
 * - student-resources-count
 * - student-resources-list
 * - student-resources-detail
 */

const DEFAULT_SPECIALTIES = [
  "Todos",
  "Acceso gratuito limitado",
  "Cirugía general",
  "Ginecología y Obstetricia",
  "Pediatría",
  "Medicina interna",
];

let temasCache = [];
let loadedOnce = false;
let loading = false;

function stripDiacritics(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function norm(s) {
  return stripDiacritics(String(s || "").toLowerCase()).trim();
}

function safeText(s) {
  return String(s || "").replace(/[<>&"]/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "&") return "&amp;";
    return "&quot;";
  });
}

function buildLinkCard(link) {
  const label = safeText(link?.label || "Abrir");
  const url = link?.url;

  const btn = document.createElement("button");
  btn.className = "btn btn-outline btn-sm";
  btn.type = "button";
  btn.textContent = label;

  btn.addEventListener("click", () => {
    if (!url) {
      alert("Este enlace no está configurado correctamente.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  });

  const row = document.createElement("div");
  row.className = "flex-row";
  row.style.justifyContent = "space-between";
  row.style.alignItems = "center";
  row.style.gap = "10px";

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "2px";

  const t = document.createElement("div");
  t.style.fontWeight = "600";
  t.style.fontSize = "13px";
  t.textContent = link?.label || "Recurso";

  const sub = document.createElement("div");
  sub.className = "panel-subtitle";
  sub.style.fontSize = "12px";
  sub.textContent = (url || "").includes("drive.google")
    ? "Google Drive"
    : "Enlace externo";

  left.appendChild(t);
  left.appendChild(sub);

  row.appendChild(left);
  row.appendChild(btn);

  const card = document.createElement("div");
  card.className = "card";
  card.style.padding = "10px 12px";
  card.appendChild(row);

  return card;
}

function renderDetail(detailEl, tema) {
  if (!detailEl) return;

  if (!tema) {
    detailEl.innerHTML = `
      <div class="card" style="padding:12px 14px;">
        <div style="font-weight:600;margin-bottom:6px;">Selecciona un tema</div>
        <div class="panel-subtitle" style="font-size:13px;">
          Aquí verás los botones para abrir resumen/Word, PDF y GPC del tema.
        </div>
      </div>
    `;
    return;
  }

  const title = tema.title || "Tema sin título";
  const specialty = tema.specialty || "Sin especialidad";
  const links = Array.isArray(tema.links) ? tema.links : [];

  detailEl.innerHTML = "";

  const head = document.createElement("div");
  head.className = "card";
  head.style.padding = "12px 14px";
  head.style.marginBottom = "10px";

  head.innerHTML = `
    <div style="font-weight:700;font-size:16px;margin-bottom:4px;">${safeText(
      title
    )}</div>
    <div class="panel-subtitle" style="font-size:13px;">
      Especialidad: <strong>${safeText(specialty)}</strong>
    </div>
  `;

  detailEl.appendChild(head);

  if (!links.length) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.padding = "12px 14px";
    empty.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Sin recursos</div>
      <div class="panel-subtitle" style="font-size:13px;">
        Este tema no tiene enlaces cargados en Firebase.
      </div>
    `;
    detailEl.appendChild(empty);
    return;
  }

  // Render por orden (tal cual exista en DB)
  links.forEach((lk) => {
    detailEl.appendChild(buildLinkCard(lk));
  });
}

function renderList(listEl, detailEl, temas) {
  if (!listEl) return;

  listEl.innerHTML = "";

  if (!temas.length) {
    listEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        No hay temas para mostrar con los filtros actuales.
      </div>
    `;
    renderDetail(detailEl, null);
    return;
  }

  temas.forEach((tema) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.style.padding = "10px 12px";
    btn.style.cursor = "pointer";
    btn.style.display = "flex";
    btn.style.flexDirection = "column";
    btn.style.gap = "3px";

    btn.innerHTML = `
      <div style="font-weight:600;font-size:13px;">${safeText(
        tema.title || "Tema"
      )}</div>
      <div class="panel-subtitle" style="font-size:12px;">
        ${safeText(tema.specialty || "Sin especialidad")}
      </div>
    `;

    btn.addEventListener("click", () => renderDetail(detailEl, tema));
    listEl.appendChild(btn);
  });

  // Autoselección: primero de la lista
  renderDetail(detailEl, temas[0]);
}

function applyFilters({ searchValue, specialtyValue }) {
  const q = norm(searchValue);
  const sp = String(specialtyValue || "Todos");

  // Regla: en "Todos", ocultar "Acceso gratuito limitado" (igual que tu otra página)
  return temasCache.filter((t) => {
    const titleOk = !q || norm(t.title).includes(q);
    if (!titleOk) return false;

    const tSp = t.specialty || "Sin especialidad";

    if (sp === "Todos") {
      if (tSp === "Acceso gratuito limitado") return false;
      return true;
    }
    return tSp === sp;
  });
}

async function loadTemasFromLibraryDb() {
  if (loadedOnce || loading) return;
  loading = true;

  // Intento 1: orderBy("title")
  try {
    const q = query(collection(libraryDb, "temas"), orderBy("title"), limit(2000));
    const snap = await getDocs(q);
    temasCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    loadedOnce = true;
    return;
  } catch (err) {
    console.warn("No se pudo orderBy(title) en temas. Intentando sin orderBy.", err);
  }

  // Intento 2: sin orderBy
  try {
    const q2 = query(collection(libraryDb, "temas"), limit(2000));
    const snap2 = await getDocs(q2);
    temasCache = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
    temasCache.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "es", { sensitivity: "base" }));
    loadedOnce = true;
  } finally {
    loading = false;
  }
}

/**
 * Inicializa listeners internos de la vista "Biblioteca".
 * No hace switch de vistas. Eso lo hace student.js
 */
export function initStudentResourcesUI(options = {}) {
  const specialties =
    Array.isArray(options.specialties) && options.specialties.length
      ? options.specialties
      : DEFAULT_SPECIALTIES;

  const viewEl = document.getElementById("student-resources-view");
  const searchEl = document.getElementById("student-resources-search");
  const specialtyEl = document.getElementById("student-resources-specialty");
  const countEl = document.getElementById("student-resources-count");
  const listEl = document.getElementById("student-resources-list");
  const detailEl = document.getElementById("student-resources-detail");

  if (!viewEl || !searchEl || !specialtyEl || !listEl || !detailEl) {
    // Aún no existe el HTML; no hacemos nada.
    return;
  }

  if (viewEl.dataset.bound === "1") return;
  viewEl.dataset.bound = "1";

  // Poblar select de especialidad
  specialtyEl.innerHTML = specialties
    .map((s) => `<option value="${safeText(s)}">${safeText(s)}</option>`)
    .join("");

  const refresh = () => {
    const filtered = applyFilters({
      searchValue: searchEl.value,
      specialtyValue: specialtyEl.value,
    });

    if (countEl) {
      countEl.textContent = `${filtered.length} tema(s)`;
    }

    renderList(listEl, detailEl, filtered);
  };

  // Listeners
  searchEl.addEventListener("input", refresh);
  specialtyEl.addEventListener("change", refresh);

  // Estado inicial
  renderDetail(detailEl, null);
  if (countEl) countEl.textContent = "—";
}

/**
 * Llamar esto cuando el alumno ENTRE a la vista Biblioteca.
 */
export async function activateStudentResources() {
  const listEl = document.getElementById("student-resources-list");
  const detailEl = document.getElementById("student-resources-detail");
  const countEl = document.getElementById("student-resources-count");
  const searchEl = document.getElementById("student-resources-search");
  const specialtyEl = document.getElementById("student-resources-specialty");

  if (!listEl || !detailEl || !searchEl || !specialtyEl) return;

  // Loading UI
  listEl.innerHTML = `
    <div class="card" style="padding:12px 14px;">
      <div class="panel-subtitle" style="font-size:13px;">Cargando temas…</div>
    </div>
  `;
  renderDetail(detailEl, null);
  if (countEl) countEl.textContent = "Cargando…";

  try {
    await loadTemasFromLibraryDb();

    const filtered = applyFilters({
      searchValue: searchEl.value,
      specialtyValue: specialtyEl.value,
    });

    if (countEl) countEl.textContent = `${filtered.length} tema(s)`;
    renderList(listEl, detailEl, filtered);
  } catch (err) {
    console.error("Error cargando temas desde libraryDb:", err);
    listEl.innerHTML = `
      <div class="card" style="padding:12px 14px;">
        <div style="font-weight:600;margin-bottom:6px;">No se pudo cargar la biblioteca</div>
        <div class="panel-subtitle" style="font-size:13px;">
          Revisa reglas de Firestore del proyecto de resúmenes (lectura de colección <strong>temas</strong>).
        </div>
      </div>
    `;
    if (countEl) countEl.textContent = "Error";
  }
}
