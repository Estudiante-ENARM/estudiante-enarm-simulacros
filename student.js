import { auth, db } from "./firebase-config.js";

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
  serverTimestamp,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import {
  SPECIALTIES,
  SUBTYPES,
  DIFFICULTIES,
  DIFFICULTY_WEIGHTS,
  DEFAULT_EXAM_RULES,
} from "./shared-constants.js";

// ✅ NUEVO: Biblioteca de Resúmenes/GPC (2° proyecto Firebase)
import { initStudentResourcesUI, activateStudentResources, setStudentResourcesUserIdentity } from "./student-resources.js";

/****************************************************
 * LABELS
 ****************************************************/
const SPECIALTY_LABELS = SPECIALTIES || {};
const SUBTYPE_LABELS = SUBTYPES || {};
const DIFFICULTY_LABELS = DIFFICULTIES || {};

/****************************************************
 * DOM
 ****************************************************/
// Layout / navegación
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

const btnMiniExamsSidebar = document.getElementById("student-mini-exams-btn");
const sidebarSections = document.getElementById("student-sidebar-sections");
const btnProgressView = document.getElementById("student-progress-btn");

// ✅ NUEVO: botón Biblioteca
const btnResourcesView = document.getElementById("student-resources-btn");

const socialButtons = document.querySelectorAll(".social-icon");

// Header
const studentUserEmailSpan = document.getElementById("student-user-email");
const btnLogout = document.getElementById("student-btn-logout");

// Vistas principales
const miniBuilderView = document.getElementById("student-mini-exams-view");
const miniExamPlaceholderView = document.getElementById("student-mini-exam-view");
const examsView = document.getElementById("student-exams-view");
const examDetailView = document.getElementById("student-exam-detail-view");
const progressView = document.getElementById("student-progress-view");

// ✅ NUEVO: vista Biblioteca
const resourcesView = document.getElementById("student-resources-view");

// Mini examen (constructor)
const miniNumQuestionsSelect = document.getElementById("student-mini-num-questions");
const miniSpecialtyCheckboxes = document.querySelectorAll(".student-mini-specialty");
const miniRandomCheckbox = document.getElementById("student-mini-random");
const miniRandomToggleBtn = document.querySelector(
  '#student-mini-exams-view label.mini-random-toggle[for="student-mini-random"]'
);
const miniStartBtn = document.getElementById("student-mini-start-btn");

// Exámenes por sección
const sectionTitle = document.getElementById("student-current-section-title");
const sectionSubtitle = document.getElementById("student-current-section-subtitle");
const examsList = document.getElementById("student-exams-list");

// Detalle de examen
const btnBackToExams = document.getElementById("student-btn-back-to-exams");
const examTitle = document.getElementById("student-exam-title");
const examSubtitle = document.getElementById("student-exam-subtitle");
const examTimerEl = document.getElementById("student-exam-timer");
const examMetaText = document.getElementById("student-exam-meta-text");
const questionsList = document.getElementById("student-questions-list");
const btnSubmitExam = document.getElementById("student-btn-submit-exam");

// Resultados
const resultBanner = document.getElementById("student-result-banner");
const resultValues = document.getElementById("student-result-values");

// Progreso
const progressUsername = document.getElementById("student-progress-username");
const progressSectionsContainer = document.getElementById("student-progress-sections");
const progressGlobalEl = document.getElementById("student-progress-global");
const progressChartCanvas = document.getElementById("student-progress-chart");

let progressChartInstance = null;

// Biblioteca (2° proyecto Firebase)
let resourcesActivatedOnce = false;

/****************************************************
 * ESTADO
 ****************************************************/
let currentUser = null;
let currentUserProfile = null;

let examRules = {
  maxAttempts: DEFAULT_EXAM_RULES?.maxAttempts || 3,
  timePerQuestionSeconds: DEFAULT_EXAM_RULES?.timePerQuestionSeconds || 90,
};

let currentView = "section";
let currentSectionId = null;
let currentSectionName = null;

let currentExamMode = null; // "section" | "mini"
let currentExamId = null;
let currentExamQuestions = [];
let currentExamTotalSeconds = 0;
let currentExamTimerId = null;
let currentExamPreviousAttempts = 0;

// Mini exámenes
let miniCasesCache = [];

// Tokens anti-superposición
let examsLoadToken = 0;
let progressLoadToken = 0;

/****************************************************
 * UTILIDADES
 ****************************************************/
function show(el) {
  if (el) el.classList.remove("hidden");
}
function hide(el) {
  if (el) el.classList.add("hidden");
}

