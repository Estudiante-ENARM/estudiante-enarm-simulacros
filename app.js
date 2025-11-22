// app.js - Versión nueva compatible con:
// sections / exams / casosClinicos / preguntas / users / cambios
// Estructura ENARM: sección -> examen -> casos clínicos -> preguntas

// ---------------------- IMPORTS FIREBASE (modular CDN) ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------------------- CONFIG FIREBASE ----------------------
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------- CONSTANTES ----------------------
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

// ---------------------- SELECTORES DOM ----------------------
const $  = (id) => document.getElementById(id);

// layout
const sectionsList    = $("sectionsList");
const loginScreen     = $("loginScreen");
const studentScreen   = $("studentScreen");
const examsList       = $("examsList");
const examScreen      = $("examScreen");
const resultScreen    = $("resultScreen");
const adminSidebar    = $("adminSidebar");

// auth / topbar
const inputEmail      = $("inputEmail");
const inputPassword   = $("inputPassword");
const btnLogin        = $("btnLogin");
const btnCancel       = $("btnCancel");
const loginMessage    = $("loginMessage");
const userInfo        = $("userInfo");
const authButtons     = $("authButtons");

// exam screen
const examTitle       = $("examTitle");
const examTimerEl     = $("examTimer");
const examForm        = $("examForm");
const btnFinishExam   = $("btnFinishExam");

// edit floating buttons (exams list)
const editButtons     = $("editButtons");
const btnEdit         = $("btnEdit");
const btnSave         = $("btnSave");

// edit floating buttons (preguntas dentro del examen)
const editExamButtons = $("editExamButtons");
const btnEditExam     = $("btnEditExam");
const btnSaveExam     = $("btnSaveExam");

// admin buttons
const adminAddSection     = $("adminAddSection");
const adminAddExam        = $("adminAddExam");
const adminEditQuestions  = $("adminEditQuestions");
const adminUsers          = $("adminUsers");
const adminLinks          = $("adminLinks");
const adminLogout         = $("adminLogout");

// socials / countdown
const mainCountdownEl = $("mainCountdown");
const linkInstagram   = $("link-instagram");
const linkWhatsApp    = $("link-whatsapp");
const linkTelegram    = $("link-telegram");
const linkTikTok      = $("link-tiktok");

// ---------------------- HELPERS ----------------------
function show(el){ if(el) el.classList.remove("hidden"); }
function hide(el){ if(el) el.classList.add("hidden"); }
function esc(s){
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}
function qid(){ return "id_" + Math.random().toString(36).slice(2,9); }

// ---------------------- ESTADO GLOBAL ----------------------
let currentUser      = null;  // {uid,email,role}
let currentSectionId = null;
let currentExam      = null;  // {id, title,...}
let examTimerInterval = null;
let examRemainingSeconds = 0;

// Para modo edición (exámenes y preguntas)
let draft = {
  exams: {},
  questions: {},
  newExams: []
};

// ---------------------- COUNTDOWN ----------------------
function startMainCountdown(){
  if (!mainCountdownEl) return;
  try {
    const target = new Date("2026-09-23T00:00:00");
    function tick(){
      const now = new Date();
      let diff = Math.floor((target - now)/1000);
      if (diff <= 0) {
        mainCountdownEl.textContent = "Evento iniciado";
        return;
      }
      const days = Math.floor(diff/86400); diff -= days*86400;
      const hrs  = Math.floor(diff/3600);  diff -= hrs*3600;
      const mins = Math.floor(diff/60);    const secs = diff%60;
      mainCountdownEl.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }
    tick();
    setInterval(tick,1000);
  } catch(e){
    console.warn("countdown", e);
  }
}
startMainCountdown();

