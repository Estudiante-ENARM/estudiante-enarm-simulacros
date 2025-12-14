/****************************************************
 * ADMIN.JS - Panel de Administrador
 * Plataforma Estudiante ENARM
 *
 * FIX (13-Dic-2025):
 * - Separar banco para EXÁMENES vs banco MINI.
 *   - Para agregar casos a un EXAMEN: usar colección "questions" (global de casos existentes).
 *   - Para MINI EXÁMENES: usar colección "miniQuestions".
 * - Mantener buscadores con debounce y sin romper el resto.
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
const btnNavMini = document.getElementById("admin-btn-nav-mini");
const btnNavUsers = document.getElementById("admin-btn-nav-users");
const btnNavAnalytics = document.getElementById("admin-btn-nav-analytics");
const btnNavLanding = document.getElementById("admin-btn-nav-landing");
const adminSocialIcons = document.querySelectorAll(".admin-social-icon");

// Paneles principales
const panelExams = document.getElementById("admin-panel-exams");
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

// ==================== BUSCADOR BANCO EN DETALLE DE EXAMEN ====================
const bankSearchInput = document.getElementById("admin-bank-search-input");
const bankSearchResults = document.getElementById("admin-bank-search-results");

// ==================== BUSCADOR BANCO EN MINI EXÁMENES ====================
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

// Modal genérico (reutilizable)
const modalOverlay = document.getElementById("admin-modal-overlay");
const modalBox = document.getElementById("admin-modal");
const modalTitle = document.getElementById("admin-modal-title");
const modalBody = document.getElementById("admin-modal-body");
const modalBtnCancel = document.getElementById("admin-modal-cancel");
const modalBtnOk = document.getElementById("admin-modal-ok");

let modalOkHandler = null;

/****************************************************
 * TOGGLE BARRA LATERAL
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
let currentAdminUser = null;
let currentSectionId = null;
let currentExamId = null;
let currentExamCases = [];
let examsLoadToken = 0;

// MINI EXÁMENES
let miniCases = [];
let miniCasesLoadedOnce = false;

/****************************************************
 * UTILIDADES UI
 ****************************************************/
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function setActivePanel(panelId) {
  const panels = [panelExams, panelMini, panelUsers, panelAnalytics, panelLanding];
  panels.forEach((p) => hide(p));
  if (panelId === "exams") show(panelExams);
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
        if (typeof onLoaded === "function") onLoaded(json);
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
 * MODAL GENÉRICO
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
    if (e.target === modalOverlay) closeModal();
  });
}
if (modalBtnCancel) modalBtnCancel.addEventListener("click", closeModal);

if (modalBtnOk) {
  modalBtnOk.addEventListener("click", async () => {
    if (typeof modalOkHandler === "function") await modalOkHandler();
  });
}

/****************************************************
 * NORMALIZACIÓN / LABELS
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

/****************************************************
 * ✅ BANCO PARA AGREGAR CASOS A EXÁMENES (GLOBAL)
 * Fuente: colección "questions" (casos de todos los exámenes).
 ****************************************************/
let examBankCasesCache = [];
let examBankLoadedOnce = false;
let examBankSearchDebounceTimer = null;

async function loadExamBankCasesIfNeeded() {
  if (examBankLoadedOnce) return;
  if (!bankSearchResults) return;

  renderEmptyMessage(bankSearchResults, "Cargando banco de casos (questions)…");

  try {
    const snap = await getDocs(collection(db, "questions"));

    // Convertimos a un banco “global” de casos: cada doc es un caso
    examBankCasesCache = snap.docs.map((d) => {
      const data = d.data() || {};
      const questionsArr = Array.isArray(data.questions) ? data.questions : [];
      return {
        id: d.id,
        caseText: data.caseText || "",
        specialty: data.specialty || "",
        topic: (data.topic || "").toString(),
        questions: questionsArr,
        _normCase: normalizeText(data.caseText || ""),
        _normQs: normalizeText(questionsArr.map((q) => q.questionText || "").join(" ")),
        _normTopic: normalizeText(data.topic || ""),
      };
    });

    examBankLoadedOnce = true;

    renderEmptyMessage(
      bankSearchResults,
      examBankCasesCache.length
        ? `Banco listo. Escribe un tema para buscar (${examBankCasesCache.length} casos).`
        : "No hay casos en el banco (colección questions)."
    );
  } catch (err) {
    console.error("Error cargando banco (questions):", err);
    examBankCasesCache = [];
    examBankLoadedOnce = false;
    renderEmptyMessage(bankSearchResults, "Error al cargar banco. Revisa consola.");
  }
}

function searchExamBankCases(rawQuery) {
  const q = normalizeText(rawQuery);
  if (!q) return [];

  const tokens = q.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return [];

  const results = [];
  for (const c of examBankCasesCache) {
    const haystack = `${c._normTopic} ${c._normCase} ${c._normQs}`;
    const ok = tokens.every((t) => haystack.includes(t));
    if (ok) results.push(c);
    if (results.length >= 20) break;
  }
  return results;
}

