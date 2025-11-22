// app.js
// Panel ADMIN: secciones, exámenes, casos clínicos, preguntas, usuarios

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
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ===============================
// CONSTANTES
// ===============================
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

// ===============================
// DOM HELPERS
// ===============================
const $ = (id) => document.getElementById(id);

const sectionsList = $("sectionsList");
const btnNewSection = $("btnNewSection");
const adminNav = $("adminNav");

const screenLogin = $("screenLogin");
const screenExams = $("screenExams");
const screenExamEditor = $("screenExamEditor");
const screenUsers = $("screenUsers");

const currentSectionTitle = $("currentSectionTitle");
const examsList = $("examsList");

const examEditorTitle = $("examEditorTitle");
const btnBackToExams = $("btnBackToExams");
const examTitleInput = $("examTitleInput");
const examDescInput = $("examDescInput");
const examQuestionCount = $("examQuestionCount");
const examDurationLabel = $("examDurationLabel");
const btnSaveExamMeta = $("btnSaveExamMeta");
const btnDeleteExam = $("btnDeleteExam");
const casosList = $("casosList");
const newCasoTitulo = $("newCasoTitulo");
const newCasoTexto = $("newCasoTexto");
const btnAddCaso = $("btnAddCaso");

const usersList = $("usersList");
const btnNewUser = $("btnNewUser");
const userForm = $("userForm");
const userFormTitle = $("userFormTitle");
const userUidInput = $("userUidInput");
const userNameInput = $("userNameInput");
const userEmailInput = $("userEmailInput");
const userRoleInput = $("userRoleInput");
const userEstadoInput = $("userEstadoInput");
const userExpInput = $("userExpInput");
const btnSaveUser = $("btnSaveUser");
const btnCancelUser = $("btnCancelUser");

const inputEmail = $("inputEmail");
const inputPassword = $("inputPassword");
const btnLogin = $("btnLogin");
const btnCancel = $("btnCancel");
const loginMessage = $("loginMessage");
const userInfo = $("userInfo");
const authButtons = $("authButtons");

const mainCountdownEl = $("mainCountdown");
const linkInstagram = $("link-instagram");
const linkWhatsApp = $("link-whatsapp");
const linkTelegram = $("link-telegram");
const linkTikTok = $("link-tiktok");

// ===============================
// ESTADO GLOBAL
// ===============================
let currentUser = null;
let isAdmin = false;
let selectedSectionId = null;
let selectedSectionName = "";
let selectedExamId = null;

// ===============================
// UTILIDADES
// ===============================
function show(el) {
  if (!el) return;
  el.classList.remove("hidden");
}
function hide(el) {
  if (!el) return;
  el.classList.add("hidden");
}

function escapeHtml(s) {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showScreen(name) {
  const map = {
    login: screenLogin,
    exams: screenExams,
    examEditor: screenExamEditor,
    users: screenUsers
  };
  Object.entries(map).forEach(([key, el]) => {
    if (!el) return;
    if (key === name) show(el);
    else hide(el);
  });
}

// Cuenta regresiva ENARM (ejemplo 23-Sep-2026)
function startMainCountdown() {
  try {
    const target = new Date("2026-09-23T00:00:00");
    function tick() {
      const now = new Date();
      let diff = Math.floor((target - now) / 1000);
      if (!mainCountdownEl) return;
      if (diff <= 0) {
        mainCountdownEl.textContent = "ENARM iniciado";
        return;
      }
      const days = Math.floor(diff / 86400);
      diff -= days * 86400;
      const hrs = Math.floor(diff / 3600);
      diff -= hrs * 3600;
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      mainCountdownEl.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }
    tick();
    setInterval(tick, 1000);
  } catch (e) {
    console.warn("countdown error", e);
  }
}
startMainCountdown();

// ===============================
// SECCIONES
// ===============================
async function loadSections() {
  sectionsList.innerHTML = `<div class="small muted">Cargando secciones...</div>`;
  try {
    const snap = await getDocs(collection(db, "sections"));
    sectionsList.innerHTML = "";

    if (snap.empty) {
      sectionsList.innerHTML = `<div class="small muted">No hay secciones aún.</div>`;
      return;
    }

    const docs = [];
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => {
      const ao = a.order ?? 9999;
      const bo = b.order ?? 9999;
      if (ao !== bo) return ao - bo;
      const an = (a.name || a.nombre || "").toLowerCase();
      const bn = (b.name || b.nombre || "").toLowerCase();
      return an.localeCompare(bn);
    });

    docs.forEach((s) => {
      const name = s.name || s.nombre || "Sin nombre";
      const btn = document.createElement("button");
      btn.className = "section-item";
      btn.textContent = name;
      btn.dataset.id = s.id;
      btn.onclick = () => selectSection(s.id, name);
      sectionsList.appendChild(btn);
    });

    // Autoseleccionar primera si hay admin y aún no hay selección
    if (isAdmin && !selectedSectionId && docs.length > 0) {
      selectSection(docs[0].id, docs[0].name || docs[0].nombre || "Sección");
    }
  } catch (e) {
    console.error("loadSections", e);
    sectionsList.innerHTML = `<div class="small muted">Error cargando secciones.</div>`;
  }
}

