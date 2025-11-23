/************************************************************
 * ESTUDIANTE ENARM - APP.JS
 * Versión completa ADMIN + ESTUDIANTE
 * PARTE 1/6
 ************************************************************/

// ===========================================================
// 1. IMPORTS Y CONFIGURACIÓN FIREBASE
// ===========================================================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";

import { firebaseConfig } from "./firebase.js";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===========================================================
// 2. ELEMENTOS DEL DOM
// ===========================================================
const loginScreen = document.getElementById("loginScreen");
const inputEmail = document.getElementById("inputEmail");
const inputPassword = document.getElementById("inputPassword");
const btnLogin = document.getElementById("btnLogin");
const btnCancel = document.getElementById("btnCancel");
const loginMessage = document.getElementById("loginMessage");

const mainContent = document.getElementById("mainContent");
const userInfo = document.getElementById("userInfo");

const leftSidebar = document.querySelector(".left-sidebar");
const adminSidebar = document.getElementById("adminSidebar");

const sectionsList = document.getElementById("sectionsList");
const studentScreen = document.getElementById("studentScreen");
const examsList = document.getElementById("examsList");

const examScreen = document.getElementById("examScreen");
const examTitle = document.getElementById("examTitle");
const examForm = document.getElementById("examForm");
const examTimer = document.getElementById("examTimer");
const btnFinishExam = document.getElementById("btnFinishExam");

const resultScreen = document.getElementById("resultScreen");

const editButtons = document.getElementById("editButtons");
const editExamButtons = document.getElementById("editExamButtons");

const adminAddSection = document.getElementById("adminAddSection");
const adminAddExam = document.getElementById("adminAddExam");
const adminUsers = document.getElementById("adminUsers");
const adminLinks = document.getElementById("adminLinks");
const adminLogout = document.getElementById("adminLogout");

// Iconos sociales
const linkInstagram = document.getElementById("link-instagram");
const linkWhatsApp = document.getElementById("link-whatsapp");
const linkTelegram = document.getElementById("link-telegram");
const linkTikTok = document.getElementById("link-tiktok");

// Estado global
let currentUser = null;
let currentRole = "guest"; // guest, admin, student
let selectedSection = null;
let selectedExam = null;

// ===========================================================
// 3. UTILIDADES
// ===========================================================
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function clearMain() {
  studentScreen.classList.add("hidden");
  examScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  examsList.innerHTML = "";
  examForm.innerHTML = "";
}

// ===========================================================
// 4. LOGIN / AUTH
// ===========================================================
btnLogin.onclick = async () => {
  loginMessage.textContent = "Verificando...";
  try {
    const email = inputEmail.value.trim();
    const password = inputPassword.value.trim();

    if (!email || !password) {
      loginMessage.textContent = "Ingresa correo y contraseña.";
      return;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "";

  } catch (e) {
    console.error(e);
    loginMessage.textContent = "Correo o contraseña incorrectos.";
  }
};

btnCancel.onclick = () => {
  inputEmail.value = "";
  inputPassword.value = "";
  loginMessage.textContent = "";
};

// Listener global
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    currentRole = "guest";
    userInfo.textContent = "";
    hide(adminSidebar);
    show(loginScreen);
    return;
  }

  // obtener rol
  const uref = doc(db, "users", user.uid);
  const usnap = await getDoc(uref);

  if (usnap.exists()) {
    currentRole = usnap.data().role || "student";
  } else {
    currentRole = "student";
  }

  userInfo.textContent = `${user.email} (${currentRole})`;

  hide(loginScreen);

  // Modo Admin activa barra derecha
  if (currentRole === "admin") {
    adminSidebar.style.display = "flex";
  } else {
    adminSidebar.style.display = "none"; // no ocupa espacio
  }

  await loadSections();
});

// Logout
async function doLogout() {
  await signOut(auth);
  window.location.reload();
}

