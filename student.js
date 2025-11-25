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
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

function formatMinutesFromSeconds(totalSeconds) {
  return `${Math.ceil(totalSeconds / 60)} min`;
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
  await signOut(auth);
  window.location.href = "index.html";
});

/***********************************************
 * AUTENTICACIÓN
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  studentUserEmailSpan.textContent = currentUser.email;

  const docRef = doc(db, "users", currentUser.email);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    alert("Tu usuario no está configurado en Firestore.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const data = snap.data();
  currentUserProfile = data;

  const today = new Date().toISOString().slice(0, 10);
  if (data.expiryDate && data.expiryDate < today) {
    await setDoc(docRef, { status: "inactivo" }, { merge: true });
    alert("Tu acceso ha vencido.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if (data.status !== "activo") {
    alert("Tu usuario está inactivo.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if (data.role !== "usuario") {
    alert("Este panel es exclusivo para estudiantes.");
    window.location.href = "index.html";
    return;
  }

  await loadExamRules();
  await loadSectionsForStudent();
  await loadSocialLinksForStudent();
});

/***********************************************
 * REGLAS DEL EXAMEN
 ***********************************************/
async function loadExamRules() {
  const snap = await getDoc(doc(db, "examRules", "defaultRules"));
  if (snap.exists()) {
    const d = snap.data();
    if (d.maxAttempts) examRules.maxAttempts = d.maxAttempts;
    if (d.timePerQuestion) examRules.timePerQuestion = d.timePerQuestion;
  }
}

/***********************************************
 * REDES SOCIALES
 ***********************************************/
async function loadSocialLinksForStudent() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (snap.exists()) {
      const data = snap.data();

      socialButtons.forEach((btn) => {
        const network = btn.dataset.network;
        if (data[network]) btn.dataset.url = data[network];
      });
    }
  } catch { }

  socialButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (!url) return alert("Red social no configurada.");
      window.open(url, "_blank");
    });
  });
}

/***********************************************
 * CARGAR SECCIONES
 ***********************************************/
async function loadSectionsForStudent() {
  const snap = await getDocs(collection(db, "sections"));
  sidebarSections.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(examsList, "Aún no hay secciones.");
    return;
  }

  snap.forEach((s) => {
    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.innerHTML = `<div class="sidebar__section-name">${s.data().name}</div>`;

    li.addEventListener("click", () => {
      document
        .querySelectorAll(".sidebar__section-item")
        .forEach((x) => x.classList.remove("sidebar__section-item--active"));

      li.classList.add("sidebar__section-item--active");
      currentSectionId = s.id;
      currentSectionName = s.data().name;

      sectionTitle.textContent = currentSectionName;
      sectionSubtitle.textContent = "Simulacros de esta sección";

      loadExamsForSectionForStudent(s.id);

      show(examsView);
      hide(examDetailView);
      hide(progressView);

      sidebar.classList.remove("sidebar--open");
    });

    sidebarSections.appendChild(li);
  });

  renderEmptyMessage(
    examsList,
    "Selecciona una sección para ver sus exámenes."
  );
}

/***********************************************
 * ICONOS SVG
 ***********************************************/
function svgIcon(type) {
  if (type === "questions") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.7">
        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        <line x1="8" y1="9" x2="16" y2="9"></line>
        <line x1="8" y1="13" x2="13" y2="13"></line>
      </svg>
    `;
  }
  if (type === "time") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="1.7">
        <circle cx="12" cy="13" r="7"></circle>
        <polyline points="12 10 12 13 15 15"></polyline>
      </svg>
    `;
  }
  if (type === "attempts") {
    return `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.7">
        <circle cx="12" cy="14" r="6"></circle>
        <path d="M10 14l2 2 3-3"></path>
      </svg>
    `;
  }
  return "";
}

/***********************************************
 * EXÁMENES DE UNA SECCIÓN
 ***********************************************/