function selectSection(id, nombre) {
  selectedSectionId = id;
  selectedSectionName = nombre || "Sección";
  document
    .querySelectorAll(".section-item")
    .forEach((b) => b.classList.toggle("active", b.dataset.id === id));

  currentSectionTitle.textContent = `Exámenes - ${selectedSectionName}`;

  if (isAdmin) {
    showScreen("exams");
    loadExamsForSection(id);
  }
}

async function createNewSection() {
  const nombre = prompt("Nombre de la sección:");
  if (!nombre) return;
  try {
    await addDoc(collection(db, "sections"), {
      name: nombre,
      order: 9999,
      createdAt: serverTimestamp()
    });
    await loadSections();
  } catch (e) {
    console.error("createNewSection", e);
    alert("Error creando sección");
  }
}

// ===============================
// EXÁMENES
// ===============================
async function loadExamsForSection(sectionId) {
  examsList.innerHTML = `<div class="small muted">Cargando exámenes...</div>`;
  if (!sectionId) return;

  try {
    const q = query(
      collection(db, "exams"),
      where("sectionId", "==", sectionId)
    );
    const snap = await getDocs(q);

    examsList.innerHTML = "";
    if (snap.empty) {
      examsList.innerHTML = `<div class="small muted">No hay exámenes en esta sección.</div>`;
      return;
    }

    const exams = [];
    snap.forEach((d) => exams.push({ id: d.id, ...d.data() }));
    exams.sort((a, b) => {
      const at = (a.title || a.nombre || "").toLowerCase();
      const bt = (b.title || b.nombre || "").toLowerCase();
      return at.localeCompare(bt);
    });

    exams.forEach((ex) => {
      const card = document.createElement("div");
      card.className = "card exam-card";

      const title = ex.title || ex.nombre || "Examen sin título";
      const questionCount = ex.questionCount || ex.totalPreguntas || 0;
      const duration = ex.duration || Math.ceil((questionCount * 75) / 60);

      card.innerHTML = `
        <div class="exam-card-main">
          <div class="exam-title">${escapeHtml(title)}</div>
          <div class="exam-meta">
            Preguntas: ${questionCount} · Tiempo estimado: ${duration} min
          </div>
          ${
            ex.description
              ? `<div class="small muted">${escapeHtml(ex.description)}</div>`
              : ""
          }
        </div>
        <div class="row">
          <button class="btn primary btn-open-exam" data-id="${ex.id}">
            Editar contenido
          </button>
          <button class="btn danger btn-del-exam" data-id="${ex.id}">
            Eliminar
          </button>
        </div>
      `;

      examsList.appendChild(card);
    });

    // listeners
    examsList.querySelectorAll(".btn-open-exam").forEach((b) => {
      b.onclick = () => openExamEditor(b.getAttribute("data-id"));
    });

    examsList.querySelectorAll(".btn-del-exam").forEach((b) => {
      b.onclick = () => deleteExamWithCascade(b.getAttribute("data-id"));
    });
  } catch (e) {
    console.error("loadExamsForSection", e);
    examsList.innerHTML = `<div class="small muted">Error cargando exámenes.</div>`;
  }
}