// ===========================================================
// 5. CARGA DE SECCIONES (SIDEBAR IZQUIERDO)
// ===========================================================
async function loadSections() {
  sectionsList.innerHTML = `<div class="muted small">Cargando secciones...</div>`;

  try {
    const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
    const snap = await getDocs(qSec);

    sectionsList.innerHTML = "";

    snap.forEach((sDoc) => {
      const d = sDoc.data();
      const item = document.createElement("div");
      item.className = "section-item";
      item.dataset.id = sDoc.id;

      item.innerHTML = `
        <span>${escapeHtml(d.name)}</span>
      `;

      item.onclick = () => {
        document.querySelectorAll(".section-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        selectedSection = sDoc.id;
        loadExamsBySection(sDoc.id);
      };

      sectionsList.appendChild(item);
    });

  } catch (e) {
    console.error("Error cargando secciones", e);
    sectionsList.innerHTML = `<div class="muted small">Error cargando secciones</div>`;
  }
}

// ===========================================================
// 6. CARGAR EXÁMENES DE UNA SECCIÓN (PANTALLA PRINCIPAL)
// ===========================================================
async function loadExamsBySection(sectionId) {
  clearMain();
  show(studentScreen);

  examsList.innerHTML = `<div class="muted small">Cargando exámenes...</div>`;

  try {
    const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId), orderBy("createdAt", "asc"));
    const snap = await getDocs(qEx);

    examsList.innerHTML = "";

    snap.forEach((eDoc) => {
      const d = eDoc.data();
      const box = document.createElement("div");
      box.className = "examBox";
      box.dataset.id = eDoc.id;

      box.innerHTML = `
        <div>
          <div class="title">${escapeHtml(d.title)}</div>
          <div class="meta">${escapeHtml(d.description || "")}</div>
        </div>
        <button class="openExamBtn">Abrir</button>
      `;

      box.querySelector(".openExamBtn").onclick = () => openExam(eDoc.id);

      examsList.appendChild(box);
    });

    if (currentRole === "admin") {
      show(editButtons);
    } else {
      hide(editButtons);
    }

  } catch (e) {
    console.error("Error cargando exámenes", e);
    examsList.innerHTML = `<div class="muted small">Error cargando exámenes</div>`;
  }
}

/************************************************************
 * FIN DE PARTE 1
 * RESPONDE: "OK, siguiente"
 ************************************************************/
/************************************************************
 * ESTUDIANTE ENARM - APP.JS
 * PARTE 2/6
 * EXÁMENES — abrir, cargar casos, cargar preguntas
 ************************************************************/

// ===========================================================
// 7. ABRIR UN EXAMEN (modo admin o estudiante)
// ===========================================================
async function openExam(examId) {
  clearMain();
  selectedExam = examId;

  show(examScreen);
  hide(resultScreen);

  examTitle.textContent = "Cargando examen...";
  examForm.innerHTML = `<div class="muted small">Cargando casos...</div>`;

  try {
    // Obtener información principal del examen
    const eDoc = await getDoc(doc(db, "exams", examId));
    if (!eDoc.exists()) {
      examForm.innerHTML = `<div class="muted">Examen no encontrado.</div>`;
      return;
    }

    const examData = eDoc.data();
    examTitle.textContent = examData.title;

    // Cargar casos clínicos
    const casos = await loadCasos(examId);

    // Cargar preguntas de cada caso
    const preguntas = await loadPreguntas(examId);

    // Renderizar el examen completo
    renderExam(casos, preguntas);

    // Si es estudiante → iniciar temporizador
    if (currentRole !== "admin") {
      calcExamTimeFromQuestions(preguntas);
    }

    // Botones flotantes admin
    if (currentRole === "admin") {
      show(editExamButtons);
      hide(btnFinishExam);
    } else {
      hide(editExamButtons);
      show(btnFinishExam);
    }

  } catch (e) {
    console.error("openExam error", e);
    examForm.innerHTML = `<div class="muted small">Error cargando examen.</div>`;
  }
}


// ===========================================================
// 8. CARGAR CASOS CLÍNICOS DE UN EXAMEN
// ===========================================================
async function loadCasos(examId) {
  const qCasos = query(
    collection(db, "casosClinicos"),
    where("examId", "==", examId),
    orderBy("orden", "asc")
  );

  const snap = await getDocs(qCasos);
  const casos = [];

  snap.forEach((c) =>
    casos.push({
      id: c.id,
      ...c.data()
    })
  );

  return casos;
}


// ===========================================================
// 9. CARGAR PREGUNTAS DE UN EXAMEN
// ===========================================================
async function loadPreguntas(examId) {
  const qPreg = query(
    collection(db, "preguntas"),
    where("examId", "==", examId),
    orderBy("orden", "asc")
  );

  const snap = await getDocs(qPreg);
  const preguntas = [];

  snap.forEach((p) =>
    preguntas.push({
      id: p.id,
      ...p.data()
    })
  );

  return preguntas;
}


