// app.js
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
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
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ===============================
// Utilidades DOM
// ===============================
const $ = (id) => document.getElementById(id);
const sectionsList      = $("sectionsList");

// screens
const loginScreen       = $("loginScreen");
const studentScreen     = $("studentScreen");
const examScreen        = $("examScreen");
const resultScreen      = $("resultScreen");
const adminExamsScreen  = $("adminExamsScreen");
const adminSectionsScreen = $("adminSectionsScreen");
const adminUsersScreen  = $("adminUsersScreen");
const adminIconsScreen  = $("adminIconsScreen");

// exam elements
const examsList         = $("examsList");
const examTitleEl       = $("examTitle");
const examForm          = $("examForm");
const examTimerEl       = $("examTimer");
const btnFinishExam     = $("btnFinishExam");

// student edit buttons
const editButtons       = $("editButtons");
const btnEditExams      = $("btnEditExams");
const btnSaveExams      = $("btnSaveExams");

// admin sidebar
const adminSidebar      = $("adminSidebar");
const adminPanelExams   = $("adminPanelExams");
const adminPanelSections= $("adminPanelSections");
const adminPanelUsers   = $("adminPanelUsers");
const adminPanelIcons   = $("adminPanelIcons");
const adminLogout       = $("adminLogout");

// admin exams
const adminExamsList    = $("adminExamsList");
const adminExamEditor   = $("adminExamEditor");
const btnAdminNewExam   = $("btnAdminNewExam");

// admin sections
const adminSectionsList = $("adminSectionsList");
const btnAdminNewSection = $("btnAdminNewSection");

// admin users
const adminUsersList    = $("adminUsersList");
const btnAdminNewUser   = $("btnAdminNewUser");

// admin icons
const iconInstagram     = $("iconInstagram");
const iconWhatsApp      = $("iconWhatsApp");
const iconTelegram      = $("iconTelegram");
const iconTikTok        = $("iconTikTok");
const btnSaveIcons      = $("btnSaveIcons");

// auth UI
const inputEmail        = $("inputEmail");
const inputPassword     = $("inputPassword");
const btnLogin          = $("btnLogin");
const btnCancel         = $("btnCancel");
const loginMessage      = $("loginMessage");
const userInfo          = $("userInfo");
const authButtons       = $("authButtons");

// socials
const linkInstagram     = $("link-instagram");
const linkWhatsApp      = $("link-whatsapp");
const linkTelegram      = $("link-telegram");
const linkTikTok        = $("link-tiktok");
const mainCountdownEl   = $("mainCountdown");

// ===============================
// Estado global
// ===============================
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

let currentUser = null;      // {uid, email, role, estado, expiracion}
let currentSectionId = null; // sección seleccionada
let currentExam = null;      // examen abierto (modo estudiante)
let examTimerInterval = null;
let examRemainingSeconds = 0;

// ===============================
// Helpers
// ===============================
function show(el){ if(!el) return; el.classList.remove("hidden"); }
function hide(el){ if(!el) return; el.classList.add("hidden"); }

function escapeHtml(s){
  if(s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function qid(){
  return "id_" + Math.random().toString(36).slice(2,9);
}

// ===============================
// Countdown ENARM
// ===============================
function startMainCountdown(){
  try {
    const target = new Date("2026-09-23T00:00:00");
    const el = mainCountdownEl;
    if (!el) return;
    function tick(){
      const now = new Date();
      let diff = Math.floor((target - now)/1000);
      if (diff <= 0) { el.textContent = "ENARM en curso"; return; }
      const days = Math.floor(diff/86400); diff -= days*86400;
      const hrs = Math.floor(diff/3600); diff -= hrs*3600;
      const mins = Math.floor(diff/60); const secs = diff%60;
      el.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }
    tick();
    setInterval(tick,1000);
  } catch(e){
    console.warn("countdown error", e);
  }
}
startMainCountdown();

// ===============================
// Carga de secciones
// ===============================
async function loadSections(){
  sectionsList.innerHTML = "";
  try {
    const qSec = query(collection(db,"sections"), orderBy("order","asc"));
    const snap = await getDocs(qSec);
    if (snap.empty) {
      // si no hay secciones, crear una por defecto (solo si admin)
      if (currentUser && currentUser.uid === ADMIN_UID) {
        await addDoc(collection(db,"sections"), {
          name: "Sección 1",
          order: 1,
          createdAt: new Date().toISOString()
        });
        return loadSections();
      } else {
        sectionsList.innerHTML = `<div class="small muted">Sin secciones</div>`;
        return;
      }
    }
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const el = document.createElement("div");
      el.className = "section-item";
      el.dataset.id = docSnap.id;
      el.textContent = d.name || d.nombre || "Sección";
      el.onclick = () => selectSection(docSnap.id);
      sectionsList.appendChild(el);
    });

    // seleccionar la primera si no hay actual
    if (!currentSectionId && snap.docs.length){
      selectSection(snap.docs[0].id);
    } else if (currentSectionId){
      markActiveSection(currentSectionId);
    }
  } catch(e){
    console.error("loadSections", e);
    sectionsList.innerHTML = `<div class="small muted">Error cargando secciones</div>`;
  }
}

