/***********************************************
 * FIREBASE (MODULAR v11) - CONFIGURACIÓN
 ***********************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  setDoc,
  deleteDoc,
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
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/

// Vistas
const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");

// Header
const currentUserEmail = document.getElementById("current-user-email");
const btnLogout = document.getElementById("btn-logout");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

// Sidebar
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("sidebar-sections");
const btnUsersView = document.getElementById("btn-users-view");
const btnNewSection = document.getElementById("btn-new-section");
const btnEditSocial = document.getElementById("btn-edit-social");
const btnLandingSettings = document.getElementById("btn-landing-settings");

// Iconos sociales
const socialButtons = document.querySelectorAll(".social-icon");

// Main content
const content = document.getElementById("content");

// Vista secciones / exámenes
const sectionsView = document.getElementById("sections-view");
const examsList = document.getElementById("exams-list");
const btnNewExam = document.getElementById("btn-new-exam");
const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");

// Vista usuarios
const usersView = document.getElementById("users-view");
const usersList = document.getElementById("users-list");
const btnCreateUser = document.getElementById("btn-create-user");

// Vista detalle de examen
const examDetailView = document.getElementById("exam-detail-view");
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question");
const btnBackToExams = document.getElementById("btn-back-to-exams");
const questionsList = document.getElementById("questions-list");

// Login
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

// Botones landing (login)
const landingText = document.getElementById("landing-text");
const btnPriceMonth = document.getElementById("btn-price-month");
const btnPriceFull = document.getElementById("btn-price-full");

/***********************************************
 * CREAR VISTA "PANTALLA PRINCIPAL" + "REDES"
 * (si no existe en el HTML, se inyecta aquí)
 ***********************************************/
let landingSettingsView = document.getElementById("landing-settings-view");