function formatMinutesFromSeconds(totalSeconds) {
  const minutes = Math.ceil(totalSeconds / 60);
  return `${minutes} min`;
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function toFixedNice(num, decimals = 2) {
  if (!isFinite(num)) return "0";
  return Number(num.toFixed(decimals)).toString();
}

function renderEmptyMessage(container, text) {
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

function svgIcon(type) {
  if (type === "questions") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        <line x1="8" y1="9" x2="16" y2="9"></line>
        <line x1="8" y1="13" x2="13" y2="13"></line>
        <circle cx="9" cy="17" r="0.8"></circle>
      </svg>`;
  }
  if (type === "time") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="13" r="7"></circle>
        <polyline points="12 10 12 13 15 15"></polyline>
        <line x1="9" y1="4" x2="15" y2="4"></line>
      </svg>`;
  }
  if (type === "attempts") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v3"></path>
        <path d="M5.2 5.2l2.1 2.1"></path>
        <path d="M18.8 5.2l-2.1 2.1"></path>
        <circle cx="12" cy="14" r="6"></circle>
        <path d="M10 14l2 2 3-3"></path>
      </svg>`;
  }
  return "";
}


/****************************************************
 * PERSISTENCIA (REFRESH + ATRÁS)
 ****************************************************/
let isRestoringState = false;

// Examen en curso (para refresh)
let currentExamEndAtMs = null; // timestamp ms
let currentExamAnswers = {}; // { [qIndex:number]: "A"|"B"|"C"|"D" }

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStudentStorageKey(suffix) {
  const email = currentUser?.email || "anon";
  return `enarm_student_${suffix}_${encodeURIComponent(email)}`;
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function readStudentState() {
  if (!currentUser) return null;
  const raw = localStorage.getItem(getStudentStorageKey("state"));
  return safeJsonParse(raw, null);
}

function writeStudentState(next) {
  if (!currentUser) return;
  localStorage.setItem(getStudentStorageKey("state"), JSON.stringify(next));
}

function patchStudentState(patch) {
  const prev = readStudentState() || {};
  const next = { ...prev, ...patch };
  writeStudentState(next);
  return next;
}

function clearStudentExamState() {
  if (!currentUser) return;
  const prev = readStudentState() || {};
  const next = { ...prev };
  delete next.exam;
  // Nota: NO borramos view/section para que el usuario vuelva donde estaba.
  writeStudentState(next);
  clearExamAnswersStorage();
}

function pushHistoryState(nav, { replace = false } = {}) {
  if (isRestoringState) return;
  const payload = { studentNav: nav };
  try {
    if (replace) history.replaceState(payload, "");
    else history.pushState(payload, "");
  } catch (err) {
    // Algunos navegadores pueden fallar si el historial está bloqueado
    console.warn("No se pudo escribir history state:", err);
  }
}

function persistViewState(view) {
  patchStudentState({
    view,
    sectionId: currentSectionId || null,
    sectionName: currentSectionName || null,
  });
  pushHistoryState({ view, sectionId: currentSectionId || null, exam: null });
}

function buildCurrentExamState() {
  return {
    mode: currentExamMode || null,
    examId: currentExamId || null,
    examName: examTitle?.textContent || "",
    totalSeconds: currentExamTotalSeconds || 0,
    endAtMs: currentExamEndAtMs || null,
    sectionId: currentSectionId || null,
    sectionName: currentSectionName || null,
    questions: Array.isArray(currentExamQuestions) ? currentExamQuestions : [],
    answers: currentExamAnswers || {},
    savedAtMs: Date.now(),
  };
}

function persistCurrentExamState({ replaceHistory = false } = {}) {
  const exam = buildCurrentExamState();
  patchStudentState({
    view: "exam",
    sectionId: exam.sectionId,
    sectionName: exam.sectionName,
    exam,
  });
  pushHistoryState({ view: "exam", sectionId: exam.sectionId || null, exam }, { replace: replaceHistory });


function getExamAnswersStorageKey() {
  return getStudentStorageKey("exam_answers");
}

function readExamAnswersFromStorage() {
  if (!currentUser) return {};
  const raw = localStorage.getItem(getExamAnswersStorageKey());
  return safeJsonParse(raw, {}) || {};
}

function writeExamAnswersToStorage(answers) {
  if (!currentUser) return;
  localStorage.setItem(getExamAnswersStorageKey(), JSON.stringify(answers || {}));
}

function clearExamAnswersStorage() {
  if (!currentUser) return;
  localStorage.removeItem(getExamAnswersStorageKey());
}
}

function restoreAnswersToDOM() {
  if (!questionsList) return;
  const answers = currentExamAnswers || {};
  Object.keys(answers).forEach((k) => {
    const idx = Number(k);
    const val = answers[k];
    if (!Number.isFinite(idx) || !val) return;
    const input = document.querySelector(`input[name="q_${idx}"][value="${val}"]`);
    if (input) input.checked = true;
  });
}

function renderExamQuestionsFromCurrentState() {
  if (!questionsList) return;

  questionsList.innerHTML = "";

  if (!Array.isArray(currentExamQuestions) || currentExamQuestions.length === 0) {
    renderEmptyMessage(questionsList, "No se han cargado preguntas.");
    return;
  }

  let globalIndex = 0;
  let caseIndex = 0;

  let activeCaseText = null;
  let activeCaseSpecialty = null;
  let caseBlock = null;
  let questionsWrapper = null;
  let localIndex = 0;

  currentExamQuestions.forEach((q) => {
    const caseText = q.caseText || "";
    const specialtyKey = q.specialty || null;

    if (caseText !== activeCaseText) {
      // cierra caso anterior
      if (caseBlock && questionsWrapper) {
        caseBlock.appendChild(questionsWrapper);
        questionsList.appendChild(caseBlock);
      }

      // abre nuevo caso
      caseIndex += 1;
      activeCaseText = caseText;
      activeCaseSpecialty = specialtyKey;
      localIndex = 0;

      caseBlock = document.createElement("div");
      caseBlock.className = "case-block";

      caseBlock.innerHTML = `
        <h4>Caso clínico ${caseIndex}</h4>
        <div class="case-text">${caseText}</div>
      `;

      questionsWrapper = document.createElement("div");
    }

    const idx = globalIndex;

    const difficultyLabel = DIFFICULTY_LABELS[q.difficulty] || "No definida";
    const subtypeLabel = SUBTYPE_LABELS[q.subtype] || "General";
    const specialtyLabel =
      SPECIALTY_LABELS[activeCaseSpecialty] ||
      activeCaseSpecialty ||
      "No definida";

    const qBlock = document.createElement("div");
    qBlock.className = "question-block";
    qBlock.dataset.qIndex = idx;

    qBlock.innerHTML = `
      <h5>Pregunta ${localIndex + 1}</h5>
      <p>${q.questionText || ""}</p>

      <div class="panel-subtitle question-meta" style="font-size:12px;margin-bottom:8px;display:none;">
        Especialidad: <strong>${specialtyLabel}</strong> ·
        Tipo: <strong>${subtypeLabel}</strong> ·
        Dificultad: <strong>${difficultyLabel}</strong>
      </div>

      <div class="question-options">
        <label><input type="radio" name="q_${idx}" value="A"> A) ${q.optionA || ""}</label>
        <label><input type="radio" name="q_${idx}" value="B"> B) ${q.optionB || ""}</label>
        <label><input type="radio" name="q_${idx}" value="C"> C) ${q.optionC || ""}</label>
        <label><input type="radio" name="q_${idx}" value="D"> D) ${q.optionD || ""}</label>
      </div>

      <div class="justification-box">
        <strong>Justificación:</strong><br>
        ${q.justification || ""}
      </div>
    `;

    questionsWrapper.appendChild(qBlock);
    globalIndex += 1;
    localIndex += 1;
  });

  // último caso
  if (caseBlock && questionsWrapper) {
    caseBlock.appendChild(questionsWrapper);
    questionsList.appendChild(caseBlock);
  }
}

async function restoreExamFromState(examState, { replaceHistory = false } = {}) {
  if (!examState || !Array.isArray(examState.questions) || examState.questions.length === 0) {
    return false;
  }

  // restaura estado base
  currentExamMode = examState.mode || null;
  currentExamId = examState.examId || null;
  currentExamTotalSeconds = Number(examState.totalSeconds) || 0;
  currentExamEndAtMs = Number(examState.endAtMs) || null;
  currentExamQuestions = examState.questions || [];
  // Respuestas: siempre priorizamos el storage separado (por si hubo cambios después de guardar el estado)
  currentExamAnswers = readExamAnswersFromStorage();
  currentExamPreviousAttempts = 0;

  if (examState.sectionId) currentSectionId = examState.sectionId;
  if (examState.sectionName) currentSectionName = examState.sectionName;

  // UI
  hide(examsView);
  hide(progressView);
  hide(resourcesView);
  hide(miniBuilderView);
  if (miniExamPlaceholderView) hide(miniExamPlaceholderView);
  show(examDetailView);

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  examTitle.textContent = examState.examName || (currentExamMode === "mini" ? "Mini examen personalizado" : "Examen");
  examSubtitle.textContent =
    currentExamMode === "mini"
      ? "Mini examen restaurado. Puedes continuar donde lo dejaste."
      : "Examen restaurado. Puedes continuar donde lo dejaste.";

  const totalQuestions = currentExamQuestions.length || 0;
  const totalSeconds = currentExamTotalSeconds || 0;

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos: <strong>${currentExamMode === "mini" ? "Sin límite" : "En curso"}</strong>
  `;

  if (btnSubmitExam) {
    btnSubmitExam.disabled = false;
    btnSubmitExam.style.display = "inline-flex";
  }

  renderExamQuestionsFromCurrentState();
  restoreAnswersToDOM();

  // Cronómetro por endAtMs
  startExamTimer(totalSeconds, currentExamEndAtMs);

  // si ya venció, auto-envía como lo haría el timer
  if (currentExamEndAtMs && Date.now() >= currentExamEndAtMs) {
    try {
      if (currentExamTimerId) {
        clearInterval(currentExamTimerId);
        currentExamTimerId = null;
      }
      if (examTimerEl) examTimerEl.textContent = "00:00";
      alert("El tiempo se agotó mientras estabas fuera, tu examen se enviará automáticamente.");
      // Guardamos en history/state antes de enviar
      persistCurrentExamState({ replaceHistory: true });
      await submitExamForStudent(true);
    } catch (err) {
      console.error("Error auto-enviando examen restaurado:", err);
    }
  }

  // persiste (para no perder en refresh consecutivo)
  persistCurrentExamState({ replaceHistory });

  return true;
}

async function restoreStudentStateAfterInit() {
  if (!currentUser) return false;

  const state = readStudentState();
  if (!state) return false;

  isRestoringState = true;
  try {
    if (state.exam) {
      const ok = await restoreExamFromState(state.exam, { replaceHistory: true });
      if (ok) return true;
    }

    const view = state.view || "section";
    if (view === "resources") {
      await switchToResourcesView({ restore: true });
      pushHistoryState({ view: "resources", sectionId: state.sectionId || null, exam: null }, { replace: true });
      return true;
    }
    if (view === "progress") {
      await switchToProgressView({ restore: true });
      pushHistoryState({ view: "progress", sectionId: state.sectionId || null, exam: null }, { replace: true });
      return true;
    }
    if (view === "mini") {
      switchToMiniView({ restore: true });
      pushHistoryState({ view: "mini", sectionId: state.sectionId || null, exam: null }, { replace: true });
      return true;
    }

    switchToSectionView({ restore: true });
    pushHistoryState({ view: "section", sectionId: state.sectionId || null, exam: null }, { replace: true });
    return true;
  } catch (err) {
    console.error("Error restaurando estado del estudiante:", err);
    return false;
  } finally {
    isRestoringState = false;
  }
}