// ===========================================================
// 10. CALCULAR TIEMPO DE EXAMEN (1 pregunta = 75 segundos)
// ===========================================================
function calcExamTimeFromQuestions(preguntas) {
  const totalPreguntas = preguntas.length;
  const totalSegundos = totalPreguntas * 75;

  startTimer(totalSegundos);
}


// ===========================================================
// 11. RENDERIZAR EXAMEN COMPLETO
// ===========================================================
function renderExam(casos, preguntas) {
  examForm.innerHTML = "";

  if (!casos.length) {
    examForm.innerHTML = `<div class="muted small">No hay casos clínicos.</div>`;
    return;
  }

  casos.forEach((caso) => {
    // Crear contenedor del caso clínico
    const block = document.createElement("div");
    block.className = "questionBlock";

    block.innerHTML = `
      <div class="questionTitle">${escapeHtml(caso.titulo)}</div>
      <div class="caseText">${escapeHtml(caso.texto)}</div>
      <div class="preguntasContainer"></div>
    `;

    const contPreg = block.querySelector(".preguntasContainer");

    // Filtrar preguntas de este caso
    const pregCaso = preguntas.filter((p) => p.casoId === caso.id);

    pregCaso.forEach((p) => {
      const q = document.createElement("div");
      q.className = "qItem";

      // Opciones
      let opts = "";
      p.opciones.forEach((op, idx) => {
        opts += `
          <label>
            <input type="radio" name="preg_${p.id}" value="${idx}">
            <span>${escapeHtml(op)}</span>
          </label>
        `;
      });

      q.innerHTML = `
        <div class="questionTitle">${escapeHtml(p.pregunta)}</div>
        <div class="options">${opts}</div>
      `;

      contPreg.appendChild(q);
    });

    examForm.appendChild(block);
  });
}


// ===========================================================
// 12. TEMPORIZADOR EN MODO ESTUDIANTE
// ===========================================================
let timerInterval = null;