if (!landingSettingsView && content) {
  landingSettingsView = document.createElement("div");
  landingSettingsView.id = "landing-settings-view";
  landingSettingsView.className = "panel hidden";
  landingSettingsView.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Pantalla principal</h2>
        <p class="panel-subtitle">
          Configura el texto, precios y enlaces de WhatsApp que aparecen en el login.
        </p>
      </div>
    </div>

    <div id="landing-settings-panel">
      <!-- BLOQUE PANTALLA PRINCIPAL -->
      <div class="card">
        <h3 style="font-size:16px;margin-bottom:8px;">Texto y precios</h3>

        <label class="field">
          <span>Texto principal (se muestra en el recuadro del login)</span>
          <textarea id="landing-hero-text" rows="4"></textarea>
        </label>

        <div class="field">
          <span>Precio mensual (MXN)</span>
          <input id="landing-price-month" type="text" placeholder="p.ej. 199" />
        </div>

        <div class="field">
          <span>Precio acceso completo (MXN)</span>
          <input id="landing-price-full" type="text" placeholder="p.ej. 699" />
        </div>

        <div class="field">
          <span>Enlace WhatsApp — Mensual</span>
          <input id="landing-whatsapp-month" type="url" placeholder="https://wa.me/...">
        </div>

        <div class="field">
          <span>Enlace WhatsApp — Acceso completo</span>
          <input id="landing-whatsapp-full" type="url" placeholder="https://wa.me/...">
        </div>

        <button id="btn-save-landing" class="btn btn-primary" style="margin-top:12px;">
          Guardar pantalla principal
        </button>
      </div>

      <!-- BLOQUE REDES SOCIALES -->
      <div class="card" style="margin-top:18px;">
        <h3 style="font-size:16px;margin-bottom:8px;">Redes sociales</h3>

        <label class="field">
          <span>Instagram (URL)</span>
          <input id="admin-instagram" type="url" placeholder="https://instagram.com/...">
        </label>

        <label class="field">
          <span>WhatsApp (URL)</span>
          <input id="admin-whatsapp" type="url" placeholder="https://wa.me/...">
        </label>

        <label class="field">
          <span>TikTok (URL)</span>
          <input id="admin-tiktok" type="url" placeholder="https://www.tiktok.com/@...">
        </label>

        <label class="field">
          <span>Telegram (URL)</span>
          <input id="admin-telegram" type="url" placeholder="https://t.me/...">
        </label>

        <button id="btn-save-social" class="btn btn-primary" style="margin-top:12px;">
          Guardar redes sociales
        </button>
      </div>
    </div>
  `;
  content.appendChild(landingSettingsView);
}

// Inputs de la vista Pantalla principal / redes
const landingHeroTextEl = document.getElementById("landing-hero-text");
const landingPriceMonthEl = document.getElementById("landing-price-month");
const landingPriceFullEl = document.getElementById("landing-price-full");
const landingWhatsappMonthEl = document.getElementById("landing-whatsapp-month");
const landingWhatsappFullEl = document.getElementById("landing-whatsapp-full");

const adminInstagramEl = document.getElementById("admin-instagram");
const adminWhatsappEl = document.getElementById("admin-whatsapp");
const adminTiktokEl = document.getElementById("admin-tiktok");
const adminTelegramEl = document.getElementById("admin-telegram");

const btnSaveLanding = document.getElementById("btn-save-landing");
const btnSaveSocial = document.getElementById("btn-save-social");

/***********************************************
 * ESTADO
 ***********************************************/
let currentAdmin = null;
let currentSectionId = null;
let currentExamId = null;

/***********************************************
 * HELPERS DE VISTAS
 ***********************************************/
function showLoginView() {
  if (loginView) loginView.classList.remove("hidden");
  if (adminView) adminView.classList.add("hidden");
}

function showAdminPanel(panelEl) {
  if (loginView) loginView.classList.add("hidden");
  if (adminView) adminView.classList.remove("hidden");

  // Ocultar todas las vistas internas
  sectionsView?.classList.add("hidden");
  usersView?.classList.add("hidden");
  examDetailView?.classList.add("hidden");
  landingSettingsView?.classList.add("hidden");

  if (panelEl) panelEl.classList.remove("hidden");
}

/***********************************************
 * LOGIN
 ***********************************************/
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    loginError?.classList.add("hidden");
    loginError.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged manejará el resto
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      if (loginError) {
        loginError.textContent = "Correo o contraseña incorrectos.";
        loginError.classList.remove("hidden");
      }
    }
  });
}

/***********************************************
 * AUTENTICACIÓN Y ROLES
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdmin = null;
    if (currentUserEmail) currentUserEmail.textContent = "";
    showLoginView();
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "users", user.email));
    if (!userSnap.exists()) {
      alert("Tu cuenta no tiene permisos para acceder.");
      await signOut(auth);
      showLoginView();
      return;
    }

    const data = userSnap.data();
    if (data.role !== "admin") {
      alert("Solo administradores pueden acceder a este panel.");
      await signOut(auth);
      showLoginView();
      return;
    }

    currentAdmin = user.email;
    if (currentUserEmail) currentUserEmail.textContent = user.email;

    // Cargar datos necesarios del panel
    await loadSidebarSections();
    await loadLandingSettings();
    await loadSocialPanel();
    await loadSocialLinksForIcons();

    // Mostrar vista principal (secciones)
    showAdminPanel(sectionsView);
  } catch (err) {
    console.error("Error al validar usuario:", err);
    alert("Ocurrió un error cargando tu perfil de administrador.");
    await signOut(auth);
    showLoginView();
  }
});

/***********************************************
 * HAMBURGUESA (MÓVIL)
 ***********************************************/
btnToggleSidebar?.addEventListener("click", () => {
  sidebar?.classList.toggle("sidebar--open");
});

/***********************************************
 * ICONOS SOCIALES (BARRA LATERAL) — CLICK
 ***********************************************/
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

/***********************************************
 * CARGAR LINKS DE REDES PARA ICONOS DEL SIDEBAR
 ***********************************************/
async function loadSocialLinksForIcons() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data() || {};
    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      if (network && data[network]) {
        btn.dataset.url = data[network];
      } else {
        delete btn.dataset.url;
      }
    });
  } catch (err) {
    console.error("Error cargando redes sociales:", err);
  }
}

/***********************************************
 * REDIRECCIONES DESDE EL LOGIN A WHATSAPP
 ***********************************************/
async function applyLandingRedirects() {
  try {
    const snap = await getDoc(doc(db, "settings", "landingPage"));
    if (!snap.exists()) return;

    const data = snap.data() || {};

    if (landingText) {
      landingText.textContent = data.heroText || "";
    }

    if (btnPriceMonth) {
      btnPriceMonth.textContent = data.priceMonth
        ? `$${data.priceMonth} MXN`
        : "Precio mensual";
      btnPriceMonth.onclick = () => {
        if (!data.whatsappMonth) {
          alert("Configura el enlace de WhatsApp mensual en el panel de administrador.");
          return;
        }
        window.open(data.whatsappMonth, "_blank");
      };
    }

    if (btnPriceFull) {
      btnPriceFull.textContent = data.priceFull
        ? `$${data.priceFull} MXN`
        : "Acceso completo";
      btnPriceFull.onclick = () => {
        if (!data.whatsappFull) {
          alert("Configura el enlace de WhatsApp acceso completo en el panel de administrador.");
          return;
        }
        window.open(data.whatsappFull, "_blank");
      };
    }
  } catch (err) {
    console.error("Error al aplicar redirects de landing:", err);
  }
}

// Ejecutar inmediatamente para el login
applyLandingRedirects();
/***********************************************
 * CARGAR SECCIONES EN LA BARRA LATERAL
 ***********************************************/
async function loadSidebarSections() {
  if (!sidebarSections) return;

  sidebarSections.innerHTML = "";

  const snap = await getDocs(collection(db, "sections"));
  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="color:#cbd5f5;font-size:12px;padding:4px 6px;">
        No hay secciones creadas.
      </li>`;
    return;
  }

  snap.forEach((docSnap) => {
    const s = docSnap.data();
    const li = document.createElement("li");
    li.className = "sidebar__section-item";

    li.innerHTML = `
      <div class="sidebar__section-name">${s.name || "Sección sin título"}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-section-btn" data-id="${docSnap.id}">✏️</button>
        <button class="icon-btn delete-section-btn" data-id="${docSnap.id}">🗑️</button>
      </div>
    `;

    // Seleccionar sección
    li.addEventListener("click", (e) => {
      if (e.target.closest(".icon-btn")) return; // evitar conflicto con botones
      openSection(docSnap.id, s.name || "Sección sin título");
    });

    sidebarSections.appendChild(li);
  });

  enableSectionActionButtons();
}

