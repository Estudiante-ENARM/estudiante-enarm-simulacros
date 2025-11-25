/***********************************************
 * FIREBASE (MODULAR v11) - CONFIGURACIÓN
 ***********************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- Configuración Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/***********************************************
 * CONSTANTES (ESPECIALIDADES, DIFICULTAD, SUBTIPOS)
 ***********************************************/
const SPECIALTIES = {
  medicina_interna: "Medicina interna",
  pediatria: "Pediatría",
  gine_obstetricia: "Ginecología y Obstetricia",
  cirugia_general: "Cirugía general",
};

const SUBTYPES = {
  salud_publica: "Salud pública",
  medicina_familiar: "Medicina familiar",
  urgencias: "Urgencias",
};

const DIFFICULTIES = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

const DIFFICULTY_WEIGHTS = {
  baja: 1,
  media: 2,
  alta: 3,
};

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("student-sidebar-sections");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

const studentUserEmailSpan = document.getElementById("student-user-email");
const btnLogout = document.getElementById("student-btn-logout");

// Social icons
const socialButtons = document.querySelectorAll(".social-icon");

// Vistas principales
const examsView = document.getElementById("student-exams-view");
const examsList = document.getElementById("student-exams-list");
const sectionTitle = document.getElementById("student-current-section-title");
const sectionSubtitle = document.getElementById("student-current-section-subtitle");

const examDetailView = document.getElementById("student-exam-detail-view");
const examTitle = document.getElementById("student-exam-title");
const examSubtitle = document.getElementById("student-exam-subtitle");
const examTimerEl = document.getElementById("student-exam-timer");
const examMetaText = document.getElementById("student-exam-meta-text");
const questionsList = document.getElementById("student-questions-list");
const btnBackToExams = document.getElementById("student-btn-back-to-exams");
const btnSubmitExam = document.getElementById("student-btn-submit-exam");

// Banner resultados
const resultBanner = document.getElementById("student-result-banner");
const resultValues = document.getElementById("student-result-values");

// Vista progreso
const progressView = document.getElementById("student-progress-view");
const btnProgressView = document.getElementById("student-progress-btn");
const progressUsername = document.getElementById("student-progress-username");
const progressSectionsContainer = document.getElementById("student-progress-sections");
const progressGlobalEl = document.getElementById("student-progress-global");
const progressChartCanvas = document.getElementById("student-progress-chart");

let progressChartInstance = null;

/***********************************************
 * ESTADO
 ***********************************************/
let currentUser = null;
let currentUserProfile = null;

let examRules = {
  maxAttempts: 3,
  timePerQuestion: 75,
};

let currentSectionId = null;
let currentSectionName = "Exámenes disponibles";

let currentExamId = null;
let currentExamName = "";
let currentExamQuestions = [];
let currentExamTotalSeconds = 0;
let currentExamTimerId = null;
let currentExamPreviousAttempts = 0;

/***********************************************
 * UTILIDADES
 ***********************************************/
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function renderEmptyMessage(container, text) {
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
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
/***********************************************
 * AUTENTICACIÓN Y MANEJO DE ROLES
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  studentUserEmailSpan.textContent = currentUser.email || "";

  try {
    const userDocRef = doc(db, "users", currentUser.email);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      alert("Tu usuario no está configurado en el sistema. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentUserProfile = userSnap.data();

    const today = new Date().toISOString().slice(0, 10);

    if (currentUserProfile.expiryDate && currentUserProfile.expiryDate < today) {
      await setDoc(userDocRef, { status: "inactivo" }, { merge: true });
      alert("Tu acceso ha vencido. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (currentUserProfile.status !== "activo") {
      alert("Tu usuario está inactivo. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (currentUserProfile.role !== "usuario") {
      alert("Este panel es solo para estudiantes.");
      window.location.href = "index.html";
      return;
    }

    await loadExamRules();
    await loadSectionsForStudent();
    await loadSocialLinksForStudent();
    await loadPlanLimits(); // << NUEVO: controlador del plan gratuito/premium
  } catch (err) {
    console.error(err);
    alert("No se pudo cargar la información del estudiante.");
  }
});

/***********************************************
 * REGLAS DE EXÁMENES GLOBALES
 ***********************************************/
async function loadExamRules() {
  try {
    const snap = await getDoc(doc(db, "examRules", "defaultRules"));
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.maxAttempts === "number") examRules.maxAttempts = data.maxAttempts;
      if (typeof data.timePerQuestion === "number") examRules.timePerQuestion = data.timePerQuestion;
    }
  } catch (err) {
    console.error("No se pudo leer examRules/defaultRules.", err);
  }
}

