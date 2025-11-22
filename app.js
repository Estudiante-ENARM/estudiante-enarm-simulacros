// app.js - SOLO MODO ADMIN (secciones, exámenes, casos clínicos, preguntas, usuarios)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ===================== CONFIG FIREBASE =====================
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

// UID del administrador principal (cámbialo por el tuyo real)
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

// ===================== UTILIDADES =====================
const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");
const escapeHtml = (s) =>
  s == null
    ? ""
    : String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

let currentUser = null;        // {uid, email, role, estado, expiracion}
let currentSectionId = null;   // sección seleccionada
let currentSectionName = "";
let currentExamId = null;      // examen abierto en editor
let currentExamData = null;

// ===================== DOM ELEMENTOS =====================
const loginScreen = $("loginScreen");
const inputEmail = $("inputEmail");
const inputPassword = $("inputPassword");
const btnLogin = $("btnLogin");
const btnCancel = $("btnCancel");
const loginMessage = $("loginMessage");

const userInfo = $("userInfo");

const sectionsList = $("sectionsList");
const btnAddSection = $("btnAddSection");
const btnViewUsers = $("btnViewUsers");
const btnLogout = $("btnLogout");

const viewExams = $("viewExams");
const sectionTitle = $("sectionTitle");
const examsList = $("examsList");
const btnAddExam = $("btnAddExam");

const viewExamEditor = $("viewExamEditor");
const examEditorTitle = $("examEditorTitle");
const examEditorSubtitle = $("examEditorSubtitle");
const btnEditExamInfo = $("btnEditExamInfo");
const btnAddCase = $("btnAddCase");
const btnBackToExams = $("btnBackToExams");
const casesList = $("casesList");

const viewUsers = $("viewUsers");
const btnAddUser = $("btnAddUser");
const usersList = $("usersList");

const mainCountdownEl = $("mainCountdown");
const linkInstagram = $("link-instagram");
const linkWhatsApp = $("link-whatsapp");
const linkTelegram = $("link-telegram");
const linkTikTok = $("link-tiktok");

// ===================== COUNTDOWN ENARM =====================
function startCountdown() {
  if (!mainCountdownEl) return;
  const target = new Date("2026-09-23T00:00:00");
  const tick = () => {
    const now = new Date();
    let diff = Math.floor((target - now) / 1000);
    if (diff <= 0) {
      mainCountdownEl.textContent = "ENARM en curso";
      return;
    }
    const days = Math.floor(diff / 86400);
    diff -= days * 86400;
    const hrs = Math.floor(diff / 3600);
    diff -= hrs * 3600;
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    mainCountdownEl.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
  };
  tick();
  setInterval(tick, 1000);
}
startCountdown();

// ===================== AUTH =====================
if (btnLogin) {
  btnLogin.onclick = async () => {
    const email = (inputEmail.value || "").trim();
    const pass = (inputPassword.value || "").trim();
    if (!email || !pass) {
      loginMessage.textContent = "Ingrese correo y contraseña.";
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      loginMessage.textContent = "";
    } catch (e) {
      console.error("login error", e);
      loginMessage.textContent = "Credenciales inválidas.";
    }
  };
}

if (btnCancel) {
  btnCancel.onclick = () => {
    inputEmail.value = "";
    inputPassword.value = "";
    loginMessage.textContent = "";
  };
}

if (btnLogout) {
  btnLogout.onclick = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("logout error", e);
    }
  };
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    userInfo.textContent = "";
    showLoginUI();
    return;
  }

  try {
    const uRef = doc(db, "users", user.uid);
    const snap = await getDoc(uRef);

    let role = "user";
    let estado = "habilitado";
    let expiracion = null;
    let name = user.email;

    if (snap.exists()) {
      const d = snap.data();
      role = d.role || role;
      estado = d.estado || estado;
      expiracion = d.expiracion || null;
      name = d.name || name;
    }

    // Forzamos admin si es UID maestro
    if (user.uid === ADMIN_UID) role = "admin";

    // Checar expiración
    if (expiracion) {
      try {
        const today = new Date();
        const exp = new Date(expiracion);
        if (today > exp) {
          estado = "inhabilitado";
        }
      } catch (e) {
        console.warn("error parse expiracion", e);
      }
    }

    currentUser = { uid: user.uid, email: user.email, role, estado, expiracion, name };

    if (currentUser.estado === "inhabilitado") {
      alert("Tu acceso está inhabilitado o vencido.");
      await signOut(auth);
      return;
    }

    if (currentUser.role !== "admin") {
      alert("Esta página es solo para administradores.");
      await signOut(auth);
      return;
    }

    userInfo.textContent = `${name} (${currentUser.email}) [ADMIN]`;
    showAdminUI();
  } catch (e) {
    console.error("onAuthStateChanged error", e);
    loginMessage.textContent = "Error de acceso.";
    showLoginUI();
  }
});

