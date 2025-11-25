/******************************************************
 * FIREBASE CONFIG (MODULAR v11)
 ******************************************************/
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
  getDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

/******************************************************
 * DOM REFERENCES
 ******************************************************/

// Views
const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");

// Login
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

// Header
const currentUserEmail = document.getElementById("current-user-email");
const btnLogout = document.getElementById("btn-logout");

// Sidebar admin
const sidebarSections = document.getElementById("sidebar-sections");
const btnNewSection = document.getElementById("btn-new-section");
const btnUsersView = document.getElementById("btn-users-view");
const btnEditSocial = document.getElementById("btn-edit-social");
const btnLandingView = document.getElementById("btn-landing-view");

// Landing (login public info)
const landingText = document.getElementById("landing-text");
const btnPriceMonth = document.getElementById("btn-price-month");
const btnPriceFull = document.getElementById("btn-price-full");

// Admin panels
const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examsList = document.getElementById("exams-list");
const btnNewExam = document.getElementById("btn-new-exam");
const landingSettingsView = document.getElementById("landing-settings-view");
const socialSettingsView = document.getElementById("social-settings-view");

// Exam editor
const examDetailView = document.getElementById("exam-detail-view");
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question");
const questionsList = document.getElementById("questions-list");

// Users
const usersList = document.getElementById("users-list");
const btnCreateUser = document.getElementById("btn-create-user");

// Landing admin inputs
const landingHeroText = document.getElementById("landing-hero-text");
const landingPriceMonth = document.getElementById("landing-price-month");
const landingPriceFull = document.getElementById("landing-price-full");
const landingWhatsappMonth = document.getElementById("landing-whatsapp-month");
const landingWhatsappFull = document.getElementById("landing-whatsapp-full");
const btnSaveLanding = document.getElementById("btn-save-landing");

// Social admin inputs
const adminInsta = document.getElementById("admin-instagram");
const adminWhats = document.getElementById("admin-whatsapp");
const adminTik = document.getElementById("admin-tiktok");
const adminTele = document.getElementById("admin-telegram");
const btnSaveSocial = document.getElementById("btn-save-social");

// State
let currentAdmin = null;
let currentSectionId = null;
let editingExamId = null;

/******************************************************
 * VIEW SWITCHER
 ******************************************************/
function showView(view) {
  loginView.classList.add("hidden");
  adminView.classList.add("hidden");
  sectionsView.classList.add("hidden");
  usersView.classList.add("hidden");
  examDetailView.classList.add("hidden");
  landingSettingsView.classList.add("hidden");
  socialSettingsView.classList.add("hidden");

  view.classList.remove("hidden");
}
/******************************************************
 * LOGIN
 ******************************************************/
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
    }
  });
}

/******************************************************
 * AUTH + ROLE VALIDATION
 ******************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showView(loginView);
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.email));

  if (!userSnap.exists()) {
    alert("Tu cuenta no existe en el sistema.");
    await signOut(auth);
    return;
  }

  const data = userSnap.data();

  if (data.role !== "admin") {
    // NO permitir entrar al panel admin
    alert("Solo administradores pueden acceder al panel.");
    await signOut(auth);
    return;
  }

  // Bienvenido admin
  currentAdmin = user.email;
  currentUserEmail.textContent = user.email;

  await applyLandingPublicInfo(); // Para login
  await loadSidebarSections();
  showView(sectionsView);
});

/******************************************************
 * LOAD SIDEBAR SECTIONS
 ******************************************************/
async function loadSidebarSections() {
  sidebarSections.innerHTML = "";

  const snap = await getDocs(collection(db, "sections"));

  if (snap.empty) {
    sidebarSections.innerHTML = `<li style="color:#aaa; padding:6px;">No hay secciones.</li>`;
    return;
  }

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.dataset.id = docSnap.id;

    li.innerHTML = `
      <span>${d.name}</span>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-sec-btn" data-id="${docSnap.id}">✏️</button>
        <button class="icon-btn del-sec-btn" data-id="${docSnap.id}">🗑️</button>
      </div>
    `;

    li.addEventListener("click", (e) => {
      if (e.target.closest(".icon-btn")) return;
      openSection(docSnap.id, d.name);
    });

    sidebarSections.appendChild(li);
  });

  enableSectionActions();
}

/******************************************************
 * EDIT / DELETE SECTION
 ******************************************************/
function enableSectionActions() {
  document.querySelectorAll(".edit-sec-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const newName = prompt("Nuevo nombre:");

      if (!newName) return;

      await updateDoc(doc(db, "sections", id), { name: newName.trim() });
      loadSidebarSections();
    };
  });

  document.querySelectorAll(".del-sec-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;

      if (!confirm("¿Eliminar sección?")) return;

      await deleteDoc(doc(db, "sections", id));
      loadSidebarSections();
    };
  });
}

/******************************************************
 * OPEN SECTION
 ******************************************************/
async function openSection(sectionId, sectionName) {
  currentSectionId = sectionId;

  document.getElementById("current-section-title").textContent = sectionName;
  document.getElementById("current-section-subtitle").textContent =
    "Simulacros dentro de esta sección.";

  btnNewExam.classList.remove("hidden");

  await loadExams();
  showView(sectionsView);
}

/******************************************************
 * LOAD EXAMS
 ******************************************************/
async function loadExams() {
  examsList.innerHTML = "";

  const qx = query(
    collection(db, "exams"),
    where("sectionId", "==", currentSectionId)
  );

  const snap = await getDocs(qx);

  if (snap.empty) {
    examsList.innerHTML = `
      <div class="card"><p>No hay exámenes.</p></div>
    `;
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

/******************************************************
 * EXAM BUTTON EVENTS
 ******************************************************/
function enableExamButtons() {
  document.querySelectorAll(".edit-exam-btn").forEach((btn) => {
    btn.onclick = () => openExamEditor(btn.dataset.id);
  });

  document.querySelectorAll(".delete-exam-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar examen?")) return;

      await deleteDoc(doc(db, "exams", btn.dataset.id));
      loadExams();
    };
  });
}

