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

// ----------------------------------------------------
// CONFIGURACIÓN FIREBASE
// ----------------------------------------------------
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

// Vistas principales
const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");

// Paneles internos
const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examDetailView = document.getElementById("exam-detail-view");
const landingSettingsView = document.getElementById("landing-settings-view");
const socialSettingsView = document.getElementById("social-settings-view");

// Header
const currentUserEmail = document.getElementById("current-user-email");
const btnLogout = document.getElementById("btn-logout");

// Sidebar botones principales
const btnUsersView = document.getElementById("btn-users-view");
const btnNewSection = document.getElementById("btn-new-section");
const btnEditSocial = document.getElementById("btn-edit-social");
const btnLandingView = document.getElementById("btn-landing-view");

// Sidebar contenedor de secciones
const sidebarSections = document.getElementById("sidebar-sections");

// Vista secciones / exámenes
const examsList = document.getElementById("exams-list");
const btnNewExam = document.getElementById("btn-new-exam");
const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");

// Vista usuarios
const usersList = document.getElementById("users-list");
const btnCreateUser = document.getElementById("btn-create-user");

// Login
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

// Estado
let currentAdmin = null;
let currentSectionId = null;
let currentExamId = null;

/***********************************************
 * UTILIDAD: MOSTRAR / OCULTAR VISTAS
 ***********************************************/
function hideAllViews() {
  loginView.classList.add("hidden");
  adminView.classList.add("hidden");

  sectionsView.classList.add("hidden");
  usersView.classList.add("hidden");
  examDetailView.classList.add("hidden");
  landingSettingsView.classList.add("hidden");
  socialSettingsView.classList.add("hidden");
}

function showAdminView() {
  loginView.classList.add("hidden");
  adminView.classList.remove("hidden");
}

function showPanel(panel) {
  sectionsView.classList.add("hidden");
  usersView.classList.add("hidden");
  examDetailView.classList.add("hidden");
  landingSettingsView.classList.add("hidden");
  socialSettingsView.classList.add("hidden");

  panel.classList.remove("hidden");
}

/***********************************************
 * LOGIN
 ***********************************************/
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginError.classList.add("hidden");
    } catch (err) {
      loginError.textContent = "Correo o contraseña incorrectos.";
      loginError.classList.remove("hidden");
      return;
    }
  });
}

/***********************************************
 * AUTENTICACIÓN Y ROLES
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    hideAllViews();
    loginView.classList.remove("hidden");
    return;
  }

  // Obtener documento del usuario
  const userSnap = await getDoc(doc(db, "users", user.email));

  if (!userSnap.exists()) {
    alert("Tu cuenta no tiene permisos.");
    await signOut(auth);
    return;
  }

  const data = userSnap.data();

  if (data.role !== "admin") {
    alert("Solo administradores pueden ingresar.");
    await signOut(auth);
    return;
  }

  currentAdmin = user.email;
  currentUserEmail.textContent = user.email;

  showAdminView();
  showPanel(sectionsView);

  await loadSidebarSections();
  await applyLandingRedirects();
});
/***********************************************
 * ABRIR UNA SECCIÓN
 ***********************************************/
async function openSection(sectionId, name) {
  currentSectionId = sectionId;

  currentSectionTitle.textContent = name;
  currentSectionSubtitle.textContent = "Simulacros dentro de esta sección.";

  showView(sectionsView);

  btnNewExam.classList.remove("hidden");

  await loadExams(sectionId);
}

/***********************************************
 * CARGAR EXÁMENES
 ***********************************************/
async function loadExams(sectionId) {
  examsList.innerHTML = "";

  const q = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(q);

  if (snap.empty) {
    examsList.innerHTML = `
      <div class="card">
        <p style="font-size:14px;color:#777;">No hay exámenes en esta sección.</p>
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const ex = docSnap.data();
    const card = document.createElement("div");

    card.className = "card-item";
    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${ex.name}</div>
      </div>

      <div class="flex-row" style="margin-top:12px;">
        <button class="btn btn-secondary edit-exam-btn" data-id="${docSnap.id}">Editar</button>
        <button class="btn btn-outline delete-exam-btn" data-id="${docSnap.id}">Eliminar</button>
      </div>
    `;

    examsList.appendChild(card);
  });

  enableExamButtons();
}

/***********************************************
 * BOTONES DINÁMICOS: EDITAR / ELIMINAR EXAMEN
 ***********************************************/
function enableExamButtons() {
  const editButtons = document.querySelectorAll(".edit-exam-btn");
  const deleteButtons = document.querySelectorAll(".delete-exam-btn");

  // EDITAR
  editButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      openExamEditor(btn.dataset.id);
    });
  });

  // ELIMINAR
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este examen?")) return;

      await deleteDoc(doc(db, "exams", btn.dataset.id));
      await loadExams(currentSectionId);
    });
  });
}

