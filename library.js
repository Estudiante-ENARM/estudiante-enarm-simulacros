/*************************************************************
 * library.js
 * Módulo UI + lectura Firestore (Resúmenes / GPC)
 * - NO modifica nada existente.
 * - Se monta dentro de un contenedor que tú le pases.
 *************************************************************/

import { libraryDb } from "./library-firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Especialidades esperadas en la BD de Resúmenes (pagina-buena).
 * Nota: en tu app de resúmenes existe también "Acceso gratuito limitado",
 * pero para la vista del alumno normalmente mostraremos las 4 principales.
 */
const SPECIALTIES_ORDER = [
  "Cirugía General",
  "Ginecología y Obstetricia",
  "Medicina Interna",
  "Pediatría"
];

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function normalizeText(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase();
}

function byTitleEs(a, b) {
  return (a.title || "").localeCompare((b.title || ""), "es", { sensitivity: "base" });
}

function groupTopicsBySpecialty(topics) {
  const map = new Map();
  for (const sp of SPECIALTIES_ORDER) map.set(sp, []);

  for (const t of topics) {
    const sp = t.specialty || "";
    if (!map.has(sp)) continue; // ignoramos otras categorías (ej. Acceso gratuito limitado)
    map.get(sp).push(t);
  }

  for (const sp of SPECIALTIES_ORDER) {
    map.get(sp).sort(byTitleEs);
  }
  return map;
}

function filterTopics(topics, q) {
  const queryTxt = normalizeText(q);
  if (!queryTxt) return topics;

  return topics.filter(t => {
    const title = normalizeText(t.title);
    const sp = normalizeText(t.specialty);
    return title.includes(queryTxt) || sp.includes(queryTxt);
  });
}

function createEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

/**
 * Monta la vista de Resúmenes/GPC para el estudiante dentro de un contenedor.
 * @param {object} opts
 * @param {HTMLElement} opts.container Contenedor donde se construye TODO
 * @param {string} [opts.title] Título del panel
 * @returns {object} { destroy() }
 */
export function mountLibraryStudentView(opts) {
  const container = opts?.container;
  if (!container) throw new Error("mountLibraryStudentView requiere opts.container");

  const title = opts?.title || "Resúmenes - GPCs";

  // Estado
  let allTopics = [];
  let searchQuery = "";
  const collapsed = new Set(); // specialties colapsadas
  let unsubscribe = null;

  // Limpia contenedor y arma esqueleto
  container.innerHTML = "";

  const header = createEl("div", "panel-header");
  header.innerHTML = `
    <div>
      <h2 class="panel-title">${escapeHtml(title)}</h2>
      <p class="panel-subtitle">Busca un tema y abre sus recursos (Word, PDF, GPC) en Drive.</p>
    </div>
  `;

  // Buscador (estilo similar a tu UI: card + field)
  const searchCard = createEl("div", "card");
  searchCard.innerHTML = `
    <label class="field" style="margin-bottom:0;">
      <span>Buscador universal</span>
      <input id="library-search-input" type="text" placeholder="Ej. apendicitis, preeclampsia, EPOC..." />
    </label>
  `;

  const sectionsWrap = createEl("div", "cards-list");
  sectionsWrap.id = "library-sections-wrap";

  const statusCard = createEl("div", "card");
  statusCard.id = "library-status";
  statusCard.innerHTML = `<div class="panel-subtitle">Cargando temas...</div>`;

  container.appendChild(header);
  container.appendChild(searchCard);
  container.appendChild(statusCard);
  container.appendChild(sectionsWrap);

  const searchInput = searchCard.querySelector("#library-search-input");
  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value || "";
    render();
  });

  function render() {
    // Filtrado global
    const visible = filterTopics(allTopics, searchQuery);

    // Update status
    const total = allTopics.length;
    const shown = visible.length;
    statusCard.innerHTML = `
      <div class="panel-subtitle">
        Mostrando <strong>${shown}</strong> de <strong>${total}</strong> temas.
      </div>
    `;

    // Agrupar por especialidad
    const grouped = groupTopicsBySpecialty(visible);

    sectionsWrap.innerHTML = "";

    for (const sp of SPECIALTIES_ORDER) {
      const list = grouped.get(sp) || [];
      const count = list.length;

      const sectionCard = createEl("div", "card");
      sectionCard.style.padding = "14px 16px";

      // Header colapsable
      const isCollapsed = collapsed.has(sp);
      const btn = createEl(
        "button",
        "btn btn-outline",
        `
          <span style="font-weight:600;">${escapeHtml(sp)}</span>
          <span class="panel-subtitle" style="margin-left:8px;">(${count})</span>
          <span style="margin-left:auto;font-weight:700;">${isCollapsed ? "+" : "–"}</span>
        `
      );
      btn.style.width = "100%";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "flex-start";
      btn.style.gap = "8px";

      btn.addEventListener("click", () => {
        if (collapsed.has(sp)) collapsed.delete(sp);
        else collapsed.add(sp);
        render();
      });

      sectionCard.appendChild(btn);

      // Body
      const body = createEl("div", "");
      body.style.marginTop = "12px";
      body.style.display = isCollapsed ? "none" : "block";

      if (count === 0) {
        body.innerHTML = `<div class="panel-subtitle">Sin temas para mostrar.</div>`;
      } else {
        for (const t of list) {
          const topicCard = createEl("div", "card");
          topicCard.style.marginTop = "10px";
          topicCard.style.padding = "12px 14px";

          const linksHtml = Array.isArray(t.links)
            ? t.links
                .filter(l => l && l.url)
                .map(l => {
                  const label = escapeHtml(l.label || "Abrir");
                  const url = escapeHtml(l.url);
                  return `
                    <a class="btn btn-outline btn-sm" href="${url}" target="_blank" rel="noopener noreferrer">
                      ${label}
                    </a>
                  `;
                })
                .join("")
            : "";

          topicCard.innerHTML = `
            <div class="panel-subtitle" style="margin-bottom:6px;">${escapeHtml(t.specialty || "")}</div>
            <div style="font-weight:600;margin-bottom:10px;">${escapeHtml(t.title || "")}</div>
            <div class="flex-row">${linksHtml || `<span class="panel-subtitle">Sin links</span>`}</div>
          `;

          body.appendChild(topicCard);
        }
      }

      sectionCard.appendChild(body);
      sectionsWrap.appendChild(sectionCard);
    }
  }

  function startRealtime() {
    const temasRef = collection(libraryDb, "temas");
    const q = query(temasRef, orderBy("title"));

    unsubscribe = onSnapshot(
      q,
      (snap) => {
        allTopics = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        // Orden defensivo
        allTopics.sort(byTitleEs);

        render();
      },
      (err) => {
        console.error("library temas onSnapshot error:", err);
        statusCard.innerHTML = `
          <div class="panel-subtitle" style="color:var(--chip-danger);">
            Error cargando temas. Revisa consola y reglas de Firestore.
          </div>
        `;
      }
    );
  }

  startRealtime();

  return {
    destroy() {
      try { unsubscribe && unsubscribe(); } catch (_) {}
      unsubscribe = null;
      container.innerHTML = "";
    }
  };
}