/***********************************************
 * PLAN PREMIUM / PLAN GRATIS
 ***********************************************/
async function loadPlanLimits() {
  try {
    const snap = await getDoc(doc(db, "plans", currentUser.email));

    if (!snap.exists()) {
      currentUser.plan = "free";
      return;
    }

    const data = snap.data();
    currentUser.plan = data.plan || "free";
    currentUser.allowedExams = data.allowedExams || ["first"];

  } catch (err) {
    console.error("No se pudo leer datos del plan.", err);
    currentUser.plan = "free";
  }
}

/***********************************************
 * REDES SOCIALES DE LA PLATAFORMA
 ***********************************************/
async function loadSocialLinksForStudent() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data();

    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      if (data[network]) btn.dataset.url = data[network];
      else delete btn.dataset.url;
    });
  } catch (err) {
    console.error(err);
  }

  socialButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) {
        alert("No se ha configurado el enlace de esta red social.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

/***********************************************
 * CARGA DE SECCIONES
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
      document.querySelectorAll(".sidebar__section-item")
        .forEach((el) => el.classList.remove("sidebar__section-item--active"));
      li.classList.add("sidebar__section-item--active");

      currentSectionId = id;
      currentSectionName = name;

      sectionTitle.textContent = name;
      sectionSubtitle.textContent = "Simulacros de esta sección.";

      loadExamsForSectionForStudent(id);
      sidebar.classList.remove("sidebar--open");

      show(examsView);
      hide(examDetailView);
      hide(progressView);
    });

    sidebarSections.appendChild(li);
  });

  // Seleccionar automáticamente la primera sección
  currentSectionId = firstSectionId;
  currentSectionName = firstSectionName;

  document.querySelector(".sidebar__section-item")?.classList.add(
    "sidebar__section-item--active"
  );

  await loadExamsForSectionForStudent(firstSectionId);
}
/***********************************************
 * ICONOS SVG — ELEMENTOS VISUALES
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

/***********************************************
 * LISTA DE EXÁMENES — APLICANDO PLAN FREE/PREMIUM
 ***********************************************/
async function loadExamsForSectionForStudent(sectionId) {
  examsList.innerHTML = "";

  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );

  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(examsList, "No hay exámenes disponibles.");
    return;
  }

  let indexExam = 0;

  for (const docSnap of snap.docs) {
    indexExam++;
    const exData = docSnap.data();
    const examId = docSnap.id;
    const examName = exData.name || "Examen sin título";

    // Intentos previos
    const attemptRef = doc(db, "users", currentUser.email, "examAttempts", examId);
    const attemptSnap = await getDoc(attemptRef);
    const attemptsUsed = attemptSnap.exists() ? attemptSnap.data().attempts || 0 : 0;

    // Número de preguntas
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

    // Examen sin preguntas
    if (totalQuestions === 0) {
      const card = document.createElement("div");
      card.className = "card-item";
      card.innerHTML = `
        <div class="card-item__title-row">
          <div class="card-item__title">${examName}</div>
          <span class="badge" style="background:#fbbf24;color:#78350f;">En preparación</span>
        </div>
        <div class="panel-subtitle" style="margin-top:8px;">Aún no hay preguntas cargadas.</div>
      `;
      examsList.appendChild(card);
      continue;
    }

    // Tiempo total
    const maxAttempts = examRules.maxAttempts;
    const timePerQuestion = examRules.timePerQuestion;
    const totalSeconds = totalQuestions * timePerQuestion;
    const totalTimeFormatted = formatMinutesFromSeconds(totalSeconds);

    // RESTRICCIÓN DE PLAN GRATIS -----------------------------------------
    let isBlocked = false;
    if (currentUser.plan === "free") {
      if (indexExam !== 1) {
        isBlocked = true;
      }
    }

    // RESTRICCIÓN: Intentos agotados
    const disabled = attemptsUsed >= maxAttempts;

    const card = document.createElement("div");
    card.className = "card-item";

    if (isBlocked) {
      card.style.opacity = 0.55;
    } else if (disabled) {
      card.style.opacity = 0.7;
    }

    const statusText =
      isBlocked ? "Solo para Premium"
      : disabled ? "Intentos agotados"
      : "Disponible";

    const lastAttemptText = attemptSnap.exists()
      ? (attemptSnap.data().lastAttempt
        ? attemptSnap.data().lastAttempt.toDate().toLocaleDateString()
        : "—")
      : "Sin intentos previos.";

    // Render card
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
              Simulacro ENARM · ${currentSectionName}
            </div>
          </div>
        </div>

        <span class="badge"><span class="badge-dot"></span>${statusText}</span>
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
            <div class="panel-subtitle">Tiempo total</div>
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
          isBlocked
            ? `<button class="btn btn-outline" disabled>Solo Premium</button>`
            : disabled
              ? `<button class="btn btn-outline" disabled>Intentos agotados</button>`
              : `<button class="btn btn-primary student-start-exam-btn">Iniciar examen</button>`
        }
      </div>
    `;

    if (!isBlocked && !disabled) {
      const btnStart = card.querySelector(".student-start-exam-btn");
      btnStart.addEventListener("click", () => {
        startExamForStudent({
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
 * INICIAR EXAMEN — LÓGICA COMPLETA
 ***********************************************/
async function startExamForStudent({
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

  currentExamId = examId;
  currentExamName = examName;
  currentExamTotalSeconds = totalSeconds;
  currentExamPreviousAttempts = attemptsUsed;
  currentExamQuestions = [];

  hide(examsView);
  hide(progressView);
  show(examDetailView);

  // Reset de banner de resultados
  resultBanner.style.display = "none";
  resultValues.innerHTML = "";

  examTitle.textContent = examName;
  examSubtitle.textContent = "Resuelve cuidadosamente y envía antes de que acabe el tiempo.";
  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  await loadQuestionsForExam(examId);

  startExamTimer();
}

/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN
 ***********************************************/
async function loadQuestionsForExam(examId) {
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

  if (cases.length === 0) {
    renderEmptyMessage(questionsList, "No existen preguntas configuradas.");
    return;
  }

  currentExamQuestions = [];
  let globalIndex = 0;

  questionsList.innerHTML = "";

  cases.forEach((caseData, caseIndex) => {
    const caseBlock = document.createElement("div");
    caseBlock.className = "case-block";

    const specialtyLabel = caseData.specialty
      ? SPECIALTIES[caseData.specialty] || caseData.specialty
      : "Especialidad no definida";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="panel-subtitle" style="margin-bottom:6px;font-size:12px;">
        Especialidad: <strong>${specialtyLabel}</strong>
      </div>
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
        difficulty: q.difficulty,
        subtype: q.subtype,
      });

      const difficultyLabel = DIFFICULTIES[q.difficulty] || "No definida";
      const subtypeLabel = SUBTYPES[q.subtype] || "General";

      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.dataset.qIndex = idx;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${q.questionText}</p>

        <div class="panel-subtitle" style="font-size:12px;margin-bottom:8px;">
          Dificultad: <strong>${difficultyLabel}</strong> · Tipo: <strong>${subtypeLabel}</strong>
        </div>

        <div class="question-options">
          <label><input type="radio" name="q_${idx}" value="A"> A) ${q.optionA}</label>
          <label><input type="radio" name="q_${idx}" value="B"> B) ${q.optionB}</label>
          <label><input type="radio" name="q_${idx}" value="C"> C) ${q.optionC}</label>
          <label><input type="radio" name="q_${idx}" value="D"> D) ${q.optionD}</label>
        </div>

        <div class="justification-box">
          <strong>Justificación:</strong><br>
          ${q.justification}
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
 * CRONÓMETRO — TIEMPO TOTAL DEL EXAMEN
 ***********************************************/
function startExamTimer() {
  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
  }

  let remaining = currentExamTotalSeconds;
  examTimerEl.textContent = formatTimer(remaining);

  currentExamTimerId = setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      clearInterval(currentExamTimerId);
      examTimerEl.textContent = "00:00";
      alert("El tiempo se agotó, tu examen se enviará automáticamente.");
      submitExamForStudent(true);
      return;
    }

    examTimerEl.textContent = formatTimer(remaining);
  }, 1000);
}

/***********************************************
 * ENVÍO DE EXAMEN — CALIFICACIÓN PREMIUM
 ***********************************************/
btnSubmitExam.addEventListener("click", () => submitExamForStudent(false));

async function submitExamForStudent(auto = false) {
  if (!currentExamId || !currentExamQuestions.length) {
    alert("No hay examen cargado.");
    return;
  }

  btnSubmitExam.disabled = true;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
  }

  const totalQuestions = currentExamQuestions.length;

  let globalCorrect = 0;
  let globalWeightedCorrect = 0;
  let globalWeightedTotal = 0;

  const detail = {};

  const specStats = {};
  Object.keys(SPECIALTIES).forEach((k) => {
    specStats[k] = {
      name: SPECIALTIES[k],
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
    const selectedInput = document.querySelector(`input[name="q_${idx}"]:checked`);
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

    const card = questionsList.querySelector(`[data-q-index="${idx}"]`);
    if (card) {
      const just = card.querySelector(".justification-box");
      just.style.display = "block";

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
  const scoreWeighted = globalWeightedTotal > 0
    ? (globalWeightedCorrect / globalWeightedTotal) * 100
    : 0;

  try {
    const attemptRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      currentExamId
    );

    const prevSnap = await getDoc(attemptRef);
    const oldAttempts = prevSnap.exists() ? prevSnap.data().attempts || 0 : currentExamPreviousAttempts;

    await setDoc(attemptRef, {
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
    }, { merge: true });

    renderPremiumResults({ auto, globalCorrect, totalQuestions, scoreWeighted, specStats, difficultyStats });

  } catch (err) {
    console.error(err);
    alert("Hubo un error guardando tu intento.");
  }

  btnSubmitExam.disabled = false;
}
/***********************************************
 * RENDERIZAR RESULTADOS PREMIUM (BANNER + TABLAS)
 ***********************************************/
function renderPremiumResults({
  auto,
  globalCorrect,
  totalQuestions,
  scoreWeighted,
  specStats,
  difficultyStats,
}) {
  if (!resultBanner || !resultValues) {
    alert(`Examen enviado.\nAciertos: ${globalCorrect}/${totalQuestions}\nCalificación: ${toFixedNice(scoreWeighted)}%`);
    return;
  }

  const message = auto
    ? "El examen fue enviado automáticamente al agotarse el tiempo."
    : "Tu examen se envió correctamente.";

  // Tabla general
  const tableGeneral = `
    <table class="result-table">
      <thead>
        <tr><th>Indicador</th><th>Valor</th></tr>
      </thead>
      <tbody>
        <tr><td>Aciertos</td><td>${globalCorrect} de ${totalQuestions}</td></tr>
        <tr><td>Calificación ponderada</td><td>${toFixedNice(scoreWeighted)}%</td></tr>
      </tbody>
    </table>
  `;

  // Tabla por especialidad
  const tableBySpecialty = `
    <table class="result-table result-table--compact">
      <thead>
        <tr><th>Especialidad</th><th>Aciertos</th></tr>
      </thead>
      <tbody>
        ${Object.keys(SPECIALTIES).map((key) => {
          const s = specStats[key] || { correct: 0, total: 0 };
          return `
            <tr>
              <td>${SPECIALTIES[key]}</td>
              <td>${s.correct} / ${s.total}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  // Tabla por dificultad
  const tableByDifficulty = `
    <table class="result-table result-table--compact">
      <thead>
        <tr><th>Dificultad</th><th>Aciertos</th></tr>
      </thead>
      <tbody>
        ${Object.keys(DIFFICULTIES).map((d) => {
          const s = difficultyStats[d] || { correct: 0, total: 0 };
          return `
            <tr>
              <td>${DIFFICULTIES[d]}</td>
              <td>${s.correct} / ${s.total}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  // Tabla por subtipo
  const tableBySubtype = `
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
        ${Object.keys(SPECIALTIES).map((key) => {
          const st = specStats[key];
          const sp = st?.subtypes?.salud_publica || { correct: 0, total: 0 };
          const mf = st?.subtypes?.medicina_familiar || { correct: 0, total: 0 };
          const ur = st?.subtypes?.urgencias || { correct: 0, total: 0 };
          return `
            <tr>
              <td>${SPECIALTIES[key]}</td>
              <td>${sp.correct} / ${sp.total}</td>
              <td>${mf.correct} / ${mf.total}</td>
              <td>${ur.correct} / ${ur.total}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;

  resultValues.innerHTML = `
    <div class="result-message">${message}</div>
    <div class="result-tables">
      ${tableGeneral}
      ${tableBySpecialty}
      ${tableByDifficulty}
      ${tableBySubtype}
    </div>
  `;

  resultBanner.style.display = "block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/***********************************************
 * BOTÓN PARA VOLVER A EXÁMENES
 ***********************************************/
btnBackToExams.addEventListener("click", () => {
  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  currentExamId = null;
  currentExamQuestions = [];
  questionsList.innerHTML = "";
  examTimerEl.textContent = "--:--";

  resultBanner.style.display = "none";
  resultValues.innerHTML = "";

  hide(examDetailView);
  hide(progressView);
  show(examsView);

  if (currentSectionId) {
    loadExamsForSectionForStudent(currentSectionId);
  }
});

/***********************************************
 * BOTÓN LATERAL "PROGRESO"
 ***********************************************/
btnProgressView.addEventListener("click", () => {
  document.querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));

  hide(examsView);
  hide(examDetailView);
  show(progressView);

  sidebar.classList.remove("sidebar--open");

  loadStudentProgress();
});

/***********************************************
 * CARGAR PROGRESO DEL ESTUDIANTE
 ***********************************************/
async function loadStudentProgress() {
  if (!currentUser) return;

  progressUsername.textContent =
    "Estudiante: " + (currentUserProfile?.name || currentUser.email);

  const sectionsSnap = await getDocs(collection(db, "sections"));
  const sectionsMap = {};
  sectionsSnap.forEach((docSnap) => {
    sectionsMap[docSnap.id] = {
      id: docSnap.id,
      name: docSnap.data().name || "Sección",
    };
  });

  const examsSnap = await getDocs(collection(db, "exams"));
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

    const score = at.score || 0;
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

  // Render de tarjetas
  progressSectionsContainer.innerHTML = "";

  Object.values(sectionsMap).forEach((s) => {
    const st = sectionStats[s.id];
    const exams = st.examsCount;

    const card = document.createElement("div");
    card.className = "progress-section-card";

    if (!exams) {
      card.innerHTML = `
        <div class="progress-section-title">${s.name}</div>
        <div>Sin intentos aún.</div>
      `;
    } else {
      const avg = st.totalScore / exams;
      card.innerHTML = `
        <div class="progress-section-title">${s.name}</div>
        <div><strong>Promedio:</strong> ${toFixedNice(avg, 1)}%</div>
        <div><strong>Aciertos:</strong> ${st.correct} / ${st.totalQuestions}</div>
        <div><strong>Exámenes realizados:</strong> ${exams}</div>
      `;
    }

    progressSectionsContainer.appendChild(card);
  });

  // Totales globales
  const totalExams = examResults.length;
  const totalCorrect = examResults.reduce((a, r) => a + r.correctCount, 0);
  const totalQ = examResults.reduce((a, r) => a + r.totalQuestions, 0);

  progressGlobalEl.innerHTML = `
    <div><strong>Exámenes realizados:</strong> ${totalExams}</div>
    <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQ}</div>
  `;

  // Gráfica de evolución
  renderProgressChart(examResults);
}

/***********************************************
 * GRÁFICA DE PROGRESO
 ***********************************************/
function renderProgressChart(examResults) {
  const sorted = examResults
    .slice()
    .sort((a, b) => {
      const A = a.lastAttempt ? a.lastAttempt.getTime() : 0;
      const B = b.lastAttempt ? b.lastAttempt.getTime() : 0;
      return A - B;
    });

  const labels = sorted.map((r, i) => `${i + 1}. ${r.examName}`);
  const data = sorted.map((r) => r.score);

  if (progressChartInstance) progressChartInstance.destroy();

  const ctx = progressChartCanvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, "rgba(37,99,235,0.25)");
  grad.addColorStop(1, "rgba(37,99,235,0)");

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
      plugins: { legend: { display: false } },
    },
  });
}
