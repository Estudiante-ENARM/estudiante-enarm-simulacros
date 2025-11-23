// ===========================================================
// APP.JS — Plataforma ENARM (ADMIN + ESTUDIANTE)
// Código totalmente reescrito y compatible con Firestore
// ===========================================================

import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc
} from "./firebase.js";


// ===========================================================
// UTILIDADES
// ===========================================================

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function clear(el) { el.innerHTML = ""; }

function escapeHTML(txt) {
  if (!txt) return "";
  return txt.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}


// ===========================================================
// REFERENCIAS DOM
// ===========================================================

const loginScreen = qs("#loginScreen");
const inputEmail = qs("#inputEmail");
const inputPassword = qs("#inputPassword");
const btnLogin = qs("#btnLogin");
const loginMessage = qs("#loginMessage");

const userInfo = qs("#userInfo");
const authButtons = qs("#authButtons");

const leftSidebar = qs("#leftSidebar");
const adminSidebar = qs("#adminSidebar");

const sectionsList = qs("#sectionsList");

const examsScreen = qs("#examsScreen");
const examsList = qs("#examsList");
const sectionTitle = qs("#sectionTitle");
const examsAdminControls = qs("#examsAdminControls");

const examEditorScreen = qs("#examEditorScreen");
const examTitleEditor = qs("#examTitleEditor");
const casesList = qs("#casesList");

const btnAdminAddSection = qs("#btnAdminAddSection");
const btnAdminUsers = qs("#btnAdminUsers");
const btnAdminIcons = qs("#btnAdminIcons");
const btnAdminLogout = qs("#btnAdminLogout");

const linkInstagram = qs("#link-instagram");
const linkWhatsApp = qs("#link-whatsapp");
const linkTelegram = qs("#link-telegram");
const linkTikTok = qs("#link-tiktok");


// ===========================================================
// ESTADO GLOBAL
// ===========================================================

let currentUser = null;
let isAdmin = false;
let currentSectionId = null;
let currentExamId = null;


// ===========================================================
// AUTENTICACIÓN
// ===========================================================

// LOGIN
if (btnLogin) {
  btnLogin.onclick = async () => {
    loginMessage.textContent = "";

    const email = inputEmail.value.trim();
    const pass = inputPassword.value.trim();
    if (!email || !pass) {
      loginMessage.textContent = "Ingresa correo y contraseña.";
      return;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await loadUser(res.user.uid);
    } catch (e) {
      console.error(e);
      loginMessage.textContent = "Usuario o contraseña incorrectos.";
    }
  };
}


// LOGOUT
async function doLogout() {
  await signOut(auth);
  currentUser = null;
  isAdmin = false;

  hide(adminSidebar);

  show(loginScreen);
  hide(examsScreen);
  hide(examEditorScreen);

  authButtons.innerHTML = "";
  userInfo.textContent = "";
}


// CARGAR USER + ROLE
async function loadUser(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Usuario existe en Auth pero no en users
    loginMessage.textContent = "Tu usuario no está registrado en la plataforma.";
    return;
  }

  currentUser = { id: uid, ...snap.data() };
  isAdmin = currentUser.role === "admin";

  userInfo.textContent = currentUser.name + " (" + currentUser.role + ")";

  authButtons.innerHTML = `<button class="btn" id="btnLogout">Cerrar sesión</button>`;
  qs("#btnLogout").onclick = doLogout;

  hide(loginScreen);

  if (isAdmin) {
    show(adminSidebar);
  } else {
    hide(adminSidebar);
  }

  await loadSections();
}


// ===========================================================
// SECCIONES
// ===========================================================

async function loadSections() {
  clear(sectionsList);

  const q = query(collection(db, "sections"), orderBy("order"));
  const snap = await getDocs(q);

  snap.forEach(docu => {
    const d = docu.data();
    const div = document.createElement("div");
    div.className = "section-item";
    div.textContent = d.name;
    div.dataset.id = docu.id;

    div.onclick = () => {
      currentSectionId = docu.id;
      loadExams(docu.id, d.name);
    };

    sectionsList.appendChild(div);
  });

  // Botón admin: agregar sección
  if (isAdmin && btnAdminAddSection) {
    btnAdminAddSection.onclick = () => adminAddSection();
  }
}


