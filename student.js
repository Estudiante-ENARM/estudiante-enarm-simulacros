/****************************************************
 * FIREBASE (MODULAR v11)
 ****************************************************/
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
  updateDoc,
  addDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// CONFIGURACIÓN
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

/****************************************************
 * REFERENCIAS DOM
 ****************************************************/
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

const studentSidebarSections = document.getElementById("student-sidebar-sections");
const studentExamsView = document.getElementById("student-exams-view");
const studentProgressView = document.getElementById("student-progress-view");
const studentExamDetailView = document.getElementById("student-exam-detail-view");
const studentUserEmail = document.getElementById("student-user-email");

const studentProgressBtn = document.getElementById("student-progress-btn");
const studentBtnLogout = document.getElementById("student-btn-logout");

const studentCurrentSectionTitle = document.getElementById("student-current-section-title");
const studentExamsList = document.getElementById("student-exams-list");

const studentBtnBackToExams = document.getElementById("student-btn-back-to-exams");
const studentExamTitle = document.getElementById("student-exam-title");
const studentExamMetaText = document.getElementById("student-exam-meta-text");
const studentQuestionsList = document.getElementById("student-questions-list");
const studentBtnSubmitExam = document.getElementById("student-btn-submit-exam");

const trialLockedPanel = document.getElementById("trial-locked-panel");
const trialUnlockBtn = document.getElementById("trial-unlock-btn");
const postExamCTA = document.getElementById("student-post-exam-cta");
const postExamWhatsApp = document.getElementById("student-post-exam-whatsapp");

const socialButtons = document.querySelectorAll(".social-icon");

/****************************************************
 * ESTADO GLOBAL
 ****************************************************/
let currentUser = null;
let currentUserData = null;
let currentSectionId = null;
let currentExamId = null;
let examTimerInterval = null;

/****************************************************
 * UTILIDADES
 ****************************************************/
function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function renderEmpty(container, text) {
  container.innerHTML = `
    <div class="card" style="padding:14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

function openLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/****************************************************
 * AUTENTICACIÓN
 ****************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  studentUserEmail.textContent = user.email;

  const snap = await getDoc(doc(db, "users", user.email));
  if (!snap.exists()) {
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  currentUserData = snap.data();

  // Checar vigencia y estatus
  const today = new Date().toISOString().slice(0, 10);
  if (currentUserData.expiryDate && currentUserData.expiryDate < today) {
    await updateDoc(doc(db, "users", user.email), { status: "inactivo" });
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if (currentUserData.status !== "activo") {
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  // Si es admin → redirige
  if (currentUserData.role === "admin") {
    window.location.href = "index.html";
    return;
  }

  await loadSocialLinks();
  await loadSectionsForStudent();
});

/****************************************************
 * CARGAR REDES SOCIALES
 ****************************************************/
async function loadSocialLinks() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data();
    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      if (data[network]) btn.dataset.url = data[network];
    });
  } catch (err) {
    console.error(err);
  }
}

socialButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.dataset.url;
    if (!url) {
      alert("No se ha configurado esta red social.");
      return;
    }
    openLink(url);
  });
});

/****************************************************
 * CARGA DE SECCIONES (ESTUDIANTE)
 ****************************************************/
async function loadSectionsForStudent() {
  const snap = await getDocs(collection(db, "sections"));

  studentSidebarSections.innerHTML = "";

  if (snap.empty) {
    studentSidebarSections.innerHTML = `
      <li style="color:#888;font-size:13px;padding:6px;">
        No hay secciones disponibles.
      </li>
    `;
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.textContent = data.name;
    li.addEventListener("click", () => {
      handleSelectSection(docSnap.id, data.name);
    });

    studentSidebarSections.appendChild(li);
  });
}

function handleSelectSection(id, name) {
  currentSectionId = id;

  document
    .querySelectorAll(".sidebar__section-item")
    .forEach((item) => item.classList.remove("sidebar__section-item--active"));

  event.target.classList.add("sidebar__section-item--active");

  studentCurrentSectionTitle.textContent = name;
  show(studentExamsView);
  hide(studentProgressView);
  hide(studentExamDetailView);
  loadExamsForStudent(id);
}

/****************************************************
 * LISTA DE EXÁMENES POR SECCIÓN
 ****************************************************/
async function loadExamsForStudent(sectionId) {
  const qExams = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );

  const snap = await getDocs(qExams);
  studentExamsList.innerHTML = "";

  if (snap.empty) {
    renderEmpty(studentExamsList, "No hay exámenes en esta sección.");
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();

    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${data.name}</div>
        <button class="btn btn-secondary btn-sm open-exam">Resolver</button>
      </div>
    `;

    card.querySelector(".open-exam").addEventListener("click", () => {
      openExamStudent(docSnap.id, data);
    });

    studentExamsList.appendChild(card);
  });
}