// ---------------------- LOAD SECTIONS ----------------------
async function loadSections(){
  sectionsList.innerHTML = "";
  try {
    // Leemos todas las secciones; las ordenamos por 'order' en JS para no necesitar índice compuesto
    const snap = await getDocs(collection(db,"sections"));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));

    if (arr.length === 0) {
      sectionsList.innerHTML = `<div class="muted">Sin secciones</div>`;
      return;
    }

    arr.sort((a,b) => (a.order || 0) - (b.order || 0));

    arr.forEach(sec => {
      const el = document.createElement("div");
      el.className = "section-item";
      el.dataset.id = sec.id;
      el.textContent = sec.name || "Sección";
      el.onclick = () => selectSection(sec.id);
      sectionsList.appendChild(el);
    });

    if (!currentSectionId) {
      selectSection(arr[0].id);
    }

  } catch(e){
    console.error("loadSections", e);
    sectionsList.innerHTML = `<div class="muted">Error cargando secciones</div>`;
  }
}

async function selectSection(sectionId){
  currentSectionId = sectionId;
  // activar visual
  Array.from(sectionsList.children).forEach(ch => {
    ch.classList.toggle("active", ch.dataset.id === sectionId);
  });
  hide(loginScreen);
  show(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  await renderExamsForSection(sectionId);
}

// ---------------------- RENDER EXAMS LIST ----------------------
async function renderExamsForSection(sectionId){
  examsList.innerHTML = "";
  if (!sectionId) {
    examsList.innerHTML = `<div class="muted">Selecciona una sección</div>`;
    return;
  }
  try {
    const qEx = query(collection(db,"exams"), where("sectionId","==", sectionId));
    const snap = await getDocs(qEx);
    const exams = [];
    snap.forEach(d => exams.push({ id:d.id, ...d.data() }));

    if (exams.length === 0) {
      examsList.innerHTML = `<div class="muted">No hay exámenes en esta sección</div>`;
      hide(editButtons);
      return;
    }

    // limpiar draft
    draft.exams = {};
    draft.newExams = [];

    // Pintamos tarjetas estilo A
    exams.forEach(ex => {
      draft.exams[ex.id] = { title: ex.title || "", deleted:false, new:false };

      const card = document.createElement("div");
      card.className = "examBox";
      card.dataset.eid = ex.id;

      const left = document.createElement("div");
      const title = esc(ex.title || "Examen");
      const desc  = esc(ex.description || "");
      const dur   = ex.duration ? `${ex.duration} min` : "Sin duración";
      left.innerHTML = `
        <div class="title" data-title>${title}</div>
        ${desc ? `<div class="small muted">${desc}</div>` : ""}
        <div class="small muted">Duración: ${dur}</div>
      `;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.flexDirection = "column";
      right.style.alignItems = "flex-end";
      right.style.gap = "8px";
      right.innerHTML = `
        <button class="btn primary" data-open="${ex.id}">Iniciar</button>
      `;

      const btnOpen = right.querySelector("[data-open]");
      btnOpen.onclick = () => openExam(ex.id);

      card.appendChild(left);
      card.appendChild(right);
      examsList.appendChild(card);
    });

    // solo admin puede editar
    if (currentUser && currentUser.role === "admin") {
      show(editButtons);
    } else {
      hide(editButtons);
    }

  } catch(e){
    console.error("renderExamsForSection", e);
    examsList.innerHTML = `<div class="muted">Error cargando exámenes</div>`;
    hide(editButtons);
  }
}

// ---------------------- OPEN EXAM (student view) ----------------------
async function openExam(examId){
  try {
    const exDoc = await getDoc(doc(db,"exams", examId));
    if (!exDoc.exists()) {
      alert("Examen no encontrado");
      return;
    }
    const exData = exDoc.data();
    currentExam = { id: examId, ...exData };

    // obtenemos TODOS los casos clínicos del examen
    const qCasos = query(collection(db,"casosClinicos"), where("examId","==", examId));
    const casosSnap = await getDocs(qCasos);
    const casos = [];
    casosSnap.forEach(c => casos.push({ id:c.id, ...c.data() }));
    casos.sort((a,b) => (a.orden || 0) - (b.orden || 0));

    // obtenemos TODAS las preguntas del examen
    const qPreg = query(collection(db,"preguntas"), where("examId","==", examId));
    const pregSnap = await getDocs(qPreg);
    const preguntas = [];
    pregSnap.forEach(p => preguntas.push({ id:p.id, ...p.data() }));
    preguntas.sort((a,b) => (a.orden || 0) - (b.orden || 0));

    // agrupamos preguntas por casoId
    const preguntasPorCaso = {};
    preguntas.forEach(p => {
      const cId = p.casoId || "sinCaso";
      if (!preguntasPorCaso[cId]) preguntasPorCaso[cId] = [];
      preguntasPorCaso[cId].push(p);
    });

    // render examen completo
    renderExamScreen(currentExam, casos, preguntasPorCaso);

  } catch(e){
    console.error("openExam", e);
    alert("Error al abrir el examen");
  }
}

function renderExamScreen(exam, casos, preguntasPorCaso){
  hide(loginScreen);
  hide(studentScreen);
  hide(resultScreen);
  show(examScreen);

  examTitle.textContent = exam.title || "Examen";

  examForm.innerHTML = "";

  // tiempo: si el examen tiene duration en minutos, usamos eso
  let totalSeconds = 0;
  if (typeof exam.duration === "number" && exam.duration > 0) {
    totalSeconds = exam.duration * 60;
  } else {
    // fallback: 75 segundos por pregunta
    let totalPreguntas = 0;
    Object.values(preguntasPorCaso).forEach(arr => totalPreguntas += arr.length);
    totalSeconds = Math.max(60, totalPreguntas * 75);
  }
  startExamTimer(totalSeconds);

  // para cada caso clínico → mostramos texto una vez y todas sus preguntas abajo
  casos.forEach((caso, idxCaso) => {
    const bloqueCaso = document.createElement("div");
    bloqueCaso.className = "questionBlock card";
    bloqueCaso.style.marginBottom = "14px";

    const header = document.createElement("div");
    header.innerHTML = `
      <div class="questionTitle">Caso clínico ${idxCaso + 1}</div>
      <div class="caseText">
        <strong>${esc(caso.titulo || "")}</strong><br>
        ${esc(caso.texto || "")}
      </div>
    `;
    bloqueCaso.appendChild(header);

    const listaPreguntas = preguntasPorCaso[caso.id] || [];
    if (listaPreguntas.length === 0) {
      const noQ = document.createElement("div");
      noQ.className = "small muted";
      noQ.textContent = "Sin preguntas asociadas a este caso.";
      bloqueCaso.appendChild(noQ);
    } else {
      listaPreguntas.forEach((q, idxPreg) => {
        const qWrap = document.createElement("div");
        qWrap.style.marginTop = "10px";

        const tituloPregunta = document.createElement("div");
        tituloPregunta.innerHTML = `<strong>Pregunta ${idxCaso + 1}.${idxPreg + 1}</strong> ${esc(q.pregunta)}`;
        qWrap.appendChild(tituloPregunta);

        const optsDiv = document.createElement("div");
        optsDiv.className = "options";

        (q.opciones || []).forEach((opt, i) => {
          const label = document.createElement("label");
          label.innerHTML = `
            <input type="radio" name="${q.id}" value="${i}">
            ${String.fromCharCode(65 + i)}. ${esc(opt)}
          `;
          optsDiv.appendChild(label);
        });

        qWrap.appendChild(optsDiv);
        bloqueCaso.appendChild(qWrap);
      });
    }

    examForm.appendChild(bloqueCaso);
  });

  // botones admin para editar preguntas del examen actual
  if (currentUser && currentUser.role === "admin") {
    show(editExamButtons);
  } else {
    hide(editExamButtons);
  }

  btnFinishExam.onclick = () => {
    if (!confirm("¿Deseas finalizar el examen?")) return;
    finalizeExamAndGrade(exam.id);
  };
}

// ---------------------- TIMER ----------------------
function startExamTimer(totalSeconds){
  clearInterval(examTimerInterval);
  examRemainingSeconds = totalSeconds;

  function tick(){
    if (examRemainingSeconds <= 0) {
      clearInterval(examTimerInterval);
      examTimerEl.textContent = "00:00";
      alert("Tiempo agotado");
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

// ---------------------- FINALIZAR Y CALIFICAR ----------------------
async function finalizeExamAndGrade(examId){
  try {
    // respuestas marcadas
    const answers = {};
    examForm.querySelectorAll("input[type=radio]:checked").forEach(r => {
      answers[r.name] = Number(r.value);
    });

    // cargamos todas las preguntas del examen
    const qPreg = query(collection(db,"preguntas"), where("examId","==", examId));
    const snap = await getDocs(qPreg);
    const preguntas = [];
    snap.forEach(p => preguntas.push({ id:p.id, ...p.data() }));

    let correctas = 0;
    preguntas.forEach(q => {
      const sel = answers[q.id];
      if (typeof sel === "number" && sel === (q.correcta || 0)) correctas++;
    });

    const total = preguntas.length;
    const percent = total ? Math.round((correctas / total) * 100) : 0;

    renderResultScreen(preguntas, answers, percent);
    clearInterval(examTimerInterval);

  } catch(e){
    console.error("finalizeExamAndGrade", e);
    alert("Error al calificar el examen");
  }
}

function renderResultScreen(preguntas, answers, percent){
  hide(loginScreen);
  hide(studentScreen);
  hide(examScreen);
  show(resultScreen);

  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  preguntas.forEach((q, idx) => {
    const userSel = answers[q.id];
    const correcta = q.correcta || 0;

    const card = document.createElement("div");
    card.className = (userSel === correcta) ? "result-correct card" : "result-wrong card";
    card.style.marginTop = "10px";

    card.innerHTML = `
      <div style="font-weight:700">Pregunta ${idx + 1}</div>
      <div style="margin-top:8px">${esc(q.pregunta)}</div>
    `;

    const optsDiv = document.createElement("div");
    (q.opciones || []).forEach((opt,i) => {
      const div = document.createElement("div");
      let mark = "";
      if (i === correcta) mark = " (Correcta)";
      if (i === userSel && i !== correcta) mark = " (Tu elección)";
      div.textContent = `${String.fromCharCode(65 + i)}. ${opt}${mark}`;
      optsDiv.appendChild(div);
    });
    card.appendChild(optsDiv);

    const just = document.createElement("div");
    just.className = "small muted";
    just.style.marginTop = "8px";
    just.textContent = q.justificacion || "";
    card.appendChild(just);

    resultScreen.appendChild(card);
  });
}

// ---------------------- AUTH ----------------------
btnLogin.onclick = async () => {
  const email = (inputEmail.value || "").trim();
  const pass  = (inputPassword.value || "").trim();
  if (!email || !pass) {
    loginMessage.textContent = "Ingrese credenciales";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginMessage.textContent = "";
  } catch(e){
    console.error("login", e);
    loginMessage.textContent = "Credenciales inválidas";
  }
};

btnCancel.onclick = () => {
  inputEmail.value = "";
  inputPassword.value = "";
  loginMessage.textContent = "";
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    hide(adminSidebar);
    hide(editButtons);
    hide(editExamButtons);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    show(loginScreen);
    userInfo.textContent = "";
    authButtons.innerHTML = "";
    await loadSections();
    return;
  }

  // usuario logueado
  try {
    const uRef  = doc(db,"users", user.uid);
    const uSnap = await getDoc(uRef);
    let role = "user";
    if (uSnap.exists()) {
      const d = uSnap.data();
      role = d.role || "user";
    }
    // forzamos admin si UID coincide
    if (user.uid === ADMIN_UID) role = "admin";

    currentUser = { uid:user.uid, email:user.email, role };

    if (role === "admin") {
      showAdminUI();
    } else {
      showStudentUI();
    }

  } catch(e){
    console.error("onAuthStateChanged", e);
  }
});

async function doLogout(){
  try {
    await signOut(auth);
    location.reload();
  } catch(e){
    console.error("logout", e);
  }
}

// ---------------------- UI: STUDENT / ADMIN ----------------------
async function showStudentUI(){
  hide(loginScreen);
  hide(adminSidebar);
  hide(editButtons);
  hide(editExamButtons);
  show(studentScreen);

  userInfo.textContent = currentUser.email || "";
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  document.getElementById("btnLogoutTop").onclick = doLogout;

  await loadSections();
}

async function showAdminUI(){
  hide(loginScreen);
  show(studentScreen);
  show(adminSidebar);

  userInfo.textContent = `${currentUser.email} (Admin)`;
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  document.getElementById("btnLogoutTop").onclick = doLogout;

  await loadSections();
}

// ---------------------- ADMIN: SECCIONES / EXÁMENES / USERS / LINKS ----------------------

// nueva sección
adminAddSection.onclick = async () => {
  if (!currentUser || currentUser.role !== "admin") return;
  const name = prompt("Nombre de la nueva sección:");
  if (!name) return;
  try {
    await addDoc(collection(db,"sections"), {
      name,
      order: 0,
      createdAt: new Date()
    });
    alert("Sección creada");
    await loadSections();
  } catch(e){
    console.error("adminAddSection", e);
    alert("Error creando sección");
  }
};

// nuevo examen en sección actual
adminAddExam.onclick = async () => {
  if (!currentUser || currentUser.role !== "admin") return;
  if (!currentSectionId) {
    alert("Selecciona una sección primero");
    return;
  }
  const title = prompt("Título del examen:");
  if (!title) return;
  const desc  = prompt("Descripción (opcional):","Simulacro ENARM");
  const dur   = Number(prompt("Duración en minutos:", "45") || 45);
  try {
    await addDoc(collection(db,"exams"), {
      sectionId: currentSectionId,
      title,
      description: desc || "",
      duration: dur || 45,
      createdAt: new Date()
    });
    alert("Examen creado");
    await renderExamsForSection(currentSectionId);
  } catch(e){
    console.error("adminAddExam", e);
    alert("Error creando examen");
  }
};

// Editor de casos y preguntas (simple, en sidebar derecho)
adminEditQuestions.onclick = () => {
  if (!currentUser || currentUser.role !== "admin") return;
  if (!currentExam) {
    alert("Abre primero un examen para editar sus casos y preguntas");
    return;
  }
  openExamEditor(currentExam.id);
};

// gestor de usuarios
adminUsers.onclick = async () => {
  if (!currentUser || currentUser.role !== "admin") return;
  // limpiamos áreas previas
  adminSidebar.querySelectorAll(".editor-area").forEach(n => n.remove());
  const area = document.createElement("div");
  area.className = "editor-area";
  adminSidebar.appendChild(area);
  area.innerHTML = `<h4>Usuarios</h4><div id="usersList">Cargando...</div>`;
  const usersList = document.getElementById("usersList");
  try {
    const snap = await getDocs(collection(db,"users"));
    usersList.innerHTML = "";
    snap.forEach(u => {
      const d = u.data();
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "8px";
      card.innerHTML = `
        <div>
          <strong>${esc(u.id)}</strong>
          <div class="small muted">${esc(d.name || "")} - ${esc(d.role || "user")}</div>
        </div>
        <div style="margin-top:6px;">
          <button class="btn u_edit" data-uid="${u.id}">Editar</button>
          <button class="btn u_del" data-uid="${u.id}">Eliminar</button>
        </div>
      `;
      usersList.appendChild(card);
    });

    usersList.querySelectorAll(".u_edit").forEach(b => {
      b.onclick = async () => {
        const uid = b.getAttribute("data-uid");
        const ref = doc(db,"users", uid);
        const snapU = await getDoc(ref);
        const data = snapU.exists() ? snapU.data() : {};
        const name = prompt("Nombre visible:", data.name || "");
        if (!name) return;
        const role = prompt("Rol (admin/user):", data.role || "user");
        await setDoc(ref, { name, role }, { merge:true });
        alert("Usuario actualizado");
        adminUsers.onclick();
      };
    });
    usersList.querySelectorAll(".u_del").forEach(b => {
      b.onclick = async () => {
        const uid = b.getAttribute("data-uid");
        if (!confirm("¿Eliminar registro del usuario en Firestore?")) return;
        await deleteDoc(doc(db,"users", uid));
        alert("Eliminado");
        adminUsers.onclick();
      };
    });

  } catch(e){
    console.error("adminUsers", e);
    usersList.innerHTML = `<div class="muted">Error cargando usuarios</div>`;
  }
};

// Links redes (solo actualiza href en UI)
adminLinks.onclick = () => {
  if (!currentUser || currentUser.role !== "admin") return;
  adminSidebar.querySelectorAll(".editor-area").forEach(n => n.remove());
  const area = document.createElement("div");
  area.className = "editor-area";
  adminSidebar.appendChild(area);
  area.innerHTML = `
    <h4>Links Sociales</h4>
    <label>Instagram</label><input id="ln_ig">
    <label>WhatsApp</label><input id="ln_wa">
    <label>Telegram</label><input id="ln_tg">
    <label>TikTok</label><input id="ln_tt">
    <div style="margin-top:8px;">
      <button id="ln_save" class="btn primary">Guardar links (solo UI)</button>
    </div>
    <div class="small muted" style="margin-top:6px">
      Esto solo actualiza los links visibles; si quieres, luego los guardamos en Firestore.
    </div>
  `;
  setTimeout(() => {
    $("ln_ig").value = linkInstagram?.href || "";
    $("ln_wa").value = linkWhatsApp?.href || "";
    $("ln_tg").value = linkTelegram?.href || "";
    $("ln_tt").value = linkTikTok?.href || "";
    $("ln_save").onclick = () => {
      const ig = $("ln_ig").value.trim();
      const wa = $("ln_wa").value.trim();
      const tg = $("ln_tg").value.trim();
      const tt = $("ln_tt").value.trim();
      if (ig && linkInstagram) linkInstagram.href = ig;
      if (wa && linkWhatsApp) linkWhatsApp.href = wa;
      if (tg && linkTelegram) linkTelegram.href = tg;
      if (tt && linkTikTok)  linkTikTok.href  = tt;
      alert("Links actualizados en la UI");
    };
  },50);
};

adminLogout.onclick = doLogout;

// ---------------------- ADMIN: EDITOR DE CASOS + PREGUNTAS (sidebar derecho) ----------------------
async function openExamEditor(examId){
  // limpia editor anterior
  adminSidebar.querySelectorAll(".editor-area").forEach(n => n.remove());
  const area = document.createElement("div");
  area.className = "editor-area";
  adminSidebar.appendChild(area);
  area.innerHTML = `
    <h4>Editor examen</h4>
    <div class="small muted">Examen ID: ${esc(examId)}</div>
    <hr>
    <h5>Casos clínicos</h5>
    <div id="casosList" class="small muted">Cargando casos...</div>
    <hr>
    <h5>Agregar nuevo caso clínico</h5>
    <label>Título</label><input id="newCasoTitulo">
    <label>Texto del caso</label><textarea id="newCasoTexto" rows="3"></textarea>
    <div style="margin-top:6px;">
      <button id="btnAddCaso" class="btn primary">Agregar caso</button>
    </div>
    <hr>
    <h5>Agregar nueva pregunta</h5>
    <div class="small muted">Primero copia el <strong>casoId</strong> de la lista de arriba.</div>
    <label>ID de caso clínico (casoId)</label><input id="newQCasoId">
    <label>Pregunta</label><input id="newQTexto">
    <label>Opción A</label><input id="newQA">
    <label>Opción B</label><input id="newQB">
    <label>Opción C</label><input id="newQC">
    <label>Opción D</label><input id="newQD">
    <label>Índice correcto (0-3)</label><input id="newQCorrecta" type="number" min="0" max="3">
    <label>Justificación</label><textarea id="newQJust" rows="2"></textarea>
    <div style="margin-top:6px;">
      <button id="btnAddPregunta" class="btn primary">Agregar pregunta</button>
    </div>
  `;

  const casosList = $("casosList");

  // cargar casos
  try {
    const qCasos = query(collection(db,"casosClinicos"), where("examId","==", examId));
    const snap = await getDocs(qCasos);
    casosList.innerHTML = "";
    if (snap.empty) {
      casosList.innerHTML = `<div class="small muted">Sin casos clínicos aún.</div>`;
    } else {
      snap.forEach(c => {
        const d = c.data();
        const row = document.createElement("div");
        row.className = "card";
        row.style.marginBottom = "6px";
        row.innerHTML = `
          <div><strong>${esc(d.titulo || "")}</strong></div>
          <div class="small muted">ID: ${c.id}</div>
        `;
        casosList.appendChild(row);
      });
    }
  } catch(e){
    console.error("openExamEditor - casos", e);
    casosList.innerHTML = `<div class="small muted">Error cargando casos</div>`;
  }

  // agregar caso
  $("btnAddCaso").onclick = async () => {
    const titulo = $("newCasoTitulo").value.trim();
    const texto  = $("newCasoTexto").value.trim();
    if (!titulo || !texto) {
      alert("Título y texto del caso son obligatorios");
      return;
    }
    try {
      await addDoc(collection(db,"casosClinicos"), {
        examId,
        titulo,
        texto,
        orden: 0,
        createdAt: new Date()
      });
      alert("Caso clínico agregado");
      openExamEditor(examId);
    } catch(e){
      console.error("addCaso", e);
      alert("Error agregando caso clínico");
    }
  };

  // agregar pregunta
  $("btnAddPregunta").onclick = async () => {
    const casoId = $("newQCasoId").value.trim();
    const preg   = $("newQTexto").value.trim();
    const a      = $("newQA").value.trim();
    const b      = $("newQB").value.trim();
    const c      = $("newQC").value.trim();
    const d      = $("newQD").value.trim();
    const idx    = Number($("newQCorrecta").value || 0);
    const just   = $("newQJust").value.trim();
    const opciones = [a,b,c,d].filter(v => v !== "");

    if (!casoId) {
      alert("Necesitas indicar el casoId");
      return;
    }
    if (!preg || opciones.length === 0) {
      alert("Pregunta y al menos una opción son obligatorias");
      return;
    }
    try {
      await addDoc(collection(db,"preguntas"), {
        examId,
        casoId,
        pregunta: preg,
        opciones,
        correcta: idx,
        justificacion: just,
        orden: 0,
        createdAt: new Date()
      });
      alert("Pregunta agregada");
      // no recargamos todo para que sigas escribiendo rápido
    } catch(e){
      console.error("addPregunta", e);
      alert("Error agregando pregunta");
    }
  };
}

// ---------------------- EDIT MODE EXÁMENES (lista) ----------------------
btnEdit.onclick = () => {
  if (!currentUser || currentUser.role !== "admin") return alert("Solo admin");
  const cards = examsList.querySelectorAll(".examBox");
  cards.forEach(card => {
    const eid = card.dataset.eid;
    const titleEl = card.querySelector("[data-title]");
    const currentTitle = titleEl ? titleEl.textContent : "";
    const input = document.createElement("input");
    input.className = "exam-title-input";
    input.value = currentTitle;
    input.dataset.eid = eid;

    const delLabel = document.createElement("label");
    delLabel.style.display = "block";
    delLabel.style.marginTop = "6px";
    delLabel.innerHTML = `<input type="checkbox" data-del="${eid}"> Eliminar examen`;

    titleEl.parentNode.replaceChild(input, titleEl);
    const meta = card.querySelector(".small");
    if (meta) meta.parentNode.appendChild(delLabel);
  });

  const addRow = document.createElement("div");
  addRow.className = "card";
  addRow.id = "addExamRow";
  addRow.style.marginTop = "10px";
  addRow.innerHTML = `
    <h4>Agregar examen nuevo</h4>
    <input id="newExamName" placeholder="Título del examen">
    <div style="margin-top:8px;">
      <button id="addExamTemp" class="btn primary">Agregar (draft)</button>
    </div>
  `;
  examsList.parentNode.insertBefore(addRow, examsList.nextSibling);

  $("addExamTemp").onclick = () => {
    const name = $("newExamName").value.trim();
    if (!name) {
      alert("Título requerido");
      return;
    }
    const tempId = qid();
    draft.newExams.push({ tempId, title:name, sectionId: currentSectionId });
    const preview = document.createElement("div");
    preview.className = "examBox";
    preview.dataset.tempid = tempId;
    preview.innerHTML = `
      <div>
        <div class="title">${esc(name)}</div>
        <div class="small muted">Nuevo (draft)</div>
      </div>
      <div><button class="btn">---</button></div>
    `;
    examsList.appendChild(preview);
    $("newExamName").value = "";
  };

  show(btnSave);
  hide(btnEdit);
};

btnSave.onclick = async () => {
  if (!currentUser || currentUser.role !== "admin") return;
  try {
    const inputs = examsList.querySelectorAll("input.exam-title-input");
    inputs.forEach(inp => {
      const eid = inp.dataset.eid;
      const title = inp.value.trim();
      if (!eid) return;
      if (!draft.exams[eid]) draft.exams[eid] = { deleted:false, new:false };
      draft.exams[eid].title = title;
    });

    const dels = examsList.querySelectorAll("input[type=checkbox][data-del]");
    dels.forEach(d => {
      const eid = d.getAttribute("data-del");
      if (!draft.exams[eid]) draft.exams[eid] = { title:"", new:false };
      if (d.checked) draft.exams[eid].deleted = true;
    });

    // eliminamos (soft delete: marcar flag deleted)
    for (const [eid, obj] of Object.entries(draft.exams)) {
      if (obj.deleted) {
        await updateDoc(doc(db,"exams", eid), { deleted:true });
      }
    }
    // actualizamos títulos
    for (const [eid, obj] of Object.entries(draft.exams)) {
      if (obj.deleted) continue;
      if (obj.title !== undefined) {
        await updateDoc(doc(db,"exams", eid), { title: obj.title });
      }
    }
    // nuevos exámenes
    for (const nx of draft.newExams) {
      await addDoc(collection(db,"exams"), {
        sectionId: nx.sectionId,
        title: nx.title,
        description: "",
        duration: 45,
        createdAt: new Date()
      });
    }

    draft.exams = {};
    draft.newExams = [];
    alert("Cambios guardados");

    hide(btnSave);
    show(btnEdit);
    const addRow = $("addExamRow");
    if (addRow) addRow.remove();
    await renderExamsForSection(currentSectionId);

  } catch(e){
    console.error("save exams draft", e);
    alert("Error guardando cambios");
  }
};

// ---------------------- EDIT MODE PREGUNTAS (dentro del examen) ----------------------
// Para no hacerlo gigante, dejamos la edición de preguntas fina en Firestore y el
// alta rápida desde openExamEditor(); aquí solo activamos ese flujo.
btnEditExam.onclick = () => {
  if (!currentUser || currentUser.role !== "admin") return;
  if (!currentExam) return alert("Abre un examen primero");
  openExamEditor(currentExam.id);
};

btnSaveExam.onclick = () => {
  // este botón queda para futuras ampliaciones
  alert("La edición detallada de preguntas se hace desde el panel derecho (Editor examen).");
};

// ---------------------- INIT ----------------------
(async function init(){
  hide(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  hide(adminSidebar);
  hide(editButtons);
  hide(editExamButtons);
  await loadSections();
})();