function markActiveSection(id){
  Array.from(sectionsList.children).forEach(ch => {
    ch.classList.toggle("active", ch.dataset.id === id);
  });
}

async function selectSection(sectionId){
  currentSectionId = sectionId;
  markActiveSection(sectionId);

  // Modo estudiante: lista de exámenes
  if (currentUser && currentUser.role !== "admin") {
    await renderStudentExams();
  }

  // Modo admin: si estamos en panel de exámenes, recargar
  if (currentUser && currentUser.role === "admin" && !adminExamsScreen.classList.contains("hidden")) {
    await renderAdminExams();
  }
}

// ===============================
// MODO ESTUDIANTE: listar exámenes
// ===============================
async function renderStudentExams(){
  show(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  examsList.innerHTML = "";

  if (!currentSectionId) {
    examsList.innerHTML = `<div class="small muted">Selecciona una sección</div>`;
    return;
  }

  try {
    const qEx = query(
      collection(db,"exams"),
      where("sectionId","==", currentSectionId),
      orderBy("title")
    );
    const snap = await getDocs(qEx);
    if (snap.empty) {
      examsList.innerHTML = `<div class="small muted">No hay exámenes en esta sección</div>`;
      return;
    }

    snap.forEach(exDoc => {
      const data = exDoc.data();
      const examId = exDoc.id;
      const box = document.createElement("div");
      box.className = "examBox";
      box.dataset.eid = examId;

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="title">${escapeHtml(data.title || data.nombre || "Examen")}</div>
        <div class="meta small muted">
          ${escapeHtml(data.description || "")}
        </div>
      `;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.flexDirection = "column";
      right.style.alignItems = "flex-end";
      right.style.gap = "6px";
      right.innerHTML = `
        <div class="examAttempts" id="attempt_${examId}">0/3</div>
        <button class="btn primary">Abrir</button>
      `;

      const btnOpen = right.querySelector("button");
      btnOpen.onclick = () => openExamStudent(examId);

      box.appendChild(left);
      box.appendChild(right);
      examsList.appendChild(box);

      if (currentUser) {
        updateAttemptsDisplay(examId);
      }
    });

    hide(editButtons); // edición flotante solo para admin

  } catch(e){
    console.error("renderStudentExams", e);
    examsList.innerHTML = `<div class="small muted">Error cargando exámenes</div>`;
  }
}

// Intentos
async function updateAttemptsDisplay(examId){
  if (!currentUser) return;
  try {
    const attDocId = `${currentUser.uid}_${examId}`;
    const snap = await getDoc(doc(db,"attempts", attDocId));
    const used = snap.exists() ? (snap.data().used || 0) : 0;
    const el = document.getElementById(`attempt_${examId}`);
    if (el) el.textContent = `${used}/3`;
  } catch(e){
    console.warn("updateAttemptsDisplay", e);
  }
}

// ===============================
// Abrir examen (modo estudiante)
// ===============================
async function openExamStudent(examId){
  try {
    const exSnap = await getDoc(doc(db,"exams", examId));
    if (!exSnap.exists()) {
      alert("Examen no encontrado");
      return;
    }
    currentExam = { id: examId, ...exSnap.data() };

    // Obtener todos los casos clínicos del examen
    const casosQ = query(
      collection(db,"casosClinicos"),
      where("examId","==", examId),
      orderBy("orden","asc")
    );
    const casosSnap = await getDocs(casosQ);
    const casos = [];
    casosSnap.forEach(c => casos.push({ id: c.id, ...c.data() }));

    // Obtener todas las preguntas del examen
    const pregQ = query(
      collection(db,"preguntas"),
      where("examId","==", examId),
      orderBy("orden","asc")
    );
    const pregSnap = await getDocs(pregQ);
    const preguntas = [];
    pregSnap.forEach(p => preguntas.push({ id: p.id, ...p.data() }));

    renderExamScreenStudent(currentExam, casos, preguntas);

  } catch(e){
    console.error("openExamStudent", e);
    alert("Error al abrir examen");
  }
}

function renderExamScreenStudent(exam, casos, preguntas){
  hide(loginScreen);
  hide(studentScreen);
  hide(resultScreen);
  show(examScreen);

  examTitleEl.textContent = exam.title || exam.nombre || "Examen";
  examForm.innerHTML = "";

  // Tiempo = #preguntas * 75 segundos (mínimo 60)
  const totalQuestions = preguntas.length || 1;
  const totalSeconds = Math.max(60, totalQuestions * 75);
  startExamTimer(totalSeconds);

  // Renderizar por caso clínico
  casos.forEach(caso => {
    const contPreguntas = preguntas.filter(p => p.casoId === caso.id);

    contPreguntas.forEach((q, idx) => {
      const block = document.createElement("div");
      block.className = "questionBlock";
      block.dataset.qid = q.id;

      const caseHtml = `
        <div class="questionTitle">
          Caso clínico · ${escapeHtml(caso.titulo || "")}
        </div>
        <div class="caseText">
          ${escapeHtml(caso.texto || "")}
        </div>
        <div style="margin-top:8px"><strong>${escapeHtml(q.pregunta || "")}</strong></div>
      `;
      block.innerHTML = caseHtml;

      const optsDiv = document.createElement("div");
      optsDiv.className = "options";

      (q.opciones || []).forEach((opt, i) => {
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="radio" name="${q.id}" value="${i}" />
          ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}
        `;
        optsDiv.appendChild(label);
      });

      block.appendChild(optsDiv);
      examForm.appendChild(block);
    });
  });

  // botón finalizar
  btnFinishExam.onclick = async () => {
    if (!confirm("¿Deseas finalizar el examen? Contará como un intento.")) return;
    await finalizeExamAndGrade(exam.id);
  };
}

