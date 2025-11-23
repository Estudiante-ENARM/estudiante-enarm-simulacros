/*************************************************************
 *  app.js — Plataforma ENARM
 *  Versión estable y corregida 2025-11-23
 *************************************************************/

// =======================
// IMPORTS FIREBASE (v9)
// =======================
import {
  auth,
  db
} from "./firebase.js";

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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ========================================
//   UTILIDADES
// ========================================
const $ = (id) => document.getElementById(id);
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function escape(s) { return String(s || "").replace(/</g, "&lt;"); }


// ========================================
//   ELEMENTOS DEL DOM
// ========================================
const loginScreen         = $("loginScreen");
const studentScreen       = $("studentScreen");
const examScreen          = $("examScreen");
const resultScreen        = $("resultScreen");

const adminSidebar        = $("adminSidebar");

const adminExamsScreen    = $("adminExamsScreen");
const adminSectionsScreen = $("adminSectionsScreen");
const adminUsersScreen    = $("adminUsersScreen");
const adminIconsScreen    = $("adminIconsScreen");

const sectionsList        = $("sectionsList");
const examsList           = $("examsList");

const adminExamsTab       = $("adminExamsTab");
const adminSectionsTab    = $("adminSectionsTab");
const adminUsersTab       = $("adminUsersTab");
const adminIconsTab       = $("adminIconsTab");
const adminLogout         = $("adminLogout");

const userInfo            = $("userInfo");
const authButtons         = $("authButtons");

// íconos sociales
const igLink = $("link-instagram");
const waLink = $("link-whatsapp");
const tgLink = $("link-telegram");
const ttLink = $("link-tiktok");


// ========================================
//   ESTADO GLOBAL
// ========================================
let currentUser = null;
let currentRole = null;
let selectedSectionId = null;
let selectedExamId = null;


// ========================================
//   LOGIN
// ========================================
$("btnLogin").onclick = async () => {
  const email = $("inputEmail").value.trim();
  const pass  = $("inputPassword").value.trim();

  if (!email || !pass) {
    $("loginMessage").innerText = "Ingrese correo y contraseña";
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    $("loginMessage").innerText = "Accediendo...";
  } catch (e) {
    console.error(e);
    $("loginMessage").innerText = "Credenciales incorrectas";
  }
};

$("btnCancel").onclick = () => {
  $("inputEmail").value = "";
  $("inputPassword").value = "";
  $("loginMessage").innerText = "";
};


// ========================================
//   CERRAR SESIÓN
// ========================================
async function doLogout() {
  await signOut(auth);
}


// ========================================
//   OBSERVADOR AUTH
// ========================================
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    currentRole = null;
    userInfo.innerText = "";
    hide(adminSidebar);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    hide(adminExamsScreen);
    hide(adminSectionsScreen);
    hide(adminUsersScreen);
    hide(adminIconsScreen);

    show(loginScreen);
    return;
  }

  // Obtener rol
  const uRef = doc(db, "users", user.uid);
  const uSnap = await getDoc(uRef);

  if (!uSnap.exists()) {
    currentRole = "user";
  } else {
    currentRole = uSnap.data().role || "user";
  }

  userInfo.innerText = `${user.email} (${currentRole})`;

  hide(loginScreen);

  if (currentRole === "admin") {
    show(adminSidebar);
  } else {
    hide(adminSidebar);

    // IMPORTANTE: Quitar espacio de layout reservado al admin sidebar
    document.querySelector(".app").style.gridTemplateColumns = "260px 1fr";
  }

  await loadIcons();
  await loadSections();
});