/****************************************************
 * ABRIR EXAMEN (ESTUDIANTE)
 ****************************************************/
async function openExamStudent(examId, data) {
  currentExamId = examId;

  hide(studentExamsView);
  hide(studentProgressView);
  show(studentExamDetailView);

  studentExamTitle.textContent = data.name;
  studentQuestionsList.innerHTML = "";
  postExamCTA.classList.add("hidden");

  startTimer(45);

  const qCases = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(qCases);

  if (snap.empty) {
    renderEmpty(studentQuestionsList, "Este examen no contiene preguntas.");
    return;
  }

  snap.forEach((caseSnap) => {
    const caseData = caseSnap.data();
    renderExamCase(caseSnap.id, caseData);
  });

  studentExamMetaText.textContent = "Contesta todas las preguntas.";
}

/****************************************************
 * RENDERIZAR CASO + PREGUNTAS PARA EL EXAMEN
 ****************************************************/
function renderExamCase(caseId, caseData) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";

  wrapper.innerHTML = `
    <p class="panel-subtitle" style="margin-bottom:6px;">
      ${caseData.caseText}
    </p>
  `;

  const questionList = document.createElement("div");
  questionList.className = "cards-list";

  (caseData.questions || []).forEach((q, index) => {
    const qCard = document.createElement("div");
    qCard.className = "card-item";

    qCard.innerHTML = `
      <p class="question-text">${q.questionText}</p>

      <label class="option"><input type="radio" name="q-${caseId}-${index}" value="A"> A) ${q.optionA}</label>
      <label class="option"><input type="radio" name="q-${caseId}-${index}" value="B"> B) ${q.optionB}</label>
      <label class="option"><input type="radio" name="q-${caseId}-${index}" value="C"> C) ${q.optionC}</label>
      <label class="option"><input type="radio" name="q-${caseId}-${index}" value="D"> D) ${q.optionD}</label>
    `;

    questionList.appendChild(qCard);
  });

  wrapper.appendChild(questionList);
  studentQuestionsList.appendChild(wrapper);
}

/****************************************************
 * TIMER DE EXAMEN
 ****************************************************/
function startTimer(minutes) {
  clearInterval(examTimerInterval);

  let totalSec = minutes * 60;
  const timerEl = document.getElementById("student-exam-timer");

  examTimerInterval = setInterval(() => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    timerEl.textContent = `${min}:${sec.toString().padStart(2, "0")}`;

    if (totalSec <= 0) {
      clearInterval(examTimerInterval);
      submitExamAutomatically();
    }

    totalSec--;
  }, 1000);
}

async function submitExamAutomatically() {
  alert("Tiempo agotado. El examen ha sido enviado automáticamente.");
  await submitExam();
}

/****************************************************
 * ENVIAR EXAMEN
 ****************************************************/
studentBtnSubmitExam.addEventListener("click", async () => {
  await submitExam();
});

async function submitExam() {
  const qCases = query(collection(db, "questions"), where("examId", "==", currentExamId));
  const snap = await getDocs(qCases);

  let totalCorrect = 0;
  let totalQuestions = 0;

  for (const caseSnap of snap.docs) {
    const caseData = caseSnap.data();

    caseData.questions.forEach((q, index) => {
      totalQuestions++;

      const selected = document.querySelector(
        `input[name="q-${caseSnap.id}-${index}"]:checked`
      );

      if (selected && selected.value === q.correctOption) {
        totalCorrect++;
      }
    });
  }

  const score = Math.round((totalCorrect / totalQuestions) * 100);

  postExamCTA.classList.remove("hidden");
  studentResultBanner.classList.remove("hidden");
  studentResultValues.textContent = `${score}% de aciertos`;

  return score;
}

/****************************************************
 * PROGRESO DEL ESTUDIANTE
 ****************************************************/
studentProgressBtn.addEventListener("click", () => {
  hide(studentExamsView);
  hide(studentExamDetailView);
  show(studentProgressView);
  loadProgress();
});

async function loadProgress() {
  document.getElementById("student-progress-username").textContent =
    currentUserData.name || currentUser.email;

  document.getElementById("student-progress-sections").innerHTML = `
    <div class="card">
      En la versión completa aparecerá tu desglose por sección.
    </div>
  `;

  const chartContainer = document.getElementById("student-progress-chart");
  const ctx = chartContainer.getContext("2d");

  if (window.progressChart) window.progressChart.destroy();

  window.progressChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Examen 1"],
      datasets: [
        {
          label: "Puntaje",
          data: [0],
          borderWidth: 2,
        },
      ],
    },
  });
}