// TIMER
function startExamTimer(totalSeconds){
  clearInterval(examTimerInterval);
  examRemainingSeconds = totalSeconds;

  function tick(){
    if (examRemainingSeconds <= 0) {
      clearInterval(examTimerInterval);
      examTimerEl.textContent = "00:00";
      alert("Tiempo agotado. Se finalizará el examen.");
      btnFinishExam.click();
      return;
    }
    const mm = Math.floor(examRemainingSeconds / 60).toString().padStart(2,"0");
    const ss = (examRemainingSeconds % 60).toString().padStart(2,"0");
    examTimerEl.textContent = `${mm}:${ss}`;
    examRemainingSeconds--;
  }

  tick();
  examTimerInterval = setInterval(tick,1000);
}

// Finalizar y calificar
async function finalizeExamAndGrade(examId){
  if (!currentUser) {
    alert("Debes iniciar sesión para guardar intentos.");
    return;
  }

  try {
    // obtener respuestas seleccionadas en el DOM
    const answers = {};
    const inputs = examForm.querySelectorAll("input[type=radio]:checked");
    inputs.forEach(inp => {
      answers[inp.name] = Number(inp.value);
    });

    // obtener preguntas reales
    const pregQ = query(
      collection(db,"preguntas"),
      where("examId","==", examId),
      orderBy("orden","asc")
    );
    const pregSnap = await getDocs(pregQ);
    const preguntas = [];
    pregSnap.forEach(p => preguntas.push({ id: p.id, ...p.data() }));

    let correct = 0;
    preguntas.forEach(q => {
      const sel = answers[q.id];
      if (typeof sel === "number" && sel === (q.correcta || 0)) correct++;
    });

    const percent = preguntas.length
      ? Math.round((correct / preguntas.length) * 100)
      : 0;

    // registrar intento
    const attDocId = `${currentUser.uid}_${examId}`;
    const attRef = doc(db,"attempts", attDocId);
    const attSnap = await getDoc(attRef);
    let used = 0;
    if (attSnap.exists()) used = attSnap.data().used || 0;
    used++;
    await setDoc(attRef, {
      uid: currentUser.uid,
      examId,
      used,
      last: new Date().toISOString()
    });

    clearInterval(examTimerInterval);
    renderResultScreen(preguntas, answers, percent);
    // refrescar contador en lista de exámenes
    await renderStudentExams();

  } catch(e){
    console.error("finalizeExamAndGrade", e);
    alert("Error al finalizar examen");
  }
}

function renderResultScreen(preguntas, answers, percent){
  hide(examScreen);
  hide(studentScreen);
  hide(loginScreen);
  show(resultScreen);

  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  preguntas.forEach((q, idx) => {
    const userSel = answers[q.id];
    const correctIdx = q.correcta || 0;

    const block = document.createElement("div");
    block.className = "card";
    block.style.marginTop = "10px";

    const header = document.createElement("div");
    header.style.fontWeight = "700";
    header.textContent = `Pregunta ${idx + 1}`;
    block.appendChild(header);

    const text = document.createElement("div");
    text.style.marginTop = "6px";
    text.textContent = q.pregunta || "";
    block.appendChild(text);

    const opts = document.createElement("div");
    opts.style.marginTop = "6px";

    (q.opciones || []).forEach((opt, i) => {
      const line = document.createElement("div");
      let mark = "";
      if (i === correctIdx) mark = " (Correcta)";
      if (i === userSel && i !== correctIdx) mark = " (Tu elección)";
      line.textContent = `${String.fromCharCode(65 + i)}. ${opt}${mark}`;
      opts.appendChild(line);
    });

    block.appendChild(opts);

    const just = document.createElement("div");
    just.className = "small muted";
    just.style.marginTop = "6px";
    just.textContent = q.justificacion || "";
    block.appendChild(just);

    resultScreen.appendChild(block);
  });
}

// ===============================
// AUTH
// ===============================
btnLogin && (btnLogin.onclick = async () => {
  const email = (inputEmail.value || "").trim();
  const pass  = (inputPassword.value || "").trim();

  if (!email || !pass) {
    loginMessage.textContent = "Ingresa correo y contraseña";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginMessage.textContent = "";
  } catch(e){
    console.error("login", e);
    loginMessage.textContent = "Credenciales inválidas";
  }
});

btnCancel && (btnCancel.onclick = () => {
  inputEmail.value = "";
  inputPassword.value = "";
  loginMessage.textContent = "";
});

async function doLogout(){
  try {
    await signOut(auth);
  } catch(e){
    console.error("logout", e);
  }
}