/***********************************************
 * CREAR NUEVO EXAMEN
 ***********************************************/
btnNewExam?.addEventListener("click", async () => {
  const name = prompt("Nombre del nuevo examen:");

  if (!name || !currentSectionId) return;

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
  const examSnap = await getDoc(doc(db, "exams", examId));

  if (!examSnap.exists()) {
    alert("El examen no existe.");
    return;
  }

  const exam = examSnap.data();
  window.currentExamId = examId;

  showView(examDetailView);

  document.getElementById("exam-name-input").value = exam.name || "";

  // GUARDAR NOMBRE
  document.getElementById("btn-save-exam-meta").onclick = async () => {
    const newName = document.getElementById("exam-name-input").value.trim();

    if (!newName) return;

    await updateDoc(doc(db, "exams", examId), { name: newName });
    alert("Nombre actualizado.");
    loadExams(currentSectionId);
  };

  // NUEVA PREGUNTA
  document.getElementById("btn-new-question").onclick = () => {
    openQuestionCreator(examId);
  };

  // Cargar preguntas
  loadExamQuestions(examId);
}

/***********************************************
 * CARGAR PREGUNTAS DEL EXAMEN
 ***********************************************/
async function loadExamQuestions(examId) {
  const list = document.getElementById("questions-list");
  list.innerHTML = "";

  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.innerHTML = `
      <div class="card">
        Todavía no hay preguntas cargadas.
      </div>`;
    return;
  }

  snap.forEach((docSnap) => {
    const q = docSnap.data();

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <p style="font-weight:600;margin-bottom:8px;">${q.questionText}</p>

      <div class="flex-row">
        <button class="btn btn-secondary edit-q-btn" data-id="${docSnap.id}">Editar</button>
        <button class="btn btn-outline delete-q-btn" data-id="${docSnap.id}">Eliminar</button>
      </div>
    `;

    list.appendChild(div);
  });

  enableQuestionButtons();
}

/***********************************************
 * BOTONES EDITAR / ELIMINAR PREGUNTAS
 ***********************************************/
function enableQuestionButtons() {
  const editBtns = document.querySelectorAll(".edit-q-btn");
  const delBtns = document.querySelectorAll(".delete-q-btn");

  editBtns.forEach((btn) => {
    btn.onclick = () => openQuestionEditor(btn.dataset.id);
  });

  delBtns.forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar esta pregunta?")) return;

      await deleteDoc(doc(db, "questions", btn.dataset.id));
      loadExamQuestions(currentExamId);
    };
  });
}

/***********************************************
 * PANEL DE USUARIOS
 ***********************************************/
btnUsersView?.addEventListener("click", async () => {
  showView(usersView);
  await loadUsers();
});

/***********************************************
 * CARGAR USUARIOS
 ***********************************************/
async function loadUsers() {
  usersList.innerHTML = "";

  const snap = await getDocs(collection(db, "users"));

  snap.forEach((docSnap) => {
    const u = docSnap.data();

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <p><strong>${u.name || "(Sin nombre)"}</strong></p>
      <p>${docSnap.id}</p>
      <p class="panel-subtitle">Rol: ${u.role}</p>

      <div class="flex-row">
        <button class="btn btn-secondary" onclick="editUser('${docSnap.id}')">Editar</button>
        <button class="btn btn-outline" onclick="deleteUser('${docSnap.id}')">Eliminar</button>
      </div>
    `;

    usersList.appendChild(div);
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
    name,
    email,
    password,
    status,
    role,
    expiryDate: expiry
  });

  alert("Usuario creado.");
  loadUsers();
});

/***********************************************
 * EDITAR Y ELIMINAR USUARIO
 ***********************************************/
window.editUser = async function (email) {
  const snap = await getDoc(doc(db, "users", email));
  if (!snap.exists()) return alert("Usuario no encontrado.");

  const u = snap.data();

  const newName = prompt("Nombre:", u.name || "");
  const newPass = prompt("Contraseña:", u.password || "");
  const newStatus = prompt("Estado (activo/inactivo):", u.status || "activo");
  const newRole = prompt("Rol (admin/usuario):", u.role || "usuario");
  const newExpiry = prompt("Fecha límite (YYYY-MM-DD):", u.expiryDate || "");

  await updateDoc(doc(db, "users", email), {
    name: newName,
    password: newPass,
    status: newStatus,
    role: newRole,
    expiryDate: newExpiry
  });

  alert("Usuario actualizado.");
  loadUsers();
};