async function loadExamsForSectionForStudent(sectionId) {
  examsList.innerHTML = "";

  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(examsList, "No hay exámenes en esta sección.");
    return;
  }

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const examId = docSnap.id;

    const attemptRef = doc(db, "users", currentUser.email, "examAttempts", examId);
    const attemptSnap = await getDoc(attemptRef);
    const attemptsUsed = attemptSnap.exists()
      ? attemptSnap.data().attempts || 0
      : 0;

    // Preguntas totales
    const qQuestions = query(collection(db, "questions"), where("examId", "==", examId));
    const qSnap = await getDocs(qQuestions);

    let totalQuestions = 0;
    qSnap.forEach((x) => {
      if (Array.isArray(x.data().questions)) {
        totalQuestions += x.data().questions.length;
      }
    });

    if (totalQuestions === 0) {
      const card = document.createElement("div");
      card.className = "card-item";
      card.innerHTML = `<div class="card-item__title">${data.name}</div>
                        <div class="panel-subtitle" style="margin-top:8px;">Sin preguntas aún.</div>`;
      examsList.appendChild(card);
      continue;
    }

    const maxAttempts = examRules.maxAttempts;
    const timePerQuestion = examRules.timePerQuestion;
    const totalSeconds = totalQuestions * timePerQuestion;

    const disabled = attemptsUsed >= maxAttempts;

    const card = document.createElement("div");
    card.className = "card-item";
    if (disabled) card.style.opacity = "0.6";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${data.name}</div>
        <div class="badge">${disabled ? "Intentos agotados" : "Disponible"}</div>
      </div>

      <div style="display:flex;gap:20px;margin-top:10px;">
        <div>${svgIcon("questions")} ${totalQuestions} preguntas</div>
        <div>${svgIcon("time")} ${formatMinutesFromSeconds(totalSeconds)}</div>
        <div>${svgIcon("attempts")} ${attemptsUsed} / ${maxAttempts}</div>
      </div>

      <div style="margin-top:12px;text-align:right;">
        ${
          disabled
            ? `<button class="btn btn-outline" disabled>Intentos agotados</button>`
            : `<button class="btn btn-primary student-start-exam-btn">Iniciar examen</button>`
        }
      </div>
    `;

    if (!disabled) {
      card.querySelector(".student-start-exam-btn").addEventListener("click", () => {
        startExamForStudent({
          examId,
          examName: data.name,
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
 * INICIAR EXAMEN
 ***********************************************/
async function startExamForStudent({
  examId,
  examName,
  totalQuestions,
  totalSeconds,
  attemptsUsed,
  maxAttempts,
}) {
  hide(examsView);
  hide(progressView);
  show(examDetailView);

  currentExamId = examId;
  currentExamName = examName;
  currentExamTotalSeconds = totalSeconds;
  currentExamPreviousAttempts = attemptsUsed;

  if (resultBanner) resultBanner.style.display = "none";
  if (resultValues) resultValues.innerHTML = "";

  examTitle.textContent = examName;
  examMetaText.innerHTML = `
    Preguntas: <strong>${totalQuestions}</strong><br>
    Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    Intentos usados: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  await loadQuestionsForExam(examId);
  startExamTimer();
}

/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN
 ***********************************************/
