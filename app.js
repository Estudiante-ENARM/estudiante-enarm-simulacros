/*************************************************************
 *  app.js — Plataforma ENARM
 *  Versión estable y corregida 2025-11-23 (layout y auth)
 *************************************************************/

// =======================
// IMPORTS FIREBASE (v9)
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
//   UTILIDADES
// ========================================
const $ = (id) => document.getElementById(id);
function show(el) {
  if (!el) return;
  el.classList.remove("hidden");
}
function hide(el) {
  if (!el) return;
  el.classList.add("hidden");
}
function escape(s) {
  return String(s || "").replace(/</g, "&lt;");
}

// Layout raíz
const appRoot = document.querySelector(".app");
const APP_LAYOUT_DEFAULT = "260px 1fr 320px"; // admin
const APP_LAYOUT_NO_ADMIN = "260px 1fr";      // estudiante

// ========================================
//   ELEMENTOS DEL DOM
// ========================================
const loginScreen = $("loginScreen");
const studentScreen = $("studentScreen");
const examScreen = $("examScreen");
const resultScreen = $("resultScreen");

const adminSidebar = $("adminSidebar");

const adminExamsScreen = $("adminExamsScreen");
const adminSectionsScreen = $("adminSectionsScreen");
const adminUsersScreen = $("adminUsersScreen");
const adminIconsScreen = $("adminIconsScreen");

const sectionsList = $("sectionsList");
const examsList = $("examsList");

const adminExamsTab = $("adminExamsTab");
const adminSectionsTab = $("adminSectionsTab");
const adminUsersTab = $("adminUsersTab");
const adminIconsTab = $("adminIconsTab");
const adminLogout = $("adminLogout");

const userInfo = $("userInfo");
const authButtons = $("authButtons");

// examen
const examForm = $("examForm");
const examTitle = $("examTitle");
const examTimer = $("examTimer");

// íconos sociales
const igLink = $("link-instagram");
const waLink = $("link-whatsapp");
const tgLink = $("link-telegram");
const ttLink = $("link-tiktok");

// login inputs
const btnLogin = $("btnLogin");
const btnCancel = $("btnCancel");
const inputEmail = $("inputEmail");
const inputPassword = $("inputPassword");
const loginMessage = $("loginMessage");

// ========================================
//   ESTADO GLOBAL
// ========================================
let currentUser = null;
let currentRole = null; // "admin" | "user"
let selectedSectionId = null;
let selectedExamId = null;

// ========================================
//   LOGIN
// ========================================
if (btnLogin) {
  btnLogin.onclick = async () => {
    const email = (inputEmail?.value || "").trim();
    const pass = (inputPassword?.value || "").trim();

    if (!email || !pass) {
      if (loginMessage) loginMessage.innerText = "Ingrese correo y contraseña";
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      if (loginMessage) loginMessage.innerText = "Accediendo...";
    } catch (e) {
      console.error(e);
      if (loginMessage) loginMessage.innerText = "Credenciales incorrectas";
    }
  };
}

if (btnCancel) {
  btnCancel.onclick = () => {
    if (inputEmail) inputEmail.value = "";
    if (inputPassword) inputPassword.value = "";
    if (loginMessage) loginMessage.innerText = "";
  };
}

// ========================================
//   CERRAR SESIÓN
// ========================================
async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("signOut error", e);
  }
}

// ========================================
//   OBSERVADOR AUTH (re-escrito con try/catch)
// ========================================
onAuthStateChanged(auth, (user) => {
  handleAuthChange(user).catch((e) => {
    console.error("handleAuthChange error", e);
  });
});

async function handleAuthChange(user) {
  currentUser = user;

  // Estado base UI
  if (!user) {
    currentRole = null;
    if (userInfo) userInfo.innerText = "";
    hide(adminSidebar);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    hide(adminExamsScreen);
    hide(adminSectionsScreen);
    hide(adminUsersScreen);
    hide(adminIconsScreen);
    show(loginScreen);

    if (appRoot) {
      appRoot.style.gridTemplateColumns = APP_LAYOUT_DEFAULT;
    }
    return;
  }

  // Intentar leer rol en /users/{uid}, pero si falla no bloquea al usuario
  try {
    const uRef = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);

    if (uSnap.exists()) {
      const d = uSnap.data();
      currentRole = d.role || "user";
    } else {
      currentRole = "user";
    }
  } catch (e) {
    console.warn("Error leyendo rol en users:", e);
    currentRole = "user";
  }

  if (userInfo) {
    userInfo.innerText = `${user.email} (${currentRole})`;
  }

  hide(loginScreen);

  // Layout según rol
  if (currentRole === "admin") {
    show(adminSidebar);
    if (appRoot) {
      appRoot.style.gridTemplateColumns = APP_LAYOUT_DEFAULT;
    }
  } else {
    hide(adminSidebar);
    if (appRoot) {
      appRoot.style.gridTemplateColumns = APP_LAYOUT_NO_ADMIN;
    }
  }

  // Estas lecturas no deben romper la app si hay error de permisos
  try {
    await loadIcons();
  } catch (e) {
    console.warn("Error loadIcons:", e);
  }

  try {
    await loadSections();
  } catch (e) {
    console.warn("Error loadSections (global):", e);
  }
}

