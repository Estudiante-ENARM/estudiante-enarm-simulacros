/***********************************************
 * student.js
 * Panel del Estudiante - Estudiante ENARM
 ***********************************************/
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
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import {
  SPECIALTIES,
  SUBTYPES,
  DIFFICULTIES,
  DIFFICULTY_WEIGHTS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_TIME_PER_QUESTION,
  MINI_EXAM_QUESTION_OPTIONS,
} from "./shared-constants.js";

/***********************************************
 * MAPAS DE ETIQUETAS (a partir de shared-constants)
 ***********************************************/
const SPECIALTY_LABELS = SPECIALTIES;
const SUBTYPE_LABELS = SUBTYPES;
const DIFFICULTY_LABELS = DIFFICULTIES;

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/

// Layout
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

// Usuario
const studentUserEmailSpan = document.getElementById("student-user-email");
const btnLogout = document.getElementById("student-btn-logout");

// Sidebar
const sidebarSections = document.getElementById("student-sidebar-sections");
const btnProgressView = document.getElementById("student-progress-btn");
const btnMiniExamsSidebar = document.getElementById("student-mini-exams-btn");

// Redes sociales
const socialButtons = document.querySelectorAll(".social-icon");

// Vistas principales
const examsView = document.getElementById("student-exams-view");
const examDetailView = document.getElementById("student-exam-detail-view");
const progressView = document.getElementById("student-progress-view");
const miniBuilderView = document.getElementById("student-mini-exams-view");
const miniExamView = document.getElementById("student-mini-exam-view"); // placeholder (ya no se usa mucho)

// Sección y lista de exámenes
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

// Mini exámenes (builder)
const miniNumQuestionsSelect = document.getElementById("student-mini-num-questions");
const miniSpecialtyCheckboxes = document.querySelectorAll(".student-mini-specialty");
const miniRandomCheckbox = document.getElementById("student-mini-random");
const btnMiniStart = document.getElementById("student-mini-start-btn");

/***********************************************
 * ESTADO GLOBAL
 ***********************************************/
let currentUser = null;
let currentUserProfile = null;

let examRules = {
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  timePerQuestionSeconds: DEFAULT_TIME_PER_QUESTION,
};

let currentView = "section";    // "section" | "progress" | "mini"
let currentSectionId = null;
let currentSectionName = null;

let currentExamMode = null;     // "section" | "mini"
let currentExamId = null;       // id del examen (solo en modo "section")
let currentExamQuestions = [];  // arreglo plano de preguntas
let currentExamTotalSeconds = 0;
let currentExamTimerId = null;
let currentExamPreviousAttempts = 0;

let miniCasesCache = [];        // casos clínicos de miniCases

/***********************************************
 * UTILIDADES GENERALES
 ***********************************************/
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

/***********************************************
 * ICONOS SVG — EXÁMENES
 ***********************************************/
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
 * AUTH / VERIFICACIÓN DE ESTUDIANTE
 ****************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    // Importante: en /users/ el ID es el EMAIL
    const userRef = doc(db, "users", user.email);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      alert("Tu usuario no está configurado en Firestore. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const data = snap.data();

    // Solo rol "usuario" entra a student.html
    if (data.role !== "usuario") {
      alert("Este panel es solo para estudiantes.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (data.status !== "activo") {
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

    // Autorizado: inicializamos el panel
    currentUser = user;
    currentUserProfile = data;

    if (studentUserEmailSpan) {
      studentUserEmailSpan.textContent = user.email;
    }

    await loadExamRules();
    await loadSocialLinksForStudent();
    await loadSectionsForStudent();

    switchToSectionView();
  } catch (err) {
    console.error("Error validando usuario estudiante", err);
    alert("Error validando tu acceso. Intenta más tarde.");
    await signOut(auth);
    window.location.href = "index.html";
  }
});

/***********************************************
 * LISTENERS GENERALES (SIDEBAR, LOGOUT, NAV)
 ***********************************************/
if (btnToggleSidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    } finally {
      window.location.href = "index.html";
    }
  });
}

// Mini exámenes desde el sidebar
if (btnMiniExamsSidebar && miniBuilderView) {
  btnMiniExamsSidebar.addEventListener("click", () => {
    currentView = "mini";
    hide(examsView);
    hide(examDetailView);
    hide(progressView);
    if (miniExamView) hide(miniExamView);
    show(miniBuilderView);
    sidebar.classList.remove("sidebar--open");
  });
}

