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
  ginecologia_obstetricia: "Ginecología y obstetricia",
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

// Tiempo por pregunta y número máximo de intentos (versión simple)
const TIME_PER_QUESTION_SECONDS = 75;
const MAX_ATTEMPTS_PER_EXAM = 3;

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/
// Layout general
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

// Usuario
const studentUserEmailSpan = document.getElementById("student-user-email");
const btnLogout = document.getElementById("student-btn-logout");

// Social icons
const socialButtons = document.querySelectorAll(".social-icon");

// Vistas
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

// Vista progreso (simple)
const progressView = document.getElementById("student-progress-view");
const btnProgressView = document.getElementById("student-progress-btn");
const progressUsername = document.getElementById("student-progress-username");
const progressSectionsContainer = document.getElementById("student-progress-sections");
const progressGlobalEl = document.getElementById("student-progress-global");

// Secciones en sidebar del estudiante
const sidebarSections = document.getElementById("student-sidebar-sections");

// Panel de prueba / CTA post-examen (NO USADOS EN VERSIÓN SIMPLE, LOS OCULTAMOS)
const trialPanel = document.getElementById("trial-locked-panel");
const trialUnlockBtn = document.getElementById("trial-unlock-btn");
const postExamCtaCard = document.getElementById("student-post-exam-cta");
const postExamWhatsappBtn = document.getElementById("student-post-exam-whatsapp");

/***********************************************
 * ESTADO
 ***********************************************/
let currentUser = null;
let currentUserProfile = null;

let currentSectionId = null;
let currentSectionName = "Exámenes disponibles";

let currentExamId = null;
let currentExamName = "";
let currentExamQuestions = [];
let currentExamTotalSeconds = 0;
let currentExamTimerId = null;

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

// Ocultamos elementos de prueba/premium en la versión simple
hide(trialPanel);
hide(postExamCtaCard);

/***********************************************
 * TOGGLE SIDEBAR (MÓVIL)
 ***********************************************/
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
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
      alert("Tu usuario no está configurado en el sistema.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentUserProfile = userSnap.data();

    if (currentUserProfile.role !== "usuario") {
      alert("Este panel es solo para estudiantes.");
      window.location.href = "index.html";
      return;
    }

    // Cargar secciones y redes sociales
    await loadSectionsForStudent();
    await loadSocialLinksForStudent();

  } catch (err) {
    console.error(err);
    alert("No se pudo cargar la información del estudiante.");
  }
});

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
    console.error("Error cargando social links:", err);
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
 * ICONOS SVG — VISUALES SIMPLES
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
  return "";
}

/***********************************************
 * LISTA DE EXÁMENES — VERSIÓN SIMPLE
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

  for (const docSnap of snap.docs) {
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

    // Calcular el tiempo total del examen
    const totalSeconds = totalQuestions * TIME_PER_QUESTION_SECONDS;
    const totalTimeFormatted = formatMinutesFromSeconds(totalSeconds);

    // RESTRICCIÓN: Intentos agotados
    const disabled = attemptsUsed >= MAX_ATTEMPTS_PER_EXAM;

    const lastAttemptText = attemptSnap.exists()
      ? (attemptSnap.data().lastAttempt
        ? attemptSnap.data().lastAttempt.toDate().toLocaleDateString()
        : "—")
      : "Sin intentos previos.";

    const card = document.createElement("div");
    card.className = "card-item";

    if (disabled) {
      card.style.opacity = 0.6;
    }

    card.innerHTML = `
      <div class="card-item__title-row">
        <div>
          <div class="card-item__title">${examName}</div>
          <div class="panel-subtitle">Simulacro ENARM · ${currentSectionName}</div>
        </div>

        <span class="badge">
          ${disabled ? "Intentos agotados" : "Disponible"}
        </span>
      </div>

      <div style="display:flex;gap:16px;margin-top:12px;font-size:13px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon("questions")}
          <div><strong>${totalQuestions} preguntas</strong></div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon("time")}
          <div><strong>${totalTimeFormatted}</strong></div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          <strong>Intentos:</strong> ${attemptsUsed} / ${MAX_ATTEMPTS_PER_EXAM}
        </div>
      </div>

      <div style="margin-top:14px;text-align:right;">
        ${
          disabled
            ? `<button class="btn btn-outline" disabled>Intentos agotados</button>`
            : `<button class="btn btn-primary student-start-exam-btn">Iniciar examen</button>`
        }
      </div>
    `;

    if (!disabled) {
      const btnStart = card.querySelector(".student-start-exam-btn");
      btnStart.addEventListener("click", () => {
        startExamForStudent({
          examId,
          examName,
          totalQuestions,
          totalSeconds,
          attemptsUsed,
        });
      });
    }

    examsList.appendChild(card);
  }
}
/***********************************************
 * INICIAR EXAMEN — VERSIÓN SIMPLE
 ***********************************************/