// ========================================
//   CARGAR SECCIONES
// ========================================
async function loadSections() {
  if (!sectionsList) return;
  sectionsList.innerHTML = "Cargando...";

  try {
    const qSections = query(
      collection(db, "sections"),
      orderBy("order", "asc")
    );
    const snap = await getDocs(qSections);

    sectionsList.innerHTML = "";

    if (snap.empty) {
      sectionsList.innerHTML =
        "<div class='small muted'>Sin secciones registradas</div>";
      return;
    }

    snap.forEach((docu) => {
      const d = docu.data();
      const item = document.createElement("div");
      item.className = "section-item";
      item.innerText = d.name;
      item.onclick = () => openSection(docu.id, d.name);
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
  const titleEl = $("studentTitle");
  if (titleEl) titleEl.innerText = name;

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
      examsList.innerHTML =
        "<div class='small muted'>Sin exámenes en esta sección</div>";
      return;
    }

    examsList.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();
      const box = document.createElement("div");
      box.className = "examBox";

      box.innerHTML = `
        <div>
          <div class="title">${escape(d.title)}</div>
          <div class="meta">${escape(d.description || "")}</div>
        </div>
        <button data-id="${docu.id}" class="btn primary">Abrir</button>
      `;

      const btn = box.querySelector("button");
      if (btn) {
        btn.onclick = () => openExam(docu.id);
      }

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
    if (examTitle) examTitle.innerText = exam.title;

    const casosQ = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId),
      orderBy("orden", "asc")
    );

    const casosSnap = await getDocs(casosQ);

    if (!examForm) return;
    examForm.innerHTML = "";

    let totalPreguntas = 0;

    for (const casoDoc of casosSnap.docs) {
      const caso = casoDoc.data();

      const preguntasQ = query(
        collection(db, "preguntas"),
        where("casoId", "==", casoDoc.id),
        orderBy("orden", "asc")
      );

      const preguntasSnap = await getDocs(preguntasQ);

      // Bloque del caso clínico
      const divCaso = document.createElement("div");
      divCaso.className = "questionBlock";
      divCaso.innerHTML = `
        <div class="questionTitle">${escape(caso.titulo)}</div>
        <div class="caseText">${escape(caso.texto)}</div>
      ";

      preguntasSnap.forEach((pDoc) => {
        const p = pDoc.data();
        totalPreguntas++;

        const block = document.createElement("div");
        block.innerHTML = `
          <div style="margin-top:10px; font-weight:700;">${escape(
            p.pregunta
          )}</div>
          <div class="options">
            ${p.opciones
              .map(
                (op, idx) => `
              <label>
                <input type="radio" name="p_${pDoc.id}" value="${idx}" />
                <span>${escape(op)}</span>
              </label>
            `
              )
              .join("")}
          </div>
        `;

        divCaso.appendChild(block);
      });

      examForm.appendChild(divCaso);
    }

    const totalSegundos = totalPreguntas * 75;
    startTimer(totalSegundos);
  } catch (e) {
    console.error("loadExamContent", e);
    if (examTitle) examTitle.innerText = "Error cargando examen";
  }
}

// ========================================
//   TIMER
// ========================================
let timerInterval = null;

function startTimer(seconds) {
  clearInterval(timerInterval);

  let t = seconds;
  const box = examTimer;

  timerInterval = setInterval(() => {
    const min = Math.floor(t / 60);
    const sec = t % 60;
    if (box) {
      box.innerText = `${min}:${sec.toString().padStart(2, "0")}`;
    }

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
const btnFinishExam = $("btnFinishExam");
if (btnFinishExam) {
  btnFinishExam.onclick = () => finishExam();
}

function finishExam() {
  clearInterval(timerInterval);

  hide(examScreen);
  show(resultScreen);

  if (resultScreen) {
    resultScreen.innerText = "Examen finalizado. (Resultados en desarrollo)";
  }
}

// ========================================
//   BOTONES DEL PANEL ADMIN
// ========================================
function clearAdminScreens() {
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);

  if (adminExamsScreen) adminExamsScreen.innerHTML = "";
  if (adminSectionsScreen) adminSectionsScreen.innerHTML = "";
  if (adminUsersScreen) adminUsersScreen.innerHTML = "";
  if (adminIconsScreen) adminIconsScreen.innerHTML = "";
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

  try {
    const qSections = query(
      collection(db, "sections"),
      orderBy("order", "asc")
    );
    const snap = await getDocs(qSections);

    list.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();

      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <strong>${escape(d.name)}</strong>
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

        const orderVal = prompt("Orden:");
        const order = Number(orderVal || "0");

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
        const id = btn.getAttribute("data-id");
        const ref = doc(db, "sections", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) return;
        const data = snap.data();

        const name = prompt("Editar nombre:", data.name);
        if (!name) return;

        const orderVal = prompt("Editar orden:", data.order);
        const order = Number(orderVal || data.order || 0);

        await updateDoc(ref, { name, order });
        adminLoadSectionsPanel();
      };
    });

    list.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("Eliminar sección?")) return;
        const id = btn.getAttribute("data-id");
        await deleteDoc(doc(db, "sections", id));
        adminLoadSectionsPanel();
      };
    });
  } catch (e) {
    console.error("adminLoadSectionsPanel", e);
    list.innerHTML = "<div>Error cargando secciones</div>";
  }
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

  try {
    const snap = await getDocs(collection(db, "exams"));
    container.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();

      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <strong>${escape(d.title)}</strong>
        <div class="small muted">Sección: ${escape(d.sectionId)}</div>
        <button class="btn" data-id="${docu.id}" data-edit="1">Editar</button>
        <button class="btn danger" data-id="${docu.id}" data-del="1">Eliminar</button>
      `;

      container.appendChild(row);
    });

    const addExamBtn = $("addExamBtn");
    if (addExamBtn) {
      addExamBtn.onclick = async () => {
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
        const id = btn.getAttribute("data-id");
        const ref = doc(db, "exams", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

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
        const id = btn.getAttribute("data-id");
        await deleteDoc(doc(db, "exams", id));
        adminLoadExamsPanel();
      };
    });
  } catch (e) {
    console.error("adminLoadExamsPanel", e);
    container.innerHTML = "<div>Error cargando exámenes</div>";
  }
}