function startTimer(totalSeconds) {
  clearInterval(timerInterval);

  let remaining = totalSeconds;

  examTimer.textContent = formatTime(remaining);

  timerInterval = setInterval(() => {
    remaining--;
    examTimer.textContent = formatTime(remaining);

    if (remaining <= 0) {
      clearInterval(timerInterval);
      finishExam();
    }
  }, 1000);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/************************************************************
 * FIN DE PARTE 2
 * RESPONDE: "OK, siguiente"
 ************************************************************/
// =======================================================
// APP.JS — PARTE 3/6
// ADMIN: USUARIOS + ICONOS + LOGOUT + INIT
// =======================================================

// ---------------------- ADMIN: USUARIOS ----------------------
if (adminUsers) {
  adminUsers.onclick = async () => {
    clearAdminPanels();

    const area = document.createElement("div");
    area.className = "editor-area";
    adminSidebar.appendChild(area);

    area.innerHTML = `
      <h2>Usuarios</h2>

      <div id="usersList" class="card" style="padding:12px;">Cargando usuarios...</div>

      <h3 style="margin-top:18px;">Crear nuevo usuario</h3>
      <div id="newUserForm" class="card" style="padding:12px;">
        <label>Nombre</label><input id="nu_name">
        <label>Email</label><input id="nu_email">
        <label>Contraseña</label><input id="nu_pass" type="password">
        <label>Fecha límite de acceso</label><input id="nu_exp" type="date">
        
        <label>Estado</label>
        <select id="nu_status">
          <option value="habilitado">Habilitado</option>
          <option value="inhabilitado">Inhabilitado</option>
        </select>

        <button id="nu_create" class="btn primary" style="margin-top:10px;">Crear usuario</button>
      </div>
    `;

    const usersList = document.getElementById("usersList");

    // Cargar usuarios existentes
    try {
      const snap = await getDocs(collection(db, "users"));
      usersList.innerHTML = "";

      if (snap.empty) {
        usersList.innerHTML = `<div class="muted">No hay usuarios registrados.</div>`;
      }

      snap.forEach((docu) => {
        const u = docu.data();

        const row = document.createElement("div");
        row.className = "card";
        row.style.padding = "10px";
        row.style.marginBottom = "8px";

        row.innerHTML = `
          <strong>${escapeHtml(u.name || "")}</strong>
          <div class="small">${escapeHtml(u.email || "")}</div>
          <div class="small muted">Estado: ${escapeHtml(u.estado || "habilitado")}</div>
          <div class="small muted">Expira: ${escapeHtml(u.expira || "Sin fecha")}</div>

          <button class="btn u_edit" data-id="${docu.id}" style="margin-top:6px;">Editar</button>
          <button class="btn danger u_delete" data-id="${docu.id}" style="margin-top:6px;">Eliminar</button>
        `;

        usersList.appendChild(row);
      });

      // EDITAR USUARIO
      document.querySelectorAll(".u_edit").forEach((btn) => {
        btn.onclick = async () => {
          const uid = btn.getAttribute("data-id");
          const refUser = doc(db, "users", uid);
          const snapUser = await getDoc(refUser);

          if (!snapUser.exists()) return alert("Usuario no encontrado");

          const d = snapUser.data();

          const nombre = prompt("Nombre:", d.name || "");
          if (nombre === null) return;

          const estado = prompt("Estado (habilitado/inhabilitado):", d.estado || "habilitado");
          if (estado === null) return;

          const expira = prompt("Fecha límite (YYYY-MM-DD):", d.expira || "");
          if (expira === null) return;

          await updateDoc(refUser, {
            name: nombre,
            estado,
            expira
          });

          alert("Usuario actualizado");
          adminUsers.onclick(); // Recargar lista
        };
      });

      // ELIMINAR USUARIO
      document.querySelectorAll(".u_delete").forEach((btn) => {
        btn.onclick = async () => {

          if (!confirm("¿Eliminar usuario?")) return;

          const uid = btn.getAttribute("data-id");

          await deleteDoc(doc(db, "users", uid));

          alert("Usuario eliminado");
          adminUsers.onclick();
        };
      });

    } catch (e) {
      console.error("Error cargando usuarios", e);
      usersList.innerHTML = `<div class="muted">Error cargando usuarios.</div>`;
    }

    // CREAR NUEVO USUARIO (Firestore)
    document.getElementById("nu_create").onclick = async () => {
      const name = document.getElementById("nu_name").value.trim();
      const email = document.getElementById("nu_email").value.trim();
      const pass = document.getElementById("nu_pass").value.trim();
      const exp = document.getElementById("nu_exp").value.trim();
      const status = document.getElementById("nu_status").value;

      if (!name || !email || !pass) {
        return alert("Completa nombre, email y contraseña.");
      }

      const uid = crypto.randomUUID();

      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        pass,
        estado: status,
        expira: exp || "",
        createdAt: Date.now()
      });

      alert("Usuario creado. Recuerda: DEBES crear manualmente el usuario en Firebase Auth para que pueda iniciar sesión.");

      adminUsers.onclick();
    };
  };
}

// ---------------------- ADMIN: ICONOS ----------------------
if (adminIcons) {
  adminIcons.onclick = async () => {
    clearAdminPanels();

    const area = document.createElement("div");
    area.className = "editor-area";
    adminSidebar.appendChild(area);

    area.innerHTML = `
      <h2>Íconos sociales</h2>
      <div class="card" style="padding:12px;">
        <label>Instagram</label><input id="ic_ig">
        <label>WhatsApp</label><input id="ic_wa">
        <label>Telegram</label><input id="ic_tg">
        <label>TikTok</label><input id="ic_tt">
        <button id="ic_save" class="btn primary" style="margin-top:12px;">Guardar</button>
      </div>
    `;

    const icRef = doc(db, "config", "icons");
    const snap = await getDoc(icRef);

    if (snap.exists()) {
      const d = snap.data();
      ic_ig.value = d.instagram || "";
      ic_wa.value = d.whatsapp || "";
      ic_tg.value = d.telegram || "";
      ic_tt.value = d.tiktok || "";
    }

    ic_save.onclick = async () => {
      await setDoc(icRef, {
        instagram: ic_ig.value.trim(),
        whatsapp: ic_wa.value.trim(),
        telegram: ic_tg.value.trim(),
        tiktok: ic_tt.value.trim()
      });
      alert("Íconos guardados");
    };
  };
}

