/***********************************************
 * FIREBASE (MODULAR v11) - CONFIGURACIÓN
 ***********************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---------------------------------------------
// CONFIGURACIÓN FIREBASE
// ---------------------------------------------
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
 * CONSTANTES IMPORTANTES
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
const btnLogout = document.getElementById("student-btn-logout");

// Exámenes
const examsView = document.getElementById("student-exams-view");
const examsList = document.getElementById("student-exams-list");
const sectionTitle = document.getElementById("student-current-section-title");
const sectionSubtitle = document.getElementById("student-current-section-subtitle");

// Detalle examen
const examDetailView = document.getElementById("student-exam-detail-view");
const examTitle = document.getElementById("student-exam-title");
const examSubtitle = document.getElementById("student-exam-subtitle");
const examTimerEl = document.getElementById("student-exam-timer");
const examMetaText = document.getElementById("student-exam-meta-text");
const questionsList = document.getElementById("student-questions-list");

const btnBackToExams = document.getElementById("student-btn-back-to-exams");
const btnSubmitExam = document.getElementById("student-btn-submit-exam");

// Resultados premium
const resultBanner = document.getElementById("student-result-banner");
const resultValues = document.getElementById("student-result-values");

// Progreso
const progressView = document.getElementById("student-progress-view");
const btnProgressView = document.getElementById("student-progress-btn");
const progressUsername = document.getElementById("student-progress-username");
const progressSectionsContainer = document.getElementById("student-progress-sections");
const progressGlobalEl = document.getElementById("student-progress-global");
const progressChartCanvas = document.getElementById("student-progress-chart");

let progressChartInstance = null;

/***********************************************
 * ESTADO DEL ESTUDIANTE
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
function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function renderEmptyMessage(container, text) {
  container.innerHTML = `
    <div class="card" style="padding:12px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>`;
}

function formatMinutesFromSeconds(seconds) {
  return `${Math.ceil(seconds / 60)} min`;
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function toNice(num) {
  return isFinite(num) ? Number(num.toFixed(2)).toString() : "0";
}

/***********************************************
 * AUTENTICACIÓN DEL ESTUDIANTE
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  try {
    const snap = await getDoc(doc(db, "users", user.email));

    if (!snap.exists()) {
      alert("Tu usuario no existe en la plataforma.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentUserProfile = snap.data();

    if (currentUserProfile.role !== "usuario") {
      alert("Este panel es exclusivo para estudiantes.");
      await signOut(auth);
      return;
    }

    await loadExamRules();
    await loadSections();
    await loadSocialLinks();

  } catch (err) {
    console.error(err);
    alert("No se pudo cargar tu información.");
  }
});
/***********************************************
 * CARGAR REGLAS DEL EXAMEN (maxAttempts, timer, etc.)
 ***********************************************/
async function loadExamRules() {
  try {
    const snap = await getDoc(doc(db, "examRules", "defaultRules"));
    if (snap.exists()) examRules = snap.data();
  } catch (err) {
    console.error("Error cargando reglas del examen:", err);
  }
}

/***********************************************
 * CARGAR SECCIONES EN SIDEBAR DEL ESTUDIANTE
 ***********************************************/
async function loadSections() {
  sidebarSections.innerHTML = "";

  try {
    const snap = await getDocs(collection(db, "sections"));
    if (snap.empty) {
      renderEmptyMessage(sidebarSections, "No hay secciones disponibles.");
      return;
    }

    snap.forEach((docSnap) => {
      const sec = docSnap.data();

      const li = document.createElement("li");
      li.className = "sidebar__section-item";
      li.dataset.id = docSnap.id;
      li.innerHTML = `
        <span class="sidebar__section-name">${sec.name}</span>
      `;

      li.addEventListener("click", () => {
        document
          .querySelectorAll(".sidebar__section-item")
          .forEach((el) => el.classList.remove("sidebar__section-item--active"));

        li.classList.add("sidebar__section-item--active");

        currentSectionId = docSnap.id;
        currentSectionName = sec.name;

        loadExamsForSection(docSnap.id);
      });

      sidebarSections.appendChild(li);
    });

  } catch (err) {
    console.error("Error cargando secciones:", err);
  }
}

/***********************************************
 * CARGAR EXÁMENES DE UNA SECCIÓN
 ***********************************************/
