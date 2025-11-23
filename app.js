/*************************************************************
 *  app.js — Plataforma ENARM
 *  Versión estable y corregida 2025-11-23
 *************************************************************/

// =======================
// IMPORTS FIREBASE (v9+)
// =======================
import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ========================================
//   CONSTANTE: UID DEL ADMIN PRINCIPAL
// ========================================
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";


// ========================================
//   UTILIDADES
// ========================================
const $ = (id) => document.getElementById(id);
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }
function escapeHtml(s) { return String(s || "").replace(/</g, "&lt;"); }


// ========================================
//   ELEMENTOS DEL DOM
// ========================================
const appLayout          = document.querySelector(".app");

const loginScreen        = $("loginScreen");
const studentScreen      = $("studentScreen");
const examScreen         = $("examScreen");
const resultScreen       = $("resultScreen");

const adminSidebar       = $("adminSidebar");

const adminExamsScreen   = $("adminExamsScreen");
const adminSectionsScreen= $("adminSectionsScreen");
const adminUsersScreen   = $("adminUsersScreen");
const adminIconsScreen   = $("adminIconsScreen");

const sectionsList       = $("sectionsList");
const examsList          = $("examsList");

const adminExamsTab      = $("adminExamsTab");
const adminSectionsTab   = $("adminSectionsTab");
const adminUsersTab      = $("adminUsersTab");
const adminIconsTab      = $("adminIconsTab");
const adminLogout        = $("adminLogout");

const userInfo           = $("userInfo");
const authButtons        = $("authButtons");

// login
const inputEmail         = $("inputEmail");
const inputPassword      = $("inputPassword");
const btnLogin           = $("btnLogin");
const btnCancel          = $("btnCancel");
const loginMessage       = $("loginMessage");

// examen
const examForm           = $("examForm");
const examTitle          = $("examTitle");
const examTimer          = $("examTimer");
const btnFinishExam      = $("btnFinishExam");
const studentTitle       = $("studentTitle");

// íconos sociales
const igLink             = $("link-instagram");
const waLink             = $("link-whatsapp");
const tgLink             = $("link-telegram");
const ttLink             = $("link-tiktok");


// ========================================
//   ESTADO GLOBAL
// ========================================
let currentUser   = null;
let currentRole   = null;
let selectedSectionId = null;
let selectedExamId    = null;

let timerInterval = null;


// ========================================
//   LOGIN
// ========================================
if (btnLogin) {
  btnLogin.onclick = async () => {
    const email = inputEmail.value.trim();
    const pass  = inputPassword.value.trim();

    if (!email || !pass) {
      loginMessage.innerText = "Ingrese correo y contraseña";
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      loginMessage.innerText = "Accediendo...";
    } catch (e) {
      console.error("login error", e);
      loginMessage.innerText = "Credenciales incorrectas";
    }
  };
}

if (btnCancel) {
  btnCancel.onclick = () => {
    inputEmail.value = "";
    inputPassword.value = "";
    loginMessage.innerText = "";
  };
}


// ========================================
//   CERRAR SESIÓN
// ========================================
async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("logout error", e);
  }
}