// ---------------------- LOGOUT ----------------------
function doLogout() {
  localStorage.removeItem("sessionUser");
  location.reload();
}

if (adminLogout) {
  adminLogout.onclick = doLogout;
}

// ---------------------- FUNCTION: LIMPIAR PANEL DERECHO ----------------------
function clearAdminPanels() {
  const olds = adminSidebar.querySelectorAll(".editor-area");
  olds.forEach((o) => o.remove());
}

// ---------------------- INIT ----------------------
async function init() {
  hide(adminSidebar);
  hide(studentScreen);
  hide(examScreen);
  hide(resultScreen);

  await loadSections();
}

init().catch((e) => console.error("Error en init()", e));

// =====================================================
//   ADMIN: GESTIÓN DE CASOS CLÍNICOS
// =====================================================

// Renderiza todos los casos clínicos de un examen
async function loadCasosClinicos(examId) {
  const cont = document.getElementById("casesContainer");
  if (!cont) return;

  cont.innerHTML = `<div class="muted">Cargando casos clínicos...</div>`;

  try {
    const q = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId),
      orderBy("orden", "asc")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = `<div class="muted">No hay casos clínicos para este examen.</div>`;
      return;
    }

    cont.innerHTML = "";

    snap.forEach((cDoc) => {
      const c = cDoc.data();
      const div = document.createElement("div");
      div.className = "case-editor card";
      div.setAttribute("data-caso-id", cDoc.id);

      div.innerHTML = `
        <label>Título del caso clínico</label>
        <input class="case-title" value="${escapeHtml(c.titulo)}">

        <label>Texto del caso</label>
        <textarea class="case-text">${escapeHtml(c.texto)}</textarea>

        <label>Orden</label>
        <input class="case-order" type="number" value="${c.orden || 1}">

        <button class="btn small primary add-question-btn">Agregar pregunta</button>

        <div class="questionsContainer"></div>

        <button class="btn danger del-case-btn">Eliminar caso clínico</button>
      `;

      cont.appendChild(div);

      loadPreguntasCaso(examId, cDoc.id, div.querySelector(".questionsContainer"));
    });

  } catch (e) {
    console.error("Error cargando casos clínicos:", e);
    cont.innerHTML = `<div class="error">Error cargando casos clínicos.</div>`;
  }
}


// =====================================================
//   ADMIN: GESTIÓN DE PREGUNTAS
// =====================================================

// Cargar preguntas de un caso clínico
async function loadPreguntasCaso(examId, casoId, container) {
  container.innerHTML = `<div class="muted">Cargando preguntas...</div>`;

  try {
    const q = query(
      collection(db, "preguntas"),
      where("examId", "==", examId),
      where("casoId", "==", casoId),
      orderBy("orden", "asc")
    );

    const snap = await getDocs(q);

    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = `<div class="muted">Sin preguntas aún.</div>`;
      return;
    }

    snap.forEach((pDoc) => {
      const p = pDoc.data();

      const qBox = document.createElement("div");
      qBox.className = "question-editor card";

      qBox.innerHTML = `
        <label>Pregunta</label>
        <textarea class="q-text">${escapeHtml(p.pregunta)}</textarea>

        <label>Opciones</label>
        <input class="q-opt" value="${escapeHtml(p.opciones[0] || "")}">
        <input class="q-opt" value="${escapeHtml(p.opciones[1] || "")}">
        <input class="q-opt" value="${escapeHtml(p.opciones[2] || "")}">
        <input class="q-opt" value="${escapeHtml(p.opciones[3] || "")}">

        <label>Respuesta correcta (0-3)</label>
        <input class="q-correct" type="number" value="${p.correcta}" min="0" max="3">

        <label>Justificación</label>
        <textarea class="q-just">${escapeHtml(p.justificacion)}</textarea>

        <label>Orden</label>
        <input class="q-order" type="number" value="${p.orden || 1}">

        <button class="btn danger del-question-btn" data-id="${pDoc.id}">Eliminar pregunta</button>
      `;

      container.appendChild(qBox);
    });

  } catch (e) {
    console.error("Error cargando preguntas:", e);
    container.innerHTML = `<div class="error">Error cargando preguntas.</div>`;
  }
}


// ====================================================================
//   GUARDAR TODO EL EXAMEN (casos + preguntas) DESDE EL EDITOR
// ====================================================================