async function createNewExam() {
  if (!selectedSectionId) {
    alert("Selecciona una sección primero.");
    return;
  }
  try {
    const ref = await addDoc(collection(db, "exams"), {
      sectionId: selectedSectionId,
      title: "Nuevo examen",
      description: "",
      questionCount: 0,
      duration: 0,
      createdAt: serverTimestamp()
    });
    selectedExamId = ref.id;
    await openExamEditor(ref.id);
  } catch (e) {
    console.error("createNewExam", e);
    alert("Error creando examen");
  }
}

async function deleteExamWithCascade(examId) {
  if (!confirm("¿Eliminar este examen y todos sus casos/preguntas?")) return;
  try {
    // Eliminar preguntas
    const qp = query(
      collection(db, "preguntas"),
      where("examId", "==", examId)
    );
    const snapP = await getDocs(qp);
    for (const d of snapP.docs) {
      await deleteDoc(doc(db, "preguntas", d.id));
    }

    // Eliminar casos
    const qc = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId)
    );
    const snapC = await getDocs(qc);
    for (const d of snapC.docs) {
      await deleteDoc(doc(db, "casosClinicos", d.id));
    }

    // Eliminar examen
    await deleteDoc(doc(db, "exams", examId));
    if (selectedSectionId) await loadExamsForSection(selectedSectionId);
    alert("Examen eliminado");
  } catch (e) {
    console.error("deleteExamWithCascade", e);
    alert("Error eliminando examen");
  }
}

// ===============================
// EDITOR DE EXAMEN (CASOS + PREGUNTAS)
// ===============================
async function openExamEditor(examId) {
  selectedExamId = examId;
  showScreen("examEditor");

  examTitleInput.value = "";
  examDescInput.value = "";
  examQuestionCount.textContent = "0";
  examDurationLabel.textContent = "0 min";
  casosList.innerHTML = `<div class="small muted">Cargando examen...</div>`;

  try {
    const exRef = doc(db, "exams", examId);
    const exSnap = await getDoc(exRef);
    if (!exSnap.exists()) {
      alert("Examen no encontrado");
      showScreen("exams");
      return;
    }
    const exData = exSnap.data();
    const exTitle = exData.title || exData.nombre || "Examen sin título";

    examEditorTitle.textContent = exTitle;
    examTitleInput.value = exTitle;
    examDescInput.value = exData.description || "";

    // Cargar casos clínicos
    const qCasos = query(
      collection(db, "casosClinicos"),
      where("examId", "==", examId)
    );
    const snapCasos = await getDocs(qCasos);
    const casos = [];
    snapCasos.forEach((d) => casos.push({ id: d.id, ...d.data() }));
    casos.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

    // Cargar preguntas
    const qPreg = query(
      collection(db, "preguntas"),
      where("examId", "==", examId)
    );
    const snapPreg = await getDocs(qPreg);
    const preguntas = [];
    snapPreg.forEach((d) => preguntas.push({ id: d.id, ...d.data() }));

    // Calcular total y duración
    const totalQ = preguntas.length;
    const totalSeconds = totalQ * 75;
    const minutes = Math.ceil(totalSeconds / 60);
    examQuestionCount.textContent = String(totalQ);
    examDurationLabel.textContent = `${minutes} min`;

    // Actualizar examen con questionCount y duration
    await updateDoc(exRef, {
      questionCount: totalQ,
      duration: minutes
    });

    // Agrupar preguntas por casoId
    const preguntasPorCaso = {};
    preguntas.forEach((p) => {
      const cId = p.casoId || "SIN_CASO";
      if (!preguntasPorCaso[cId]) preguntasPorCaso[cId] = [];
      preguntasPorCaso[cId].push(p);
    });

    casosList.innerHTML = "";

    if (casos.length === 0) {
      casosList.innerHTML = `<div class="small muted">Aún no hay casos clínicos.</div>`;
    }

    casos.forEach((caso, idx) => {
      renderCasoCard(caso, idx + 1, preguntasPorCaso[caso.id] || []);
    });
  } catch (e) {
    console.error("openExamEditor", e);
    casosList.innerHTML = `<div class="small muted">Error cargando examen.</div>`;
  }
}