// ========================================
//   OBSERVADOR AUTH
// ========================================
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  // Estado inicial si NO hay usuario
  if (!user) {
    currentRole = null;
    if (userInfo) userInfo.innerText = "";
    if (authButtons) authButtons.innerHTML = "";

    hide(adminSidebar);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    hide(adminExamsScreen);
    hide(adminSectionsScreen);
    hide(adminUsersScreen);
    hide(adminIconsScreen);

    // layout sin barra admin
    if (appLayout) appLayout.style.gridTemplateColumns = "260px 1fr";

    show(loginScreen);
    return;
  }

  try {
    // ==========================
    // 1) Obtener/crear doc de usuario
    // ==========================
    const uRef  = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);

    let data = null;

    if (!uSnap.exists()) {
      // si no existe, lo creamos como user normal
      data = {
        email: user.email || "",
        name: user.email ? user.email.split("@")[0] : "",
        role: user.uid === ADMIN_UID ? "admin" : "user",
        status: "enabled",
        createdAt: serverTimestamp(),
        expires: ""
      };
      await setDoc(uRef, data, { merge: true });
    } else {
      data = uSnap.data();
    }

    // ==========================
    // 2) Determinar rol y estado
    // ==========================
    let role   = data.role || "user";
    let status = data.status || "enabled";
    let expires = data.expires || "";

    // Forzar admin si UID coincide
    if (user.uid === ADMIN_UID) {
      role = "admin";
    }

    // Check expiración
    if (expires) {
      try {
        const now = new Date();
        const exp = new Date(expires);
        if (!isNaN(exp.getTime()) && now > exp) {
          await updateDoc(uRef, { status: "disabled" });
          alert("Tu acceso ha expirado.");
          await signOut(auth);
          return;
        }
      } catch (e) {
        console.warn("Error parseando fecha de expiración", e);
      }
    }

    // Check estado
    if (status === "disabled") {
      alert("Tu cuenta está inhabilitada.");
      await signOut(auth);
      return;
    }

    currentRole = role;

    // ==========================
    // 3) Config UI según rol
    // ==========================
    hide(loginScreen);

    if (userInfo) userInfo.innerText = `${user.email} (${currentRole})`;

    if (authButtons) {
      authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Cerrar sesión</button>`;
      const btnLogoutTop = $("btnLogoutTop");
      if (btnLogoutTop) btnLogoutTop.onclick = doLogout;
    }

    if (currentRole === "admin") {
      show(adminSidebar);
      if (appLayout) appLayout.style.gridTemplateColumns = "260px 1fr 320px";
    } else {
      hide(adminSidebar);
      if (appLayout) appLayout.style.gridTemplateColumns = "260px 1fr";
    }

    // cargar iconos + secciones
    await loadIcons();
    await loadSections();

  } catch (e) {
    console.error("onAuthStateChanged error", e);
    loginMessage.innerText = "Error al cargar tu perfil";
  }
});


// ========================================
//   CARGAR SECCIONES
// ========================================
async function loadSections() {
  if (!sectionsList) return;

  sectionsList.innerHTML = "Cargando...";

  try {
    const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
    const snap = await getDocs(qSec);

    sectionsList.innerHTML = "";

    if (snap.empty) {
      sectionsList.innerHTML = `<div class="small muted">Sin secciones</div>`;
      return;
    }

    snap.forEach((docu) => {
      const d = docu.data();
      const item = document.createElement("div");
      item.className = "section-item";
      item.innerText = d.name || "(sin nombre)";
      item.onclick = () => openSection(docu.id, d.name || "(sin nombre)");
      sectionsList.appendChild(item);
    });
  } catch (e) {
    console.error("loadSections", e);
    sectionsList.innerHTML = "<div>Error cargando secciones</div>";
  }
}


// ========================================
//   ABRIR SECCIÓN (estudiante/admin)
// ========================================
async function openSection(sectionId, name) {
  selectedSectionId = sectionId;

  hide(examScreen);
  hide(resultScreen);
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);

  show(studentScreen);
  if (studentTitle) studentTitle.innerText = name;

  await loadExams(sectionId);
}


// ========================================
//   CARGAR EXÁMENES
// ========================================
async function loadExams(sectionId) {
  if (!examsList) return;

  examsList.innerHTML = "Cargando exámenes...";

  try {
    const qEx = query(
      collection(db, "exams"),
      where("sectionId", "==", sectionId),
      orderBy("createdAt", "asc")
    );

    const snap = await getDocs(qEx);

    if (snap.empty) {
      examsList.innerHTML = "<div class='small muted'>Sin exámenes</div>";
      return;
    }

    examsList.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();
      const box = document.createElement("div");
      box.className = "examBox";

      box.innerHTML = `
        <div>
          <div class="title">${escapeHtml(d.title)}</div>
          <div class="meta">${escapeHtml(d.description || "")}</div>
        </div>
        <button data-id="${docu.id}" class="btn primary">Abrir</button>
      `;

      const btn = box.querySelector("button");
      if (btn) btn.onclick = () => openExam(docu.id);

      examsList.appendChild(box);
    });
  } catch (e) {
    console.error("loadExams", e);
    examsList.innerHTML = "<div>Error cargando exámenes</div>";
  }
}


// ========================================
//   ABRIR EXAMEN (modo estudiante)
// ========================================
async function openExam(examId) {
  selectedExamId = examId;

  hide(studentScreen);
  hide(resultScreen);

  if (examForm) examForm.innerHTML = "";
  if (examTitle) examTitle.innerText = "Cargando...";

  show(examScreen);

  await loadExamContent(examId);
}


// ========================================
//   CARGAR CONTENIDO DEL EXAMEN (preguntas)
// ========================================
async function loadExamContent(examId) {
  try {
    const examRef = doc(db, "exams", examId);
    const examSnap = await getDoc(examRef);
    if (!examSnap.exists()) {
      if (examTitle) examTitle.innerText = "Examen no encontrado";
      return;
    }

    const exam = examSnap.data();
    if (examTitle) examTitle.innerText = exam.title || "Examen";

    const casosQ = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId),
      orderBy("orden", "asc")
    );

    const casosSnap = await getDocs(casosQ);

    const form = examForm;
    if (!form) return;
    form.innerHTML = "";

    let totalPreguntas = 0;

    for (const casoDoc of casosSnap.docs) {
      const caso = casoDoc.data();

      const preguntasQ = query(
        collection(db, "preguntas"),
        where("casoId", "==", casoDoc.id),
        orderBy("orden", "asc")
      );

      const preguntasSnap = await getDocs(preguntasQ);

      const divCaso = document.createElement("div");
      divCaso.className = "questionBlock";
      divCaso.innerHTML = `
        <div class="questionTitle">${escapeHtml(caso.titulo)}</div>
        <div class="caseText">${escapeHtml(caso.texto)}</div>
      [];

      preguntasSnap.forEach((pDoc) => {
        const p = pDoc.data();
        totalPreguntas++;

        const block = document.createElement("div");
        block.innerHTML = `
          <div style="margin-top:10px; font-weight:700;">${escapeHtml(p.pregunta)}</div>
          <div class="options">
            ${ (p.opciones || []).map((op, idx) => `
              <label>
                <input type="radio" name="p_${pDoc.id}" value="${idx}" />
                <span>${escapeHtml(op)}</span>
              </label>
            `).join("") }
          </div>
        `;

        divCaso.appendChild(block);
      });

      form.appendChild(divCaso);
    }

    const totalSegundos = totalPreguntas * 75;
    if (totalSegundos > 0) {
      startTimer(totalSegundos);
    } else {
      if (examTimer) examTimer.innerText = "--:--";
    }

  } catch (e) {
    console.error("loadExamContent", e);
    if (examTitle) examTitle.innerText = "Error cargando examen";
  }
}