async function saveFullExam(examId) {
  try {
    // Guardar CASOS
    const casos = document.querySelectorAll(".case-editor");

    for (const c of casos) {
      const casoId = c.getAttribute("data-caso-id");

      const titulo = c.querySelector(".case-title").value.trim();
      const texto = c.querySelector(".case-text").value.trim();
      const orden = parseInt(c.querySelector(".case-order").value.trim()) || 1;

      if (!casoId) continue;

      await updateDoc(doc(db, "casosClinicos", casoId), {
        titulo,
        texto,
        orden
      });

      // Guardar PREGUNTAS de ese caso
      const questionsContainer = c.querySelector(".questionsContainer");
      const qEditors = questionsContainer.querySelectorAll(".question-editor");

      let qIndex = 1;

      for (const q of qEditors) {
        const text = q.querySelector(".q-text").value.trim();
        const opts = Array.from(q.querySelectorAll(".q-opt")).map((e) => e.value.trim());
        const correct = parseInt(q.querySelector(".q-correct").value.trim()) || 0;
        const just = q.querySelector(".q-just").value.trim();
        const order = parseInt(q.querySelector(".q-order").value.trim()) || qIndex++;

        const qId = q.querySelector(".del-question-btn").getAttribute("data-id");

        if (qId) {
          await updateDoc(doc(db, "preguntas", qId), {
            pregunta: text,
            opciones: opts,
            correcta: correct,
            justificacion: just,
            orden: order
          });
        }
      }
    }

    alert("Cambios guardados correctamente.");
  } catch (e) {
    console.error("Error guardando examen", e);
    alert("Error guardando examen.");
  }
}

// =======================================================
// APP.JS — PARTE 5/6
// INTENTOS + TIEMPO AUTOMÁTICO + ICONOS ESTUDIANTE
// =======================================================

// -----------------------------
// 1) CARGAR ÍCONOS SOCIALES PARA MODO ESTUDIANTE
// -----------------------------
async function loadIcons() {
  try {
    const iconsRef = doc(db, "config", "icons");
    const snap = await getDoc(iconsRef);

    if (!snap.exists()) return;

    const data = snap.data();

    if (linkInstagram) linkInstagram.href = data.instagram || "#";
    if (linkWhatsApp) linkWhatsApp.href = data.whatsapp || "#";
    if (linkTelegram) linkTelegram.href = data.telegram || "#";
    if (linkTikTok) linkTikTok.href = data.tiktok || "#";

  } catch (e) {
    console.error("Error cargando íconos", e);
  }
}

loadIcons();


// =======================================================
// 2) INTENTOS DE EXAMEN (0–3)
// attempts/{uid_examId}
// Fields:
//   uid
//   examId
//   used (0–3)
//   last (timestamp string)
// =======================================================

async function getAttempts(uid, examId) {
  const id = `${uid}_${examId}`;
  const ref = doc(db, "attempts", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return {
      used: 0,
      last: ""
    };
  }
  return snap.data();
}

async function incrementAttempt(uid, examId) {
  const id = `${uid}_${examId}`;
  const ref = doc(db, "attempts", id);

  const prev = await getAttempts(uid, examId);
  const used = (prev.used || 0) + 1;

  await setDoc(ref, {
    uid,
    examId,
    used,
    last: new Date().toISOString()
  });

  return used;
}

async function resetAttempts(uid, examId) {
  const id = `${uid}_${examId}`;
  await setDoc(doc(db, "attempts", id), {
    uid,
    examId,
    used: 0,
    last: ""
  });
}


// =======================================================
// 3) CALCULAR TIEMPO DE EXAMEN
//    75 SEGUNDOS POR PREGUNTA
// =======================================================

async function calculateExamDuration(examId) {
  try {
    const qSnap = await getDocs(
      query(collection(db, "preguntas"), where("examId", "==", examId))
    );

    const numPreg = qSnap.size;
    if (numPreg === 0) return 5; // fallback mínimo

    const seconds = numPreg * 75;
    const minutes = Math.ceil(seconds / 60);
    return minutes;

  } catch (e) {
    console.error("Error calculando tiempo", e);
    return 5;
  }
}


// =======================================================
// 4) MOSTRAR EXAMEN (INCLUYE TIEMPO REAL)
// =======================================================