// ========================================
//   PANEL — ADMIN: USUARIOS
// ========================================
async function adminLoadUsersPanel() {
  if (!adminUsersScreen) return;

  adminUsersScreen.innerHTML = `
    <h2>Usuarios</h2>
    <button class="btn primary" id="addUserBtn">Crear nuevo usuario</button>
    <div id="usersAdminList" style="margin-top:20px;">Cargando...</div>
  `;

  const list = $("usersAdminList");
  if (!list) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    list.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <strong>${escape(d.email)}</strong>
        <div class="small muted">${escape(d.name)} – Rol: ${escape(
        d.role
      )}</div>
        <button class="btn" data-id="${docu.id}" data-edit="1">Editar</button>
        <button class="btn danger" data-id="${docu.id}" data-del="1">Eliminar</button>
      `;

      list.appendChild(row);
    });

    const addUserBtn = $("addUserBtn");
    if (addUserBtn) {
      addUserBtn.onclick = async () => {
        const email = prompt("Correo:");
        const name = prompt("Nombre:");
        const role = prompt("Rol (admin/user):", "user");

        if (!email || !name) return;

        const ref = doc(db, "users", crypto.randomUUID());

        await setDoc(ref, {
          email,
          name,
          role: role || "user",
          createdAt: serverTimestamp(),
          status: "enabled",
          expires: "",
        });

        adminLoadUsersPanel();
      };
    }

    list.querySelectorAll("button[data-edit]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        const ref = doc(db, "users", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const d = snap.data();

        const name = prompt("Nombre:", d.name);
        if (name === null) return;

        const role = prompt("Rol:", d.role);
        const status = prompt(
          "Estado (enabled/disabled):",
          d.status || "enabled"
        );

        await updateDoc(ref, { name, role, status });
        adminLoadUsersPanel();
      };
    });

    list.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("Eliminar usuario?")) return;
        const id = btn.getAttribute("data-id");
        await deleteDoc(doc(db, "users", id));
        adminLoadUsersPanel();
      };
    });
  } catch (e) {
    console.error("adminLoadUsersPanel", e);
    list.innerHTML = "<div>Error cargando usuarios</div>";
  }
}

// ========================================
//   PANEL — ADMIN: ÍCONOS
// ========================================
async function loadIcons() {
  try {
    const ref = doc(db, "config", "icons");
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const d = snap.data();

    if (igLink) igLink.href = d.instagram || "#";
    if (waLink) waLink.href = d.whatsapp || "#";
    if (tgLink) tgLink.href = d.telegram || "#";
    if (ttLink) ttLink.href = d.tiktok || "#";
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

  const ref = doc(db, "config", "icons");
  try {
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const d = snap.data();
      const icI = $("ic_instagram");
      const icW = $("ic_whatsapp");
      const icTg = $("ic_telegram");
      const icTt = $("ic_tiktok");

      if (icI) icI.value = d.instagram || "";
      if (icW) icW.value = d.whatsapp || "";
      if (icTg) icTg.value = d.telegram || "";
      if (icTt) icTt.value = d.tiktok || "";
    }

    const saveBtn = $("saveIconsBtn");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        await setDoc(
          ref,
          {
            instagram: ($("ic_instagram")?.value || "").trim(),
            whatsapp: ($("ic_whatsapp")?.value || "").trim(),
            telegram: ($("ic_telegram")?.value || "").trim(),
            tiktok: ($("ic_tiktok")?.value || "").trim(),
          },
          { merge: true }
        );

        alert("Íconos actualizados");
        await loadIcons();
      };
    }
  } catch (e) {
    console.error("adminLoadIconsPanel", e);
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

  if (appRoot) {
    appRoot.style.gridTemplateColumns = APP_LAYOUT_DEFAULT;
  }
}

init();