// ===========================================================
// MÉTODO: AGREGAR SECCIÓN
// ===========================================================

async function adminAddSection() {
  const name = prompt("Nombre de la sección:");
  if (!name) return;

  const order = Number(prompt("Orden numérico:") || 1);

  await addDoc(collection(db, "sections"), {
    name,
    order,
    createdAt: serverTimestamp()
  });

  alert("Sección agregada.");
  await loadSections();
}
// ===========================================================
// EXÁMENES – LISTADO PRINCIPAL
// ===========================================================

async function loadExams(sectionId, sectionName) {
  currentExamId = null;

  show(examsScreen);
  hide(examEditorScreen);

  sectionTitle.textContent = sectionName;

  clear(examsList);

  try {
    const q = query(
      collection(db, "exams"),
      where("sectionId", "==", sectionId),
      orderBy("createdAt", "asc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      examsList.innerHTML = `<div class="muted">No hay exámenes en esta sección.</div>`;
      return;
    }

    snap.forEach(examDoc => {
      const ex = examDoc.data();

      const box = document.createElement("div");
      box.className = "examBox";

      box.innerHTML = `
        <div>
          <div class="title">${escapeHTML(ex.title)}</div>
          <div class="meta">${escapeHTML(ex.description || "")}</div>
        </div>
        <div class="examActions">
          <button class="btn openExam" data-id="${examDoc.id}">Abrir</button>
          ${isAdmin ? `<button class="btn danger delExam" data-id="${examDoc.id}">Eliminar</button>` : ""}
        </div>
      `;

      examsList.appendChild(box);
    });

    // abrir examen
    examsList.querySelectorAll(".openExam").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        openExamEditor(id);
      };
    });

    // eliminar examen
    if (isAdmin) {
      examsList.querySelectorAll(".delExam").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;

          if (!confirm("¿Eliminar examen completo? Esto borra casos y preguntas.")) return;

          await deleteExamCascade(id);

          alert("Examen y todo su contenido eliminado.");
          loadExams(sectionId, sectionName);
        };
      });
    }

  } catch (e) {
    console.error("loadExams error:", e);
    examsList.innerHTML = `<div class="muted">Error cargando los exámenes.</div>`;
  }
}


// ===========================================================
// BORRADO COMPLETO DE EXAMEN
// ===========================================================

async function deleteExamCascade(examId) {

  // borrar casos
  const casosSnap = await getDocs(
    query(collection(db, "casosClinicos"), where("examId", "==", examId))
  );

  for (const caso of casosSnap.docs) {
    const casoId = caso.id;

    // borrar preguntas de cada caso
    const preguntasSnap = await getDocs(
      query(collection(db, "preguntas"), where("casoId", "==", casoId))
    );

    for (const preg of preguntasSnap.docs) {
      await deleteDoc(doc(db, "preguntas", preg.id));
    }

    // borrar caso
    await deleteDoc(doc(db, "casosClinicos", casoId));
  }

  // borrar examen
  await deleteDoc(doc(db, "exams", examId));
}


// ===========================================================
// ADMIN: CREAR NUEVO EXAMEN
// ===========================================================

if (qs("#btnAdminAddExam")) {
  qs("#btnAdminAddExam").onclick = async () => {

    if (!currentSectionId) {
      alert("Selecciona una sección primero.");
      return;
    }

    const title = prompt("Título del examen:");
    if (!title) return;

    const desc = prompt("Descripción:");
    const examRef = await addDoc(collection(db, "exams"), {
      sectionId: currentSectionId,
      title,
      description: desc || "",
      duration: 0, // luego se calcula automáticamente
      createdAt: serverTimestamp()
    });

    alert("Examen creado.");
    loadExams(currentSectionId, sectionTitle.textContent);
    openExamEditor(examRef.id);
  };
}


// ===========================================================
// ABRIR EDITOR DE EXAMEN
// ===========================================================

async function openExamEditor(examId) {
  currentExamId = examId;

  hide(examsScreen);
  show(examEditorScreen);

  clear(casesList);

  const ref = doc(db, "exams", examId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Examen no encontrado.");
    return;
  }

  const exam = snap.data();
  examTitleEditor.value = exam.title;

  await loadCases(examId);
}


// ===========================================================
// GUARDAR CAMBIOS DEL EXAMEN
// ===========================================================

