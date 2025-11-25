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

// --- Configuración Firebase (MISMA QUE EN app.js) ---
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

// Social
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

// Banner de resultados
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
 * SIDEBAR MÓVIL
 ***********************************************/
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

/***********************************************
 * LOGOUT
 ***********************************************/
btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
  }
});

/***********************************************
 * AUTENTICACIÓN Y ROL
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

    const data = userSnap.data();
    currentUserProfile = data;

    const today = new Date().toISOString().slice(0, 10);
    if (data.expiryDate && data.expiryDate < today) {
      await setDoc(userDocRef, { status: "inactivo" }, { merge: true });
      alert("Tu acceso ha vencido. Contacta al administrador.");
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

    if (data.role !== "usuario") {
      alert("Este panel es solo para estudiantes.");
      window.location.href = "index.html";
      return;
    }

    await loadExamRules();
    await loadSectionsForStudent();
    await loadSocialLinksForStudent();

  } catch (err) {
    console.error(err);
    alert("No se pudo cargar la información del estudiante.");
  }
});

/***********************************************
 * REGLAS GLOBALES DE EXÁMENES
 ***********************************************/
async function loadExamRules() {
  try {
    const snap = await getDoc(doc(db, "examRules", "defaultRules"));
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.maxAttempts === "number") {
        examRules.maxAttempts = data.maxAttempts;
      }
      if (typeof data.timePerQuestion === "number") {
        examRules.timePerQuestion = data.timePerQuestion;
      }
    }
  } catch (err) {
    console.error("No se pudo leer examRules/defaultRules, usando valores por defecto.", err);
  }
}

/***********************************************
 * REDES SOCIALES (ESTUDIANTE)
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
 * SECCIONES (ESTUDIANTE)
 ***********************************************/
async function loadSectionsForStudent() {
  const snap = await getDocs(collection(db, "sections"));
  sidebarSections.innerHTML = "";

  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="font-size:12px;color:#cbd5f5;padding:4px 6px;">
        Aún no hay secciones configuradas.
      </li>
    `;
    renderEmptyMessage(examsList, "No hay exámenes disponibles.");
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "Sección sin título";

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
      loadExamsForSectionForStudent(id);
      sidebar.classList.remove("sidebar--open");

      // Volver a vista de exámenes
      show(examsView);
      hide(examDetailView);
      hide(progressView);
    });

    sidebarSections.appendChild(li);
  });

  renderEmptyMessage(
    examsList,
    "Selecciona una sección en la barra lateral para ver sus exámenes."
  );
}

/***********************************************
 * SVG ICONOS (PREMIUM)
 ***********************************************/
function svgIcon(type) {
  if (type === "questions") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        <line x1="8" y1="9" x2="16" y2="9"></line>
        <line x1="8" y1="13" x2="13" y2="13"></line>
        <circle cx="9" cy="17" r="0.8"></circle>
      </svg>
    `;
  }
  if (type === "time") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="13" r="7"></circle>
        <polyline points="12 10 12 13 15 15"></polyline>
        <line x1="9" y1="4" x2="15" y2="4"></line>
      </svg>
    `;
  }
  if (type === "attempts") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v3"></path>
        <path d="M5.2 5.2l2.1 2.1"></path>
        <path d="M18.8 5.2l-2.1 2.1"></path>
        <circle cx="12" cy="14" r="6"></circle>
        <path d="M10 14l2 2 3-3"></path>
      </svg>
    `;
  }
  return "";
}

/***********************************************
 * EXÁMENES (LISTA ESTUDIANTE, TARJETAS PREMIUM)
 ***********************************************/
