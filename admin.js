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
 * 1) Banco de preguntas (panel bank): preguntas editables tipo examen (no JSON).
 * 2) Buscador "Agregar casos desde banco" en EXÁMENES y MINI:
 *    - Busca en "questions" (solo casos banco: sin examId)
 *    - Muestra topic + usageCount
 *    - BLOQUEA duplicados dentro del mismo examen/mini (persistente con bankCaseId)
 * 3) usageCount robusto:
 *    - Ajuste por delta al guardar examen, borrar examen, guardar mini bank
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
  documentId,
  increment,} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
const btnNavImportExport = document.getElementById("admin-btn-nav-import-export");
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

// ==================== GENERADOR AUTOMÁTICO (detalle de examen) ====================
const autoGenTopicsInput = document.getElementById("admin-auto-gen-topics");
const autoGenTargetsWrap = document.getElementById("admin-auto-gen-targets");
const autoGenBtnAddTarget = document.getElementById("admin-auto-gen-add-target");
const autoGenBtnGenerate = document.getElementById("admin-auto-gen-generate");
const autoGenSummary = document.getElementById("admin-auto-gen-summary");

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

// Cache banco para buscadores (carga incremental para escalar a 10,000 casos)
let bankCasesCache = [];
let bankCasesById = new Map();
let bankCasesLoadedOnce = false;     // al menos 1 lote cargado
let bankCasesAllLoaded = false;      // ya se escaneó todo (o se alcanzó el tope)
let bankCasesLastDoc = null;         // cursor de paginación (questions)
let bankCasesScanCount = 0;          // cuántos docs de questions se han escaneado (incluye no-banco)
let bankCasesOrderMode = "createdAt"; // "createdAt" | "name"
let bankCasesLoading = false;

let bankSearchDebounceTimer = null;
let miniBankSearchDebounceTimer = null;

let bankSearchRunToken = 0;
let miniBankSearchRunToken = 0;

const BANK_SEARCH_BATCH_SIZE = 500;      // lote de escaneo Firestore
const BANK_SEARCH_MAX_RESULTS = 50;      // resultados máximos a mostrar
const BANK_SEARCH_MAX_BANK_CASES = 10000; // tope de casos banco a cachear


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

  // refrescar cache de buscadores para que usageCount se vea actualizado
  resetBankCasesSearchCache();
}


function resetBankCasesSearchCache() {
  bankCasesCache = [];
  bankCasesById = new Map();
  bankCasesLoadedOnce = false;
  bankCasesAllLoaded = false;
  bankCasesLastDoc = null;
  bankCasesScanCount = 0;
  bankCasesOrderMode = "createdAt";
  bankCasesLoading = false;
}

/****************************************************
 * BUSCADOR DE BANCO PARA AGREGAR CASOS A EXAMEN Y MINI
 * ✅ usa "questions" (solo casos banco: sin examId)
 ****************************************************/


async function loadMoreBankCasesFromFirestore(batchSize = BANK_SEARCH_BATCH_SIZE) {
  if (bankCasesLoading || bankCasesAllLoaded) return { added: [], scanned: 0 };

  // Tope duro (petición del usuario: hasta ~10,000 casos banco)
  if (bankCasesCache.length >= BANK_SEARCH_MAX_BANK_CASES) {
    bankCasesAllLoaded = true;
    return { added: [], scanned: 0 };
  }

  bankCasesLoading = true;

  try {
    let qBase;

    // Preferimos orden por createdAt; si falla, caemos a documentId
    try {
      qBase = query(
        collection(db, "questions"),
        orderBy("createdAt", "desc"),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        limit(batchSize)
      );
      bankCasesOrderMode = "createdAt";
    } catch (e1) {
      qBase = query(
        collection(db, "questions"),
        orderBy(documentId()),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        limit(batchSize)
      );
      bankCasesOrderMode = "name";
    }

    const snap = await getDocs(qBase);

    if (!snap || !snap.docs || !snap.docs.length) {
      bankCasesAllLoaded = true;
      return { added: [], scanned: 0 };
    }

    bankCasesLastDoc = snap.docs[snap.docs.length - 1];
    bankCasesScanCount += snap.size;

    // Convertir y filtrar solo casos "banco" (= sin examId)
    const added = [];

    for (const d of snap.docs) {
      if (!d || !d.id) continue;
      if (bankCasesById.has(d.id)) continue;

      const data = d.data() || {};
      const withId = { id: d.id, ...data };

      if (!isBankCaseDoc(withId)) continue;

      const questionsArr = Array.isArray(withId.questions) ? withId.questions : [];
      const topicTxt = (withId.topic || "").toString();

      const entry = {
        ...withId,
        questions: questionsArr,
        topic: topicTxt,
        _normCase: normalizeText(withId.caseText || ""),
        _normTopic: normalizeText(topicTxt),
        _normSpec: normalizeText(withId.specialty || ""),
        _normQs: normalizeText(questionsArr.map((q) => q.questionText || "").join(" ")),
      };

      bankCasesById.set(entry.id, entry);
      bankCasesCache.push(entry);
      added.push(entry);

      if (bankCasesCache.length >= BANK_SEARCH_MAX_BANK_CASES) {
        bankCasesAllLoaded = true;
        break;
      }
    }

    // Si el lote fue menor al solicitado, probablemente llegamos al final
    if (snap.size < batchSize) bankCasesAllLoaded = true;

    bankCasesLoadedOnce = true;
    return { added, scanned: snap.size };
  } catch (err) {
    console.error("Error cargando banco incremental:", err);
    // degradar a "allLoaded" para que no se quede en loop
    bankCasesAllLoaded = true;
    return { added: [], scanned: 0 };
  } finally {
    bankCasesLoading = false;
  }
}

async function loadBankCasesIfNeeded() {
  // Carga mínima inicial para mostrar que el banco está disponible.
  if (bankCasesLoadedOnce) return;

  if (!bankSearchResults && !miniBankSearchResults) return;

  const target = bankSearchResults || miniBankSearchResults;

  target.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      Cargando banco de casos (modo incremental)…
    </div>
  `;

  await loadMoreBankCasesFromFirestore(BANK_SEARCH_BATCH_SIZE);

  // Mensaje inicial
  const msg = bankCasesCache.length
    ? `Banco listo. Escribe para buscar. (Cargados: ${bankCasesCache.length} · Escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · seguirá cargando según tu búsqueda"})`
    : "No se encontraron casos en el banco.";

  if (bankSearchResults) renderEmptyMessage(bankSearchResults, msg);
  if (miniBankSearchResults) renderEmptyMessage(miniBankSearchResults, msg);
}

function tokenizeBankSearch(rawQuery) {
  const q = normalizeText(rawQuery);
  if (!q) return [];
  const tokens = q.split(" ").filter((t) => t.length >= 2);
  return tokens.slice(0, 6); // tope para evitar queries demasiado costosas
}

function bankCaseMatchesTokens(c, tokens) {
  if (!tokens || !tokens.length) return false;
  const haystack = `${c._normTopic} ${c._normSpec} ${c._normCase} ${c._normQs}`;
  return tokens.every((t) => haystack.includes(t));
}

function searchBankCases(rawQuery, maxResults = BANK_SEARCH_MAX_RESULTS) {
  const tokens = tokenizeBankSearch(rawQuery);
  if (!tokens.length) return [];

  const results = [];
  for (const c of bankCasesCache) {
    if (bankCaseMatchesTokens(c, tokens)) results.push(c);
    if (results.length >= maxResults) break;
  }
  return results;
}

async function searchBankCasesAsync(rawQuery, opts = {}) {
  const maxResults = Number(opts.maxResults || BANK_SEARCH_MAX_RESULTS);
  const batchSize = Number(opts.batchSize || BANK_SEARCH_BATCH_SIZE);
  const cancelFn = typeof opts.isCancelled === "function" ? opts.isCancelled : () => false;

  const tokens = tokenizeBankSearch(rawQuery);
  if (!tokens.length) {
    return {
      results: [],
      meta: {
        tokens: 0,
        cached: bankCasesCache.length,
        scanned: bankCasesScanCount,
        allLoaded: bankCasesAllLoaded,
      },
    };
  }

  // 1) buscar en cache actual
  let results = [];
  for (const c of bankCasesCache) {
    if (cancelFn()) return { results: [], meta: { cancelled: true } };
    if (bankCaseMatchesTokens(c, tokens)) results.push(c);
    if (results.length >= maxResults) break;
  }

  // 2) si no hay suficientes resultados, seguir cargando lotes hasta:
  //    a) llegar al tope de resultados, o b) escanear todo (para ser "correcto")
  while (!bankCasesAllLoaded && results.length < maxResults) {
    if (cancelFn()) return { results: [], meta: { cancelled: true } };

    const { added } = await loadMoreBankCasesFromFirestore(batchSize);
    if (cancelFn()) return { results: [], meta: { cancelled: true } };

    if (!added || !added.length) {
      // Sin nuevos -> fin
      break;
    }

    for (const c of added) {
      if (bankCaseMatchesTokens(c, tokens)) results.push(c);
      if (results.length >= maxResults) break;
    }
  }

  // Dedup + cap
  const seen = new Set();
  results = results.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  results = results.slice(0, maxResults);

  return {
    results,
    meta: {
      tokens: tokens.length,
      cached: bankCasesCache.length,
      scanned: bankCasesScanCount,
      allLoaded: bankCasesAllLoaded,
      capped: results.length >= maxResults && !bankCasesAllLoaded,
    },
  };
}
function renderBankSearchResults(results, queryText, meta = null) {
  if (!bankSearchResults) return;

  if (!queryText) {
    const baseMsg = bankCasesLoadedOnce
      ? `Banco listo. Escribe un tema arriba para buscar (cargados: ${bankCasesCache.length}).`
      : "Escribe un tema para buscar.";

    const stats = meta
      ? ` Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " (cargando según búsqueda)"}`
      : "";

    renderEmptyMessage(bankSearchResults, baseMsg + stats);
    return;
  }

  if (!results.length) {
    renderEmptyMessage(
      bankSearchResults,
      `Sin resultados para "${queryText}". Prueba con otro término.`
    );
    return;
  }

  // ✅ set de ya agregados en este examen (por bankCaseId = id del doc banco)
  const usedSet = getCurrentExamBankCaseIdsSet();

  const statsBar = meta ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af;">
      Coincidencias: ${results.length}${meta.capped ? " (mostrando primeras coincidencias; refina búsqueda)" : ""} · Cargados: ${meta.cached ?? bankCasesCache.length} · Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " · buscando…"}
    </div>
  ` : "";

  const html = statsBar + results
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
        const found = bankCasesById.get(id) || bankCasesCache.find((x) => x.id === id);
        if (!found) return;

        if (!currentExamId) {
          alert("Primero abre un examen.");
          return;
        }

        // ✅ bloqueo duro (por si el UI no alcanzó a refrescar)
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
      const trimmed = raw.trim();
      const myToken = ++bankSearchRunToken;

      if (!trimmed) {
        renderBankSearchResults([], "", { scanned: bankCasesScanCount, cached: bankCasesCache.length, allLoaded: bankCasesAllLoaded });
        return;
      }

      // feedback inmediato
      renderEmptyMessage(
        bankSearchResults,
        `Buscando "${escapeHtml(trimmed)}"… (cargados: ${bankCasesCache.length} · escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · buscando en todo el banco"})`
      );

      const { results, meta } = await searchBankCasesAsync(trimmed, {
        maxResults: BANK_SEARCH_MAX_RESULTS,
        batchSize: BANK_SEARCH_BATCH_SIZE,
        isCancelled: () => myToken !== bankSearchRunToken,
      });

      if (myToken !== bankSearchRunToken) return;

      renderBankSearchResults(results, trimmed, meta);
    }, 320);
  });
}