// Progreso
if (btnProgressView) {
  btnProgressView.addEventListener("click", () => {
    switchToProgressView();
  });
}

// Builder de mini examen
if (btnMiniStart) {
  btnMiniStart.addEventListener("click", () => {
    startMiniExamFromBuilder();
  });
}

// Volver desde el examen
if (btnBackToExams) {
  btnBackToExams.addEventListener("click", () => {
    handleBackFromExam();
  });
}

// Enviar examen
if (btnSubmitExam) {
  btnSubmitExam.addEventListener("click", () => {
    submitExamForStudent(false);
  });
}

/***********************************************
 * CAMBIO DE VISTAS
 ***********************************************/
function switchToSectionView() {
  currentView = "section";
  hide(miniBuilderView);
  hide(examDetailView);
  hide(progressView);
  if (miniExamView) hide(miniExamView);
  show(examsView);
}

async function switchToProgressView() {
  currentView = "progress";
  hide(miniBuilderView);
  hide(examsView);
  hide(examDetailView);
  if (miniExamView) hide(miniExamView);
  show(progressView);

  sidebar.classList.remove("sidebar--open");
  await loadStudentProgress();
}

/***********************************************
 * CARGA DE CONFIGURACIÓN GLOBAL
 ***********************************************/
async function loadExamRules() {
  try {
    const snap = await getDoc(doc(db, "examRules", "default"));
    if (!snap.exists()) {
      examRules.maxAttempts = DEFAULT_MAX_ATTEMPTS;
      examRules.timePerQuestionSeconds = DEFAULT_TIME_PER_QUESTION;
      return;
    }

    const data = snap.data();
    if (typeof data.maxAttempts === "number") {
      examRules.maxAttempts = data.maxAttempts;
    }
    if (typeof data.timePerQuestionSeconds === "number") {
      examRules.timePerQuestionSeconds = data.timePerQuestionSeconds;
    }
  } catch (err) {
    console.error("Error leyendo examRules/default:", err);
    examRules.maxAttempts = DEFAULT_MAX_ATTEMPTS;
    examRules.timePerQuestionSeconds = DEFAULT_TIME_PER_QUESTION;
  }
}

/***********************************************
 * REDES SOCIALES (settings/socialLinks)
 ***********************************************/
async function loadSocialLinksForStudent() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data();

    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      if (data[network]) {
        btn.dataset.url = data[network];
      } else {
        delete btn.dataset.url;
      }
    });
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

/***********************************************
 * CARGA DE SECCIONES (BARRA LATERAL)
 ***********************************************/
async function loadSectionsForStudent() {
  const snap = await getDocs(collection(db, "sections"));
  sidebarSections.innerHTML = "";

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

    if (!firstSectionId) {
      firstSectionId = id;
      firstSectionName = name;
    }

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.innerHTML = `<div class="sidebar__section-name">${name}</div>`;

    li.addEventListener("click", () => {
      document
        .querySelectorAll(".sidebar__section-item")
        .forEach((el) => el.classList.remove("sidebar__section-item--active"));

      li.classList.add("sidebar__section-item--active");

      currentSectionId = id;
      currentSectionName = name;

      sectionTitle.textContent = name;
      sectionSubtitle.textContent = "Simulacros de esta sección.";

      switchToSectionView();
      loadExamsForSectionForStudent(id);

      sidebar.classList.remove("sidebar--open");
    });

    sidebarSections.appendChild(li);
  });

  // Seleccionamos automáticamente la primera sección como activa
  if (firstSectionId) {
    currentSectionId = firstSectionId;
    currentSectionName = firstSectionName;

    const firstLi = sidebarSections.querySelector(".sidebar__section-item");
    if (firstLi) {
      firstLi.classList.add("sidebar__section-item--active");
    }

    sectionTitle.textContent = currentSectionName;
    sectionSubtitle.textContent = "Simulacros de esta sección.";
    await loadExamsForSectionForStudent(firstSectionId);
  }
}

/***********************************************
 * LISTA DE EXÁMENES POR SECCIÓN
 ***********************************************/
