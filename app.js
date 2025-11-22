// ===============================
// app.js (Parte 1/3)
// Estructura compatible con Firestore nuevo:
// sections, exams, casosClinicos, preguntas, users, cambios
// ===============================

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
  where,
  orderBy,
  limit
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

// UID del admin principal (el que ya tienes dado de alta)
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

// ---------------------- SELECTORES DOM ----------------------
const $ = (id) => document.getElementById(id);

// Sidebar izquierda
const sectionsList     = $("sectionsList");
const mainCountdownEl  = $("mainCountdown");
const linkInstagram    = $("link-instagram");
const linkWhatsApp     = $("link-whatsapp");
const linkTelegram     = $("link-telegram");
const linkTikTok       = $("link-tiktok");

// Sidebar derecha (admin)
const adminSidebar       = $("adminSidebar");
const adminAddSection    = $("adminAddSection");
const adminAddExam       = $("adminAddExam");
const adminEditQuestions = $("adminEditQuestions");
const adminUsers         = $("adminUsers");
const adminLinks         = $("adminLinks");
const adminLogout        = $("adminLogout");

// Main / auth / pantallas
const userInfo      = $("userInfo");
const authButtons   = $("authButtons");
const mainContent   = $("mainContent");

const loginScreen   = $("loginScreen");
const inputEmail    = $("inputEmail");
const inputPassword = $("inputPassword");
const btnLogin      = $("btnLogin");
const btnCancel     = $("btnCancel");
const loginMessage  = $("loginMessage");

const studentScreen = $("studentScreen");
const studentTitle  = $("studentTitle");
const examsList     = $("examsList");

const examScreen    = $("examScreen");
const examTitle     = $("examTitle");
const examTimer     = $("examTimer");
const examForm      = $("examForm");
const btnFinishExam = $("btnFinishExam");

const editExamButtons = $("editExamButtons"); // no lo usaremos (dejamos oculto)
const resultScreen    = $("resultScreen");

// Botones flotantes de edición de lista de exámenes (no usados por ahora)
const editButtons = $("editButtons");
const btnEdit     = $("btnEdit");
const btnSave     = $("btnSave");

// ---------------------- ESTADO GLOBAL ----------------------
let currentUser      = null;   // { uid, email, role }
let currentSectionId = null;
let currentExam      = null;   // { id, ... }
let examTimerInterval = null;
let examRemainingSeconds = 0;

