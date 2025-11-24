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
 * REFERENCIAS DOM
 ***********************************************/
// Layout principal
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("student-sidebar-sections");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

// Encabezado
const studentUserEmailSpan = document.getElementById("student-user-email");
const btnLogout = document.getElementById("student-btn-logout");

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

// Iconos redes (si quieres mantenerlos funcionales más adelante)
const socialButtons = document.querySelectorAll(".social-icon");

/***********************************************
 * ESTADO
 ***********************************************/
let currentUser = null;
let examRules = {
  maxAttempts: 3,
  timePerQuestion: 75, // segundos
};

let currentSectionId = null;
let currentSectionName = "Exámenes disponibles";

let currentExamId = null;
let currentExamName = "";
let currentExamQuestions = []; // arreglo de {caseText, questionText, optionA,B,C,D, correctOption, justification}
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

/***********************************************
 * SIDEBAR MÓVIL
 ***********************************************/
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

/***********************************************
 * AUTENTICACIÓN Y CARGA INICIAL
 ***********************************************/
btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Si no está autenticado, regresar al login principal
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  studentUserEmailSpan.textContent = currentUser.email || "";

  try {
    // Verificamos rol del usuario
    const userDocRef = doc(db, "users", currentUser.email);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      alert("Tu usuario no está configurado en el sistema. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const data = userSnap.data();

    if (data.role !== "usuario") {
      // Si no es rol "usuario", preferible regresar al index (panel admin u otro flujo).
      alert("Este panel es solo para estudiantes.");
      window.location.href = "index.html";
      return;
    }

    // Cargamos configuración global de exámenes
    await loadExamRules();

    // Cargamos secciones
    await loadSectionsForStudent();

  } catch (err) {
    console.error(err);
    alert("No se pudo cargar la información del estudiante.");
  }
});

/***********************************************
 * CONFIGURACIÓN GLOBAL DE EXÁMENES
 * settings/examRules: { maxAttempts, timePerQuestion }
 ***********************************************/
async function loadExamRules() {
  try {
    const snap = await getDoc(doc(db, "settings", "examRules"));
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
    console.error("No se pudo leer settings/examRules, usando valores por defecto.", err);
  }
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
    li.innerHTML = `
      <div class="sidebar__section-name">${name}</div>
    `;

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
    });

    sidebarSections.appendChild(li);
  });

  // Por defecto, mostramos mensaje
  renderEmptyMessage(
    examsList,
    "Selecciona una sección en la barra lateral para ver sus exámenes."
  );
}

/***********************************************
 * EXÁMENES (LISTA ESTUDIANTE CON PUNTOS CLAVE)
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

  // Recorremos exámenes y calculamos info por cada uno
  for (const docSnap of snap.docs) {
    const exData = docSnap.data();
    const examId = docSnap.id;
    const examName = exData.name || "Examen sin título";

    // 1) Intentos previos del estudiante
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

    // 2) Número total de preguntas (sumando todas las preguntas de todos los casos clínicos del examen)
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

    // Si no hay preguntas, no vale la pena que el alumno lo pueda hacer
    if (totalQuestions === 0) {
      // Puedes mostrarlo como "en preparación"
      const card = document.createElement("div");
      card.className = "card";
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
    const timePerQuestion = examRules.timePerQuestion; // segundos
    const totalSeconds = totalQuestions * timePerQuestion;
    const totalTimeFormatted = formatMinutesFromSeconds(totalSeconds);

    const status =
      attemptsUsed >= maxAttempts ? "Agotado" : "Disponible";

    // Tarjeta premium estilo ENARM
    const card = document.createElement("div");
    card.className = "card-item";

    const disabled = attemptsUsed >= maxAttempts;

    card.innerHTML = `
      <div class="card-item__title-row">
        <div>
          <div class="card-item__title">${examName}</div>
          <div class="panel-subtitle" style="margin-top:4px;">
            <span style="opacity:0.9;">Simulacro ENARM</span>
          </div>
        </div>
        <div style="text-align:right;">
          <span class="badge">
            <span class="badge-dot"></span>
            ${status === "Disponible" ? "Disponible" : "Intentos agotados"}
          </span>
        </div>
      </div>

      <div class="card-item__badge-row" style="margin-top:10px;font-size:13px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <span style="display:inline-flex;align-items:center;gap:4px;">
            📘 <strong>${totalQuestions}</strong> preguntas
          </span>
          <span style="display:inline-flex;align-items:center;gap:4px;">
            🕒 ${totalTimeFormatted}
          </span>
          <span style="display:inline-flex;align-items:center;gap:4px;">
            🔁 Intentos: <strong>${attemptsUsed} de ${maxAttempts}</strong>
          </span>
        </div>
      </div>

      <div style="margin-top:10px;font-size:13px;color:#6b7280;">
        ${
          attemptSnap.exists()
            ? `Último intento: ${
                attemptSnap.data().lastAttempt
                  ? attemptSnap
                      .data()
                      .lastAttempt.toDate()
                      .toLocaleDateString()
                  : "—"
              }`
            : "Sin intentos previos."
        }
      </div>

      <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
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
  // Validar intentos
  if (attemptsUsed >= maxAttempts) {
    alert("Has agotado tus intentos para este examen.");
    return;
  }

  currentExamId = examId;
  currentExamName = examName;
  currentExamTotalSeconds = totalSeconds;
  currentExamPreviousAttempts = attemptsUsed;
  currentExamQuestions = [];

  // Cambiar vista
  hide(examsView);
  show(examDetailView);

  examTitle.textContent = examName;
  examSubtitle.textContent =
    "Resuelve con calma, pero cuidando el tiempo. Una vez enviado, se registrará tu intento.";
  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos usados: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  // Cargar preguntas del examen
  await loadQuestionsForExam(examId);

  // Iniciar cronómetro
  startExamTimer();
}

/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN (ESTUDIANTE)
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

  const temp = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const caseText = data.caseText || "";
    const arr = Array.isArray(data.questions) ? data.questions : [];

    arr.forEach((q) => {
      temp.push({
        caseText,
        questionText: q.questionText || "",
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctOption: q.correctOption || "",
        justification: q.justification || "",
      });
    });
  });

  currentExamQuestions = temp;

  if (currentExamQuestions.length === 0) {
    renderEmptyMessage(
      questionsList,
      "Este examen aún no tiene preguntas configuradas."
    );
    return;
  }

  // Renderizar preguntas
  currentExamQuestions.forEach((q, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.qIndex = index.toString();

    card.innerHTML = `
      <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">
        Caso clínico:
      </div>
      <div style="font-size:14px;margin-bottom:10px;">
        ${q.caseText || "Caso clínico no especificado."}
      </div>

      <label class="field">
        <span>Pregunta ${index + 1}</span>
        <textarea class="q-question-student" rows="2" readonly>${q.questionText}</textarea>
      </label>

      <div class="field">
        <span>Opciones</span>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:14px;">
            <input type="radio" name="q_${index}" value="A">
            <span>A) ${q.optionA}</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:14px;">
            <input type="radio" name="q_${index}" value="B">
            <span>B) ${q.optionB}</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:14px;">
            <input type="radio" name="q_${index}" value="C">
            <span>C) ${q.optionC}</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:14px;">
            <input type="radio" name="q_${index}" value="D">
            <span>D) ${q.optionD}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <span>Justificación</span>
        <textarea class="q-justification" rows="2" readonly style="display:none;">${q.justification}</textarea>
      </div>
    `;

    questionsList.appendChild(card);
  });
}

/***********************************************
 * CRONÓMETRO
 ***********************************************/