/******************************************************
 * CREATE NEW EXAM
 ******************************************************/
btnNewExam.onclick = async () => {
  const name = prompt("Nombre del examen:");
  if (!name) return;

  await addDoc(collection(db, "exams"), {
    name: name.trim(),
    sectionId: currentSectionId,
    createdAt: serverTimestamp(),
  });

  loadExams();
};
/***********************************************
 * PANEL PANTALLA PRINCIPAL (LANDING SETTINGS)
 ***********************************************/
btnLandingView?.addEventListener("click", async () => {
  showView(landingSettingsView);
  await loadLandingSettings();
});

/***********************************************
 * CARGAR VALORES DE LA PANTALLA PRINCIPAL
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
      whatsappFull: "",
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
 * GUARDAR CONFIGURACIÓN DE PANTALLA PRINCIPAL
 ***********************************************/
document.getElementById("btn-save-landing")?.addEventListener("click", async () => {
  const hero = document.getElementById("landing-hero-text").value.trim();
  const priceMonth = document.getElementById("landing-price-month").value.trim();
  const priceFull = document.getElementById("landing-price-full").value.trim();
  const waMonth = document.getElementById("landing-whatsapp-month").value.trim();
  const waFull = document.getElementById("landing-whatsapp-full").value.trim();

  await setDoc(
    doc(db, "settings", "landingPage"),
    {
      heroText: hero,
      priceMonth,
      priceFull,
      whatsappMonth: waMonth,
      whatsappFull: waFull,
    },
    { merge: true }
  );

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
  const insta = document.getElementById("admin-instagram").value.trim();
  const wa = document.getElementById("admin-whatsapp").value.trim();
  const tiktok = document.getElementById("admin-tiktok").value.trim();
  const tele = document.getElementById("admin-telegram").value.trim();

  await setDoc(
    doc(db, "settings", "socialLinks"),
    {
      instagram: insta,
      whatsapp: wa,
      tiktok: tiktok,
      telegram: tele,
    },
    { merge: true }
  );

  alert("Redes sociales guardadas.");
});

/***********************************************
 * LOGIN — APLICAR PRECIOS Y REDIRECCIONES
 ***********************************************/
async function applyLandingRedirects() {
  const snap = await getDoc(doc(db, "settings", "landingPage"));
  if (!snap.exists()) return;

  const data = snap.data();

  const btnMonth = document.getElementById("btn-price-month");
  const btnFull = document.getElementById("btn-price-full");
  const landingText = document.getElementById("landing-text");

  // texto principal del recuadro informativo
  landingText.textContent = data.heroText || "";

  // precios visibles en botones
  btnMonth.textContent = data.priceMonth
    ? `$${data.priceMonth} MXN`
    : "Precio mensual";

  btnFull.textContent = data.priceFull
    ? `$${data.priceFull} MXN`
    : "Acceso completo";

  // redirecciones a WhatsApp configuradas por admin
  btnMonth.onclick = () => {
    if (!data.whatsappMonth)
      return alert("Falta el enlace de WhatsApp mensual.");
    window.open(data.whatsappMonth, "_blank");
  };

  btnFull.onclick = () => {
    if (!data.whatsappFull)
      return alert("Falta el enlace de WhatsApp acceso completo.");
    window.open(data.whatsappFull, "_blank");
  };
}

applyLandingRedirects();
/***********************************************
 * REDES SOCIALES — APLICAR EN LOGIN Y ADMIN
 ***********************************************/
async function applySocialLinks() {
  const snap = await getDoc(doc(db, "settings", "socialLinks"));
  if (!snap.exists()) return;

  const data = snap.data();

  const icons = document.querySelectorAll(".social-icon");

  icons.forEach((icon) => {
    const net = icon.dataset.network;

    let url = "";
    if (net === "instagram") url = data.instagram;
    if (net === "whatsapp") url = data.whatsapp;
    if (net === "tiktok") url = data.tiktok;
    if (net === "telegram") url = data.telegram;

    icon.onclick = () => {
      if (!url) return alert("Esta red social no está configurada.");
      window.open(url, "_blank");
    };
  });
}

applySocialLinks();

/***********************************************
 * SIDEBAR — ABRIR / CERRAR
 ***********************************************/
const toggleSidebar = document.getElementById("btn-toggle-sidebar");

toggleSidebar?.addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("sidebar--open");
});

/***********************************************
 * BOTÓN VOLVER DEL EDITOR DE EXAMEN
 ***********************************************/
document.getElementById("btn-back-to-exams")?.addEventListener("click", () => {
  showView(sectionsView);
});

/***********************************************
 * CERRAR SESIÓN
 ***********************************************/
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  showView(loginView);
});

/***********************************************
 * EVITAR ERRORES DE REFERENCIAS NULAS
 ***********************************************/
function nullSafe(id) {
  return document.getElementById(id) || null;
}

/***********************************************
 * ÚLTIMA LIMPIEZA DE VISTAS
 ***********************************************/
function resetViews() {
  sectionsView?.classList.add("hidden");
  usersView?.classList.add("hidden");
  socialSettingsView?.classList.add("hidden");
  landingSettingsView?.classList.add("hidden");
  examDetailView?.classList.add("hidden");
  loginView?.classList.add("hidden");
}

/***********************************************
 * INICIALIZACIÓN FINAL
 ***********************************************/
(async function initializeSystem() {
  await applyLandingRedirects();
  await applySocialLinks();
})();