/***********************************************
 * ACCIONES DE SECCIÓN (EDITAR / ELIMINAR)
 ***********************************************/
function enableSectionActionButtons() {
  const editButtons = document.querySelectorAll(".edit-section-btn");
  const deleteButtons = document.querySelectorAll(".delete-section-btn");

  // EDITAR
  editButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const newName = prompt("Nuevo nombre de la sección:");
      if (!newName) return;

      await updateDoc(doc(db, "sections", id), { name: newName.trim() });
      await loadSidebarSections();
      alert("Sección actualizada.");
    });
  });

  // ELIMINAR
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("¿Eliminar esta sección?")) return;

      const id = btn.dataset.id;
      await deleteDoc(doc(db, "sections", id));
      if (currentSectionId === id) {
        currentSectionId = null;
        examsList.innerHTML = "";
        currentSectionTitle.textContent = "Selecciona una sección";
        currentSectionSubtitle.textContent = "Elige una sección para ver sus exámenes.";
        btnNewExam?.classList.add("hidden");
      }
      await loadSidebarSections();
      alert("Sección eliminada.");
    });
  });
}

/***********************************************
 * NUEVA SECCIÓN
 ***********************************************/
btnNewSection?.addEventListener("click", async () => {
  const name = prompt("Nombre de la nueva sección:");
  if (!name) return;

  await addDoc(collection(db, "sections"), {
    name: name.trim(),
    createdAt: serverTimestamp()
  });

  await loadSidebarSections();
  alert("Sección creada.");
});

/***********************************************
 * ABRIR UNA SECCIÓN
 ***********************************************/
async function openSection(sectionId, name) {
  currentSectionId = sectionId;

  if (currentSectionTitle) currentSectionTitle.textContent = name;
  if (currentSectionSubtitle) {
    currentSectionSubtitle.textContent = "Simulacros dentro de esta sección.";
  }

  btnNewExam?.classList.remove("hidden");

  showAdminPanel(sectionsView);
  await loadExams(sectionId);
}