function renderCasoCard(caso, numero, preguntas) {
  const card = document.createElement("div");
  card.className = "card caso-card";
  card.dataset.casoId = caso.id;

  const titulo = caso.titulo || caso.title || `Caso ${numero}`;
  const texto = caso.texto || caso.descripcion || "";

  card.innerHTML = `
    <div class="caso-header">
      <div>
        <div class="caso-title">Caso ${numero}</div>
        <div class="small muted">ID: ${escapeHtml(caso.id)}</div>
      </div>
      <div class="row">
        <button class="btn btn-save-caso">Guardar caso</button>
        <button class="btn danger btn-del-caso">Eliminar</button>
      </div>
    </div>

    <label>
      Título del caso
      <input class="caso-titulo-input" type="text" value="${escapeHtml(
        titulo
      )}" />
    </label>

    <label>
      Texto / descripción del caso
      <textarea class="caso-texto-input" rows="3">${escapeHtml(
        texto
      )}</textarea>
    </label>

    <label>
      Orden
      <input class="caso-orden-input" type="number" value="${
        caso.orden ?? numero
      }" />
    </label>

    <div class="pregunta-list">
      <div class="small muted">Preguntas de este caso:</div>
    </div>

    <div class="new-question-block">
      <div class="small muted">Nueva pregunta para este caso</div>
      <label>
        Enunciado de la pregunta
        <input class="new-q-text" type="text" />
      </label>
      <label>
        Opción A
        <input class="new-q-optA" type="text" />
      </label>
      <label>
        Opción B
        <input class="new-q-optB" type="text" />
      </label>
      <label>
        Opción C
        <input class="new-q-optC" type="text" />
      </label>
      <label>
        Opción D
        <input class="new-q-optD" type="text" />
      </label>
      <label>
        Respuesta correcta
        <select class="new-q-correct">
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
      </label>
      <label>
        Justificación
        <textarea class="new-q-just" rows="2"></textarea>
      </label>
      <div class="row" style="margin-top:8px;">
        <button class="btn primary btn-add-question">Agregar pregunta</button>
      </div>
    </div>
  `;

  const preguntasListEl = card.querySelector(".pregunta-list");
  if (preguntas.length === 0) {
    const empty = document.createElement("div");
    empty.className = "small muted";
    empty.textContent = "Sin preguntas aún.";
    preguntasListEl.appendChild(empty);
  } else {
    preguntas
      .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999))
      .forEach((p, idx) => {
        const qCard = document.createElement("div");
        qCard.className = "pregunta-card";
        qCard.dataset.qid = p.id;

        const correcta = p.correcta ?? 0;
        const opts = p.opciones || [];
        qCard.innerHTML = `
          <div class="pregunta-header">
            <div>
              <span class="badge">Pregunta ${idx + 1}</span>
              <span class="small muted"> · ID: ${escapeHtml(p.id)}</span>
            </div>
            <div class="row">
              <button class="btn btn-save-q">Guardar</button>
              <button class="btn danger btn-del-q">Eliminar</button>
            </div>
          </div>

          <label>
            Enunciado
            <input class="q-text" type="text" value="${escapeHtml(
              p.pregunta || ""
            )}" />
          </label>

          <label>
            Opción A
            <input class="q-optA" type="text" value="${escapeHtml(
              opts[0] || ""
            )}" />
          </label>

          <label>
            Opción B
            <input class="q-optB" type="text" value="${escapeHtml(
              opts[1] || ""
            )}" />
          </label>

          <label>
            Opción C
            <input class="q-optC" type="text" value="${escapeHtml(
              opts[2] || ""
            )}" />
          </label>

          <label>
            Opción D
            <input class="q-optD" type="text" value="${escapeHtml(
              opts[3] || ""
            )}" />
          </label>

          <label>
            Respuesta correcta
            <select class="q-correct">
              <option value="0" ${correcta === 0 ? "selected" : ""}>A</option>
              <option value="1" ${correcta === 1 ? "selected" : ""}>B</option>
              <option value="2" ${correcta === 2 ? "selected" : ""}>C</option>
              <option value="3" ${correcta === 3 ? "selected" : ""}>D</option>
            </select>
          </label>

          <label>
            Justificación
            <textarea class="q-just" rows="2">${escapeHtml(
              p.justificacion || ""
            )}</textarea>
          </label>

          <label>
            Orden
            <input class="q-orden" type="number" value="${
              p.orden ?? idx + 1
            }" />
          </label>
        `;
        preguntasListEl.appendChild(qCard);

        // Guardar pregunta
        qCard.querySelector(".btn-save-q").onclick = async () => {
          const text = qCard.querySelector(".q-text").value.trim();
          const a = qCard.querySelector(".q-optA").value.trim();
          const b = qCard.querySelector(".q-optB").value.trim();
          const cVal = qCard.querySelector(".q-optC").value.trim();
          const dVal = qCard.querySelector(".q-optD").value.trim();
          const correct = Number(
            qCard.querySelector(".q-correct").value || "0"
          );
          const just = qCard.querySelector(".q-just").value.trim();
          const ord = Number(qCard.querySelector(".q-orden").value || "0");

          const opciones = [a, b, cVal, dVal].filter((x) => x !== "");
          if (!text || opciones.length === 0) {
            alert("La pregunta y al menos una opción son obligatorias.");
            return;
          }
          try {
            await updateDoc(doc(db, "preguntas", p.id), {
              examId: selectedExamId,
              casoId: caso.id,
              pregunta: text,
              opciones,
              correcta: correct,
              justificacion: just,
              orden: ord
            });
            alert("Pregunta guardada");
            await recomputeExamDuration(selectedExamId);
          } catch (e) {
            console.error("update question", e);
            alert("Error guardando pregunta");
          }
        };

        // Eliminar pregunta
        qCard.querySelector(".btn-del-q").onclick = async () => {
          if (!confirm("¿Eliminar esta pregunta?")) return;
          try {
            await deleteDoc(doc(db, "preguntas", p.id));
            alert("Pregunta eliminada");
            await openExamEditor(selectedExamId);
          } catch (e) {
            console.error("delete question", e);
            alert("Error eliminando pregunta");
          }
        };
      });
  }

  // Handlers de CASO
  card.querySelector(".btn-save-caso").onclick = async () => {
    const t = card.querySelector(".caso-titulo-input").value.trim();
    const tx = card.querySelector(".caso-texto-input").value.trim();
    const ord = Number(card.querySelector(".caso-orden-input").value || numero);
    try {
      await updateDoc(doc(db, "casosClinicos", caso.id), {
        examId: selectedExamId,
        titulo: t,
        texto: tx,
        orden: ord
      });
      alert("Caso guardado");
    } catch (e) {
      console.error("update caso", e);
      alert("Error guardando caso");
    }
  };

  card.querySelector(".btn-del-caso").onclick = async () => {
    if (!confirm("¿Eliminar este caso y sus preguntas?")) return;
    try {
      // borrar preguntas del caso
      const qp = query(
        collection(db, "preguntas"),
        where("examId", "==", selectedExamId),
        where("casoId", "==", caso.id)
      );
      const snap = await getDocs(qp);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "preguntas", d.id));
      }
      await deleteDoc(doc(db, "casosClinicos", caso.id));
      alert("Caso eliminado");
      await openExamEditor(selectedExamId);
    } catch (e) {
      console.error("delete caso", e);
      alert("Error eliminando caso");
    }
  };

  // Nueva pregunta para este caso
  card.querySelector(".btn-add-question").onclick = async () => {
    const textEl = card.querySelector(".new-q-text");
    const aEl = card.querySelector(".new-q-optA");
    const bEl = card.querySelector(".new-q-optB");
    const cEl = card.querySelector(".new-q-optC");
    const dEl = card.querySelector(".new-q-optD");
    const corEl = card.querySelector(".new-q-correct");
    const justEl = card.querySelector(".new-q-just");

    const text = textEl.value.trim();
    const a = aEl.value.trim();
    const b = bEl.value.trim();
    const cVal = cEl.value.trim();
    const dVal = dEl.value.trim();
    const correct = Number(corEl.value || "0");
    const just = justEl.value.trim();

    const opciones = [a, b, cVal, dVal].filter((x) => x !== "");
    if (!text || opciones.length === 0) {
      alert("La pregunta y al menos una opción son obligatorias.");
      return;
    }

    try {
      await addDoc(collection(db, "preguntas"), {
        examId: selectedExamId,
        casoId: caso.id,
        pregunta: text,
        opciones,
        correcta: correct,
        justificacion: just,
        orden: (preguntas?.length || 0) + 1,
        createdAt: serverTimestamp()
      });

      // limpiar
      textEl.value = "";
      aEl.value = "";
      bEl.value = "";
      cEl.value = "";
      dEl.value = "";
      corEl.value = "0";
      justEl.value = "";

      alert("Pregunta agregada");
      await openExamEditor(selectedExamId);
    } catch (e) {
      console.error("add question", e);
      alert("Error agregando pregunta");
    }
  };

  casosList.appendChild(card);
}