// Soporte al gesto/botón "Atrás" en móviles
window.addEventListener("popstate", async (e) => {
  if (!currentUser) return;
  const nav = e.state?.studentNav;
  if (!nav) return;

  isRestoringState = true;
  try {
    if (nav.exam) {
      await restoreExamFromState(nav.exam, { replaceHistory: true });
      return;
    }

    if (nav.view === "resources") {
      await switchToResourcesView({ restore: true });
      return;
    }
    if (nav.view === "progress") {
      await switchToProgressView({ restore: true });
      return;
    }
    if (nav.view === "mini") {
      switchToMiniView({ restore: true });
      return;
    }
    switchToSectionView({ restore: true });
  } catch (err) {
    console.error("Error aplicando popstate estudiante:", err);
  } finally {
    isRestoringState = false;
  }
});

/****************************************************
 * AUTH ESTUDIANTE
 ****************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.email);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      alert("Tu usuario no está configurado en Firestore. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const data = snap.data();

    if (data.role !== "usuario") {
      alert("Este panel es solo para estudiantes.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (data.status && data.status !== "activo") {
      alert("Tu usuario está inactivo. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (data.expiryDate && data.expiryDate < today) {
      alert("Tu acceso ha vencido. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentUser = user;
    currentUserProfile = data;

    // Biblioteca: identidad por usuario para progreso local (resúmenes/GPC)
    try {
      setStudentResourcesUserIdentity(user.email);
    } catch (e) {
      console.warn("No se pudo setear identidad de biblioteca:", e);
    }

    if (studentUserEmailSpan) {
      studentUserEmailSpan.textContent = user.email;
    }

    await loadExamRules();
    await loadSocialLinksForStudent();
    await loadSectionsForStudent();

    // ✅ NUEVO: prepara UI de Biblioteca (sin cargar datos aún)
    initStudentResourcesUI();

    // ✅ Restaurar última vista (para evitar volver siempre a la 1ª sección)
    const restored = await restoreStudentStateAfterInit();
    if (!restored) {
      switchToSectionView();
    }
  } catch (err) {
    console.error("Error validando usuario estudiante", err);
    alert("Error validando tu acceso. Intenta más tarde.");
    await signOut(auth);
    window.location.href = "index.html";
  }
});

/****************************************************
 * LISTENERS GENERALES
 ****************************************************/
if (btnToggleSidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("No se pudo cerrar sesión. Intenta de nuevo.");
    }
  });
}

if (btnMiniExamsSidebar) {
  btnMiniExamsSidebar.addEventListener("click", () => {
    switchToMiniView();
  });
}

// ✅ NUEVO: Biblioteca (Resúmenes y GPC)
if (btnResourcesView) {
  btnResourcesView.addEventListener("click", () => {
    switchToResourcesView();
  });
}

if (btnProgressView) {
  btnProgressView.addEventListener("click", () => {
    switchToProgressView();
  });
}

if (miniStartBtn) {
  miniStartBtn.addEventListener("click", () => {
    startMiniExamFromBuilder();
  });
}

if (btnBackToExams) {
  btnBackToExams.addEventListener("click", () => {
    handleBackFromExam();
  });
}

if (btnSubmitExam) {
  btnSubmitExam.addEventListener("click", () => submitExamForStudent(false));
}

// ✅ NUEVO: Persistir respuestas seleccionadas (para no perder al refrescar)
if (questionsList && !questionsList.dataset.answersBound) {
  questionsList.dataset.answersBound = "1";
  questionsList.addEventListener("change", (e) => {
    const target = e.target;
    if (!target || !target.matches || !target.matches('input[type="radio"]')) return;

    const name = target.getAttribute("name") || "";
    if (!name.startsWith("q_")) return;

    const idx = Number(name.slice(2));
    if (!Number.isFinite(idx)) return;

    currentExamAnswers = currentExamAnswers || {};
    currentExamAnswers[idx] = target.value;

    // Evita guardar si no estamos en examen
    if (currentExamMode && currentExamQuestions && currentExamQuestions.length) {
      persistCurrentExamState({ replaceHistory: true });
    }
  });
}


/* chips especialidades mini examen (robusto) */
const miniSpecialtiesGrid = document.querySelector(
  "#student-mini-exams-view .mini-specialties-grid"
);

function syncMiniSpecialtyChip(chipEl, cbEl) {
  if (!chipEl || !cbEl) return;
  chipEl.classList.toggle("mini-specialty-chip--active", !!cbEl.checked);
  chipEl.setAttribute("aria-pressed", cbEl.checked ? "true" : "false");
}

function initMiniSpecialtyChips() {
  if (!miniSpecialtiesGrid) return;

  // Inicializa estado visual
  miniSpecialtiesGrid.querySelectorAll(".mini-specialty-chip").forEach((chip) => {
    const cb = chip.querySelector("input.student-mini-specialty");
    if (!cb) return;

    // Asegura que el click sobre el chip siempre funcione
    if (!chip.hasAttribute("tabindex")) chip.setAttribute("tabindex", "0");
    chip.setAttribute("role", "button");

    syncMiniSpecialtyChip(chip, cb);
  });

  // Evita doble-binding si cambias de vista
  if (miniSpecialtiesGrid.dataset.bound === "1") return;
  miniSpecialtiesGrid.dataset.bound = "1";

  // Click delegación
  miniSpecialtiesGrid.addEventListener("click", (e) => {
    const chip = e.target.closest(".mini-specialty-chip");
    if (!chip || !miniSpecialtiesGrid.contains(chip)) return;

    // Si el usuario hizo click directo en el input, deja que el navegador lo maneje
    if (e.target && e.target.matches && e.target.matches("input.student-mini-specialty")) {
      const cb = e.target;
      syncMiniSpecialtyChip(chip, cb);
      return;
    }

    e.preventDefault();
    const cb = chip.querySelector("input.student-mini-specialty");
    if (!cb) return;

    cb.checked = !cb.checked;
    syncMiniSpecialtyChip(chip, cb);
  });

  // Enter/Espacio
  miniSpecialtiesGrid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;

    const chip = e.target.closest(".mini-specialty-chip");
    if (!chip || !miniSpecialtiesGrid.contains(chip)) return;

    e.preventDefault();
    const cb = chip.querySelector("input.student-mini-specialty");
    if (!cb) return;

    cb.checked = !cb.checked;
    syncMiniSpecialtyChip(chip, cb);
  });

  // Si el checkbox cambia (por cualquier razón), sincroniza clase
  miniSpecialtiesGrid.querySelectorAll("input.student-mini-specialty").forEach((cb) => {
    cb.addEventListener("change", () => {
      const chip = cb.closest(".mini-specialty-chip");
      if (chip) syncMiniSpecialtyChip(chip, cb);
    });
  });
}

initMiniSpecialtyChips();

/* toggle aleatorio mini examen (CSS lo controla; aquí solo accesibilidad) */
if (miniRandomCheckbox) {
  const syncRandom = () => {
    if (miniRandomToggleBtn) {
      miniRandomToggleBtn.setAttribute(
        "aria-pressed",
        miniRandomCheckbox.checked ? "true" : "false"
      );
    }
  };
  syncRandom();
  miniRandomCheckbox.addEventListener("change", syncRandom);
}


async function ensureStudentResourcesActivated() {
  // Inicializa UI (idempotente) y activa carga remota una sola vez
  initStudentResourcesUI();
  if (resourcesActivatedOnce) return;
  await activateStudentResources();
  resourcesActivatedOnce = true;
}

/****************************************************
 * CAMBIO DE VISTAS
 ****************************************************/
function switchToMiniView(opts = {}) {
  currentView = "mini";
  hide(examsView);
  hide(examDetailView);
  hide(progressView);
  hide(resourcesView);
  if (miniExamPlaceholderView) hide(miniExamPlaceholderView);
  show(miniBuilderView);
  // Re-sincroniza chips/toggle al entrar a mini-exámenes
  initMiniSpecialtyChips();
  sidebar.classList.remove("sidebar--open");
  if (!opts.restore) persistViewState("mini");
}

