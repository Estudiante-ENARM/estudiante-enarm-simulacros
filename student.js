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
  query,
  where,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/***********************************************
 * CONFIGURACIÓN FIREBASE
 ***********************************************/
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/***********************************************
 * ELEMENTOS DOM
 ***********************************************/
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

const studentUserEmail = document.getElementById("student-user-email");
const btnLogout = document.getElementById("student-btn-logout");

const examsView = document.getElementById("student-exams-view");
const examsList = document.getElementById("student-exams-list");

const examDetailView = document.getElementById("student-exam-detail-view");
const examBackBtn = document.getElementById("student-btn-back-to-exams");

const questionsList = document.getElementById("student-questions-list");
const submitExamBtn = document.getElementById("student-btn-submit-exam");

const progressBtn = document.getElementById("student-progress-btn");
const progressView = document.getElementById("student-progress-view");

const progressUserName = document.getElementById("student-progress-username");
const progressSections = document.getElementById("student-progress-sections");
const progressGlobal = document.getElementById("student-progress-global");

const progressChart = document.getElementById("student-progress-chart");

let currentUser = null;
let currentExamId = null;
let currentSectionId = null;
let examTimerInterval = null;

/***********************************************
 * CONTROL DE VISTAS
 ***********************************************/
function showView(view) {
  examsView.classList.add("hidden");
  examDetailView.classList.add("hidden");
  progressView.classList.add("hidden");

  view.classList.remove("hidden");
}

/***********************************************
 * AUTENTICACIÓN
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html"; // regresar al login
    return;
  }

  currentUser = user;
  studentUserEmail.textContent = user.email;

  await loadSidebarSections(user.email);
});
/***********************************************
 * CARGAR SECCIONES EN SIDEBAR (ESTUDIANTE)
 ***********************************************/
async function loadSidebarSections(email) {
  const list = document.getElementById("student-sidebar-sections");
  list.innerHTML = "";

  // El estudiante solo ve las secciones activas
  const snap = await getDocs(collection(db, "sections"));
  if (snap.empty) {
    list.innerHTML = `<li style="color:#ccc;">No hay secciones disponibles.</li>`;
    return;
  }

  snap.forEach((docSnap) => {
    const section = docSnap.data();
    const li = document.createElement("li");

    li.className = "sidebar__section-item";
    li.textContent = section.name;

    li.addEventListener("click", () => {
      currentSectionId = docSnap.id;
      loadExamsStudent(docSnap.id, section.name);
    });

    list.appendChild(li);
  });
}

/***********************************************
 * CARGAR EXÁMENES PARA EL ESTUDIANTE
 ***********************************************/
async function loadExamsStudent(sectionId, sectionName) {
  document.getElementById("student-current-section-title").textContent = sectionName;
  document.getElementById("student-current-section-subtitle").textContent =
    "Selecciona un examen para comenzar.";

  examsList.innerHTML = "";

  const q = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(q);

  if (snap.empty) {
    examsList.innerHTML = `
      <div class="card">
        <p style="font-size:14px;color:#777;">No hay exámenes en esta sección.</p>
      </div>`;
    showView(examsView);
    return;
  }

  snap.forEach((docSnap) => {
    const ex = docSnap.data();

    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <h3 class="card-item__title">${ex.name}</h3>
      </div>
      <div class="flex-row" style="margin-top:12px;">
        <button class="btn btn-primary start-exam-btn" data-id="${docSnap.id}">
          Iniciar examen
        </button>
      </div>
    `;

    examsList.appendChild(card);
  });

  document.querySelectorAll(".start-exam-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      startExam(btn.dataset.id);
    });
  });

  showView(examsView);
}

/***********************************************
 * INICIAR EXAMEN
 ***********************************************/
async function startExam(examId) {
  currentExamId = examId;

  const examSnap = await getDoc(doc(db, "exams", examId));
  if (!examSnap.exists()) {
    alert("Examen no encontrado.");
    return;
  }

  const exam = examSnap.data();

  document.getElementById("student-exam-title").textContent = exam.name;
  document.getElementById("student-exam-meta-text").textContent =
    exam.description || "";

  // Cargar preguntas
  await loadExamQuestionsStudent(examId);

  // Iniciar cronómetro si el examen tiene tiempo
  if (exam.timeLimit) {
    startExamTimer(exam.timeLimit);
  } else {
    document.getElementById("student-exam-timer").textContent = "--:--";
  }

  showView(examDetailView);
}

/***********************************************
 * CRONÓMETRO DEL EXAMEN
 ***********************************************/
function startExamTimer(minutes) {
  let seconds = minutes * 60;

  clearInterval(examTimerInterval);

  examTimerInterval = setInterval(() => {
    seconds--;

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    document.getElementById("student-exam-timer").textContent =
      `${m}:${s < 10 ? "0" + s : s}`;

    if (seconds <= 0) {
      clearInterval(examTimerInterval);
      submitExam();
    }
  }, 1000);
}
/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN (ESTUDIANTE)
 ***********************************************/
async function loadExamQuestionsStudent(examId) {
  questionsList.innerHTML = "";

  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    questionsList.innerHTML = `
      <div class="card">
        <p style="font-size:14px;color:#777;">Este examen aún no tiene preguntas.</p>
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const q = docSnap.data();

    const block = document.createElement("div");
    block.className = "question-block";

    // Caso clínico (si existe)
    const caseHTML = q.caseText
      ? `<div class="case-block">
           <h4> Caso clínico </h4>
           <p class="case-text">${q.caseText}</p>
         </div>`
      : "";

    // Opciones
    let optionsHTML = "";
    ["A", "B", "C", "D"].forEach((letter) => {
      if (q["option" + letter]) {
        optionsHTML += `
          <label class="question-option">
            <input type="radio" name="q_${docSnap.id}" value="${letter}">
            <span>${letter}) ${q["option" + letter]}</span>
          </label>
        `;
      }
    });

    block.innerHTML = `
      ${caseHTML}
      <h5>${q.questionText}</h5>
      <div class="question-options">${optionsHTML}</div>

      <!-- Caja de justificación (solo visible tras enviar examen) -->
      <div id="just_${docSnap.id}" class="justification-box">
        <strong>Justificación:</strong><br>${q.justification || "(Sin justificación)"}
      </div>
    `;

    questionsList.appendChild(block);
  });
}