// ========================================
//   TIMER
// ========================================
function startTimer(seconds) {
  clearInterval(timerInterval);

  let t = seconds;
  const box = examTimer;

  if (!box) return;

  timerInterval = setInterval(() => {
    const min = Math.floor(t / 60);
    const sec = t % 60;
    box.innerText = `${min}:${sec.toString().padStart(2, "0")}`;

    if (t <= 0) {
      clearInterval(timerInterval);
      finishExam();
    }

    t--;
  }, 1000);
}


// ========================================
//   TERMINAR EXAMEN
// ========================================
if (btnFinishExam) {
  btnFinishExam.onclick = () => finishExam();
}

function finishExam() {
  clearInterval(timerInterval);

  hide(examScreen);
  show(resultScreen);

  if (resultScreen) resultScreen.innerText = "Examen finalizado. (Resultados en desarrollo)";
}


// ========================================
//   BOTONES DEL PANEL ADMIN (TABS)
// ========================================
function clearAdminScreens() {
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);

  if (adminExamsScreen)   adminExamsScreen.innerHTML = "";
  if (adminSectionsScreen)adminSectionsScreen.innerHTML = "";
  if (adminUsersScreen)   adminUsersScreen.innerHTML = "";
  if (adminIconsScreen)   adminIconsScreen.innerHTML = "";
}

if (adminExamsTab) {
  adminExamsTab.onclick = () => {
    if (currentRole !== "admin") return;
    clearAdminScreens();
    show(adminExamsScreen);
    adminLoadExamsPanel();
  };
}

if (adminSectionsTab) {
  adminSectionsTab.onclick = () => {
    if (currentRole !== "admin") return;
    clearAdminScreens();
    show(adminSectionsScreen);
    adminLoadSectionsPanel();
  };
}

if (adminUsersTab) {
  adminUsersTab.onclick = () => {
    if (currentRole !== "admin") return;
    clearAdminScreens();
    show(adminUsersScreen);
    adminLoadUsersPanel();
  };
}

if (adminIconsTab) {
  adminIconsTab.onclick = () => {
    if (currentRole !== "admin") return;
    clearAdminScreens();
    show(adminIconsScreen);
    adminLoadIconsPanel();
  };
}

if (adminLogout) {
  adminLogout.onclick = doLogout;
}