function switchToSectionView(opts = {}) {
  currentView = "section";
  hide(miniBuilderView);
  hide(miniExamPlaceholderView);
  hide(examDetailView);
  hide(progressView);
  hide(resourcesView);
  show(examsView);
  sidebar.classList.remove("sidebar--open");
  if (!opts.restore) persistViewState("section");
}

// ✅ NUEVO: Vista Biblioteca (Resúmenes y GPC)
async function switchToResourcesView(opts = {}) {
  currentView = "resources";
  hide(miniBuilderView);
  hide(miniExamPlaceholderView);
  hide(examsView);
  hide(examDetailView);
  hide(progressView);
  show(resourcesView);
  sidebar.classList.remove("sidebar--open");

  if (!opts.restore) {
    persistViewState("resources");
  }

  try {
    // Inicializa UI (una sola vez) y luego carga datos del otro proyecto Firebase
    await ensureStudentResourcesActivated();
  } catch (err) {
    console.error("Error activando la biblioteca:", err);
  }
}

async function switchToProgressView(opts = {}) {
  currentView = "progress";
  hide(miniBuilderView);
  hide(miniExamPlaceholderView);
  hide(examsView);
  hide(examDetailView);
  hide(resourcesView);
  show(progressView);
  sidebar.classList.remove("sidebar--open");

  if (!opts.restore) {
    persistViewState("progress");
  }
  await loadStudentProgress();
}

/****************************************************
 * CONFIGURACIÓN GLOBAL
 ****************************************************/
async function loadExamRules() {
  try {
    const snap = await getDoc(doc(db, "examRules", "default"));
    if (!snap.exists()) return;

    const data = snap.data();
    if (typeof data.maxAttempts === "number") {
      examRules.maxAttempts = data.maxAttempts;
    }
    if (typeof data.timePerQuestionSeconds === "number") {
      examRules.timePerQuestionSeconds = data.timePerQuestionSeconds;
    }
  } catch (err) {
    console.error("Error leyendo examRules/default:", err);
  }
}

/****************************************************
 * REDES SOCIALES
 ****************************************************/
async function loadSocialLinksForStudent() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (snap.exists()) {
      const data = snap.data();
      socialButtons.forEach((btn) => {
        const network = btn.dataset.network;
        if (data[network]) btn.dataset.url = data[network];
        else delete btn.dataset.url;
      });
    }
  } catch (err) {
    console.error("Error leyendo settings/socialLinks:", err);
  }

  socialButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) {
        alert("Aún no se ha configurado el enlace de esta red social.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}


function selectSectionForStudent({ id, name, li, shouldSwitchView = true }) {
  if (!id) return;

  document
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));

  if (li) li.classList.add("sidebar__section-item--active");

  currentSectionId = id;
  currentSectionName = name || "Sección";

  if (sectionTitle) sectionTitle.textContent = currentSectionName;
  if (sectionSubtitle) sectionSubtitle.textContent = "Simulacros de esta sección.";

  // Persistimos selección aunque no cambiemos vista (para refresh)
  patchStudentState({ sectionId: currentSectionId, sectionName: currentSectionName });

  if (shouldSwitchView) {
    switchToSectionView();
  }

  loadExamsForSectionForStudent(id);
}

/****************************************************
 * SECCIONES (ESTUDIANTE)
 ****************************************************/