function renderExamBankSearchResults(results, queryText) {
  if (!bankSearchResults) return;

  if (!queryText) {
    renderEmptyMessage(
      bankSearchResults,
      examBankLoadedOnce
        ? `Banco listo. Escribe un tema para buscar (${examBankCasesCache.length} casos).`
        : "Escribe un tema para buscar."
    );
    return;
  }

  if (!results.length) {
    renderEmptyMessage(bankSearchResults, `Sin resultados para "${queryText}".`);
    return;
  }

  const html = results.map((c) => {
    const specLabel = getSpecialtyLabel(c.specialty);
    const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
    const snippet = (c.caseText || "").slice(0, 220);
    const topicLine = c.topic ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">Tema: ${c.topic}</div>` : "";

    return `
      <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">
              ${specLabel ? specLabel : "Caso del banco"}
            </div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
              ${qCount} pregunta${qCount === 1 ? "" : "s"}
            </div>
            ${topicLine}
          </div>
          <button class="btn btn-sm btn-primary admin-bank-add-case" data-id="${c.id}">
            Agregar a este examen
          </button>
        </div>
        <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
          ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
        </div>
      </div>
    `;
  }).join("");

  bankSearchResults.innerHTML = html;

  bankSearchResults.querySelectorAll(".admin-bank-add-case").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const found = examBankCasesCache.find((x) => x.id === id);
      if (!found) return;

      if (!currentExamId) {
        alert("Primero abre un examen.");
        return;
      }

      syncCurrentExamCasesFromDOM();

      const cloned = {
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

function initExamBankSearchUI() {
  if (!bankSearchInput || !bankSearchResults) return;
  if (bankSearchInput.dataset.bound === "1") return;
  bankSearchInput.dataset.bound = "1";

  bankSearchInput.addEventListener("input", () => {
    if (examBankSearchDebounceTimer) clearTimeout(examBankSearchDebounceTimer);
    examBankSearchDebounceTimer = setTimeout(async () => {
      const raw = bankSearchInput.value || "";

      // Carga lazy
      await loadExamBankCasesIfNeeded();

      const res = searchExamBankCases(raw);
      renderExamBankSearchResults(res, raw.trim());
    }, 220);
  });
}

function resetExamBankSearchUI() {
  if (bankSearchInput) bankSearchInput.value = "";
  if (bankSearchResults) bankSearchResults.innerHTML = "";
}

/****************************************************
 * ✅ BANCO PARA MINI EXÁMENES
 * Fuente: colección "miniQuestions"
 ****************************************************/
let miniBankCasesCache = [];
let miniBankLoadedOnce = false;
let miniBankSearchDebounceTimer = null;

async function loadMiniBankCasesIfNeeded() {
  if (miniBankLoadedOnce) return;
  if (!miniBankSearchResults) return;

  renderEmptyMessage(miniBankSearchResults, "Cargando banco (miniQuestions)…");

  try {
    const snap = await getDocs(collection(db, "miniQuestions"));
    miniBankCasesCache = snap.docs.map((d) => {
      const data = d.data() || {};
      const questionsArr = Array.isArray(data.questions) ? data.questions : [];
      return {
        id: d.id,
        caseText: data.caseText || "",
        specialty: data.specialty || "",
        questions: questionsArr,
        _normCase: normalizeText(data.caseText || ""),
        _normQs: normalizeText(questionsArr.map((q) => q.questionText || "").join(" ")),
      };
    });
    miniBankLoadedOnce = true;

    renderEmptyMessage(
      miniBankSearchResults,
      miniBankCasesCache.length
        ? `Banco listo. Escribe para buscar (${miniBankCasesCache.length} casos).`
        : "No hay casos en miniQuestions."
    );
  } catch (err) {
    console.error("Error cargando miniQuestions:", err);
    miniBankCasesCache = [];
    miniBankLoadedOnce = false;
    renderEmptyMessage(miniBankSearchResults, "Error al cargar banco. Revisa consola.");
  }
}

function searchMiniBankCases(rawQuery) {
  const q = normalizeText(rawQuery);
  if (!q) return [];
  const tokens = q.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return [];

  const results = [];
  for (const c of miniBankCasesCache) {
    const haystack = `${c._normCase} ${c._normQs}`;
    const ok = tokens.every((t) => haystack.includes(t));
    if (ok) results.push(c);
    if (results.length >= 20) break;
  }
  return results;
}

function renderMiniBankSearchResults(results, queryText) {
  if (!miniBankSearchResults) return;

  if (!queryText) {
    renderEmptyMessage(
      miniBankSearchResults,
      miniBankLoadedOnce
        ? `Banco listo. Escribe para buscar (${miniBankCasesCache.length} casos).`
        : "Escribe para buscar."
    );
    return;
  }

  if (!results.length) {
    renderEmptyMessage(miniBankSearchResults, `Sin resultados para "${queryText}".`);
    return;
  }

  const html = results.map((c) => {
    const specLabel = getSpecialtyLabel(c.specialty);
    const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
    const snippet = (c.caseText || "").slice(0, 220);

    return `
      <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">
              ${specLabel ? specLabel : "Caso del banco"}
            </div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
              ${qCount} pregunta${qCount === 1 ? "" : "s"}
            </div>
          </div>
          <button class="btn btn-sm btn-primary admin-mini-bank-add-case" data-id="${c.id}">
            Agregar a mini exámenes
          </button>
        </div>
        <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
          ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
        </div>
      </div>
    `;
  }).join("");

  miniBankSearchResults.innerHTML = html;

  miniBankSearchResults.querySelectorAll(".admin-mini-bank-add-case").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const found = miniBankCasesCache.find((x) => x.id === id);
      if (!found) return;

      syncMiniCasesFromDOM();

      const cloned = {
        id: null,
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

      await loadMiniBankCasesIfNeeded();

      const res = searchMiniBankCases(raw);
      renderMiniBankSearchResults(res, raw.trim());
    }, 220);
  });
}

function resetMiniBankSearchUI() {
  if (miniBankSearchInput) miniBankSearchInput.value = "";
  if (miniBankSearchResults) miniBankSearchResults.innerHTML = "";
}