async function startExamForStudent({
  examId,
  examName,
  totalQuestions,
  totalSeconds,
  attemptsUsed,
}) {
  currentExamId = examId;
  currentExamName = examName;
  currentExamTotalSeconds = totalSeconds;
  currentExamQuestions = [];

  hide(examsView);
  hide(progressView);
  show(examDetailView);

  resultBanner.style.display = "none";
  resultValues.innerHTML = "";

  examTitle.textContent = examName;
  examSubtitle.textContent = "Resuelve cuidadosamente dentro del tiempo establecido.";

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos previos: <strong>${attemptsUsed}</strong>
  `;

  await loadQuestionsForExam(examId);

  startExamTimer();
}

/***********************************************
 * CARGA DE PREGUNTAS
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
      const completeIndex = globalIndex;

      currentExamQuestions.push({
        caseText: caseData.caseText,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
      });

      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.dataset.qIndex = completeIndex;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${q.questionText}</p>

        <div class="question-options">
          <label><input type="radio" name="q_${completeIndex}" value="A"> A) ${q.optionA}</label>
          <label><input type="radio" name="q_${completeIndex}" value="B"> B) ${q.optionB}</label>
          <label><input type="radio" name="q_${completeIndex}" value="C"> C) ${q.optionC}</label>
          <label><input type="radio" name="q_${completeIndex}" value="D"> D) ${q.optionD}</label>
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
 * CRONÓMETRO DEL EXAMEN
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
      alert("El tiempo se agotó, se enviará tu examen.");
      submitExamForStudent(true);
      return;
    }

    examTimerEl.textContent = formatTimer(remaining);
  }, 1000);
}

/***********************************************
 * BOTÓN ENVIAR EXAMEN
 ***********************************************/
btnSubmitExam.addEventListener("click", () => submitExamForStudent(false));

/***********************************************
 * ENVÍO DE EXAMEN — CALIFICACIÓN SIMPLE
 ***********************************************/
async function submitExamForStudent(auto = false) {
  if (!currentExamId || !currentExamQuestions.length) {
    alert("No hay examen cargado.");
    return;
  }

  btnSubmitExam.disabled = true;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
  }

  let totalQuestions = currentExamQuestions.length;
  let totalCorrect = 0;

  const detail = {};

  currentExamQuestions.forEach((q, idx) => {
    const selectedInput = document.querySelector(`input[name="q_${idx}"]:checked`);
    const selected = selectedInput ? selectedInput.value : null;

    const result = selected === q.correctOption ? "correct" : "incorrect";

    if (result === "correct") totalCorrect++;

    detail[`q${idx}`] = {
      selected,
      correctOption: q.correctOption,
      result,
    };

    // Marcar verdes y rojos
    const card = questionsList.querySelector(`[data-q-index="${idx}"]`);
    if (card) {
      const labels = card.querySelectorAll("label");
      labels.forEach((lab) => {
        const input = lab.querySelector("input");
        if (!input) return;

        lab.style.border = "1px solid transparent";
        lab.style.borderRadius = "6px";
        lab.style.padding = "4px 6px";

        if (input.value === q.correctOption) {
          lab.style.background = "#dcfce7";
          lab.style.borderColor = "#16a34a";
        }
        if (selected === input.value && selected !== q.correctOption) {
          lab.style.background = "#fee2e2";
          lab.style.borderColor = "#b91c1c";
        }
      });
    }
  });

  const score = Math.round((totalCorrect / totalQuestions) * 100);

  try {
    const attemptRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      currentExamId
    );

    const prevSnap = await getDoc(attemptRef);
    const previousAttempts = prevSnap.exists() ? prevSnap.data().attempts || 0 : 0;

    await setDoc(attemptRef, {
      attempts: previousAttempts + 1,
      lastAttempt: serverTimestamp(),
      correctCount: totalCorrect,
      totalQuestions,
      score,
      detail,
    }, { merge: true });

    renderSimpleResults({ auto, totalCorrect, totalQuestions, score });

  } catch (err) {
    console.error(err);
    alert("Hubo un error guardando tu intento.");
  }

  btnSubmitExam.disabled = false;
}
/***********************************************
 * RENDERIZAR RESULTADOS SIMPLES (SIN PREMIUM)
 ***********************************************/
function renderSimpleResults({ auto, totalCorrect, totalQuestions, score }) {
  if (!resultBanner || !resultValues) {
    alert(`Examen enviado.\nAciertos: ${totalCorrect}/${totalQuestions}\nCalificación: ${score}%`);
    return;
  }

  const message = auto
    ? "El examen fue enviado automáticamente al agotarse el tiempo."
    : "Tu examen se envió correctamente.";

  resultValues.innerHTML = `
    <p style="margin-bottom:8px;font-size:14px;"><strong>${message}</strong></p>

    <table class="result-table">
      <thead>
        <tr><th>Indicador</th><th>Valor</th></tr>
      </thead>
      <tbody>
        <tr><td>Aciertos</td><td>${totalCorrect} de ${totalQuestions}</td></tr>
        <tr><td>Calificación</td><td>${score}%</td></tr>
      </tbody>
    </table>
  `;

  resultBanner.style.display = "block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/***********************************************
 * BOTÓN VOLVER A EXÁMENES
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
 * BOTÓN LATERAL "PROGRESO" (VERSIÓN SIMPLE)
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
 * CARGAR PROGRESO DEL ESTUDIANTE (VERSIÓN SIMPLE)
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
      examsCount: 0,
      correct: 0,
      totalQuestions: 0,
      averageScore: 0,
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

    examResults.push({
      examName: exData.name || "Examen",
      sectionId,
      score,
      correctCount: correct,
      totalQuestions: totalQ,
    });

    if (sectionStats[sectionId]) {
      sectionStats[sectionId].examsCount++;
      sectionStats[sectionId].correct += correct;
      sectionStats[sectionId].totalQuestions += totalQ;
      sectionStats[sectionId].averageScore += score;
    }
  }

  progressSectionsContainer.innerHTML = "";

  Object.values(sectionStats).forEach((st) => {
    const exams = st.examsCount;

    const card = document.createElement("div");
    card.className = "progress-section-card";

    if (exams === 0) {
      card.innerHTML = `
        <div class="progress-section-title">${st.name}</div>
        <div>Sin intentos aún.</div>
      `;
    } else {
      const avgScore = st.averageScore / exams;

      card.innerHTML = `
        <div class="progress-section-title">${st.name}</div>
        <div><strong>Promedio:</strong> ${toFixedNice(avgScore, 1)}%</div>
        <div><strong>Aciertos:</strong> ${st.correct} / ${st.totalQuestions}</div>
        <div><strong>Exámenes realizados:</strong> ${exams}</div>
      `;
    }

    progressSectionsContainer.appendChild(card);
  });

  // Totales globales
  const totalExams = examResults.length;
  const totalCorrect = examResults.reduce((a, r) => a + r.correctCount, 0);
  const totalQuestions = examResults.reduce((a, r) => a + r.totalQuestions, 0);

  progressGlobalEl.innerHTML = `
    <div><strong>Exámenes realizados:</strong> ${totalExams}</div>
    <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQuestions}</div>
  `;
}

/***********************************************
 * CERRAR SESIÓN
 ***********************************************/
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