async function loadSectionsForStudent() {
  // Usar el mismo orden que en admin: campo "order" ascendente
  const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(qSec);

  sidebarSections.innerHTML = "";

  // Preferir la última sección seleccionada por el usuario (para refresh)
  const savedState = readStudentState();
  const preferredSectionId = savedState?.sectionId || null;

  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="font-size:12px;color:#cbd5f5;padding:4px 6px;">
        Aún no hay secciones configuradas.
      </li>`;
    renderEmptyMessage(examsList, "No hay exámenes disponibles.");
    return;
  }

  let firstSectionId = null;
  let firstSectionName = null;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "Sección sin título";

    if (firstSectionId == null) {
      firstSectionId = id;
      firstSectionName = name;
    }

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.dataset.sectionId = id;
    li.innerHTML = `<div class="sidebar__section-name">${name}</div>`;

    li.addEventListener("click", () => {
      selectSectionForStudent({ id, name, li, shouldSwitchView: true });
    });

    sidebarSections.appendChild(li);
  });

  // Seleccionar sección (preferida o la primera) sin forzar cambiar de vista aquí
  const targetSectionId = preferredSectionId && sidebarSections.querySelector(`[data-section-id="${preferredSectionId}"]`)
    ? preferredSectionId
    : firstSectionId;

  if (targetSectionId) {
    const liTarget = sidebarSections.querySelector(`[data-section-id="${targetSectionId}"]`) || sidebarSections.querySelector(".sidebar__section-item");
    const nameTarget = liTarget ? liTarget.querySelector(".sidebar__section-name")?.textContent || firstSectionName : firstSectionName;

    selectSectionForStudent({
      id: targetSectionId,
      name: nameTarget,
      li: liTarget,
      shouldSwitchView: false,
    });
  }
}

/****************************************************
 * EXÁMENES POR SECCIÓN (LISTA OPTIMIZADA)
 ****************************************************/
async function loadExamsForSectionForStudent(sectionId) {
  const thisToken = ++examsLoadToken;

  if (!examsList) return;
  examsList.innerHTML = `
    <div class="card">
      <p class="panel-subtitle">Cargando exámenes…</p>
    </div>
  `;

  if (!sectionId) {
    if (thisToken !== examsLoadToken) return;
    renderEmptyMessage(examsList, "No se ha seleccionado ninguna sección.");
    return;
  }

  try {
    const qEx = query(
      collection(db, "exams"),
      where("sectionId", "==", sectionId)
    );
    const snap = await getDocs(qEx);

    if (thisToken !== examsLoadToken || sectionId !== currentSectionId) {
      return;
    }

    if (snap.empty) {
      renderEmptyMessage(examsList, "No hay exámenes disponibles en esta sección.");
      return;
    }

    const fragment = document.createDocumentFragment();

    const examsData = await Promise.all(
      snap.docs.map(async (docSnap) => {
        const exData = docSnap.data();
        const examId = docSnap.id;
        const examName = exData.name || "Examen sin título";

        let attemptsUsed = 0;
        let lastAttemptText = "Sin intentos previos.";
        let totalQuestions = 0;

        const qQuestions = query(
          collection(db, "questions"),
          where("examId", "==", examId)
        );

        if (currentUser) {
          const attemptRef = doc(
            db,
            "users",
            currentUser.email,
            "examAttempts",
            examId
          );

          const [attemptSnap, qSnap] = await Promise.all([
            getDoc(attemptRef),
            getDocs(qQuestions),
          ]);

          if (attemptSnap.exists()) {
            const at = attemptSnap.data();
            attemptsUsed = at.attempts || 0;
            if (at.lastAttempt && typeof at.lastAttempt.toDate === "function") {
              lastAttemptText = at.lastAttempt.toDate().toLocaleDateString();
            }
          }

          qSnap.forEach((qDoc) => {
            const qData = qDoc.data();
            const arr = Array.isArray(qData.questions) ? qData.questions : [];
            totalQuestions += arr.length;
          });
        } else {
          const qSnap = await getDocs(qQuestions);
          qSnap.forEach((qDoc) => {
            const qData = qDoc.data();
            const arr = Array.isArray(qData.questions) ? qData.questions : [];
            totalQuestions += arr.length;
          });
        }

        return {
          examId,
          examName,
          attemptsUsed,
          lastAttemptText,
          totalQuestions,
        };
      })
    );

    if (thisToken !== examsLoadToken || sectionId !== currentSectionId) {
      return;
    }

    if (!examsData.length) {
      renderEmptyMessage(examsList, "No hay exámenes disponibles en esta sección.");
      return;
    }

    const maxAttempts = examRules.maxAttempts;
    const timePerQuestion = examRules.timePerQuestionSeconds;

    examsData.forEach(
      ({ examId, examName, attemptsUsed, lastAttemptText, totalQuestions }) => {
        if (totalQuestions === 0) {
          const card = document.createElement("div");
          card.className = "card-item";
          card.innerHTML = `
            <div class="card-item__title-row">
              <div class="card-item__title">${examName}</div>
              <span class="badge" style="background:#fbbf24;color:#78350f;">En preparación</span>
            </div>
            <div class="panel-subtitle" style="margin-top:8px;">
              Aún no hay preguntas cargadas para este examen.
            </div>
          `;
          fragment.appendChild(card);
          return;
        }

        const totalSeconds = totalQuestions * timePerQuestion;
        const totalTimeFormatted = formatMinutesFromSeconds(totalSeconds);
        const disabled = attemptsUsed >= maxAttempts;
        const statusText = disabled ? "Sin intentos disponibles" : "Disponible";

        const card = document.createElement("div");
        card.className = "card-item";
        if (disabled) card.style.opacity = 0.7;

        card.innerHTML = `
          <div class="card-item__title-row" style="align-items:flex-start;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(37,99,235,0.08);">
                <svg width="26" height="26" viewBox="0 0 24 24" stroke="#1d4ed8" stroke-width="1.8" fill="none">
                  <rect x="3" y="4" width="18" height="15" rx="2"></rect>
                  <line x1="7" y1="9" x2="17" y2="9"></line>
                  <line x1="7" y1="13" x2="12" y2="13"></line>
                </svg>
              </div>
              <div>
                <div class="card-item__title">${examName}</div>
                <div class="panel-subtitle" style="margin-top:3px;">
                  Simulacro ENARM · ${currentSectionName || "Sección"}
                </div>
              </div>
            </div>

            <span class="badge">
              <span class="badge-dot"></span>${statusText}
            </span>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;font-size:13px;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${svgIcon("questions")}
              <div>
                <strong>${totalQuestions} preguntas</strong>
                <div class="panel-subtitle">Casos clínicos</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
              ${svgIcon("time")}
              <div>
                <strong>${totalTimeFormatted}</strong>
                <div class="panel-subtitle">Tiempo estimado</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
              ${svgIcon("attempts")}
              <div>
                <strong>Intentos: ${attemptsUsed} / ${maxAttempts}</strong>
                <div class="panel-subtitle">Último intento: ${lastAttemptText}</div>
              </div>
            </div>
          </div>

          <div style="margin-top:14px;text-align:right;">
            ${
              disabled
                ? `<button class="btn btn-outline" disabled>Sin intentos disponibles</button>`
                : `<button class="btn btn-primary student-start-exam-btn">Iniciar examen</button>`
            }
          </div>
        `;

        if (!disabled) {
          const btnStart = card.querySelector(".student-start-exam-btn");
          btnStart.addEventListener("click", () => {
            startSectionExamForStudent({
              examId,
              examName,
              totalQuestions,
              totalSeconds,
              attemptsUsed,
              maxAttempts,
            });
          });
        }

        fragment.appendChild(card);
      }
    );

    examsList.innerHTML = "";
    examsList.appendChild(fragment);
  } catch (err) {
    console.error("Error cargando exámenes de la sección:", err);
    if (thisToken !== examsLoadToken) return;
    renderEmptyMessage(
      examsList,
      "Hubo un error al cargar los exámenes. Intenta nuevamente."
    );
  }
}

/****************************************************
 * SHUFFLE
 ****************************************************/
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/****************************************************
 * MINI EXÁMENES – CARGA BANCO
 ****************************************************/
async function loadMiniCasesOnce() {
  if (miniCasesCache.length > 0) return;

  try {
    const snap = await getDocs(collection(db, "miniQuestions"));
    if (snap.empty) {
      miniCasesCache = [];
      return;
    }

    const arr = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const caseText = data.caseText || "";
      const specialty = data.specialty || null;
      const questions = Array.isArray(data.questions) ? data.questions : [];

      if (!caseText || questions.length === 0) return;

      arr.push({
        id: docSnap.id,
        caseText,
        specialty,
        questions,
      });
    });

    miniCasesCache = arr;
  } catch (err) {
    console.error("Error cargando miniQuestions:", err);
    miniCasesCache = [];
  }
}

/****************************************************
 * MINI EXÁMENES – CONSTRUIR EXAMEN
 ****************************************************/
async function startMiniExamFromBuilder() {
  if (!miniNumQuestionsSelect) {
    alert("El módulo de mini exámenes no está configurado en esta vista.");
    return;
  }

  const numQuestions = parseInt(miniNumQuestionsSelect.value, 10) || 10;

  const selectedSpecialties = Array.from(miniSpecialtyCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  const randomOnly = miniRandomCheckbox ? miniRandomCheckbox.checked : true;

  await loadMiniCasesOnce();

  if (!miniCasesCache.length) {
    alert("Aún no hay casos clínicos configurados para mini exámenes.");
    return;
  }

  let poolCases = miniCasesCache.slice();
  if (selectedSpecialties.length > 0) {
    poolCases = poolCases.filter((c) =>
      selectedSpecialties.includes(c.specialty)
    );
  }

  if (!poolCases.length) {
    alert("No hay casos clínicos que coincidan con los filtros elegidos.");
    return;
  }

  const questionPool = [];
  poolCases.forEach((caseData) => {
    const specialty = caseData.specialty || null;
    const caseText = caseData.caseText || "";
    (caseData.questions || []).forEach((q) => {
      questionPool.push({
        caseId: caseData.id,
        caseText,
        specialty,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        justification: q.justification,
        difficulty: q.difficulty || "baja",
        subtype: q.subtype || "salud_publica",
      });
    });
  });

  if (!questionPool.length) {
    alert("No se encontraron preguntas en los casos seleccionados.");
    return;
  }

  const basePool = randomOnly ? shuffleArray(questionPool) : questionPool;
  const selectedQuestions = basePool.slice(0, numQuestions);

  if (!selectedQuestions.length) {
    alert("No se pudieron seleccionar preguntas para el mini examen.");
    return;
  }

  currentExamMode = "mini";
  currentExamId = null;
  currentExamPreviousAttempts = 0;
  currentExamQuestions = [];
  currentExamEndAtMs = Date.now() + totalSeconds * 1000;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);

  const timePerQuestion = examRules.timePerQuestionSeconds;
  currentExamTotalSeconds = selectedQuestions.length * timePerQuestion;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  hide(examsView);
  hide(progressView);
  hide(resourcesView);
  hide(miniBuilderView);
  if (miniExamPlaceholderView) hide(miniExamPlaceholderView);
  show(examDetailView);

  examTitle.textContent = "Mini examen personalizado";
  examSubtitle.textContent =
    "Resuelve el mini examen con preguntas aleatorias de los casos clínicos disponibles.";

  const totalQuestions = selectedQuestions.length;

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(
      currentExamTotalSeconds
    )}</strong><br>
    🔁 Intentos: <strong>Sin límite</strong>
  `;

  questionsList.innerHTML = "";

  const caseMap = new Map();
  selectedQuestions.forEach((q) => {
    if (!caseMap.has(q.caseId)) {
      caseMap.set(q.caseId, {
        caseText: q.caseText,
        specialty: q.specialty,
        questions: [],
      });
    }
    caseMap.get(q.caseId).questions.push(q);
  });

  let globalIndex = 0;

  Array.from(caseMap.values()).forEach((caseData, caseIndex) => {
    const caseBlock = document.createElement("div");
    caseBlock.className = "case-block";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="case-text">${caseData.caseText}</div>
    `;

    const questionsWrapper = document.createElement("div");

    caseData.questions.forEach((q, localIndex) => {
      const idx = globalIndex;

      currentExamQuestions.push({
        caseText: caseData.caseText,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        justification: q.justification,
        specialty: caseData.specialty,
        difficulty: q.difficulty || "baja",
        subtype: q.subtype || "salud_publica",
      });

      const difficultyLabel =
        DIFFICULTY_LABELS[q.difficulty] || "No definida";
      const subtypeLabel = SUBTYPE_LABELS[q.subtype] || "General";
      const specialtyLabel =
        SPECIALTY_LABELS[caseData.specialty] ||
        caseData.specialty ||
        "No definida";

      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.dataset.qIndex = idx;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${q.questionText}</p>

        <div class="panel-subtitle question-meta" style="font-size:12px;margin-bottom:8px;display:none;">
          Especialidad: <strong>${specialtyLabel}</strong> ·
          Tipo: <strong>${subtypeLabel}</strong> ·
          Dificultad: <strong>${difficultyLabel}</strong>
        </div>

        <div class="question-options">
          <label><input type="radio" name="q_${idx}" value="A"> A) ${q.optionA}</label>
          <label><input type="radio" name="q_${idx}" value="B"> B) ${q.optionB}</label>
          <label><input type="radio" name="q_${idx}" value="C"> C) ${q.optionC}</label>
          <label><input type="radio" name="q_${idx}" value="D"> D) ${q.optionD}</label>
        </div>

        <div class="justification-box">
          <strong>Justificación:</strong><br>
          ${q.justification || ""}
        </div>
      `;

      questionsWrapper.appendChild(qBlock);
      globalIndex++;
    });

    caseBlock.appendChild(questionsWrapper);
    questionsList.appendChild(caseBlock);
  });

  // Persistencia para refresh
  currentExamEndAtMs = Date.now() + currentExamTotalSeconds * 1000;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);
  persistCurrentExamState();

  startExamTimer(currentExamTotalSeconds, currentExamEndAtMs);
}