/***********************************************
 * BOTÓN: VOLVER A EXÁMENES
 ***********************************************/
examBackBtn?.addEventListener("click", () => {
  clearInterval(examTimerInterval);
  showView(examsView);
});

/***********************************************
 * ENVIAR EXAMEN
 ***********************************************/
submitExamBtn?.addEventListener("click", () => {
  submitExam();
});

async function submitExam() {
  if (!currentExamId || !currentUser) return;

  let total = 0;
  let correct = 0;

  const q = query(collection(db, "questions"), where("examId", "==", currentExamId));
  const snap = await getDocs(q);

  const results = [];

  snap.forEach((docSnap) => {
    const q = docSnap.data();
    const selected = document.querySelector(`input[name="q_${docSnap.id}"]:checked`);
    const answer = selected ? selected.value : null;

    total++;

    const isCorrect = answer === q.correctAnswer;

    if (isCorrect) correct++;

    // Mostrar justificación
    const box = document.getElementById("just_" + docSnap.id);
    if (box) box.style.display = "block";

    results.push({
      questionId: docSnap.id,
      selected,
      correct: isCorrect,
      timestamp: serverTimestamp()
    });
  });

  const score = Math.round((correct / total) * 100);

  // Guardar resultado para progreso
  await saveExamResult(currentUser.email, currentExamId, score);

  // Renderizar banner premium del resultado
  renderExamResult(score, correct, total);

  alert("Examen enviado.");
}
/***********************************************
 * GUARDAR RESULTADO DEL EXAMEN (PROGRESO)
 ***********************************************/
async function saveExamResult(email, examId, score) {
  const ref = doc(db, "progress", `${email}_${examId}`);

  await setDoc(ref, {
    email,
    examId,
    score,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/***********************************************
 * MOSTRAR RESULTADO (BANNER)
 ***********************************************/
function renderExamResult(score, correct, total) {
  const banner = document.getElementById("student-result-banner");
  const values = document.getElementById("student-result-values");

  banner.style.display = "block";
  values.innerHTML = `
    <p>Puntuación: <strong>${score}%</strong></p>
    <p>Correctas: <strong>${correct}</strong> / ${total}</p>
  `;
}

/***********************************************
 * PANEL DE PROGRESO DEL ESTUDIANTE
 ***********************************************/
progressBtn?.addEventListener("click", async () => {
  await loadProgress();
  showView(progressView);
});

async function loadProgress() {
  progressSections.innerHTML = "";
  progressGlobal.textContent = "";

  const email = currentUser.email;

  // Obtener todos los resultados guardados
  const q = query(collection(db, "progress"), where("email", "==", email));
  const snap = await getDocs(q);

  if (snap.empty) {
    progressGlobal.textContent = "Aún no has realizado exámenes.";
    return;
  }

  let sum = 0;
  let count = 0;

  snap.forEach((docSnap) => {
    const p = docSnap.data();

    sum += p.score;
    count++;

    const div = document.createElement("div");
    div.className = "progress-section-card";
    div.innerHTML = `
      <p class="progress-section-title">Examen: ${p.examId}</p>
      <p>Calificación: <strong>${p.score}%</strong></p>
    `;

    progressSections.appendChild(div);
  });

  const global = Math.round(sum / count);
  progressGlobal.textContent = `Promedio general: ${global}%`;

  renderProgressChart(snap);
}

/***********************************************
 * GRÁFICA DE PROGRESO
 ***********************************************/
let chartInstance = null;

function renderProgressChart(snap) {
  const labels = [];
  const dataValues = [];

  snap.forEach((docSnap) => {
    const p = docSnap.data();
    labels.push(p.examId);
    dataValues.push(p.score);
  });

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(progressChart, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Calificación",
        data: dataValues,
        borderWidth: 2,
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.3)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { min: 0, max: 100 }
      }
    }
  });
}

/***********************************************
 * CERRAR SESIÓN
 ***********************************************/
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
