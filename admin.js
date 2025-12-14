/****************************************************
 * ADMIN.JS - Panel de Administrador
 * Plataforma Estudiante ENARM
 * - Gestión de secciones
 * - Gestión de exámenes y casos clínicos
 * - Gestión de usuarios
 * - Configuración de pantalla principal
 * - Analytics básicos
 *
 * ✅ CORRECCIONES APLICADAS (SIN ELIMINAR FUNCIONES):
 * 1) ✅ FIX CRÍTICO: Buscadores de banco (EXÁMENES y MINI)
 *    - Antes: cache fijo de 600 docs → con 700+ casos, muchos no estaban cargados → “sin resultados”
 *    - Ahora: cache paginado incremental (carga por páginas) + auto-carga extra si no encuentra resultados
 * 2) ✅ FIX CRÍTICO: Mensajes de UI + resets del cache cuando cambian datos (usageCount / ediciones)
 * 3) (Se conserva TODO lo demás del archivo tal cual)
 ****************************************************/

// Firebase inicializado en firebase-config.js
import { auth, db } from "./firebase-config.js";

import {
  SPECIALTIES,
  SUBTYPES,
  DIFFICULTIES,
  DIFFICULTY_WEIGHTS,
  DEFAULT_EXAM_RULES,
} from "./shared-constants.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  startAfter,
  increment,
  documentId, // ✅ NUEVO: paginación robusta cuando no se puede orderBy(createdAt)
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/****************************************************
 * REFERENCIAS DOM
 ****************************************************/

// Header
const adminUserEmailSpan = document.getElementById("admin-user-email");
const btnLogout = document.getElementById("admin-btn-logout");
const btnToggleSidebar = document.getElementById("admin-btn-toggle-sidebar");

// Sidebar
const sidebar = document.getElementById("admin-sidebar");
const sectionsList = document.getElementById("admin-sections-list");
const btnAddSection = document.getElementById("admin-btn-add-section");
const btnNavExams = document.getElementById("admin-btn-nav-exams");
const btnNavBank = document.getElementById("admin-btn-nav-bank");
const btnNavMini = document.getElementById("admin-btn-nav-mini");
const btnNavUsers = document.getElementById("admin-btn-nav-users");
const btnNavAnalytics = document.getElementById("admin-btn-nav-analytics");
const btnNavLanding = document.getElementById("admin-btn-nav-landing");
const adminSocialIcons = document.querySelectorAll(".admin-social-icon");

// Paneles principales
const panelExams = document.getElementById("admin-panel-exams");
const panelBank = document.getElementById("admin-panel-bank");
const panelMini = document.getElementById("admin-panel-mini");
const panelUsers = document.getElementById("admin-panel-users");
const panelAnalytics = document.getElementById("admin-panel-analytics");
const panelLanding = document.getElementById("admin-panel-landing");

// ==================== PANEL EXÁMENES ====================
const currentSectionTitle = document.getElementById("admin-current-section-title");
const examsListEl = document.getElementById("admin-exams-list");
const btnAddExam = document.getElementById("admin-btn-add-exam");
const btnImportExamsJson = document.getElementById("admin-btn-import-exams-json");

// Vista detalle examen
const examDetailView = document.getElementById("admin-exam-detail");
const btnBackToExams = document.getElementById("admin-btn-back-to-exams");
const examTitleInput = document.getElementById("admin-exam-title-input");
const examCasesContainer = document.getElementById("admin-exam-cases");
const btnSaveExamAll = document.getElementById("admin-btn-save-exam");
const btnAddCaseTop = document.getElementById("admin-btn-add-case");
const btnImportExamJson = document.getElementById("admin-btn-import-exam");

// ==================== BUSCADOR "Agregar casos desde banco" EN DETALLE DE EXAMEN ====================
const bankSearchInput = document.getElementById("admin-bank-search-input");
const bankSearchResults = document.getElementById("admin-bank-search-results");

// ==================== BUSCADOR "Agregar casos desde banco" EN MINI EXÁMENES ====================
const miniBankSearchInput = document.getElementById("admin-mini-bank-search-input");
const miniBankSearchResults = document.getElementById("admin-mini-bank-search-results");

// ==================== PANEL USUARIOS ====================
const newUserNameInput = document.getElementById("admin-new-user-name");
const newUserEmailInput = document.getElementById("admin-new-user-email");
const newUserPasswordInput = document.getElementById("admin-new-user-password");
const newUserRoleSelect = document.getElementById("admin-new-user-role");
const newUserStatusSelect = document.getElementById("admin-new-user-status");
const newUserExpiryInput = document.getElementById("admin-new-user-expiry");
const btnCreateUser = document.getElementById("admin-btn-create-user");
const usersTableContainer = document.getElementById("admin-users-table");

// ==================== PANEL LANDING / SETTINGS ====================
const landingTextArea = document.getElementById("admin-landing-text");
const monthlyLabelInput = document.getElementById("admin-monthly-label");
const monthlyPriceInput = document.getElementById("admin-monthly-price");
const enarmLabelInput = document.getElementById("admin-enarm-label");
const enarmPriceInput = document.getElementById("admin-enarm-price");
const whatsappPhoneInput = document.getElementById("admin-whatsapp-phone");
const btnSaveLanding = document.getElementById("admin-btn-save-landing");

// Social links en panel landing
const landingInstagramInput = document.getElementById("admin-instagram-link");
const landingWhatsappLinkInput = document.getElementById("admin-whatsapp-link");
const landingTiktokInput = document.getElementById("admin-tiktok-link");
const landingTelegramInput = document.getElementById("admin-telegram-link");

// ==================== PANEL ANALYTICS ====================
const analyticsSummaryBox = document.getElementById("admin-analytics-summary");
const analyticsUsersBox = document.getElementById("admin-analytics-users");

// Modal genérico (reutilizable) -> SE CONSERVA, pero banco ya no lo usa
const modalOverlay = document.getElementById("admin-modal-overlay");
const modalBox = document.getElementById("admin-modal");
const modalTitle = document.getElementById("admin-modal-title");
const modalBody = document.getElementById("admin-modal-body");
const modalBtnCancel = document.getElementById("admin-modal-cancel");
const modalBtnOk = document.getElementById("admin-modal-ok");

let modalOkHandler = null;

/****************************************************
 * TOGGLE BARRA LATERAL (HAMBURGUESA)
 ****************************************************/
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

/****************************************************
 * LOGOUT ADMIN
 ****************************************************/
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Error al cerrar sesión (admin):", error);
      alert("No se pudo cerrar sesión. Intenta nuevamente.");
    }
  });
}

/****************************************************
 * ESTADO EN MEMORIA
 ****************************************************/

let currentAdminUser = null;       // Auth user
let currentSectionId = null;       // Sección seleccionada
let currentExamId = null;          // Examen abierto
let currentExamCases = [];         // Casos clínicos en memoria

// Token para evitar “superposición” de exámenes entre secciones
let examsLoadToken = 0;

// MINI EXÁMENES
let miniCases = [];
let miniCasesLoadedOnce = false;

// Cache banco para buscadores (EXAM / MINI)
let bankCasesCache = [];
let bankCasesLoadedOnce = false;

// ✅ NUEVO: paginación incremental del cache (para 700+ y futuro)
let bankCasesLoading = false;
let bankCasesLoadedAll = false;
let bankCasesLastDoc = null;

// Ajustes (puedes subirlos si tendrás decenas de miles, pero ojo RAM)
const BANK_CACHE_PAGE_SIZE = 500;   // carga por “página”
const BANK_CACHE_MAX_DOCS = 12000;  // tope de seguridad para no reventar memoria

let bankSearchDebounceTimer = null;
let miniBankSearchDebounceTimer = null;

/****************************************************
 * UTILIDADES UI
 ****************************************************/

function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function setActivePanel(panelId) {
  const panels = [panelExams, panelBank, panelMini, panelUsers, panelAnalytics, panelLanding];
  panels.forEach((p) => hide(p));

  if (panelId === "exams") show(panelExams);
  if (panelId === "bank") show(panelBank);
  if (panelId === "mini") show(panelMini);
  if (panelId === "users") show(panelUsers);
  if (panelId === "analytics") show(panelAnalytics);
  if (panelId === "landing") show(panelLanding);
}

function setLoadingButton(btn, isLoading, textDefault = "Guardar") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || textDefault;
    btn.disabled = false;
  }
}

function renderEmptyMessage(container, text) {
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

/**
 * Abre un input file y devuelve el JSON parseado al callback.
 */
function openJsonFilePicker(onLoaded) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (typeof onLoaded === "function") {
          onLoaded(json);
        }
      } catch (err) {
        console.error("JSON inválido:", err);
        alert("El archivo no contiene un JSON válido.");
      }
    };

    reader.onerror = () => {
      console.error("Error leyendo el archivo JSON.");
      alert("No se pudo leer el archivo JSON.");
    };

    reader.readAsText(file);
  });

  input.click();
}

/****************************************************
 * MODAL GENÉRICO (SE CONSERVA PARA SECCIONES/USUARIOS/ETC)
 ****************************************************/

function openModal({ title, bodyHtml, onOk }) {
  if (!modalOverlay || !modalBox) return;
  modalTitle.textContent = title || "";
  modalBody.innerHTML = bodyHtml || "";
  modalOkHandler = onOk || null;
  show(modalOverlay);
}