/****************************************************
 * LOGOUT
 ****************************************************/
studentBtnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

/****************************************************
 * SIDEBAR MÓVIL
 ****************************************************/
btnToggleSidebar?.addEventListener("click", () => {
  sidebar.classList.toggle("sidebar--open");
});
/****************************************************
 * POST-EXAM CTA → REDIRIGIR A WHATSAPP
 ****************************************************/
postExamWhatsApp.addEventListener("click", () => {
  const url = socialButtons[1]?.dataset?.url || "https://wa.me/5213311304749";
  openLink(url);
});

/****************************************************
 * DESBLOQUEO EN MODO PRUEBA
 ****************************************************/
trialUnlockBtn.addEventListener("click", () => {
  const url = socialButtons[1]?.dataset?.url || "https://wa.me/5213311304749";
  openLink(url);
});

/****************************************************
 * CONTENIDO BLOQUEADO (MODO PRUEBA)
 * — Si el usuario es “trial_only: true” solo puede ver el primer examen
 ****************************************************/
async function checkTrialMode(sectionId, examsSnap) {
  if (!currentUserData || !currentUserData.trial_only) return false;

  const firstExam = examsSnap.docs[0];
  const allowedExamId = firstExam?.id;

  return { allowedExamId };
}

/****************************************************
 * RESTRICCIÓN DE EXÁMENES PARA USUARIOS “TRIAL_ONLY”
 ****************************************************/
async function loadExamsForStudent(sectionId) {
  const qExams = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );

  const snap = await getDocs(qExams);
  studentExamsList.innerHTML = "";

  if (snap.empty) {
    renderEmpty(studentExamsList, "No hay exámenes disponibles.");
    return;
  }

  // MODO PRUEBA
  let allowedExamId = null;
  if (currentUserData.trial_only) {
    const trialData = await checkTrialMode(sectionId, snap);
    allowedExamId = trialData.allowedExamId;
  }

  snap.forEach((docSnap) => {
    const examId = docSnap.id;
    const data = docSnap.data();

    const card = document.createElement("div");
    card.className = "card-item";

    const locked = currentUserData.trial_only && examId !== allowedExamId;

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${data.name}</div>
        ${
          locked
            ? `<span class="badge" style="background:#dc2626;color:white;">Bloqueado</span>`
            : `<button class="btn btn-secondary btn-sm open-exam">Resolver</button>`
        }
      </div>
    `;

    if (!locked) {
      card.querySelector(".open-exam").addEventListener("click", () => {
        openExamStudent(docSnap.id, data);
      });
    } else {
      card.addEventListener("click", () => {
        show(trialLockedPanel);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    studentExamsList.appendChild(card);
  });
}

/****************************************************
 * RESULTADOS PREMIUM
 ****************************************************/
const studentResultBanner = document.getElementById("student-result-banner");
const studentResultValues = document.getElementById("student-result-values");

/****************************************************
 * FUNCIÓN DE ENVÍO (EXTENDIDA PARA MODO PRUEBA)
 ****************************************************/
async function submitExam() {
  const qCases = query(collection(db, "questions"), where("examId", "==", currentExamId));
  const snap = await getDocs(qCases);

  let totalCorrect = 0;
  let totalQuestions = 0;

  for (const caseSnap of snap.docs) {
    const caseData = caseSnap.data();

    caseData.questions.forEach((q, index) => {
      totalQuestions++;

      const selected = document.querySelector(
        `input[name="q-${caseSnap.id}-${index}"]:checked`
      );

      if (selected && selected.value === q.correctOption) {
        totalCorrect++;
      }
    });
  }

  const score = Math.round((totalCorrect / totalQuestions) * 100);

  // Mostrar banner siempre
  show(studentResultBanner);
  studentResultValues.textContent = `${score}% de aciertos`;

  // SI ES MODO PRUEBA → BLOQUEAR JUSTIFICACIONES Y TABLAS
  if (currentUserData.trial_only) {
    show(postExamCTA);
    hide(studentProgressView);
  }

  return score;
}

/****************************************************
 * PREVENIR ERRORES SI ALGÚN DATO FALTA
 ****************************************************/
window.addEventListener("error", (e) => {
  console.error("Error detectado en student.js:", e.message);
});

/****************************************************
 * LISTO
 ****************************************************/
console.log("STUDENT.JS cargado correctamente.");