// ========================================
//   PANEL — ADMIN: SECCIONES
// ========================================
async function adminLoadSectionsPanel() {
  if (!adminSectionsScreen) return;

  adminSectionsScreen.innerHTML = `
    <h2>Secciones</h2>
    <button class="btn primary" id="addSectionBtn">Agregar sección</button>
    <div id="sectionsAdminList" style="margin-top:20px;">Cargando...</div>
  `;

  const list = $("sectionsAdminList");
  if (!list) return;

  const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(qSec);

  list.innerHTML = "";

  snap.forEach((docu) => {
    const d = docu.data();

    const row = document.createElement("div");
    row.className = "card";
    row.style.marginBottom = "8px";

    row.innerHTML = `
      <strong>${escapeHtml(d.name)}</strong>
      <div class="small muted">Orden: ${d.order}</div>
      <button class="btn" data-id="${docu.id}" data-edit="1">Editar</button>
      <button class="btn danger" data-id="${docu.id}" data-del="1">Eliminar</button>
    `;

    list.appendChild(row);
  });

  const addBtn = $("addSectionBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      const name = prompt("Nombre de la sección:");
      if (!name) return;

      const order = Number(prompt("Orden:"));
      await addDoc(collection(db, "sections"), {
        name,
        order,
        createdAt: serverTimestamp(),
      });

      adminLoadSectionsPanel();
    };
  }

  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "sections", id);
      const snap = await getDoc(ref);
      const data = snap.data();

      const name = prompt("Editar nombre:", data.name);
      if (!name) return;

      const order = Number(prompt("Editar orden:", data.order));

      await updateDoc(ref, { name, order });
      adminLoadSectionsPanel();
    };
  });

  list.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Eliminar sección?")) return;
      await deleteDoc(doc(db, "sections", btn.dataset.id));
      adminLoadSectionsPanel();
    };
  });
}


// ========================================
//   PANEL — ADMIN: EXÁMENES
// ========================================
async function adminLoadExamsPanel() {
  if (!adminExamsScreen) return;

  adminExamsScreen.innerHTML = `
    <h2>Exámenes</h2>
    <button class="btn primary" id="addExamBtn">Agregar examen</button>
    <div id="adminExamsList" style="margin-top:20px;">Cargando...</div>
  `;

  const container = $("adminExamsList");
  if (!container) return;

  const snap = await getDocs(collection(db, "exams"));
  container.innerHTML = "";

  snap.forEach((docu) => {
    const d = docu.data();

    const row = document.createElement("div");
    row.className = "card";
    row.style.marginBottom = "8px";

    row.innerHTML = `
      <strong>${escapeHtml(d.title)}</strong>
      <div class="small muted">Sección: ${escapeHtml(d.sectionId)}</div>
      <button class="btn" data-id="${docu.id}" data-edit="1">Editar</button>
      <button class="btn danger" data-id="${docu.id}" data-del="1">Eliminar</button>
    `;

    container.appendChild(row);
  });

  const addBtn = $("addExamBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      const sectionId = prompt("ID sección:");
      if (!sectionId) return;

      const title = prompt("Título:");
      if (!title) return;

      const desc = prompt("Descripción:");

      await addDoc(collection(db, "exams"), {
        sectionId,
        title,
        description: desc || "",
        createdAt: serverTimestamp(),
      });

      adminLoadExamsPanel();
    };
  }

  container.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "exams", id);
      const snap = await getDoc(ref);
      const ex = snap.data();

      const title = prompt("Editar título:", ex.title);
      if (!title) return;

      const desc = prompt("Editar descripción:", ex.description || "");

      await updateDoc(ref, { title, description: desc });
      adminLoadExamsPanel();
    };
  });

  container.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Eliminar examen?")) return;
      await deleteDoc(doc(db, "exams", btn.dataset.id));
      adminLoadExamsPanel();
    };
  });
}