/***********************************************
 * CARGAR EXÁMENES DE UNA SECCIÓN
 ***********************************************/
async function loadExams(sectionId) {
  if (!examsList) return;

  examsList.innerHTML = "";

  const q = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(q);

  if (snap.empty) {
    examsList.innerHTML = `
      <div class="card">
        <p style="font-size:14px;color:#777;">
          No hay exámenes en esta sección.
        </p>
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const ex = docSnap.data();
    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${ex.name || "Examen sin título"}</div>
      </div>

      <div class="flex-row" style="margin-top:12px;">
        <button class="btn btn-secondary edit-exam-btn" data-id="${docSnap.id}">
          Editar
        </button>
        <button class="btn btn-outline delete-exam-btn" data-id="${docSnap.id}">
          Eliminar
        </button>
      </div>
    `;

    examsList.appendChild(card);
  });

  enableExamButtons();
}

/***********************************************
 * ACCIONES DE EXAMEN (EDITAR / ELIMINAR)
 ***********************************************/
function enableExamButtons() {
  const editButtons = document.querySelectorAll(".edit-exam-btn");
  const deleteButtons = document.querySelectorAll(".delete-exam-btn");

  // EDITAR
  editButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openExamEditor(id);
    });
  });

  // ELIMINAR
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este examen?")) return;

      const id = btn.dataset.id;
      await deleteDoc(doc(db, "exams", id));

      // Opcional: eliminar también las preguntas asociadas
      const q = query(collection(db, "questions"), where("examId", "==", id));
      const snap = await getDocs(q);
      const batchDeletes = snap.docs.map((d) => deleteDoc(doc(db, "questions", d.id)));
      await Promise.all(batchDeletes);

      await loadExams(currentSectionId);
      alert("Examen eliminado.");
    });
  });
}

/***********************************************
 * CREAR NUEVO EXAMEN
 ***********************************************/
btnNewExam?.addEventListener("click", async () => {
  if (!currentSectionId) {
    alert("Primero selecciona una sección.");
    return;
  }

  const name = prompt("Nombre del nuevo examen:");
  if (!name) return;

  await addDoc(collection(db, "exams"), {
    name: name.trim(),
    sectionId: currentSectionId,
    createdAt: serverTimestamp()
  });

  await loadExams(currentSectionId);
  alert("Examen creado.");
});

/***********************************************
 * ABRIR EDITOR DE EXAMEN
 ***********************************************/
async function openExamEditor(examId) {
  currentExamId = examId;

  const examSnap = await getDoc(doc(db, "exams", examId));
  if (!examSnap.exists()) {
    alert("El examen no existe.");
    return;
  }

  const exam = examSnap.data();
  if (examNameInput) examNameInput.value = exam.name || "";

  // Guardar nombre del examen
  if (btnSaveExamMeta) {
    btnSaveExamMeta.onclick = async () => {
      const newName = examNameInput.value.trim();
      if (!newName) {
        alert("El nombre no puede estar vacío.");
        return;
      }

      await updateDoc(doc(db, "exams", examId), { name: newName });
      alert("Nombre actualizado.");
      if (currentSectionId) await loadExams(currentSectionId);
    };
  }

  // Crear nueva pregunta / caso clínico
  if (btnNewQuestion) {
    btnNewQuestion.onclick = () => {
      openQuestionCreator(examId);
    };
  }

  showAdminPanel(examDetailView);
  await loadExamQuestions(examId);
}

/***********************************************
 * VOLVER A LA LISTA DE EXÁMENES
 ***********************************************/
btnBackToExams?.addEventListener("click", () => {
  currentExamId = null;
  showAdminPanel(sectionsView);
  if (currentSectionId) {
    loadExams(currentSectionId);
  }
});
/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN
 * (CASOS CLÍNICOS CON ARREGLO questions[])
 ***********************************************/