/****************************************************
 * PANEL USUARIOS – TABLA “RESUMEN” (OPCIONAL)
 ****************************************************/
async function loadUsersTable() {
  if (!usersTableContainer) return;

  usersTableContainer.innerHTML = `
    <div class="card">
      <p class="panel-subtitle">Cargando usuarios…</p>
    </div>
  `;

  try {
    const qUsers = query(collection(db, "users"), orderBy("email"));
    const snap = await getDocs(qUsers);

    if (snap.empty) {
      usersTableContainer.innerHTML = `
        <div class="card">
          <p class="panel-subtitle">
            Aún no hay usuarios registrados. Usa el formulario para crear el primero.
          </p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Vigencia</th>
            </tr>
          </thead>
          <tbody>
    `;

    snap.forEach(docSnap => {
      const u = docSnap.data();
      const name = u.name || "(sin nombre)";
      const email = u.email || docSnap.id;
      const role = u.role || "student";
      const status = u.status || "inactivo";
      const expiry = u.expiryDate
        ? new Date(u.expiryDate.seconds * 1000).toLocaleDateString("es-MX")
        : "Sin fecha";

      html += `
        <tr>
          <td>${name}</td>
          <td>${email}</td>
          <td>${role}</td>
          <td>
            <span class="chip ${status === "activo" ? "chip--activo" : "chip--inactivo"}">
              ${status}
            </span>
          </td>
          <td>${expiry}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    usersTableContainer.innerHTML = html;
  } catch (err) {
    console.error("Error cargando usuarios:", err);
    usersTableContainer.innerHTML = `
      <div class="card">
        <p class="panel-subtitle">
          Hubo un error al cargar la lista de usuarios.
        </p>
      </div>
    `;
  }
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

    currentAdminUser = { uid: user.uid, email: user.email, ...data };
    if (adminUserEmailSpan) adminUserEmailSpan.textContent = user.email;
  } catch (err) {
    console.error("Error obteniendo perfil de administrador:", err);
    alert("Error cargando datos de administrador.");
    return;
  }

  // Inicializar buscadores
  initExamBankSearchUI();
  initMiniBankSearchUI();

  try { await loadSections(); } catch (err) { console.error("Error cargando secciones:", err); }
  try { await loadLandingSettings(); } catch (err) { console.error("Error cargando landing:", err); }

  console.log("admin.js cargado correctamente y panel inicializado (fix bancos).");
});

/****************************************************
 * NAVEGACIÓN LATERAL
 ****************************************************/
function clearSidebarActive() {
  [btnNavExams, btnNavMini, btnNavUsers, btnNavAnalytics, btnNavLanding]
    .forEach((b) => b && b.classList.remove("sidebar-btn--active"));
}

if (btnNavExams) {
  btnNavExams.addEventListener("click", () => {
    clearSidebarActive();
    btnNavExams.classList.add("sidebar-btn--active");
    setActivePanel("exams");
    sidebar.classList.remove("sidebar--open");
  });
}

if (btnNavMini) {
  btnNavMini.addEventListener("click", async () => {
    clearSidebarActive();
    btnNavMini.classList.add("sidebar-btn--active");
    setActivePanel("mini");
    sidebar.classList.remove("sidebar--open");

    await loadMiniCases();

    resetMiniBankSearchUI();
    await loadMiniBankCasesIfNeeded();
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
 * SECCIONES (CRUD + REORDENAR)
 ****************************************************/
async function loadSections() {
  if (!sectionsList) return;

  const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(qSec);
  sectionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(sectionsList, "No hay secciones. Crea la primera.");
    currentSectionId = null;
    if (currentSectionTitle) currentSectionTitle.textContent = "Sin secciones";
    if (examsListEl) examsListEl.innerHTML = "";
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
      if (e.target.classList.contains("admin-edit-section") || e.target.classList.contains("admin-delete-section")) return;
      selectSection(id, name);
    });

    li.querySelector(".admin-edit-section").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(id, name);
    });

    li.querySelector(".admin-delete-section").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = window.confirm("¿Eliminar esta sección y TODOS los exámenes y casos clínicos asociados?");
      if (!ok) return;
      await deleteSectionWithAllData(id);
      await loadSections();
      if (currentSectionId === id) {
        currentSectionId = null;
        if (currentSectionTitle) currentSectionTitle.textContent = "Sin sección seleccionada";
        if (examsListEl) examsListEl.innerHTML = "";
      }
    });

    // Drag & drop
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
  if (currentSectionTitle) currentSectionTitle.textContent = name || "Sección";

  sectionsList.querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));

  const activeLi = sectionsList.querySelector(`.sidebar__section-item[data-section-id="${id}"]`);
  if (activeLi) activeLi.classList.add("sidebar__section-item--active");

  loadExamsForSection(id);
}

async function saveSectionsOrder() {
  if (!sectionsList) return;
  const items = Array.from(sectionsList.querySelectorAll(".sidebar__section-item"));
  const batchUpdates = items.map((li, index) => updateDoc(doc(db, "sections", li.dataset.sectionId), { order: index }));
  try { await Promise.all(batchUpdates); } catch (err) { console.error("Error actualizando orden:", err); }
}

async function deleteSectionWithAllData(sectionId) {
  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const exSnap = await getDocs(qEx);

  for (const ex of exSnap.docs) {
    const examId = ex.id;

    const qCases = query(collection(db, "questions"), where("examId", "==", examId));
    const caseSnap = await getDocs(qCases);
    for (const c of caseSnap.docs) await deleteDoc(c.ref);

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
      if (!name) { alert("Escribe un nombre."); return; }
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
        if (!name) { alert("Escribe un nombre."); return; }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          const qSec = await getDocs(collection(db, "sections"));
          const order = qSec.size;

          await addDoc(collection(db, "sections"), {
            name, order, createdAt: serverTimestamp(),
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

async function getOrCreateSectionByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("sectionName vacío en JSON.");

  const qByName = query(collection(db, "sections"), where("name", "==", trimmed));
  const snap = await getDocs(qByName);
  if (!snap.empty) return snap.docs[0].id;

  const all = await getDocs(collection(db, "sections"));
  const order = all.size;

  const ref = await addDoc(collection(db, "sections"), {
    name: trimmed, order, createdAt: serverTimestamp(),
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

  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  if (thisLoadToken !== examsLoadToken || sectionId !== currentSectionId) return;

  if (snap.empty) {
    renderEmptyMessage(examsListEl, "No hay exámenes en esta sección. Crea el primero.");
    return;
  }

  const sortedDocs = snap.docs.slice().sort((a, b) => {
    const nameA = (a.data().name || "").toString();
    const nameB = (b.data().name || "").toString();
    return nameA.localeCompare(nameB, "es", { numeric: true, sensitivity: "base" });
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

    card.querySelector(".admin-open-exam").addEventListener("click", () => openExamDetail(examId, name));
    card.querySelector(".admin-edit-exam").addEventListener("click", () => openEditExamNameModal(examId, name));

    card.querySelector(".admin-delete-exam").addEventListener("click", async () => {
      const ok = window.confirm("¿Eliminar este examen y todos sus casos clínicos?");
      if (!ok) return;

      const qCases = query(collection(db, "questions"), where("examId", "==", examId));
      const snapCases = await getDocs(qCases);
      for (const c of snapCases.docs) await deleteDoc(c.ref);

      await deleteDoc(doc(db, "exams", examId));
      loadExamsForSection(sectionId);
    });

    examsListEl.appendChild(card);
  });
}

if (btnAddExam) {
  btnAddExam.addEventListener("click", () => {
    if (!currentSectionId) { alert("Selecciona primero una sección."); return; }

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
        if (!name) { alert("Escribe un nombre."); return; }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          const docRef = await addDoc(collection(db, "exams"), {
            name, sectionId: currentSectionId, createdAt: serverTimestamp(),
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
      if (!name) { alert("Escribe un nombre."); return; }

      const btn = modalBtnOk;
      setLoadingButton(btn, true);

      try {
        await updateDoc(doc(db, "exams", examId), { name, updatedAt: serverTimestamp() });
        await loadExamsForSection(currentSectionId);
        if (currentExamId === examId && examTitleInput) examTitleInput.value = name;
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

/****************************************************
 * IMPORTAR VARIOS EXÁMENES
 ****************************************************/
async function importExamsFromJson(json) {
  let examsArray = [];
  if (Array.isArray(json)) examsArray = json;
  else if (json && Array.isArray(json.exams)) examsArray = json.exams;

  if (!examsArray.length) {
    alert("El JSON no contiene ningún examen (se esperaba un arreglo).");
    return;
  }

  const ok = window.confirm(
    `Se crearán ${examsArray.length} exámenes nuevos a partir del JSON.\n\n¿Continuar?`
  );
  if (!ok) return;

  for (const examSpec of examsArray) {
    const sectionName = examSpec.sectionName || examSpec.section || null;
    const examName = examSpec.examName || examSpec.name || "Examen sin título";
    if (!sectionName) continue;

    const sectionId = await getOrCreateSectionByName(sectionName);

    const examRef = await addDoc(collection(db, "exams"), {
      name: examName, sectionId, createdAt: serverTimestamp(),
    });

    const examId = examRef.id;
    const casesArr = Array.isArray(examSpec.cases) ? examSpec.cases : [];

    for (const caseSpec of casesArr) {
      const caseText = caseSpec.caseText || caseSpec.case || "";
      const specialty = caseSpec.specialty || "";
      const topic = (caseSpec.topic || "").toString().trim();

      const questionsSrc = Array.isArray(caseSpec.questions) ? caseSpec.questions : [];
      const questionsFormatted = questionsSrc.map((q) => ({
        questionText: q.questionText || q.question || "",
        optionA: q.optionA || q.a || "",
        optionB: q.optionB || q.b || "",
        optionC: q.optionC || q.c || "",
        optionD: q.optionD || q.d || "",
        correctOption: q.correctOption || q.correct || q.answer || "",
        subtype: q.subtype || "salud_publica",
        difficulty: q.difficulty || "media",
        justification: q.justification || q.explanation || "",
      })).filter((q) => q.questionText && q.optionA && q.optionB && q.optionC && q.optionD && q.correctOption && q.justification);

      if (!caseText || !questionsFormatted.length) continue;

      await addDoc(collection(db, "questions"), {
        examId, caseText, specialty, topic,
        questions: questionsFormatted,
        createdAt: serverTimestamp(),
      });
    }
  }

  alert("Importación completada.");

  await loadSections();
  if (currentSectionId) await loadExamsForSection(currentSectionId);

  // Refrescar banco global para que ya incluya lo importado
  examBankLoadedOnce = false;
  examBankCasesCache = [];
}

if (btnImportExamsJson) {
  btnImportExamsJson.addEventListener("click", () => {
    openJsonFilePicker(async (json) => {
      try { await importExamsFromJson(json); }
      catch (err) {
        console.error("Error importando exámenes:", err);
        alert("Hubo un error al importar los exámenes. Revisa consola.");
      }
    });
  });
}

/****************************************************
 * DETALLE DE EXAMEN
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
  return { caseText: "", specialty: "", topic: "", questions: [createEmptyQuestion()] };
}

function syncCurrentExamCasesFromDOM() {
  if (!examCasesContainer) return;

  const caseBlocks = examCasesContainer.querySelectorAll(".exam-case-block");
  const newCases = [];

  caseBlocks.forEach((block) => {
    const caseText = block.querySelector(".admin-case-text")?.value.trim() || "";
    const specialty = block.querySelector(".admin-case-specialty")?.value || "";
    const topic = block.querySelector(".admin-case-topic")?.value.trim() || "";

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText = qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption = qb.querySelector(".admin-q-correct")?.value || "";
      const subtype = qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty = qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification = qb.querySelector(".admin-q-justification")?.value.trim() || "";

      const allEmpty = !questionText && !optionA && !optionB && !optionC && !optionD && !justification;
      if (allEmpty) return;

      questions.push({
        questionText, optionA, optionB, optionC, optionD,
        correctOption, subtype, difficulty, justification,
      });
    });

    if (!caseText && !questions.length) return;

    newCases.push({
      caseText, specialty, topic,
      questions: questions.length ? questions : [createEmptyQuestion()],
    });
  });

  currentExamCases = newCases.length > 0 ? newCases : [createEmptyCase()];
}

async function openExamDetail(examId, examName) {
  currentExamId = examId;
  currentExamCases = [];

  show(panelExams);
  show(examDetailView);

  resetExamBankSearchUI();

  if (examTitleInput) examTitleInput.value = examName || "";
  if (examCasesContainer) examCasesContainer.innerHTML = "";

  const qCases = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(qCases);

  if (snap.empty) currentExamCases = [createEmptyCase()];
  else {
    currentExamCases = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      topic: (d.data()?.topic || "").toString(),
    }));
  }

  renderExamCases();

  // Cargar banco de casos global SOLO cuando estás en detalle de examen
  await loadExamBankCasesIfNeeded();
}

function renderExamCases() {
  if (!examCasesContainer) return;
  examCasesContainer.innerHTML = "";

  if (!currentExamCases.length) currentExamCases.push(createEmptyCase());

  currentExamCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card exam-case-block";
    wrapper.dataset.caseIndex = index;

    const specialtyValue = caseData.specialty || "";
    const topicValue = (caseData.topic || "").toString();
    const questionsArr = Array.isArray(caseData.questions) ? caseData.questions : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">Caso clínico ${index + 1}</h3>
        <button type="button" class="btn btn-sm btn-outline admin-delete-case">Eliminar caso clínico</button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-case-specialty">
          <option value="">Selecciona...</option>
          ${Object.entries(SPECIALTIES).map(([key, label]) =>
            `<option value="${key}" ${key === specialtyValue ? "selected" : ""}>${label}</option>`
          ).join("")}
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
        <button type="button" class="btn btn-sm btn-primary admin-add-question">+ Agregar pregunta</button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-case-questions");

    if (!questionsArr.length) qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    else questionsArr.forEach((qData) => qContainer.appendChild(renderQuestionBlock(qData)));

    wrapper.querySelector(".admin-add-question").addEventListener("click", () => {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    });

    wrapper.querySelector(".admin-delete-case").addEventListener("click", () => {
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
    <button type="button" class="btn btn-secondary" id="admin-btn-add-case-bottom">+ Agregar caso clínico</button>
    <button type="button" class="btn btn-primary" id="admin-btn-save-exam-bottom">Guardar examen</button>
  `;

  examCasesContainer.appendChild(bottomActions);

  const btnAddCaseBottom = document.getElementById("admin-btn-add-case-bottom");
  const btnSaveExamBottom = document.getElementById("admin-btn-save-exam-bottom");

  if (btnAddCaseBottom) {
    btnAddCaseBottom.addEventListener("click", () => {
      if (!currentExamId) return alert("Primero abre un examen.");
      syncCurrentExamCasesFromDOM();
      currentExamCases.push(createEmptyCase());
      renderExamCases();
    });
  }

  if (btnSaveExamBottom && btnSaveExamAll) {
    btnSaveExamBottom.addEventListener("click", () => btnSaveExamAll.click());
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
    <label class="field"><span>Pregunta</span><textarea class="admin-q-question" rows="2">${questionText}</textarea></label>
    <label class="field"><span>Opción A</span><input type="text" class="admin-q-a" value="${optionA}" /></label>
    <label class="field"><span>Opción B</span><input type="text" class="admin-q-b" value="${optionB}" /></label>
    <label class="field"><span>Opción C</span><input type="text" class="admin-q-c" value="${optionC}" /></label>
    <label class="field"><span>Opción D</span><input type="text" class="admin-q-d" value="${optionD}" /></label>

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
        ${Object.entries(SUBTYPES).map(([key, label]) =>
          `<option value="${key}" ${key === subtype ? "selected" : ""}>${label}</option>`
        ).join("")}
      </select>
    </label>

    <label class="field">
      <span>Dificultad</span>
      <select class="admin-q-difficulty">
        ${Object.entries(DIFFICULTIES).map(([key, label]) =>
          `<option value="${key}" ${key === difficulty ? "selected" : ""}>${label}</option>`
        ).join("")}
      </select>
    </label>

    <label class="field"><span>Justificación</span><textarea class="admin-q-justification" rows="2">${justification}</textarea></label>

    <div style="text-align:right;margin-top:6px;">
      <button type="button" class="btn btn-sm btn-outline admin-delete-question">Eliminar pregunta</button>
    </div>
  `;

  card.querySelector(".admin-delete-question").addEventListener("click", () => card.remove());
  return card;
}

if (btnBackToExams) {
  btnBackToExams.addEventListener("click", () => {
    currentExamId = null;
    currentExamCases = [];
    if (examCasesContainer) examCasesContainer.innerHTML = "";
    hide(examDetailView);
    show(panelExams);
    resetExamBankSearchUI();
    if (currentSectionId) loadExamsForSection(currentSectionId);
  });
}

if (btnSaveExamAll) {
  btnSaveExamAll.addEventListener("click", async () => {
    if (!currentExamId) return alert("No hay examen seleccionado.");

    const newName = examTitleInput.value.trim();
    if (!newName) return alert("Escribe un nombre para el examen.");

    const caseBlocks = examCasesContainer.querySelectorAll(".exam-case-block");
    if (!caseBlocks.length) return alert("Debes agregar al menos un caso clínico.");

    const casesToSave = [];

    for (const block of caseBlocks) {
      const caseText = block.querySelector(".admin-case-text").value.trim();
      const specialty = block.querySelector(".admin-case-specialty").value;
      const topic = block.querySelector(".admin-case-topic")?.value.trim() || "";

      if (!caseText) return alert("Escribe el texto del caso clínico.");

      const qBlocks = block.querySelectorAll(".exam-question-block");
      if (!qBlocks.length) return alert("Cada caso clínico debe tener al menos una pregunta.");

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
        const justification = qb.querySelector(".admin-q-justification").value.trim();

        if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption || !justification) {
          return alert("Completa todos los campos de cada pregunta.");
        }

        questions.push({ questionText, optionA, optionB, optionC, optionD, correctOption, subtype, difficulty, justification });
      }

      casesToSave.push({ caseText, specialty, topic, questions });
    }

    setLoadingButton(btnSaveExamAll, true, "Guardar examen");

    try {
      await updateDoc(doc(db, "exams", currentExamId), { name: newName, updatedAt: serverTimestamp() });

      const qPrev = query(collection(db, "questions"), where("examId", "==", currentExamId));
      const prevSnap = await getDocs(qPrev);
      for (const c of prevSnap.docs) await deleteDoc(c.ref);

      for (const c of casesToSave) {
        await addDoc(collection(db, "questions"), {
          examId: currentExamId,
          caseText: c.caseText,
          specialty: c.specialty,
          topic: c.topic || "",
          questions: c.questions,
          createdAt: serverTimestamp(),
        });
      }

      alert("Examen guardado correctamente.");
      if (currentSectionId) await loadExamsForSection(currentSectionId);

      // Refrescar banco global por si cambió contenido
      examBankLoadedOnce = false;
      examBankCasesCache = [];
    } catch (err) {
      console.error(err);
      alert("Hubo un error al guardar el examen.");
    } finally {
      setLoadingButton(btnSaveExamAll, false, "Guardar examen");
    }
  });
}

if (btnAddCaseTop) {
  btnAddCaseTop.addEventListener("click", () => {
    if (!currentExamId) return alert("Primero abre un examen.");
    syncCurrentExamCasesFromDOM();
    currentExamCases.push(createEmptyCase());
    renderExamCases();
  });
}

/****************************************************
 * IMPORTAR 1 EXAMEN AL UI
 ****************************************************/
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
  const examName = (json && (json.examName || json.name)) || (examTitleInput ? examTitleInput.value : "");
  if (examTitleInput && examName) examTitleInput.value = examName;

  let casesArr = [];
  if (Array.isArray(json)) casesArr = json;
  else if (Array.isArray(json.cases)) casesArr = json.cases;
  else return alert("El JSON debe ser un objeto con 'cases' o un arreglo de casos.");

  if (!casesArr.length) return alert("El JSON no contiene casos clínicos.");

  currentExamCases = casesArr.map((c) => {
    const caseText = c.caseText || c.case || "";
    const specialty = c.specialty || "";
    const topic = (c.topic || "").toString().trim();
    const qsRaw = Array.isArray(c.questions) ? c.questions : [];
    const questions = qsRaw.length ? qsRaw.map(normalizeQuestionFromJson) : [createEmptyQuestion()];
    return { caseText, specialty, topic, questions };
  });

  renderExamCases();
}

if (btnImportExamJson) {
  btnImportExamJson.addEventListener("click", () => {
    if (!examDetailView || examDetailView.classList.contains("hidden")) {
      return alert("Abre primero un examen para poder importar.");
    }
    openJsonFilePicker((json) => {
      try { loadExamFromJsonIntoUI(json); }
      catch (err) {
        console.error("Error cargando examen desde JSON:", err);
        alert("No se pudo cargar el examen desde el JSON.");
      }
    });
  });
}

/****************************************************
 * MINI EXÁMENES – BANCO GLOBAL (miniQuestions)
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

    const caseText = block.querySelector(".admin-mini-case-text")?.value.trim() || "";
    const specialty = block.querySelector(".admin-mini-case-specialty")?.value || "";

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText = qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption = qb.querySelector(".admin-q-correct")?.value || "A";
      const subtype = qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty = qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification = qb.querySelector(".admin-q-justification")?.value.trim() || "";

      const allEmpty = !questionText && !optionA && !optionB && !optionC && !optionD && !justification;
      if (allEmpty) return;

      questions.push({ questionText, optionA, optionB, optionC, optionD, correctOption, subtype, difficulty, justification });
    });

    if (!caseText && !questions.length) return;

    newCases.push({ id: prev.id || null, caseText, specialty, questions });
  });

  miniCases = newCases.length ? newCases : [{ id: null, caseText: "", specialty: "", questions: [createEmptyQuestion()] }];
}

async function loadMiniCases() {
  if (!miniCasesContainer) return;

  if (miniCasesLoadedOnce && miniCases.length) {
    renderMiniCases();
    return;
  }

  miniCasesContainer.innerHTML = `
    <div class="card"><p class="panel-subtitle">Cargando banco de mini exámenes…</p></div>
  `;

  try {
    const snap = await getDocs(collection(db, "miniQuestions"));
    miniCases = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        caseText: data.caseText || "",
        specialty: data.specialty || "",
        questions: Array.isArray(data.questions) && data.questions.length ? data.questions : [createEmptyQuestion()],
      };
    });
  } catch (err) {
    console.error(err);
    miniCases = [];
    miniCasesContainer.innerHTML = `<div class="card"><p class="panel-subtitle">Error al cargar el banco de mini exámenes.</p></div>`;
    return;
  }

  if (!miniCases.length) miniCases.push({ id: null, caseText: "", specialty: "", questions: [createEmptyQuestion()] });

  miniCasesLoadedOnce = true;
  renderMiniCases();
}

function renderMiniCases() {
  if (!miniCasesContainer) return;
  miniCasesContainer.innerHTML = "";

  if (!miniCases.length) miniCases.push({ id: null, caseText: "", specialty: "", questions: [createEmptyQuestion()] });

  miniCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card mini-case-block";
    wrapper.dataset.caseIndex = index;

    const specialtyValue = caseData.specialty || "";
    const questionsArr = Array.isArray(caseData.questions) ? caseData.questions : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">Caso clínico global ${index + 1}</h3>
        <button type="button" class="btn btn-sm btn-outline admin-mini-delete-case">Eliminar caso</button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-mini-case-specialty">
          <option value="">Selecciona…</option>
          ${Object.entries(SPECIALTIES).map(([key, label]) =>
            `<option value="${key}" ${key === specialtyValue ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-mini-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-mini-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-mini-add-question">+ Agregar pregunta</button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-mini-case-questions");

    if (!questionsArr.length) qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    else questionsArr.forEach((qData) => qContainer.appendChild(renderQuestionBlock(qData)));

    wrapper.querySelector(".admin-mini-add-question").addEventListener("click", () => {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    });

    wrapper.querySelector(".admin-mini-delete-case").addEventListener("click", () => {
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
  btnAddBottom.addEventListener("click", () => { if (btnMiniAddCase) btnMiniAddCase.click(); });

  const btnSaveBottom = document.createElement("button");
  btnSaveBottom.type = "button";
  btnSaveBottom.className = "btn btn-sm btn-primary";
  btnSaveBottom.textContent = "Guardar banco";
  btnSaveBottom.addEventListener("click", () => { if (btnMiniSaveAll) btnMiniSaveAll.click(); });

  bottom.appendChild(btnAddBottom);
  bottom.appendChild(btnSaveBottom);
  miniCasesContainer.appendChild(bottom);
}

if (btnMiniAddCase && miniCasesContainer) {
  btnMiniAddCase.addEventListener("click", () => {
    syncMiniCasesFromDOM();
    miniCases.push({ id: null, caseText: "", specialty: "", questions: [createEmptyQuestion()] });
    renderMiniCases();
  });
}

async function handleSaveMiniBank() {
  if (!miniCasesContainer) return;

  syncMiniCasesFromDOM();

  if (!miniCases.length) {
    if (!confirm("No hay casos en el banco. Si continúas, se eliminarán todos los casos previos. ¿Continuar?")) return;
  }

  for (const c of miniCases) {
    if (!c.caseText.trim()) return alert("Escribe el texto del caso clínico en todos los casos.");
    if (!c.questions.length) return alert("Cada caso debe tener al menos una pregunta.");
    for (const q of c.questions) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctOption || !q.justification) {
        return alert("Completa todos los campos en todas las preguntas del banco.");
      }
    }
  }

  if (btnMiniSaveAll) setLoadingButton(btnMiniSaveAll, true, "Guardar banco");

  try {
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    for (const d of prevSnap.docs) await deleteDoc(d.ref);

    for (const c of miniCases) {
      await addDoc(collection(db, "miniQuestions"), {
        caseText: c.caseText,
        specialty: c.specialty,
        questions: c.questions,
        createdAt: serverTimestamp(),
      });
    }

    // refrescar cache mini buscador
    miniBankLoadedOnce = false;
    miniBankCasesCache = [];

    alert("Banco de mini exámenes guardado correctamente.");
  } catch (err) {
    console.error(err);
    alert("Hubo un error al guardar el banco de mini exámenes.");
  } finally {
    if (btnMiniSaveAll) setLoadingButton(btnMiniSaveAll, false, "Guardar banco");
  }
}

if (btnMiniSaveAll && miniCasesContainer) {
  btnMiniSaveAll.addEventListener("click", handleSaveMiniBank);
}

/****************************************************
 * USUARIOS (CRUD)
 ****************************************************/
async function loadUsers() {
  if (!usersTableContainer) return;

  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersTableContainer.innerHTML = "";
    renderEmptyMessage(usersTableContainer, "No hay usuarios creados. Usa el formulario superior para crear uno.");
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
    const chipStatusClass = status === "activo" ? "chip--activo" : "chip--inactivo";

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

  usersTableContainer.querySelectorAll("tr[data-id]").forEach((row) => attachUserRowEvents(row));
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

    if (!name || !email || !password) return alert("Nombre, correo y contraseña son obligatorios.");

    try {
      await setDoc(doc(db, "users", email), {
        name, email, password, role, status,
        expiryDate: expiry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert("Usuario creado en Firestore.\nRecuerda crearlo también en Firebase Authentication manualmente.");

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
    if (!snap.exists()) return alert("No se encontró el usuario.");

    const data = snap.data();

    openModal({
      title: "Editar usuario",
      bodyHtml: `
        <label class="field"><span>Nombre</span><input type="text" id="modal-user-name" value="${data.name || ""}" /></label>
        <label class="field"><span>Correo (ID)</span><input type="email" id="modal-user-email" value="${data.email || userId}" readonly /></label>
        <label class="field"><span>Contraseña (referencia)</span><input type="text" id="modal-user-password" value="${data.password || ""}" /></label>
        <label class="field">
          <span>Rol</span>
          <select id="modal-user-role">
            <option value="admin" ${data.role === "admin" ? "selected" : ""}>Administrador</option>
            <option value="usuario" ${data.role === "usuario" ? "selected" : ""}>Usuario</option>
          </select>
        </label>
        <label class="field">
          <span>Estado</span>
          <select id="modal-user-status">
            <option value="activo" ${data.status === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${data.status === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </label>
        <label class="field"><span>Fecha de vencimiento</span><input type="date" id="modal-user-expiry" value="${data.expiryDate || ""}" /></label>
      `,
      onOk: async () => {
        const name = document.getElementById("modal-user-name").value.trim();
        const email = document.getElementById("modal-user-email").value.trim();
        const password = document.getElementById("modal-user-password").value.trim();
        const role = document.getElementById("modal-user-role").value;
        const status = document.getElementById("modal-user-status").value;
        const expiry = document.getElementById("modal-user-expiry").value || "";

        if (!name || !email) return alert("Nombre y correo son obligatorios.");

        setLoadingButton(modalBtnOk, true);

        try {
          await updateDoc(doc(db, "users", email), {
            name, email, password, role, status, expiryDate: expiry,
            updatedAt: serverTimestamp(),
          });
          await loadUsers();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo actualizar el usuario.");
        } finally {
          setLoadingButton(modalBtnOk, false, "Guardar");
        }
      },
    });
  });
}

/****************************************************
 * PANTALLA PRINCIPAL / LANDING
 ****************************************************/
async function loadLandingSettings() {
  if (!landingTextArea) return;

  try {
    const ref = doc(db, "settings", "landingPage");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      landingTextArea.value = "Aquí podrás conocer todo lo que incluye la plataforma Estudiante ENARM.";
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
    const whatsappPhone = whatsappPhoneInput.value.trim() || "+525515656316";

    setLoadingButton(btnSaveLanding, true);

    try {
      await setDoc(doc(db, "settings", "landingPage"), {
        description, monthlyLabel, monthlyPrice, enarmLabel, enarmPrice, whatsappPhone,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert("Pantalla principal guardada.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la pantalla principal.");
    } finally {
      setLoadingButton(btnSaveLanding, false, "Guardar");
    }
  });
}

/****************************************************
 * SOCIAL LINKS
 ****************************************************/
async function loadSocialLinks() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    adminSocialIcons.forEach((icon) => {
      const network = icon.dataset.network;
      if (data[network]) icon.dataset.url = data[network];
    });
  } catch (err) {
    console.error("Error cargando socialLinks:", err);
  }

  adminSocialIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const url = icon.dataset.url;
      if (!url) return alert("No se ha configurado el enlace para esta red social.");
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
    if (landingInstagramInput) landingInstagramInput.value = data.instagram || "";
    if (landingWhatsappLinkInput) landingWhatsappLinkInput.value = data.whatsapp || "";
    if (landingTiktokInput) landingTiktokInput.value = data.tiktok || "";
    if (landingTelegramInput) landingTelegramInput.value = data.telegram || "";
  } catch (err) {
    console.error("Error cargando socialLinks para landing:", err);
  }
}

const btnSaveSocialLinks = document.getElementById("admin-btn-save-social-links");
if (btnSaveSocialLinks) {
  btnSaveSocialLinks.addEventListener("click", async () => {
    const instagram = landingInstagramInput.value.trim();
    const whatsapp = landingWhatsappLinkInput.value.trim();
    const tiktok = landingTiktokInput.value.trim();
    const telegram = landingTelegramInput.value.trim();

    setLoadingButton(btnSaveSocialLinks, true);

    try {
      await setDoc(doc(db, "settings", "socialLinks"), {
        instagram, whatsapp, tiktok, telegram,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert("Links de redes sociales guardados.");
      loadSocialLinks();
    } catch (err) {
      console.error(err);
      alert("No se pudieron guardar los links de redes.");
    } finally {
      setLoadingButton(btnSaveSocialLinks, false, "Guardar");
    }
  });
}

/****************************************************
 * ANALYTICS BÁSICOS
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

      const attemptsSnap = await getDocs(collection(db, "users", email, "examAttempts"));
      if (attemptsSnap.empty) continue;

      let sumScore = 0;
      let count = 0;

      attemptsSnap.forEach((a) => {
        const d = a.data();
        if (typeof d.score === "number") { sumScore += d.score; count++; }
      });

      const avg = count ? sumScore / count : 0;
      userRows.push({ name, email, avg, exams: count });
    }

    if (!userRows.length) {
      analyticsUsersBox.innerHTML = `<div class="card"><p>Aún no hay intentos de exámenes registrados.</p></div>`;
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
    analyticsSummaryBox.innerHTML = `<div class="card"><p>No se pudieron cargar las estadísticas.</p></div>`;
  }
}

console.log("admin.js cargado correctamente (fix bancos separados).");