// ===================== UI STATES =====================
function showLoginUI() {
  show(loginScreen);
  hide(viewExams);
  hide(viewExamEditor);
  hide(viewUsers);
}

function showAdminUI() {
  hide(loginScreen);
  show(viewExams);
  hide(viewExamEditor);
  hide(viewUsers);
  loadSections();
}

// ===================== SECCIONES =====================
async function loadSections() {
  sectionsList.innerHTML = "";
  currentSectionId = null;
  currentSectionName = "";
  sectionTitle.textContent = "Selecciona una sección";
  examsList.innerHTML = "";

  try {
    const snap = await getDocs(collection(db, "sections"));
    if (snap.empty) {
      const p = document.createElement("div");
      p.className = "small muted";
      p.textContent = "No hay secciones. Usa 'Agregar sección'.";
      sectionsList.appendChild(p);
      return;
    }

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const item = document.createElement("div");
      item.className = "sections-item";
      item.dataset.id = docSnap.id;
      item.innerHTML = `<span>${escapeHtml(d.name || "Sección")}</span>`;
      item.onclick = () => selectSection(docSnap.id, d.name || "Sección");
      sectionsList.appendChild(item);
    });
  } catch (e) {
    console.error("loadSections error", e);
    const p = document.createElement("div");
    p.className = "small muted";
    p.textContent = "Error cargando secciones.";
    sectionsList.appendChild(p);
  }
}

function markSectionActive(sectionId) {
  Array.from(sectionsList.children).forEach((node) => {
    if (!node.classList) return;
    node.classList.toggle("active", node.dataset.id === sectionId);
  });
}

async function selectSection(sectionId, name) {
  currentSectionId = sectionId;
  currentSectionName = name;
  markSectionActive(sectionId);
  hide(viewExamEditor);
  hide(viewUsers);
  show(viewExams);
  sectionTitle.textContent = `Sección: ${name}`;
  await loadExamsForSection(sectionId);
}

// Agregar sección
if (btnAddSection) {
  btnAddSection.onclick = async () => {
    const name = prompt("Nombre de la nueva sección:");
    if (!name) return;

    const orderStr = prompt("Orden (número, opcional):", "1");
    const order = Number(orderStr || "1") || 1;

    try {
      await addDoc(collection(db, "sections"), {
        name,
        order,
        createdAt: new Date().toISOString(),
      });
      alert("Sección creada.");
      await loadSections();
    } catch (e) {
      console.error("addSection error", e);
      alert("Error creando sección.");
    }
  };
}