adminLogout && (adminLogout.onclick = doLogout);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    userInfo.textContent = "";
    authButtons.innerHTML = "";
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    hide(adminSidebar);
    hide(adminExamsScreen);
    hide(adminSectionsScreen);
    hide(adminUsersScreen);
    hide(adminIconsScreen);
    show(loginScreen);
    await loadSections();
    return;
  }

  // Usuario autenticado
  try {
    // Traer doc en users/{uid}
    const uRef = doc(db,"users", user.uid);
    const uSnap = await getDoc(uRef);

    let data = {
      email: user.email,
      name: user.email,
      role: "user",
      estado: "habilitado",
      expiracion: "" // formato YYYY-MM-DD
    };

    if (uSnap.exists()) {
      const d = uSnap.data();
      data = {
        email: d.email || user.email,
        name: d.name || user.email,
        role: d.role || "user",
        estado: d.estado || "habilitado",
        expiracion: d.expiracion || ""
      };
    } else {
      // si no existe, crear registro básico
      await setDoc(uRef, {
        email: user.email,
        name: user.email,
        role: (user.uid === ADMIN_UID ? "admin" : "user"),
        estado: "habilitado",
        expiracion: "",
        createdAt: new Date().toISOString()
      });
      if (user.uid === ADMIN_UID) data.role = "admin";
    }

    currentUser = {
      uid: user.uid,
      email: data.email,
      role: (user.uid === ADMIN_UID ? "admin" : data.role),
      estado: data.estado,
      expiracion: data.expiracion
    };

    // Validar expiración
    if (currentUser.expiracion) {
      try {
        const now = new Date();
        const exp = new Date(currentUser.expiracion + "T23:59:59");
        if (now > exp) {
          await updateDoc(uRef, { estado: "inhabilitado" });
          alert("Acceso expirado. Contacta al administrador.");
          await signOut(auth);
          return;
        }
      } catch(e){
        console.warn("exp parse", e);
      }
    }

    if (currentUser.estado !== "habilitado") {
      alert("Usuario inhabilitado. Contacta al administrador.");
      await signOut(auth);
      return;
    }

    // UI común
    userInfo.textContent = `${currentUser.email} (${currentUser.role})`;
    authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
    $("btnLogoutTop").onclick = doLogout;

    await loadSections();
    await loadIconsConfig(); // carga links de redes desde Firestore

    if (currentUser.role === "admin") {
      showAdminUI();
    } else {
      showStudentUI();
    }

  } catch(e){
    console.error("onAuthStateChanged", e);
  }
});

async function showStudentUI(){
  hide(loginScreen);
  hide(adminSidebar);
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);
  show(studentScreen);
  await renderStudentExams();
}

async function showAdminUI(){
  hide(loginScreen);
  show(adminSidebar);
  // por defecto abrir panel de Exámenes admin
  showAdminPanel("exams");
  await renderAdminExams();
}

// ===============================
// ADMIN: navegación entre paneles
// ===============================
function showAdminPanel(panel){
  hide(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);

  if (panel === "exams") {
    show(adminExamsScreen);
  } else if (panel === "sections") {
    show(adminSectionsScreen);
  } else if (panel === "users") {
    show(adminUsersScreen);
  } else if (panel === "icons") {
    show(adminIconsScreen);
  }
}

adminPanelExams && (adminPanelExams.onclick = async () => {
  showAdminPanel("exams");
  await renderAdminExams();
});
adminPanelSections && (adminPanelSections.onclick = async () => {
  showAdminPanel("sections");
  await renderAdminSections();
});
adminPanelUsers && (adminPanelUsers.onclick = async () => {
  showAdminPanel("users");
  await renderAdminUsers();
});
adminPanelIcons && (adminPanelIcons.onclick = async () => {
  showAdminPanel("icons");
  await loadIconsConfig();
});

// ===============================
// ADMIN: Exámenes
// ===============================
btnAdminNewExam && (btnAdminNewExam.onclick = async () => {
  if (!currentSectionId) {
    alert("Selecciona primero una sección en la barra izquierda.");
    return;
  }
  const title = prompt("Título del examen:");
  if (!title) return;
  const description = prompt("Descripción (ej. 30 reactivos):") || "";
  try {
    await addDoc(collection(db,"exams"), {
      sectionId: currentSectionId,
      title,
      description,
      createdAt: new Date().toISOString()
    });
    alert("Examen creado");
    await renderAdminExams();
  } catch(e){
    console.error("btnAdminNewExam", e);
    alert("Error creando examen");
  }
});