/****************************************************
 * EXÁMENES POR SECCIÓN – INICIAR
 ****************************************************/
async function startSectionExamForStudent({
  examId,
  examName,
  totalQuestions,
  totalSeconds,
  attemptsUsed,
  maxAttempts,
}) {
  if (attemptsUsed >= maxAttempts) {
    alert("Has agotado tus intentos para este examen.");
    return;
  }

  currentExamMode = "section";
  currentExamId = examId;
  currentExamTotalSeconds = totalSeconds;
  currentExamPreviousAttempts = attemptsUsed;
  currentExamQuestions = [];
  currentExamEndAtMs = Date.now() + totalSeconds * 1000;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  hide(examsView);
  hide(progressView);
  hide(resourcesView);
  hide(miniBuilderView);
  if (miniExamPlaceholderView) hide(miniExamPlaceholderView);
  show(examDetailView);

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  examTitle.textContent = examName;
  examSubtitle.textContent =
    "Resuelve cuidadosamente y envía antes de que termine el tiempo.";

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(
      totalSeconds
    )}</strong><br>
    🔁 Intentos: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  await loadQuestionsForSectionExam(examId);
  // Persistencia para refresh
  currentExamEndAtMs = Date.now() + currentExamTotalSeconds * 1000;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);
  persistCurrentExamState();

  startExamTimer(currentExamTotalSeconds, currentExamEndAtMs);
}

/****************************************************
 * CARGAR PREGUNTAS EXAMEN POR SECCIÓN
 ****************************************************/
async function loadQuestionsForSectionExam(examId) {
  questionsList.innerHTML = "";

  const qQuestions = query(
    collection(db, "questions"),
    where("examId", "==", examId)
  );
  const snap = await getDocs(qQuestions);

  if (snap.empty) {
    renderEmptyMessage(questionsList, "No se han cargado preguntas.");
    return;
  }

  const cases = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const caseText = data.caseText || "";
    const arr = Array.isArray(data.questions) ? data.questions : [];
    const specialtyKey = data.specialty || null;

    if (arr.length > 0) {
      cases.push({
        caseText,
        specialty: specialtyKey,
        questions: arr,
      });
    }
  });

  if (!cases.length) {
    renderEmptyMessage(questionsList, "No existen preguntas configuradas.");
    return;
  }

  currentExamQuestions = [];
  currentExamEndAtMs = Date.now() + totalSeconds * 1000;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);
  let globalIndex = 0;

  cases.forEach((caseData, caseIndex) => {
    const caseBlock = document.createElement("div");
    caseBlock.className = "case-block";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="case-text">${caseData.caseText}</div>
    `;

    const questionsWrapper = document.createElement("div");

    caseData.questions.forEach((q, localIndex) => {
      const idx = globalIndex;

      currentExamQuestions.push({
        caseText: caseData.caseText,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        justification: q.justification,
        specialty: caseData.specialty,
        difficulty: q.difficulty || "baja",
        subtype: q.subtype || "salud_publica",
      });

      const difficultyLabel =
        DIFFICULTY_LABELS[q.difficulty] || "No definida";
      const subtypeLabel = SUBTYPE_LABELS[q.subtype] || "General";
      const specialtyLabel =
        SPECIALTY_LABELS[caseData.specialty] ||
        caseData.specialty ||
        "No definida";

      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.dataset.qIndex = idx;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${q.questionText}</p>

        <div class="panel-subtitle question-meta" style="font-size:12px;margin-bottom:8px;display:none;">
          Especialidad: <strong>${specialtyLabel}</strong> ·
          Tipo: <strong>${subtypeLabel}</strong> ·
          Dificultad: <strong>${difficultyLabel}</strong>
        </div>

        <div class="question-options">
          <label><input type="radio" name="q_${idx}" value="A"> A) ${q.optionA}</label>
          <label><input type="radio" name="q_${idx}" value="B"> B) ${q.optionB}</label>
          <label><input type="radio" name="q_${idx}" value="C"> C) ${q.optionC}</label>
          <label><input type="radio" name="q_${idx}" value="D"> D) ${q.optionD}</label>
        </div>

        <div class="justification-box">
          <strong>Justificación:</strong><br>
          ${q.justification || ""}
        </div>
      `;

      questionsWrapper.appendChild(qBlock);
      globalIndex++;
    });

    caseBlock.appendChild(questionsWrapper);
    questionsList.appendChild(caseBlock);
  });
}

/****************************************************
 * CRONÓMETRO
 ****************************************************/
function startExamTimer(totalSeconds, endAtMs = null) {
  if (!examTimerEl) return;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
  }

  // Si no viene endAtMs, lo calculamos (modo tradicional)
  if (!endAtMs) {
    endAtMs = Date.now() + (Number(totalSeconds) || 0) * 1000;
  }

  currentExamEndAtMs = endAtMs;

  const computeRemaining = () => {
    const diffMs = (currentExamEndAtMs || 0) - Date.now();
    return Math.max(0, Math.ceil(diffMs / 1000));
  };

  let remaining = computeRemaining();
  examTimerEl.textContent = formatTimer(remaining);

  currentExamTimerId = setInterval(() => {
    remaining = computeRemaining();

    if (remaining <= 0) {
      clearInterval(currentExamTimerId);
      currentExamTimerId = null;
      examTimerEl.textContent = "00:00";
      alert("El tiempo se agotó, tu examen se enviará automáticamente.");
      submitExamForStudent(true);
      return;
    }

    examTimerEl.textContent = formatTimer(remaining);
  }, 1000);
}



/****************************************************
 * ENVÍO DE EXAMEN
 ****************************************************/