function resetBankSearchUI() {
  if (bankSearchInput) bankSearchInput.value = "";
  if (bankSearchResults) bankSearchResults.innerHTML = "";
}

/****************************************************
 * ✅ BUSCADOR DE BANCO PARA MINI EXÁMENES (mismo banco cache)
 ****************************************************/

function renderMiniBankSearchResults(results, queryText, meta = null) {
  if (!miniBankSearchResults) return;

  if (!queryText) {
    const baseMsg = bankCasesLoadedOnce
      ? `Banco listo. Escribe para buscar (cargados: ${bankCasesCache.length}).`
      : "Escribe para buscar.";

    const stats = meta
      ? ` Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " (cargando según búsqueda)"}`
      : "";

    renderEmptyMessage(miniBankSearchResults, baseMsg + stats);
    return;
  }

  if (!results.length) {
    renderEmptyMessage(
      miniBankSearchResults,
      `Sin resultados para "${queryText}". Prueba con otro término.`
    );
    return;
  }

  const usedSet = getMiniBankCaseIdsSet();

  const statsBar = meta ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af;">
      Coincidencias: ${results.length}${meta.capped ? " (mostrando primeras coincidencias; refina búsqueda)" : ""} · Cargados: ${meta.cached ?? bankCasesCache.length} · Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " · buscando…"}
    </div>
  ` : "";

  const html = statsBar + results
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
        const found = bankCasesById.get(id) || bankCasesCache.find((x) => x.id === id);
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
      const trimmed = raw.trim();
      const myToken = ++miniBankSearchRunToken;

      if (!trimmed) {
        renderMiniBankSearchResults([], "", { scanned: bankCasesScanCount, cached: bankCasesCache.length, allLoaded: bankCasesAllLoaded });
        return;
      }

      renderEmptyMessage(
        miniBankSearchResults,
        `Buscando "${escapeHtml(trimmed)}"… (cargados: ${bankCasesCache.length} · escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · buscando en todo el banco"})`
      );

      const { results, meta } = await searchBankCasesAsync(trimmed, {
        maxResults: BANK_SEARCH_MAX_RESULTS,
        batchSize: BANK_SEARCH_BATCH_SIZE,
        isCancelled: () => myToken !== miniBankSearchRunToken,
      });

      if (myToken !== miniBankSearchRunToken) return;

      renderMiniBankSearchResults(results, trimmed, meta);
    }, 320);
  });
}

function resetMiniBankSearchUI() {
  if (miniBankSearchInput) miniBankSearchInput.value = "";
  if (miniBankSearchResults) miniBankSearchResults.innerHTML = "";
}


/****************************************************
 * ✅ GENERADOR AUTOMÁTICO DE EXÁMENES (POR TEMAS + CUPOS POR ESPECIALIDAD/SUBTIPO)
 * - No altera el flujo existente: solo rellena currentExamCases y renderiza.
 * - Prioriza casos con menor usageCount.
 ****************************************************/