function startExamTimer() {
  // Reiniciar si ya había un timer
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
      submitExamForStudent(true); // auto
    } else {
      examTimerEl.textContent = formatTimer(remaining);
    }
  }, 1000);
}

/***********************************************
 * ENVIAR EXAMEN (EVALUACIÓN + GUARDADO)
 ***********************************************/
btnSubmitExam.addEventListener("click", () => {
  submitExamForStudent(false);
});

async function submitExamForStudent(auto = false) {
  if (!currentExamId || currentExamQuestions.length === 0) {
    alert("No hay examen cargado.");
    return;
  }

  // Evitar doble envío
  btnSubmitExam.disabled = true;

  if (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = null;
  }

  const total = currentExamQuestions.length;
  let correctCount = 0;

  const detail = {};

  // Evaluar
  currentExamQuestions.forEach((q, index) => {
    const selectedInput = document.querySelector(
      `input[name="q_${index}"]:checked`
    );
    const selected = selectedInput ? selectedInput.value : null;
    const correct = q.correctOption || "";
    const result = selected === correct ? "correct" : "incorrect";

    if (result === "correct") correctCount++;

    detail[`q${index}`] = {
      selected,
      correctOption: correct,
      result,
    };

    // Marcar visualmente
    const card = questionsList.querySelector(`[data-q-index="${index}"]`);
    if (card) {
      // Mostrar justificación
      const justArea = card.querySelector(".q-justification");
      if (justArea) justArea.style.display = "block";

      const labels = card.querySelectorAll("label");
      labels.forEach((lab) => {
        const input = lab.querySelector("input[type='radio']");
        if (!input) return;
        const val = input.value;
        // Limpiamos estilo previo
        lab.style.background = "transparent";
        lab.style.border = "1px solid transparent";
        lab.style.borderRadius = "6px";
        lab.style.padding = "4px 6px";

        // Correcta en verde
        if (val === correct) {
          lab.style.borderColor = "#16a34a";
          lab.style.background = "#dcfce7";
        }
        // Marcada incorrecta en rojo
        if (selected && val === selected && selected !== correct) {
          lab.style.borderColor = "#b91c1c";
          lab.style.background = "#fee2e2";
        }
      });
    }
  });

  const score = Math.round((correctCount / total) * 100);

  // Guardar en Firestore: users/{email}/examAttempts/{examId}
  try {
    const attemptRef = doc(
      db,
      "users",
      currentUser.email,
      "examAttempts",
      currentExamId
    );

    const newAttempts = currentExamPreviousAttempts + 1;

    await setDoc(
      attemptRef,
      {
        attempts: newAttempts,
        lastAttempt: serverTimestamp(),
        score,
        detail,
      },
      { merge: true }
    );

    alert(
      `Examen enviado.\n\nAciertos: ${correctCount} de ${total}\nCalificación: ${score}%`
    );
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

  hide(examDetailView);
  show(examsView);

  // Volver a cargar exámenes de la sección actual para refrescar intentos
  if (currentSectionId) {
    loadExamsForSectionForStudent(currentSectionId);
  }
});