async function renderAdminExams(){
  adminExamsList.innerHTML = "";
  adminExamEditor.innerHTML = "";
  hide(adminExamEditor);

  if (!currentSectionId) {
    adminExamsList.innerHTML = `<div class="small muted">Selecciona una sección</div>`;
    return;
  }

  try {
    const qEx = query(
      collection(db,"exams"),
      where("sectionId","==", currentSectionId),
      orderBy("title")
    );
    const snap = await getDocs(qEx);
    if (snap.empty) {
      adminExamsList.innerHTML = `<div class="small muted">No hay exámenes en esta sección</div>`;
      return;
    }

    snap.forEach(exDoc => {
      const d = exDoc.data();
      const card = document.createElement("div");
      card.className = "examBox";
      card.dataset.eid = exDoc.id;

      card.innerHTML = `
        <div>
          <div class="title">${escapeHtml(d.title || d.nombre || "Examen")}</div>
          <div class="meta small muted">${escapeHtml(d.description || "")}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
          <button class="btn" data-edit="${exDoc.id}">Editar</button>
          <button class="btn danger" data-del="${exDoc.id}">Eliminar</button>
        </div>
      `;
      adminExamsList.appendChild(card);
    });

    adminExamsList.querySelectorAll("[data-edit]").forEach(btn => {
      btn.onclick = () => openAdminExamEditor(btn.getAttribute("data-edit"));
    });
    adminExamsList.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("¿Eliminar este examen? (no elimina preguntas ni casos asociados)")) return;
        try {
          await updateDoc(doc(db,"exams", id), { deleted: true });
          alert("Marcado como eliminado");
          await renderAdminExams();
        } catch(e){
          console.error("del exam", e);
          alert("Error al eliminar");
        }
      };
    });

  } catch(e){
    console.error("renderAdminExams", e);
    adminExamsList.innerHTML = `<div class="small muted">Error cargando exámenes</div>`;
  }
}

// Editor de un examen (casos + preguntas)
async function openAdminExamEditor(examId){
  try {
    const exSnap = await getDoc(doc(db,"exams", examId));
    if (!exSnap.exists()) {
      alert("Examen no encontrado");
      return;
    }
    const exam = { id: examId, ...exSnap.data() };

    // cargar casos
    const casosQ = query(
      collection(db,"casosClinicos"),
      where("examId","==", examId),
      orderBy("orden","asc")
    );
    const casosSnap = await getDocs(casosQ);
    const casos = [];
    casosSnap.forEach(c => casos.push({ id:c.id, ...c.data() }));

    // cargar preguntas
    const pregQ = query(
      collection(db,"preguntas"),
      where("examId","==", examId),
      orderBy("orden","asc")
    );
    const pregSnap = await getDocs(pregQ);
    const preguntas = [];
    pregSnap.forEach(p => preguntas.push({ id:p.id, ...p.data() }));

    renderAdminExamEditor(exam, casos, preguntas);

  } catch(e){
    console.error("openAdminExamEditor", e);
    alert("Error cargando editor");
  }
}