let examInterval = null;

async function openExamStudent(examId) {
  hide(studentScreen);
  hide(resultScreen);
  show(examScreen);

  examForm.innerHTML = "Cargando preguntas...";

  try {
    const examRef = doc(db, "exams", examId);
    const examSnap = await getDoc(examRef);
    if (!examSnap.exists()) {
      examForm.innerHTML = `<div class="muted">Examen no encontrado.</div>`;
      return;
    }

    const exam = examSnap.data();
    examTitle.innerText = exam.title || "Examen";

    // CARGAR CASOS Y PREGUNTAS
    const casosSnap = await getDocs(
      query(
        collection(db, "casosClinicos"),
        where("examId", "==", examId),
        orderBy("orden", "asc")
      )
    );

    let html = "";
    for (const caso of casosSnap.docs) {
      const c = caso.data();

      html += `
        <div class="questionBlock">
          <h3 class="questionTitle">${escapeHtml(c.titulo)}</h3>
          <div class="caseText">${escapeHtml(c.texto)}</div>
      `;

      const pregSnap = await getDocs(
        query(
          collection(db, "preguntas"),
          where("casoId", "==", caso.id),
          orderBy("orden", "asc")
        )
      );

      pregSnap.forEach((p) => {
        const q = p.data();
        html += `
          <div style="margin-top:10px; font-weight:700;">${escapeHtml(q.pregunta)}</div>
        `;

        q.opciones.forEach((op, i) => {
          html += `
            <label class="options">
              <input type="radio" name="p_${p.id}" value="${i}">
              <span>${escapeHtml(op)}</span>
            </label>
          `;
        });
      });

      html += `</div>`;
    }

    examForm.innerHTML = html;

    // ============================================
    // TIEMPO REAL BASADO EN PREGUNTAS
    // ============================================

    let minutes = await calculateExamDuration(examId);
    let remaining = minutes * 60;

    examTimer.innerText = formatTime(remaining);

    clearInterval(examInterval);
    examInterval = setInterval(() => {
      remaining--;
      examTimer.innerText = formatTime(remaining);
      if (remaining <= 0) {
        clearInterval(examInterval);
        finishExam(examId);
      }
    }, 1000);

  } catch (e) {
    console.error("Error abriendo examen", e);
    examForm.innerHTML = `<div class="muted">Error cargando examen.</div>`;
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}


// =======================================================
// 5) FINALIZAR EXAMEN (STUDENT)
// =======================================================

async function finishExam(examId) {
  clearInterval(examInterval);

  const u = currentUser;
  if (!u) {
    alert("Sesión inválida");
    return;
  }

  // CONTAR INTENTO
  await incrementAttempt(u.uid, examId);

  hide(examScreen);
  show(resultScreen);

  resultScreen.innerHTML = `<h2>Examen finalizado</h2><div class="muted">Tus respuestas han sido registradas.</div>`;
}
// =======================================================
// APP.JS — PARTE 6/6
// CREACIÓN DE USUARIOS (ADMIN) + EDICIÓN + ELIMINAR
// =======================================================

// --------------- HELPERS VALIDACIÓN -------------------
function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function validatePassword(pwd) {
  return pwd.length >= 6;
}

// =======================================================
// 1) MOSTRAR PANEL DE USUARIOS (ADMIN)
// =======================================================

async function openUsersPanel() {
  mainContent.innerHTML = `
    <h2>Usuarios</h2>

    <div class="card" style="margin-top:12px;">
      <h3>Crear nuevo usuario</h3>

      <label>Email</label>
      <input id="newUserEmail" type="email">

      <label>Contraseña</label>
      <input id="newUserPass" type="password">

      <label>Nombre</label>
      <input id="newUserName" type="text">

      <label>Rol</label>
      <select id="newUserRole">
        <option value="user">Usuario (estudiante)</option>
        <option value="admin">Administrador</option>
      </select>

      <label>Fecha límite de acceso</label>
      <input id="newUserLimit" type="date">

      <button id="btnCreateUser" class="btn primary" style="margin-top:12px;">Crear usuario</button>
    </div>

    <h3 style="margin-top:24px;">Usuarios registrados</h3>
    <div id="usersList" class="editor"></div>
  `;

  document.getElementById("btnCreateUser").onclick = createNewUser;

  loadUsersList();
}


// =======================================================
// 2) CREAR USUARIO (Firebase Auth + Firestore)
// =======================================================

async function createNewUser() {
  const email = document.getElementById("newUserEmail").value.trim();
  const pass = document.getElementById("newUserPass").value.trim();
  const name = document.getElementById("newUserName").value.trim();
  const role = document.getElementById("newUserRole").value;
  const limit = document.getElementById("newUserLimit").value;

  if (!validateEmail(email)) return alert("Correo inválido.");
  if (!validatePassword(pass)) return alert("Contraseña mínima de 6 caracteres.");

  try {
    // Crear en FireAuth
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    // Guardar en Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      name,
      role,
      limitDate: limit || "",
      status: "enabled",
      createdAt: serverTimestamp()
    });

    alert("Usuario creado correctamente.");
    openUsersPanel();

  } catch (e) {
    console.error("Error creando usuario", e);
    if (e.code === "auth/email-already-in-use") {
      alert("Este correo ya está registrado.");
    } else {
      alert("Error creando usuario.");
    }
  }
}