function closeModal() {
  if (!modalOverlay) return;
  modalBody.innerHTML = "";
  modalOkHandler = null;
  hide(modalOverlay);
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

if (modalBtnCancel) {
  modalBtnCancel.addEventListener("click", () => {
    closeModal();
  });
}

if (modalBtnOk) {
  modalBtnOk.addEventListener("click", async () => {
    if (typeof modalOkHandler === "function") {
      await modalOkHandler();
    }
  });
}

/****************************************************
 * HELPERS: normalización y labels
 ****************************************************/

function normalizeText(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpecialtyLabel(key) {
  if (!key) return "";
  return SPECIALTIES && SPECIALTIES[key] ? SPECIALTIES[key] : key;
}

// ✅ util: identifica si un doc de questions es "banco" (no es caso dentro de un examen)
function isBankCaseDoc(data) {
  const ex = (data?.examId || "").toString().trim();
  return !ex; // banco = sin examId
}

/****************************************************
 * ✅ NUEVO: reset centralizado del cache del banco (para evitar estados raros)
 ****************************************************/
function resetBankCasesCache() {
  bankCasesCache = [];
  bankCasesLoadedOnce = false;
  bankCasesLoading = false;
  bankCasesLoadedAll = false;
  bankCasesLastDoc = null;
}

/****************************************************
 * ✅ BLOQUEO DUPLICADOS: sets por bankCaseId
 ****************************************************/

function getCurrentExamBankCaseIdsSet() {
  const set = new Set();
  (currentExamCases || []).forEach((c) => {
    if (c && c.bankCaseId) set.add(c.bankCaseId);
  });
  return set;
}

function getMiniBankCaseIdsSet() {
  const set = new Set();
  (miniCases || []).forEach((c) => {
    if (c && c.bankCaseId) set.add(c.bankCaseId);
  });
  return set;
}

/****************************************************
 * ✅ usageCount robusto: delta helpers
 ****************************************************/

function countIds(arr) {
  const m = new Map();
  (arr || []).forEach((id) => {
    if (!id) return;
    m.set(id, (m.get(id) || 0) + 1);
  });
  return m;
}

async function applyUsageDelta(prevIds, newIds) {
  const prevMap = countIds(prevIds);
  const newMap = countIds(newIds);

  const allIds = new Set([...prevMap.keys(), ...newMap.keys()]);
  const updates = [];

  allIds.forEach((id) => {
    const delta = (newMap.get(id) || 0) - (prevMap.get(id) || 0);
    if (delta !== 0) {
      updates.push(
        updateDoc(doc(db, "questions", id), {
          usageCount: increment(delta),
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn("No se pudo ajustar usageCount:", id, e))
      );
    }
  });

  if (updates.length) {
    await Promise.all(updates);
  }

  // ✅ importante: reset de cache para que búsquedas y “Usado: X” se refresquen
  resetBankCasesCache();
}

/****************************************************
 * BUSCADOR DE BANCO PARA AGREGAR CASOS A EXAMEN Y MINI
 * ✅ usa "questions" (solo casos banco: sin examId)
 *
 * ✅ FIX: cache paginado incremental (no se queda en 600)
 ****************************************************/

/**
 * Convierte docs -> cache con campos normalizados para búsqueda local rápida.
 */
function mapDocToBankCacheItem(d) {
  const data = d.data() || {};
  if (!isBankCaseDoc(data)) return null;

  const questionsArr = Array.isArray(data.questions) ? data.questions : [];
  const topicTxt = (data.topic || "").toString();
  const usageCount = typeof data.usageCount === "number" ? data.usageCount : 0;

  return {
    id: d.id,
    caseText: data.caseText || "",
    specialty: data.specialty || "",
    topic: topicTxt,
    usageCount,
    questions: questionsArr,
    _normCase: normalizeText(data.caseText || ""),
    _normTopic: normalizeText(topicTxt),
    _normSpec: normalizeText(data.specialty || ""),
    _normQs: normalizeText(questionsArr.map((q) => q.questionText || "").join(" ")),
  };
}

/**
 * Carga UNA página adicional del banco (incremental).
 * - Intenta orderBy(createdAt) para “reciente primero”
 * - Si falla (por docs sin createdAt / índices), cae a orderBy(documentId()) para poder paginar sí o sí.
 */
async function loadNextBankCasesPage() {
  if (bankCasesLoading || bankCasesLoadedAll) return;

  if (!bankSearchResults && !miniBankSearchResults) return;

  // tope de seguridad
  if (bankCasesCache.length >= BANK_CACHE_MAX_DOCS) {
    bankCasesLoadedAll = true;
    bankCasesLoadedOnce = true;
    return;
  }

  bankCasesLoading = true;

  try {
    let qBase;

    // 1) preferente: createdAt desc
    try {
      qBase = query(
        collection(db, "questions"),
        orderBy("createdAt", "desc"),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        limit(BANK_CACHE_PAGE_SIZE)
      );
    } catch (e) {
      qBase = null;
    }

    // 2) fallback: documentId asc (paginable siempre)
    if (!qBase) {
      qBase = query(
        collection(db, "questions"),
        orderBy(documentId(), "asc"),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        limit(BANK_CACHE_PAGE_SIZE)
      );
    }

    const snap = await getDocs(qBase);

    if (snap.empty) {
      bankCasesLoadedAll = true;
      bankCasesLoadedOnce = true;
      return;
    }

    bankCasesLastDoc = snap.docs[snap.docs.length - 1];

    const items = snap.docs
      .map(mapDocToBankCacheItem)
      .filter(Boolean);

    // evitar duplicados por si cambia el orderBy fallback
    const existingIds = new Set(bankCasesCache.map((x) => x.id));
    for (const it of items) {
      if (!existingIds.has(it.id)) bankCasesCache.push(it);
    }

    bankCasesLoadedOnce = true;

    // si vino menos que la página, probablemente ya no hay más
    if (snap.size < BANK_CACHE_PAGE_SIZE) {
      bankCasesLoadedAll = true;
    }

    // si ya alcanzamos el tope
    if (bankCasesCache.length >= BANK_CACHE_MAX_DOCS) {
      bankCasesLoadedAll = true;
    }
  } catch (err) {
    console.error("Error cargando banco (questions) por páginas:", err);
    // no marcamos loadedAll, pero sí “cargado una vez” para que UI no se quede en loop
    bankCasesLoadedOnce = true;
  } finally {
    bankCasesLoading = false;
  }
}

async function loadBankCasesIfNeeded() {
  if (bankCasesLoadedOnce && bankCasesCache.length) return;

  const target = bankSearchResults || miniBankSearchResults;
  if (target) {
    target.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        Cargando banco de casos…
      </div>
    `;
  }

  await loadNextBankCasesPage();

  // mensaje inicial
  const msg =
    bankCasesCache.length
      ? `Banco listo. Escribe para buscar (${bankCasesCache.length}${bankCasesLoadedAll ? "" : "+"} casos cargados).`
      : "No hay casos en el banco (questions sin examId).";

  if (bankSearchResults) renderEmptyMessage(bankSearchResults, msg);
  if (miniBankSearchResults) renderEmptyMessage(miniBankSearchResults, msg);
}

/**
 * Si el usuario busca y no se encuentra nada, auto-cargamos más páginas hasta:
 * - encontrar algo, o
 * - llegar al final, o
 * - llegar al tope de seguridad.
 */
async function ensureBankCasesForQuery(rawQuery) {
  const q = normalizeText(rawQuery);
  if (!q) return;

  // al menos una carga
  if (!bankCasesLoadedOnce) {
    await loadBankCasesIfNeeded();
  }

  // si ya hay resultados con lo actual, no cargues más
  const initial = searchBankCases(rawQuery);
  if (initial.length) return;

  // si no hay resultados, y no está “todo”, carga páginas extra (máx 12 iteraciones)
  let guard = 0;
  while (!bankCasesLoadedAll && bankCasesCache.length < BANK_CACHE_MAX_DOCS && guard < 12) {
    guard++;
    await loadNextBankCasesPage();
    const res = searchBankCases(rawQuery);
    if (res.length) return;
    if (bankCasesLoading) break;
  }
}

function searchBankCases(rawQuery) {
  const q = normalizeText(rawQuery);
  if (!q) return [];

  const tokens = q.split(" ").filter((t) => t.length >= 2);
  if (!tokens.length) return [];

  const results = [];
  for (const c of bankCasesCache) {
    const haystack = `${c._normTopic} ${c._normSpec} ${c._normCase} ${c._normQs}`;
    const ok = tokens.every((t) => haystack.includes(t));
    if (ok) results.push(c);
    if (results.length >= 25) break;
  }
  return results;
}

function renderBankSearchResults(results, queryText) {
  if (!bankSearchResults) return;

  if (!queryText) {
    renderEmptyMessage(
      bankSearchResults,
      bankCasesLoadedOnce
        ? `Banco listo. Escribe un tema arriba para buscar (${bankCasesCache.length}${bankCasesLoadedAll ? "" : "+"} casos cargados).`
        : "Escribe un tema para buscar."
    );
    return;
  }

  if (!results.length) {
    renderEmptyMessage(
      bankSearchResults,
      bankCasesLoadedAll
        ? `Sin resultados para "${queryText}".`
        : `Sin resultados para "${queryText}" en los casos cargados. Intentando cargar más…`
    );
    return;
  }

  const usedSet = getCurrentExamBankCaseIdsSet();

  const html = results
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
      const snippet = (c.caseText || "").slice(0, 220);
      const topicTxt = (c.topic || "").toString();
      const usage = typeof c.usageCount === "number" ? c.usageCount : 0;

      const isUsed = usedSet.has(c.id);

      return `
        <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">
                ${topicTxt ? topicTxt : (specLabel ? specLabel : "Caso del banco")}
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${specLabel ? specLabel : "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"} · Usado: ${usage}
              </div>
            </div>
            <button class="btn btn-sm btn-primary admin-bank-add-case" data-id="${c.id}" ${isUsed ? "disabled" : ""}>
              ${isUsed ? "Ya está en este examen" : "Agregar a este examen"}
            </button>
          </div>
          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .join("");

  bankSearchResults.innerHTML = html;

  bankSearchResults
    .querySelectorAll(".admin-bank-add-case")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const found = bankCasesCache.find((x) => x.id === id);
        if (!found) return;

        if (!currentExamId) {
          alert("Primero abre un examen.");
          return;
        }

        syncCurrentExamCasesFromDOM();
        const usedNow = getCurrentExamBankCaseIdsSet();
        if (usedNow.has(id)) {
          alert("Ese caso ya está agregado en este examen. No se puede repetir.");
          return;
        }

        const cloned = {
          bankCaseId: found.id, // ✅ persistente
          caseText: found.caseText || "",
          specialty: found.specialty || "",
          topic: (found.topic || "").toString(),
          questions: Array.isArray(found.questions)
            ? found.questions.map((q) => ({
                questionText: q.questionText || "",
                optionA: q.optionA || "",
                optionB: q.optionB || "",
                optionC: q.optionC || "",
                optionD: q.optionD || "",
                correctOption: q.correctOption || "",
                justification: q.justification || "",
                subtype: q.subtype || "salud_publica",
                difficulty: q.difficulty || "media",
              }))
            : [createEmptyQuestion()],
        };

        currentExamCases.push(cloned);
        renderExamCases();

        btn.textContent = "Agregado";
        btn.disabled = true;
      });
    });
}

function initBankSearchUI() {
  if (!bankSearchInput || !bankSearchResults) return;
  if (bankSearchInput.dataset.bound === "1") return;
  bankSearchInput.dataset.bound = "1";

  bankSearchInput.addEventListener("input", () => {
    if (bankSearchDebounceTimer) clearTimeout(bankSearchDebounceTimer);

    bankSearchDebounceTimer = setTimeout(async () => {
      const raw = bankSearchInput.value || "";

      if (!raw.trim()) {
        renderBankSearchResults([], "");
        return;
      }

      // ✅ NUEVO: asegura que el cache cargue lo suficiente para ese query
      await ensureBankCasesForQuery(raw);

      const res = searchBankCases(raw);
      renderBankSearchResults(res, raw.trim());

      // si todavía no hay resultados y aún no está todo cargado, mostramos mensaje y dejamos que el siguiente input reintente
      if (!res.length && !bankCasesLoadedAll) {
        renderEmptyMessage(
          bankSearchResults,
          `Sin resultados aún para "${raw.trim()}". Se cargaron ${bankCasesCache.length}${bankCasesLoadedAll ? "" : "+"} casos. Prueba escribir 1–2 letras más o espera a que se carguen más.`
        );
      }
    }, 220);
  });
}