window.deleteUser = async function (email) {
  if (!confirm("¿Eliminar este usuario?")) return;
  await deleteDoc(doc(db, "users", email));
  loadUsers();
};

/***********************************************
 * PANEL PANTALLA PRINCIPAL
 ***********************************************/
btnLandingView?.addEventListener("click", async () => {
  showView(landingSettingsView);
  await loadLandingSettings();
});

/***********************************************
 * CARGAR CONFIGURACIÓN DE LANDING
 ***********************************************/
async function loadLandingSettings() {
  const docRef = doc(db, "settings", "landingPage");
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    await setDoc(docRef, {
      heroText: "",
      priceMonth: "",
      priceFull: "",
      whatsappMonth: "",
      whatsappFull: ""
    });
  }

  const data = snap.data() || {};

  document.getElementById("landing-hero-text").value = data.heroText || "";
  document.getElementById("landing-price-month").value = data.priceMonth || "";
  document.getElementById("landing-price-full").value = data.priceFull || "";
  document.getElementById("landing-whatsapp-month").value = data.whatsappMonth || "";
  document.getElementById("landing-whatsapp-full").value = data.whatsappFull || "";
}

/***********************************************
 * GUARDAR CONFIGURACIÓN DE LANDING
 ***********************************************/
document.getElementById("btn-save-landing")?.addEventListener("click", async () => {
  const hero = document.getElementById("landing-hero-text").value.trim();
  const priceMonth = document.getElementById("landing-price-month").value.trim();
  const priceFull = document.getElementById("landing-price-full").value.trim();
  const waMonth = document.getElementById("landing-whatsapp-month").value.trim();
  const waFull = document.getElementById("landing-whatsapp-full").value.trim();

  await setDoc(doc(db, "settings", "landingPage"), {
    heroText: hero,
    priceMonth,
    priceFull,
    whatsappMonth: waMonth,
    whatsappFull: waFull
  }, { merge: true });

  alert("Pantalla principal guardada.");
});

/***********************************************
 * PANEL REDES SOCIALES
 ***********************************************/
btnEditSocial?.addEventListener("click", async () => {
  showView(socialSettingsView);
  await loadSocialPanel();
});

/***********************************************
 * CARGAR REDES SOCIALES
 ***********************************************/
async function loadSocialPanel() {
  const snap = await getDoc(doc(db, "settings", "socialLinks"));

  const insta = document.getElementById("admin-instagram");
  const wa = document.getElementById("admin-whatsapp");
  const tiktok = document.getElementById("admin-tiktok");
  const tele = document.getElementById("admin-telegram");

  if (!snap.exists()) {
    insta.value = "";
    wa.value = "";
    tiktok.value = "";
    tele.value = "";
    return;
  }

  const data = snap.data();
  insta.value = data.instagram || "";
  wa.value = data.whatsapp || "";
  tiktok.value = data.tiktok || "";
  tele.value = data.telegram || "";
}

/***********************************************
 * GUARDAR REDES SOCIALES
 ***********************************************/
document.getElementById("btn-save-social")?.addEventListener("click", async () => {
  await setDoc(doc(db, "settings", "socialLinks"), {
    instagram: document.getElementById("admin-instagram").value.trim(),
    whatsapp: document.getElementById("admin-whatsapp").value.trim(),
    tiktok: document.getElementById("admin-tiktok").value.trim(),
    telegram: document.getElementById("admin-telegram").value.trim()
  }, { merge: true });

  alert("Redes sociales guardadas.");
});

/***********************************************
 * APLICAR REDIRECCIONES EN LOGIN
 ***********************************************/
async function applyLandingRedirects() {
  const snap = await getDoc(doc(db, "settings", "landingPage"));
  if (!snap.exists()) return;

  const data = snap.data();

  const btnMonth = document.getElementById("btn-price-month");
  const btnFull = document.getElementById("btn-price-full");
  const landingText = document.getElementById("landing-text");

  landingText.textContent = data.heroText || "";

  btnMonth.textContent = data.priceMonth ? `$${data.priceMonth} MXN` : "Precio mensual";
  btnFull.textContent = data.priceFull ? `$${data.priceFull} MXN` : "Acceso completo";

  btnMonth.onclick = () => {
    if (!data.whatsappMonth) return alert("Configura el WhatsApp mensual.");
    window.open(data.whatsappMonth, "_blank");
  };

  btnFull.onclick = () => {
    if (!data.whatsappFull) return alert("Configura el WhatsApp completo.");
    window.open(data.whatsappFull, "_blank");
  };
}

applyLandingRedirects();

/***********************************************
 * LOGOUT
 ***********************************************/
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  showView(loginView);
});
