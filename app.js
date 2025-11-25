/***********************************************
 * FIREBASE (MODULAR v11) - CONFIGURACIÓN
 ***********************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
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
  serverTimestamp,
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

// Sidebar + responsive
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const sidebarSections = document.getElementById("sidebar-sections");

// Botones sidebar
const btnNewSection = document.getElementById("btn-new-section");
const btnUsersView = document.getElementById("btn-users-view");
const btnEditSocial = document.getElementById("btn-edit-social");
const btnLandingView = document.getElementById("btn-landing-view");

// Vistas internas del admin
const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examDetailView = document.getElementById("exam-detail-view");
const landingSettingsView = document.getElementById("landing-settings-view");
const socialSettingsView = document.getElementById("social-settings-view");

// Secciones / exámenes
const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");
const examsList = document.getElementById("exams-list");
const btnNewExam = document.getElementById("btn-new-exam");

// Editor de examen
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question");
const questionsList = document.getElementById("questions-list");
const btnBackToExams = document.getElementById("btn-back-to-exams");

// Usuarios
const usersList = document.getElementById("users-list");
const btnCreateUser = document.getElementById("btn-create-user");

// Campos crear usuario
const newUserName = document.getElementById("new-user-name");
const newUserEmail = document.getElementById("new-user-email");
const newUserPassword = document.getElementById("new-user-password");
const newUserStatus = document.getElementById("new-user-status");
const newUserRole = document.getElementById("new-user-role");
const newUserExpiry = document.getElementById("new-user-expiry");

// Pantalla principal (config admin)
const landingHeroText = document.getElementById("landing-hero-text");
const landingPriceMonth = document.getElementById("landing-price-month");
const landingPriceFull = document.getElementById("landing-price-full");
const landingWhatsappMonth = document.getElementById("landing-whatsapp-month");
const landingWhatsappFull = document.getElementById("landing-whatsapp-full");
const btnSaveLanding = document.getElementById("btn-save-landing");

// Redes sociales (config admin)
const adminInstagram = document.getElementById("admin-instagram");
const adminWhatsapp = document.getElementById("admin-whatsapp");
const adminTiktok = document.getElementById("admin-tiktok");
const adminTelegram = document.getElementById("admin-telegram");
const btnSaveSocial = document.getElementById("btn-save-social");

// Login / landing visible para todos
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const landingText = document.getElementById("landing-text");
const btnPriceMonth = document.getElementById("btn-price-month");
const btnPriceFull = document.getElementById("btn-price-full");

// Iconos sociales (sidebar)
const socialButtons = document.querySelectorAll(".social-icon");

/***********************************************
 * ESTADO
 ***********************************************/
let currentAdminEmail = null;
let currentSectionId = null;
let currentExamId = null;

/***********************************************
 * UTILIDADES DE VISTAS
 ***********************************************/
function hideAllAdminPanels() {
  sectionsView?.classList.add("hidden");
  usersView?.classList.add("hidden");
  examDetailView?.classList.add("hidden");
  landingSettingsView?.classList.add("hidden");
  socialSettingsView?.classList.add("hidden");
}

function showAdminPanel(panelEl) {
  hideAllAdminPanels();
  if (panelEl) panelEl.classList.remove("hidden");
}

/***********************************************
 * LOGIN
 ***********************************************/
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    loginError.textContent = "";

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      loginError.textContent = "Ingresa correo y contraseña.";
      loginError.classList.remove("hidden");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      loginError.textContent = "Correo o contraseña incorrectos.";
      loginError.classList.remove("hidden");
    }
  });
}

/***********************************************
 * AUTENTICACIÓN Y ROLES
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Sesión cerrada
    currentAdminEmail = null;
    adminView.classList.add("hidden");
    loginView.classList.remove("hidden");
    currentUserEmail.textContent = "";
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "users", user.email));
    if (!userSnap.exists()) {
      alert("Tu cuenta no está configurada en el sistema.");
      await signOut(auth);
      return;
    }

    const profile = userSnap.data();

    // Si es ADMIN -> panel admin
    if (profile.role === "admin") {
      currentAdminEmail = user.email;
      currentUserEmail.textContent = user.email;

      loginView.classList.add("hidden");
      adminView.classList.remove("hidden");

      // Carga inicial del panel admin
      showAdminPanel(sectionsView);
      await loadSidebarSections();
      await loadLandingSettings();
      await loadSocialLinksSidebar();
      return;
    }

    // Si es USUARIO -> redirigir a student.html
    if (profile.role === "usuario") {
      // Este index.html es SOLO para admins.
      // Redirigimos al panel de estudiante.
      window.location.href = "student.html";
      return;
    }

    // Rol desconocido
    alert("Tu cuenta no tiene un rol válido.");
    await signOut(auth);
  } catch (err) {
    console.error(err);
    alert("Error leyendo tu perfil de usuario.");
    await signOut(auth);
  }
});

/***********************************************
 * CERRAR SESIÓN
 ***********************************************/
btnLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  } finally {
    adminView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
});

/***********************************************
 * SIDEBAR RESPONSIVE
 ***********************************************/
btnToggleSidebar?.addEventListener("click", () => {
  sidebar?.classList.toggle("sidebar--open");
});

/***********************************************
 * CARGA DE SECCIONES EN LA BARRA LATERAL
 ***********************************************/
async function loadSidebarSections() {
  if (!sidebarSections) return;

  sidebarSections.innerHTML = "";

  const snap = await getDocs(collection(db, "sections"));
  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="color:#cbd5f5;font-size:13px;">No hay secciones creadas.</li>`;
    currentSectionTitle.textContent = "Selecciona una sección";
    currentSectionSubtitle.textContent = "Elige una sección para ver sus exámenes.";
    examsList.innerHTML = "";
    btnNewExam.classList.add("hidden");
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.className = "sidebar__section-item";

    li.innerHTML = `
      <div class="sidebar__section-name">${data.name || "Sección sin nombre"}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-section-btn" data-id="${docSnap.id}">✏️</button>
        <button class="icon-btn delete-section-btn" data-id="${docSnap.id}">🗑️</button>
      </div>
    `;

    // Click para abrir sección
    li.addEventListener("click", (e) => {
      if (e.target.closest(".icon-btn")) return; // no disparar al editar/eliminar
      openSection(docSnap.id, data.name || "Sección");
    });

    sidebarSections.appendChild(li);
  });

  // Activar botones editar/eliminar sección
  enableSectionActionButtons();
}

/***********************************************
 * BOTONES EDITAR / ELIMINAR SECCIÓN
 ***********************************************/
function enableSectionActionButtons() {
  const editButtons = document.querySelectorAll(".edit-section-btn");
  const deleteButtons = document.querySelectorAll(".delete-section-btn");

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

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("¿Eliminar esta sección y sus exámenes?")) return;

      const id = btn.dataset.id;
      await deleteDoc(doc(db, "sections", id));
      // Nota: aquí no estamos borrando exámenes asociados; puedes hacerlo si lo deseas después.
      await loadSidebarSections();
      alert("Sección eliminada.");
    });
  });
}

/***********************************************
 * CREAR NUEVA SECCIÓN
 ***********************************************/
btnNewSection?.addEventListener("click", async () => {
  const name = prompt("Nombre de la nueva sección:");
  if (!name) return;

  await addDoc(collection(db, "sections"), {
    name: name.trim(),
    createdAt: serverTimestamp(),
  });

  await loadSidebarSections();
  alert("Sección creada.");
});

/***********************************************
 * ABRIR UNA SECCIÓN
 ***********************************************/
async function openSection(sectionId, name) {
  currentSectionId = sectionId;

  currentSectionTitle.textContent = name;
  currentSectionSubtitle.textContent = "Simulacros dentro de esta sección.";

  showAdminPanel(sectionsView);
  btnNewExam.classList.remove("hidden");

  await loadExams(sectionId);
}

/***********************************************
 * CARGAR EXÁMENES DE UNA SECCIÓN
 ***********************************************/
async function loadExams(sectionId) {
  examsList.innerHTML = "";

  const q = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(q);

  if (snap.empty) {
    examsList.innerHTML = `
      <div class="card">
        <p style="font-size:14px;color:#6b7280;">
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
        <div class="card-item__title">${ex.name || "Examen sin nombre"}</div>
      </div>

      <div class="flex-row" style="margin-top:12px;">
        <button class="btn btn-secondary btn-open-exam" data-id="${docSnap.id}">Abrir</button>
        <button class="btn btn-outline btn-delete-exam" data-id="${docSnap.id}">Eliminar</button>
      </div>
    `;

    examsList.appendChild(card);
  });

  enableExamButtons();
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
    createdAt: serverTimestamp(),
  });

  await loadExams(currentSectionId);
  alert("Examen creado.");
});

/***********************************************
 * BOTONES EDITAR / ELIMINAR EXAMEN
 ***********************************************/
function enableExamButtons() {
  const openButtons = document.querySelectorAll(".btn-open-exam");
  const deleteButtons = document.querySelectorAll(".btn-delete-exam");

  openButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      openExamEditor(btn.dataset.id);
    });
  });

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este examen?")) return;
      await deleteDoc(doc(db, "exams", btn.dataset.id));
      await loadExams(currentSectionId);
      alert("Examen eliminado.");
    });
  });
}

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

  const ex = examSnap.data();
  examNameInput.value = ex.name || "";

  showAdminPanel(examDetailView);

  await loadExamQuestions(examId);
}

/***********************************************
 * GUARDAR NOMBRE DE EXAMEN
 ***********************************************/
btnSaveExamMeta?.addEventListener("click", async () => {
  if (!currentExamId) return;

  const newName = examNameInput.value.trim();
  if (!newName) {
    alert("Escribe un nombre para el examen.");
    return;
  }

  await updateDoc(doc(db, "exams", currentExamId), { name: newName });
  alert("Nombre de examen actualizado.");

  if (currentSectionId) {
    await loadExams(currentSectionId);
  }
});

/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN
 * (Modelo simple: 1 doc = 1 pregunta)
 ***********************************************/
async function loadExamQuestions(examId) {
  questionsList.innerHTML = "";

  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    questionsList.innerHTML = `
      <div class="card">
        Aún no hay preguntas cargadas para este examen.
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const qData = docSnap.data();

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <p style="font-weight:600;margin-bottom:6px;">
        ${qData.questionText || "(Pregunta sin texto)"}
      </p>
      <p class="panel-subtitle" style="margin-bottom:10px;">
        Caso clínico: ${qData.caseText || "—"}
      </p>

      <ul style="font-size:13px;margin-bottom:10px;">
        <li>A) ${qData.optionA || ""}</li>
        <li>B) ${qData.optionB || ""}</li>
        <li>C) ${qData.optionC || ""}</li>
        <li>D) ${qData.optionD || ""}</li>
      </ul>

      <div class="flex-row">
        <button class="btn btn-secondary btn-edit-q" data-id="${docSnap.id}">Editar</button>
        <button class="btn btn-outline btn-del-q" data-id="${docSnap.id}">Eliminar</button>
      </div>
    `;

    questionsList.appendChild(div);
  });

  enableQuestionButtons();
}

/***********************************************
 * BOTONES EDITAR / ELIMINAR PREGUNTA
 ***********************************************/
function enableQuestionButtons() {
  const editBtns = document.querySelectorAll(".btn-edit-q");
  const delBtns = document.querySelectorAll(".btn-del-q");

  editBtns.forEach((btn) => {
    btn.addEventListener("click", () => openQuestionEditor(btn.dataset.id));
  });

  delBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta pregunta?")) return;
      await deleteDoc(doc(db, "questions", btn.dataset.id));
      if (currentExamId) {
        await loadExamQuestions(currentExamId);
      }
    });
  });
}

/***********************************************
 * CREAR NUEVA PREGUNTA
 ***********************************************/
btnNewQuestion?.addEventListener("click", () => {
  if (!currentExamId) {
    alert("Primero abre un examen.");
    return;
  }
  openQuestionCreator(currentExamId);
});

async function openQuestionCreator(examId) {
  const caseText = prompt("Texto del caso clínico:");
  if (!caseText) return;

  const questionText = prompt("Texto de la pregunta:");
  if (!questionText) return;

  const optionA = prompt("Opción A:") || "";
  const optionB = prompt("Opción B:") || "";
  const optionC = prompt("Opción C:") || "";
  const optionD = prompt("Opción D:") || "";
  const correctOption = (prompt("Respuesta correcta (A/B/C/D):", "A") || "A").toUpperCase();
  const justification = prompt("Justificación de la respuesta:") || "";

  await addDoc(collection(db, "questions"), {
    examId,
    caseText,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    justification,
    createdAt: serverTimestamp(),
  });

  await loadExamQuestions(examId);
  alert("Pregunta creada.");
}

/***********************************************
 * EDITAR PREGUNTA
 ***********************************************/
async function openQuestionEditor(questionId) {
  const qSnap = await getDoc(doc(db, "questions", questionId));
  if (!qSnap.exists()) {
    alert("La pregunta ya no existe.");
    return;
  }

  const qData = qSnap.data();

  const caseText = prompt("Texto del caso clínico:", qData.caseText || "") ?? qData.caseText || "";
  const questionText = prompt("Texto de la pregunta:", qData.questionText || "") ?? qData.questionText || "";
  const optionA = prompt("Opción A:", qData.optionA || "") ?? qData.optionA || "";
  const optionB = prompt("Opción B:", qData.optionB || "") ?? qData.optionB || "";
  const optionC = prompt("Opción C:", qData.optionC || "") ?? qData.optionC || "";
  const optionD = prompt("Opción D:", qData.optionD || "") ?? qData.optionD || "";
  const correctOption = (prompt("Respuesta correcta (A/B/C/D):", qData.correctOption || "A") || "A").toUpperCase();
  const justification = prompt("Justificación:", qData.justification || "") ?? qData.justification || "";

  await updateDoc(doc(db, "questions", questionId), {
    caseText,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    justification,
  });

  if (currentExamId) {
    await loadExamQuestions(currentExamId);
  }

  alert("Pregunta actualizada.");
}

/***********************************************
 * VOLVER A LISTA DE EXÁMENES
 ***********************************************/
btnBackToExams?.addEventListener("click", () => {
  currentExamId = null;
  showAdminPanel(sectionsView);
  if (currentSectionId) loadExams(currentSectionId);
});

/***********************************************
 * PANEL USUARIOS
 ***********************************************/
btnUsersView?.addEventListener("click", async () => {
  showAdminPanel(usersView);
  await loadUsers();
});

/***********************************************
 * CARGAR USUARIOS
 ***********************************************/
async function loadUsers() {
  usersList.innerHTML = "";

  const snap = await getDocs(collection(db, "users"));
  if (snap.empty) {
    usersList.innerHTML = `
      <div class="card">
        No hay usuarios registrados.
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const u = docSnap.data();

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <p><strong>${u.name || "(Sin nombre)"}</strong></p>
      <p>${docSnap.id}</p>
      <p class="panel-subtitle">Rol: ${u.role || "sin rol"} · Estado: ${u.status || "sin estado"}</p>
      <p class="panel-subtitle">Vence: ${u.expiryDate || "—"}</p>

      <div class="flex-row">
        <button class="btn btn-secondary btn-edit-user" data-id="${docSnap.id}">Editar</button>
        <button class="btn btn-outline btn-del-user" data-id="${docSnap.id}">Eliminar</button>
      </div>
    `;

    usersList.appendChild(card);
  });

  // Activar botones
  const editButtons = usersList.querySelectorAll(".btn-edit-user");
  const delButtons = usersList.querySelectorAll(".btn-del-user");

  editButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.id;
      const snap = await getDoc(doc(db, "users", email));
      if (!snap.exists()) return;

      const u = snap.data();

      const name = prompt("Nombre:", u.name || "") ?? u.name || "";
      const status = prompt("Estado (activo/inactivo):", u.status || "activo") ?? u.status || "activo";
      const role = prompt("Rol (admin/usuario):", u.role || "usuario") ?? u.role || "usuario";
      const expiryDate = prompt("Fecha límite (YYYY-MM-DD):", u.expiryDate || "") ?? u.expiryDate || "";

      await updateDoc(doc(db, "users", email), {
        name,
        status,
        role,
        expiryDate,
      });

      alert("Usuario actualizado.");
      await loadUsers();
    });
  });

  delButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.id;
      if (!confirm(`¿Eliminar usuario ${email}?`)) return;
      await deleteDoc(doc(db, "users", email));
      alert("Usuario eliminado.");
      await loadUsers();
    });
  });
}

/***********************************************
 * CREAR NUEVO USUARIO
 ***********************************************/
btnCreateUser?.addEventListener("click", async () => {
  const name = (newUserName.value || "").trim();
  const email = (newUserEmail.value || "").trim();
  const password = (newUserPassword.value || "").trim();
  const status = newUserStatus.value;
  const role = newUserRole.value;
  const expiryDate = newUserExpiry.value;

  if (!email || !password) {
    alert("Email y contraseña son obligatorios (la contraseña es solo de referencia).");
    return;
  }

  await setDoc(doc(db, "users", email), {
    name,
    email,
    password,
    status,
    role,
    expiryDate,
  });

  alert("Usuario creado (recuerda darlo de alta también en Auth si no existe).");
  newUserName.value = "";
  newUserEmail.value = "";
  newUserPassword.value = "";
  newUserExpiry.value = "";

  await loadUsers();
});

/***********************************************
 * PANEL PANTALLA PRINCIPAL (LANDING)
 ***********************************************/
btnLandingView?.addEventListener("click", async () => {
  showAdminPanel(landingSettingsView);
  await loadLandingSettings();
});

async function loadLandingSettings() {
  const ref = doc(db, "settings", "landingPage");
  let snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      heroText: "",
      priceMonth: "",
      priceFull: "",
      whatsappMonth: "",
      whatsappFull: "",
    });
    snap = await getDoc(ref);
  }

  const data = snap.data() || {};

  landingHeroText.value = data.heroText || "";
  landingPriceMonth.value = data.priceMonth || "";
  landingPriceFull.value = data.priceFull || "";
  landingWhatsappMonth.value = data.whatsappMonth || "";
  landingWhatsappFull.value = data.whatsappFull || "";
}

btnSaveLanding?.addEventListener("click", async () => {
  const heroText = landingHeroText.value.trim();
  const priceMonth = landingPriceMonth.value.trim();
  const priceFull = landingPriceFull.value.trim();
  const whatsappMonth = landingWhatsappMonth.value.trim();
  const whatsappFull = landingWhatsappFull.value.trim();

  await setDoc(
    doc(db, "settings", "landingPage"),
    {
      heroText,
      priceMonth,
      priceFull,
      whatsappMonth,
      whatsappFull,
    },
    { merge: true }
  );

  alert("Pantalla principal guardada.");
  // Refrescar textos del login
  await applyLandingRedirects();
});

/***********************************************
 * PANEL REDES SOCIALES (ADMIN)
 ***********************************************/
btnEditSocial?.addEventListener("click", async () => {
  showAdminPanel(socialSettingsView);
  await loadSocialPanel();
});

async function loadSocialPanel() {
  const snap = await getDoc(doc(db, "settings", "socialLinks"));

  if (!snap.exists()) {
    adminInstagram.value = "";
    adminWhatsapp.value = "";
    adminTiktok.value = "";
    adminTelegram.value = "";
    return;
  }

  const data = snap.data();
  adminInstagram.value = data.instagram || "";
  adminWhatsapp.value = data.whatsapp || "";
  adminTiktok.value = data.tiktok || "";
  adminTelegram.value = data.telegram || "";
}

btnSaveSocial?.addEventListener("click", async () => {
  const instagram = adminInstagram.value.trim();
  const whatsapp = adminWhatsapp.value.trim();
  const tiktok = adminTiktok.value.trim();
  const telegram = adminTelegram.value.trim();

  await setDoc(
    doc(db, "settings", "socialLinks"),
    { instagram, whatsapp, tiktok, telegram },
    { merge: true }
  );

  alert("Redes sociales guardadas.");
  await loadSocialLinksSidebar();
});

/***********************************************
 * ICONOS SOCIALES (SIDEBAR) — CLICK -> LINK
 ***********************************************/
async function loadSocialLinksSidebar() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;
    const data = snap.data();

    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      btn.onclick = null;

      let url = "";
      if (network === "instagram") url = data.instagram || "";
      if (network === "whatsapp") url = data.whatsapp || "";
      if (network === "tiktok") url = data.tiktok || "";
      if (network === "telegram") url = data.telegram || "";

      if (!url) return;

      btn.addEventListener("click", () => {
        window.open(url, "_blank", "noopener,noreferrer");
      });
    });
  } catch (err) {
    console.error("Error cargando redes sociales en sidebar:", err);
  }
}

/***********************************************
 * LANDING DEL LOGIN: TEXTO + BOTONES WHATSAPP
 ***********************************************/
async function applyLandingRedirects() {
  try {
    const snap = await getDoc(doc(db, "settings", "landingPage"));
    if (!snap.exists()) return;

    const data = snap.data();

    if (landingText) {
      landingText.textContent = data.heroText || "";
    }

    if (btnPriceMonth) {
      btnPriceMonth.textContent = data.priceMonth
        ? `Precio mensual: $${data.priceMonth} MXN`
        : "Precio mensual";
      btnPriceMonth.onclick = () => {
        if (!data.whatsappMonth) {
          alert("Configura el enlace de WhatsApp para mensual en el panel admin.");
          return;
        }
        window.open(data.whatsappMonth, "_blank");
      };
    }

    if (btnPriceFull) {
      btnPriceFull.textContent = data.priceFull
        ? `Acceso completo: $${data.priceFull} MXN`
        : "Acceso completo";
      btnPriceFull.onclick = () => {
        if (!data.whatsappFull) {
          alert("Configura el enlace de WhatsApp acceso completo en el panel admin.");
          return;
        }
        window.open(data.whatsappFull, "_blank");
      };
    }
  } catch (err) {
    console.error("Error aplicando landing redirects:", err);
  }
}

// Ejecutar al cargar
applyLandingRedirects();