async function recomputeExamDuration(examId) {
  try {
    const q = query(
      collection(db, "preguntas"),
      where("examId", "==", examId)
    );
    const snap = await getDocs(q);
    const totalQ = snap.size;
    const totalSeconds = totalQ * 75;
    const minutes = Math.ceil(totalSeconds / 60);
    await updateDoc(doc(db, "exams", examId), {
      questionCount: totalQ,
      duration: minutes
    });
    if (examQuestionCount) examQuestionCount.textContent = String(totalQ);
    if (examDurationLabel) examDurationLabel.textContent = `${minutes} min`;
  } catch (e) {
    console.error("recomputeExamDuration", e);
  }
}

// Guardar meta examen
async function saveExamMeta() {
  if (!selectedExamId) return;
  const title = examTitleInput.value.trim() || "Examen sin título";
  const desc = examDescInput.value.trim();
  try {
    await updateDoc(doc(db, "exams", selectedExamId), {
      title,
      description: desc
    });
    alert("Examen guardado");
    examEditorTitle.textContent = title;
    if (selectedSectionId) await loadExamsForSection(selectedSectionId);
  } catch (e) {
    console.error("saveExamMeta", e);
    alert("Error guardando examen");
  }
}

// ===============================
// CASO NUEVO
// ===============================
async function addNewCasoClinico() {
  if (!selectedExamId) {
    alert("Primero abre un examen.");
    return;
  }
  const titulo = newCasoTitulo.value.trim();
  const texto = newCasoTexto.value.trim();
  if (!titulo || !texto) {
    alert("Título y texto del caso son obligatorios.");
    return;
  }
  try {
    await addDoc(collection(db, "casosClinicos"), {
      examId: selectedExamId,
      titulo,
      texto,
      orden: 9999,
      createdAt: serverTimestamp()
    });
    newCasoTitulo.value = "";
    newCasoTexto.value = "";
    alert("Caso agregado");
    await openExamEditor(selectedExamId);
  } catch (e) {
    console.error("addNewCasoClinico", e);
    alert("Error agregando caso");
  }
}