async function loadExamQuestions(examId) {
  if (!questionsList) return;

  questionsList.innerHTML = "";

  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    questionsList.innerHTML = `
      <div class="card">
        Todavía no hay preguntas cargadas para este examen.
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const caseText = data.caseText || "";
    const arr = Array.isArray(data.questions) ? data.questions : [];
    const first = arr[0] || {};

    const shortCase =
      caseText.length > 140 ? caseText.slice(0, 140) + "…" : caseText;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <p style="font-weight:600;margin-bottom:6px;">
        ${first.questionText || "(Pregunta sin texto)"}
      </p>
      <p class="panel-subtitle" style="margin-bottom:10px;font-size:13px;">
        Caso clínico: ${shortCase || "—"}
      </p>

      <div class="flex-row">
        <button class="btn btn-secondary edit-q-btn" data-id="${docSnap.id}">
          Editar caso / pregunta
        </button>
        <button class="btn btn-outline delete-q-btn" data-id="${docSnap.id}">
          Eliminar
        </button>
      </div>
    `;

    questionsList.appendChild(div);
  });

  enableQuestionButtons();
}

/***********************************************
 * CREAR NUEVO CASO CLÍNICO + PREGUNTA
 * (Estructura compatible con student.js)
 ***********************************************/
async function openQuestionCreator(examId) {
  const caseText = prompt("Escribe el caso clínico completo:");
  if (!caseText) return;

  const specialty = (prompt(
    "Especialidad (medicina_interna, pediatria, gine_obstetricia, cirugia_general):",
    "medicina_interna"
  ) || "medicina_interna").trim();

  const questionText = prompt("Texto de la pregunta:");
  if (!questionText) return;

  const optionA = prompt("Opción A:") || "";
  const optionB = prompt("Opción B:") || "";
  const optionC = prompt("Opción C:") || "";
  const optionD = prompt("Opción D:") || "";

  let correctOption = (prompt("Respuesta correcta (A/B/C/D):", "A") || "A").toUpperCase();
  if (!["A", "B", "C", "D"].includes(correctOption)) correctOption = "A";

  const justification = prompt("Justificación / referencia GPC:") || "";

  const difficulty = (prompt("Dificultad (baja, media, alta):", "media") || "media")
    .toLowerCase();
  const subtype = (prompt(
    "Tipo (salud_publica, medicina_familiar, urgencias):",
    "medicina_familiar"
  ) || "medicina_familiar").toLowerCase();

  await addDoc(collection(db, "questions"), {
    examId,
    caseText,
    specialty,
    questions: [
      {
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        justification,
        difficulty,
        subtype
      }
    ]
  });

  alert("Caso clínico y pregunta creados.");
  await loadExamQuestions(examId);
}

/***********************************************
 * EDITAR CASO CLÍNICO + PRIMERA PREGUNTA DEL ARREGLO
 ***********************************************/
async function openQuestionEditor(questionId) {
  const ref = doc(db, "questions", questionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("La pregunta no existe.");
    return;
  }

  const data = snap.data();
  const currentCaseText = data.caseText || "";
  const currentSpecialty = data.specialty || "medicina_interna";
  const arr = Array.isArray(data.questions) && data.questions.length
    ? data.questions.slice()
    : [{}];
  const first = arr[0];

  const newCaseText = prompt("Editar caso clínico:", currentCaseText);
  if (!newCaseText) return;

  const newSpecialty = (prompt(
    "Especialidad (medicina_interna, pediatria, gine_obstetricia, cirugia_general):",
    currentSpecialty
  ) || currentSpecialty).trim();

  const questionText = prompt("Texto de la pregunta:", first.questionText || "") || "";
  const optionA = prompt("Opción A:", first.optionA || "") || "";
  const optionB = prompt("Opción B:", first.optionB || "") || "";
  const optionC = prompt("Opción C:", first.optionC || "") || "";
  const optionD = prompt("Opción D:", first.optionD || "") || "";

  let correctOption = (prompt(
    "Respuesta correcta (A/B/C/D):",
    first.correctOption || "A"
  ) || "A").toUpperCase();
  if (!["A", "B", "C", "D"].includes(correctOption)) correctOption = "A";

  const justification = prompt(
    "Justificación / referencia GPC:",
    first.justification || ""
  ) || "";

  const difficulty = (prompt(
    "Dificultad (baja, media, alta):",
    first.difficulty || "media"
  ) || "media").toLowerCase();

  const subtype = (prompt(
    "Tipo (salud_publica, medicina_familiar, urgencias):",
    first.subtype || "medicina_familiar"
  ) || "medicina_familiar").toLowerCase();

  arr[0] = {
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    justification,
    difficulty,
    subtype
  };

  await updateDoc(ref, {
    caseText: newCaseText,
    specialty: newSpecialty,
    questions: arr
  });

  alert("Caso clínico / pregunta actualizados.");
  if (currentExamId) {
    await loadExamQuestions(currentExamId);
  }
}