// ---------------------- UTILIDADES ----------------------
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function escapeHtml(s) {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------- COUNTDOWN PRINCIPAL ----------------------
function startMainCountdown() {
  try {
    const target = new Date("2026-09-23T00:00:00");
    const el = mainCountdownEl;
    if (!el) return;

    function tick() {
      const now = new Date();
      let diff = Math.floor((target - now) / 1000);
      if (diff <= 0) {
        el.textContent = "Evento iniciado";
        return;
      }
      const days = Math.floor(diff / 86400); diff -= days * 86400;
      const hrs  = Math.floor(diff / 3600);  diff -= hrs * 3600;
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      el.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }

    tick();
    setInterval(tick, 1000);
  } catch (e) {
    console.warn("countdown error", e);
  }
}
startMainCountdown();

// ---------------------- AUTO-DEFAULTS MÍNIMOS ----------------------
let autoDefaultsRan = false;
async function ensureDefaults() {
  if (autoDefaultsRan) return;
  autoDefaultsRan = true;

  try {
    // 1) Asegurar al menos 1 sección
    const sSnap = await getDocs(
      query(collection(db, "sections"), limit(1))
    );
    if (sSnap.empty) {
      await addDoc(collection(db, "sections"), {
        name: "Gastroenterología",
        order: 1,
        createdAt: new Date().toISOString()
      });
    }

    // 2) Asegurar doc de admin en users (si no existe)
    const adminUserRef = doc(db, "users", ADMIN_UID);
    const adminUserSnap = await getDoc(adminUserRef);
    if (!adminUserSnap.exists()) {
      await setDoc(adminUserRef, {
        email: "admin@example.com",
        name: "Admin ENARM",
        role: "admin",
        createdAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("ensureDefaults error:", e);
  }
}

// ---------------------- AUTH ----------------------
if (btnLogin) {
  btnLogin.onclick = async () => {
    const email = (inputEmail.value || "").trim();
    const pass  = (inputPassword.value || "").trim();
    if (!email || !pass) {
      loginMessage.textContent = "Ingrese correo y contraseña";
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      loginMessage.textContent = "";
    } catch (e) {
      console.error("login error", e);
      loginMessage.textContent = "Credenciales inválidas";
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

async function doLogout() {
  try {
    await signOut(auth);
    location.reload();
  } catch (e) {
    console.error("logout error", e);
  }
}

onAuthStateChanged(auth, async (user) => {
  try {
    await ensureDefaults();
  } catch (_) {}

  if (user) {
    try {
      // Leer role desde colección "users"
      const uRef = doc(db, "users", user.uid);
      const uSnap = await getDoc(uRef);
      let role = "user";
      let name = "";

      if (uSnap.exists()) {
        const d = uSnap.data();
        role = d.role || "user";
        name = d.name || "";
      } else {
        // si no existe doc en "users", lo creamos
        await setDoc(uRef, {
          email: user.email || "",
          name: "",
          role: "user",
          createdAt: new Date().toISOString()
        });
      }

      currentUser = {
        uid: user.uid,
        email: user.email || "",
        role
      };

      if (role === "admin" || user.uid === ADMIN_UID) {
        currentUser.role = "admin";
        showAdminUI();
      } else {
        currentUser.role = "user";
        showStudentUI();
      }
    } catch (e) {
      console.error("onAuthStateChanged error:", e);
    }
  } else {
    // No logueado
    currentUser = null;
    hide(adminSidebar);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    show(loginScreen);
    userInfo.textContent = "";
    authButtons.innerHTML = "";
    await loadSections(); // aun sin login, secciones visibles
  }
});

// ---------------------- UI: STUDENT / ADMIN ----------------------
async function showStudentUI() {
  hide(loginScreen);
  hide(adminSidebar);
  show(studentScreen);
  hide(examScreen);
  hide(resultScreen);

  userInfo.textContent = currentUser?.email || "";
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  const btnLogoutTop = document.getElementById("btnLogoutTop");
  if (btnLogoutTop) btnLogoutTop.onclick = doLogout;

  await loadSections();
}

async function showAdminUI() {
  hide(loginScreen);
  show(studentScreen);
  show(adminSidebar);
  hide(examScreen);
  hide(resultScreen);

  userInfo.textContent = `${currentUser?.email || ""} (Admin)`;
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  const btnLogoutTop = document.getElementById("btnLogoutTop");
  if (btnLogoutTop) btnLogoutTop.onclick = doLogout;

  await loadSections();
}

// ---------------------- SECCIONES ----------------------
async function loadSections() {
  if (!sectionsList) return;
  sectionsList.innerHTML = "";

  try {
    await ensureDefaults();
    // Intentamos ordenar por "order"; si no, por name.
    const qSections = query(
      collection(db, "sections"),
      orderBy("order")
    );
    const sSnap = await getDocs(qSections);
    if (sSnap.empty) {
      sectionsList.innerHTML = `<div class="muted">Sin secciones</div>`;
      return;
    }

    sSnap.forEach((sDoc) => {
      const data = sDoc.data();
      const secId = sDoc.id;
      const name  = data.name || "Sección";

      const el = document.createElement("div");
      el.className = "section-item";
      el.dataset.id = secId;
      el.textContent = name;
      el.onclick = () => selectSection(secId, name);

      sectionsList.appendChild(el);
    });

    // Si no hay sección seleccionada, seleccionamos la primera.
    if (!currentSectionId && sSnap.docs.length > 0) {
      const first = sSnap.docs[0];
      selectSection(first.id, first.data().name || "Sección");
    }
  } catch (e) {
    console.error("loadSections error", e);
    sectionsList.innerHTML = `<div class="muted">Error cargando secciones</div>`;
  }
}

async function selectSection(id, name) {
  currentSectionId = id;
  studentTitle.textContent = `Sección: ${name}`;

  // marcar activa
  if (sectionsList) {
    Array.from(sectionsList.children).forEach((ch) => {
      ch.classList.toggle("active", ch.dataset.id === id);
    });
  }

  hide(loginScreen);
  show(studentScreen);
  hide(examScreen);
  hide(resultScreen);

  await renderExamsForSection(id);
}

// ---------------------- LISTA DE EXÁMENES POR SECCIÓN ----------------------
async function renderExamsForSection(sectionId) {
  if (!sectionId) return;

  examsList.innerHTML = `<div class="muted">Cargando exámenes...</div>`;

  try {
    // Intento con orden
    let q = query(
      collection(db, "exams"),
      where("sectionId", "==", sectionId),
      orderBy("order", "asc")
    );

    const snap = await getDocs(q);

    examsList.innerHTML = "";

    if (snap.empty) {
      examsList.innerHTML = `<div class="muted">No hay exámenes en esta sección.</div>`;
      return;
    }

    snap.forEach((docu) => {
      const d = docu.data();

      // Asignar orden automático si falta
      const orderValue = (typeof d.order === "number") ? d.order : 999;

      const card = document.createElement("div");
      card.className = "card exam-card";

      card.innerHTML = `
        <div>
          <strong>${escapeHtml(d.title || "Examen sin título")}</strong>
          <div class="small muted">Orden: ${orderValue}</div>
          <div class="small muted">${escapeHtml(d.description || "")}</div>
        </div>
        <div style="margin-top:6px;">
          <button class="btn exam_start" data-id="${docu.id}">Iniciar</button>
        </div>
      `;

      examsList.appendChild(card);
    });

    // Eventos de inicio
    examsList.querySelectorAll(".exam_start").forEach((btn) => {
      btn.onclick = () => {
        const examId = btn.getAttribute("data-id");
        startExam(examId);
      };
    });

  } catch (e) {
    console.error("renderExamsForSection error", e);

    // Si falla por falta de índice, intento sin orderBy
    try {
      console.warn("Intentando carga SIN orderBy");

      const q2 = query(
        collection(db, "exams"),
        where("sectionId", "==", sectionId)
      );
      const snap2 = await getDocs(q2);

      examsList.innerHTML = "";

      if (snap2.empty) {
        examsList.innerHTML = `<div class="muted">No hay exámenes en esta sección.</div>`;
        return;
      }

      snap2.forEach((docu) => {
        const d = docu.data();

        const card = document.createElement("div");
        card.className = "card exam-card";

        card.innerHTML = `
          <div>
            <strong>${escapeHtml(d.title || "Examen sin título")}</strong>
            <div class="small muted">Orden: ${d.order ?? 999}</div>
            <div class="small muted">${escapeHtml(d.description || "")}</div>
          </div>
          <div style="margin-top:6px;">
            <button class="btn exam_start" data-id="${docu.id}">Iniciar</button>
          </div>
        `;

        examsList.appendChild(card);
      });

      examsList.querySelectorAll(".exam_start").forEach((btn) => {
        btn.onclick = () => {
          const examId = btn.getAttribute("data-id");
          startExam(examId);
        };
      });

    } catch (err2) {
      console.error("Fallo también sin orderBy", err2);
      examsList.innerHTML = `<div class="muted">Error cargando exámenes.</div>`;
    }
  }
}

// ---------------------- ABRIR EXAMEN (usa casosClinicos + preguntas) ----------------------
async function openExam(examId) {
  try {
    const eSnap = await getDoc(doc(db, "exams", examId));
    if (!eSnap.exists()) {
      alert("Examen no encontrado");
      return;
    }
    const examData = eSnap.data();
    currentExam = { id: examId, ...examData };

    // 1) traer casos clínicos del examen
    const qCasos = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId),
      orderBy("orden")
    );
    const casosSnap = await getDocs(qCasos);
    const casos = [];
    casosSnap.forEach((cDoc) => {
      casos.push({ id: cDoc.id, ...cDoc.data() });
    });

    // 2) traer todas las preguntas del examen
    const qPreg = query(
      collection(db, "preguntas"),
      where("examId", "==", examId),
      orderBy("orden")
    );
    const pregSnap = await getDocs(qPreg);
    const preguntas = [];
    pregSnap.forEach((pDoc) => {
      preguntas.push({ id: pDoc.id, ...pDoc.data() });
    });

    renderExamScreen(currentExam, casos, preguntas);
  } catch (e) {
    console.error("openExam error", e);
    alert("Error al abrir examen");
  }
}

function renderExamScreen(exam, casos, preguntas) {
  hide(loginScreen);
  hide(studentScreen);
  hide(resultScreen);
  show(examScreen);
  hide(editExamButtons); // editor interno no se usa

  examTitle.textContent = exam.title || "Examen";
  examForm.innerHTML = "";

  // Asignar tiempo: duración en minutos o 60s por pregunta si no hay duration
  let totalSeconds = 0;
  if (exam.duration && Number(exam.duration) > 0) {
    totalSeconds = Number(exam.duration) * 60;
  } else {
    const nPreg = preguntas.length || 1;
    totalSeconds = Math.max(60, nPreg * 75);
  }
  startExamTimer(totalSeconds);

  // Index global de pregunta
  let idxGlobal = 1;

  // Mapeo de preguntas por casoId
  const preguntasPorCaso = {};
  preguntas.forEach((p) => {
    const cid = p.casoId || "sinCaso";
    if (!preguntasPorCaso[cid]) preguntasPorCaso[cid] = [];
    preguntasPorCaso[cid].push(p);
  });

  // Ordenar cada arreglo de preguntas por "orden"
  Object.values(preguntasPorCaso).forEach((arr) => {
    arr.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  });

  // 1) Mostrar casos clínicos con sus preguntas
  casos.forEach((caso) => {
    const grupo = document.createElement("div");
    grupo.className = "questionBlock card";
    grupo.style.marginBottom = "16px";

    const header = document.createElement("div");
    header.className = "caseText";
    header.innerHTML = `
      <strong>${escapeHtml(caso.titulo || "Caso clínico")}</strong><br>
      ${escapeHtml(caso.texto || "")}
    `;
    grupo.appendChild(header);

    const arrPreg = preguntasPorCaso[caso.id] || [];
    arrPreg.forEach((p) => {
      const qDiv = document.createElement("div");
      qDiv.style.marginTop = "10px";
      qDiv.dataset.qid = p.id;

      const titulo = document.createElement("div");
      titulo.className = "questionTitle";
      titulo.textContent = `Pregunta ${idxGlobal++}`;
      qDiv.appendChild(titulo);

      const enunciado = document.createElement("div");
      enunciado.style.marginTop = "6px";
      enunciado.innerHTML = `<strong>${escapeHtml(p.pregunta || "")}</strong>`;
      qDiv.appendChild(enunciado);

      const optsDiv = document.createElement("div");
      optsDiv.className = "options";

      (p.opciones || []).forEach((opt, i) => {
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="radio" name="${p.id}" value="${i}">
          ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}
        `;
        optsDiv.appendChild(label);
      });

      qDiv.appendChild(optsDiv);
      grupo.appendChild(qDiv);
    });

    examForm.appendChild(grupo);
  });

  // 2) Preguntas sin caso (casoId vacío o sinCaso)
  const huérfanas = preguntasPorCaso["sinCaso"] || [];
  if (huérfanas.length > 0) {
    const grupo = document.createElement("div");
    grupo.className = "questionBlock card";
    grupo.style.marginBottom = "16px";

    const header = document.createElement("div");
    header.className = "caseText";
    header.innerHTML = `<strong>Preguntas sin caso clínico</strong>`;
    grupo.appendChild(header);

    huérfanas.forEach((p) => {
      const qDiv = document.createElement("div");
      qDiv.style.marginTop = "10px";
      qDiv.dataset.qid = p.id;

      const titulo = document.createElement("div");
      titulo.className = "questionTitle";
      titulo.textContent = `Pregunta ${idxGlobal++}`;
      qDiv.appendChild(titulo);

      const enunciado = document.createElement("div");
      enunciado.style.marginTop = "6px";
      enunciado.innerHTML = `<strong>${escapeHtml(p.pregunta || "")}</strong>`;
      qDiv.appendChild(enunciado);

      const optsDiv = document.createElement("div");
      optsDiv.className = "options";

      (p.opciones || []).forEach((opt, i) => {
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="radio" name="${p.id}" value="${i}">
          ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}
        `;
        optsDiv.appendChild(label);
      });

      qDiv.appendChild(optsDiv);
      grupo.appendChild(qDiv);
    });

    examForm.appendChild(grupo);
  }

  // Handler finalizar
  if (btnFinishExam) {
    btnFinishExam.onclick = async () => {
      if (!currentExam) return;
      const ok = confirm("¿Deseas finalizar el examen?");
      if (!ok) return;
      await finalizeExamAndGrade(currentExam.id);
    };
  }
}

// ---------------------- TIMER DE EXAMEN ----------------------
function startExamTimer(totalSeconds) {
  clearInterval(examTimerInterval);
  examRemainingSeconds = totalSeconds;

  function tick() {
    if (examRemainingSeconds <= 0) {
      clearInterval(examTimerInterval);
      examTimer.textContent = "00:00";
      alert("Tiempo agotado. Se finalizará el examen.");
      if (btnFinishExam) btnFinishExam.click();
      return;
    }
    const mm = Math.floor(examRemainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const ss = (examRemainingSeconds % 60)
      .toString()
      .padStart(2, "0");
    examTimer.textContent = `${mm}:${ss}`;
    examRemainingSeconds--;
  }

  tick();
  examTimerInterval = setInterval(tick, 1000);
}

// ---------------------- FINALIZAR Y CALIFICAR ----------------------
async function finalizeExamAndGrade(examId) {
  try {
    const answers = {};
    const inputs = examForm.querySelectorAll('input[type="radio"]:checked');
    inputs.forEach((inp) => {
      answers[inp.name] = Number(inp.value);
    });

    const qPreg = query(
      collection(db, "preguntas"),
      where("examId", "==", examId)
    );
    const snap = await getDocs(qPreg);
    const preguntas = [];
    snap.forEach((pDoc) => {
      preguntas.push({ id: pDoc.id, ...pDoc.data() });
    });

    let correct = 0;
    preguntas.forEach((p) => {
      const sel = answers[p.id];
      if (typeof sel === "number" && sel === (p.correcta || 0)) {
        correct++;
      }
    });

    const total = preguntas.length || 1;
    const percent = Math.round((correct / total) * 100);

    clearInterval(examTimerInterval);
    renderResultScreen(preguntas, answers, percent);
  } catch (e) {
    console.error("finalizeExamAndGrade error", e);
    alert("Error al calificar el examen");
  }
}

function renderResultScreen(preguntas, answers, percent) {
  hide(examScreen);
  hide(loginScreen);
  hide(studentScreen);
  show(resultScreen);

  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  let idx = 1;
  preguntas.forEach((p) => {
    const userSel = answers[p.id];
    const correctIdx = p.correcta || 0;

    const card = document.createElement("div");
    card.className = (userSel === correctIdx)
      ? "card result-correct"
      : "card result-wrong";
    card.style.marginTop = "10px";
    card.innerHTML = `
      <div style="font-weight:700">Pregunta ${idx++}</div>
      <div style="margin-top:6px;">${escapeHtml(p.pregunta || "")}</div>
    `;

    const optsDiv = document.createElement("div");
    optsDiv.style.marginTop = "6px";

    (p.opciones || []).forEach((opt, i) => {
      const divOpt = document.createElement("div");
      let mark = "";
      if (i === correctIdx) mark = " (Correcta)";
      if (i === userSel && i !== correctIdx) mark = " (Tu elección)";
      divOpt.textContent = `${String.fromCharCode(65 + i)}. ${opt}${mark}`;
      optsDiv.appendChild(divOpt);
    });

    const just = document.createElement("div");
    just.className = "small muted";
    just.style.marginTop = "6px";
    just.textContent = p.justificacion || "";

    card.appendChild(optsDiv);
    card.appendChild(just);
    resultScreen.appendChild(card);
  });
}
// ===============================
// app.js (Parte 2/3)
// Admin: secciones, exámenes, casosClinicos, preguntas
// ===============================

// ---------------------- ADMIN: AGREGAR SECCIÓN ----------------------
if (adminAddSection) {
  adminAddSection.onclick = async () => {
    const name  = prompt("Nombre de la nueva sección:");
    if (!name) return;
    const orderStr = prompt("Orden (número, para ordenar la lista):", "1");
    const order = Number(orderStr) || 0;

    try {
      await addDoc(collection(db, "sections"), {
        name,
        order,
        createdAt: new Date().toISOString()
      });
      alert("Sección creada");
      await loadSections();
    } catch (e) {
      console.error("adminAddSection error", e);
      alert("Error creando sección");
    }
  };
}

// ---------------------- ADMIN: AGREGAR EXAMEN ----------------------
if (adminAddExam) {
  adminAddExam.onclick = async () => {
    if (!currentSectionId) {
      alert("Primero selecciona una sección en la barra izquierda.");
      return;
    }
    const title = prompt("Título del examen:");
    if (!title) return;
    const description = prompt("Descripción (opcional):", "");
    const durStr = prompt("Duración en minutos:", "45");
    const duration = Number(durStr) || 0;

    try {
      await addDoc(collection(db, "exams"), {
        sectionId: currentSectionId,
        title,
        description,
        duration,
        createdAt: new Date().toISOString()
      });
      alert("Examen creado");
      await renderExamsForSection(currentSectionId);
    } catch (e) {
      console.error("adminAddExam error", e);
      alert("Error creando examen");
    }
  };
}

// ---------------------- ADMIN: EDITOR DE CASOS CLÍNICOS + PREGUNTAS ----------------------
if (adminEditQuestions) {
  adminEditQuestions.onclick = () => {
    if (!currentExam) {
      alert("Abre un examen primero para editar sus casos y preguntas.");
      return;
    }
    openExamEditor(currentExam.id);
  };
}

async function openExamEditor(examId) {
  try {
    const eSnap = await getDoc(doc(db, "exams", examId));
    if (!eSnap.exists()) {
      alert("Examen no encontrado");
      return;
    }
    const examData = eSnap.data();

    // Limpia cualquier editor anterior
    const oldAreas = adminSidebar.querySelectorAll(".editor-area");
    oldAreas.forEach((n) => n.remove());

    const editorArea = document.createElement("div");
    editorArea.className = "editor-area";
    adminSidebar.appendChild(editorArea);

    editorArea.innerHTML = `
      <h4>Editor de examen</h4>
      <div class="small muted">${escapeHtml(examData.title || "")}</div>
      <hr>
      <h5>Casos clínicos</h5>
      <div id="casosList">Cargando casos...</div>
      <button id="btnAddCaso" class="btn primary" style="margin-top:8px;">Agregar caso clínico</button>
      <hr style="margin:10px 0;">
      <div id="preguntasEditor"></div>
    `;

    const casosList = document.getElementById("casosList");
    const preguntasEditor = document.getElementById("preguntasEditor");
    const btnAddCaso = document.getElementById("btnAddCaso");

    // ---- carga inicial de casos
    await reloadCasos(examId, casosList, preguntasEditor);

    // ---- alta de nuevo caso
    if (btnAddCaso) {
      btnAddCaso.onclick = async () => {
        const titulo = prompt("Título del caso clínico:");
        if (!titulo) return;
        const texto = prompt("Texto / enunciado del caso clínico:");
        if (!texto) return;
        const ordenStr = prompt("Orden (número para ordenar los casos):", "1");
        const orden = Number(ordenStr) || 0;

        try {
          await addDoc(collection(db, "casosClinicos"), {
            examId,
            titulo,
            texto,
            orden,
            createdAt: new Date().toISOString()
          });
          alert("Caso clínico agregado");
          await reloadCasos(examId, casosList, preguntasEditor);
        } catch (e) {
          console.error("addCaso error", e);
          alert("Error agregando caso clínico");
        }
      };
    }
  } catch (e) {
    console.error("openExamEditor error", e);
    alert("Error abriendo editor");
  }
}

async function reloadCasos(examId, casosList, preguntasEditor) {
  try {
    const qCasos = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId),
      orderBy("orden")
    );
    const snap = await getDocs(qCasos);

    casosList.innerHTML = "";
    if (snap.empty) {
      casosList.innerHTML = `<div class="small muted">Sin casos clínicos aún.</div>`;
      preguntasEditor.innerHTML = `<div class="small muted">Selecciona un caso para ver / editar sus preguntas.</div>`;
      return;
    }

    snap.forEach((cDoc) => {
      const cData = cDoc.data();
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <div><strong>${escapeHtml(cData.titulo || "Caso clínico")}</strong></div>
        <div class="small muted">Orden: ${cData.orden || 0}</div>
        <div style="margin-top:6px;">
          <button class="btn btn-sm btn-primary" data-accion="preguntas" data-id="${cDoc.id}">Preguntas</button>
          <button class="btn btn-sm" data-accion="editar" data-id="${cDoc.id}">Editar caso</button>
          <button class="btn btn-sm" data-accion="eliminar" data-id="${cDoc.id}">Eliminar</button>
        </div>
      `;
      casosList.appendChild(row);
    });

    // Delegación de eventos
    casosList.querySelectorAll("button").forEach((btn) => {
      btn.onclick = async () => {
        const accion = btn.getAttribute("data-accion");
        const cid = btn.getAttribute("data-id");
        if (!cid) return;

        if (accion === "preguntas") {
          await openPreguntasEditor(examId, cid, preguntasEditor);
        } else if (accion === "editar") {
          await editCaso(examId, cid, casosList, preguntasEditor);
        } else if (accion === "eliminar") {
          await deleteCaso(examId, cid, casosList, preguntasEditor);
        }
      };
    });

    // Mensaje por defecto en preguntasEditor
    preguntasEditor.innerHTML = `<div class="small muted">Selecciona "Preguntas" en algún caso clínico.</div>`;
  } catch (e) {
    console.error("reloadCasos error", e);
    casosList.innerHTML = `<div class="muted">Error cargando casos clínicos</div>`;
  }
}

async function editCaso(examId, casoId, casosList, preguntasEditor) {
  try {
    const cRef = doc(db, "casosClinicos", casoId);
    const cSnap = await getDoc(cRef);
    if (!cSnap.exists()) {
      alert("Caso no encontrado");
      return;
    }
    const data = cSnap.data();
    const titulo = prompt("Título del caso clínico:", data.titulo || "");
    if (!titulo) return;
    const texto = prompt("Texto del caso:", data.texto || "");
    if (!texto) return;
    const ordenStr = prompt("Orden:", String(data.orden || 0));
    const orden = Number(ordenStr) || 0;

    await updateDoc(cRef, { titulo, texto, orden });
    alert("Caso actualizado");
    await reloadCasos(examId, casosList, preguntasEditor);
  } catch (e) {
    console.error("editCaso error", e);
    alert("Error actualizando caso");
  }
}

async function deleteCaso(examId, casoId, casosList, preguntasEditor) {
  const ok = confirm("¿Eliminar este caso clínico y sus preguntas?");
  if (!ok) return;

  try {
    // Borrar preguntas asociadas
    const qPreg = query(
      collection(db, "preguntas"),
      where("casoId", "==", casoId)
    );
    const snapP = await getDocs(qPreg);
    const batchDeletes = [];
    snapP.forEach((pDoc) => {
      batchDeletes.push(deleteDoc(doc(db, "preguntas", pDoc.id)));
    });
    await Promise.all(batchDeletes);

    // Borrar caso
    await deleteDoc(doc(db, "casosClinicos", casoId));

    alert("Caso y preguntas asociadas eliminados");
    await reloadCasos(examId, casosList, preguntasEditor);
  } catch (e) {
    console.error("deleteCaso error", e);
    alert("Error eliminando caso");
  }
}

// ---- Editor de preguntas de un caso concreto ----
async function openPreguntasEditor(examId, casoId, preguntasEditor) {
  try {
    // Traer info del caso
    const cSnap = await getDoc(doc(db, "casosClinicos", casoId));
    const cData = cSnap.exists() ? cSnap.data() : { titulo: "Caso" };

    preguntasEditor.innerHTML = `
      <h5>Preguntas del caso</h5>
      <div class="small muted">${escapeHtml(cData.titulo || "")}</div>
      <div id="listaPreguntasCaso" style="margin-top:8px;">Cargando preguntas...</div>
      <button id="btnAddPreguntaCaso" class="btn primary" style="margin-top:8px;">
        Agregar pregunta
      </button>
    `;

    const lista = document.getElementById("listaPreguntasCaso");
    const btnAdd = document.getElementById("btnAddPreguntaCaso");

    await reloadPreguntasCaso(examId, casoId, lista);

    if (btnAdd) {
      btnAdd.onclick = async () => {
        await addPreguntaPrompt(examId, casoId, lista);
      };
    }
  } catch (e) {
    console.error("openPreguntasEditor error", e);
    preguntasEditor.innerHTML = `<div class="muted">Error cargando preguntas</div>`;
  }
}

async function reloadPreguntasCaso(examId, casoId, lista) {
  try {
    const qPreg = query(
      collection(db, "preguntas"),
      where("examId", "==", examId),
      where("casoId", "==", casoId),
      orderBy("orden")
    );
    const snap = await getDocs(qPreg);
    lista.innerHTML = "";

    if (snap.empty) {
      lista.innerHTML = `<div class="small muted">Sin preguntas en este caso.</div>`;
      return;
    }

    snap.forEach((pDoc) => {
      const d = pDoc.data();
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "8px";

      row.innerHTML = `
        <div><strong>${escapeHtml(d.pregunta || "")}</strong></div>
        <div class="small muted">Orden: ${d.orden || 0}</div>
        <div style="margin-top:6px;">
          <button class="btn btn-sm" data-accion="editar" data-id="${pDoc.id}">Editar</button>
          <button class="btn btn-sm" data-accion="eliminar" data-id="${pDoc.id}">Eliminar</button>
        </div>
      `;
      lista.appendChild(row);
    });

    lista.querySelectorAll("button").forEach((btn) => {
      btn.onclick = async () => {
        const accion = btn.getAttribute("data-accion");
        const pid = btn.getAttribute("data-id");
        if (!pid) return;

        if (accion === "editar") {
          await editPreguntaPrompt(pid, examId, casoId, lista);
        } else if (accion === "eliminar") {
          await deletePregunta(pid, examId, casoId, lista);
        }
      };
    });
  } catch (e) {
    console.error("reloadPreguntasCaso error", e);
    lista.innerHTML = `<div class="muted">Error cargando preguntas</div>`;
  }
}

async function addPreguntaPrompt(examId, casoId, lista) {
  const pregunta = prompt("Texto de la pregunta:");
  if (!pregunta) return;

  const optsStr = prompt("Opciones separadas por || (ej: Apendicitis||Colecistitis||Pancreatitis||Gastritis):");
  if (!optsStr) return;
  const opciones = optsStr.split("||").map((s) => s.trim()).filter(Boolean);
  if (opciones.length === 0) {
    alert("Debes agregar al menos una opción");
    return;
  }

  const idxStr = prompt("Índice de la opción correcta (0 para la primera, 1 para la segunda, etc):", "0");
  const correcta = Number(idxStr) || 0;

  const justificacion = prompt("Justificación de la respuesta (opcional):", "") || "";
  const ordenStr = prompt("Orden (número para ordenar las preguntas):", "1");
  const orden = Number(ordenStr) || 0;

  try {
    await addDoc(collection(db, "preguntas"), {
      examId,
      casoId,
      pregunta,
      opciones,
      correcta,
      justificacion,
      orden,
      createdAt: new Date().toISOString()
    });
    alert("Pregunta agregada");
    await reloadPreguntasCaso(examId, casoId, lista);
  } catch (e) {
    console.error("addPreguntaPrompt error", e);
    alert("Error agregando pregunta");
  }
}

async function editPreguntaPrompt(preguntaId, examId, casoId, lista) {
  try {
    const pRef = doc(db, "preguntas", preguntaId);
    const pSnap = await getDoc(pRef);
    if (!pSnap.exists()) {
      alert("Pregunta no encontrada");
      return;
    }
    const d = pSnap.data();

    const pregunta = prompt("Texto de la pregunta:", d.pregunta || "");
    if (!pregunta) return;

    const optsDefault = (d.opciones || []).join("||");
    const optsStr = prompt(
      "Opciones separadas por ||",
      optsDefault
    );
    if (!optsStr) return;
    const opciones = optsStr.split("||").map((s) => s.trim()).filter(Boolean);

    const idxStr = prompt(
      "Índice correcto (0 para la primera, etc):",
      String(d.correcta || 0)
    );
    const correcta = Number(idxStr) || 0;

    const justificacion = prompt(
      "Justificación:",
      d.justificacion || ""
    ) || "";

    const ordenStr = prompt(
      "Orden:",
      String(d.orden || 0)
    );
    const orden = Number(ordenStr) || 0;

    await updateDoc(pRef, {
      pregunta,
      opciones,
      correcta,
      justificacion,
      orden
    });

    alert("Pregunta actualizada");
    await reloadPreguntasCaso(examId, casoId, lista);
  } catch (e) {
    console.error("editPreguntaPrompt error", e);
    alert("Error actualizando pregunta");
  }
}

async function deletePregunta(preguntaId, examId, casoId, lista) {
  const ok = confirm("¿Eliminar esta pregunta?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "preguntas", preguntaId));
    alert("Pregunta eliminada");
    await reloadPreguntasCaso(examId, casoId, lista);
  } catch (e) {
    console.error("deletePregunta error", e);
    alert("Error eliminando pregunta");
  }
}
// ===============================
// app.js (Parte 3/3)
// Admin: usuarios, links sociales, init
// ===============================

// ---------------------- ADMIN: USUARIOS ----------------------
if (adminUsers) {
  adminUsers.onclick = async () => {
    const oldAreas = adminSidebar.querySelectorAll(".editor-area");
    oldAreas.forEach((n) => n.remove());

    const area = document.createElement("div");
    area.className = "editor-area";
    adminSidebar.appendChild(area);

    area.innerHTML = `
      <h4>Usuarios</h4>
      <div id="usersList">Cargando usuarios...</div>
    `;

    const usersList = document.getElementById("usersList");
    try {
      const snap = await getDocs(collection(db, "users"));
      usersList.innerHTML = "";

      if (snap.empty) {
        usersList.innerHTML = `<div class="small muted">Sin usuarios registrados.</div>`;
        return;
      }

      snap.forEach((uDoc) => {
        const d = uDoc.data();
        const row = document.createElement("div");
        row.className = "card";
        row.style.marginBottom = "8px";

        row.innerHTML = `
          <div>
            <strong>${escapeHtml(d.email || uDoc.id)}</strong>
            <div class="small muted">${escapeHtml(d.name || "")} - ${escapeHtml(d.role || "user")}</div>
          </div>
          <div style="margin-top:6px;">
            <button class="btn u_edit" data-uid="${uDoc.id}">Editar</button>
          </div>
        `;
        usersList.appendChild(row);
      });

      usersList.querySelectorAll(".u_edit").forEach((btn) => {
        btn.onclick = async () => {
          const uid = btn.getAttribute("data-uid");
          const uRef = doc(db, "users", uid);
          const uSnap = await getDoc(uRef);
          const data = uSnap.exists() ? uSnap.data() : {};

          const name = prompt("Nombre:", data.name || "");
          if (name === null) return;
          const role = prompt("Rol (admin/user):", data.role || "user");
          if (role === null) return;

          await setDoc(uRef, {
            ...data,
            name,
            role
          }, { merge: true });

          alert("Usuario actualizado");
          adminUsers.onclick(); // recargar
        };
      });
    } catch (e) {
      console.error("adminUsers error", e);
      usersList.innerHTML = `<div class="muted">Error cargando usuarios</div>`;
    }
  };
}

// ---------------------- ADMIN: LINKS SOCIALES ----------------------
if (adminLinks) {
  adminLinks.onclick = () => {
    const oldAreas = adminSidebar.querySelectorAll(".editor-area");
    oldAreas.forEach((n) => n.remove());

    const area = document.createElement("div");
    area.className = "editor-area";
    adminSidebar.appendChild(area);

    area.innerHTML = `
      <h4>Links Sociales</h4>
      <label>Instagram</label><input id="ln_ig" />
      <label>WhatsApp</label><input id="ln_wa" />
      <label>Telegram</label><input id="ln_tg" />
      <label>TikTok</label><input id="ln_tt" />
      <div style="margin-top:8px;">
        <button id="ln_save" class="btn primary">Guardar (solo UI)</button>
      </div>
      <div class="small muted" style="margin-top:6px;">
        Estos links solo se guardan en la interfaz (no en Firestore).
      </div>
    `;

    // precargar con href actuales
    const ig = document.getElementById("ln_ig");
    const wa = document.getElementById("ln_wa");
    const tg = document.getElementById("ln_tg");
    const tt = document.getElementById("ln_tt");
    const btnSave = document.getElementById("ln_save");

    if (ig) ig.value = linkInstagram?.href || "";
    if (wa) wa.value = linkWhatsApp?.href || "";
    if (tg) tg.value = linkTelegram?.href || "";
    if (tt) tt.value = linkTikTok?.href || "";

    if (btnSave) {
      btnSave.onclick = () => {
        if (ig && linkInstagram) linkInstagram.href = ig.value.trim();
        if (wa && linkWhatsApp) linkWhatsApp.href = wa.value.trim();
        if (tg && linkTelegram) linkTelegram.href = tg.value.trim();
        if (tt && linkTikTok) linkTikTok.href = tt.value.trim();
        alert("Links actualizados en la interfaz.");
      };
    }
  };
}

// ---------------------- ADMIN: LOGOUT LATERAL ----------------------
if (adminLogout) {
  adminLogout.onclick = doLogout;
}

// ---------------------- INIT ----------------------
async function init() {
  hide(studentScreen);
  hide(examScreen);
  hide(resultScreen);
  hide(adminSidebar);
  hide(editButtons);
  hide(editExamButtons);
  await loadSections();
}

init().catch((e) => console.error("init error", e));

// ===============================
// FIN DE app.js
// ===============================