// ===============================
// USUARIOS (colección users)
// ===============================
async function loadUsers() {
  usersList.innerHTML = `<div class="small muted">Cargando usuarios...</div>`;
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

      const estado = d.estado || "habilitado";
      const role = d.role || "user";

      row.innerHTML = `
        <div class="user-row">
          <div class="user-row-main">
            <div><strong>${escapeHtml(d.name || "")}</strong></div>
            <div class="small muted">${escapeHtml(d.email || "")}</div>
            <div class="small muted">
              UID: ${escapeHtml(uDoc.id)} · Rol: ${escapeHtml(
        role
      )} · Estado: ${escapeHtml(estado)}
            </div>
            ${
              d.expiracion
                ? `<div class="small muted">Límite acceso: ${escapeHtml(
                    d.expiracion
                  )}</div>`
                : ""
            }
          </div>
          <div class="row">
            <button class="btn btn-edit-user" data-uid="${uDoc.id}">Editar</button>
            <button class="btn danger btn-del-user" data-uid="${uDoc.id}">Eliminar</button>
          </div>
        </div>
      `;
      usersList.appendChild(row);
    });

    usersList.querySelectorAll(".btn-edit-user").forEach((b) => {
      b.onclick = () => openUserForm(b.getAttribute("data-uid"));
    });

    usersList.querySelectorAll(".btn-del-user").forEach((b) => {
      b.onclick = () => deleteUserDoc(b.getAttribute("data-uid"));
    });
  } catch (e) {
    console.error("loadUsers", e);
    usersList.innerHTML = `<div class="small muted">Error cargando usuarios.</div>`;
  }
}