// ========================================
//   CARGAR SECCIONES
// ========================================
async function loadSections() {
  sectionsList.innerHTML = "Cargando...";

  try {
    const q = query(collection(db, "sections"), orderBy("order", "asc"));
    const snap = await getDocs(q);

    sectionsList.innerHTML = "";

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
  $("studentTitle").innerText = name;

  await loadExams(sectionId);
}


// ========================================
//   CARGAR EXÁMENES
// ========================================
async function loadExams(sectionId) {
  examsList.innerHTML = "Cargando exámenes...";

  try {
    const q = query(
      collection(db, "exams"),
      where("sectionId", "==", sectionId),
      orderBy("createdAt", "asc")
    );

    const snap = await getDocs(q);

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
          <div class="title">${escape(d.title)}</div>
          <div class="meta">${escape(d.description || "")}</div>
        </div>
        <button data-id="${docu.id}" class="btn primary">Abrir</button>
      `;

      box.querySelector("button").onclick = () => openExam(docu.id);

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

  $("examForm").innerHTML = "";
  $("examTitle").innerText = "Cargando...";

  show(examScreen);

  // cargar preguntas → casos + preguntas
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
      $("examTitle").innerText = "Examen no encontrado";
      return;
    }

    const exam = examSnap.data();
    $("examTitle").innerText = exam.title;

    const casosQ = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId),
      orderBy("orden", "asc")
    );

    const casosSnap = await getDocs(casosQ);

    const form = $("examForm");
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

      // Render del caso
      const divCaso = document.createElement("div");
      divCaso.className = "questionBlock";
      divCaso.innerHTML = `
        <div class="questionTitle">${escape(caso.titulo)}</div>
        <div class="caseText">${escape(caso.texto)}</div>
      `;

      preguntasSnap.forEach((pDoc, i) => {
        const p = pDoc.data();
        totalPreguntas++;

        const block = document.createElement("div");
        block.innerHTML = `
          <div style="margin-top:10px; font-weight:700;">${escape(p.pregunta)}</div>
          <div class="options">
            ${p.opciones.map((op, idx) => `
              <label>
                <input type="radio" name="p_${pDoc.id}" value="${idx}" />
                <span>${escape(op)}</span>
              </label>
            `).join("")}
          </div>
        `;

        divCaso.appendChild(block);
      });

      form.appendChild(divCaso);
    }

    // tiempo = preguntas * 75 s
    const totalSegundos = totalPreguntas * 75;
    startTimer(totalSegundos);

  } catch (e) {
    console.error("loadExamContent", e);
    $("examTitle").innerText = "Error cargando examen";
  }
}


// ========================================
//   TIMER
// ========================================
let timerInterval = null;

function startTimer(seconds) {
  clearInterval(timerInterval);

  let t = seconds;
  const box = $("examTimer");

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
$("btnFinishExam").onclick = () => finishExam();

function finishExam() {
  clearInterval(timerInterval);

  hide(examScreen);
  show(resultScreen);

  $("resultScreen").innerText = "Examen finalizado. (Resultados en desarrollo)";
}


// ========================================
//   BOTONES DEL PANEL ADMIN
// ========================================

function clearAdminScreens() {
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);

  adminExamsScreen.innerHTML = "";
  adminSectionsScreen.innerHTML = "";
  adminUsersScreen.innerHTML = "";
  adminIconsScreen.innerHTML = "";
}

adminExamsTab.onclick = () => {
  if (currentRole !== "admin") return;
  clearAdminScreens();
  show(adminExamsScreen);
  adminLoadExamsPanel();
};

adminSectionsTab.onclick = () => {
  if (currentRole !== "admin") return;
  clearAdminScreens();
  show(adminSectionsScreen);
  adminLoadSectionsPanel();
};

adminUsersTab.onclick = () => {
  if (currentRole !== "admin") return;
  clearAdminScreens();
  show(adminUsersScreen);
  adminLoadUsersPanel();
};

adminIconsTab.onclick = () => {
  if (currentRole !== "admin") return;
  clearAdminScreens();
  show(adminIconsScreen);
  adminLoadIconsPanel();
};

adminLogout.onclick = doLogout;


// ========================================
//   PANEL — ADMIN: SECCIONES
// ========================================
async function adminLoadSectionsPanel() {
  adminSectionsScreen.innerHTML = `
    <h2>Secciones</h2>
    <button class="btn primary" id="addSectionBtn">Agregar sección</button>
    <div id="sectionsAdminList" style="margin-top:20px;">Cargando...</div>
  `;

  const list = $("sectionsAdminList");

  const q = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(q);

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

  $("addSectionBtn").onclick = async () => {
    const name = prompt("Nombre de la sección:");
    if (!name) return;

    const order = Number(prompt("Orden:"));
    await addDoc(collection(db, "sections"), {
      name,
      order,
      createdAt: serverTimestamp()
    });

    adminLoadSectionsPanel();
  };

  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "sections", id);
      const snap = await getDoc(ref);

      const data = snap.data();

      const name  = prompt("Editar nombre:", data.name);
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
  adminExamsScreen.innerHTML = `
    <h2>Exámenes</h2>
    <button class="btn primary" id="addExamBtn">Agregar examen</button>
    <div id="adminExamsList" style="margin-top:20px;">Cargando...</div>
  `;

  const container = $("adminExamsList");

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

  $("addExamBtn").onclick = async () => {
    const sectionId = prompt("ID sección:");
    if (!sectionId) return;

    const title = prompt("Título:");
    if (!title) return;

    const desc  = prompt("Descripción:");
    const ref = await addDoc(collection(db, "exams"), {
      sectionId,
      title,
      description: desc || "",
      createdAt: serverTimestamp()
    });

    adminLoadExamsPanel();
  };

  container.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "exams", id);
      const snap = await getDoc(ref);
      const ex = snap.data();

      const title = prompt("Editar título:", ex.title);
      if (!title) return;

      const desc  = prompt("Editar descripción:", ex.description || "");

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
// ========================================
async function adminLoadUsersPanel() {

  adminUsersScreen.innerHTML = `
    <h2>Usuarios</h2>
    <button class="btn primary" id="addUserBtn">Crear nuevo usuario</button>
    <div id="usersAdminList" style="margin-top:20px;">Cargando...</div>
  `;

  const list = $("usersAdminList");

  const snap = await getDocs(collection(db, "users"));
  list.innerHTML = "";

  snap.forEach((docu) => {
    const d = docu.data();
    const row = document.createElement("div");
    row.className = "card";
    row.style.marginBottom = "8px";

    row.innerHTML = `
      <strong>${escape(d.email)}</strong>
      <div class="small muted">${escape(d.name)} – Rol: ${escape(d.role)}</div>
      <button class="btn" data-id="${docu.id}" data-edit="1">Editar</button>
      <button class="btn danger" data-id="${docu.id}" data-del="1">Eliminar</button>
    `;

    list.appendChild(row);
  });

  // crear usuario
  $("addUserBtn").onclick = async () => {
    const email = prompt("Correo:");
    const name  = prompt("Nombre:");
    const role  = prompt("Rol (admin/user):", "user");

    if (!email || !name) return;

    const ref = doc(db, "users", crypto.randomUUID());

    await setDoc(ref, {
      email,
      name,
      role: role || "user",
      createdAt: serverTimestamp(),
      status: "enabled",
      expires: ""  // futuro
    });

    adminLoadUsersPanel();
  };

  // editar usuario
  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "users", id);
      const snap = await getDoc(ref);
      const d = snap.data();

      const name = prompt("Nombre:", d.name);
      if (name === null) return;

      const role = prompt("Rol:", d.role);
      const status = prompt("Estado (enabled/disabled):", d.status || "enabled");

      await updateDoc(ref, { name, role, status });
      adminLoadUsersPanel();
    };
  });

  // eliminar usuario
  list.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Eliminar usuario?")) return;
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

  $("saveIconsBtn").onclick = async () => {
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
}

init();