/***********************************************
 * BOTONES EDITAR / ELIMINAR PREGUNTA
 ***********************************************/
function enableQuestionButtons() {
  const editBtns = document.querySelectorAll(".edit-q-btn");
  const delBtns = document.querySelectorAll(".delete-q-btn");

  editBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openQuestionEditor(id);
    });
  });

  delBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("¿Eliminar este caso clínico y sus preguntas?")) return;

      await deleteDoc(doc(db, "questions", id));
      if (currentExamId) {
        await loadExamQuestions(currentExamId);
      }
    });
  });
}
/***********************************************
 * PANEL DE USUARIOS
 ***********************************************/
btnUsersView?.addEventListener("click", async () => {
  showAdminPanel(usersView);
  await loadUsers();
});

/***********************************************
 * CARGAR USUARIOS
 ***********************************************/
async function loadUsers() {
  if (!usersList) return;

  usersList.innerHTML = "";
  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersList.innerHTML = `
      <div class="card">
        No hay usuarios registrados todavía.
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const u = docSnap.data();

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <p><strong>${u.name || "(Sin nombre)"}</strong></p>
      <p>${docSnap.id}</p>
      <p class="panel-subtitle" style="margin-top:4px;">
        Rol: ${u.role || "usuario"} · Estado: ${u.status || "inactivo"}
      </p>

      <div class="flex-row" style="margin-top:10px;">
        <button class="btn btn-secondary edit-user-btn" data-id="${docSnap.id}">
          Editar
        </button>
        <button class="btn btn-outline delete-user-btn" data-id="${docSnap.id}">
          Eliminar
        </button>
      </div>
    `;

    usersList.appendChild(div);
  });

  enableUserButtons();
}

/***********************************************
 * BOTONES USUARIO (EDITAR / ELIMINAR)
 ***********************************************/
function enableUserButtons() {
  const editBtns = document.querySelectorAll(".edit-user-btn");
  const delBtns = document.querySelectorAll(".delete-user-btn");

  editBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openUserEditor(id);
    });
  });

  delBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("¿Eliminar este usuario?")) return;

      await deleteDoc(doc(db, "users", id));
      await loadUsers();
    });
  });
}

/***********************************************
 * CREAR NUEVO USUARIO
 ***********************************************/
btnCreateUser?.addEventListener("click", async () => {
  const name = document.getElementById("new-user-name").value.trim();
  const email = document.getElementById("new-user-email").value.trim();
  const password = document.getElementById("new-user-password").value.trim();
  const status = document.getElementById("new-user-status").value;
  const role = document.getElementById("new-user-role").value;
  const expiry = document.getElementById("new-user-expiry").value;

  if (!email || !password) {
    alert("Email y contraseña obligatorios.");
    return;
  }

  await setDoc(doc(db, "users", email), {
    name: name || "",
    email,
    password,
    status,
    role,
    expiryDate: expiry || ""
  });

  alert("Usuario creado / actualizado.");
  await loadUsers();
});

/***********************************************
 * EDITAR USUARIO (PROMPTS)
 ***********************************************/
async function openUserEditor(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("Usuario no encontrado.");
    return;
  }
  const u = snap.data();

  const name = prompt("Nombre:", u.name || "") || "";
  const status = prompt("Estado (activo/inactivo):", u.status || "activo") || "activo";
  const role = prompt("Rol (usuario/admin):", u.role || "usuario") || "usuario";
  const expiry = prompt(
    "Fecha límite (YYYY-MM-DD):",
    u.expiryDate || ""
  ) || u.expiryDate || "";

  await updateDoc(ref, {
    name,
    status,
    role,
    expiryDate: expiry
  });

  alert("Usuario actualizado.");
  await loadUsers();
}