// ========================================
//   PANEL — ADMIN: USUARIOS
//   (docId = UID de Firebase Auth)
// ========================================
async function adminLoadUsersPanel() {
  if (!adminUsersScreen) return;

  adminUsersScreen.innerHTML = `
    <h2>Usuarios</h2>
    <button class="btn primary" id="addUserBtn">Crear nuevo usuario (doc)</button>
    <div class="small muted">
      IMPORTANTE: El UID debe coincidir con el UID del usuario en Firebase Authentication.
    </div>
    <div id="usersAdminList" style="margin-top:20px;">Cargando...</div>
  `;

  const list = $("usersAdminList");
  if (!list) return;

  const snap = await getDocs(collection(db, "users"));
  list.innerHTML = "";

  snap.forEach((docu) => {
    const d = docu.data();
    const row = document.createElement("div");
    row.className = "card";
    row.style.marginBottom = "8px";

    row.innerHTML = `
      <strong>${escapeHtml(d.email || docu.id)}</strong>
      <div class="small muted">
        ${escapeHtml(d.name || "")} – Rol: ${escapeHtml(d.role || "user")} – Estado: ${escapeHtml(d.status || "enabled")}
      </div>
      <button class="btn" data-id="${docu.id}" data-edit="1">Editar</button>
      <button class="btn danger" data-id="${docu.id}" data-del="1">Eliminar</button>
    `;

    list.appendChild(row);
  });

  const addBtn = $("addUserBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      const uid   = prompt("UID de Firebase Auth:");
      if (!uid) return;

      const email = prompt("Correo:");
      const name  = prompt("Nombre:");
      const role  = prompt("Rol (admin/user):", "user");
      const status= prompt("Estado (enabled/disabled):", "enabled");
      const exp   = prompt("Fecha límite (YYYY-MM-DD) o vacío si no aplica:", "");

      const uRef = doc(db, "users", uid);
      await setDoc(uRef, {
        email: email || "",
        name : name  || "",
        role : role  || "user",
        status: status || "enabled",
        expires: exp || "",
        createdAt: serverTimestamp(),
      }, { merge: true });

      adminLoadUsersPanel();
    };
  }

  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "users", id);
      const snap = await getDoc(ref);
      const d = snap.data();

      const name = prompt("Nombre:", d.name || "");
      if (name === null) return;

      const role   = prompt("Rol (admin/user):", d.role || "user");
      const status = prompt("Estado (enabled/disabled):", d.status || "enabled");
      const exp    = prompt("Fecha límite (YYYY-MM-DD):", d.expires || "");

      await updateDoc(ref, {
        name,
        role: role || "user",
        status: status || "enabled",
        expires: exp || ""
      });

      adminLoadUsersPanel();
    };
  });

  list.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Eliminar usuario? (solo doc, no borra Auth)")) return;
      await deleteDoc(doc(db, "users", btn.dataset.id));
      adminLoadUsersPanel();
    };
  });
}


// ========================================
//   PANEL — ADMIN: ÍCONOS
// ========================================
async function loadIcons() {
  try {
    const ref  = doc(db, "config", "icons");
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const d = snap.data();

    if (igLink) igLink.href = d.instagram || "#";
    if (waLink) waLink.href = d.whatsapp  || "#";
    if (tgLink) tgLink.href = d.telegram  || "#";
    if (ttLink) ttLink.href = d.tiktok    || "#";

  } catch (e) {
    console.error("loadIcons", e);
  }
}

async function adminLoadIconsPanel() {
  if (!adminIconsScreen) return;

  adminIconsScreen.innerHTML = `
    <h2>Íconos Sociales</h2>

    <label>Instagram</label>
    <input id="ic_instagram" />

    <label>WhatsApp</label>
    <input id="ic_whatsapp" />

    <label>Telegram</label>
    <input id="ic_telegram" />

    <label>TikTok</label>
    <input id="ic_tiktok" />

    <button class="btn primary" id="saveIconsBtn" style="margin-top:12px;">
      Guardar
    </button>
  `;

  const ref  = doc(db, "config", "icons");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const d = snap.data();
    $("ic_instagram").value = d.instagram || "";
    $("ic_whatsapp").value  = d.whatsapp  || "";
    $("ic_telegram").value  = d.telegram  || "";
    $("ic_tiktok").value    = d.tiktok    || "";
  }

  const btn = $("saveIconsBtn");
  if (btn) {
    btn.onclick = async () => {
      await setDoc(ref, {
        instagram: $("ic_instagram").value.trim(),
        whatsapp : $("ic_whatsapp").value.trim(),
        telegram : $("ic_telegram").value.trim(),
        tiktok   : $("ic_tiktok").value.trim(),
      }, { merge: true });

      alert("Íconos actualizados");
      await loadIcons();
    };
  }
}


// ========================================
//   INICIO
// ========================================
async function init() {
  hide(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);
  hide(adminSidebar);

  if (appLayout) appLayout.style.gridTemplateColumns = "260px 1fr";
}

init();