if (qs("#btnSaveExam")) {
  qs("#btnSaveExam").onclick = async () => {
    if (!currentExamId) return;

    const ref = doc(db, "exams", currentExamId);
    await updateDoc(ref, {
      title: examTitleEditor.value.trim()
    });

    alert("Examen actualizado.");
  };
}


// ===========================================================
// CASOS CLÍNICOS
// ===========================================================

async function loadCases(examId) {
  clear(casesList);

  const q = query(
    collection(db, "casosClinicos"),
    where("examId", "==", examId),
    orderBy("orden")
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    casesList.innerHTML = `<div class="muted">No hay casos clínicos.</div>`;
    return;
  }

  snap.forEach(docu => {
    const c = docu.data();
    const wrapper = document.createElement("div");
    wrapper.className = "caseBlock";

    wrapper.innerHTML = `
      <h4>Caso clínico</h4>

      <label>Título</label>
      <input class="case_title" data-id="${docu.id}" value="${escapeHTML(c.titulo)}">

      <label>Texto</label>
      <textarea class="case_text" data-id="${docu.id}">${escapeHTML(c.texto)}</textarea>

      <div class="small muted">Preguntas:</div>
      <div class="pregList" id="preg_${docu.id}"></div>

      <div class="caseBtns">
        <button class="btn addPreg" data-id="${docu.id}">Agregar pregunta</button>
        <button class="btn danger delCase" data-id="${docu.id}">Eliminar caso</button>
      </div>
    `;

    casesList.appendChild(wrapper);

    // cargar preguntas del caso
    loadPreguntas(docu.id);

    // listeners
    wrapper.querySelector(".delCase").onclick = () => deleteCase(docu.id);
    wrapper.querySelector(".addPreg").onclick = () => addPregunta(docu.id);

    wrapper.querySelector(".case_title").onchange = e => updateCase(docu.id, "titulo", e.target.value);
    wrapper.querySelector(".case_text").onchange = e => updateCase(docu.id, "texto", e.target.value);
  });
}


async function updateCase(id, field, value) {
  await updateDoc(doc(db, "casosClinicos", id), { [field]: value });
}


// ===========================================================
// AGREGAR CASO CLÍNICO
// ===========================================================

if (qs("#btnAddCase")) {
  qs("#btnAddCase").onclick = async () => {
    if (!currentExamId) return;

    const titulo = prompt("Título del caso:");
    if (!titulo) return;

    await addDoc(collection(db, "casosClinicos"), {
      examId: currentExamId,
      titulo,
      texto: "",
      orden: Date.now(),
      createdAt: serverTimestamp()
    });

    loadCases(currentExamId);
  };
}


// ===========================================================
// ELIMINAR CASO (Y PREGUNTAS)
// ===========================================================

async function deleteCase(casoId) {
  if (!confirm("¿Eliminar caso clínico y todas sus preguntas?")) return;

  const pregSnap = await getDocs(
    query(collection(db, "preguntas"), where("casoId", "==", casoId))
  );

  for (const p of pregSnap.docs) {
    await deleteDoc(doc(db, "preguntas", p.id));
  }

  await deleteDoc(doc(db, "casosClinicos", casoId));

  alert("Caso eliminado.");
  loadCases(currentExamId);
}
// ===========================================================
// PREGUNTAS – CARGAR TODAS LAS PREGUNTAS DE UN CASO
// ===========================================================