// ===================== EXÁMENES =====================
async function loadExamsForSection(sectionId) {
  examsList.innerHTML = "";

  if (!sectionId) {
    const p = document.createElement("div");
    p.className = "small muted";
    p.textContent = "Selecciona una sección.";
    examsList.appendChild(p);
    return;
  }

  try {
    const q = query(collection(db, "exams"), where("sectionId", "==", sectionId));
    const snap = await getDocs(q);
    if (snap.empty) {
      const p = document.createElement("div");
      p.className = "small muted";
      p.textContent = "No hay exámenes en esta sección.";
      examsList.appendChild(p);
      return;
    }

    const exams = [];
    snap.forEach((docSnap) => {
      exams.push({ id: docSnap.id, ...docSnap.data() });
    });

    // ordenar por createdAt si existe, si no por title
    exams.sort((a, b) => {
      if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
        return String(a.createdAt).localeCompare(String(b.createdAt));
      }
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    exams.forEach((ex) => {
      const row = document.createElement("div");
      row.className = "examItem";

      const left = document.createElement("div");
      left.className = "examItem-left";
      left.innerHTML = `
        <div class="examItem-title">${escapeHtml(ex.title || "Examen")}</div>
        <div class="examItem-desc">
          ${escapeHtml(ex.description || "")}
          ${ex.duration ? ` · ${ex.duration} min` : ""}
        </div>
      `;

      const right = document.createElement("div");
      right.className = "examItem-right";
      right.innerHTML = `
        <div class="examItem-attempts">Intentos: 0/3</div>
      `;
      const btnOpen = document.createElement("button");
      btnOpen.className = "btn primary";
      btnOpen.textContent = "Abrir examen";
      btnOpen.onclick = () => openExamEditor(ex.id);

      const btnEditName = document.createElement("button");
      btnEditName.className = "btn";
      btnEditName.textContent = "Editar nombre";
      btnEditName.onclick = () => editExamInfo(ex.id, ex);

      right.appendChild(btnOpen);
      right.appendChild(btnEditName);

      row.appendChild(left);
      row.appendChild(right);

      examsList.appendChild(row);
    });
  } catch (e) {
    console.error("loadExamsForSection error", e);
    const p = document.createElement("div");
    p.className = "small muted";
    p.textContent = "Error cargando exámenes.";
    examsList.appendChild(p);
  }
}

// Agregar examen
if (btnAddExam) {
  btnAddExam.onclick = async () => {
    if (!currentSectionId) {
      alert("Selecciona primero una sección.");
      return;
    }
    const title = prompt("Nombre del examen:");
    if (!title) return;
    const description = prompt("Descripción (opcional):", "");
    const durationStr = prompt("Duración (minutos, opcional):", "45");
    const duration = Number(durationStr || "0") || 0;

    try {
      await addDoc(collection(db, "exams"), {
        sectionId: currentSectionId,
        title,
        description: description || "",
        duration,
        createdAt: new Date().toISOString(),
      });
      alert("Examen creado.");
      await loadExamsForSection(currentSectionId);
    } catch (e) {
      console.error("addExam error", e);
      alert("Error creando examen.");
    }
  };
}

// Editar info de examen (nombre, descripción, duración)
async function editExamInfo(examId, currentData = null) {
  try {
    let data = currentData;
    if (!data) {
      const snap = await getDoc(doc(db, "exams", examId));
      if (!snap.exists()) {
        alert("Examen no encontrado.");
        return;
      }
      data = snap.data();
    }

    const newTitle = prompt("Título del examen:", data.title || "");
    if (newTitle === null) return;
    const newDesc = prompt("Descripción:", data.description || "");
    if (newDesc === null) return;
    const durStr = prompt("Duración (minutos):", String(data.duration || 0));
    const newDur = Number(durStr || "0") || 0;

    await updateDoc(doc(db, "exams", examId), {
      title: newTitle,
      description: newDesc,
      duration: newDur,
    });
    alert("Datos de examen actualizados.");
    if (currentSectionId) await loadExamsForSection(currentSectionId);
    if (currentExamId === examId) await openExamEditor(examId);
  } catch (e) {
    console.error("editExamInfo error", e);
    alert("Error actualizando examen.");
  }
}

// ===================== EDITOR DE EXAMEN (CASOS + PREGUNTAS) =====================
async function openExamEditor(examId) {
  currentExamId = examId;
  currentExamData = null;
  hide(viewExams);
  hide(viewUsers);
  show(viewExamEditor);
  casesList.innerHTML = "Cargando...";

  try {
    const examSnap = await getDoc(doc(db, "exams", examId));
    if (!examSnap.exists()) {
      alert("Examen no encontrado.");
      show(viewExams);
      hide(viewExamEditor);
      return;
    }
    currentExamData = { id: examId, ...examSnap.data() };

    examEditorTitle.textContent = currentExamData.title || "Examen";
    examEditorSubtitle.textContent = `${currentSectionName || ""} · ${
      currentExamData.description || ""
    } ${currentExamData.duration ? `· ${currentExamData.duration} min` : ""}`;

    // Cargar casos
    const casesSnap = await getDocs(
      query(collection(db, "casosClinicos"), where("examId", "==", examId))
    );
    const casos = [];
    casesSnap.forEach((c) => casos.push({ id: c.id, ...c.data() }));

    // Cargar preguntas del examen
    const preguntasSnap = await getDocs(
      query(collection(db, "preguntas"), where("examId", "==", examId))
    );
    const preguntas = [];
    preguntasSnap.forEach((p) => preguntas.push({ id: p.id, ...p.data() }));

    // Ordenar casos por "orden" si existe
    casos.sort((a, b) => {
      const ao = a.orden ?? 0;
      const bo = b.orden ?? 0;
      return ao - bo;
    });

    renderCasesAndQuestions(casos, preguntas);
  } catch (e) {
    console.error("openExamEditor error", e);
    alert("Error cargando examen.");
  }
}

function renderCasesAndQuestions(casos, preguntas) {
  casesList.innerHTML = "";

  if (!casos.length) {
    const p = document.createElement("div");
    p.className = "small muted";
    p.textContent = "No hay casos clínicos. Usa 'Agregar caso clínico'.";
    casesList.appendChild(p);
    return;
  }

  casos.forEach((caso) => {
    const card = document.createElement("div");
    card.className = "card caseCard";

    const header = document.createElement("div");
    header.className = "caseHeader";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="caseTitle">${escapeHtml(caso.titulo || "Caso clínico")}</div>
      <div class="caseTexto">${escapeHtml(caso.texto || "")}</div>
      <div class="caseBadges">
        <span>Orden: ${caso.orden ?? 0}</span>
        <span>ID: ${caso.id}</span>
      </div>
    `;

    const right = document.createElement("div");
    right.className = "caseActions";
    const btnEditCase = document.createElement("button");
    btnEditCase.className = "btn";
    btnEditCase.textContent = "Editar caso";
    btnEditCase.onclick = () => editCase(caso);

    const btnDeleteCase = document.createElement("button");
    btnDeleteCase.className = "btn danger";
    btnDeleteCase.textContent = "Eliminar caso";
    btnDeleteCase.onclick = () => deleteCase(caso.id);

    const btnAddQuestion = document.createElement("button");
    btnAddQuestion.className = "btn primary";
    btnAddQuestion.textContent = "Agregar pregunta";
    btnAddQuestion.onclick = () => addQuestionToCase(caso.id);

    right.appendChild(btnEditCase);
    right.appendChild(btnDeleteCase);
    right.appendChild(btnAddQuestion);

    header.appendChild(left);
    header.appendChild(right);
    card.appendChild(header);

    // Preguntas de este caso
    const qList = document.createElement("div");
    qList.className = "questionList";

    const preguntasCaso = preguntas
      .filter((p) => p.casoId === caso.id)
      .sort((a, b) => {
        const ao = a.orden ?? 0;
        const bo = b.orden ?? 0;
        return ao - bo;
      });

    if (!preguntasCaso.length) {
      const p = document.createElement("div");
      p.className = "small muted";
      p.textContent = "Sin preguntas para este caso.";
      qList.appendChild(p);
    } else {
      preguntasCaso.forEach((q) => {
        const row = document.createElement("div");
        row.className = "questionRow";

        const qText = document.createElement("div");
        qText.className = "questionText";
        qText.textContent = q.pregunta || "";

        const qMeta = document.createElement("div");
        qMeta.className = "questionMeta";
        const opciones = q.opciones || [];
        const letraCorrecta =
          typeof q.correcta === "number" && opciones[q.correcta]
            ? String.fromCharCode(65 + q.correcta)
            : "?";
        qMeta.textContent = `Opciones: ${opciones.length} · Correcta: ${letraCorrecta}`;

        const qActions = document.createElement("div");
        qActions.className = "questionActions";

        const btnEditQ = document.createElement("button");
        btnEditQ.className = "btn";
        btnEditQ.textContent = "Editar";
        btnEditQ.onclick = () => editQuestion(q);

        const btnDelQ = document.createElement("button");
        btnDelQ.className = "btn danger";
        btnDelQ.textContent = "Eliminar";
        btnDelQ.onclick = () => deleteQuestion(q.id);

        qActions.appendChild(btnEditQ);
        qActions.appendChild(btnDelQ);

        row.appendChild(qText);
        row.appendChild(qMeta);
        row.appendChild(qActions);

        qList.appendChild(row);
      });
    }

    card.appendChild(qList);
    casesList.appendChild(card);
  });
}

// Botones del editor
if (btnBackToExams) {
  btnBackToExams.onclick = () => {
    hide(viewExamEditor);
    show(viewExams);
  };
}

if (btnEditExamInfo) {
  btnEditExamInfo.onclick = () => {
    if (!currentExamId || !currentExamData) {
      alert("No hay examen abierto.");
      return;
    }
    editExamInfo(currentExamId, currentExamData);
  };
}

if (btnAddCase) {
  btnAddCase.onclick = async () => {
    if (!currentExamId) {
      alert("No hay examen abierto.");
      return;
    }
    const titulo = prompt("Título del caso clínico:");
    if (!titulo) return;
    const texto = prompt("Texto del caso clínico (historia, evolución):", "");
    const ordenStr = prompt("Orden (número):", "1");
    const orden = Number(ordenStr || "1") || 1;

    try {
      await addDoc(collection(db, "casosClinicos"), {
        examId: currentExamId,
        titulo,
        texto,
        orden,
        createdAt: new Date().toISOString(),
      });
      alert("Caso clínico agregado.");
      await openExamEditor(currentExamId);
    } catch (e) {
      console.error("addCase error", e);
      alert("Error agregando caso clínico.");
    }
  };
}

// Editar caso clínico
async function editCase(caso) {
  const newTitulo = prompt("Título del caso:", caso.titulo || "");
  if (newTitulo === null) return;
  const newTexto = prompt("Texto del caso:", caso.texto || "");
  if (newTexto === null) return;
  const ordenStr = prompt("Orden (número):", String(caso.orden ?? 1));
  const newOrden = Number(ordenStr || "1") || 1;

  try {
    await updateDoc(doc(db, "casosClinicos", caso.id), {
      titulo: newTitulo,
      texto: newTexto,
      orden: newOrden,
    });
    alert("Caso actualizado.");
    await openExamEditor(currentExamId);
  } catch (e) {
    console.error("editCase error", e);
    alert("Error actualizando caso.");
  }
}

// Eliminar caso clínico
async function deleteCase(casoId) {
  if (!confirm("¿Eliminar este caso clínico y sus preguntas?")) return;
  try {
    // borrar preguntas del caso
    const qSnap = await getDocs(
      query(collection(db, "preguntas"), where("casoId", "==", casoId))
    );
    const batchDeletes = [];
    qSnap.forEach((docSnap) => {
      batchDeletes.push(deleteDoc(doc(db, "preguntas", docSnap.id)));
    });
    await Promise.all(batchDeletes);
    await deleteDoc(doc(db, "casosClinicos", casoId));
    alert("Caso y preguntas eliminados.");
    await openExamEditor(currentExamId);
  } catch (e) {
    console.error("deleteCase error", e);
    alert("Error eliminando caso.");
  }
}

// Agregar pregunta a un caso
async function addQuestionToCase(casoId) {
  if (!currentExamId) {
    alert("No hay examen abierto.");
    return;
  }
  const pregunta = prompt("Texto de la pregunta:");
  if (!pregunta) return;

  const opcionesStr = prompt(
    "Opciones separadas por || (ej. Apendicitis||Colecistitis||Pancreatitis||Gastritis):"
  );
  if (!opcionesStr) return;
  const opciones = opcionesStr
    .split("||")
    .map((s) => s.trim())
    .filter((s) => s);

  if (!opciones.length) {
    alert("Debes ingresar al menos una opción.");
    return;
  }

  const correctaStr = prompt(
    `Índice de la opción correcta (0 a ${opciones.length - 1}):`,
    "0"
  );
  const correcta = Number(correctaStr || "0") || 0;

  const justificacion = prompt("Justificación (opcional):", "") || "";
  const ordenStr = prompt("Orden (número):", "1");
  const orden = Number(ordenStr || "1") || 1;

  try {
    await addDoc(collection(db, "preguntas"), {
      examId: currentExamId,
      casoId,
      pregunta,
      opciones,
      correcta,
      justificacion,
      orden,
      createdAt: new Date().toISOString(),
    });
    alert("Pregunta agregada.");
    await openExamEditor(currentExamId);
  } catch (e) {
    console.error("addQuestion error", e);
    alert("Error agregando pregunta.");
  }
}

// Editar pregunta
async function editQuestion(q) {
  const newPreg = prompt("Texto de la pregunta:", q.pregunta || "");
  if (newPreg === null) return;
  const newOptsStr = prompt(
    "Opciones separadas por ||:",
    (q.opciones || []).join("||")
  );
  if (newOptsStr === null) return;
  const opciones = newOptsStr
    .split("||")
    .map((s) => s.trim())
    .filter((s) => s);
  if (!opciones.length) {
    alert("Debes dejar al menos una opción.");
    return;
  }
  const corrStr = prompt(
    `Índice de la opción correcta (0 a ${opciones.length - 1}):`,
    String(q.correcta ?? 0)
  );
  const correcta = Number(corrStr || "0") || 0;
  const just = prompt("Justificación:", q.justificacion || "");
  if (just === null) return;
  const ordStr = prompt("Orden (número):", String(q.orden ?? 1));
  const orden = Number(ordStr || "1") || 1;

  try {
    await updateDoc(doc(db, "preguntas", q.id), {
      pregunta: newPreg,
      opciones,
      correcta,
      justificacion: just,
      orden,
    });
    alert("Pregunta actualizada.");
    await openExamEditor(currentExamId);
  } catch (e) {
    console.error("editQuestion error", e);
    alert("Error actualizando pregunta.");
  }
}

// Eliminar pregunta
async function deleteQuestion(qid) {
  if (!confirm("¿Eliminar esta pregunta?")) return;
  try {
    await deleteDoc(doc(db, "preguntas", qid));
    alert("Pregunta eliminada.");
    await openExamEditor(currentExamId);
  } catch (e) {
    console.error("deleteQuestion error", e);
    alert("Error eliminando pregunta.");
  }
}

// ===================== USUARIOS (solo Firestore) =====================
if (btnViewUsers) {
  btnViewUsers.onclick = () => {
    hide(viewExams);
    hide(viewExamEditor);
    show(viewUsers);
    loadUsers();
  };
}

async function loadUsers() {
  usersList.innerHTML = "Cargando usuarios...";
  try {
    const snap = await getDocs(collection(db, "users"));
    if (snap.empty) {
      usersList.innerHTML =
        '<div class="small muted">No hay usuarios en Firestore.</div>';
      return;
    }

    usersList.innerHTML = "";
    snap.forEach((docSnap) => {
      const u = docSnap.data();
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "8px";

      card.innerHTML = `
        <div><strong>${escapeHtml(u.name || "")}</strong></div>
        <div class="small muted">${escapeHtml(u.email || docSnap.id)}</div>
        <div class="small muted">
          Rol: ${escapeHtml(u.role || "user")} ·
          Estado: ${escapeHtml(u.estado || "habilitado")} ·
          Expira: ${escapeHtml(u.expiracion || "-")}
        </div>
      `;

      const rowBtns = document.createElement("div");
      rowBtns.style.marginTop = "6px";
      rowBtns.style.display = "flex";
      rowBtns.style.gap = "6px";

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn";
      btnEdit.textContent = "Editar";
      btnEdit.onclick = () => editUser(docSnap.id, u);

      rowBtns.appendChild(btnEdit);
      card.appendChild(rowBtns);
      usersList.appendChild(card);
    });
  } catch (e) {
    console.error("loadUsers error", e);
    usersList.innerHTML =
      '<div class="small muted">Error cargando usuarios.</div>';
  }
}

// Agregar usuario en Firestore (NO crea usuario en Auth)
if (btnAddUser) {
  btnAddUser.onclick = async () => {
    const uid = prompt(
      "UID del usuario (debe coincidir con el UID en Auth si ya existe):"
    );
    if (!uid) return;
    const name = prompt("Nombre visible:");
    if (!name) return;
    const email = prompt("Correo:", "");
    const role = prompt("Rol (admin/user):", "user") || "user";
    const estado = prompt("Estado (habilitado/inhabilitado):", "habilitado") || "habilitado";
    const expiracion = prompt("Fecha límite (YYYY-MM-DD, opcional):", "") || "";

    try {
      await setDoc(doc(db, "users", uid), {
        name,
        email,
        role,
        estado,
        expiracion,
        createdAt: new Date().toISOString(),
      });
      alert("Usuario guardado en Firestore (no en Auth).");
      await loadUsers();
    } catch (e) {
      console.error("addUser error", e);
      alert("Error guardando usuario.");
    }
  };
}

async function editUser(uid, data) {
  const name = prompt("Nombre visible:", data.name || "");
  if (name === null) return;
  const email = prompt("Correo:", data.email || "");
  if (email === null) return;
  const role = prompt("Rol (admin/user):", data.role || "user");
  if (role === null) return;
  const estado = prompt("Estado (habilitado/inhabilitado):", data.estado || "habilitado");
  if (estado === null) return;
  const expiracion = prompt("Fecha límite (YYYY-MM-DD, opcional):", data.expiracion || "");
  if (expiracion === null) return;

  try {
    await updateDoc(doc(db, "users", uid), {
      name,
      email,
      role,
      estado,
      expiracion,
    });
    alert("Usuario actualizado.");
    await loadUsers();
  } catch (e) {
    console.error("editUser error", e);
    alert("Error actualizando usuario.");
  }
}

// ===================== INIT =====================
function init() {
  // Links de redes (puedes cambiarlos aquí)
  if (linkInstagram) linkInstagram.href = "https://instagram.com/";
  if (linkWhatsApp) linkWhatsApp.href = "https://wa.me/525515656316";
  if (linkTelegram) linkTelegram.href = "https://t.me/";
  if (linkTikTok) linkTikTok.href = "https://tiktok.com/";

  showLoginUI();
}

init();