function renderAdminExamEditor(exam, casos, preguntas){
  adminExamEditor.innerHTML = "";
  show(adminExamEditor);

  const wrap = document.createElement("div");
  wrap.className = "editor";

  // Encabezado del examen
  wrap.innerHTML = `
    <div class="card">
      <h3>Editar examen</h3>
      <label>Título</label>
      <input id="ed_exam_title" value="${escapeHtml(exam.title || exam.nombre || "")}" />
      <label>Descripción</label>
      <input id="ed_exam_desc" value="${escapeHtml(exam.description || "")}" />
      <div style="margin-top:8px;">
        <button id="btnSaveExamHeader" class="btn primary">Guardar encabezado</button>
      </div>
    </div>
    <div class="card">
      <h4>Casos clínicos y preguntas</h4>
      <p class="small muted">Cada caso clínico puede tener varias preguntas debajo.</p>
    </div>
  `;

  const list = document.createElement("div");
  wrap.appendChild(list);

  // Render de casos + preguntas
  casos.forEach(caso => {
    const casoCard = document.createElement("div");
    casoCard.className = "card";
    casoCard.dataset.casoId = caso.id;

    casoCard.innerHTML = `
      <h4>Caso clínico</h4>
      <label>Título</label>
      <input class="ed_caso_titulo" value="${escapeHtml(caso.titulo || "")}" />
      <label>Texto</label>
      <textarea class="ed_caso_texto" rows="3">${escapeHtml(caso.texto || "")}</textarea>
      <label>Orden</label>
      <input class="ed_caso_orden" type="number" value="${caso.orden || 1}" />
      <div style="margin-top:6px;">
        <button class="btn smallBtn btnSaveCase">Guardar caso</button>
        <button class="btn danger smallBtn btnDelCase">Eliminar caso</button>
      </div>
      <hr style="margin:10px 0;">
      <div class="small muted">Preguntas de este caso:</div>
    `;

    // preguntas de este caso
    const contPreg = document.createElement("div");
    const pregCaso = preguntas.filter(p => p.casoId === caso.id);
    pregCaso.forEach(p => {
      const pregCard = document.createElement("div");
      pregCard.className = "card";
      pregCard.style.marginTop = "8px";
      pregCard.dataset.pregId = p.id;

      const opts = p.opciones || [];
      pregCard.innerHTML = `
        <label>Pregunta</label>
        <input class="ed_preg_texto" value="${escapeHtml(p.pregunta || "")}" />
        <label>Opción A</label>
        <input class="ed_preg_opt0" value="${escapeHtml(opts[0] || "")}" />
        <label>Opción B</label>
        <input class="ed_preg_opt1" value="${escapeHtml(opts[1] || "")}" />
        <label>Opción C</label>
        <input class="ed_preg_opt2" value="${escapeHtml(opts[2] || "")}" />
        <label>Opción D</label>
        <input class="ed_preg_opt3" value="${escapeHtml(opts[3] || "")}" />
        <label>Índice correcto (0-3)</label>
        <input class="ed_preg_correcta" type="number" min="0" max="3" value="${p.correcta || 0}" />
        <label>Justificación</label>
        <textarea class="ed_preg_just" rows="2">${escapeHtml(p.justificacion || "")}</textarea>
        <label>Orden</label>
        <input class="ed_preg_orden" type="number" value="${p.orden || 1}" />
        <div style="margin-top:6px;">
          <button class="btn smallBtn btnSavePreg">Guardar pregunta</button>
          <button class="btn danger smallBtn btnDelPreg">Eliminar pregunta</button>
        </div>
      `;
      contPreg.appendChild(pregCard);
    });

    // formulario para agregar nueva pregunta a este caso
    const newPregCard = document.createElement("div");
    newPregCard.className = "card";
    newPregCard.style.marginTop = "8px";
    newPregCard.innerHTML = `
      <h4>Nueva pregunta para este caso</h4>
      <label>Pregunta</label>
      <input class="new_preg_texto" />
      <label>Opción A</label>
      <input class="new_preg_opt0" />
      <label>Opción B</label>
      <input class="new_preg_opt1" />
      <label>Opción C</label>
      <input class="new_preg_opt2" />
      <label>Opción D</label>
      <input class="new_preg_opt3" />
      <label>Índice correcto (0-3)</label>
      <input class="new_preg_correcta" type="number" min="0" max="3" value="0" />
      <label>Justificación</label>
      <textarea class="new_preg_just" rows="2"></textarea>
      <label>Orden</label>
      <input class="new_preg_orden" type="number" value="${pregCaso.length + 1}" />
      <div style="margin-top:6px;">
        <button class="btn primary smallBtn btnAddPreg">Agregar pregunta</button>
      </div>
    `;
    contPreg.appendChild(newPregCard);

    casoCard.appendChild(contPreg);
    list.appendChild(casoCard);
  });

  // Card para agregar nuevo caso
  const newCaseCard = document.createElement("div");
  newCaseCard.className = "card";
  newCaseCard.style.marginTop = "12px";
  newCaseCard.innerHTML = `
    <h3>Nuevo caso clínico</h3>
    <label>Título</label>
    <input id="new_caso_titulo" />
    <label>Texto</label>
    <textarea id="new_caso_texto" rows="3"></textarea>
    <label>Orden</label>
    <input id="new_caso_orden" type="number" value="${casos.length + 1}" />
    <div style="margin-top:8px;">
      <button id="btnAddCaso" class="btn primary">Agregar caso</button>
    </div>
  `;
  wrap.appendChild(newCaseCard);

  adminExamEditor.appendChild(wrap);

  // Handlers encabezado
  $("btnSaveExamHeader").onclick = async () => {
    const title = $("ed_exam_title").value.trim();
    const desc  = $("ed_exam_desc").value.trim();
    try {
      await updateDoc(doc(db,"exams", exam.id), {
        title,
        description: desc
      });
      alert("Examen actualizado");
      await renderAdminExams();
    } catch(e){
      console.error("save exam header", e);
      alert("Error guardando examen");
    }
  };

  // Handlers casos
  list.querySelectorAll("[data-caso-id]").forEach(card => {
    const casoId = card.dataset.casoId;
    const btnSave = card.querySelector(".btnSaveCase");
    const btnDel  = card.querySelector(".btnDelCase");

    btnSave.onclick = async () => {
      const titulo = card.querySelector(".ed_caso_titulo").value.trim();
      const texto  = card.querySelector(".ed_caso_texto").value.trim();
      const orden  = Number(card.querySelector(".ed_caso_orden").value || 1);
      try {
        await updateDoc(doc(db,"casosClinicos", casoId), {
          titulo,
          texto,
          orden
        });
        alert("Caso guardado");
        openAdminExamEditor(exam.id);
      } catch(e){
        console.error("save caso", e);
        alert("Error guardando caso");
      }
    };

    btnDel.onclick = async () => {
      if (!confirm("¿Eliminar este caso y sus preguntas?")) return;
      try {
        // eliminar preguntas de ese caso
        const pregCaso = preguntas.filter(p => p.casoId === casoId);
        for (const p of pregCaso) {
          await deleteDoc(doc(db,"preguntas", p.id));
        }
        // eliminar caso
        await deleteDoc(doc(db,"casosClinicos", casoId));
        alert("Caso eliminado");
        openAdminExamEditor(exam.id);
      } catch(e){
        console.error("del caso", e);
        alert("Error eliminando caso");
      }
    };

    // preguntas de ese caso
    card.querySelectorAll("[data-preg-id]").forEach(pCard => {
      const pregId = pCard.dataset.pregId;
      const bSave = pCard.querySelector(".btnSavePreg");
      const bDel  = pCard.querySelector(".btnDelPreg");

      bSave.onclick = async () => {
        const pregunta = pCard.querySelector(".ed_preg_texto").value.trim();
        const opt0 = pCard.querySelector(".ed_preg_opt0").value.trim();
        const opt1 = pCard.querySelector(".ed_preg_opt1").value.trim();
        const opt2 = pCard.querySelector(".ed_preg_opt2").value.trim();
        const opt3 = pCard.querySelector(".ed_preg_opt3").value.trim();
        const correcta = Number(pCard.querySelector(".ed_preg_correcta").value || 0);
        const just = pCard.querySelector(".ed_preg_just").value.trim();
        const orden = Number(pCard.querySelector(".ed_preg_orden").value || 1);
        const opciones = [opt0,opt1,opt2,opt3].filter(x=>x!=="");
        if (!pregunta || opciones.length === 0) {
          alert("Pregunta y al menos una opción son requeridos");
          return;
        }
        try {
          await updateDoc(doc(db,"preguntas", pregId), {
            pregunta,
            opciones,
            correcta,
            justificacion: just,
            orden
          });
          alert("Pregunta guardada");
          openAdminExamEditor(exam.id);
        } catch(e){
          console.error("save preg", e);
          alert("Error guardando pregunta");
        }
      };

      bDel.onclick = async () => {
        if (!confirm("¿Eliminar esta pregunta?")) return;
        try {
          await deleteDoc(doc(db,"preguntas", pregId));
          alert("Pregunta eliminada");
          openAdminExamEditor(exam.id);
        } catch(e){
          console.error("del preg", e);
          alert("Error eliminando pregunta");
        }
      };
    });

    // agregar nueva pregunta a ese caso
    const btnAdd = card.querySelector(".btnAddPreg");
    btnAdd.onclick = async () => {
      const pCard = card.querySelector(".card:last-child"); // el bloque de nueva pregunta
      const pregunta = pCard.querySelector(".new_preg_texto").value.trim();
      const opt0 = pCard.querySelector(".new_preg_opt0").value.trim();
      const opt1 = pCard.querySelector(".new_preg_opt1").value.trim();
      const opt2 = pCard.querySelector(".new_preg_opt2").value.trim();
      const opt3 = pCard.querySelector(".new_preg_opt3").value.trim();
      const correcta = Number(pCard.querySelector(".new_preg_correcta").value || 0);
      const just = pCard.querySelector(".new_preg_just").value.trim();
      const orden = Number(pCard.querySelector(".new_preg_orden").value || 1);
      const opciones = [opt0,opt1,opt2,opt3].filter(x=>x!=="");
      if (!pregunta || opciones.length === 0) {
        alert("Pregunta y al menos una opción son requeridos");
        return;
      }
      try {
        await addDoc(collection(db,"preguntas"), {
          examId: exam.id,
          casoId: casoId,
          pregunta,
          opciones,
          correcta,
          justificacion: just,
          orden,
          createdAt: new Date().toISOString()
        });
        alert("Pregunta agregada");
        openAdminExamEditor(exam.id);
      } catch(e){
        console.error("add preg", e);
        alert("Error agregando pregunta");
      }
    };
  });

  // agregar caso
  $("btnAddCaso").onclick = async () => {
    const titulo = $("new_caso_titulo").value.trim();
    const texto  = $("new_caso_texto").value.trim();
    const orden  = Number($("new_caso_orden").value || 1);
    if (!titulo || !texto) {
      alert("Título y texto son requeridos");
      return;
    }
    try {
      await addDoc(collection(db,"casosClinicos"), {
        examId: exam.id,
        titulo,
        texto,
        orden,
        createdAt: new Date().toISOString()
      });
      alert("Caso agregado");
      openAdminExamEditor(exam.id);
    } catch(e){
      console.error("add caso", e);
      alert("Error agregando caso");
    }
  };
}