async function loadExamsForSectionForStudent(sectionId) {
  examsList.innerHTML = "";

  if (!sectionId) {
    renderEmptyMessage(examsList, "No se ha seleccionado ninguna sección.");
    return;
  }

  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );

  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(examsList, "No hay exámenes disponibles en esta sección.");
    return;
  }

  for (const docSnap of snap.docs) {
    const exData = docSnap.data();
    const examId = docSnap.id;
    const examName = exData.name || "Examen sin título";

    // Intentos previos del estudiante
    let attemptsUsed = 0;
    let lastAttemptText = "Sin intentos previos.";

    if (currentUser) {
      const attemptRef = doc(
        db,
        "users",
        currentUser.email,
        "examAttempts",
        examId
      );
      const attemptSnap = await getDoc(attemptRef);
      if (attemptSnap.exists()) {
        const atData = attemptSnap.data();
        attemptsUsed = atData.attempts || 0;
        lastAttemptText = atData.lastAttempt
          ? atData.lastAttempt.toDate().toLocaleDateString()
          : "—";
      }
    }

    // Contar preguntas
    const qQuestions = query(
      collection(db, "questions"),
      where("examId", "==", examId)
    );
    const qSnap = await getDocs(qQuestions);

    let totalQuestions = 0;
    qSnap.forEach((qDoc) => {
      const qData = qDoc.data();
      const arr = Array.isArray(qData.questions) ? qData.questions : [];
      totalQuestions += arr.length;
    });

    // Si no hay preguntas, mostrar como "En preparación"
    if (totalQuestions === 0) {
      const cardPrep = document.createElement("div");
      cardPrep.className = "card-item";
      cardPrep.innerHTML = `
        <div class="card-item__title-row">
          <div class="card-item__title">${examName}</div>
          <span class="badge" style="background:#fbbf24;color:#78350f;">En preparación</span>
        </div>
        <div class="panel-subtitle" style="margin-top:8px;">
          Aún no hay preguntas cargadas para este examen.
        </div>
      `;
      examsList.appendChild(cardPrep);
      continue;
    }

    // Tiempo total según reglas globales
    const maxAttempts = examRules.maxAttempts;
    const timePerQuestion = examRules.timePerQuestionSeconds;
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

    examsList.appendChild(card);
  }
}

/***********************************************
 * SHUFFLE (para mini exámenes)
 ***********************************************/
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/***********************************************
 * MINI EXÁMENES — CARGA INICIAL DE miniCases
 ***********************************************/
async function loadMiniCasesOnce() {
  if (miniCasesCache.length > 0) return;

  try {
    const snap = await getDocs(collection(db, "miniCases"));
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
    console.error("Error cargando miniCases:", err);
    miniCasesCache = [];
  }
}

/***********************************************
 * MINI EXÁMENES — CONSTRUIR E INICIAR
 ***********************************************/