async function loadPreguntas(casoId) {
  const cont = qs(`#preg_${casoId}`);
  clear(cont);

  const q = query(
    collection(db, "preguntas"),
    where("casoId", "==", casoId),
    orderBy("orden")
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    cont.innerHTML = `<div class="small muted">No hay preguntas.</div>`;
    return;
  }

  snap.forEach(p => {
    const d = p.data();

    const block = document.createElement("div");
    block.className = "pregBlock";

    block.innerHTML = `
      <label>Pregunta</label>
      <textarea class="preg_pregunta" data-id="${p.id}">${escapeHTML(d.pregunta)}</textarea>

      <label>Opción A</label>
      <input class="optA" data-id="${p.id}" value="${escapeHTML(d.opciones[0] || "")}">

      <label>Opción B</label>
      <input class="optB" data-id="${p.id}" value="${escapeHTML(d.opciones[1] || "")}">

      <label>Opción C</label>
      <input class="optC" data-id="${p.id}" value="${escapeHTML(d.opciones[2] || "")}">

      <label>Opción D</label>
      <input class="optD" data-id="${p.id}" value="${escapeHTML(d.opciones[3] || "")}">

      <label>Correcta (0-3)</label>
      <input type="number" min="0" max="3" class="preg_correcta" data-id="${p.id}" value="${d.correcta}">

      <label>Justificación</label>
      <textarea class="preg_just" data-id="${p.id}">${escapeHTML(d.justificacion || "")}</textarea>

      <div class="pregBtns">
        <button class="btn danger delPreg" data-id="${p.id}">Eliminar pregunta</button>
      </div>
    `;

    cont.appendChild(block);

    // listeners de edición
    block.querySelector(".preg_pregunta").onchange = e => updatePregunta(p.id, "pregunta", e.target.value);
    block.querySelector(".optA").onchange = e => updateOption(p.id, 0, e.target.value);
    block.querySelector(".optB").onchange = e => updateOption(p.id, 1, e.target.value);
    block.querySelector(".optC").onchange = e => updateOption(p.id, 2, e.target.value);
    block.querySelector(".optD").onchange = e => updateOption(p.id, 3, e.target.value);
    block.querySelector(".preg_correcta").onchange = e => updatePregunta(p.id, "correcta", Number(e.target.value));
    block.querySelector(".preg_just").onchange = e => updatePregunta(p.id, "justificacion", e.target.value);

    block.querySelector(".delPreg").onclick = () => deletePregunta(p.id);
  });
}


// ===========================================================
// AGREGAR UNA NUEVA PREGUNTA
// ===========================================================

async function addPregunta(casoId) {
  await addDoc(collection(db, "preguntas"), {
    examId: currentExamId,
    casoId,
    pregunta: "",
    opciones: ["", "", "", ""],
    correcta: 0,
    justificacion: "",
    orden: Date.now(),
    createdAt: serverTimestamp()
  });

  await loadPreguntas(casoId);
  await recalcDuration(currentExamId);
}


// ===========================================================
// ACTUALIZAR PREGUNTA
// ===========================================================

async function updatePregunta(pId, field, value) {
  await updateDoc(doc(db, "preguntas", pId), { [field]: value });
  await recalcDuration(currentExamId);
}


// ===========================================================
// ACTUALIZAR OPCIÓN INDIVIDUAL
// ===========================================================