async function loadQuestionsForExam(examId) {
  questionsList.innerHTML = "";

  const snap = await getDocs(query(collection(db, "questions"), where("examId", "==", examId)));
  if (snap.empty) {
    renderEmptyMessage(questionsList, "Este examen no tiene preguntas aún.");
    return;
  }

  const cases = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (Array.isArray(d.questions) && d.questions.length > 0) {
      cases.push({
        caseText: d.caseText,
        specialty: d.specialty,
        questions: d.questions,
      });
    }
  });

  let globalIndex = 0;
  currentExamQuestions = [];

  cases.forEach((caseData, caseIndex) => {
    const caseBlock = document.createElement("div");
    caseBlock.className = "case-block";

    const specialtyLabel = caseData.specialty
      ? SPECIALTIES[caseData.specialty] || caseData.specialty
      : "Sin especialidad";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="panel-subtitle" style="margin-bottom:6px;font-size:12px;">
        Especialidad: <strong>${specialtyLabel}</strong>
      </div>
      <div class="case-text">${caseData.caseText}</div>
    `;

    const questionsWrapper = document.createElement("div");

    caseData.questions.forEach((qData, localIndex) => {
      const qIndex = globalIndex;

      currentExamQuestions.push({
        ...qData,
        caseText: caseData.caseText,
        specialty: caseData.specialty,
      });

      const difficultyLabel = DIFFICULTIES[qData.difficulty] || "No definida";
      const subtypeLabel = SUBTYPES[qData.subtype] || "General";

      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.dataset.qIndex = qIndex;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${qData.questionText}</p>

        <div class="panel-subtitle" style="font-size:12px;margin-bottom:8px;">
          Dificultad: <strong>${difficultyLabel}</strong> · Tipo: <strong>${subtypeLabel}</strong>
        </div>

        <div class="question-options">
          <label><input type="radio" name="q_${qIndex}" value="A"><span>A) ${qData.optionA}</span></label>
          <label><input type="radio" name="q_${qIndex}" value="B"><span>B) ${qData.optionB}</span></label>
          <label><input type="radio" name="q_${qIndex}" value="C"><span>C) ${qData.optionC}</span></label>
          <label><input type="radio" name="q_${qIndex}" value="D"><span>D) ${qData.optionD}</span></label>
        </div>

        <div class="justification-box">
          <strong>Justificación:</strong><br>
          ${qData.justification}
        </div>
      `;   /* ← CORREGIDO AQUÍ */

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
  if (currentExamTimerId) clearInterval(currentExamTimerId);

  let remaining = currentExamTotalSeconds;
  examTimerEl.textContent = formatTimer(remaining);

  currentExamTimerId = setInterval(() => {
    remaining--;
    examTimerEl.textContent = formatTimer(remaining);

    if (remaining <= 0) {
      clearInterval(currentExamTimerId);
      examTimerEl.textContent = "00:00";
      submitExamForStudent(true);
    }
  }, 1000);
}

/***********************************************
 * ENVÍO DE EXAMEN
 ***********************************************/
btnSubmitExam.addEventListener("click", () => submitExamForStudent(false));

async function submitExamForStudent(auto) {
  if (!currentExamId || currentExamQuestions.length === 0) {
    alert("No hay examen cargado.");
    return;
  }

  btnSubmitExam.disabled = true;
  if (currentExamTimerId) clearInterval(currentExamTimerId);

  const totalQuestions = currentExamQuestions.length;
  let globalCorrect = 0;

  const detail = {};

  currentExamQuestions.forEach((q, index) => {
    const selectedInput = document.querySelector(`input[name="q_${index}"]:checked`);
    const selected = selectedInput ? selectedInput.value : null;
    const correct = q.correctOption;

    if (selected === correct) globalCorrect++;

    detail[`q${index}`] = {
      selected,
      correctOption: correct,
      result: selected === correct ? "correct" : "incorrect",
    };

    const card = questionsList.querySelector(`[data-q-index="${index}"]`);
    const labels = card.querySelectorAll("label");

    labels.forEach((lab) => {
      const input = lab.querySelector("input");
      if (!input) return;
      lab.style.background = "transparent";
      lab.style.border = "1px solid transparent";
      lab.style.borderRadius = "6px";
      lab.style.padding = "4px 6px";

      if (input.value === correct) {
        lab.style.borderColor = "#16a34a";
        lab.style.background = "#dcfce7";
      }
      if (selected && input.value === selected && selected !== correct) {
        lab.style.borderColor = "#b91c1c";
        lab.style.background = "#fee2e2";
      }
    });

    const justBox = card.querySelector(".justification-box");
    justBox.style.display = "block";
  });

  const score = Math.round((globalCorrect / totalQuestions) * 100);

  try {
    await setDoc(
      doc(db, "users", currentUser.email, "examAttempts", currentExamId),
      {
        attempts: currentExamPreviousAttempts + 1,
        lastAttempt: serverTimestamp(),
        score,
        correctCount: globalCorrect,
        totalQuestions,
        detail,
      },
      { merge: true }
    );

    if (resultBanner) {
      resultBanner.style.display = "block";
      resultValues.innerHTML = `
        <h3>Resultado</h3>
        <p>Aciertos: ${globalCorrect} de ${totalQuestions}</p>
        <p>Calificación: ${score}%</p>
      `;

      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert(`Examen enviado. Aciertos: ${globalCorrect}/${totalQuestions}`);
    }
  } catch (err) {
    console.error(err);
    alert("Hubo un error al guardar el intento.");
  }

  btnSubmitExam.disabled = false;
}

/***********************************************
 * VOLVER A EXÁMENES
 ***********************************************/
btnBackToExams.addEventListener("click", () => {
  if (currentExamTimerId) clearInterval(currentExamTimerId);

  currentExamId = null;
  currentExamQuestions = [];

  questionsList.innerHTML = "";
  examTimerEl.textContent = "--:--";

  if (resultBanner) {
    resultBanner.style.display = "none";
    resultValues.innerHTML = "";
  }

  show(examsView);
  hide(examDetailView);

  if (currentSectionId) loadExamsForSectionForStudent(currentSectionId);
});

/***********************************************
 * VISTA PROGRESO
 ***********************************************/
if (btnProgressView) {
  btnProgressView.addEventListener("click", () => {
    document
      .querySelectorAll(".sidebar__section-item")
      .forEach((x) => x.classList.remove("sidebar__section-item--active"));

    hide(examsView);
    hide(examDetailView);
    show(progressView);

    sidebar.classList.remove("sidebar--open");
    loadStudentProgress();
  });
}

/***********************************************
 * CARGAR PROGRESO
 ***********************************************/
async function loadStudentProgress() {
  const displayName = currentUserProfile?.name || currentUser.email;
  progressUsername.textContent = `Estudiante: ${displayName}`;

  const sectionsSnap = await getDocs(collection(db, "sections"));
  const sectionsMap = {};

  sectionsSnap.forEach((s) => {
    sectionsMap[s.id] = { id: s.id, name: s.data().name };
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

  for (const exDoc of examsSnap.docs) {
    const exData = exDoc.data();
    const examId = exDoc.id;
    const sectionId = exData.sectionId;

    const attemptSnap = await getDoc(
      doc(db, "users", currentUser.email, "examAttempts", examId)
    );
    if (!attemptSnap.exists()) continue;

    const d = attemptSnap.data();

    const score = d.score || 0;
    const correctCount = d.correctCount || 0;
    const totalQ = d.totalQuestions || 0;

    examResults.push({
      examName: exData.name,
      sectionId,
      score,
      correctCount,
      totalQuestions: totalQ,
      lastAttempt: d.lastAttempt ? d.lastAttempt.toDate() : null,
    });

    if (sectionStats[sectionId]) {
      sectionStats[sectionId].totalScore += score;
      sectionStats[sectionId].correct += correctCount;
      sectionStats[sectionId].totalQuestions += totalQ;
      sectionStats[sectionId].examsCount++;
    }
  }

  progressSectionsContainer.innerHTML = "";

  Object.values(sectionStats).forEach((s) => {
    const card = document.createElement("div");
    card.className = "progress-section-card";

    if (s.examsCount === 0) {
      card.innerHTML = `
        <div class="progress-section-title">${s.name}</div>
        <div class="progress-section-body">
          <div class="progress-section-line">Sin intentos aún.</div>
        </div>
      `;
    } else {
      const avg = s.totalScore / s.examsCount;
      card.innerHTML = `
        <div class="progress-section-title">${s.name}</div>
        <div class="progress-section-body">
          <div class="progress-section-line"><strong>Promedio:</strong> ${toFixedNice(avg, 1)}%</div>
          <div class="progress-section-line"><strong>Aciertos:</strong> ${s.correct} de ${s.totalQuestions}</div>
          <div class="progress-section-line"><strong>Exámenes resueltos:</strong> ${s.examsCount}</div>
        </div>
      `;
    }

    progressSectionsContainer.appendChild(card);
  });

  const totalCorrect = examResults.reduce((acc, r) => acc + r.correctCount, 0);
  const totalQuestions = examResults.reduce((acc, r) => acc + r.totalQuestions, 0);

  progressGlobalEl.innerHTML = `
    <div><strong>Total exámenes realizados:</strong> ${examResults.length}</div>
    <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQuestions}</div>
  `;

  if (progressChartInstance) progressChartInstance.destroy();

  const sorted = examResults
    .slice()
    .sort((a, b) => (a.lastAttempt?.getTime() || 0) - (b.lastAttempt?.getTime() || 0));

  const labels = sorted.map((r, i) => `${i + 1}. ${r.examName}`);
  const data = sorted.map((r) => r.score);

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
      plugins: { legend: { display: false } },
    },
  });
}