function buildAutoGenTargetRow(initial = {}) {
  if (!autoGenTargetsWrap) return null;

  const row = document.createElement("div");
  row.className = "auto-gen-row";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1.4fr 1.2fr 0.8fr auto";
  row.style.gap = "8px";
  row.style.alignItems = "end";
  row.style.marginTop = "10px";

  const specialtyValue = initial.specialty || Object.keys(SPECIALTIES)[0] || "";
  const subtypeValue = initial.subtype || "urgencias";
  const countValue = typeof initial.count === "number" ? initial.count : 0;

  row.innerHTML = `
    <label class="field" style="margin:0;">
      <span>Especialidad</span>
      <select class="auto-gen-specialty">
        ${Object.entries(SPECIALTIES)
          .map(([k, label]) => `<option value="${k}" ${k === specialtyValue ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </label>

    <label class="field" style="margin:0;">
      <span>Subtipo</span>
      <select class="auto-gen-subtype">
        ${Object.entries(SUBTYPES)
          .map(([k, label]) => `<option value="${k}" ${k === subtypeValue ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </label>

    <label class="field" style="margin:0;">
      <span># preguntas</span>
      <input class="auto-gen-count" type="number" min="0" step="1" value="${countValue}" />
    </label>

    <button type="button" class="btn btn-outline btn-sm auto-gen-remove" style="height:40px;">
      Quitar
    </button>
  `;

  row.querySelector(".auto-gen-remove")?.addEventListener("click", () => {
    row.remove();
    renderAutoGenSummary();
  });

  row.querySelectorAll("select,input").forEach((el) => {
    el.addEventListener("change", renderAutoGenSummary);
    el.addEventListener("input", renderAutoGenSummary);
  });

  return row;
}

function getAutoGenTargetsFromUI() {
  if (!autoGenTargetsWrap) return [];
  const rows = autoGenTargetsWrap.querySelectorAll(".auto-gen-row");
  const targets = [];
  rows.forEach((r) => {
    const specialty = r.querySelector(".auto-gen-specialty")?.value || "";
    const subtype = r.querySelector(".auto-gen-subtype")?.value || "";
    const count = Number(r.querySelector(".auto-gen-count")?.value || 0);

    if (!specialty || !subtype) return;
    if (!Number.isFinite(count) || count <= 0) return;

    targets.push({ specialty, subtype, count });
  });
  return targets;
}

function parseAutoGenTopicQueries(raw) {
  const txt = (raw || "").toString().trim();
  if (!txt) return [];
  const lines = txt
    .split(/\n|\r/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Cada línea es un query; si hay una sola línea con comas, también se permite
  if (lines.length === 1 && lines[0].includes(",")) {
    return lines[0]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((q) => tokenizeBankSearch(q));
  }

  return lines.map((q) => tokenizeBankSearch(q));
}

function bankCaseMatchesAnyTopicQuery(bankCase, topicQueriesTokens) {
  if (!topicQueriesTokens || !topicQueriesTokens.length) return true;
  return topicQueriesTokens.some((tokens) => tokens.length && bankCaseMatchesTokens(bankCase, tokens));
}

function renderAutoGenSummary() {
  if (!autoGenSummary) return;

  const targets = getAutoGenTargetsFromUI();
  const total = targets.reduce((acc, t) => acc + t.count, 0);

  if (!targets.length) {
    autoGenSummary.innerHTML = `
      <div style="font-size:12px;color:#9ca3af;">
        Agrega al menos un objetivo (especialidad + subtipo + # preguntas).
      </div>
    `;
    return;
  }

  // Agrupar por especialidad
  const bySpec = {};
  targets.forEach((t) => {
    if (!bySpec[t.specialty]) bySpec[t.specialty] = [];
    bySpec[t.specialty].push(t);
  });

  const lines = Object.entries(bySpec).map(([spec, items]) => {
    const specLabel = getSpecialtyLabel(spec);
    const parts = items
      .map((it) => `${SUBTYPES[it.subtype] || it.subtype}: ${it.count}`)
      .join(" · ");
    return `<div style="margin-top:6px;"><b>${escapeHtml(specLabel || spec)}</b>: ${escapeHtml(parts)}</div>`;
  });

  autoGenSummary.innerHTML = `
    <div style="font-size:12px;color:#9ca3af;">
      Total objetivo: <b style="color:#e5e7eb;">${total}</b> preguntas
      ${lines.join("")}
    </div>
  `;
}

async function ensureBankLoadedForGenerator(minCandidates = 1) {
  // Asegura que haya cache inicial
  await loadBankCasesIfNeeded();

  // Si ya hay suficientes en cache o ya se cargó todo, OK.
  if (bankCasesAllLoaded || bankCasesCache.length >= minCandidates) return;

  // Degradar: cargar unos lotes extra.
  let guard = 0;
  while (!bankCasesAllLoaded && bankCasesCache.length < minCandidates && guard < 25) {
    guard++;
    await loadMoreBankCasesFromFirestore(BANK_SEARCH_BATCH_SIZE);
  }
}

function computeSubtypeCountsForCaseQuestions(questionsArr) {
  const counts = { salud_publica: 0, medicina_familiar: 0, urgencias: 0 };
  (questionsArr || []).forEach((q) => {
    const st = (q && q.subtype) ? q.subtype : "salud_publica";
    if (counts[st] === undefined) counts[st] = 0;
    counts[st] += 1;
  });
  return counts;
}

function cloneBankCaseForExam(bankCase, keptIdxs) {
  const allQs = Array.isArray(bankCase.questions) ? bankCase.questions : [];
  const idxs = Array.isArray(keptIdxs) && keptIdxs.length ? keptIdxs : allQs.map((_, i) => i);

  const pickedQs = idxs.map((i) => allQs[i]).filter(Boolean).map((q) => ({
    questionText: q.questionText || "",
    optionA: q.optionA || "",
    optionB: q.optionB || "",
    optionC: q.optionC || "",
    optionD: q.optionD || "",
    correctOption: q.correctOption || "",
    justification: q.justification || "",
    subtype: q.subtype || "salud_publica",
    difficulty: q.difficulty || "media",
  }));

  // Seguridad: mínimo 2 preguntas por caso (requisito del usuario)
  if (pickedQs.length < 2) {
    // fallback: no clonar
    return null;
  }

  return {
    bankCaseId: bankCase.id,
    caseText: bankCase.caseText || "",
    specialty: bankCase.specialty || "",
    topic: (bankCase.topic || "").toString(),
    questions: pickedQs,
  };
}

function buildRemainingMap(targets) {
  const remaining = new Map();
  targets.forEach((t) => {
    const key = `${t.specialty}|${t.subtype}`;
    remaining.set(key, (remaining.get(key) || 0) + Number(t.count || 0));
  });
  return remaining;
}

function remainingTotal(remainingMap) {
  let total = 0;
  for (const v of remainingMap.values()) total += v;
  return total;
}

function remainingForSpecialty(remainingMap, specialty) {
  let total = 0;
  for (const [k, v] of remainingMap.entries()) {
    if (k.startsWith(`${specialty}|`)) total += v;
  }
  return total;
}

function canFitVariant(remainingMap, specialty, contribCounts) {
  for (const [subtype, c] of Object.entries(contribCounts)) {
    const need = remainingMap.get(`${specialty}|${subtype}`) || 0;
    if (c > need) return false;
  }
  return true;
}

function applyVariant(remainingMap, specialty, contribCounts) {
  for (const [subtype, c] of Object.entries(contribCounts)) {
    const key = `${specialty}|${subtype}`;
    const need = remainingMap.get(key) || 0;
    remainingMap.set(key, Math.max(0, need - c));
  }
}

function pickBestVariantForCase(bankCase, remainingMap) {
  const qs = Array.isArray(bankCase.questions) ? bankCase.questions : [];
  if (qs.length < 2) return null;

  const variants = [];
  if (qs.length === 2) {
    variants.push([0, 1]);
  } else if (qs.length >= 3) {
    variants.push([0, 1, 2], [0, 1], [0, 2], [1, 2]);
  }

  const spec = bankCase.specialty || "";
  if (!spec) return null;

  let best = null;

  for (const idxs of variants) {
    const pickedQs = idxs.map((i) => qs[i]).filter(Boolean);
    const contrib = computeSubtypeCountsForCaseQuestions(pickedQs);

    // Solo evaluamos variantes que NO se pasan del cupo solicitado.
    if (!canFitVariant(remainingMap, spec, contrib)) continue;

    // score = # preguntas que realmente cubren necesidades (aquí será = total variante)
    const score = idxs.length;

    if (!best || score > best.score) {
      best = { idxs, contrib, score };
    }
  }

  return best;
}

async function runAutoGenerator() {
  if (!currentExamId) {
    alert("Primero abre un examen.");
    return;
  }

  const targets = getAutoGenTargetsFromUI();
  if (!targets.length) {
    alert("Define al menos un objetivo (especialidad + subtipo + # preguntas).");
    return;
  }

  const topicQueriesTokens = parseAutoGenTopicQueries(autoGenTopicsInput?.value || "");

  // total objetivo
  const remainingMap = buildRemainingMap(targets);
  const totalTarget = remainingTotal(remainingMap);
  if (totalTarget <= 0) {
    alert("El total objetivo debe ser mayor a 0.");
    return;
  }

  

  // El generador trabaja por casos clínicos (2–3 preguntas). Con total objetivo < 2 no hay forma de cumplir.
  if (totalTarget < 2) {
    alert("Con un total objetivo menor a 2 no se puede generar, porque cada caso clínico aporta 2–3 preguntas. Sube el cupo o agrega otro subtipo para completar 2+ preguntas.");
    return;
  }

  // Si alguna especialidad quedó con 1 pregunta total, también es imposible (cada caso tiene 2+ preguntas de esa especialidad).
  const bySpecTotals = {};
  targets.forEach((t) => {
    bySpecTotals[t.specialty] = (bySpecTotals[t.specialty] || 0) + Number(t.count || 0);
  });
  const impossibleSpecs = Object.entries(bySpecTotals).filter(([_, n]) => n === 1);
  if (impossibleSpecs.length) {
    const label = impossibleSpecs.map(([s]) => getSpecialtyLabel(s) || s).join(", ");
    alert("No se puede generar porque pediste 1 pregunta total en: " + label + ". Cada caso clínico tiene 2–3 preguntas. Ajusta el cupo por esa especialidad (2+).");
    return;
  }
// Cargar banco suficiente (best-effort)
  const hasTopics = Array.isArray(topicQueriesTokens) && topicQueriesTokens.length > 0;
  const desiredLoad = hasTopics ? Math.max(800, totalTarget * 12) : Math.max(400, totalTarget * 6);
  await ensureBankLoadedForGenerator(Math.min(desiredLoad, 2000));
// Filtrar candidatos
  const allowedSpecs = new Set(targets.map((t) => t.specialty));

  const candidates = bankCasesCache
    .filter((c) => c && c.id && allowedSpecs.has(c.specialty))
    .filter((c) => bankCaseMatchesAnyTopicQuery(c, topicQueriesTokens))
    .slice(); // copy

  // Orden: usageCount asc (prioridad 0 usos), luego por createdAt desc
  candidates.sort((a, b) => {
    const ua = typeof a.usageCount === "number" ? a.usageCount : 0;
    const ub = typeof b.usageCount === "number" ? b.usageCount : 0;
    if (ua !== ub) return ua - ub;

    const sa = a.createdAt?.seconds || 0;
    const sb = b.createdAt?.seconds || 0;
    return sb - sa;
  });

  // Generar selección
  const selected = [];
  const selectedIds = new Set();

  // Para evitar duplicados con lo ya cargado en el examen actual
  syncCurrentExamCasesFromDOM();
  const alreadyInExam = getCurrentExamBankCaseIdsSet();
  for (const id of alreadyInExam) selectedIds.add(id);

  // Greedy por especialidad: recorre candidatos y agrega si encaja
  for (const c of candidates) {
    if (remainingTotal(remainingMap) <= 0) break;
    if (!c || !c.id) continue;
    if (selectedIds.has(c.id)) continue;

    // Si para la especialidad ya no falta nada, saltar
    if (remainingForSpecialty(remainingMap, c.specialty) <= 0) continue;

    const best = pickBestVariantForCase(c, remainingMap);
    if (!best) continue;

    const cloned = cloneBankCaseForExam(c, best.idxs);
    if (!cloned) continue;

    // Aplicar contribución
    applyVariant(remainingMap, c.specialty, best.contrib);

    selected.push(cloned);
    selectedIds.add(c.id);
  }

  const remainingAfter = remainingTotal(remainingMap);

  if (!selected.length) {
    const specLabel = targets
      .map((t) => `${getSpecialtyLabel(t.specialty) || t.specialty} / ${SUBTYPES[t.subtype] || t.subtype}: ${t.count}`)
      .join(" | ");
    const topicTxt = (autoGenTopicsInput?.value || "").trim();
    alert(
      "No se encontraron casos que cumplan tus criterios.\n\n" +
        "Objetivos: " + specLabel + (topicTxt ? ("\nTemas: " + topicTxt) : "") + "\n\n" +
        "Sugerencias: (1) aumenta el cupo total (cada caso aporta 2–3 preguntas), (2) agrega cupos para más subtipos (los casos suelen mezclar subtipos), (3) usa temas menos restrictivos o déjalos vacío para probar disponibilidad."
    );
    return;
  }

  if (remainingAfter > 0) {
    alert(
      "No fue posible completar el examen con los cupos solicitados usando los filtros actuales (temas/especialidades/subtipos).\n" +
        "Se generó una parte, pero faltan " + remainingAfter + " preguntas por completar.\n" +
        "Ajusta los cupos o usa temas menos restrictivos."
    );
  }
// Reemplazar casos actuales por los generados (sin borrar el examen hasta que guardes)
  currentExamCases = selected;
  renderExamCases();

  // Summary final
  if (autoGenSummary) {
    const generatedTotals = {};
    selected.forEach((cc) => {
      const spec = cc.specialty || "";
      if (!generatedTotals[spec]) generatedTotals[spec] = { salud_publica: 0, medicina_familiar: 0, urgencias: 0 };
      (cc.questions || []).forEach((q) => {
        const st = q.subtype || "salud_publica";
        if (generatedTotals[spec][st] === undefined) generatedTotals[spec][st] = 0;
        generatedTotals[spec][st] += 1;
      });
    });

    const lines = Object.entries(generatedTotals).map(([spec, counts]) => {
      const specLabel = getSpecialtyLabel(spec);
      const parts = Object.entries(counts)
        .filter(([_, v]) => v > 0)
        .map(([st, v]) => `${SUBTYPES[st] || st}: ${v}`)
        .join(" · ");
      return `<div style="margin-top:6px;"><b>${escapeHtml(specLabel || spec)}</b>: ${escapeHtml(parts || "—")}</div>`;
    });

    autoGenSummary.innerHTML = `
      <div style="font-size:12px;color:#9ca3af;">
        Generado: <b style="color:#e5e7eb;">${selected.reduce((acc, c) => acc + (c.questions?.length || 0), 0)}</b> preguntas en
        <b style="color:#e5e7eb;">${selected.length}</b> casos.
        ${remainingAfter > 0 ? `<div style="margin-top:6px;color:#fca5a5;">Pendiente por completar: ${remainingAfter} preguntas.</div>` : ""}
        ${lines.join("")}
        <div style="margin-top:8px;">
          Nota: el uso (usageCount) se ajusta hasta que guardes el examen.
        </div>
      </div>
    `;
  }
}

function initAutoGeneratorUI() {
  if (!autoGenTargetsWrap || !autoGenBtnAddTarget || !autoGenBtnGenerate) return;
  if (autoGenBtnGenerate.dataset.bound === "1") return;

  autoGenBtnGenerate.dataset.bound = "1";

  // Estado inicial: una fila por defecto
  if (!autoGenTargetsWrap.querySelector(".auto-gen-row")) {
    const first = buildAutoGenTargetRow({ specialty: Object.keys(SPECIALTIES)[0], subtype: "urgencias", count: 10 });
    if (first) autoGenTargetsWrap.appendChild(first);
  }

  renderAutoGenSummary();

  autoGenBtnAddTarget.addEventListener("click", () => {
    const row = buildAutoGenTargetRow({ specialty: Object.keys(SPECIALTIES)[0], subtype: "urgencias", count: 10 });
    if (row) autoGenTargetsWrap.appendChild(row);
    renderAutoGenSummary();
  });

  autoGenBtnGenerate.addEventListener("click", async () => {
    const btn = autoGenBtnGenerate;
    setLoadingButton(btn, true, "Generar");
    try {
      await runAutoGenerator();
    } catch (e) {
      console.error("Error generando examen automático:", e);
      alert("Ocurrió un error al generar el examen automático. Revisa consola.");
    } finally {
      setLoadingButton(btn, false, "Generar");
    }
  });

  autoGenTopicsInput?.addEventListener("input", () => {
    // No recalcula búsqueda todavía, solo refresca resumen
    renderAutoGenSummary();
  });
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
  initAutoGeneratorUI();

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
    btnNavImportExport,
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


if (btnNavImportExport) {
  btnNavImportExport.addEventListener("click", () => {
    // Redirige a la pantalla de Import / Export (import-exam.html)
    // Nota: no cambia estado de paneles porque salimos de la página.
    clearSidebarActive();
    btnNavImportExport.classList.add("sidebar-btn--active");
    sidebar.classList.remove("sidebar--open");
    window.location.href = "import-exam.html";
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

  await loadBankCasesIfNeeded();
}
/****************************************************
 * CONTINÚA ADMIN.JS - PARTE 2/2
 ****************************************************/

function renderExamCases() {
  if (!examCasesContainer) return;
  examCasesContainer.innerHTML = "";

  if (!currentExamCases.length) {
    currentExamCases.push(createEmptyCase());
  }

  currentExamCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card exam-case-block";
    wrapper.dataset.caseIndex = index;

    // ✅ Persistencia en DOM para sync + guardado
    wrapper.dataset.bankCaseId = caseData.bankCaseId || "";

    const specialtyValue = caseData.specialty || "";
    const topicValue = (caseData.topic || "").toString();
    const questionsArr = Array.isArray(caseData.questions)
      ? caseData.questions
      : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">
          Caso clínico ${index + 1}
        </h3>
        <button type="button" class="btn btn-sm btn-outline admin-delete-case">
          Eliminar caso clínico
        </button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-case-specialty">
          <option value="">Selecciona...</option>
          ${Object.entries(SPECIALTIES)
            .map(
              ([key, label]) =>
                `<option value="${key}" ${
                  key === specialtyValue ? "selected" : ""
                }>${label}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>Tema (topic)</span>
        <input type="text" class="admin-case-topic" value="${topicValue.replace(/"/g, "&quot;")}" placeholder="Escribe el tema..." />
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-add-question">
          + Agregar pregunta
        </button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-case-questions");

    if (!questionsArr.length) {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    } else {
      questionsArr.forEach((qData) => {
        qContainer.appendChild(renderQuestionBlock(qData));
      });
    }

    wrapper
      .querySelector(".admin-add-question")
      .addEventListener("click", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

    wrapper
      .querySelector(".admin-delete-case")
      .addEventListener("click", () => {
        const idx = parseInt(wrapper.dataset.caseIndex, 10);
        if (Number.isNaN(idx)) return;
        syncCurrentExamCasesFromDOM();
        currentExamCases.splice(idx, 1);
        renderExamCases();
      });

    examCasesContainer.appendChild(wrapper);
  });

  const bottomActions = document.createElement("div");
  bottomActions.className = "flex-row";
  bottomActions.style.justifyContent = "flex-end";
  bottomActions.style.marginTop = "16px";

  bottomActions.innerHTML = `
    <button type="button" class="btn btn-secondary" id="admin-btn-add-case-bottom">
      + Agregar caso clínico
    </button>
    <button type="button" class="btn btn-primary" id="admin-btn-save-exam-bottom">
      Guardar examen
    </button>
  `;

  examCasesContainer.appendChild(bottomActions);

  const btnAddCaseBottom = document.getElementById("admin-btn-add-case-bottom");
  const btnSaveExamBottom = document.getElementById("admin-btn-save-exam-bottom");

  if (btnAddCaseBottom) {
    btnAddCaseBottom.addEventListener("click", () => {
      if (!currentExamId) {
        alert("Primero abre un examen.");
        return;
      }
      syncCurrentExamCasesFromDOM();
      currentExamCases.push(createEmptyCase());
      renderExamCases();
    });
  }

  if (btnSaveExamBottom && btnSaveExamAll) {
    btnSaveExamBottom.addEventListener("click", () => {
      btnSaveExamAll.click();
    });
  }
}

function renderQuestionBlock(qData) {
  const {
    questionText = "",
    optionA = "",
    optionB = "",
    optionC = "",
    optionD = "",
    correctOption = "",
    justification = "",
    subtype = "salud_publica",
    difficulty = "media",
  } = qData;

  const card = document.createElement("div");
  card.className = "card-item exam-question-block";

  card.innerHTML = `
    <label class="field">
      <span>Pregunta</span>
      <textarea class="admin-q-question" rows="2">${questionText}</textarea>
    </label>

    <label class="field">
      <span>Opción A</span>
      <input type="text" class="admin-q-a" value="${optionA}" />
    </label>

    <label class="field">
      <span>Opción B</span>
      <input type="text" class="admin-q-b" value="${optionB}" />
    </label>

    <label class="field">
      <span>Opción C</span>
      <input type="text" class="admin-q-c" value="${optionC}" />
    </label>

    <label class="field">
      <span>Opción D</span>
      <input type="text" class="admin-q-d" value="${optionD}" />
    </label>

    <label class="field">
      <span>Respuesta correcta</span>
      <select class="admin-q-correct">
        <option value="">Selecciona</option>
        <option value="A" ${correctOption === "A" ? "selected" : ""}>A</option>
        <option value="B" ${correctOption === "B" ? "selected" : ""}>B</option>
        <option value="C" ${correctOption === "C" ? "selected" : ""}>C</option>
        <option value="D" ${correctOption === "D" ? "selected" : ""}>D</option>
      </select>
    </label>

    <label class="field">
      <span>Tipo de pregunta</span>
      <select class="admin-q-subtype">
        ${Object.entries(SUBTYPES)
          .map(
            ([key, label]) =>
              `<option value="${key}" ${
                key === subtype ? "selected" : ""
              }>${label}</option>`
          )
          .join("")}
      </select>
    </label>

    <label class="field">
      <span>Dificultad</span>
      <select class="admin-q-difficulty">
        ${Object.entries(DIFFICULTIES)
          .map(
            ([key, label]) =>
              `<option value="${key}" ${
                key === difficulty ? "selected" : ""
              }>${label}</option>`
          )
          .join("")}
      </select>
    </label>

    <label class="field">
      <span>Justificación</span>
      <textarea class="admin-q-justification" rows="2">${justification}</textarea>
    </label>

    <div style="text-align:right;margin-top:6px;">
      <button type="button" class="btn btn-sm btn-outline admin-delete-question">
        Eliminar pregunta
      </button>
    </div>
  `;

  card
    .querySelector(".admin-delete-question")
    .addEventListener("click", () => {
      card.remove();
    });

  return card;
}

// Botón "Volver a exámenes"
if (btnBackToExams) {
  btnBackToExams.addEventListener("click", () => {
    currentExamId = null;
    currentExamCases = [];
    if (examCasesContainer) examCasesContainer.innerHTML = "";
    hide(examDetailView);
    show(panelExams);

    resetBankSearchUI();

    if (currentSectionId) {
      loadExamsForSection(currentSectionId);
    }
  });
}

// Guardar examen (✅ con delta de usageCount y persistencia bankCaseId)
if (btnSaveExamAll) {
  btnSaveExamAll.addEventListener("click", async () => {
    if (!currentExamId) {
      alert("No hay examen seleccionado.");
      return;
    }

    const newName = examTitleInput.value.trim();
    if (!newName) {
      alert("Escribe un nombre para el examen.");
      return;
    }

    const caseBlocks = examCasesContainer.querySelectorAll(".exam-case-block");
    if (!caseBlocks.length) {
      alert("Debes agregar al menos un caso clínico.");
      return;
    }

    // ✅ Previos (para delta)
    let prevBankIds = [];
    try {
      const qPrev = query(
        collection(db, "questions"),
        where("examId", "==", currentExamId)
      );
      const prevSnap = await getDocs(qPrev);
      prevBankIds = prevSnap.docs
        .map((d) => (d.data() || {}).bankCaseId)
        .filter(Boolean);
    } catch (e) {
      console.warn("No se pudieron cargar previos para delta usageCount:", e);
    }

    const casesToSave = [];

    for (const block of caseBlocks) {
      const caseText = block.querySelector(".admin-case-text").value.trim();
      const specialty = block.querySelector(".admin-case-specialty").value;
      const topic = block.querySelector(".admin-case-topic")?.value.trim() || "";
      const bankCaseId = (block.dataset.bankCaseId || "").trim() || null;

      if (!caseText) {
        alert("Escribe el texto del caso clínico.");
        return;
      }

      const qBlocks = block.querySelectorAll(".exam-question-block");
      if (!qBlocks.length) {
        alert("Cada caso clínico debe tener al menos una pregunta.");
        return;
      }

      const questions = [];

      for (const qb of qBlocks) {
        const questionText = qb.querySelector(".admin-q-question").value.trim();
        const optionA = qb.querySelector(".admin-q-a").value.trim();
        const optionB = qb.querySelector(".admin-q-b").value.trim();
        const optionC = qb.querySelector(".admin-q-c").value.trim();
        const optionD = qb.querySelector(".admin-q-d").value.trim();
        const correctOption = qb.querySelector(".admin-q-correct").value;
        const subtype = qb.querySelector(".admin-q-subtype").value;
        const difficulty = qb.querySelector(".admin-q-difficulty").value;
        const justification = qb
          .querySelector(".admin-q-justification")
          .value.trim();

        if (
          !questionText ||
          !optionA ||
          !optionB ||
          !optionC ||
          !optionD ||
          !correctOption ||
          !justification
        ) {
          alert("Completa todos los campos de cada pregunta.");
          return;
        }

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
      }

      casesToSave.push({
        bankCaseId,
        caseText,
        specialty,
        topic,
        questions,
      });
    }

    const newBankIds = casesToSave.map((c) => c.bankCaseId).filter(Boolean);

    const btn = btnSaveExamAll;
    setLoadingButton(btn, true, "Guardar examen");

    try {
      await updateDoc(doc(db, "exams", currentExamId), {
        name: newName,
        updatedAt: serverTimestamp(),
      });

      // borrar previos
      const qPrev = query(
        collection(db, "questions"),
        where("examId", "==", currentExamId)
      );
      const prevSnap = await getDocs(qPrev);
      for (const c of prevSnap.docs) {
        await deleteDoc(c.ref);
      }

      // guardar nuevos
      for (const c of casesToSave) {
        await addDoc(collection(db, "questions"), {
          examId: currentExamId,
          bankCaseId: c.bankCaseId || null, // ✅ persistente
          caseText: c.caseText,
          specialty: c.specialty,
          topic: c.topic || "",
          questions: c.questions,
          createdAt: serverTimestamp(),
        });
      }

      // ✅ Ajuste real de usageCount
      await applyUsageDelta(prevBankIds, newBankIds);

      alert("Examen guardado correctamente.");
      if (currentSectionId) {
        await loadExamsForSection(currentSectionId);
      }

      // refrescar buscador (para que se deshabiliten bien y refresque usado)
      resetBankSearchUI();
      await loadBankCasesIfNeeded();
    } catch (err) {
      console.error(err);
      alert("Hubo un error al guardar el examen.");
    } finally {
      setLoadingButton(btn, false, "Guardar examen");
    }
  });
}

// Botón "Agregar caso clínico" superior
if (btnAddCaseTop) {
  btnAddCaseTop.addEventListener("click", () => {
    if (!currentExamId) {
      alert("Primero abre un examen.");
      return;
    }
    syncCurrentExamCasesFromDOM();
    currentExamCases.push(createEmptyCase());
    renderExamCases();
  });
}

/**
 * Importar un solo examen (JSON) directamente al formulario del examen abierto.
 */
function normalizeQuestionFromJson(raw) {
  return {
    questionText: raw.questionText || raw.question || "",
    optionA: raw.optionA || raw.a || "",
    optionB: raw.optionB || raw.b || "",
    optionC: raw.optionC || raw.c || "",
    optionD: raw.optionD || raw.d || "",
    correctOption: raw.correctOption || raw.correct || raw.answer || "",
    subtype: raw.subtype || "salud_publica",
    difficulty: raw.difficulty || "media",
    justification: raw.justification || raw.explanation || "",
  };
}

function loadExamFromJsonIntoUI(json) {
  const examName =
    (json && (json.examName || json.name)) ||
    (examTitleInput ? examTitleInput.value : "");

  if (examTitleInput && examName) {
    examTitleInput.value = examName;
  }

  let casesArr = [];

  if (Array.isArray(json)) {
    casesArr = json;
  } else if (Array.isArray(json.cases)) {
    casesArr = json.cases;
  } else {
    alert(
      "El JSON debe ser un objeto con propiedad 'cases' o un arreglo de casos clínicos."
    );
    return;
  }

  if (!casesArr.length) {
    alert("El JSON no contiene casos clínicos.");
    return;
  }

  currentExamCases = casesArr.map((c) => {
    const caseText = c.caseText || c.case || "";
    const specialty = c.specialty || "";
    const topic = (c.topic || "").toString().trim();
    const qsRaw = Array.isArray(c.questions) ? c.questions : [];
    const questions =
      qsRaw.length > 0
        ? qsRaw.map((q) => normalizeQuestionFromJson(q))
        : [createEmptyQuestion()];

    return { bankCaseId: null, caseText, specialty, topic, questions };
  });

  renderExamCases();
}

if (btnImportExamJson) {
  btnImportExamJson.addEventListener("click", () => {
    if (!examDetailView || examDetailView.classList.contains("hidden")) {
      alert("Abre primero un examen para poder importar.");
      return;
    }

    openJsonFilePicker((json) => {
      try {
        loadExamFromJsonIntoUI(json);
      } catch (err) {
        console.error("Error cargando examen desde JSON:", err);
        alert("No se pudo cargar el examen desde el JSON.");
      }
    });
  });
}

/****************************************************
 * BANCO DE PREGUNTAS (questions) – Panel admin-panel-bank
 * ✅ Preguntas editables tipo examen (no JSON)
 ****************************************************/

const bankFilterCaseText = document.getElementById("admin-bank-search");
const bankFilterTopic = document.getElementById("admin-bank-topic");
const bankFilterSpecialty = document.getElementById("admin-bank-specialty");
const bankFilterExamId = document.getElementById("admin-bank-examid");

const btnBankClear = document.getElementById("admin-bank-btn-clear");
const btnBankRefresh = document.getElementById("admin-bank-btn-refresh");
const btnBankApply = document.getElementById("admin-bank-btn-apply");

const bankListEl = document.getElementById("admin-bank-list");
const btnBankLoadMore = document.getElementById("admin-bank-btn-load-more");

// Estado del banco
let bankPageSize = 20;
let bankLastDoc = null;
let bankIsLoading = false;
let bankHasMore = true;

// Filtros actuales
let bankActiveFilters = {
  caseText: "",
  topic: "",
  specialty: "",
  examId: "",
};

function getBankFiltersFromUI() {
  return {
    caseText: (bankFilterCaseText?.value || "").trim(),
    topic: (bankFilterTopic?.value || "").trim(),
    specialty: (bankFilterSpecialty?.value || "").trim(),
    examId: (bankFilterExamId?.value || "").trim(),
  };
}

function bankCaseMatchesFilters(docData, filters) {
  const caseText = normalizeText(docData.caseText || "");
  const topic = normalizeText((docData.topic || "").toString());
  const specialty = normalizeText((docData.specialty || "").toString());
  const examId = normalizeText((docData.examId || "").toString());

  const fCase = normalizeText(filters.caseText || "");
  const fTopic = normalizeText(filters.topic || "");
  const fSpec = normalizeText(filters.specialty || "");
  const fExam = normalizeText(filters.examId || "");

  if (fCase && !caseText.includes(fCase)) return false;
  if (fTopic && !topic.includes(fTopic)) return false;
  if (fSpec && !specialty.includes(fSpec)) return false;
  if (fExam && !examId.includes(fExam)) return false;

  return true;
}

// helpers
function escapeHtml(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBankItem(docId, data) {
  const specLabel = getSpecialtyLabel(data.specialty || "");
  const topicTxt = (data.topic || "").toString();
  const qCount = Array.isArray(data.questions) ? data.questions.length : 0;
  const usage = typeof data.usageCount === "number" ? data.usageCount : 0;

  const wrap = document.createElement("div");
  wrap.className = "card-item";
  wrap.dataset.id = docId;
  wrap.dataset.mode = "view";

  const snippet = escapeHtml((data.caseText || "").slice(0, 240));
  const hasMore = (data.caseText || "").length > 240;

  wrap.innerHTML = `
    <div class="card-item__title-row" style="align-items:flex-start;">
      <div style="flex:1;">
        <div class="card-item__title" style="margin-bottom:6px;">
          ${escapeHtml(topicTxt || specLabel || "Caso (questions)")}
        </div>
        <div style="font-size:12px;color:#9ca3af;">
          <div><strong>ID:</strong> <code>${docId}</code></div>
          <div><strong>ExamID:</strong> <code>${escapeHtml((data.examId || "—") + "")}</code></div>
          <div><strong>Tema:</strong> ${escapeHtml(topicTxt || "—")}</div>
          <div><strong>Preguntas:</strong> ${qCount}</div>
          <div><strong>Usado:</strong> ${usage}</div>
        </div>
      </div>

      <div class="card-item__actions">
        <button class="btn btn-sm btn-secondary admin-bank-inline-edit">Editar</button>
        <button class="btn btn-sm btn-outline admin-bank-inline-delete">Eliminar</button>
      </div>
    </div>

    <div class="admin-bank-view" style="font-size:13px;line-height:1.45;color:#e5e7eb;margin-top:10px;">
      ${snippet}${hasMore ? "…" : ""}
    </div>

    <div class="admin-bank-edit hidden" style="margin-top:12px;">
      <div class="card" style="padding:12px;">
        <label class="field">
          <span>Especialidad</span>
          <select class="admin-bank-edit-specialty">
            <option value="">Selecciona...</option>
            ${Object.entries(SPECIALTIES)
              .map(([key, label]) => `<option value="${key}" ${key === (data.specialty || "") ? "selected" : ""}>${label}</option>`)
              .join("")}
          </select>
        </label>

        <label class="field">
          <span>Tema (topic)</span>
          <input type="text" class="admin-bank-edit-topic" value="${escapeHtml((data.topic || "") + "")}" />
        </label>

        <label class="field">
          <span>Texto del caso clínico</span>
          <textarea class="admin-bank-edit-caseText" rows="5">${escapeHtml(data.caseText || "")}</textarea>
        </label>

        <div class="card" style="padding:12px;margin-top:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-weight:600;font-size:13px;">Preguntas</div>
            <button type="button" class="btn btn-sm btn-primary admin-bank-add-question">+ Agregar pregunta</button>
          </div>
          <div class="cards-list admin-bank-questions" style="margin-top:10px;"></div>
        </div>

        <div class="flex-row" style="justify-content:flex-end;gap:8px;margin-top:10px;">
          <button class="btn btn-sm btn-outline admin-bank-inline-cancel">Cancelar</button>
          <button class="btn btn-sm btn-primary admin-bank-inline-save">Guardar</button>
        </div>
      </div>
    </div>
  `;

  const btnEdit = wrap.querySelector(".admin-bank-inline-edit");
  const btnDelete = wrap.querySelector(".admin-bank-inline-delete");
  const btnCancel = wrap.querySelector(".admin-bank-inline-cancel");
  const btnSave = wrap.querySelector(".admin-bank-inline-save");
  const viewEl = wrap.querySelector(".admin-bank-view");
  const editEl = wrap.querySelector(".admin-bank-edit");

  // ✅ cargar preguntas en modo editor (UI tipo examen)
  const bankQContainer = wrap.querySelector(".admin-bank-questions");
  const initialQs = Array.isArray(data.questions) && data.questions.length ? data.questions : [createEmptyQuestion()];
  initialQs.forEach((q) => bankQContainer.appendChild(renderQuestionBlock(q)));

  wrap.querySelector(".admin-bank-add-question").addEventListener("click", () => {
    bankQContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
  });

  btnEdit.addEventListener("click", () => {
    wrap.dataset.mode = "edit";
    viewEl.classList.add("hidden");
    editEl.classList.remove("hidden");
    btnEdit.disabled = true;
  });

  btnCancel.addEventListener("click", () => {
    wrap.dataset.mode = "view";
    viewEl.classList.remove("hidden");
    editEl.classList.add("hidden");
    btnEdit.disabled = false;
  });

  btnDelete.addEventListener("click", async () => {
    const ok = window.confirm("¿Eliminar este caso del banco (questions)?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "questions", docId));
      wrap.remove();

      bankCasesLoadedOnce = false;
      bankCasesCache = [];
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el caso.");
    }
  });

  btnSave.addEventListener("click", async () => {
    const specialty = wrap.querySelector(".admin-bank-edit-specialty").value || "";
    const topic = wrap.querySelector(".admin-bank-edit-topic").value.trim();
    const caseText = wrap.querySelector(".admin-bank-edit-caseText").value.trim();

    if (!caseText) {
      alert("El texto del caso clínico no puede ir vacío.");
      return;
    }

    // ✅ recolectar preguntas desde UI
    const qBlocks = wrap.querySelectorAll(".admin-bank-questions .exam-question-block");
    const questionsParsed = [];

    for (const qb of qBlocks) {
      const questionText = qb.querySelector(".admin-q-question").value.trim();
      const optionA = qb.querySelector(".admin-q-a").value.trim();
      const optionB = qb.querySelector(".admin-q-b").value.trim();
      const optionC = qb.querySelector(".admin-q-c").value.trim();
      const optionD = qb.querySelector(".admin-q-d").value.trim();
      const correctOption = qb.querySelector(".admin-q-correct").value;
      const subtype = qb.querySelector(".admin-q-subtype").value;
      const difficulty = qb.querySelector(".admin-q-difficulty").value;
      const justification = qb.querySelector(".admin-q-justification").value.trim();

      if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption || !justification) {
        alert("Completa todos los campos de todas las preguntas.");
        return;
      }

      questionsParsed.push({
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
    }

    if (!questionsParsed.length) {
      alert("Debe existir al menos una pregunta.");
      return;
    }

    setLoadingButton(btnSave, true, "Guardar");

    try {
      await updateDoc(doc(db, "questions", docId), {
        specialty,
        topic,
        caseText,
        questions: questionsParsed,
        updatedAt: serverTimestamp(),
      });

      bankCasesLoadedOnce = false;
      bankCasesCache = [];

      await loadQuestionsBank(true);
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la edición del caso.");
    } finally {
      setLoadingButton(btnSave, false, "Guardar");
    }
  });

  return wrap;
}

async function loadQuestionsBank(reset = false) {
  if (!bankListEl) return;
  if (bankIsLoading) return;

  bankIsLoading = true;

  if (reset) {
    bankListEl.innerHTML = "";
    bankLastDoc = null; // cursor de escaneo (questions)
    bankHasMore = true;
    if (btnBankLoadMore) btnBankLoadMore.disabled = true;
  }

  if (!bankListEl.children.length) {
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        Cargando banco de preguntas (questions)…
      </div>
    `;
  }

  try {
    const filters = bankActiveFilters || getBankFiltersFromUI();

    // Estrategia: escanear por lotes y renderear SOLO coincidencias,
    // hasta llenar una "página" (bankPageSize) o llegar al final.
    const scanBatch = 250;
    let rendered = 0;
    let safetyLoops = 0;

    // si venimos de reset, limpiar placeholder
    if (reset) bankListEl.innerHTML = "";

    while (bankHasMore && rendered < bankPageSize) {
      safetyLoops++;
      if (safetyLoops > 80) {
        // evita loops infinitos en caso de filtros muy restrictivos + colección enorme
        break;
      }

      let qBase;
      try {
        qBase = query(
          collection(db, "questions"),
          orderBy("createdAt", "desc"),
          ...(bankLastDoc ? [startAfter(bankLastDoc)] : []),
          limit(scanBatch)
        );
      } catch (e) {
        qBase = query(
          collection(db, "questions"),
          ...(bankLastDoc ? [startAfter(bankLastDoc)] : []),
          limit(scanBatch)
        );
      }

      const snap = await getDocs(qBase);

      if (!snap || !snap.docs || !snap.docs.length) {
        bankHasMore = false;
        break;
      }

      bankLastDoc = snap.docs[snap.docs.length - 1];

      // Si el lote vino incompleto, probablemente ya es el final
      if (snap.size < scanBatch) {
        // Ojo: aún puede haber más, pero Firestore normalmente devuelve < limit al final
        // Lo marcamos como que no hay más para evitar scans infinitos.
        bankHasMore = false;
      } else {
        bankHasMore = true;
      }

      for (const d of snap.docs) {
        const data = d.data() || {};
        if (!bankCaseMatchesFilters(data, filters)) continue;

        bankListEl.appendChild(renderBankItem(d.id, data));
        rendered++;

        if (rendered >= bankPageSize) break;
      }
    }

    if (!bankListEl.children.length) {
      renderEmptyMessage(bankListEl, "No hay resultados con esos filtros. Prueba otros términos.");
    }

    if (btnBankLoadMore) {
      btnBankLoadMore.disabled = !bankHasMore;
    }
  } catch (err) {
    console.error(err);
    renderEmptyMessage(bankListEl, "Error al cargar el banco. Revisa la consola.");
    if (btnBankLoadMore) btnBankLoadMore.disabled = true;
  } finally {
    bankIsLoading = false;
  }
}

if (btnBankApply) {
  btnBankApply.addEventListener("click", () => {
    bankActiveFilters = getBankFiltersFromUI();
    loadQuestionsBank(true);
  });
}

if (btnBankRefresh) {
  btnBankRefresh.addEventListener("click", () => {
    loadQuestionsBank(true);
  });
}

if (btnBankClear) {
  btnBankClear.addEventListener("click", () => {
    if (bankFilterCaseText) bankFilterCaseText.value = "";
    if (bankFilterTopic) bankFilterTopic.value = "";
    if (bankFilterSpecialty) bankFilterSpecialty.value = "";
    if (bankFilterExamId) bankFilterExamId.value = "";
    bankActiveFilters = { caseText: "", topic: "", specialty: "", examId: "" };
    loadQuestionsBank(true);
  });
}

if (btnBankLoadMore) {
  btnBankLoadMore.addEventListener("click", () => {
    if (!bankHasMore) return;
    loadQuestionsBank(false);
  });
}

/****************************************************
 * MINI EXÁMENES – BANCO GLOBAL DE CASOS (miniQuestions)
 * ✅ guarda bankCaseId y ajusta usageCount por delta al guardar
 ****************************************************/

const miniCasesContainer = document.getElementById("admin-mini-cases");
const btnMiniAddCase = document.getElementById("admin-mini-btn-add-case");
const btnMiniSaveAll = document.getElementById("admin-mini-btn-save-all");

function syncMiniCasesFromDOM() {
  if (!miniCasesContainer) return;

  const caseBlocks = miniCasesContainer.querySelectorAll(".mini-case-block");
  const newCases = [];

  caseBlocks.forEach((block) => {
    const idx = parseInt(block.dataset.caseIndex, 10);
    const prev = !Number.isNaN(idx) && miniCases[idx] ? miniCases[idx] : {};

    const caseText =
      block.querySelector(".admin-mini-case-text")?.value.trim() || "";
    const specialty =
      block.querySelector(".admin-mini-case-specialty")?.value || "";

    const bankCaseId = (block.dataset.bankCaseId || "").trim() || (prev.bankCaseId || null);

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
        qb.querySelector(".admin-q-correct")?.value || "A";
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
      id: prev.id || null,
      bankCaseId,
      caseText,
      specialty,
      questions,
    });
  });

  miniCases =
    newCases.length > 0
      ? newCases
      : [
          {
            id: null,
            bankCaseId: null,
            caseText: "",
            specialty: "",
            questions: [createEmptyQuestion()],
          },
        ];
}

async function loadMiniCases() {
  if (!miniCasesContainer) return;

  if (miniCasesLoadedOnce && miniCases.length) {
    renderMiniCases();
    return;
  }

  miniCasesContainer.innerHTML = `
    <div class="card">
      <p class="panel-subtitle">Cargando banco de mini exámenes…</p>
    </div>
  `;

  try {
    const snap = await getDocs(collection(db, "miniQuestions"));
    miniCases = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        bankCaseId: data.bankCaseId || null,
        caseText: data.caseText || "",
        specialty: data.specialty || "",
        questions:
          Array.isArray(data.questions) && data.questions.length
            ? data.questions
            : [createEmptyQuestion()],
      };
    });
  } catch (err) {
    console.error(err);
    miniCases = [];
    miniCasesContainer.innerHTML = `
      <div class="card">
        <p class="panel-subtitle">Error al cargar el banco de mini exámenes.</p>
      </div>
    `;
    return;
  }

  if (!miniCases.length) {
    miniCases.push({
      id: null,
      bankCaseId: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
  }

  miniCasesLoadedOnce = true;
  renderMiniCases();
}

function renderMiniCases() {
  if (!miniCasesContainer) return;
  miniCasesContainer.innerHTML = "";

  if (!miniCases.length) {
    miniCases.push({
      id: null,
      bankCaseId: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
  }

  miniCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card mini-case-block";
    wrapper.dataset.caseIndex = index;

    // ✅ persistencia en DOM
    wrapper.dataset.bankCaseId = caseData.bankCaseId || "";

    const specialtyValue = caseData.specialty || "";
    const questionsArr = Array.isArray(caseData.questions)
      ? caseData.questions
      : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">
          Caso clínico global ${index + 1}
        </h3>
        <button type="button" class="btn btn-sm btn-outline admin-mini-delete-case">
          Eliminar caso
        </button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-mini-case-specialty">
          <option value="">Selecciona…</option>
          ${Object.entries(SPECIALTIES)
            .map(
              ([key, label]) =>
                `<option value="${key}" ${
                  key === specialtyValue ? "selected" : ""
                }>${label}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-mini-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-mini-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-mini-add-question">
          + Agregar pregunta
        </button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-mini-case-questions");

    if (!questionsArr.length) {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    } else {
      questionsArr.forEach((qData) => {
        qContainer.appendChild(renderQuestionBlock(qData));
      });
    }

    wrapper
      .querySelector(".admin-mini-add-question")
      .addEventListener("click", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

    wrapper
      .querySelector(".admin-mini-delete-case")
      .addEventListener("click", () => {
        const idx = parseInt(wrapper.dataset.caseIndex, 10);
        if (Number.isNaN(idx)) return;
        miniCases.splice(idx, 1);
        renderMiniCases();
      });

    miniCasesContainer.appendChild(wrapper);
  });

  const bottom = document.createElement("div");
  bottom.className = "flex-row";
  bottom.style.justifyContent = "flex-end";
  bottom.style.gap = "8px";
  bottom.style.marginTop = "12px";

  const btnAddBottom = document.createElement("button");
  btnAddBottom.type = "button";
  btnAddBottom.className = "btn btn-sm btn-secondary";
  btnAddBottom.textContent = "+ Agregar caso clínico";
  btnAddBottom.addEventListener("click", () => {
    if (btnMiniAddCase) btnMiniAddCase.click();
  });

  const btnSaveBottom = document.createElement("button");
  btnSaveBottom.type = "button";
  btnSaveBottom.className = "btn btn-sm btn-primary";
  btnSaveBottom.textContent = "Guardar banco";
  btnSaveBottom.addEventListener("click", () => {
    if (btnMiniSaveAll) btnMiniSaveAll.click();
  });

  bottom.appendChild(btnAddBottom);
  bottom.appendChild(btnSaveBottom);
  miniCasesContainer.appendChild(bottom);
}

if (btnMiniAddCase && miniCasesContainer) {
  btnMiniAddCase.addEventListener("click", () => {
    syncMiniCasesFromDOM();
    miniCases.push({
      id: null,
      bankCaseId: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
    renderMiniCases();
  });
}

async function handleSaveMiniBank() {
  if (!miniCasesContainer) return;

  // ✅ prev para delta usageCount
  let prevBankIds = [];
  try {
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    prevBankIds = prevSnap.docs.map(d => (d.data() || {}).bankCaseId).filter(Boolean);
  } catch (e) {
    console.warn("No se pudieron leer previos miniQuestions para delta:", e);
  }

  syncMiniCasesFromDOM();

  if (!miniCases.length) {
    if (
      !confirm(
        "No hay casos en el banco. Si continúas, se eliminarán todos los casos previos de mini exámenes. ¿Continuar?"
      )
    ) {
      return;
    }
  }

  for (const c of miniCases) {
    if (!c.caseText.trim()) {
      alert("Escribe el texto del caso clínico en todos los casos.");
      return;
    }
    if (!c.questions.length) {
      alert("Cada caso clínico del banco debe tener al menos una pregunta.");
      return;
    }
    for (const q of c.questions) {
      if (
        !q.questionText ||
        !q.optionA ||
        !q.optionB ||
        !q.optionC ||
        !q.optionD ||
        !q.correctOption ||
        !q.justification
      ) {
        alert("Completa todos los campos en todas las preguntas del banco.");
        return;
      }
    }
  }

  const newBankIds = miniCases.map(c => c.bankCaseId).filter(Boolean);

  const btn = btnMiniSaveAll;
  if (btn) setLoadingButton(btn, true, "Guardar banco");

  try {
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    for (const d of prevSnap.docs) {
      await deleteDoc(d.ref);
    }

    for (const c of miniCases) {
      await addDoc(collection(db, "miniQuestions"), {
        bankCaseId: c.bankCaseId || null, // ✅
        caseText: c.caseText,
        specialty: c.specialty,
        questions: c.questions,
        createdAt: serverTimestamp(),
      });
    }

    // ✅ delta usageCount real
    await applyUsageDelta(prevBankIds, newBankIds);

    alert("Banco de mini exámenes guardado correctamente.");
  } catch (err) {
    console.error(err);
    alert("Hubo un error al guardar el banco de mini exámenes.");
  } finally {
    if (btn) setLoadingButton(btn, false, "Guardar banco");
  }
}

if (btnMiniSaveAll && miniCasesContainer) {
  btnMiniSaveAll.addEventListener("click", handleSaveMiniBank);
}

/****************************************************
 * USUARIOS (CRUD) (SIN CAMBIOS)
 ****************************************************/

async function loadUsers() {
  if (!usersTableContainer) return;

  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersTableContainer.innerHTML = "";
    renderEmptyMessage(
      usersTableContainer,
      "No hay usuarios creados. Usa el formulario superior para crear uno."
    );
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Rol</th>
          <th>Estado</th>
          <th>Vence</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "";
    const email = data.email || id;
    const role = data.role || "usuario";
    const status = data.status || "inactivo";
    const expiry = data.expiryDate || "";

    const chipRoleClass = role === "admin" ? "chip--admin" : "chip--user";
    const chipStatusClass =
      status === "activo" ? "chip--activo" : "chip--inactivo";

    html += `
      <tr data-id="${id}">
        <td>${name}</td>
        <td>${email}</td>
        <td><span class="chip ${chipRoleClass}">${role}</span></td>
        <td><span class="chip ${chipStatusClass}">${status}</span></td>
        <td>${expiry || "—"}</td>
        <td>
          <button class="icon-btn admin-edit-user" title="Editar">✏</button>
          <button class="icon-btn admin-delete-user" title="Eliminar">🗑</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  usersTableContainer.innerHTML = html;

  usersTableContainer
    .querySelectorAll("tr[data-id]")
    .forEach((row) => attachUserRowEvents(row));
}

function attachUserRowEvents(row) {
  const id = row.dataset.id;
  const btnEdit = row.querySelector(".admin-edit-user");
  const btnDelete = row.querySelector(".admin-delete-user");

  btnEdit.addEventListener("click", () => openUserEditModal(id));
  btnDelete.addEventListener("click", async () => {
    const ok = window.confirm("¿Eliminar este usuario?");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "users", id));
      loadUsers();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el usuario.");
    }
  });
}

if (btnCreateUser) {
  btnCreateUser.addEventListener("click", async () => {
    const name = newUserNameInput.value.trim();
    const email = newUserEmailInput.value.trim();
    const password = newUserPasswordInput.value.trim();
    const role = newUserRoleSelect.value;
    const status = newUserStatusSelect.value;
    const expiry = newUserExpiryInput.value || "";

    if (!name || !email || !password) {
      alert("Nombre, correo y contraseña son obligatorios.");
      return;
    }

    try {
      await setDoc(doc(db, "users", email), {
        name,
        email,
        password,
        role,
        status,
        expiryDate: expiry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert(
        "Usuario creado en Firestore.\nRecuerda crearlo también en Firebase Authentication manualmente."
      );

      newUserNameInput.value = "";
      newUserEmailInput.value = "";
      newUserPasswordInput.value = "";
      newUserRoleSelect.value = "usuario";
      newUserStatusSelect.value = "activo";
      newUserExpiryInput.value = "";

      loadUsers();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear el usuario.");
    }
  });
}

function openUserEditModal(userId) {
  const ref = doc(db, "users", userId);
  getDoc(ref).then((snap) => {
    if (!snap.exists()) {
      alert("No se encontró el usuario.");
      return;
    }

    const data = snap.data();

    openModal({
      title: "Editar usuario",
      bodyHtml: `
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="modal-user-name" value="${data.name || ""}" />
        </label>
        <label class="field">
          <span>Correo (ID)</span>
          <input type="email" id="modal-user-email" value="${data.email || userId}" readonly />
        </label>
        <label class="field">
          <span>Contraseña (referencia)</span>
          <input type="text" id="modal-user-password" value="${data.password || ""}" />
        </label>
        <label class="field">
          <span>Rol</span>
          <select id="modal-user-role">
            <option value="admin" ${
              data.role === "admin" ? "selected" : ""
            }>Administrador</option>
            <option value="usuario" ${
              data.role === "usuario" ? "selected" : ""
            }>Usuario</option>
          </select>
        </label>
        <label class="field">
          <span>Estado</span>
          <select id="modal-user-status">
            <option value="activo" ${
              data.status === "activo" ? "selected" : ""
            }>Activo</option>
            <option value="inactivo" ${
              data.status === "inactivo" ? "selected" : ""
            }>Inactivo</option>
          </select>
        </label>
        <label class="field">
          <span>Fecha de vencimiento</span>
          <input type="date" id="modal-user-expiry" value="${data.expiryDate || ""}" />
        </label>
      `,
      onOk: async () => {
        const name = document.getElementById("modal-user-name").value.trim();
        const email = document.getElementById("modal-user-email").value.trim();
        const password = document
          .getElementById("modal-user-password")
          .value.trim();
        const role = document.getElementById("modal-user-role").value;
        const status = document.getElementById("modal-user-status").value;
        const expiry = document.getElementById("modal-user-expiry").value || "";

        if (!name || !email) {
          alert("Nombre y correo son obligatorios.");
          return;
        }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          await updateDoc(doc(db, "users", email), {
            name,
            email,
            password,
            role,
            status,
            expiryDate: expiry,
            updatedAt: serverTimestamp(),
          });
          await loadUsers();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo actualizar el usuario.");
        } finally {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

/****************************************************
 * PANTALLA PRINCIPAL / LANDING (SIN CAMBIOS)
 ****************************************************/

async function loadLandingSettings() {
  if (!landingTextArea) return;

  try {
    const ref = doc(db, "settings", "landingPage");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      landingTextArea.value =
        "Aquí podrás conocer todo lo que incluye la plataforma Estudiante ENARM.";
      monthlyLabelInput.value = "Plan mensual";
      monthlyPriceInput.value = "0";
      enarmLabelInput.value = "Plan ENARM 2026";
      enarmPriceInput.value = "0";
      whatsappPhoneInput.value = "+525515656316";
      return;
    }

    const data = snap.data();

    landingTextArea.value = data.description || "";
    monthlyLabelInput.value = data.monthlyLabel || "Plan mensual";
    monthlyPriceInput.value = data.monthlyPrice || "0";
    enarmLabelInput.value = data.enarmLabel || "Plan ENARM 2026";
    enarmPriceInput.value = data.enarmPrice || "0";
    whatsappPhoneInput.value = data.whatsappPhone || "+525515656316";
  } catch (err) {
    console.error("Error cargando landingPage:", err);
  }
}

if (btnSaveLanding) {
  btnSaveLanding.addEventListener("click", async () => {
    if (!landingTextArea) return;

    const description = landingTextArea.value.trim();
    const monthlyLabel = monthlyLabelInput.value.trim() || "Plan mensual";
    const monthlyPrice = monthlyPriceInput.value.trim() || "0";
    const enarmLabel = enarmLabelInput.value.trim() || "Plan ENARM 2026";
    const enarmPrice = enarmPriceInput.value.trim() || "0";
    const whatsappPhone =
      whatsappPhoneInput.value.trim() || "+525515656316";

    const btn = btnSaveLanding;
    setLoadingButton(btn, true);

    try {
      await setDoc(
        doc(db, "settings", "landingPage"),
        {
          description,
          monthlyLabel,
          monthlyPrice,
          enarmLabel,
          enarmPrice,
          whatsappPhone,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Pantalla principal guardada.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la pantalla principal.");
    } finally {
      setLoadingButton(btn, false, "Guardar");
    }
  });
}

/****************************************************
 * SOCIAL LINKS (SIN CAMBIOS)
 ****************************************************/

async function loadSocialLinks() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    adminSocialIcons.forEach((icon) => {
      const network = icon.dataset.network;
      if (data[network]) {
        icon.dataset.url = data[network];
      }
    });
  } catch (err) {
    console.error("Error cargando socialLinks:", err);
  }

  adminSocialIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const url = icon.dataset.url;
      if (!url) {
        alert("No se ha configurado el enlace para esta red social.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

async function loadSocialLinksIntoLanding() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    if (landingInstagramInput)
      landingInstagramInput.value = data.instagram || "";
    if (landingWhatsappLinkInput)
      landingWhatsappLinkInput.value = data.whatsapp || "";
    if (landingTiktokInput) landingTiktokInput.value = data.tiktok || "";
    if (landingTelegramInput)
      landingTelegramInput.value = data.telegram || "";
  } catch (err) {
    console.error("Error cargando socialLinks para panel landing:", err);
  }
}

const btnSaveSocialLinks = document.getElementById("admin-btn-save-social-links");
if (btnSaveSocialLinks) {
  btnSaveSocialLinks.addEventListener("click", async () => {
    const instagram = landingInstagramInput.value.trim();
    const whatsapp = landingWhatsappLinkInput.value.trim();
    const tiktok = landingTiktokInput.value.trim();
    const telegram = landingTelegramInput.value.trim();

    const btn = btnSaveSocialLinks;
    setLoadingButton(btn, true);

    try {
      await setDoc(
        doc(db, "settings", "socialLinks"),
        {
          instagram,
          whatsapp,
          tiktok,
          telegram,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Links de redes sociales guardados.");
      loadSocialLinks();
    } catch (err) {
      console.error(err);
      alert("No se pudieron guardar los links de redes.");
    } finally {
      setLoadingButton(btn, false, "Guardar");
    }
  });
}

/****************************************************
 * ANALYTICS BÁSICOS (SIN CAMBIOS)
 ****************************************************/

async function loadAnalyticsSummary() {
  if (!analyticsSummaryBox || !analyticsUsersBox) return;

  try {
    const sectionsSnap = await getDocs(collection(db, "sections"));
    const examsSnap = await getDocs(collection(db, "exams"));
    const casesSnap = await getDocs(collection(db, "questions"));
    const usersSnap = await getDocs(collection(db, "users"));

    let totalCases = 0;
    let totalQuestions = 0;

    casesSnap.forEach((docSnap) => {
      totalCases += 1;
      const data = docSnap.data();
      const arr = Array.isArray(data.questions) ? data.questions : [];
      totalQuestions += arr.length;
    });

    analyticsSummaryBox.innerHTML = `
      <div class="card">
        <h3 style="font-size:16px;margin-bottom:8px;">Resumen global</h3>
        <p>Secciones: <strong>${sectionsSnap.size}</strong></p>
        <p>Exámenes: <strong>${examsSnap.size}</strong></p>
        <p>Casos clínicos: <strong>${totalCases}</strong></p>
        <p>Preguntas totales: <strong>${totalQuestions}</strong></p>
      </div>
    `;

    const userRows = [];
    for (const u of usersSnap.docs) {
      const userData = u.data();
      const email = userData.email || u.id;
      const name = userData.name || email;

      const attemptsSnap = await getDocs(
        collection(db, "users", email, "examAttempts")
      );

      if (attemptsSnap.empty) continue;

      let sumScore = 0;
      let count = 0;

      attemptsSnap.forEach((a) => {
        const d = a.data();
        if (typeof d.score === "number") {
          sumScore += d.score;
          count++;
        }
      });

      const avg = count ? sumScore / count : 0;
      userRows.push({ name, email, avg, exams: count });
    }

    if (!userRows.length) {
      analyticsUsersBox.innerHTML = `
        <div class="card">
          <p>Aún no hay intentos de exámenes registrados.</p>
        </div>
      `;
      return;
    }

    let tableHtml = `
      <div class="card">
        <h3 style="font-size:16px;margin-bottom:8px;">Promedios por usuario</h3>
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Intentos</th>
              <th>Promedio ponderado</th>
            </tr>
          </thead>
          <tbody>
    `;

    userRows.forEach((u) => {
      tableHtml += `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.exams}</td>
          <td>${u.avg.toFixed(1)}%</td>
        </tr>
      `;
    });

    tableHtml += "</tbody></table></div>";
    analyticsUsersBox.innerHTML = tableHtml;
  } catch (err) {
    console.error("Error cargando analytics:", err);
    analyticsSummaryBox.innerHTML = `
      <div class="card">
        <p>No se pudieron cargar las estadísticas.</p>
      </div>
    `;
  }
}

/****************************************************
 * FIN ADMIN.JS
 ****************************************************/
console.log("admin.js cargado correctamente (banco editable + bloqueo duplicados + usageCount delta).");