/***********************************************
 * PANTALLA PRINCIPAL (ADMIN) — CARGAR
 ***********************************************/
async function loadLandingSettings() {
  try {
    const docRef = doc(db, "settings", "landingPage");
    let snap = await getDoc(docRef);

    if (!snap.exists()) {
      await setDoc(docRef, {
        heroText: "",
        priceMonth: "",
        priceFull: "",
        whatsappMonth: "",
        whatsappFull: ""
      });
      snap = await getDoc(docRef);
    }

    const data = snap.data() || {};

    if (landingHeroTextEl) landingHeroTextEl.value = data.heroText || "";
    if (landingPriceMonthEl) landingPriceMonthEl.value = data.priceMonth || "";
    if (landingPriceFullEl) landingPriceFullEl.value = data.priceFull || "";
    if (landingWhatsappMonthEl) landingWhatsappMonthEl.value = data.whatsappMonth || "";
    if (landingWhatsappFullEl) landingWhatsappFullEl.value = data.whatsappFull || "";
  } catch (err) {
    console.error("Error cargando pantalla principal:", err);
  }
}

/***********************************************
 * PANTALLA PRINCIPAL (ADMIN) — GUARDAR
 ***********************************************/
btnSaveLanding?.addEventListener("click", async () => {
  const hero = landingHeroTextEl?.value.trim() || "";
  const priceMonth = landingPriceMonthEl?.value.trim() || "";
  const priceFull = landingPriceFullEl?.value.trim() || "";
  const waMonth = landingWhatsappMonthEl?.value.trim() || "";
  const waFull = landingWhatsappFullEl?.value.trim() || "";

  await setDoc(
    doc(db, "settings", "landingPage"),
    {
      heroText: hero,
      priceMonth,
      priceFull,
      whatsappMonth: waMonth,
      whatsappFull: waFull
    },
    { merge: true }
  );

  alert("Pantalla principal guardada.");
  // Actualizar también login en tiempo real
  applyLandingRedirects();
});

/***********************************************
 * REDES SOCIALES (ADMIN) — CARGAR
 ***********************************************/
async function loadSocialPanel() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) {
      if (adminInstagramEl) adminInstagramEl.value = "";
      if (adminWhatsappEl) adminWhatsappEl.value = "";
      if (adminTiktokEl) adminTiktokEl.value = "";
      if (adminTelegramEl) adminTelegramEl.value = "";
      return;
    }

    const data = snap.data() || {};
    if (adminInstagramEl) adminInstagramEl.value = data.instagram || "";
    if (adminWhatsappEl) adminWhatsappEl.value = data.whatsapp || "";
    if (adminTiktokEl) adminTiktokEl.value = data.tiktok || "";
    if (adminTelegramEl) adminTelegramEl.value = data.telegram || "";
  } catch (err) {
    console.error("Error cargando socialLinks:", err);
  }
}

/***********************************************
 * REDES SOCIALES (ADMIN) — GUARDAR
 ***********************************************/
btnSaveSocial?.addEventListener("click", async () => {
  const insta = adminInstagramEl?.value.trim() || "";
  const wa = adminWhatsappEl?.value.trim() || "";
  const tiktok = adminTiktokEl?.value.trim() || "";
  const tele = adminTelegramEl?.value.trim() || "";

  await setDoc(
    doc(db, "settings", "socialLinks"),
    {
      instagram: insta,
      whatsapp: wa,
      tiktok,
      telegram: tele
    },
    { merge: true }
  );

  alert("Redes sociales guardadas.");
  await loadSocialLinksForIcons();
});

/***********************************************
 * BOTONES SIDEBAR PARA VISTAS EXTRA
 ***********************************************/
btnLandingSettings?.addEventListener("click", async () => {
  showAdminPanel(landingSettingsView);
  await loadLandingSettings();
  await loadSocialPanel();
});

btnEditSocial?.addEventListener("click", async () => {
  showAdminPanel(landingSettingsView);
  await loadSocialPanel();
});

/***********************************************
 * CERRAR SESIÓN
 ***********************************************/
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  currentAdmin = null;
  currentSectionId = null;
  currentExamId = null;
  showLoginView();
});