function resetBankSearchUI() {
  if (bankSearchInput) bankSearchInput.value = "";
  if (bankSearchResults) bankSearchResults.innerHTML = "";
}

/****************************************************
 * ✅ BUSCADOR DE BANCO PARA MINI EXÁMENES (mismo banco cache)
 ****************************************************/

function renderMiniBankSearchResults(results, queryText) {
  if (!miniBankSearchResults) return;

  if (!queryText) {
    renderEmptyMessage(
      miniBankSearchResults,
      bankCasesLoadedOnce
        ? `Banco listo. Escribe para buscar (${bankCasesCache.length}${bankCasesLoadedAll ? "" : "+"} casos cargados).`
        : "Escribe para buscar."
    );
    return;
  }

  if (!results.length) {
    renderEmptyMessage(
      miniBankSearchResults,
      bankCasesLoadedAll
        ? `Sin resultados para "${queryText}".`
        : `Sin resultados para "${queryText}" en los casos cargados. Intentando cargar más…`
    );
    return;
  }

  const usedSet = getMiniBankCaseIdsSet();

  const html = results
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
      const snippet = (c.caseText || "").slice(0, 220);
      const topicTxt = (c.topic || "").toString();
      const usage = typeof c.usageCount === "number" ? c.usageCount : 0;

      const isUsed = usedSet.has(c.id);

      return `
        <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">
                ${topicTxt ? topicTxt : (specLabel ? specLabel : "Caso del banco")}
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${specLabel ? specLabel : "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"} · Usado: ${usage}
              </div>
            </div>
            <button class="btn btn-sm btn-primary admin-mini-bank-add-case" data-id="${c.id}" ${isUsed ? "disabled" : ""}>
              ${isUsed ? "Ya está en mini" : "Agregar a mini exámenes"}
            </button>
          </div>

          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .join("");

  miniBankSearchResults.innerHTML = html;

  miniBankSearchResults
    .querySelectorAll(".admin-mini-bank-add-case")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const found = bankCasesCache.find((x) => x.id === id);
        if (!found) return;

        syncMiniCasesFromDOM();

        const usedNow = getMiniBankCaseIdsSet();
        if (usedNow.has(id)) {
          alert("Ese caso ya está agregado en mini exámenes. No se puede repetir.");
          return;
        }

        const cloned = {
          id: null,
          bankCaseId: found.id, // ✅ persistente
          caseText: found.caseText || "",
          specialty: found.specialty || "",
          questions: Array.isArray(found.questions)
            ? found.questions.map((q) => ({
                questionText: q.questionText || "",
                optionA: q.optionA || "",
                optionB: q.optionB || "",
                optionC: q.optionC || "",
                optionD: q.optionD || "",
                correctOption: q.correctOption || "",
                justification: q.justification || "",
                subtype: q.subtype || "salud_publica",
                difficulty: q.difficulty || "media",
              }))
            : [createEmptyQuestion()],
        };

        miniCases.push(cloned);
        renderMiniCases();

        btn.textContent = "Agregado";
        btn.disabled = true;
      });
    });
}

function initMiniBankSearchUI() {
  if (!miniBankSearchInput || !miniBankSearchResults) return;
  if (miniBankSearchInput.dataset.bound === "1") return;
  miniBankSearchInput.dataset.bound = "1";

  miniBankSearchInput.addEventListener("input", () => {
    if (miniBankSearchDebounceTimer) clearTimeout(miniBankSearchDebounceTimer);

    miniBankSearchDebounceTimer = setTimeout(async () => {
      const raw = miniBankSearchInput.value || "";

      if (!raw.trim()) {
        renderMiniBankSearchResults([], "");
        return;
      }

      // ✅ NUEVO: asegura que el cache cargue lo suficiente para ese query
      await ensureBankCasesForQuery(raw);

      const res = searchBankCases(raw);
      renderMiniBankSearchResults(res, raw.trim());

      if (!res.length && !bankCasesLoadedAll) {
        renderEmptyMessage(
          miniBankSearchResults,
          `Sin resultados aún para "${raw.trim()}". Se cargaron ${bankCasesCache.length}${bankCasesLoadedAll ? "" : "+"} casos.`
        );
      }
    }, 220);
  });
}

function resetMiniBankSearchUI() {
  if (miniBankSearchInput) miniBankSearchInput.value = "";
  if (miniBankSearchResults) miniBankSearchResults.innerHTML = "";
}

/****************************************************
 * VALIDACIÓN DE SESIÓN Y CARGA INICIAL (ADMIN)
 ****************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.email);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("Tu usuario no existe en la base de datos de Estudiante ENARM.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const data = userSnap.data();

    if (data.role !== "admin") {
      alert("Acceso no autorizado. Este usuario no es administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentAdminUser = {
      uid: user.uid,
      email: user.email,
      ...data,
    };

    if (adminUserEmailSpan) {
      adminUserEmailSpan.textContent = user.email;
    }
  } catch (err) {
    console.error("Error obteniendo perfil de administrador:", err);
    alert("Error cargando datos de administrador.");
    return;
  }

  // Inicializar buscadores
  initBankSearchUI();
  initMiniBankSearchUI();

  try {
    await loadSections();
  } catch (err) {
    console.error("Error cargando secciones:", err);
  }

  try {
    await loadLandingSettings();
  } catch (err) {
    console.error("Error cargando configuración de landing:", err);
  }

  console.log("admin.js cargado correctamente y panel inicializado (carga mínima).");
});

/****************************************************
 * NAVEGACIÓN LATERAL
 ****************************************************/

function clearSidebarActive() {
  [
    btnNavExams,
    btnNavBank,
    btnNavMini,
    btnNavUsers,
    btnNavAnalytics,
    btnNavLanding,
  ].forEach((b) => b && b.classList.remove("sidebar-btn--active"));
}

if (btnNavExams) {
  btnNavExams.addEventListener("click", () => {
    clearSidebarActive();
    btnNavExams.classList.add("sidebar-btn--active");
    setActivePanel("exams");
    sidebar.classList.remove("sidebar--open");
  });
}

if (btnNavBank) {
  btnNavBank.addEventListener("click", async () => {
    clearSidebarActive();
    btnNavBank.classList.add("sidebar-btn--active");
    setActivePanel("bank");
    sidebar.classList.remove("sidebar--open");

    await loadQuestionsBank(true);
  });
}

if (btnNavMini) {
  btnNavMini.addEventListener("click", async () => {
    clearSidebarActive();
    btnNavMini.classList.add("sidebar-btn--active");
    setActivePanel("mini");
    sidebar.classList.remove("sidebar--open");

    loadMiniCases();

    resetMiniBankSearchUI();
    await loadBankCasesIfNeeded();
  });
}

if (btnNavUsers) {
  btnNavUsers.addEventListener("click", () => {
    clearSidebarActive();
    btnNavUsers.classList.add("sidebar-btn--active");
    setActivePanel("users");
    sidebar.classList.remove("sidebar--open");
    loadUsers();
  });
}

if (btnNavAnalytics) {
  btnNavAnalytics.addEventListener("click", () => {
    clearSidebarActive();
    btnNavAnalytics.classList.add("sidebar-btn--active");
    setActivePanel("analytics");
    sidebar.classList.remove("sidebar--open");
    loadAnalyticsSummary();
  });
}

if (btnNavLanding) {
  btnNavLanding.addEventListener("click", () => {
    clearSidebarActive();
    btnNavLanding.classList.add("sidebar-btn--active");
    setActivePanel("landing");
    sidebar.classList.remove("sidebar--open");
    loadLandingSettings();
    loadSocialLinksIntoLanding();
  });
}

/****************************************************
 * SECCIONES (CRUD + REORDENAR) (SIN CAMBIOS)
 ****************************************************/

async function loadSections() {
  if (!sectionsList) return;

  const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(qSec);
  sectionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(sectionsList, "No hay secciones. Crea la primera.");
    currentSectionId = null;
    currentSectionTitle.textContent = "Sin secciones";
    examsListEl.innerHTML = "";
    return;
  }

  let first = true;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "Sección sin título";

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.draggable = true;
    li.dataset.sectionId = id;

    li.innerHTML = `
      <div class="sidebar__section-name">${name}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn admin-edit-section" title="Editar sección">✏</button>
        <button class="icon-btn admin-delete-section" title="Eliminar sección">🗑</button>
      </div>
    `;

    li.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("admin-edit-section") ||
        e.target.classList.contains("admin-delete-section")
      ) {
        return;
      }
      selectSection(id, name);
    });

    li
      .querySelector(".admin-edit-section")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        openEditSectionModal(id, name);
      });

    li
      .querySelector(".admin-delete-section")
      .addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = window.confirm(
          "¿Eliminar esta sección y TODOS los exámenes y casos clínicos asociados?"
        );
        if (!ok) return;
        await deleteSectionWithAllData(id);
        await loadSections();
        if (currentSectionId === id) {
          currentSectionId = null;
          currentSectionTitle.textContent = "Sin sección seleccionada";
          examsListEl.innerHTML = "";
        }
      });

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      li.classList.add("dragging");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      saveSectionsOrder();
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = sectionsList.querySelector(".dragging");
      if (!dragging || dragging === li) return;
      const bounding = li.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset > bounding.height / 2) {
        sectionsList.insertBefore(dragging, li.nextSibling);
      } else {
        sectionsList.insertBefore(dragging, li);
      }
    });

    sectionsList.appendChild(li);

    if (first) {
      first = false;
      selectSection(id, name);
      li.classList.add("sidebar__section-item--active");
    }
  });
}

function selectSection(id, name) {
  currentSectionId = id;
  currentSectionTitle.textContent = name || "Sección";

  sectionsList
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));
  const activeLi = sectionsList.querySelector(
    `.sidebar__section-item[data-section-id="${id}"]`
  );
  if (activeLi) {
    activeLi.classList.add("sidebar__section-item--active");
  }

  loadExamsForSection(id);
}

async function saveSectionsOrder() {
  if (!sectionsList) return;
  const items = Array.from(
    sectionsList.querySelectorAll(".sidebar__section-item")
  );
  const batchUpdates = items.map((li, index) => {
    const id = li.dataset.sectionId;
    return updateDoc(doc(db, "sections", id), { order: index });
  });
  try {
    await Promise.all(batchUpdates);
  } catch (err) {
    console.error("Error actualizando orden de secciones:", err);
  }
}

async function deleteSectionWithAllData(sectionId) {
  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );
  const exSnap = await getDocs(qEx);

  for (const ex of exSnap.docs) {
    const examId = ex.id;

    const qCases = query(
      collection(db, "questions"),
      where("examId", "==", examId)
    );
    const caseSnap = await getDocs(qCases);

    // ✅ ajustar usageCount por borrar examen (bankCaseId)
    const bankIds = caseSnap.docs
      .map((d) => (d.data() || {}).bankCaseId)
      .filter(Boolean);
    if (bankIds.length) {
      await applyUsageDelta(bankIds, []); // decrementa todo lo que estaba usado en ese examen
    }

    for (const c of caseSnap.docs) {
      await deleteDoc(c.ref);
    }

    await deleteDoc(ex.ref);
  }

  await deleteDoc(doc(db, "sections", sectionId));
}

function openEditSectionModal(sectionId, currentName) {
  openModal({
    title: "Editar sección",
    bodyHtml: `
      <label class="field">
        <span>Nombre de la sección</span>
        <input type="text" id="modal-section-name" value="${currentName || ""}" />
      </label>
    `,
    onOk: async () => {
      const input = document.getElementById("modal-section-name");
      const name = input.value.trim();
      if (!name) {
        alert("Escribe un nombre.");
        return;
      }
      const btn = modalBtnOk;
      setLoadingButton(btn, true);
      try {
        await updateDoc(doc(db, "sections", sectionId), { name });
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar la sección.");
      } finally {
        setLoadingButton(btn, false, "Guardar");
      }
    },
  });
}

if (btnAddSection) {
  btnAddSection.addEventListener("click", () => {
    openModal({
      title: "Nueva sección",
      bodyHtml: `
        <label class="field">
          <span>Nombre de la sección</span>
          <input type="text" id="modal-new-section-name" />
        </label>
      `,
      onOk: async () => {
        const input = document.getElementById("modal-new-section-name");
        const name = input.value.trim();
        if (!name) {
          alert("Escribe un nombre.");
          return;
        }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          const qSec = await getDocs(collection(db, "sections"));
          const order = qSec.size;

          await addDoc(collection(db, "sections"), {
            name,
            order,
            createdAt: serverTimestamp(),
          });

          await loadSections();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo crear la sección.");
        } finally {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

/**
 * Devuelve el ID de la sección por nombre; si no existe, la crea.
 */
async function getOrCreateSectionByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("sectionName vacío en JSON.");

  const qByName = query(
    collection(db, "sections"),
    where("name", "==", trimmed)
  );
  const snap = await getDocs(qByName);
  if (!snap.empty) {
    return snap.docs[0].id;
  }

  const all = await getDocs(collection(db, "sections"));
  const order = all.size;

  const ref = await addDoc(collection(db, "sections"), {
    name: trimmed,
    order,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/****************************************************
 * EXÁMENES (LISTA POR SECCIÓN)
 ****************************************************/

async function loadExamsForSection(sectionId) {
  if (!examsListEl) return;
  examsListEl.innerHTML = "";

  const thisLoadToken = ++examsLoadToken;

  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );
  const snap = await getDocs(qEx);

  if (thisLoadToken !== examsLoadToken || sectionId !== currentSectionId) {
    return;
  }

  if (snap.empty) {
    renderEmptyMessage(
      examsListEl,
      "No hay exámenes en esta sección. Crea el primero."
    );
    return;
  }

  const sortedDocs = snap.docs
    .slice()
    .sort((a, b) => {
      const nameA = (a.data().name || "").toString();
      const nameB = (b.data().name || "").toString();
      return nameA.localeCompare(nameB, "es", {
        numeric: true,
        sensitivity: "base",
      });
    });

  sortedDocs.forEach((docSnap) => {
    const examId = docSnap.id;
    const data = docSnap.data();
    const name = data.name || "Examen sin título";

    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${name}</div>
        <div class="card-item__actions">
          <button class="btn btn-sm btn-secondary admin-open-exam">Abrir</button>
          <button class="icon-btn admin-edit-exam" title="Editar nombre">✏</button>
          <button class="icon-btn admin-delete-exam" title="Eliminar examen">🗑</button>
        </div>
      </div>
    `;

    card
      .querySelector(".admin-open-exam")
      .addEventListener("click", () => openExamDetail(examId, name));

    card
      .querySelector(".admin-edit-exam")
      .addEventListener("click", () =>
        openEditExamNameModal(examId, name)
      );

    card
      .querySelector(".admin-delete-exam")
      .addEventListener("click", async () => {
        const ok = window.confirm(
          "¿Eliminar este examen y todos sus casos clínicos?"
        );
        if (!ok) return;

        // ✅ Antes de borrar, recolectar bankCaseId para bajar usageCount
        const qCases = query(
          collection(db, "questions"),
          where("examId", "==", examId)
        );
        const snapCases = await getDocs(qCases);

        const bankIds = snapCases.docs
          .map((d) => (d.data() || {}).bankCaseId)
          .filter(Boolean);

        if (bankIds.length) {
          await applyUsageDelta(bankIds, []); // decrementa lo usado por ese examen
        }

        for (const c of snapCases.docs) {
          await deleteDoc(c.ref);
        }

        await deleteDoc(doc(db, "exams", examId));
        loadExamsForSection(sectionId);
      });

    examsListEl.appendChild(card);
  });
}