async function loadExamsForSectionForStudent(sectionId) {
  examsList.innerHTML = "";

  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );
  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(
      examsList,
      "No hay exámenes disponibles en esta sección."
    );
    return;
  }

  for (const docSnap of snap.docs) {
    const exData = docSnap.data();
    const examId = docSnap.id;
    const examName = exData.name || "Examen sin título";

    // Intentos previos
    const attemptRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      examId
    );
    const attemptSnap = await getDoc(attemptRef);
    const attemptsUsed = attemptSnap.exists()
      ? attemptSnap.data().attempts || 0
      : 0;

    // Número total de preguntas
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

    if (totalQuestions === 0) {
      const card = document.createElement("div");
      card.className = "card-item";
      card.innerHTML = `
        <div class="card-item__title-row">
          <div class="card-item__title">${examName}</div>
          <span class="badge" style="background:#fbbf24;color:#78350f;">
            En preparación
          </span>
        </div>
        <div class="card-item__badge-row" style="margin-top:8px;font-size:13px;color:#6b7280;">
          Aún no hay preguntas cargadas para este examen.
        </div>
      `;
      examsList.appendChild(card);
      continue;
    }

    const maxAttempts = examRules.maxAttempts;
    const timePerQuestion = examRules.timePerQuestion;
    const totalSeconds = totalQuestions * timePerQuestion;
    const totalTimeFormatted = formatMinutesFromSeconds(totalSeconds);

    const disabled = attemptsUsed >= maxAttempts;
    const statusText = disabled ? "Intentos agotados" : "Disponible";

    const lastAttemptText = attemptSnap.exists()
      ? (attemptSnap.data().lastAttempt
        ? attemptSnap.data().lastAttempt.toDate().toLocaleDateString()
        : "—")
      : "Sin intentos previos.";

    const card = document.createElement("div");
    card.className = "card-item";
    if (disabled) {
      card.style.opacity = "0.7";
    }

    card.innerHTML = `
      <div class="card-item__title-row" style="align-items:flex-start;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(37,99,235,0.08);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="15" rx="2"></rect>
              <path d="M7 9h10"></path>
              <path d="M7 13h5"></path>
            </svg>
          </div>
          <div>
            <div class="card-item__title">${examName}</div>
            <div class="panel-subtitle" style="margin-top:3px;">
              Simulacro ENARM · ${currentSectionName}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <span class="badge">
            <span class="badge-dot"></span>
            ${statusText}
          </span>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;font-size:13px;">
        <div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon("questions")}
          <div>
            <div style="font-weight:600;">${totalQuestions} preguntas</div>
            <div class="panel-subtitle">Casos clínicos de la sección</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon("time")}
          <div>
            <div style="font-weight:600;">${totalTimeFormatted}</div>
            <div class="panel-subtitle">Tiempo estimado total</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon("attempts")}
          <div>
            <div style="font-weight:600;">Intentos: ${attemptsUsed} de ${maxAttempts}</div>
            <div class="panel-subtitle">Último intento: ${lastAttemptText}</div>
          </div>
        </div>
      </div>

      <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
        ${
          disabled
            ? `<button type="button" class="btn btn-outline" disabled>Intentos agotados</button>`
            : `<button type="button" class="btn btn-primary student-start-exam-btn">
                 Iniciar examen
               </button>`
        }
      </div>
    `;

    if (!disabled) {
      const startBtn = card.querySelector(".student-start-exam-btn");
      startBtn.addEventListener("click", () => {
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
 * INICIAR EXAMEN (ESTUDIANTE)
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

  // Reset banner de resultados
  if (resultBanner && resultValues) {
    resultBanner.style.display = "none";
    resultValues.innerHTML = "";
  }

  examTitle.textContent = examName;
  examSubtitle.textContent =
    "Resuelve con calma, pero cuidando el tiempo. Una vez enviado, se registrará tu intento.";
  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos usados: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  await loadQuestionsForExam(examId);

  startExamTimer();
}

/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN (AGRUPADO POR CASO)
 ***********************************************/
async function loadQuestionsForExam(examId) {
  questionsList.innerHTML = "";

  const qQuestions = query(
    collection(db, "questions"),
    where("examId", "==", examId)
  );
  const snap = await getDocs(qQuestions);

  if (snap.empty) {
    renderEmptyMessage(
      questionsList,
      "Este examen aún no tiene casos clínicos configurados."
    );
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
        questions: arr.map((q) => ({
          questionText: q.questionText || "",
          optionA: q.optionA || "",
          optionB: q.optionB || "",
          optionC: q.optionC || "",
          optionD: q.optionD || "",
          correctOption: q.correctOption || "",
          justification: q.justification || "",
          difficulty: q.difficulty || null,
          subtype: q.subtype || null,
        })),
      });
    }
  });

  if (cases.length === 0) {
    renderEmptyMessage(
      questionsList,
      "Este examen aún no tiene preguntas configuradas."
    );
    return;
  }

  currentExamQuestions = [];
  let globalIndex = 0;
  questionsList.innerHTML = "";

  cases.forEach((caseData, caseIndex) => {
    const caseBlock = document.createElement("div");
    caseBlock.className = "case-block";

    const specialtyLabel = caseData.specialty
      ? (SPECIALTIES[caseData.specialty] || caseData.specialty)
      : "Sin especialidad especificada";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="panel-subtitle" style="margin-bottom:6px;font-size:12px;">
        Especialidad: <strong>${specialtyLabel}</strong>
      </div>
      <div class="case-text">${caseData.caseText || "Caso clínico no especificado."}</div>
    `;

    const questionsWrapper = document.createElement("div");

    caseData.questions.forEach((qData, localIndex) => {
      const questionGlobalIndex = globalIndex;

      currentExamQuestions.push({
        caseText: caseData.caseText,
        questionText: qData.questionText,
        optionA: qData.optionA,
        optionB: qData.optionB,
        optionC: qData.optionC,
        optionD: qData.optionD,
        correctOption: qData.correctOption,
        justification: qData.justification,
        specialty: caseData.specialty,
        difficulty: qData.difficulty,
        subtype: qData.subtype,
      });

      const difficultyLabel = qData.difficulty
        ? (DIFFICULTIES[qData.difficulty] || qData.difficulty)
        : "No definida";

      const subtypeLabel = qData.subtype
        ? (SUBTYPES[qData.subtype] || qData.subtype)
        : "General";

      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.dataset.qIndex = questionGlobalIndex.toString();

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${qData.questionText || ""}</p>

        <div class="panel-subtitle" style="font-size:12px;margin-bottom:8px;">
          Dificultad: <strong>${difficultyLabel}</strong> · Tipo: <strong>${subtypeLabel}</strong>
        </div>

        <div class="question-options">
          <label>
            <input type="radio" name="q_${questionGlobalIndex}" value="A">
            <span>A) ${qData.optionA || ""}</span>
          </label>
          <label>
            <input type="radio" name="q_${questionGlobalIndex}" value="B">
            <span>B) ${qData.optionB || ""}</span>
          </label>
          <label>
            <input type="radio" name="q_${questionGlobalIndex}" value="C">
            <span>C) ${qData.optionC || ""}</span>
          </label>
          <label>
            <input type="radio" name="q_${questionGlobalIndex}" value="D">
            <span>D) ${qData.optionD || ""}</span>
          </label>
        </div>

        <div class="justification-box">
          <strong>Justificación:</strong><br>
          ${qData.justification || ""}
        </div>
      ";

      questionsWrapper.appendChild(qBlock);
      globalIndex++;
    });

    caseBlock.appendChild(questionsWrapper);
    questionsList.appendChild(caseBlock);
  });
}

/***********************************************
 * CRONÓMETRO
 ***********************************************/
function startExamTimer() {
  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  let remaining = currentExamTotalSeconds;
  examTimerEl.textContent = formatTimer(remaining);

  currentExamTimerId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(currentExamTimerId);
      currentExamTimerId = null;
      examTimerEl.textContent = "00:00";
      alert("El tiempo se ha agotado. Se enviará tu examen automáticamente.");
      submitExamForStudent(true);
    } else {
      examTimerEl.textContent = formatTimer(remaining);
    }
  }, 1000);
}

/***********************************************
 * ENVÍO DE EXAMEN (EVALUACIÓN Y GUARDADO)
 ***********************************************/
btnSubmitExam.addEventListener("click", () => {
  submitExamForStudent(false);
});

async function submitExamForStudent(auto = false) {
  if (!currentExamId || currentExamQuestions.length === 0) {
    alert("No hay examen cargado.");
    return;
  }

  btnSubmitExam.disabled = true;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  const totalQuestions = currentExamQuestions.length;
  const detail = {};

  // Inicializar estructuras de conteo
  const specStats = {};
  Object.keys(SPECIALTIES).forEach((key) => {
    specStats[key] = {
      name: SPECIALTIES[key],
      correct: 0,
      total: 0,
      subtypes: {},
    };
    Object.keys(SUBTYPES).forEach((stKey) => {
      specStats[key].subtypes[stKey] = { correct: 0, total: 0 };
    });
  });

  const difficultyStats = {};
  Object.keys(DIFFICULTIES).forEach((dKey) => {
    difficultyStats[dKey] = { correct: 0, total: 0 };
  });

  let globalCorrect = 0;
  let globalWeightedCorrect = 0;
  let globalWeightedTotal = 0;

  currentExamQuestions.forEach((q, index) => {
    const selectedInput = document.querySelector(
      `input[name="q_${index}"]:checked`
    );
    const selected = selectedInput ? selectedInput.value : null;
    const correct = q.correctOption || "";
    const result = selected === correct ? "correct" : "incorrect";

    const specialtyKey = q.specialty && SPECIALTIES[q.specialty] ? q.specialty : null;
    const difficultyKey = q.difficulty && DIFFICULTY_WEIGHTS[q.difficulty] ? q.difficulty : "baja";
    const subtypeKey = q.subtype && SUBTYPES[q.subtype] ? q.subtype : "salud_publica";

    const weight = DIFFICULTY_WEIGHTS[difficultyKey] || 1;
    globalWeightedTotal += weight;

    if (result === "correct") {
      globalCorrect++;
      globalWeightedCorrect += weight;
    }

    // Contadores por especialidad
    if (specialtyKey && specStats[specialtyKey]) {
      specStats[specialtyKey].total++;
      if (result === "correct") specStats[specialtyKey].correct++;

      if (specStats[specialtyKey].subtypes[subtypeKey]) {
        specStats[specialtyKey].subtypes[subtypeKey].total++;
        if (result === "correct") {
          specStats[specialtyKey].subtypes[subtypeKey].correct++;
        }
      }
    }

    // Contadores por dificultad
    if (difficultyStats[difficultyKey]) {
      difficultyStats[difficultyKey].total++;
      if (result === "correct") difficultyStats[difficultyKey].correct++;
    }

    detail[`q${index}`] = {
      selected,
      correctOption: correct,
      result,
      specialty: specialtyKey,
      difficulty: difficultyKey,
      subtype: subtypeKey,
      weight,
    };

    const card = questionsList.querySelector(`[data-q-index="${index}"]`);
    if (card) {
      const justBox = card.querySelector(".justification-box");
      if (justBox) justBox.style.display = "block";

      const labels = card.querySelectorAll("label");
      labels.forEach((lab) => {
        const input = lab.querySelector("input[type='radio']");
        if (!input) return;
        const val = input.value;

        lab.style.background = "transparent";
        lab.style.border = "1px solid transparent";
        lab.style.borderRadius = "6px";
        lab.style.padding = "4px 6px";

        if (val === correct) {
          lab.style.borderColor = "#16a34a";
          lab.style.background = "#dcfce7";
        }
        if (selected && val === selected && selected !== correct) {
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
    const previousAttempts = prevSnap.exists()
      ? prevSnap.data().attempts || 0
      : currentExamPreviousAttempts;

    const newAttempts = previousAttempts + 1;

    await setDoc(
      attemptRef,
      {
        attempts: newAttempts,
        lastAttempt: serverTimestamp(),
        score: scoreWeighted,          // principal (ponderado)
        scoreRaw,                      // % simple por número de aciertos
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

    // Banner premium de resultados con TABLAS
    if (resultBanner && resultValues) {
      const message = auto
        ? "El examen fue enviado automáticamente al agotarse el tiempo."
        : "Tu examen se envió correctamente.";

      const totalSummaryHtml = `
        <table class="result-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total de aciertos</td>
              <td>${globalCorrect} de ${totalQuestions}</td>
            </tr>
            <tr>
              <td>Total ponderado</td>
              <td>${globalWeightedCorrect} de ${globalWeightedTotal}</td>
            </tr>
            <tr>
              <td>Calificación (ponderada)</td>
              <td>${toFixedNice(scoreWeighted)}%</td>
            </tr>
          </tbody>
        </table>

        <table class="result-table result-table--compact">
          <thead>
            <tr>
              <th>Especialidad</th>
              <th>Aciertos</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(SPECIALTIES).map((key) => {
              const st = specStats[key] || { correct: 0, total: 0 };
              return `
                <tr>
                  <td>${SPECIALTIES[key]}</td>
                  <td>${st.correct} de ${st.total}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;

      const bySubtypeHtml = `
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
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;

      const byDifficultyHtml = `
        <table class="result-table result-table--compact">
          <thead>
            <tr>
              <th>Dificultad</th>
              <th>Aciertos</th>
            </tr>
          </thead>
          <tbody>
            ${["alta", "media", "baja"].map((key) => {
              const st = difficultyStats[key] || { correct: 0, total: 0 };
              return `
                <tr>
                  <td>${DIFFICULTIES[key]}</td>
                  <td>${st.correct} de ${st.total}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;

      resultValues.innerHTML = `
        <div class="result-message">${message}</div>
        <div class="result-tables">
          ${totalSummaryHtml}
          ${bySubtypeHtml}
          ${byDifficultyHtml}
        </div>
      `;
      resultBanner.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert(
        `Examen enviado.\n\nAciertos: ${globalCorrect} de ${totalQuestions}\nCalificación: ${toFixedNice(scoreWeighted)}%`
      );
    }
  } catch (err) {
    console.error(err);
    alert("No se pudo registrar el intento en la base de datos, pero el examen ya fue evaluado localmente.");
  } finally {
    btnSubmitExam.disabled = false;
  }
}

/***********************************************
 * VOLVER A LISTA DE EXÁMENES
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

  // Ocultar banner al salir del examen
  if (resultBanner && resultValues) {
    resultBanner.style.display = "none";
    resultValues.innerHTML = "";
  }

  hide(examDetailView);
  hide(progressView);
  show(examsView);

  if (currentSectionId) {
    loadExamsForSectionForStudent(currentSectionId);
  }
});

/***********************************************
 * VISTA PROGRESO (BOTÓN SIDEBAR)
 ***********************************************/
if (btnProgressView) {
  btnProgressView.addEventListener("click", () => {
    // Quitar selección de secciones
    document
      .querySelectorAll(".sidebar__section-item")
      .forEach((el) => el.classList.remove("sidebar__section-item--active"));

    hide(examsView);
    hide(examDetailView);
    show(progressView);
    sidebar.classList.remove("sidebar--open");

    loadStudentProgress();
  });
}

/***********************************************
 * CARGAR PROGRESO DEL ESTUDIANTE
 ***********************************************/
async function loadStudentProgress() {
  if (!currentUser) return;

  // Nombre / encabezado
  const displayName = currentUserProfile?.name || currentUser.email;
  if (progressUsername) {
    progressUsername.textContent = `Estudiante: ${displayName}`;
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

  // Exámenes
  const examsSnap = await getDocs(collection(db, "exams"));
  const sectionStats = {};
  Object.values(sectionsMap).forEach((s) => {
    sectionStats[s.id] = {
      id: s.id,
      name: s.name,
      totalScore: 0,
      examsCount: 0,
      correct: 0,
      totalQuestions: 0,
    };
  });

  const examResults = [];

  for (const exDoc of examsSnap.docs) {
    const exData = exDoc.data();
    const examId = exDoc.id;
    const examName = exData.name || "Examen";
    const sectionId = exData.sectionId || null;

    const attemptRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      examId
    );
    const attemptSnap = await getDoc(attemptRef);
    if (!attemptSnap.exists()) continue;

    const atData = attemptSnap.data();
    const score = typeof atData.score === "number" ? atData.score : 0;
    const detail = atData.detail || {};
    let correctCount = typeof atData.correctCount === "number" ? atData.correctCount : 0;
    let totalQ = typeof atData.totalQuestions === "number" ? atData.totalQuestions : 0;

    if (!totalQ || !correctCount) {
      totalQ = Object.keys(detail).length;
      correctCount = Object.values(detail).filter((d) => d.result === "correct").length;
    }

    examResults.push({
      examId,
      examName,
      sectionId,
      sectionName: sectionId && sectionsMap[sectionId] ? sectionsMap[sectionId].name : "Sin sección",
      score,
      correctCount,
      totalQuestions: totalQ,
      lastAttempt: atData.lastAttempt ? atData.lastAttempt.toDate() : null,
    });

    if (sectionId && sectionStats[sectionId]) {
      sectionStats[sectionId].totalScore += score;
      sectionStats[sectionId].examsCount += 1;
      sectionStats[sectionId].correct += correctCount;
      sectionStats[sectionId].totalQuestions += totalQ;
    }
  }

  // Render tarjetas de secciones
  if (progressSectionsContainer) {
    progressSectionsContainer.innerHTML = "";

    Object.values(sectionsMap).forEach((s) => {
      const st = sectionStats[s.id];
      const examsCount = st?.examsCount || 0;

      const card = document.createElement("div");
      card.className = "progress-section-card";

      if (!examsCount) {
        card.innerHTML = `
          <div class="progress-section-title">${s.name}</div>
          <div class="progress-section-body">
            <div class="progress-section-line">Sin intentos aún.</div>
          </div>
        `;
      } else {
        const avgScore = st.totalScore / examsCount;
        card.innerHTML = `
          <div class="progress-section-title">${s.name}</div>
          <div class="progress-section-body">
            <div class="progress-section-line"><strong>Promedio:</strong> ${toFixedNice(avgScore, 1)}%</div>
            <div class="progress-section-line"><strong>Aciertos:</strong> ${st.correct} de ${st.totalQuestions}</div>
            <div class="progress-section-line"><strong>Exámenes resueltos:</strong> ${examsCount}</div>
          </div>
        `;
      }

      progressSectionsContainer.appendChild(card);
    });
  }

  // Totales globales
  if (progressGlobalEl) {
    const totalExamsDone = examResults.length;
    const totalCorrect = examResults.reduce((acc, r) => acc + r.correctCount, 0);
    const totalQuestions = examResults.reduce((acc, r) => acc + r.totalQuestions, 0);

    progressGlobalEl.innerHTML = `
      <div><strong>Total de exámenes realizados:</strong> ${totalExamsDone}</div>
      <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQuestions}</div>
    `;
  }

  // Gráfica de progreso (orden cronológico por último intento)
  if (progressChartCanvas) {
    const sorted = examResults
      .slice()
      .sort((a, b) => {
        const ta = a.lastAttempt ? a.lastAttempt.getTime() : 0;
        const tb = b.lastAttempt ? b.lastAttempt.getTime() : 0;
        return ta - tb;
      });

    const labels = sorted.map((r, idx) => `${idx + 1}. ${r.examName}`);
    const data = sorted.map((r) => r.score);

    if (progressChartInstance) {
      progressChartInstance.destroy();
    }

    const ctx = progressChartCanvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(37,99,235,0.25)");
    gradient.addColorStop(1, "rgba(37,99,235,0.00)");

    progressChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Calificación ponderada",
            data,
            borderColor: "#2563eb",
            backgroundColor: gradient,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#1d4ed8",
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 10 },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }
}