// ===============================
// ADMIN: Secciones
// ===============================
btnAdminNewSection && (btnAdminNewSection.onclick = async () => {
  const name = prompt("Nombre de la sección:");
  if (!name) return;
  const order = Number(prompt("Orden (número entero):","1") || "1");
  try {
    await addDoc(collection(db,"sections"), {
      name,
      order,
      createdAt: new Date().toISOString()
    });
    alert("Sección creada");
    await loadSections();
    await renderAdminSections();
  } catch(e){
    console.error("new section", e);
    alert("Error creando sección");
  }
});

async function renderAdminSections(){
  adminSectionsList.innerHTML = "";
  try {
    const qSec = query(collection(db,"sections"), orderBy("order","asc"));
    const snap = await getDocs(qSec);
    if (snap.empty) {
      adminSectionsList.innerHTML = `<div class="small muted">Sin secciones</div>`;
      return;
    }
    snap.forEach(secDoc => {
      const d = secDoc.data();
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.sid = secDoc.id;
      card.innerHTML = `
        <div class="row" style="justify-content:space-between; align-items:center;">
          <div>
            <strong>${escapeHtml(d.name || d.nombre || "")}</strong>
            <div class="small muted">Orden: ${d.order || 1}</div>
          </div>
          <div>
            <button class="btn btnEditSec">Editar</button>
            <button class="btn danger btnDelSec">Eliminar</button>
          </div>
        </div>
      `;
      adminSectionsList.appendChild(card);

      const btnEdit = card.querySelector(".btnEditSec");
      const btnDel  = card.querySelector(".btnDelSec");

      btnEdit.onclick = async () => {
        const newName = prompt("Nuevo nombre:", d.name || d.nombre || "");
        if (!newName) return;
        const newOrder = Number(prompt("Nuevo orden:", d.order || 1) || 1);
        try {
          await updateDoc(doc(db,"sections", secDoc.id), {
            name: newName,
            order: newOrder
          });
          alert("Sección actualizada");
          await loadSections();
          await renderAdminSections();
        } catch(e){
          console.error("edit sec", e);
          alert("Error actualizando sección");
        }
      };

      btnDel.onclick = async () => {
        if (!confirm("¿Eliminar esta sección? No elimina exámenes asociados.")) return;
        try {
          await updateDoc(doc(db,"sections", secDoc.id), { deleted:true });
          alert("Sección marcada como eliminada");
          await loadSections();
          await renderAdminSections();
        } catch(e){
          console.error("del sec", e);
          alert("Error eliminando sección");
        }
      };
    });
  } catch(e){
    console.error("renderAdminSections", e);
    adminSectionsList.innerHTML = `<div class="small muted">Error cargando secciones</div>`;
  }
}