async function submitExamForStudent(auto = false) {
  if (!currentExamQuestions.length) {
    alert("No hay examen cargado.");
    return;
  }

  if (btnSubmitExam) btnSubmitExam.disabled = true;
  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  const totalQuestions = currentExamQuestions.length;
  let globalCorrect = 0;
  let globalWeightedCorrect = 0;
  let globalWeightedTotal = 0;

  const detail = {};

  const specStats = {};
  Object.keys(SPECIALTY_LABELS).forEach((k) => {
    specStats[k] = {
      name: SPECIALTY_LABELS[k],
      correct: 0,
      total: 0,
      subtypes: {
        salud_publica: { correct: 0, total: 0 },
        medicina_familiar: { correct: 0, total: 0 },
        urgencias: { correct: 0, total: 0 },
      },
    };
  });

  const difficultyStats = {
    alta: { correct: 0, total: 0 },
    media: { correct: 0, total: 0 },
    baja: { correct: 0, total: 0 },
  };

  currentExamQuestions.forEach((q, idx) => {
    const selectedInput = document.querySelector(
      `input[name="q_${idx}"]:checked`
    );
    const selected = selectedInput ? selectedInput.value : null;

    const correct = q.correctOption;
    const result = selected === correct ? "correct" : "incorrect";

    const specialty = q.specialty;
    const difficulty = q.difficulty || "baja";
    const subtype = q.subtype || "salud_publica";

    const weight = DIFFICULTY_WEIGHTS[difficulty] || 1;
    globalWeightedTotal += weight;

    if (result === "correct") {
      globalCorrect++;
      globalWeightedCorrect += weight;
    }

    if (specialty && specStats[specialty]) {
      specStats[specialty].total++;
      if (result === "correct") specStats[specialty].correct++;

      if (specStats[specialty].subtypes[subtype]) {
        specStats[specialty].subtypes[subtype].total++;
        if (result === "correct") {
          specStats[specialty].subtypes[subtype].correct++;
        }
      }
    }

    if (difficultyStats[difficulty]) {
      difficultyStats[difficulty].total++;
      if (result === "correct") difficultyStats[difficulty].correct++;
    }

    detail[`q${idx}`] = {
      selected,
      correctOption: correct,
      result,
      specialty,
      difficulty,
      subtype,
      weight,
    };

    const card = questionsList.querySelector(
      `[data-q-index="${idx}"]`
    );
    if (card) {
      const just = card.querySelector(".justification-box");
      const meta = card.querySelector(".question-meta");

      if (just) just.style.display = "block";
      if (meta) meta.style.display = "block";

      const labels = card.querySelectorAll("label");
      labels.forEach((lab) => {
        const input = lab.querySelector("input");
        if (!input) return;

        lab.style.border = "1px solid transparent";
        lab.style.borderRadius = "6px";
        lab.style.padding = "4px 6px";

        if (input.value === correct) {
          lab.style.borderColor = "#16a34a";
          lab.style.background = "#dcfce7";
        }
        if (selected === input.value && selected !== correct) {
          lab.style.borderColor = "#b91c1c";
          lab.style.background = "#fee2e2";
        }
      });
    }
  });

  const scoreRaw =
    totalQuestions > 0
      ? Math.round((globalCorrect / totalQuestions) * 100)
      : 0;

  const scoreWeighted =
    globalWeightedTotal > 0
      ? (globalWeightedCorrect / globalWeightedTotal) * 100
      : 0;

  if (currentExamMode === "section" && currentExamId && currentUser) {
    try {
      const attemptRef = doc(
        db,
        "users",
        currentUser.email,
        "examAttempts",
        currentExamId
      );

      const prevSnap = await getDoc(attemptRef);
      const prevData = prevSnap.exists() ? prevSnap.data() : {};
      const oldAttempts =
        typeof prevData.attempts === "number"
          ? prevData.attempts
          : currentExamPreviousAttempts || 0;

      const historyEntry = {
        score: scoreWeighted,
        scoreRaw,
        correctCount: globalCorrect,
        totalQuestions,
        sectionId: currentSectionId,
        sectionName: currentSectionName || "",
        createdAt: new Date(),
      };

      await setDoc(
        attemptRef,
        {
          attempts: oldAttempts + 1,
          lastAttempt: serverTimestamp(),
          score: scoreWeighted,
          scoreRaw,
          correctCount: globalCorrect,
          totalQuestions,
          weightedPoints: globalWeightedCorrect,
          weightedTotal: globalWeightedTotal,
          detail,
          breakdown: {
            specialties: specStats,
            difficulties: difficultyStats,
          },
          history: arrayUnion(historyEntry),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error guardando intento de examen:", err);
      alert(
        "Hubo un error guardando tu intento, pero se calcularon tus resultados."
      );
    }
  }

  // El examen ya se procesó; limpiar persistencia de examen en curso
  clearStudentExamState();

  renderPremiumResults({
    auto,
    globalCorrect,
    totalQuestions,
    scoreWeighted,
    weightedPoints: globalWeightedCorrect,
    weightedTotal: globalWeightedTotal,
    specStats,
    difficultyStats,
  });

  if (btnSubmitExam) {
    btnSubmitExam.disabled = true;
    btnSubmitExam.style.display = "none";
  }
}

/****************************************************
 * RESULTADOS – TABLAS
 ****************************************************/
function renderPremiumResults({
  auto,
  globalCorrect,
  totalQuestions,
  scoreWeighted,
  weightedPoints,
  weightedTotal,
  specStats,
  difficultyStats,
}) {
  if (!resultBanner || !resultValues) {
    alert(
      `Examen enviado.\nAciertos: ${globalCorrect}/${totalQuestions}\nCalificación: ${toFixedNice(
        scoreWeighted
      )}%`
    );
    return;
  }

  const message = auto
    ? "El examen fue enviado automáticamente al agotarse el tiempo."
    : "Tu examen se envió correctamente. Revisa tus resultados detallados.";

  const weightedLine = `${toFixedNice(weightedPoints, 2)} / ${toFixedNice(
    weightedTotal,
    2
  )} puntos`;

  const tableGeneral = `
    <table class="result-table">
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Aciertos</td>
          <td>${globalCorrect} de ${totalQuestions}</td>
        </tr>
        <tr>
          <td>Total ponderado</td>
          <td>${weightedLine}</td>
        </tr>
        <tr>
          <td>Calificación ponderada</td>
          <td>${toFixedNice(scoreWeighted)}%</td>
        </tr>
      </tbody>
    </table>
  `;

  const tableBySpecialtySubtype = `
    <table class="result-table result-table--compact">
      <thead>
        <tr>
          <th>Especialidad</th>
          <th>Salud pública</th>
          <th>Medicina familiar</th>
          <th>Urgencias</th>
        </tr>
      </thead>
      <tbody>
        ${Object.keys(SPECIALTY_LABELS)
          .map((key) => {
            const st = specStats[key] || {};
            const sp = st.subtypes?.salud_publica || { correct: 0, total: 0 };
            const mf =
              st.subtypes?.medicina_familiar || { correct: 0, total: 0 };
            const ur = st.subtypes?.urgencias || { correct: 0, total: 0 };
            return `
              <tr>
                <td>${SPECIALTY_LABELS[key]}</td>
                <td>${sp.correct} / ${sp.total}</td>
                <td>${mf.correct} / ${mf.total}</td>
                <td>${ur.correct} / ${ur.total}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  const tableByDifficulty = `
    <table class="result-table result-table--compact">
      <thead>
        <tr>
          <th>Dificultad</th>
          <th>Aciertos</th>
        </tr>
      </thead>
      <tbody>
        ${["alta", "media", "baja"]
          .map((d) => {
            const s = difficultyStats[d] || { correct: 0, total: 0 };
            const label = DIFFICULTY_LABELS[d] || d;
            return `
              <tr>
                <td>${label}</td>
                <td>${s.correct} / ${s.total}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  resultValues.innerHTML = `
    <div class="result-message">${message}</div>
    <div class="result-tables">
      ${tableGeneral}
      ${tableBySpecialtySubtype}
      ${tableByDifficulty}
    </div>
  `;

  resultBanner.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/****************************************************
 * VOLVER DESDE EXAMEN
 ****************************************************/
async function handleBackFromExam() {
  const cameFromMini = currentExamMode === "mini";

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  currentExamMode = null;
  currentExamId = null;
  currentExamQuestions = [];
  currentExamEndAtMs = null;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);

  clearStudentExamState();
  currentExamEndAtMs = Date.now() + totalSeconds * 1000;
  currentExamAnswers = {};
  clearExamAnswersStorage();
  writeExamAnswersToStorage(currentExamAnswers);

  if (questionsList) questionsList.innerHTML = "";
  if (examTimerEl) examTimerEl.textContent = "--:--";

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  if (btnSubmitExam) {
    btnSubmitExam.disabled = false;
    btnSubmitExam.style.display = "inline-flex";
  }

  hide(examDetailView);
  hide(progressView);
  hide(resourcesView);

  if (cameFromMini) {
    switchToMiniView();
  } else {
    const restored = await restoreStudentStateAfterInit();
    if (!restored) {
      switchToSectionView();
    }
  }
}

/****************************************************
 * PROGRESO DEL ESTUDIANTE
 ****************************************************/
async function loadStudentProgress() {
  if (!currentUser) return;

  const thisToken = ++progressLoadToken;

  if (progressUsername) {
    progressUsername.textContent =
      "Estudiante: " + (currentUserProfile?.name || currentUser.email);
  }

  if (progressSectionsContainer) {
    progressSectionsContainer.innerHTML = `
      <div class="card">
        <p class="panel-subtitle">Cargando progreso…</p>
      </div>
    `;
  }
  if (progressGlobalEl) {
    progressGlobalEl.innerHTML = "";
  }

  try {
    const [sectionsSnap, examsSnap, attemptsSnap] = await Promise.all([
      getDocs(collection(db, "sections")),
      getDocs(collection(db, "exams")),
      getDocs(collection(db, "users", currentUser.email, "examAttempts")),
    ]);

    if (thisToken !== progressLoadToken) return;

    const sectionsMap = {};
    sectionsSnap.forEach((docSnap) => {
      sectionsMap[docSnap.id] = {
        id: docSnap.id,
        name: docSnap.data().name || "Sección",
      };
    });

    const sectionStats = {};
    Object.values(sectionsMap).forEach((s) => {
      sectionStats[s.id] = {
        name: s.name,
        totalScore: 0,
        examsCount: 0,
        correct: 0,
        totalQuestions: 0,
      };
    });

    const examsMap = {};
    examsSnap.forEach((docSnap) => {
      const d = docSnap.data();
      examsMap[docSnap.id] = {
        examId: docSnap.id,
        name: d.name || "Examen",
        sectionId: d.sectionId || null,
      };
    });

    const examLatestResults = [];
    const examHistoryResults = [];

    attemptsSnap.forEach((docSnap) => {
      const at = docSnap.data();
      const examId = docSnap.id;
      const examDef = examsMap[examId] || {};

      const examName = examDef.name || at.examName || "Examen";
      const sectionId = at.sectionId || examDef.sectionId || null;
      const sectionName =
        at.sectionName ||
        (sectionId && sectionsMap[sectionId]?.name) ||
        "Sección";

      const score = typeof at.score === "number" ? at.score : 0;
      const correct = at.correctCount || 0;
      const totalQ = at.totalQuestions || 0;
      const lastAttempt = at.lastAttempt ? at.lastAttempt.toDate() : null;

      examLatestResults.push({
        examId,
        examName,
        sectionId,
        sectionName,
        score,
        correctCount: correct,
        totalQuestions: totalQ,
        lastAttempt,
      });

      if (sectionId && sectionStats[sectionId]) {
        sectionStats[sectionId].totalScore += score;
        sectionStats[sectionId].examsCount++;
        sectionStats[sectionId].correct += correct;
        sectionStats[sectionId].totalQuestions += totalQ;
      }

      const historyArr = Array.isArray(at.history) ? at.history : [];
      if (historyArr.length === 0) {
        examHistoryResults.push({
          examId,
          examName,
          sectionId,
          sectionName,
          score,
          lastAttempt,
        });
      } else {
        historyArr.forEach((h) => {
          const hScore = typeof h.score === "number" ? h.score : score;
          let hDate = h.createdAt || h.date || at.lastAttempt;
          if (hDate && typeof hDate.toDate === "function") {
            hDate = hDate.toDate();
          }
          examHistoryResults.push({
            examId,
            examName,
            sectionId,
            sectionName,
            score: hScore,
            lastAttempt: hDate || lastAttempt,
          });
        });
      }
    });

    if (progressSectionsContainer) {
      progressSectionsContainer.innerHTML = "";

      Object.values(sectionsMap).forEach((s) => {
        const st = sectionStats[s.id] || {
          examsCount: 0,
          totalScore: 0,
          correct: 0,
          totalQuestions: 0,
        };
        const examsCnt = st.examsCount || 0;

        const card = document.createElement("div");
        card.className = "progress-section-card";

        if (!examsCnt) {
          card.innerHTML = `
            <div class="progress-section-title">${s.name}</div>
            <div>Sin intentos aún.</div>
          `;
        } else {
          const avg = st.totalScore / examsCnt;
          card.innerHTML = `
            <div class="progress-section-title">${s.name}</div>
            <div><strong>Promedio:</strong> ${toFixedNice(avg, 1)}%</div>
            <div><strong>Aciertos:</strong> ${st.correct} / ${st.totalQuestions}</div>
            <div><strong>Exámenes realizados:</strong> ${examsCnt}</div>
          `;
        }

        progressSectionsContainer.appendChild(card);
      });
    }

    const totalExams = examLatestResults.length;
    const totalCorrect = examLatestResults.reduce(
      (sum, r) => sum + (r.correctCount || 0),
      0
    );
    const totalQuestions = examLatestResults.reduce(
      (sum, r) => sum + (r.totalQuestions || 0),
      0
    );
    const globalAvg =
      totalExams > 0
        ? examLatestResults.reduce((sum, r) => sum + (r.score || 0), 0) /
          totalExams
        : 0;

    if (progressGlobalEl) {
      progressGlobalEl.innerHTML = `
        <div><strong>Exámenes realizados:</strong> ${totalExams}</div>
        <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQuestions}</div>
        <div><strong>Promedio general:</strong> ${toFixedNice(globalAvg, 1)}%</div>
      `;
    }


    // ✅ NUEVO: Progreso de Biblioteca (Resúmenes/GPC)
    try {
      // Carga silenciosa de biblioteca para conocer el total de temas
      await ensureStudentResourcesActivated();

      const countEl = document.getElementById("student-resources-count");
      const totalText = countEl ? (countEl.textContent || "") : "";
      const mTotal = totalText.match(/(\d+)/);
      const totalTopics = mTotal ? Number(mTotal[1]) : 0;

      const userKey = normalizeText(currentUser.email);
      const completedRaw = localStorage.getItem(`resources_completed_${userKey}`) || "[]";
      const completedArr = safeJsonParse(completedRaw, []);
      const completedTopics = Array.isArray(completedArr) ? completedArr.length : 0;

      const pct =
        totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      if (progressGlobalEl) {
        progressGlobalEl.innerHTML += `
          <div><strong>Biblioteca (Resúmenes/GPC):</strong> ${completedTopics} / ${totalTopics} (${pct}%)</div>
        `;
      }
    } catch (e) {
      console.warn("No se pudo calcular progreso de biblioteca:", e);
    }

    renderProgressChart(examHistoryResults);
  } catch (err) {
    console.error("Error cargando progreso del estudiante:", err);
    if (thisToken !== progressLoadToken) return;
    if (progressSectionsContainer) {
      progressSectionsContainer.innerHTML = `
        <div class="card">
          <p class="panel-subtitle">No se pudo cargar el progreso.</p>
        </div>
      `;
    }
  }
}

/****************************************************
 * GRÁFICA DE PROGRESO – Chart.js
 ****************************************************/
function renderProgressChart(examResults) {
  if (!progressChartCanvas) return;

  const sorted = examResults
    .slice()
    .sort((a, b) => {
      const A = a.lastAttempt ? a.lastAttempt.getTime() : 0;
      const B = b.lastAttempt ? b.lastAttempt.getTime() : 0;
      return A - B;
    });

  const ctx = progressChartCanvas.getContext("2d");

  if (!sorted.length) {
    if (progressChartInstance) {
      progressChartInstance.destroy();
      progressChartInstance = null;
    }
    ctx.clearRect(0, 0, progressChartCanvas.width, progressChartCanvas.height);
    return;
  }

  // Etiquetas cortas
  const labels = sorted.map((_, i) => `Intento ${i + 1}`);
  const data = sorted.map((r) => (typeof r.score === "number" ? r.score : 0));

  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, "rgba(37,99,235,0.25)");
  grad.addColorStop(1, "rgba(37,99,235,0)");

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  // eslint-disable-next-line no-undef
  progressChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Calificación ponderada",
          data,
          borderColor: "#2563eb",
          backgroundColor: grad,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#1d4ed8",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 10 } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              const r = sorted[i];
              return `Intento ${i + 1} — ${r.examName} (${r.sectionName})`;
            },
            label: (item) => {
              const i = item.dataIndex;
              const r = sorted[i];
              const score =
                typeof r.score === "number" ? toFixedNice(r.score, 1) : "0.0";
              const when =
                r.lastAttempt instanceof Date
                  ? r.lastAttempt.toLocaleString("es-MX")
                  : "";
              return when
                ? `Calificación: ${score}% — ${when}`
                : `Calificación: ${score}%`;
            },
          },
        },
      },
    },
  });
}