async function startMiniExamFromBuilder() {
  if (!miniNumQuestionsSelect) {
    alert("El módulo de mini exámenes no está configurado en esta vista.");
    return;
  }

  const numQuestions = parseInt(miniNumQuestionsSelect.value, 10) || 5;

  const selectedSpecialties = Array.from(miniSpecialtyCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  const randomOnly = miniRandomCheckbox ? miniRandomCheckbox.checked : true;
  // (Por ahora randomOnly no cambia la lógica: siempre hacemos selección aleatoria.)

  await loadMiniCasesOnce();

  if (!miniCasesCache.length) {
    alert("Aún no hay casos clínicos configurados para mini exámenes.");
    return;
  }

  // Filtrar por especialidad (si se seleccionó al menos una)
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

  // Construir pool a nivel pregunta
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

  const shuffled = randomOnly ? shuffleArray(questionPool) : questionPool;
  const selectedQuestions = shuffled.slice(0, Math.min(numQuestions, shuffled.length));

  if (!selectedQuestions.length) {
    alert("No se pudieron seleccionar preguntas para el mini examen.");
    return;
  }

  // Estado de examen
  currentExamMode = "mini";
  currentExamId = null;
  currentExamTotalSeconds = 0;
  currentExamPreviousAttempts = 0;
  currentExamQuestions = [];

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }
  if (examTimerEl) examTimerEl.textContent = "--:--";

  // Reset resultados previos
  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  // Mostrar vista de examen
  hide(examsView);
  hide(progressView);
  hide(miniBuilderView);
  if (miniExamView) hide(miniExamView);
  show(examDetailView);

  // Reactivar botón de enviar
  if (btnSubmitExam) {
    btnSubmitExam.disabled = false;
    btnSubmitExam.style.display = "";
  }

  examTitle.textContent = "Mini examen personalizado";
  examSubtitle.textContent =
    "Resuelve el mini examen con preguntas aleatorias de los casos clínicos disponibles.";

  const totalQuestions = selectedQuestions.length;

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>Sin límite de tiempo</strong><br>
    🔁 Intentos: <strong>Sin límite</strong>
  `;

  questionsList.innerHTML = "";

  // Agrupar por caso para mostrar
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
}

/***********************************************
 * EXÁMENES POR SECCIÓN — INICIAR EXAMEN
 ***********************************************/
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

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  hide(examsView);
  hide(progressView);
  hide(miniBuilderView);
  if (miniExamView) hide(miniExamView);
  show(examDetailView);

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  if (btnSubmitExam) {
    btnSubmitExam.disabled = false;
    btnSubmitExam.style.display = "";
  }

  examTitle.textContent = examName;
  examSubtitle.textContent =
    "Resuelve cuidadosamente y envía antes de que termine el tiempo.";

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  await loadQuestionsForSectionExam(examId);
  startExamTimer(currentExamTotalSeconds);
}

/***********************************************
 * CARGAR PREGUNTAS DE EXAMEN (POR SECCIÓN)
 ***********************************************/
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

/***********************************************
 * CRONÓMETRO — SOLO PARA EXÁMENES POR SECCIÓN
 ***********************************************/
function startExamTimer(totalSeconds) {
  if (!examTimerEl) return;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
  }

  let remaining = totalSeconds;
  examTimerEl.textContent = formatTimer(remaining);

  currentExamTimerId = setInterval(() => {
    remaining -= 1;

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

/***********************************************
 * ENVÍO DE EXAMEN (MINI + POR SECCIÓN)
 ***********************************************/
async function submitExamForStudent(auto = false) {
  if (!currentExamQuestions.length) {
    alert("No hay examen cargado.");
    return;
  }

  if (!btnSubmitExam) return;

  // Bloquear botón inmediatamente
  btnSubmitExam.disabled = true;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  const totalQuestions = currentExamQuestions.length;
  let globalCorrect = 0;
  let globalWeightedCorrect = 0;
  let globalWeightedTotal = 0;

  const detail = {};

  // Acumuladores por especialidad y subtipo
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

  const scoreRaw = Math.round((globalCorrect / totalQuestions) * 100);
  const scoreWeighted =
    globalWeightedTotal > 0
      ? (globalWeightedCorrect / globalWeightedTotal) * 100
      : 0;

  // Guardar SOLO cuando es examen por sección
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
      const oldAttempts = prevSnap.exists()
        ? prevSnap.data().attempts || 0
        : currentExamPreviousAttempts || 0;

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
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error guardando intento de examen:", err);
      alert("Hubo un error guardando tu intento, pero se calcularon tus resultados.");
    }
  }

  renderPremiumResults({
    auto,
    globalCorrect,
    totalQuestions,
    scoreWeighted,
    globalWeightedCorrect,
    globalWeightedTotal,
    specStats,
    difficultyStats,
  });

  // IMPORTANTE: ocultar botón para que no cuente otro intento
  btnSubmitExam.style.display = "none";
}

/***********************************************
 * RENDERIZAR RESULTADOS (3 TABLAS)
 ***********************************************/
function renderPremiumResults({
  auto,
  globalCorrect,
  totalQuestions,
  scoreWeighted,
  globalWeightedCorrect,
  globalWeightedTotal,
  specStats,
  difficultyStats,
}) {
  if (!resultBanner || !resultValues) {
    alert(
      `Examen enviado.\nAciertos: ${globalCorrect}/${totalQuestions}\nCalificación: ${toFixedNice(
        scoreWeighted
      )}%\nPuntos ponderados: ${globalWeightedCorrect} de ${globalWeightedTotal}`
    );
    return;
  }

  const message = auto
    ? "El examen fue enviado automáticamente al agotarse el tiempo."
    : "Tu examen se envió correctamente. Revisa tus resultados detallados.";

  // Tabla general (aciertos + total ponderado)
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
          <td>Puntos ponderados</td>
          <td>${globalWeightedCorrect} de ${globalWeightedTotal}</td>
        </tr>
        <tr>
          <td>Calificación ponderada</td>
          <td>${toFixedNice(scoreWeighted)}%</td>
        </tr>
      </tbody>
    </table>
  `;

  // Tabla por especialidad/subtipo
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
            const st = specStats[key];
            const sp = st?.subtypes?.salud_publica || { correct: 0, total: 0 };
            const mf =
              st?.subtypes?.medicina_familiar || { correct: 0, total: 0 };
            const ur = st?.subtypes?.urgencias || { correct: 0, total: 0 };
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

  // Tabla por dificultad
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

/***********************************************
 * BOTÓN "VOLVER A EXÁMENES"
 ***********************************************/
function handleBackFromExam() {
  const cameFromMini = currentExamMode === "mini";

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  currentExamMode = null;
  currentExamId = null;
  currentExamQuestions = [];

  if (questionsList) questionsList.innerHTML = "";
  if (examTimerEl) examTimerEl.textContent = "--:--";

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  hide(examDetailView);
  hide(progressView);

  if (cameFromMini && miniBuilderView) {
    show(miniBuilderView);
  } else {
    show(examsView);
  }

  // El botón se volverá a mostrar cuando se inicie un nuevo examen
}

/***********************************************
 * PROGRESO DEL ESTUDIANTE
 ***********************************************/
async function loadStudentProgress() {
  if (!currentUser) return;

  if (progressUsername) {
    progressUsername.textContent =
      "Estudiante: " + (currentUserProfile?.name || currentUser.email);
  }

  // Secciones
  const sectionsSnap = await getDocs(collection(db, "sections"));
  const sectionsMap = {};
  sectionsSnap.forEach((docSnap) => {
    sectionsMap[docSnap.id] = {
      id: docSnap.id,
      name: docSnap.data().name || "Sección",
    };
  });

  // Stats por sección
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

  const examResults = [];

  // Leer exámenes y sus intentos de este usuario
  const examsSnap = await getDocs(collection(db, "exams"));

  for (const ex of examsSnap.docs) {
    const exData = ex.data();
    const examId = ex.id;
    const sectionId = exData.sectionId;

    const attemptRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      examId
    );
    const attemptSnap = await getDoc(attemptRef);
    if (!attemptSnap.exists()) continue;

    const at = attemptSnap.data();

    const score = typeof at.score === "number" ? at.score : 0;
    const correct = at.correctCount || 0;
    const totalQ = at.totalQuestions || 0;
    const lastAttempt = at.lastAttempt ? at.lastAttempt.toDate() : null;

    examResults.push({
      examId,
      examName: exData.name || "Examen",
      sectionId,
      sectionName: sectionsMap[sectionId]?.name || "Sección",
      score,
      correctCount: correct,
      totalQuestions: totalQ,
      lastAttempt,
    });

    if (sectionStats[sectionId]) {
      sectionStats[sectionId].totalScore += score;
      sectionStats[sectionId].examsCount++;
      sectionStats[sectionId].correct += correct;
      sectionStats[sectionId].totalQuestions += totalQ;
    }
  }

  // Tarjetas por sección
  if (progressSectionsContainer) {
    progressSectionsContainer.innerHTML = "";

    Object.values(sectionsMap).forEach((s) => {
      const st = sectionStats[s.id];
      const examsCnt = st?.examsCount || 0;

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

  // Totales globales
  const totalExams = examResults.length;
  const totalCorrect = examResults.reduce(
    (sum, r) => sum + (r.correctCount || 0),
    0
  );
  const totalQuestions = examResults.reduce(
    (sum, r) => sum + (r.totalQuestions || 0),
    0
  );
  const globalAvg =
    totalExams > 0
      ? examResults.reduce((sum, r) => sum + (r.score || 0), 0) / totalExams
      : 0;

  if (progressGlobalEl) {
    progressGlobalEl.innerHTML = `
      <div><strong>Exámenes realizados:</strong> ${totalExams}</div>
      <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQuestions}</div>
      <div><strong>Promedio general:</strong> ${toFixedNice(globalAvg, 1)}%</div>
    `;
  }

  // Gráfica
  renderProgressChart(examResults);
}

/***********************************************
 * GRÁFICA DE PROGRESO (Chart.js)
 ***********************************************/
function renderProgressChart(examResults) {
  if (!progressChartCanvas) return;

  const sorted = examResults
    .slice()
    .sort((a, b) => {
      const A = a.lastAttempt ? a.lastAttempt.getTime() : 0;
      const B = b.lastAttempt ? b.lastAttempt.getTime() : 0;
      return A - B;
    });

  if (!sorted.length) {
    if (progressChartInstance) {
      progressChartInstance.destroy();
      progressChartInstance = null;
    }
    const ctx = progressChartCanvas.getContext("2d");
    ctx.clearRect(0, 0, progressChartCanvas.width, progressChartCanvas.height);
    return;
  }

  const labels = sorted.map(
    (r, i) => `${i + 1}. ${r.examName} (${r.sectionName})`
  );
  const data = sorted.map((r) => (typeof r.score === "number" ? r.score : 0));

  const ctx = progressChartCanvas.getContext("2d");

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
      },
    },
  });
}