// ===============================
// ADMIN: Usuarios
// ===============================
async function renderAdminUsers(){
  adminUsersList.innerHTML = "Cargando usuarios...";
  try {
    const snap = await getDocs(collection(db,"users"));
    adminUsersList.innerHTML = "";
    if (snap.empty) {
      adminUsersList.innerHTML = `<div class="small muted">Sin usuarios</div>`;
      return;
    }
    snap.forEach(uDoc => {
      const d = uDoc.data();
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "8px";
      card.innerHTML = `
        <div class="row" style="justify-content:space-between; gap:10px;">
          <div>
            <strong>${escapeHtml(d.email || uDoc.id)}</strong>
            <div class="small muted">
              ${escapeHtml(d.name || "")} · rol: ${escapeHtml(d.role || "user")}
            </div>
            <div class="small muted">
              Estado: ${escapeHtml(d.estado || "habilitado")} · Expira: ${escapeHtml(d.expiracion || "—")}
            </div>
          </div>
          <div>
            <button class="btn btnEditUser" data-uid="${uDoc.id}">Editar</button>
          </div>
        </div>
      `;
      adminUsersList.appendChild(card);
    });

    adminUsersList.querySelectorAll(".btnEditUser").forEach(btn => {
      btn.onclick = async () => {
        const uid = btn.getAttribute("data-uid");
        const uRef = doc(db,"users", uid);
        const uSnap = await getDoc(uRef);
        if (!uSnap.exists()) {
          alert("Usuario no encontrado");
          return;
        }
        const d = uSnap.data();
        const name = prompt("Nombre visible:", d.name || "");
        if (name === null) return;
        const role = prompt("Rol (admin/user):", d.role || "user");
        if (role === null) return;
        const estado = prompt("Estado (habilitado/inhabilitado):", d.estado || "habilitado");
        if (estado === null) return;
        const expiracion = prompt("Fecha límite (YYYY-MM-DD, vacía para sin límite):", d.expiracion || "");
        if (expiracion === null) return;

        await setDoc(uRef, {
          ...d,
          name,
          role,
          estado,
          expiracion
        }, { merge:true });

        alert("Usuario actualizado");
        renderAdminUsers();
      };
    });

  } catch(e){
    console.error("renderAdminUsers", e);
    adminUsersList.innerHTML = `<div class="small muted">Error cargando usuarios</div>`;
  }
}

// Nota importante: crear usuarios directamente en Auth desde el navegador
// como administrador NO es seguro sin backend y además cambiaría tu sesión.
// Por eso aquí solo editamos el documento de Firestore.

// ===============================
// ADMIN: Íconos (redes sociales)
// ===============================
async function loadIconsConfig(){
  try {
    const cfgRef = doc(db,"config","icons");
    const snap = await getDoc(cfgRef);
    if (snap.exists()) {
      const d = snap.data();
      if (iconInstagram) iconInstagram.value = d.instagram || "";
      if (iconWhatsApp) iconWhatsApp.value = d.whatsapp || "";
      if (iconTelegram) iconTelegram.value = d.telegram || "";
      if (iconTikTok) iconTikTok.value = d.tiktok || "";

      if (linkInstagram) linkInstagram.href = d.instagram || "#";
      if (linkWhatsApp) linkWhatsApp.href = d.whatsapp || "#";
      if (linkTelegram) linkTelegram.href = d.telegram || "#";
      if (linkTikTok) linkTikTok.href = d.tiktok || "#";
    }
  } catch(e){
    console.error("loadIconsConfig", e);
  }
}

btnSaveIcons && (btnSaveIcons.onclick = async () => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Solo el administrador puede guardar íconos.");
    return;
  }
  try {
    const data = {
      instagram: iconInstagram.value.trim(),
      whatsapp: iconWhatsApp.value.trim(),
      telegram: iconTelegram.value.trim(),
      tiktok: iconTikTok.value.trim()
    };
    await setDoc(doc(db,"config","icons"), data, { merge:true });
    await loadIconsConfig();
    alert("Íconos guardados");
  } catch(e){
    console.error("saveIcons", e);
    alert("Error guardando íconos");
  }
});

// ===============================
// INIT
// ===============================
async function init() {
  hide(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  hide(adminSidebar);
  hide(adminExamsScreen);
  hide(adminSectionsScreen);
  hide(adminUsersScreen);
  hide(adminIconsScreen);
  await loadSections();
}
init().catch(e => console.error("init error", e));