async function loadExamsForSection(sectionId) {
  show(examsView);
  hide(examDetailView);
  hide(progressView);

  sectionTitle.textContent = currentSectionName;
  sectionSubtitle.textContent = "Selecciona un examen para comenzar.";

  examsList.innerHTML = "";

  try {
    const q = query(collection(db, "exams"), where("sectionId", "==", sectionId));
    const snap = await getDocs(q);

    if (snap.empty) {
      renderEmptyMessage(examsList, "No hay exámenes en esta sección.");
      return;
    }

    snap.forEach((examSnap) => {
      const exam = examSnap.data();
      const card = document.createElement("div");
      card.className = "card-item";

      card.innerHTML = `
        <div class="card-item__title-row">
          <span class="card-item__title">${exam.name}</span>
          <button class="btn btn-sm btn-primary" data-id="${examSnap.id}">
            Iniciar
          </button>
        </div>
      `;

      card.querySelector("button").addEventListener("click", () => {
        startExam(examSnap.id, exam.name);
      });

      examsList.appendChild(card);
    });

  } catch (err) {
    console.error("Error cargando exámenes:", err);
  }
}

/***********************************************
 * INICIAR EXAMEN
 ***********************************************/
async function startExam(examId, examName) {
  currentExamId = examId;
  currentExamName = examName;

  try {
    // Cargar examen
    const examSnap = await getDoc(doc(db, "exams", examId));
    if (!examSnap.exists()) {
      alert("Este examen ya no existe.");
      return;
    }

    const examMeta = examSnap.data();

    // Cargar preguntas reales del examen
    const q = query(
      collection(db, "questions"),
      where("examId", "==", examId)
    );
    const snap = await getDocs(q);

    currentExamQuestions = [];
    snap.forEach((docSnap) => {
      currentExamQuestions.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    if (currentExamQuestions.length === 0) {
      alert("Este examen no tiene preguntas cargadas.");
      return;
    }

    // Ocultar vistas previas
    hide(examsView);
    hide(progressView);
    show(examDetailView);

    examTitle.textContent = examName;
    examSubtitle.textContent = "Resuelve las preguntas dentro del tiempo establecido.";

    // Meta del examen
    examMetaText.textContent = `
      ${currentExamQuestions.length} preguntas •
      Tiempo total: ${formatMinutesFromSeconds(examRules.timePerQuestion * currentExamQuestions.length)}
    `;

    // Cargar intentos previos
    currentExamPreviousAttempts = await loadAttemptsCount(examId);

    if (currentExamPreviousAttempts >= examRules.maxAttempts) {
      alert("Ya agotaste el número máximo de intentos permitidos.");
      backToExamsView();
      return;
    }

    startTimer(examRules.timePerQuestion * currentExamQuestions.length);

    renderExamQuestions();

  } catch (err) {
    console.error("Error iniciando examen:", err);
  }
}

/***********************************************
 * RENDERIZAR TODAS LAS PREGUNTAS DEL EXAMEN
 ***********************************************/
function renderExamQuestions() {
  questionsList.innerHTML = "";

  currentExamQuestions.forEach((q) => {
    const div = document.createElement("div");
    div.className = "question-block";

    let caseBlock = "";
    if (q.case_text && q.case_text.trim() !== "") {
      caseBlock = `
        <div class="case-block">
          <h4>Caso clínico</h4>
          <div class="case-text">${q.case_text}</div>
        </div>
      `;
    }

    div.innerHTML = `
      ${caseBlock}
      <h5>${q.question}</h5>
      <div class="question-options">
        ${q.options
          .map(
            (opt, idx) => `
              <label>
                <input type="radio" name="q_${q.id}" value="${idx}">
                ${opt}
              </label>
            `
          )
          .join("")}
      </div>
    `;

    questionsList.appendChild(div);
  });

  resultBanner.style.display = "none";
}

/***********************************************
 * CARGAR CUÁNTOS INTENTOS LLEVA EL ESTUDIANTE
 ***********************************************/
async function loadAttemptsCount(examId) {
  try {
    const snap = await getDoc(doc(db, "users", currentUser.email));
    if (!snap.exists()) return 0;

    const data = snap.data();
    return data.attempts?.[examId] ?? 0;

  } catch (err) {
    console.error("Error cargando intentos:", err);
    return 0;
  }
}

/***********************************************
 * INICIAR TIMER DEL EXAMEN
 ***********************************************/
function startTimer(seconds) {
  currentExamTotalSeconds = seconds;

  clearInterval(currentExamTimerId);

  currentExamTimerId = setInterval(() => {
    currentExamTotalSeconds--;
    examTimerEl.textContent = formatTimer(currentExamTotalSeconds);

    if (currentExamTotalSeconds <= 0) {
      clearInterval(currentExamTimerId);
      finishExam(true);
    }
  }, 1000);
}
/***********************************************
 * FINALIZAR EXAMEN (POR ENVÍO O POR TIEMPO)
 ***********************************************/
btnSubmitExam.addEventListener("click", () => finishExam(false));

async function finishExam(byTimeout = false) {
  clearInterval(currentExamTimerId);

  const answers = {};
  let correctCount = 0;

  currentExamQuestions.forEach((q) => {
    const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
    const selectedIndex = selected ? parseInt(selected.value) : null;

    answers[q.id] = selectedIndex;

    if (selectedIndex === q.answer) {
      correctCount++;
    }
  });

  // Calcular resultados completos
  const {
    specialtyResults,
    subtypeResults,
    difficultyResults,
    weightedScore,
  } = calculateDetailedResults(currentExamQuestions, answers);

  const finalScore = (correctCount / currentExamQuestions.length) * 100;

  await saveAttempt(currentExamId, {
    finishedAt: serverTimestamp(),
    correctCount,
    totalQuestions: currentExamQuestions.length,
    finalScore,
    weightedScore,
    answers,
  });

  renderExamResults({
    correctCount,
    totalQuestions: currentExamQuestions.length,
    finalScore,
    weightedScore,
    specialtyResults,
    subtypeResults,
    difficultyResults,
  });

  show(resultBanner);
  examTimerEl.textContent = "--:--";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/***********************************************
 * CÁLCULO DETALLADO DE RESULTADOS
 ***********************************************/
function calculateDetailedResults(questions, answers) {
  const specialtyResults = {};
  const subtypeResults = {};
  const difficultyResults = {};

  let weightedScore = 0;
  let totalWeight = 0;

  questions.forEach((q) => {
    const isCorrect = answers[q.id] === q.answer ? 1 : 0;

    // Especialidad
    if (!specialtyResults[q.specialty]) {
      specialtyResults[q.specialty] = { correct: 0, total: 0 };
    }
    specialtyResults[q.specialty].total++;
    specialtyResults[q.specialty].correct += isCorrect;

    // Subtipo
    if (!subtypeResults[q.subtype]) {
      subtypeResults[q.subtype] = { correct: 0, total: 0 };
    }
    subtypeResults[q.subtype].total++;
    subtypeResults[q.subtype].correct += isCorrect;

    // Dificultad
    if (!difficultyResults[q.difficulty]) {
      difficultyResults[q.difficulty] = { correct: 0, total: 0 };
    }
    difficultyResults[q.difficulty].total++;
    difficultyResults[q.difficulty].correct += isCorrect;

    // Ponderación
    const weight = DIFFICULTY_WEIGHTS[q.difficulty] || 1;
    weightedScore += isCorrect * weight;
    totalWeight += weight;
  });

  const weightedFinal = (weightedScore / totalWeight) * 100;

  return {
    specialtyResults,
    subtypeResults,
    difficultyResults,
    weightedScore: weightedFinal,
  };
}

/***********************************************
 * GUARDAR INTENTO DEL EXAMEN
 ***********************************************/
async function saveAttempt(examId, attemptData) {
  try {
    const ref = doc(db, "users", currentUser.email);
    const snap = await getDoc(ref);

    const existing = snap.data().attempts || {};

    const updatedAttempts = {
      ...existing,
      [examId]: (existing[examId] || 0) + 1,
    };

    await setDoc(
      ref,
      {
        attempts: updatedAttempts,
      },
      { merge: true }
    );

    const attemptsRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      examId + "_" + Date.now()
    );

    await setDoc(attemptsRef, attemptData, { merge: true });

  } catch (err) {
    console.error("Error guardando intento:", err);
  }
}

/***********************************************
 * MOSTRAR RESULTADOS DEL EXAMEN (BANNER + TABLAS)
 ***********************************************/
function renderExamResults({
  correctCount,
  totalQuestions,
  finalScore,
  weightedScore,
  specialtyResults,
  subtypeResults,
  difficultyResults,
}) {
  resultBanner.style.display = "block";

  resultValues.innerHTML = `
    <div>Aciertos: <strong>${correctCount} / ${totalQuestions}</strong></div>
    <div>Score simple: <strong>${toNice(finalScore)}%</strong></div>
    <div>Score ponderado: <strong>${toNice(weightedScore)}%</strong></div>
  `;

  // Justificaciones
  questionsList.querySelectorAll(".justification-box").forEach((j) => {
    j.style.display = "block";
  });

  // Crear tablas premium
  renderResultsTables(specialtyResults, subtypeResults, difficultyResults);
}

/***********************************************
 * TABLAS DE RESULTADOS PREMIUM
 ***********************************************/
function renderResultsTables(specialties, subtypes, difficulties) {
  const container = document.createElement("div");
  container.className = "result-tables";

  container.appendChild(buildResultTable("Resultados por Especialidad", specialties));
  container.appendChild(buildResultTable("Resultados por Subtipo", subtypes));
  container.appendChild(buildResultTable("Resultados por Dificultad", difficulties));

  resultValues.appendChild(container);
}

function buildResultTable(title, dataObj) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <h4 class="result-message">${title}</h4>
    <table class="result-table result-table--compact">
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Aciertos</th>
          <th>Total</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
        ${Object.keys(dataObj)
          .map((key) => {
            const item = dataObj[key];
            const percent = (item.correct / item.total) * 100;
            const label =
              SPECIALTIES[key] ||
              SUBTYPES[key] ||
              DIFFICULTIES[key] ||
              key;

            return `
              <tr>
                <td>${label}</td>
                <td>${item.correct}</td>
                <td>${item.total}</td>
                <td>${toNice(percent)}%</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
  return wrapper;
}

/***********************************************
 * SALIR DEL EXAMEN Y VOLVER A LISTA
 ***********************************************/
btnBackToExams.addEventListener("click", () => {
  backToExamsView();
});

function backToExamsView() {
  clearInterval(currentExamTimerId);
  show(examsView);
  hide(examDetailView);
  hide(progressView);
  resultBanner.style.display = "none";
}
/***********************************************
 * MOSTRAR VISTA DE PROGRESO
 ***********************************************/
btnProgressView.addEventListener("click", async () => {
  hide(examsView);
  hide(examDetailView);
  show(progressView);

  await loadProgressData();
});

/***********************************************
 * CARGAR DATOS DE PROGRESO DEL ESTUDIANTE
 ***********************************************/
async function loadProgressData() {
  progressSectionsContainer.innerHTML = "";
  progressGlobalEl.innerHTML = "";
  progressUsername.textContent = currentUserProfile?.name || currentUser.email;

  try {
    const attemptsCol = collection(db, "users", currentUser.email, "examAttempts");
    const snap = await getDocs(attemptsCol);

    if (snap.empty) {
      progressGlobalEl.innerHTML = `
        <div style="padding:10px;font-size:14px;color:#9ca3af;">
          Aún no tienes exámenes resueltos.
        </div>
      `;
      return;
    }

    let history = [];
    const bySection = {};

    snap.forEach((docSnap) => {
      const att = docSnap.data();
      if (!att.finishedAt) return;

      history.push(att);

      if (!bySection[att.sectionName]) {
        bySection[att.sectionName] = { correct: 0, total: 0 };
      }
      bySection[att.sectionName].correct += att.correctCount;
      bySection[att.sectionName].total += att.totalQuestions;
    });

    // Render tarjetas por sección
    Object.keys(bySection).forEach((sec) => {
      const { correct, total } = bySection[sec];
      const percent = (correct / total) * 100;

      const card = document.createElement("div");
      card.className = "progress-section-card";

      card.innerHTML = `
        <div class="progress-section-title">${sec}</div>
        <div>Aciertos: <strong>${correct}</strong> / ${total}</div>
        <div class="progress-section-line">${toNice(percent)}%</div>
      `;

      progressSectionsContainer.appendChild(card);
    });

    // Resumen general
    const globalCorrect = history.reduce((acc, x) => acc + x.correctCount, 0);
    const globalTotal = history.reduce((acc, x) => acc + x.totalQuestions, 0);
    const globalPercent = (globalCorrect / globalTotal) * 100;

    progressGlobalEl.innerHTML = `
      Promedio global:
      <strong>${toNice(globalPercent)}%</strong>
    `;

    renderProgressChart(history);

  } catch (err) {
    console.error("Error cargando progreso:", err);
  }
}

/***********************************************
 * GRÁFICA DE PROGRESO
 ***********************************************/
function renderProgressChart(history) {
  const sorted = history.sort((a, b) => a.finishedAt.seconds - b.finishedAt.seconds);

  const labels = sorted.map((a) =>
    new Date(a.finishedAt.seconds * 1000).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    })
  );

  const scores = sorted.map((a) => a.finalScore);

  if (progressChartInstance) progressChartInstance.destroy();

  progressChartInstance = new Chart(progressChartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Evolución",
          data: scores,
          borderWidth: 2,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100 },
      },
    },
  });
}

/***********************************************
 * CARGAR LINKS DE REDES SOCIALES DESDE FIRESTORE
 ***********************************************/
async function loadSocialLinks() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const links = snap.data();

    document.querySelectorAll(".social-icon").forEach((icon) => {
      const net = icon.dataset.network;
      if (links[net]) {
        icon.addEventListener("click", () => {
          window.open(links[net], "_blank");
        });
      }
    });
  } catch (err) {
    console.error("Error cargando redes sociales:", err);
  }
}

/***********************************************
 * EVENTO: CERRAR SESIÓN
 ***********************************************/
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

/***********************************************
 * SIDEBAR RESPONSIVE (MÓVIL)
 ***********************************************/
btnToggleSidebar.addEventListener("click", () => {
  sidebar.classList.toggle("sidebar--open");
});