function openUserForm(uid = null) {
  show(userForm);
  if (!uid) {
    userFormTitle.textContent = "Nuevo usuario";
    userUidInput.value = "";
    userEmailInput.value = "";
    userNameInput.value = "";
    userRoleInput.value = "user";
    userEstadoInput.value = "habilitado";
    userExpInput.value = "";
    userUidInput.disabled = false;
    userForm.dataset.uid = "";
  } else {
    userFormTitle.textContent = "Editar usuario";
    userForm.dataset.uid = uid;
    userUidInput.value = uid;
    userUidInput.disabled = true;
    (async () => {
      try {
        const uSnap = await getDoc(doc(db, "users", uid));
        if (uSnap.exists()) {
          const d = uSnap.data();
          userEmailInput.value = d.email || "";
          userNameInput.value = d.name || "";
          userRoleInput.value = d.role || "user";
          userEstadoInput.value = d.estado || "habilitado";
          userExpInput.value = d.expiracion || "";
        }
      } catch (e) {
        console.error("openUserForm load", e);
      }
    })();
  }
}

async function saveUserForm() {
  const uid = userForm.dataset.uid || userUidInput.value.trim();
  const email = userEmailInput.value.trim();
  const name = userNameInput.value.trim();
  const role = userRoleInput.value;
  const estado = userEstadoInput.value;
  const expiracion = userExpInput.value || "";

  if (!uid || !email) {
    alert("UID y email son obligatorios.");
    return;
  }

  try {
    await setDoc(
      doc(db, "users", uid),
      {
        email,
        name,
        role,
        estado,
        expiracion,
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
    alert("Usuario guardado");
    hide(userForm);
    await loadUsers();
  } catch (e) {
    console.error("saveUserForm", e);
    alert("Error guardando usuario");
  }
}

async function deleteUserDoc(uid) {
  if (!confirm("¿Eliminar este usuario de la colección users?")) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    alert("Usuario eliminado");
    await loadUsers();
  } catch (e) {
    console.error("deleteUserDoc", e);
    alert("Error eliminando usuario");
  }
}

// ===============================
// AUTH
// ===============================
async function doLogin() {
  const email = (inputEmail.value || "").trim();
  const pass = (inputPassword.value || "").trim();
  if (!email || !pass) {
    loginMessage.textContent = "Ingresa correo y contraseña.";
    return;
  }
  try {
    loginMessage.textContent = "Conectando...";
    await signInWithEmailAndPassword(auth, email, pass);
    loginMessage.textContent = "";
  } catch (e) {
    console.error("login error", e);
    loginMessage.textContent = "Credenciales inválidas.";
  }
}

async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("logout", e);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    isAdmin = false;
    userInfo.textContent = "";
    authButtons.innerHTML = "";
    hide(adminNav);
    hide(btnNewSection);
    selectedExamId = null;

    showScreen("login");
    await loadSections(); // secciones visibles aunque no haya admin
    return;
  }

  // Usuario autenticado
  let role = "user";
  let estado = "habilitado";
  let expiracion = "";

  try {
    const uSnap = await getDoc(doc(db, "users", user.uid));
    if (uSnap.exists()) {
      const d = uSnap.data();
      role = d.role || role;
      estado = d.estado || estado;
      expiracion = d.expiracion || "";
    }
  } catch (e) {
    console.error("load user doc", e);
  }

  // Checar expiración
  if (expiracion) {
    try {
      const today = new Date();
      const expDate = new Date(expiracion + "T23:59:59");
      if (today > expDate) {
        alert("Acceso expirado. Contacta al administrador.");
        await signOut(auth);
        return;
      }
    } catch (e) {
      console.warn("exp parse", e);
    }
  }

  if (estado === "inhabilitado") {
    alert("Tu usuario está inhabilitado.");
    await signOut(auth);
    return;
  }

  currentUser = { uid: user.uid, email: user.email, role, estado, expiracion };
  isAdmin = user.uid === ADMIN_UID || role === "admin";

  userInfo.textContent = `${user.email} (${role})`;
  authButtons.innerHTML =
    '<button id="btnLogoutTop" class="btn">Salir</button>';
  const btnLogoutTop = $("btnLogoutTop");
  if (btnLogoutTop) btnLogoutTop.onclick = doLogout;

  // Mostrar opciones admin si corresponde
  if (isAdmin) {
    show(adminNav);
    show(btnNewSection);
    showScreen("exams");
    await loadSections();
    if (selectedSectionId) {
      await loadExamsForSection(selectedSectionId);
    }
  } else {
    // Por ahora, si no es admin, solo ve login (luego se integrará modo estudiante)
    alert("Este panel es solo para administradores.");
    await signOut(auth);
  }
});