// =======================================================
// 3) LISTA DE USUARIOS
// =======================================================

async function loadUsersList() {
  const list = document.getElementById("usersList");
  list.innerHTML = "Cargando...";

  try {
    const snap = await getDocs(collection(db, "users"));
    list.innerHTML = "";

    if (snap.empty) {
      list.innerHTML = `<div class="muted">No hay usuarios registrados.</div>`;
      return;
    }

    snap.forEach((uDoc) => {
      const u = uDoc.data();

      const box = document.createElement("div");
      box.className = "card";
      box.style.marginBottom = "10px";

      box.innerHTML = `
        <div><strong>${escapeHtml(u.email)}</strong></div>
        <div class="small muted">${escapeHtml(u.name || "")}</div>
        <div class="small">Rol: ${escapeHtml(u.role)}</div>
        <div class="small">Estado: ${escapeHtml(u.status)}</div>
        <div class="small">Límite: ${escapeHtml(u.limitDate || "-")}</div>

        <div style="margin-top:10px; display:flex; gap:10px;">
          <button class="btn u_edit" data-id="${uDoc.id}">Editar</button>
          <button class="btn danger u_delete" data-id="${uDoc.id}">Eliminar</button>
        </div>
      `;

      list.appendChild(box);
    });

    // Asignar eventos
    list.querySelectorAll(".u_edit").forEach((btn) => {
      btn.onclick = () => editUser(btn.dataset.id);
    });

    list.querySelectorAll(".u_delete").forEach((btn) => {
      btn.onclick = () => deleteUser(btn.dataset.id);
    });

  } catch (e) {
    console.error("Error list users", e);
    list.innerHTML = `<div class="muted">Error cargando lista.</div>`;
  }
}


// =======================================================
// 4) EDITAR USUARIO
// =======================================================

async function editUser(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert("Usuario no encontrado.");

  const u = snap.data();

  const name = prompt("Nombre:", u.name);
  if (name === null) return;

  const role = prompt("Rol (admin/user):", u.role);
  if (role === null) return;

  const status = prompt("Estado (enabled/disabled):", u.status || "enabled");
  if (status === null) return;

  const limit = prompt("Fecha límite (YYYY-MM-DD):", u.limitDate || "");
  if (limit === null) return;

  await setDoc(ref, {
    ...u,
    name,
    role,
    status,
    limitDate: limit
  }, { merge: true });

  alert("Usuario actualizado.");
  openUsersPanel();
}


// =======================================================
// 5) ELIMINAR USUARIO (Firestore + Auth)
// =======================================================

async function deleteUser(uid) {
  if (!confirm("¿Eliminar usuario definitivamente?")) return;

  try {
    // Firestore
    await deleteDoc(doc(db, "users", uid));

    // Auth solo puede borrarse desde backend o Cloud Function.
    // Como estás en plan Spark, solo marcamos como disabled.
    // No existe deleteUser() client-side.
    alert("Usuario eliminado de Firestore.\n(No se puede borrar de Auth en plan Spark.)");

    openUsersPanel();

  } catch (e) {
    console.error("Error eliminando usuario", e);
    alert("Error eliminando usuario.");
  }
}


// =======================================================
// FIN PARTE 6/6
// =======================================================