if (btnAddExam) {
  btnAddExam.addEventListener("click", () => {
    if (!currentSectionId) {
      alert("Selecciona primero una sección.");
      return;
    }
    openModal({
      title: "Nuevo examen",
      bodyHtml: `
        <label class="field">
          <span>Nombre del examen</span>
          <input type="text" id="modal-new-exam-name" />
        </label>
      `,
      onOk: async () => {
        const input = document.getElementById("modal-new-exam-name");
        const name = input.value.trim();
        if (!name) {
          alert("Escribe un nombre.");
          return;
        }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          const docRef = await addDoc(collection(db, "exams"), {
            name,
            sectionId: currentSectionId,
            createdAt: serverTimestamp(),
          });
          await loadExamsForSection(currentSectionId);
          closeModal();
          openExamDetail(docRef.id, name);
        } catch (err) {
          console.error(err);
          alert("No se pudo crear el examen.");
        } finally {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

function openEditExamNameModal(examId, currentName) {
  openModal({
    title: "Editar nombre del examen",
    bodyHtml: `
      <label class="field">
        <span>Nombre del examen</span>
        <input type="text" id="modal-edit-exam-name" value="${currentName || ""}" />
      </label>
    `,
    onOk: async () => {
      const input = document.getElementById("modal-edit-exam-name");
      const name = input.value.trim();
      if (!name) {
        alert("Escribe un nombre.");
        return;
      }
      const btn = modalBtnOk;
      setLoadingButton(btn, true);
      try {
        await updateDoc(doc(db, "exams", examId), {
          name,
          updatedAt: serverTimestamp(),
        });
        await loadExamsForSection(currentSectionId);
        if (currentExamId === examId && examTitleInput) {
          examTitleInput.value = name;
        }
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar el examen.");
      } finally {
        setLoadingButton(btn, false, "Guardar");
      }
    },
  });
}

/**
 * Importar varios exámenes desde un JSON
 */
async function importExamsFromJson(json) {
  let examsArray = [];

  if (Array.isArray(json)) {
    examsArray = json;
  } else if (json && Array.isArray(json.exams)) {
    examsArray = json.exams;
  }

  if (!examsArray.length) {
    alert("El JSON no contiene ningún examen (se esperaba un arreglo).");
    return;
  }

  const ok = window.confirm(
    `Se crearán ${examsArray.length} exámenes nuevos a partir del JSON. ` +
    `Cada examen incluirá sus casos clínicos y preguntas.\n\n¿Continuar?`
  );
  if (!ok) return;

  for (const examSpec of examsArray) {
    const sectionName = examSpec.sectionName || examSpec.section || null;
    const examName = examSpec.examName || examSpec.name || "Examen sin título";

    if (!sectionName) {
      console.warn("Examen sin sectionName, se omite:", examSpec);
      continue;
    }

    const sectionId = await getOrCreateSectionByName(sectionName);

    const examRef = await addDoc(collection(db, "exams"), {
      name: examName,
      sectionId,
      createdAt: serverTimestamp(),
    });
    const examId = examRef.id;

    const casesArr = Array.isArray(examSpec.cases) ? examSpec.cases : [];

    for (const caseSpec of casesArr) {
      const caseText = caseSpec.caseText || caseSpec.case || "";
      const specialty = caseSpec.specialty || "";
      const topic = (caseSpec.topic || "").toString().trim();

      const questionsSrc = Array.isArray(caseSpec.questions)
        ? caseSpec.questions
        : [];

      const questionsFormatted = questionsSrc
        .map((q) => ({
          questionText: q.questionText || q.question || "",
          optionA: q.optionA || q.a || "",
          optionB: q.optionB || q.b || "",
          optionC: q.optionC || q.c || "",
          optionD: q.optionD || q.d || "",
          correctOption: q.correctOption || q.correct || q.answer || "",
          subtype: q.subtype || "salud_publica",
          difficulty: q.difficulty || "media",
          justification: q.justification || q.explanation || "",
        }))
        .filter(
          (q) =>
            q.questionText &&
            q.optionA &&
            q.optionB &&
            q.optionC &&
            q.optionD &&
            q.correctOption &&
            q.justification
        );

      if (!caseText || !questionsFormatted.length) {
        console.warn("Caso omitido por falta de datos:", caseSpec);
        continue;
      }

      await addDoc(collection(db, "questions"), {
        examId,
        bankCaseId: null, // ✅ importado no viene del banco
        caseText,
        specialty,
        topic,
        questions: questionsFormatted,
        createdAt: serverTimestamp(),
      });
    }
  }

  alert("Importación de exámenes desde JSON completada.");

  await loadSections();
  if (currentSectionId) {
    await loadExamsForSection(currentSectionId);
  }
}

if (btnImportExamsJson) {
  btnImportExamsJson.addEventListener("click", () => {
    openJsonFilePicker(async (json) => {
      try {
        await importExamsFromJson(json);

        // ✅ por si importaste nuevos docs, refresca cache del banco
        resetBankCasesCache();
      } catch (err) {
        console.error("Error importando exámenes desde JSON:", err);
        alert("Hubo un error al importar los exámenes. Revisa la consola.");
      }
    });
  });
}

/****************************************************
 * DETALLE DE EXAMEN (CASOS CLÍNICOS + PREGUNTAS)
 ****************************************************/

function createEmptyQuestion() {
  return {
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "",
    justification: "",
    subtype: "salud_publica",
    difficulty: "media",
  };
}

function createEmptyCase() {
  return {
    bankCaseId: null,
    caseText: "",
    specialty: "",
    topic: "",
    questions: [createEmptyQuestion()],
  };
}

/**
 * Sincroniza currentExamCases con TODO lo escrito en el DOM actual.
 */
function syncCurrentExamCasesFromDOM() {
  if (!examCasesContainer) return;

  const caseBlocks = examCasesContainer.querySelectorAll(".exam-case-block");
  const newCases = [];

  caseBlocks.forEach((block) => {
    const caseText =
      block.querySelector(".admin-case-text")?.value.trim() || "";
    const specialty =
      block.querySelector(".admin-case-specialty")?.value || "";
    const topic =
      block.querySelector(".admin-case-topic")?.value.trim() || "";

    const bankCaseId = (block.dataset.bankCaseId || "").trim() || null;

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText =
        qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption =
        qb.querySelector(".admin-q-correct")?.value || "";
      const subtype =
        qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty =
        qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification =
        qb.querySelector(".admin-q-justification")?.value.trim() || "";

      const allEmpty =
        !questionText &&
        !optionA &&
        !optionB &&
        !optionC &&
        !optionD &&
        !justification;

      if (allEmpty) return;

      questions.push({
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        subtype,
        difficulty,
        justification,
      });
    });

    if (!caseText && !questions.length) return;

    newCases.push({
      bankCaseId,
      caseText,
      specialty,
      topic,
      questions: questions.length ? questions : [createEmptyQuestion()],
    });
  });

  currentExamCases =
    newCases.length > 0 ? newCases : [createEmptyCase()];
}

async function openExamDetail(examId, examName) {
  currentExamId = examId;
  currentExamCases = [];

  show(panelExams);
  show(examDetailView);

  resetBankSearchUI();

  if (examTitleInput) {
    examTitleInput.value = examName || "";
  }
  if (examCasesContainer) {
    examCasesContainer.innerHTML = "";
  }

  const qCases = query(
    collection(db, "questions"),
    where("examId", "==", examId)
  );
  const snap = await getDocs(qCases);

  if (snap.empty) {
    currentExamCases = [createEmptyCase()];
  } else {
    currentExamCases = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        topic: (data?.topic || "").toString(),
        bankCaseId: data.bankCaseId || null,
      };
    });
  }

  renderExamCases();

  // ✅ IMPORTANTE: carga el banco (incremental) para que el buscador sí encuentre TODO
  await loadBankCasesIfNeeded();
}

/****************************************************
 * CONTINÚA ADMIN.JS - PARTE 2/2
 ****************************************************/
/****************************************************
 * CONTINÚA ADMIN.JS - PARTE 2/2
 * (Incluye: renderExamCases, guardado/import de examen,
 *  panel Banco (questions sin examId), MINI, Usuarios,
 *  Analytics, Landing/Settings)
 ****************************************************/

/****************************************************
 * RENDER: CASOS DEL EXAMEN (DETALLE)
 ****************************************************/

function renderExamCases() {
  if (!examCasesContainer) return;

  examCasesContainer.innerHTML = "";

  if (!Array.isArray(currentExamCases) || !currentExamCases.length) {
    currentExamCases = [createEmptyCase()];
  }

  currentExamCases.forEach((c, idx) => {
    const block = document.createElement("div");
    block.className = "exam-case-block card-item";
    block.dataset.index = String(idx);
    block.dataset.bankCaseId = (c.bankCaseId || "").toString();

    const specLabel = getSpecialtyLabel(c.specialty);

    block.innerHTML = `
      <div class="card-item__title-row" style="align-items:flex-start;">
        <div style="flex:1;">
          <div class="card-item__title">Caso #${idx + 1}</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
            ${c.topic ? `Tema: <b>${c.topic}</b>` : "Tema: —"} ·
            ${specLabel ? `Especialidad: <b>${specLabel}</b>` : "Especialidad: —"}
            ${c.bankCaseId ? ` · <span style="opacity:.85;">(Viene del banco)</span>` : ""}
          </div>
        </div>
        <div class="card-item__actions">
          <button class="btn btn-sm btn-secondary admin-case-add-question">+ Pregunta</button>
          <button class="btn btn-sm btn-secondary admin-case-duplicate">Duplicar</button>
          <button class="icon-btn admin-case-delete" title="Eliminar caso">🗑</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px;">
        <label class="field">
          <span>Case Text</span>
          <textarea class="admin-case-text" rows="5" placeholder="Pega aquí el caso clínico...">${c.caseText || ""}</textarea>
        </label>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <label class="field">
            <span>Topic</span>
            <input class="admin-case-topic" type="text" value="${(c.topic || "").toString()}" placeholder="Ej. Diabetes gestacional" />
          </label>

          <label class="field">
            <span>Specialty</span>
            <input class="admin-case-specialty" type="text" value="${(c.specialty || "").toString()}" placeholder="Ej. gine_obstetricia" />
          </label>
        </div>
      </div>

      <div class="exam-questions-container" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;"></div>
    `;

    const questionsContainer = block.querySelector(".exam-questions-container");

    const qs = Array.isArray(c.questions) && c.questions.length ? c.questions : [createEmptyQuestion()];
    qs.forEach((q, qIdx) => {
      const qBlock = document.createElement("div");
      qBlock.className = "exam-question-block card";
      qBlock.dataset.qIndex = String(qIdx);

      qBlock.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="font-weight:600;font-size:13px;">Pregunta #${qIdx + 1}</div>
          <button class="icon-btn admin-q-delete" title="Eliminar pregunta">🗑</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px;">
          <label class="field">
            <span>Question Text</span>
            <textarea class="admin-q-question" rows="3" placeholder="Pregunta...">${q.questionText || ""}</textarea>
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label class="field"><span>Opción A</span><input class="admin-q-a" type="text" value="${q.optionA || ""}" /></label>
            <label class="field"><span>Opción B</span><input class="admin-q-b" type="text" value="${q.optionB || ""}" /></label>
            <label class="field"><span>Opción C</span><input class="admin-q-c" type="text" value="${q.optionC || ""}" /></label>
            <label class="field"><span>Opción D</span><input class="admin-q-d" type="text" value="${q.optionD || ""}" /></label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <label class="field">
              <span>Correct Option</span>
              <select class="admin-q-correct">
                <option value="" ${!q.correctOption ? "selected" : ""}>—</option>
                <option value="A" ${q.correctOption === "A" ? "selected" : ""}>A</option>
                <option value="B" ${q.correctOption === "B" ? "selected" : ""}>B</option>
                <option value="C" ${q.correctOption === "C" ? "selected" : ""}>C</option>
                <option value="D" ${q.correctOption === "D" ? "selected" : ""}>D</option>
              </select>
            </label>

            <label class="field">
              <span>Subtype</span>
              <select class="admin-q-subtype">
                ${Object.keys(SUBTYPES || {}).map((k) => {
                  const label = SUBTYPES[k] || k;
                  return `<option value="${k}" ${q.subtype === k ? "selected" : ""}>${label}</option>`;
                }).join("")}
              </select>
            </label>

            <label class="field">
              <span>Difficulty</span>
              <select class="admin-q-difficulty">
                ${Object.keys(DIFFICULTIES || {}).map((k) => {
                  const label = DIFFICULTIES[k] || k;
                  return `<option value="${k}" ${q.difficulty === k ? "selected" : ""}>${label}</option>`;
                }).join("")}
              </select>
            </label>
          </div>

          <label class="field">
            <span>Justification</span>
            <textarea class="admin-q-justification" rows="4" placeholder="Justificación...">${q.justification || ""}</textarea>
          </label>
        </div>
      `;

      // eliminar pregunta
      qBlock.querySelector(".admin-q-delete").addEventListener("click", () => {
        syncCurrentExamCasesFromDOM();
        const caseIdx = Number(block.dataset.index);
        if (!Number.isFinite(caseIdx) || !currentExamCases[caseIdx]) return;

        if ((currentExamCases[caseIdx].questions || []).length <= 1) {
          alert("Cada caso debe tener al menos 1 pregunta en edición. (En tu regla final serán 2–3).");
          return;
        }

        currentExamCases[caseIdx].questions.splice(qIdx, 1);
        renderExamCases();
      });

      questionsContainer.appendChild(qBlock);
    });

    // add question
    block.querySelector(".admin-case-add-question").addEventListener("click", () => {
      syncCurrentExamCasesFromDOM();
      const caseIdx = Number(block.dataset.index);
      if (!Number.isFinite(caseIdx) || !currentExamCases[caseIdx]) return;

      const qsNow = currentExamCases[caseIdx].questions || [];
      if (qsNow.length >= 3) {
        alert("Máximo 3 preguntas por caso.");
        return;
      }

      qsNow.push(createEmptyQuestion());
      currentExamCases[caseIdx].questions = qsNow;
      renderExamCases();
    });

    // duplicate case (mantiene bankCaseId si venía del banco)
    block.querySelector(".admin-case-duplicate").addEventListener("click", () => {
      syncCurrentExamCasesFromDOM();
      const caseIdx = Number(block.dataset.index);
      const src = currentExamCases[caseIdx];
      if (!src) return;

      const copy = JSON.parse(JSON.stringify(src));
      currentExamCases.splice(caseIdx + 1, 0, copy);
      renderExamCases();
    });

    // delete case
    block.querySelector(".admin-case-delete").addEventListener("click", () => {
      const ok = window.confirm("¿Eliminar este caso del examen?");
      if (!ok) return;

      syncCurrentExamCasesFromDOM();
      const caseIdx = Number(block.dataset.index);
      currentExamCases.splice(caseIdx, 1);
      if (!currentExamCases.length) currentExamCases = [createEmptyCase()];
      renderExamCases();
    });

    examCasesContainer.appendChild(block);
  });

  // (Re)render buscador: permite que botones "Ya está..." reflejen el set actualizado
  if (bankSearchInput && bankSearchResults) {
    const raw = (bankSearchInput.value || "").trim();
    if (raw) {
      const res = searchBankCases(raw);
      renderBankSearchResults(res, raw);
    }
  }
}

/****************************************************
 * BOTONES DETALLE EXAMEN
 ****************************************************/

if (btnBackToExams) {
  btnBackToExams.addEventListener("click", () => {
    hide(examDetailView);
    currentExamId = null;
    currentExamCases = [];
    resetBankSearchUI();
  });
}

if (btnAddCaseTop) {
  btnAddCaseTop.addEventListener("click", () => {
    syncCurrentExamCasesFromDOM();
    currentExamCases.push(createEmptyCase());
    renderExamCases();
  });
}

/****************************************************
 * VALIDACIONES (EXAMEN)
 ****************************************************/
function validateExamCasesForSave(casesArr) {
  if (!Array.isArray(casesArr) || !casesArr.length) return "El examen no tiene casos.";

  for (let i = 0; i < casesArr.length; i++) {
    const c = casesArr[i];
    if (!c.caseText || !c.caseText.trim()) return `Caso #${i + 1}: caseText vacío.`;
    if (!Array.isArray(c.questions) || !c.questions.length) return `Caso #${i + 1}: sin preguntas.`;

    for (let j = 0; j < c.questions.length; j++) {
      const q = c.questions[j];
      const prefix = `Caso #${i + 1}, Pregunta #${j + 1}`;
      if (!q.questionText || !q.questionText.trim()) return `${prefix}: questionText vacío.`;
      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) return `${prefix}: opciones incompletas.`;
      if (!q.correctOption) return `${prefix}: correctOption vacío.`;
      if (!q.justification || !q.justification.trim()) return `${prefix}: justification vacía.`;
      if (!q.subtype) return `${prefix}: subtype vacío.`;
      if (!q.difficulty) return `${prefix}: difficulty vacío.`;
    }
  }

  return null;
}

/****************************************************
 * GUARDAR EXAMEN (nombre + casos)
 * - Reescribe los docs de "questions" del examen (no crea exámenes extra)
 * - Ajusta usageCount con delta (bankCaseId)
 ****************************************************/
async function saveCurrentExamAll() {
  if (!currentExamId) {
    alert("No hay examen abierto.");
    return;
  }

  syncCurrentExamCasesFromDOM();

  const examName = (examTitleInput?.value || "").trim();
  if (!examName) {
    alert("Escribe un nombre para el examen.");
    return;
  }

  const err = validateExamCasesForSave(currentExamCases);
  if (err) {
    alert(err);
    return;
  }

  setLoadingButton(btnSaveExamAll, true, "Guardar examen");

  try {
    // 1) actualizar nombre examen
    await updateDoc(doc(db, "exams", currentExamId), {
      name: examName,
      updatedAt: serverTimestamp(),
    });

    // 2) leer casos previos (para delta de usageCount)
    const qPrev = query(collection(db, "questions"), where("examId", "==", currentExamId));
    const prevSnap = await getDocs(qPrev);

    const prevBankIds = prevSnap.docs
      .map((d) => (d.data() || {}).bankCaseId)
      .filter(Boolean);

    const newBankIds = (currentExamCases || [])
      .map((c) => c.bankCaseId)
      .filter(Boolean);

    // 3) borrar casos previos del examen
    for (const d of prevSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 4) escribir casos nuevos del examen
    for (const c of currentExamCases) {
      await addDoc(collection(db, "questions"), {
        examId: currentExamId,
        bankCaseId: c.bankCaseId || null, // ✅ si viene del banco se guarda, si no, null
        caseText: (c.caseText || "").toString(),
        specialty: (c.specialty || "").toString(),
        topic: (c.topic || "").toString(),
        questions: (c.questions || []).map((q) => ({
          questionText: (q.questionText || "").toString(),
          optionA: (q.optionA || "").toString(),
          optionB: (q.optionB || "").toString(),
          optionC: (q.optionC || "").toString(),
          optionD: (q.optionD || "").toString(),
          correctOption: (q.correctOption || "").toString(),
          justification: (q.justification || "").toString(),
          subtype: (q.subtype || "salud_publica").toString(),
          difficulty: (q.difficulty || "media").toString(),
        })),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    // 5) aplicar delta usageCount del banco
    await applyUsageDelta(prevBankIds, newBankIds);

    alert("Examen guardado.");
    await loadExamsForSection(currentSectionId);
  } catch (e) {
    console.error(e);
    alert("No se pudo guardar el examen. Revisa consola.");
  } finally {
    setLoadingButton(btnSaveExamAll, false, "Guardar examen");
  }
}

if (btnSaveExamAll) {
  btnSaveExamAll.addEventListener("click", () => saveCurrentExamAll());
}

/****************************************************
 * IMPORTAR JSON AL EXAMEN ABIERTO
 * - No crea examen nuevo
 * - Reemplaza los casos del examen actual por los del JSON (cases)
 ****************************************************/
async function importJsonIntoCurrentExam(json) {
  if (!currentExamId) {
    alert("Primero abre un examen.");
    return;
  }

  let casesArr = [];
  if (Array.isArray(json)) casesArr = json;
  else if (json && Array.isArray(json.cases)) casesArr = json.cases;
  else if (json && Array.isArray(json.exam?.cases)) casesArr = json.exam.cases;

  if (!casesArr.length) {
    alert("El JSON no trae cases.");
    return;
  }

  const ok = window.confirm(`Se importarán ${casesArr.length} casos y REEMPLAZARÁN los actuales del examen. ¿Continuar?`);
  if (!ok) return;

  const mapped = casesArr.map((caseSpec) => {
    const caseText = caseSpec.caseText || caseSpec.case || "";
    const specialty = caseSpec.specialty || "";
    const topic = (caseSpec.topic || "").toString();

    const questionsSrc = Array.isArray(caseSpec.questions) ? caseSpec.questions : [];
    const questions = questionsSrc.map((q) => ({
      questionText: q.questionText || q.question || "",
      optionA: q.optionA || q.a || "",
      optionB: q.optionB || q.b || "",
      optionC: q.optionC || q.c || "",
      optionD: q.optionD || q.d || "",
      correctOption: q.correctOption || q.correct || q.answer || "",
      justification: q.justification || q.explanation || "",
      subtype: q.subtype || "salud_publica",
      difficulty: q.difficulty || "media",
    }));

    return {
      bankCaseId: null, // ✅ import JSON a examen NO viene del banco
      caseText,
      specialty,
      topic,
      questions: questions.length ? questions : [createEmptyQuestion()],
    };
  });

  currentExamCases = mapped.length ? mapped : [createEmptyCase()];
  renderExamCases();
}

if (btnImportExamJson) {
  btnImportExamJson.addEventListener("click", () => {
    openJsonFilePicker(async (json) => {
      try {
        await importJsonIntoCurrentExam(json);
      } catch (e) {
        console.error(e);
        alert("Error importando JSON al examen. Revisa consola.");
      }
    });
  });
}

/****************************************************
 * PANEL BANCO (questions SIN examId)
 * - Edición INLINE (sin modal)
 * - Muestra topic + usageCount
 ****************************************************/

const bankListEl = document.getElementById("admin-bank-list");
const bankSearchPanelInput = document.getElementById("admin-bank-panel-search-input");
const btnBankReload = document.getElementById("admin-btn-bank-reload");

let bankPanelCache = [];
let bankPanelLastDoc = null;
let bankPanelLoadedAll = false;
let bankPanelLoading = false;
const BANK_PANEL_PAGE = 200;

function bankPanelNormalizeDoc(d) {
  const data = d.data() || {};
  if (!isBankCaseDoc(data)) return null;
  return {
    id: d.id,
    caseText: data.caseText || "",
    specialty: data.specialty || "",
    topic: (data.topic || "").toString(),
    usageCount: typeof data.usageCount === "number" ? data.usageCount : 0,
    questions: Array.isArray(data.questions) ? data.questions : [],
    _norm: normalizeText(`${data.topic || ""} ${data.specialty || ""} ${data.caseText || ""} ${(Array.isArray(data.questions) ? data.questions.map(q => q.questionText || "").join(" ") : "")}`),
  };
}

function resetBankPanel() {
  bankPanelCache = [];
  bankPanelLastDoc = null;
  bankPanelLoadedAll = false;
  bankPanelLoading = false;
}

async function loadQuestionsBank(force = false) {
  if (!bankListEl) return;

  if (force) resetBankPanel();

  if (bankPanelLoading || bankPanelLoadedAll) {
    renderBankPanelList();
    return;
  }

  bankPanelLoading = true;

  if (!bankPanelCache.length) {
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        Cargando banco…
      </div>
    `;
  }

  try {
    // preferente createdAt desc, fallback documentId asc
    let qBase;
    try {
      qBase = query(
        collection(db, "questions"),
        orderBy("createdAt", "desc"),
        ...(bankPanelLastDoc ? [startAfter(bankPanelLastDoc)] : []),
        limit(BANK_PANEL_PAGE)
      );
    } catch {
      qBase = query(
        collection(db, "questions"),
        orderBy(documentId(), "asc"),
        ...(bankPanelLastDoc ? [startAfter(bankPanelLastDoc)] : []),
        limit(BANK_PANEL_PAGE)
      );
    }

    const snap = await getDocs(qBase);

    if (snap.empty) {
      bankPanelLoadedAll = true;
      renderBankPanelList();
      return;
    }

    bankPanelLastDoc = snap.docs[snap.docs.length - 1];

    const items = snap.docs.map(bankPanelNormalizeDoc).filter(Boolean);

    // de-dup
    const ids = new Set(bankPanelCache.map(x => x.id));
    for (const it of items) if (!ids.has(it.id)) bankPanelCache.push(it);

    if (snap.size < BANK_PANEL_PAGE) bankPanelLoadedAll = true;

    renderBankPanelList();
  } catch (e) {
    console.error(e);
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#fecaca;">
        Error cargando banco. Revisa consola.
      </div>
    `;
  } finally {
    bankPanelLoading = false;
  }
}

function renderBankPanelList() {
  if (!bankListEl) return;

  const raw = (bankSearchPanelInput?.value || "").trim();
  const qn = normalizeText(raw);

  let list = bankPanelCache;
  if (qn) {
    const tokens = qn.split(" ").filter(t => t.length >= 2);
    list = bankPanelCache.filter(x => tokens.every(t => x._norm.includes(t)));
  }

  if (!list.length) {
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        ${raw ? `Sin resultados para "${raw}".` : "Sin casos en el banco."}
      </div>
    `;
    return;
  }

  bankListEl.innerHTML = list.slice(0, 200).map((c) => {
    const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
    const snippet = (c.caseText || "").slice(0, 220);

    return `
      <div class="card-item" data-id="${c.id}" style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <div style="font-weight:700;font-size:13px;">
              ${c.topic ? c.topic : "Sin topic"} · Usado: ${c.usageCount}
            </div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
              ${getSpecialtyLabel(c.specialty) || "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-secondary admin-bank-inline-save">Guardar</button>
            <button class="btn btn-sm btn-secondary admin-bank-inline-open">Ver/Editar</button>
            <button class="icon-btn admin-bank-inline-delete" title="Eliminar del banco">🗑</button>
          </div>
        </div>

        <div class="admin-bank-inline-editor hidden" style="display:grid;grid-template-columns:1fr;gap:10px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label class="field"><span>Topic</span><input class="admin-bank-topic" type="text" value="${(c.topic || "").toString()}" /></label>
            <label class="field"><span>Specialty</span><input class="admin-bank-specialty" type="text" value="${(c.specialty || "").toString()}" /></label>
          </div>
          <label class="field">
            <span>Case Text</span>
            <textarea class="admin-bank-caseText" rows="5">${c.caseText || ""}</textarea>
          </label>
          <div style="font-size:12px;color:#9ca3af;">Nota: la edición de preguntas del banco se hace desde tu importador o desde tu flujo interno; aquí editas rápido el texto y metadatos.</div>
        </div>

        <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
          ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
        </div>
      </div>
    `;
  }).join("");

  bankListEl.querySelectorAll(".card-item").forEach((row) => {
    const id = row.dataset.id;

    const btnOpen = row.querySelector(".admin-bank-inline-open");
    const btnSave = row.querySelector(".admin-bank-inline-save");
    const btnDelete = row.querySelector(".admin-bank-inline-delete");

    const editor = row.querySelector(".admin-bank-inline-editor");
    const topicEl = row.querySelector(".admin-bank-topic");
    const specEl = row.querySelector(".admin-bank-specialty");
    const caseEl = row.querySelector(".admin-bank-caseText");

    btnOpen.addEventListener("click", () => {
      editor.classList.toggle("hidden");
    });

    btnSave.addEventListener("click", async () => {
      const topic = (topicEl.value || "").trim();
      const specialty = (specEl.value || "").trim();
      const caseText = (caseEl.value || "").trim();

      if (!caseText) {
        alert("caseText vacío.");
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = "Guardando…";

      try {
        await updateDoc(doc(db, "questions", id), {
          topic,
          specialty,
          caseText,
          updatedAt: serverTimestamp(),
        });

        // refrescar caches (buscadores y panel)
        resetBankCasesCache();
        resetBankPanel();

        await loadQuestionsBank(true);
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar. Revisa consola.");
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = "Guardar";
      }
    });

    btnDelete.addEventListener("click", async () => {
      const ok = window.confirm("¿Eliminar este caso del banco?");
      if (!ok) return;

      try {
        await deleteDoc(doc(db, "questions", id));

        // refrescar caches
        resetBankCasesCache();
        resetBankPanel();

        await loadQuestionsBank(true);
      } catch (e) {
        console.error(e);
        alert("No se pudo eliminar. Revisa consola.");
      }
    });
  });

  // botón cargar más (si existe espacio)
  if (!bankPanelLoadedAll) {
    const more = document.createElement("div");
    more.className = "card";
    more.style.padding = "10px 12px";
    more.style.marginTop = "10px";
    more.innerHTML = `<button class="btn btn-sm btn-secondary" id="admin-bank-load-more">Cargar más</button>
      <div style="font-size:12px;color:#9ca3af;margin-top:6px;">Cargados: ${bankPanelCache.length}${bankPanelLoadedAll ? "" : "+"}</div>`;
    bankListEl.appendChild(more);

    more.querySelector("#admin-bank-load-more").addEventListener("click", async () => {
      await loadQuestionsBank(false);
    });
  }
}

if (bankSearchPanelInput) {
  bankSearchPanelInput.addEventListener("input", () => renderBankPanelList());
}
if (btnBankReload) {
  btnBankReload.addEventListener("click", () => loadQuestionsBank(true));
}

/****************************************************
 * MINI EXÁMENES
 * Nota: Como no me compartiste tu estructura exacta en Firestore,
 * aquí uso un doc único: settings/miniExams con { cases: [...] }.
 * Si tu proyecto usa otra ruta, se ajusta en 1 minuto cuando me pases
 * esa parte del admin.html o el schema actual.
 ****************************************************/

const btnSaveMini = document.getElementById("admin-btn-save-mini");
const btnAddMiniCase = document.getElementById("admin-btn-add-mini-case");
const miniCasesContainer = document.getElementById("admin-mini-cases");

function syncMiniCasesFromDOM() {
  if (!miniCasesContainer) return;

  const blocks = miniCasesContainer.querySelectorAll(".mini-case-block");
  const next = [];

  blocks.forEach((block) => {
    const caseText = block.querySelector(".admin-mini-case-text")?.value.trim() || "";
    const specialty = block.querySelector(".admin-mini-case-specialty")?.value.trim() || "";
    const bankCaseId = (block.dataset.bankCaseId || "").trim() || null;

    const qBlocks = block.querySelectorAll(".mini-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText = qb.querySelector(".admin-mini-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-mini-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-mini-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-mini-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-mini-q-d")?.value.trim() || "";
      const correctOption = qb.querySelector(".admin-mini-q-correct")?.value || "";
      const subtype = qb.querySelector(".admin-mini-q-subtype")?.value || "salud_publica";
      const difficulty = qb.querySelector(".admin-mini-q-difficulty")?.value || "media";
      const justification = qb.querySelector(".admin-mini-q-justification")?.value.trim() || "";

      const allEmpty = !questionText && !optionA && !optionB && !optionC && !optionD && !justification;
      if (allEmpty) return;

      questions.push({ questionText, optionA, optionB, optionC, optionD, correctOption, subtype, difficulty, justification });
    });

    if (!caseText && !questions.length) return;

    next.push({
      bankCaseId,
      caseText,
      specialty,
      questions: questions.length ? questions : [createEmptyQuestion()],
    });
  });

  miniCases = next.length ? next : [];
}

function renderMiniCases() {
  if (!miniCasesContainer) return;
  miniCasesContainer.innerHTML = "";

  if (!miniCases.length) {
    renderEmptyMessage(miniCasesContainer, "No hay casos en mini exámenes. Agrega desde el banco o crea uno.");
    return;
  }

  miniCases.forEach((c, idx) => {
    const block = document.createElement("div");
    block.className = "mini-case-block card-item";
    block.dataset.index = String(idx);
    block.dataset.bankCaseId = (c.bankCaseId || "").toString();

    block.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">Mini caso #${idx + 1}</div>
        <div class="card-item__actions">
          <button class="btn btn-sm btn-secondary admin-mini-add-question">+ Pregunta</button>
          <button class="icon-btn admin-mini-delete" title="Eliminar mini caso">🗑</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px;">
        <label class="field">
          <span>Case Text</span>
          <textarea class="admin-mini-case-text" rows="4">${c.caseText || ""}</textarea>
        </label>
        <label class="field">
          <span>Specialty</span>
          <input class="admin-mini-case-specialty" type="text" value="${(c.specialty || "").toString()}" />
        </label>
      </div>

      <div class="mini-questions-container" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;"></div>
    `;

    const qWrap = block.querySelector(".mini-questions-container");
    const qs = Array.isArray(c.questions) && c.questions.length ? c.questions : [createEmptyQuestion()];

    qs.forEach((q, qIdx) => {
      const qb = document.createElement("div");
      qb.className = "mini-question-block card";
      qb.dataset.qIndex = String(qIdx);

      qb.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="font-weight:600;font-size:13px;">Pregunta #${qIdx + 1}</div>
          <button class="icon-btn admin-mini-q-delete" title="Eliminar pregunta">🗑</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px;">
          <label class="field"><span>Question</span><textarea class="admin-mini-q-question" rows="3">${q.questionText || ""}</textarea></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label class="field"><span>A</span><input class="admin-mini-q-a" type="text" value="${q.optionA || ""}" /></label>
            <label class="field"><span>B</span><input class="admin-mini-q-b" type="text" value="${q.optionB || ""}" /></label>
            <label class="field"><span>C</span><input class="admin-mini-q-c" type="text" value="${q.optionC || ""}" /></label>
            <label class="field"><span>D</span><input class="admin-mini-q-d" type="text" value="${q.optionD || ""}" /></label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <label class="field">
              <span>Correct</span>
              <select class="admin-mini-q-correct">
                <option value="" ${!q.correctOption ? "selected" : ""}>—</option>
                <option value="A" ${q.correctOption === "A" ? "selected" : ""}>A</option>
                <option value="B" ${q.correctOption === "B" ? "selected" : ""}>B</option>
                <option value="C" ${q.correctOption === "C" ? "selected" : ""}>C</option>
                <option value="D" ${q.correctOption === "D" ? "selected" : ""}>D</option>
              </select>
            </label>

            <label class="field">
              <span>Subtype</span>
              <select class="admin-mini-q-subtype">
                ${Object.keys(SUBTYPES || {}).map((k) => {
                  const label = SUBTYPES[k] || k;
                  return `<option value="${k}" ${q.subtype === k ? "selected" : ""}>${label}</option>`;
                }).join("")}
              </select>
            </label>

            <label class="field">
              <span>Difficulty</span>
              <select class="admin-mini-q-difficulty">
                ${Object.keys(DIFFICULTIES || {}).map((k) => {
                  const label = DIFFICULTIES[k] || k;
                  return `<option value="${k}" ${q.difficulty === k ? "selected" : ""}>${label}</option>`;
                }).join("")}
              </select>
            </label>
          </div>

          <label class="field"><span>Justification</span><textarea class="admin-mini-q-justification" rows="3">${q.justification || ""}</textarea></label>
        </div>
      `;

      qb.querySelector(".admin-mini-q-delete").addEventListener("click", () => {
        syncMiniCasesFromDOM();
        const i = Number(block.dataset.index);
        if (!miniCases[i]) return;
        if ((miniCases[i].questions || []).length <= 1) {
          alert("Cada caso debe conservar al menos 1 pregunta en edición.");
          return;
        }
        miniCases[i].questions.splice(qIdx, 1);
        renderMiniCases();
      });

      qWrap.appendChild(qb);
    });

    block.querySelector(".admin-mini-add-question").addEventListener("click", () => {
      syncMiniCasesFromDOM();
      const i = Number(block.dataset.index);
      if (!miniCases[i]) return;
      const qsNow = miniCases[i].questions || [];
      if (qsNow.length >= 3) {
        alert("Máximo 3 preguntas por caso.");
        return;
      }
      qsNow.push(createEmptyQuestion());
      miniCases[i].questions = qsNow;
      renderMiniCases();
    });

    block.querySelector(".admin-mini-delete").addEventListener("click", () => {
      const ok = window.confirm("¿Eliminar este mini caso?");
      if (!ok) return;
      syncMiniCasesFromDOM();
      const i = Number(block.dataset.index);
      miniCases.splice(i, 1);
      renderMiniCases();
    });

    miniCasesContainer.appendChild(block);
  });

  // refrescar buscador mini para “Ya está en mini”
  if (miniBankSearchInput && miniBankSearchResults) {
    const raw = (miniBankSearchInput.value || "").trim();
    if (raw) {
      const res = searchBankCases(raw);
      renderMiniBankSearchResults(res, raw);
    }
  }
}

async function loadMiniCases() {
  if (miniCasesLoadedOnce) {
    renderMiniCases();
    return;
  }

  try {
    const ref = doc(db, "settings", "miniExams");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      miniCases = [];
      miniCasesLoadedOnce = true;
      renderMiniCases();
      return;
    }

    const data = snap.data() || {};
    miniCases = Array.isArray(data.cases) ? data.cases : [];
    miniCasesLoadedOnce = true;
    renderMiniCases();
  } catch (e) {
    console.error(e);
    miniCases = [];
    miniCasesLoadedOnce = true;
    renderMiniCases();
  }
}

async function saveMiniCases() {
  syncMiniCasesFromDOM();

  if (!Array.isArray(miniCases)) miniCases = [];

  // delta usageCount para mini (si quieres contarlo también)
  // Nota: si NO quieres que mini incremente usageCount, comenta estas 3 líneas:
  const prev = await (async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "miniExams"));
      const data = snap.exists() ? (snap.data() || {}) : {};
      return (Array.isArray(data.cases) ? data.cases : []).map(c => c.bankCaseId).filter(Boolean);
    } catch { return []; }
  })();
  const next = miniCases.map(c => c.bankCaseId).filter(Boolean);
  await applyUsageDelta(prev, next);

  setLoadingButton(btnSaveMini, true, "Guardar mini");

  try {
    await setDoc(doc(db, "settings", "miniExams"), {
      cases: miniCases,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    alert("Mini exámenes guardados.");
  } catch (e) {
    console.error(e);
    alert("No se pudo guardar mini exámenes.");
  } finally {
    setLoadingButton(btnSaveMini, false, "Guardar mini");
  }
}

if (btnAddMiniCase) {
  btnAddMiniCase.addEventListener("click", () => {
    syncMiniCasesFromDOM();
    miniCases.push({
      bankCaseId: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
    renderMiniCases();
  });
}

if (btnSaveMini) {
  btnSaveMini.addEventListener("click", () => saveMiniCases());
}

/****************************************************
 * USUARIOS (CRUD básico)
 ****************************************************/

async function loadUsers() {
  if (!usersTableContainer) return;

  usersTableContainer.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      Cargando usuarios…
    </div>
  `;

  try {
    const snap = await getDocs(collection(db, "users"));

    if (snap.empty) {
      usersTableContainer.innerHTML = `
        <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
          No hay usuarios.
        </div>
      `;
      return;
    }

    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .sort((a, b) => (a.email || "").localeCompare(b.email || "", "es", { sensitivity: "base" }));

    usersTableContainer.innerHTML = `
      <table class="table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 6px;">Email</th>
            <th style="text-align:left;padding:8px 6px;">Nombre</th>
            <th style="text-align:left;padding:8px 6px;">Rol</th>
            <th style="text-align:left;padding:8px 6px;">Status</th>
            <th style="text-align:left;padding:8px 6px;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((u) => `
            <tr data-id="${u.id}">
              <td style="padding:8px 6px;">${u.email || u.id}</td>
              <td style="padding:8px 6px;"><input class="admin-user-name" type="text" value="${(u.name || "").toString()}" /></td>
              <td style="padding:8px 6px;">
                <select class="admin-user-role">
                  <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
                  <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
                </select>
              </td>
              <td style="padding:8px 6px;">
                <select class="admin-user-status">
                  <option value="active" ${u.status === "active" ? "selected" : ""}>active</option>
                  <option value="inactive" ${u.status === "inactive" ? "selected" : ""}>inactive</option>
                </select>
              </td>
              <td style="padding:8px 6px;display:flex;gap:8px;">
                <button class="btn btn-sm btn-secondary admin-user-save">Guardar</button>
                <button class="btn btn-sm btn-secondary admin-user-delete">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    usersTableContainer.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.dataset.id;
      const nameEl = tr.querySelector(".admin-user-name");
      const roleEl = tr.querySelector(".admin-user-role");
      const statusEl = tr.querySelector(".admin-user-status");
      const btnSave = tr.querySelector(".admin-user-save");
      const btnDel = tr.querySelector(".admin-user-delete");

      btnSave.addEventListener("click", async () => {
        btnSave.disabled = true;
        btnSave.textContent = "Guardando…";
        try {
          await updateDoc(doc(db, "users", id), {
            name: (nameEl.value || "").trim(),
            role: roleEl.value,
            status: statusEl.value,
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.error(e);
          alert("No se pudo guardar el usuario.");
        } finally {
          btnSave.disabled = false;
          btnSave.textContent = "Guardar";
        }
      });

      btnDel.addEventListener("click", async () => {
        const ok = window.confirm("¿Eliminar usuario? (Solo borra su doc en users)");
        if (!ok) return;
        try {
          await deleteDoc(doc(db, "users", id));
          loadUsers();
        } catch (e) {
          console.error(e);
          alert("No se pudo eliminar.");
        }
      });
    });
  } catch (e) {
    console.error(e);
    usersTableContainer.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#fecaca;">
        Error cargando usuarios. Revisa consola.
      </div>
    `;
  }
}

if (btnCreateUser) {
  btnCreateUser.addEventListener("click", async () => {
    const name = (newUserNameInput?.value || "").trim();
    const email = (newUserEmailInput?.value || "").trim();
    const role = newUserRoleSelect?.value || "user";
    const status = newUserStatusSelect?.value || "active";
    const expiry = (newUserExpiryInput?.value || "").trim();

    if (!email) {
      alert("Email requerido.");
      return;
    }

    // Nota: crear usuario de Auth NO se puede desde frontend sin Admin SDK.
    // Aquí solo creamos/actualizamos el doc en 'users' para roles/status.
    try {
      await setDoc(doc(db, "users", email), {
        email,
        name,
        role,
        status,
        expiry: expiry || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert("Usuario guardado en Firestore (users).");
      loadUsers();
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el usuario.");
    }
  });
}

/****************************************************
 * ANALYTICS (básicos)
 ****************************************************/

async function loadAnalyticsSummary() {
  if (!analyticsSummaryBox || !analyticsUsersBox) return;

  analyticsSummaryBox.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">Cargando…</div>
  `;
  analyticsUsersBox.innerHTML = "";

  try {
    const [secSnap, exSnap, qSnap, uSnap] = await Promise.all([
      getDocs(collection(db, "sections")),
      getDocs(collection(db, "exams")),
      getDocs(collection(db, "questions")),
      getDocs(collection(db, "users")),
    ]);

    const totalSections = secSnap.size;
    const totalExams = exSnap.size;
    const totalQuestionsDocs = qSnap.size;

    // banco vs casos de examen
    let bankCount = 0;
    let examCasesCount = 0;
    qSnap.forEach((d) => {
      const data = d.data() || {};
      if (isBankCaseDoc(data)) bankCount++;
      else examCasesCount++;
    });

    analyticsSummaryBox.innerHTML = `
      <div class="card" style="padding:12px 14px;">
        <div style="font-weight:700;">Resumen</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#e5e7eb;">
          Secciones: <b>${totalSections}</b><br/>
          Exámenes: <b>${totalExams}</b><br/>
          Docs en questions: <b>${totalQuestionsDocs}</b><br/>
          Casos en banco (sin examId): <b>${bankCount}</b><br/>
          Casos dentro de exámenes: <b>${examCasesCount}</b>
        </div>
      </div>
    `;

    const users = uSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    analyticsUsersBox.innerHTML = `
      <div class="card" style="padding:12px 14px;">
        <div style="font-weight:700;">Usuarios</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#e5e7eb;">
          Total: <b>${users.length}</b><br/>
          Admin: <b>${users.filter(u => u.role === "admin").length}</b><br/>
          User: <b>${users.filter(u => u.role !== "admin").length}</b><br/>
          Active: <b>${users.filter(u => u.status === "active").length}</b><br/>
          Inactive: <b>${users.filter(u => u.status === "inactive").length}</b>
        </div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    analyticsSummaryBox.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#fecaca;">Error cargando analytics.</div>
    `;
  }
}

/****************************************************
 * LANDING / SETTINGS
 ****************************************************/

async function loadLandingSettings() {
  try {
    const ref = doc(db, "settings", "landing");
    const snap = await getDoc(ref);

    const data = snap.exists() ? (snap.data() || {}) : {};

    if (landingTextArea) landingTextArea.value = (data.text || "").toString();
    if (monthlyLabelInput) monthlyLabelInput.value = (data.monthlyLabel || "").toString();
    if (monthlyPriceInput) monthlyPriceInput.value = (data.monthlyPrice || "").toString();
    if (enarmLabelInput) enarmLabelInput.value = (data.enarmLabel || "").toString();
    if (enarmPriceInput) enarmPriceInput.value = (data.enarmPrice || "").toString();
    if (whatsappPhoneInput) whatsappPhoneInput.value = (data.whatsappPhone || "").toString();

    // social
    if (landingInstagramInput) landingInstagramInput.value = (data.instagram || "").toString();
    if (landingWhatsappLinkInput) landingWhatsappLinkInput.value = (data.whatsappLink || "").toString();
    if (landingTiktokInput) landingTiktokInput.value = (data.tiktok || "").toString();
    if (landingTelegramInput) landingTelegramInput.value = (data.telegram || "").toString();
  } catch (e) {
    console.error(e);
  }
}

function loadSocialLinksIntoLanding() {
  // ya se carga en loadLandingSettings; esta función se conserva por compatibilidad
  return;
}

if (btnSaveLanding) {
  btnSaveLanding.addEventListener("click", async () => {
    setLoadingButton(btnSaveLanding, true, "Guardar");

    try {
      await setDoc(doc(db, "settings", "landing"), {
        text: (landingTextArea?.value || "").toString(),
        monthlyLabel: (monthlyLabelInput?.value || "").toString(),
        monthlyPrice: (monthlyPriceInput?.value || "").toString(),
        enarmLabel: (enarmLabelInput?.value || "").toString(),
        enarmPrice: (enarmPriceInput?.value || "").toString(),
        whatsappPhone: (whatsappPhoneInput?.value || "").toString(),

        instagram: (landingInstagramInput?.value || "").toString(),
        whatsappLink: (landingWhatsappLinkInput?.value || "").toString(),
        tiktok: (landingTiktokInput?.value || "").toString(),
        telegram: (landingTelegramInput?.value || "").toString(),

        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert("Configuración guardada.");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la configuración.");
    } finally {
      setLoadingButton(btnSaveLanding, false, "Guardar");
    }
  });
}

/****************************************************
 * ICONOS SOCIALES (sidebar/footer)
 ****************************************************/
adminSocialIcons.forEach((icon) => {
  icon.addEventListener("click", async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "landing"));
      const data = snap.exists() ? (snap.data() || {}) : {};
      const type = icon.dataset.type;

      const link =
        type === "instagram" ? data.instagram :
        type === "whatsapp" ? (data.whatsappLink || data.whatsappPhone) :
        type === "tiktok" ? data.tiktok :
        type === "telegram" ? data.telegram :
        null;

      if (link) window.open(link, "_blank");
    } catch (e) {
      console.error(e);
    }
  });
});

/****************************************************
 * ✅ IMPORTANTE: carga inicial del banco para buscadores
 * (Ya se llama en onAuthStateChanged y al abrir examen/mini)
 ****************************************************/

console.log("admin.js cargado correctamente (banco editable + bloqueo duplicados + usageCount delta).");