// ===============================
// EVENTOS UI
// ===============================
if (btnLogin) btnLogin.onclick = doLogin;
if (btnCancel)
  btnCancel.onclick = () => {
    inputEmail.value = "";
    inputPassword.value = "";
    loginMessage.textContent = "";
  };

if (btnNewSection) btnNewSection.onclick = createNewSection;

if (btnNewExam) btnNewExam.onclick = createNewExam;

if (btnBackToExams)
  btnBackToExams.onclick = () => {
    if (selectedSectionId) {
      showScreen("exams");
      loadExamsForSection(selectedSectionId);
    } else {
      showScreen("exams");
    }
  };

if (btnSaveExamMeta) btnSaveExamMeta.onclick = saveExamMeta;
if (btnDeleteExam)
  btnDeleteExam.onclick = () => {
    if (selectedExamId) deleteExamWithCascade(selectedExamId);
  };

if (btnAddCaso) btnAddCaso.onclick = addNewCasoClinico;

// Navegación admin izquierda
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.onclick = () => {
    const view = btn.getAttribute("data-view");
    if (view === "exams") {
      showScreen("exams");
      if (selectedSectionId) loadExamsForSection(selectedSectionId);
    } else if (view === "users") {
      showScreen("users");
      loadUsers();
    }
  };
});

// Usuarios
if (btnNewUser)
  btnNewUser.onclick = () => {
    openUserForm(null);
  };

if (btnSaveUser) btnSaveUser.onclick = saveUserForm;
if (btnCancelUser)
  btnCancelUser.onclick = () => {
    hide(userForm);
  };

// ===============================
// INIT
// ===============================
(async function init() {
  showScreen("login");
  await loadSections();

  // Social links: puedes dejar vacíos o poner tus URLs
  if (linkInstagram) linkInstagram.href = linkInstagram.href || "";
  if (linkWhatsApp) linkWhatsApp.href = linkWhatsApp.href || "";
  if (linkTelegram) linkTelegram.href = linkTelegram.href || "";
  if (linkTikTok) linkTikTok.href = linkTikTok.href || "";
})();