async function updateOption(pId, index, value) {
  const ref = doc(db, "preguntas", pId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const d = snap.data();
  const arr = d.opciones || ["", "", "", ""];

  arr[index] = value;

  await updateDoc(ref, { opciones: arr });
}


// ===========================================================
// ELIMINAR PREGUNTA
// ===========================================================

async function deletePregunta(pId) {
  if (!confirm("¿Eliminar esta pregunta?")) return;

  await deleteDoc(doc(db, "preguntas", pId));

  // recargar visual
  const snap = await getDoc(doc(db, "preguntas", pId));

  await loadCases(currentExamId);
  await recalcDuration(currentExamId);
}


// ===========================================================
// RECALCULAR DURACIÓN AUTOMÁTICA DEL EXAMEN
// ===========================================================

async function recalcDuration(examId) {
  // contar preguntas totales del examen
  const q = query(
    collection(db, "preguntas"),
    where("examId", "==", examId)
  );

  const snap = await getDocs(q);
  const numPreguntas = snap.size;

  const totalSegundos = numPreguntas * 75;
  const minutos = Math.ceil(totalSegundos / 60);

  await updateDoc(doc(db, "exams", examId), {
    duration: minutos
  });

  examDurationLabel.textContent = `${minutos} min`;
}
// ===========================================================
// PREGUNTAS – CARGAR TODAS LAS PREGUNTAS DE UN CASO
// ===========================================================

async function loadPreguntas(casoId) {
  const cont = qs(`#preg_${casoId}`);
  clear(cont);

  const q = query(
    collection(db, "preguntas"),
    where("casoId", "==", casoId),
    orderBy("orden")
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    cont.innerHTML = `<div class="small muted">No hay preguntas.</div>`;
    return;
  }

  snap.forEach(p => {
    const d = p.data();

    const block = document.createElement("div");
    block.className = "pregBlock";

    block.innerHTML = `
      <label>Pregunta</label>
      <textarea class="preg_pregunta" data-id="${p.id}">${escapeHTML(d.pregunta)}</textarea>

      <label>Opción A</label>
      <input class="optA" data-id="${p.id}" value="${escapeHTML(d.opciones[0] || "")}">

      <label>Opción B</label>
      <input class="optB" data-id="${p.id}" value="${escapeHTML(d.opciones[1] || "")}">

      <label>Opción C</label>
      <input class="optC" data-id="${p.id}" value="${escapeHTML(d.opciones[2] || "")}">

      <label>Opción D</label>
      <input class="optD" data-id="${p.id}" value="${escapeHTML(d.opciones[3] || "")}">

      <label>Correcta (0-3)</label>
      <input type="number" min="0" max="3" class="preg_correcta" data-id="${p.id}" value="${d.correcta}">

      <label>Justificación</label>
      <textarea class="preg_just" data-id="${p.id}">${escapeHTML(d.justificacion || "")}</textarea>

      <div class="pregBtns">
        <button class="btn danger delPreg" data-id="${p.id}">Eliminar pregunta</button>
      </div>
    `;

    cont.appendChild(block);

    // listeners de edición
    block.querySelector(".preg_pregunta").onchange = e => updatePregunta(p.id, "pregunta", e.target.value);
    block.querySelector(".optA").onchange = e => updateOption(p.id, 0, e.target.value);
    block.querySelector(".optB").onchange = e => updateOption(p.id, 1, e.target.value);
    block.querySelector(".optC").onchange = e => updateOption(p.id, 2, e.target.value);
    block.querySelector(".optD").onchange = e => updateOption(p.id, 3, e.target.value);
    block.querySelector(".preg_correcta").onchange = e => updatePregunta(p.id, "correcta", Number(e.target.value));
    block.querySelector(".preg_just").onchange = e => updatePregunta(p.id, "justificacion", e.target.value);

    block.querySelector(".delPreg").onclick = () => deletePregunta(p.id);
  });
}


// ===========================================================
// AGREGAR UNA NUEVA PREGUNTA
// ===========================================================

async function addPregunta(casoId) {
  await addDoc(collection(db, "preguntas"), {
    examId: currentExamId,
    casoId,
    pregunta: "",
    opciones: ["", "", "", ""],
    correcta: 0,
    justificacion: "",
    orden: Date.now(),
    createdAt: serverTimestamp()
  });

  await loadPreguntas(casoId);
  await recalcDuration(currentExamId);
}


// ===========================================================
// ACTUALIZAR PREGUNTA
// ===========================================================

async function updatePregunta(pId, field, value) {
  await updateDoc(doc(db, "preguntas", pId), { [field]: value });
  await recalcDuration(currentExamId);
}


// ===========================================================
// ACTUALIZAR OPCIÓN INDIVIDUAL
// ===========================================================

async function updateOption(pId, index, value) {
  const ref = doc(db, "preguntas", pId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const d = snap.data();
  const arr = d.opciones || ["", "", "", ""];

  arr[index] = value;

  await updateDoc(ref, { opciones: arr });
}


// ===========================================================
// ELIMINAR PREGUNTA
// ===========================================================

async function deletePregunta(pId) {
  if (!confirm("¿Eliminar esta pregunta?")) return;

  await deleteDoc(doc(db, "preguntas", pId));

  // recargar visual
  const snap = await getDoc(doc(db, "preguntas", pId));

  await loadCases(currentExamId);
  await recalcDuration(currentExamId);
}


// ===========================================================
// RECALCULAR DURACIÓN AUTOMÁTICA DEL EXAMEN
// ===========================================================

async function recalcDuration(examId) {
  // contar preguntas totales del examen
  const q = query(
    collection(db, "preguntas"),
    where("examId", "==", examId)
  );

  const snap = await getDocs(q);
  const numPreguntas = snap.size;

  const totalSegundos = numPreguntas * 75;
  const minutos = Math.ceil(totalSegundos / 60);

  await updateDoc(doc(db, "exams", examId), {
    duration: minutos
  });

  examDurationLabel.textContent = `${minutos} min`;
}
