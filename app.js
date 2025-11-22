// app.js - Panel ADMIN completo (secciones, exámenes, casos clínicos, preguntas, usuarios)
// Solo modo administrador. Luego se construye el modo estudiante aparte.

// ------------ IMPORTS FIREBASE (modular v9) ------------
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

// ------------ CONFIG FIREBASE (la tuya) ------------
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

// UID de administrador "dueño"
const ROOT_ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

// ------------ HELPERS DOM / UTIL ------------
const $ = (id) => document.getElementById(id);

function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function setActive(el, active) {
  if (!el) return;
  if (active) el.classList.add("active");
  else el.classList.remove("active");
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// ------------ ESTADO GLOBAL ------------
let currentUser = null;          // { uid, email, role, estado, expiracion }
let currentSectionId = null;
let currentSectionName = "";
let currentExamId = null;

// ------------ SELECTORES ------------
const screenLogin = $("screenLogin");
const screenAdmin = $("screenAdmin");

const inputEmail = $("inputEmail");
const inputPassword = $("inputPassword");
const btnLogin = $("btnLogin");
const btnCancel = $("btnCancel");
const loginMessage = $("loginMessage");

const userInfo = $("userInfo");
const topbarActions = $("topbarActions");

const sectionsList = $("sectionsList");
const btnAddSection = $("btnAddSection");
const btnViewExams = $("btnViewExams");
const btnViewUsers = $("btnViewUsers");
const btnLogoutSide = $("btnLogoutSide");

const currentSectionNameEl = $("currentSectionName");
const btnToggleNewExam = $("btnToggleNewExam");

const newExamPanel = $("newExamPanel");
const newExamTitle = $("newExamTitle");
const newExamDescription = $("newExamDescription");
const btnCreateExam = $("btnCreateExam");
const btnCancelNewExam = $("btnCancelNewExam");
const examsList = $("examsList");

const viewExams = $("viewExams");
const viewExamEditor = $("viewExamEditor");
const viewUsers = $("viewUsers");

// ------------ AUTH ------------
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

async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("logout error", e);
  }
}

// Escuchar cambios de sesión
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      currentUser = null;
      currentSectionId = null;
      currentExamId = null;

      userInfo.textContent = "";
      topbarActions.innerHTML = "";

      hide(screenAdmin);
      show(screenLogin);
      hide(btnLogoutSide);
      return;
    }

    // Cargar documento de usuarios
    const uRef = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);
    let role = "user";
    let estado = "habilitado";
    let expiracion = null;
    let name = "";

    if (uSnap.exists()) {
      const d = uSnap.data();
      role = d.role || "user";
      estado = d.estado || "habilitado";
      expiracion = d.expiracion || null;
      name = d.name || d.usuario || "";
    }

    // Forzar a admin si es el ROOT
    if (user.uid === ROOT_ADMIN_UID) {
      role = "admin";
      estado = "habilitado";
    }

    // Validar rol admin
    if (role !== "admin") {
      alert("No tienes permisos de administrador.");
      await signOut(auth);
      return;
    }

    // Validar estado / expiración
    if (estado === "inhabilitado") {
      alert("Tu usuario está inhabilitado.");
      await signOut(auth);
      return;
    }
    if (expiracion) {
      const now = new Date();
      const exp = new Date(expiracion);
      if (now > exp) {
        alert("Tu acceso ha expirado.");
        // opcional: marcar en Firestore
        try { await updateDoc(uRef, { estado: "inhabilitado" }); } catch(e) {}
        await signOut(auth);
        return;
      }
    }

    // Usuario admin válido
    currentUser = { uid: user.uid, email: user.email, role, estado, expiracion, name };

    userInfo.textContent = `${user.email} (admin)`;
    topbarActions.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
    const btnLogoutTop = $("btnLogoutTop");
    if (btnLogoutTop) btnLogoutTop.onclick = doLogout;

    show(btnLogoutSide);
    btnLogoutSide.onclick = doLogout;

    hide(screenLogin);
    show(screenAdmin);

    // vista por defecto: exámenes
    await loadSections();
    activateExamsView();

  } catch (e) {
    console.error("onAuthStateChanged error", e);
  }
});

// ------------ SECCIONES ------------
async function loadSections() {
  if (!sectionsList) return;
  sectionsList.innerHTML = `<div class="small muted">Cargando secciones...</div>`;

  try {
    const snap = await getDocs(collection(db, "sections"));
    const arr = [];
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));

    // ordenar por "order" si existe
    arr.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 9999;
      const bo = typeof b.order === "number" ? b.order : 9999;
      return ao - bo;
    });

    sectionsList.innerHTML = "";
    if (!arr.length) {
      sectionsList.innerHTML = `<div class="small muted">Sin secciones. Crea una nueva.</div>`;
      currentSectionId = null;
      currentSectionName = "";
      currentSectionNameEl.textContent = "Sin secciones";
      hide(btnToggleNewExam);
      examsList.innerHTML = "";
      return;
    }

    arr.forEach((sec) => {
      const row = document.createElement("div");
      row.className = "section-row";
      row.dataset.id = sec.id;
      row.dataset.name = sec.name || sec.nombre || "Sección";

      row.innerHTML = `
        <div class="section-name">${escapeHtml(sec.name || sec.nombre || "Sección")}</div>
        <div class="section-buttons">
          <button class="btn-icon btn-section-edit" title="Editar sección">✎</button>
          <button class="btn-icon btn-section-delete" title="Eliminar sección">🗑</button>
        </div>
      `;

      // clic en el cuerpo -> seleccionar sección
      row.addEventListener("click", (ev) => {
        if (ev.target.closest(".btn-section-edit") || ev.target.closest(".btn-section-delete")) {
          return;
        }
        selectSection(sec.id, sec.name || sec.nombre || "Sección");
      });

      // editar
      row.querySelector(".btn-section-edit").addEventListener("click", async () => {
        const nuevo = prompt("Nuevo nombre de sección:", sec.name || sec.nombre || "");
        if (!nuevo) return;
        try {
          await updateDoc(doc(db, "sections", sec.id), { name: nuevo });
          await loadSections();
        } catch (e) {
          console.error("update section", e);
          alert("Error actualizando sección");
        }
      });

      // eliminar
      row.querySelector(".btn-section-delete").addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta sección y sus exámenes?")) return;
        try {
          // primero borrar exámenes de esta sección
          const exSnap = await getDocs(query(collection(db, "exams"), where("sectionId", "==", sec.id)));
          for (const exDoc of exSnap.docs) {
            await deleteExamCascade(exDoc.id);
          }
          // luego la sección
          await deleteDoc(doc(db, "sections", sec.id));
          if (currentSectionId === sec.id) {
            currentSectionId = null;
            currentSectionName = "";
          }
          await loadSections();
        } catch (e) {
          console.error("delete section", e);
          alert("Error eliminando sección");
        }
      });

      sectionsList.appendChild(row);
    });

    // si no hay sección seleccionada, seleccionar la primera
    if (!currentSectionId && arr.length) {
      selectSection(arr[0].id, arr[0].name || arr[0].nombre || "Sección");
    } else {
      // remarcar la actual
      markActiveSection(currentSectionId);
    }

  } catch (e) {
    console.error("loadSections", e);
    sectionsList.innerHTML = `<div class="small muted">Error cargando secciones</div>`;
  }
}

function markActiveSection(sectionId) {
  const rows = sectionsList.querySelectorAll(".section-row");
  rows.forEach((r) => {
    const active = r.dataset.id === sectionId;
    if (active) r.classList.add("active");
    else r.classList.remove("active");
  });
}

async function selectSection(sectionId, name) {
  currentSectionId = sectionId;
  currentSectionName = name;
  currentSectionNameEl.textContent = name;
  markActiveSection(sectionId);
  show(btnToggleNewExam);
  hide(newExamPanel);
  await loadExamsForCurrentSection();
}

// Crear sección rápida (con prompt)
if (btnAddSection) {
  btnAddSection.onclick = async () => {
    const nombre = prompt("Nombre de la nueva sección:");
    if (!nombre) return;
    try {
      await addDoc(collection(db, "sections"), {
        name: nombre,
        order: Date.now(),
        createdAt: new Date().toISOString()
      });
      await loadSections();
    } catch (e) {
      console.error("add section", e);
      alert("Error creando sección");
    }
  };
}

// ------------ EXÁMENES LISTA ------------
async function loadExamsForCurrentSection() {
  examsList.innerHTML = `<div class="small muted">Cargando exámenes...</div>`;
  hide(viewExamEditor);
  hide(viewUsers);
  show(viewExams);
  viewExams.classList.add("active");
  viewExamEditor.classList.remove("active");
  viewUsers.classList.remove("active");

  if (!currentSectionId) {
    examsList.innerHTML = `<div class="small muted">Selecciona una sección</div>`;
    return;
  }

  try {
    const snap = await getDocs(
      query(collection(db, "exams"), where("sectionId", "==", currentSectionId))
    );
    const exams = [];
    snap.forEach((d) => exams.push({ id: d.id, ...d.data() }));

    examsList.innerHTML = "";
    if (!exams.length) {
      examsList.innerHTML = `<div class="small muted">No hay exámenes en esta sección.</div>`;
      return;
    }

    for (const ex of exams) {
      const card = document.createElement("div");
      card.className = "card exam-row";

      const title = ex.title || ex.nombre || "Examen sin título";
      const desc = ex.description || ex.descripcion || "";
      const duration = ex.duration || ex.durationMinutes || 0;
      const questionCount = ex.questionCount || 0;

      card.innerHTML = `
        <div class="exam-main">
          <div class="exam-title">${escapeHtml(title)}</div>
          <div class="exam-desc">${escapeHtml(desc)}</div>
          <div class="exam-meta">
            Preguntas: <span data-qcount>${questionCount}</span> · 
            Duración aprox: <span data-duration>${duration}</span> min
          </div>
        </div>
        <div class="exam-actions">
          <button class="btn primary btn-edit-exam">Editar</button>
          <button class="btn btn-delete-exam">Eliminar</button>
        </div>
      `;

      // Botón editar
      card.querySelector(".btn-edit-exam").onclick = () => {
        openExamEditor(ex.id);
      };

      // Botón eliminar
      card.querySelector(".btn-delete-exam").onclick = async () => {
        if (!confirm("¿Eliminar este examen y todos sus casos clínicos y preguntas?")) return;
        try {
          await deleteExamCascade(ex.id);
          await loadExamsForCurrentSection();
        } catch (e) {
          console.error("delete exam", e);
          alert("Error eliminando examen");
        }
      };

      examsList.appendChild(card);

      // Recalcular conteo de preguntas en background y actualizar duración (no bloquea)
      recalcExamStats(ex.id, card);
    }

  } catch (e) {
    console.error("loadExamsForCurrentSection", e);
    examsList.innerHTML = `<div class="small muted">Error cargando exámenes</div>`;
  }
}

// Recalcular #preguntas y duración basada en 75 s/pregunta
async function recalcExamStats(examId, cardEl) {
  try {
    const qSnap = await getDocs(
      query(collection(db, "preguntas"), where("examId", "==", examId))
    );
    const total = qSnap.size;
    const totalSeconds = total * 75;
    const minutes = Math.max(1, Math.round(totalSeconds / 60));

    // actualizar en Firestore
    await updateDoc(doc(db, "exams", examId), {
      questionCount: total,
      duration: minutes
    });

    // actualizar UI
    if (cardEl) {
      const qc = cardEl.querySelector("[data-qcount]");
      const du = cardEl.querySelector("[data-duration]");
      if (qc) qc.textContent = total;
      if (du) du.textContent = minutes;
    }
  } catch (e) {
    console.warn("recalcExamStats", e);
  }
}

// Borrado en cascada de examen
async function deleteExamCascade(examId) {
  // borrar preguntas
  const qSnap = await getDocs(
    query(collection(db, "preguntas"), where("examId", "==", examId))
  );
  for (const qDoc of qSnap.docs) {
    await deleteDoc(doc(db, "preguntas", qDoc.id));
  }

  // borrar casos clínicos
  const cSnap = await getDocs(
    query(collection(db, "casosClinicos"), where("examId", "==", examId))
  );
  for (const cDoc of cSnap.docs) {
    await deleteDoc(doc(db, "casosClinicos", cDoc.id));
  }

  // borrar examen
  await deleteDoc(doc(db, "exams", examId));
}

// ------------ NUEVO EXAMEN PANEL ------------
if (btnToggleNewExam) {
  btnToggleNewExam.onclick = () => {
    if (!currentSectionId) {
      alert("Primero selecciona una sección.");
      return;
    }
    if (newExamPanel.classList.contains("hidden")) {
      show(newExamPanel);
      newExamTitle.value = "";
      newExamDescription.value = "";
    } else {
      hide(newExamPanel);
    }
  };
}

if (btnCancelNewExam) {
  btnCancelNewExam.onclick = () => {
    hide(newExamPanel);
    newExamTitle.value = "";
    newExamDescription.value = "";
  };
}

if (btnCreateExam) {
  btnCreateExam.onclick = async () => {
    if (!currentSectionId) {
      alert("Selecciona una sección.");
      return;
    }
    const title = (newExamTitle.value || "").trim();
    const desc = (newExamDescription.value || "").trim();
    if (!title) {
      alert("El examen necesita un título.");
      return;
    }
    try {
      await addDoc(collection(db, "exams"), {
        sectionId: currentSectionId,
        title,
        description: desc,
        duration: 0,
        questionCount: 0,
        createdAt: new Date().toISOString()
      });
      hide(newExamPanel);
      await loadExamsForCurrentSection();
    } catch (e) {
      console.error("create exam", e);
      alert("Error creando examen");
    }
  };
}

// ------------ EDITOR DE EXAMEN (casos + preguntas) ------------
async function openExamEditor(examId) {
  currentExamId = examId;
  hide(viewExams);
  hide(viewUsers);
  show(viewExamEditor);

  viewExams.classList.remove("active");
  viewUsers.classList.remove("active");
  viewExamEditor.classList.add("active");

  viewExamEditor.innerHTML = `<div class="small muted">Cargando examen...</div>`;

  try {
    const exSnap = await getDoc(doc(db, "exams", examId));
    if (!exSnap.exists()) {
      viewExamEditor.innerHTML = `<div class="small muted">Examen no encontrado.</div>`;
      return;
    }
    const ex = exSnap.data();
    const title = ex.title || ex.nombre || "Examen sin título";
    const desc = ex.description || ex.descripcion || "";

    // cargar casos clínicos
    const casosSnap = await getDocs(
      query(collection(db, "casosClinicos"), where("examId", "==", examId))
    );
    const casos = [];
    casosSnap.forEach((c) => casos.push({ id: c.id, ...c.data() }));

    // cargar todas las preguntas del examen y agrupar por casoId
    const pregSnap = await getDocs(
      query(collection(db, "preguntas"), where("examId", "==", examId))
    );
    const preguntasPorCaso = {};
    pregSnap.forEach((p) => {
      const d = p.data();
      const cid = d.casoId || "SIN_CASO";
      if (!preguntasPorCaso[cid]) preguntasPorCaso[cid] = [];
      preguntasPorCaso[cid].push({ id: p.id, ...d });
    });

    // ordenar preguntas por "orden" en cada caso
    Object.values(preguntasPorCaso).forEach((list) => {
      list.sort((a, b) => {
        const ao = typeof a.orden === "number" ? a.orden : 9999;
        const bo = typeof b.orden === "number" ? b.orden : 9999;
        return ao - bo;
      });
    });

    // construir UI
    const container = document.createElement("div");

    // header
    const header = document.createElement("div");
    header.className = "exam-editor-header";
    header.innerHTML = `
      <div>
        <h2>Editor de examen</h2>
        <div class="exam-editor-meta">${escapeHtml(currentSectionName)} · ID: ${escapeHtml(examId)}</div>
      </div>
      <div class="row">
        <button id="btnBackToExams" class="btn">Volver a exámenes</button>
        <button id="btnSaveExam" class="btn primary">Guardar examen</button>
      </div>
    `;
    container.appendChild(header);

    // datos básicos examen
    const basic = document.createElement("div");
    basic.className = "card exam-basic-card";
    basic.innerHTML = `
      <label>Título del examen</label>
      <input id="editExamTitle" type="text" value="${escapeHtml(title)}" />
      <label style="margin-top:6px;">Descripción</label>
      <textarea id="editExamDescription" rows="2">${escapeHtml(desc)}</textarea>
      <div class="small muted" style="margin-top:6px;">
        La duración se calcula a partir del número de preguntas (75 s por pregunta).
      </div>
    `;
    container.appendChild(basic);

    // lista de casos
    const casesWrapper = document.createElement("div");
    casesWrapper.className = "card";
    casesWrapper.innerHTML = `
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h3>Casos clínicos y preguntas</h3>
        <button id="btnAddCase" class="btn primary">Agregar caso clínico</button>
      </div>
      <div id="caseList" class="case-list" style="margin-top:8px;"></div>
    `;
    container.appendChild(casesWrapper);

    viewExamEditor.innerHTML = "";
    viewExamEditor.appendChild(container);

    const caseListEl = $("caseList");

    // render casos existentes
    // ordenar por "orden"
    casos.sort((a, b) => {
      const ao = typeof a.orden === "number" ? a.orden : 9999;
      const bo = typeof b.orden === "number" ? b.orden : 9999;
      return ao - bo;
    });

    for (const caso of casos) {
      const card = createCaseCard(caso.id, caso.titulo || "", caso.texto || "", preguntasPorCaso[caso.id] || []);
      caseListEl.appendChild(card);
    }

    // botón "Agregar caso"
    const btnAddCase = $("btnAddCase");
    if (btnAddCase) {
      btnAddCase.onclick = () => {
        const newCard = createCaseCard(null, "", "", []);
        caseListEl.appendChild(newCard);
      };
    }

    // botón volver
    const btnBackToExams = $("btnBackToExams");
    if (btnBackToExams) {
      btnBackToExams.onclick = () => {
        currentExamId = null;
        viewExamEditor.classList.remove("active");
        hide(viewExamEditor);
        show(viewExams);
        viewExams.classList.add("active");
      };
    }

    // botón guardar examen (todo)
    const btnSaveExam = $("btnSaveExam");
    if (btnSaveExam) {
      btnSaveExam.onclick = async () => {
        await saveExamFull(examId);
      };
    }

  } catch (e) {
    console.error("openExamEditor", e);
    viewExamEditor.innerHTML = `<div class="small muted">Error cargando examen</div>`;
  }
}

// Crear card de caso clínico + preguntas
function createCaseCard(casoId, titulo, texto, preguntasList) {
  const card = document.createElement("div");
  card.className = "case-card";
  if (casoId) card.dataset.casoId = casoId;

  card.innerHTML = `
    <div class="case-header">
      <div class="case-header-title">${casoId ? "Caso clínico" : "Nuevo caso clínico"}</div>
      <div class="row">
        <button class="btn btn-case-add-question">+ Pregunta</button>
        <button class="btn btn-case-delete">Eliminar caso</button>
      </div>
    </div>
    <div class="case-body">
      <label>Título / encabezado del caso</label>
      <input class="case-title-input" type="text" value="${escapeHtml(titulo)}" />
      <label>Texto del caso clínico</label>
      <textarea class="case-text-input" rows="3">${escapeHtml(texto)}</textarea>
      <div class="questions-list"></div>
    </div>
  `;

  const questionsListEl = card.querySelector(".questions-list");

  // Preguntas existentes
  if (preguntasList && preguntasList.length) {
    preguntasList.forEach((p) => {
      const qCard = createQuestionCard(p.id, p.pregunta || "", p.opciones || [], p.correcta || 0, p.justificacion || "");
      questionsListEl.appendChild(qCard);
    });
  }

  // Botón agregar pregunta
  const btnAddQ = card.querySelector(".btn-case-add-question");
  btnAddQ.onclick = () => {
    const qCard = createQuestionCard(null, "", ["","","",""], 0, "");
    questionsListEl.appendChild(qCard);
  };

  // Botón eliminar caso
  const btnDelCase = card.querySelector(".btn-case-delete");
  btnDelCase.onclick = async () => {
    const existingId = card.dataset.casoId;
    if (existingId) {
      if (!confirm("¿Eliminar este caso clínico y sus preguntas?")) return;
      try {
        // borrar preguntas de este caso
        const qSnap = await getDocs(
          query(collection(db, "preguntas"), where("casoId", "==", existingId))
        );
        for (const d of qSnap.docs) {
          await deleteDoc(doc(db, "preguntas", d.id));
        }
        await deleteDoc(doc(db, "casosClinicos", existingId));
      } catch (e) {
        console.error("delete case", e);
        alert("Error eliminando caso clínico");
        return;
      }
    }
    card.remove();
  };

  return card;
}

// Crear card de pregunta
function createQuestionCard(preguntaId, preguntaText, opcionesArray, correctaIdx, justificacionText) {
  const card = document.createElement("div");
  card.className = "question-card";
  if (preguntaId) card.dataset.preguntaId = preguntaId;

  const opts = opcionesArray || [];
  const A = opts[0] || "";
  const B = opts[1] || "";
  const C = opts[2] || "";
  const D = opts[3] || "";

  card.innerHTML = `
    <label>Pregunta</label>
    <input class="q-text-input" type="text" value="${escapeHtml(preguntaText)}" />
    <div class="row" style="margin-top:6px;">
      <div style="flex:1;">
        <label>Opción A</label>
        <input class="q-opt-input q-opt-0" type="text" value="${escapeHtml(A)}" />
      </div>
      <div style="flex:1;">
        <label>Opción B</label>
        <input class="q-opt-input q-opt-1" type="text" value="${escapeHtml(B)}" />
      </div>
    </div>
    <div class="row" style="margin-top:6px;">
      <div style="flex:1;">
        <label>Opción C</label>
        <input class="q-opt-input q-opt-2" type="text" value="${escapeHtml(C)}" />
      </div>
      <div style="flex:1;">
        <label>Opción D</label>
        <input class="q-opt-input q-opt-3" type="text" value="${escapeHtml(D)}" />
      </div>
    </div>
    <div class="row" style="margin-top:6px;">
      <div style="flex:1;">
        <label>Respuesta correcta</label>
        <select class="q-correct-select">
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
      </div>
      <div style="flex:1; display:flex; justify-content:flex-end; align-items:flex-end;">
        <button class="btn btn-q-delete">Eliminar pregunta</button>
      </div>
    </div>
    <label style="margin-top:6px;">Justificación</label>
    <textarea class="q-just-input" rows="2">${escapeHtml(justificacionText)}</textarea>
  `;

  const sel = card.querySelector(".q-correct-select");
  sel.value = String(correctaIdx || 0);

  const btnDel = card.querySelector(".btn-q-delete");
  btnDel.onclick = async () => {
    const pid = card.dataset.preguntaId;
    if (pid) {
      if (!confirm("¿Eliminar esta pregunta?")) return;
      try {
        await deleteDoc(doc(db, "preguntas", pid));
      } catch (e) {
        console.error("delete question", e);
        alert("Error eliminando pregunta");
        return;
      }
    }
    card.remove();
  };

  return card;
}

// Guardar TODO el examen (datos básicos + casos + preguntas)
async function saveExamFull(examId) {
  const examRef = doc(db, "exams", examId);

  const titleInput = $("editExamTitle");
  const descInput = $("editExamDescription");
  const newTitle = (titleInput?.value || "").trim();
  const newDesc = (descInput?.value || "").trim();

  if (!newTitle) {
    alert("El examen necesita título.");
    return;
  }

  try {
    // actualizar datos básicos del examen
    await updateDoc(examRef, {
      title: newTitle,
      description: newDesc
    });

    // recorrer casos clínicos en el DOM
    const caseListEl = $("caseList");
    if (!caseListEl) {
      alert("No se encontró la lista de casos clínicos.");
      return;
    }
    const caseCards = Array.from(caseListEl.querySelectorAll(".case-card"));
    let totalQuestions = 0;

    for (let i = 0; i < caseCards.length; i++) {
      const cCard = caseCards[i];
      let casoId = cCard.dataset.casoId || null;
      const caseTitle = (cCard.querySelector(".case-title-input")?.value || "").trim();
      const caseText = (cCard.querySelector(".case-text-input")?.value || "").trim();

      // si no hay nada escrito, ignoramos ese caso
      if (!caseTitle && !caseText) continue;

      const casoData = {
        examId,
        titulo: caseTitle,
        texto: caseText,
        orden: i + 1,
        updatedAt: new Date().toISOString()
      };

      if (!casoId) {
        // nuevo caso
        const newRef = await addDoc(collection(db, "casosClinicos"), {
          ...casoData,
          createdAt: new Date().toISOString()
        });
        casoId = newRef.id;
        cCard.dataset.casoId = casoId;
      } else {
        await updateDoc(doc(db, "casosClinicos", casoId), casoData);
      }

      // ahora sus preguntas
      const qCards = Array.from(cCard.querySelectorAll(".question-card"));
      for (let j = 0; j < qCards.length; j++) {
        const qCard = qCards[j];
        let preguntaId = qCard.dataset.preguntaId || null;

        const qText = (qCard.querySelector(".q-text-input")?.value || "").trim();
        const opt0 = (qCard.querySelector(".q-opt-0")?.value || "").trim();
        const opt1 = (qCard.querySelector(".q-opt-1")?.value || "").trim();
        const opt2 = (qCard.querySelector(".q-opt-2")?.value || "").trim();
        const opt3 = (qCard.querySelector(".q-opt-3")?.value || "").trim();
        const correctSel = qCard.querySelector(".q-correct-select");
        const just = (qCard.querySelector(".q-just-input")?.value || "").trim();

        const opciones = [opt0, opt1, opt2, opt3].filter((x) => x !== "");

        // si no hay pregunta o sin opciones, ignora
        if (!qText || !opciones.length) continue;

        const correcta = Number(correctSel?.value || 0);

        const qData = {
          examId,
          casoId,
          pregunta: qText,
          opciones,
          correcta,
          justificacion: just,
          orden: j + 1,
          updatedAt: new Date().toISOString()
        };

        if (!preguntaId) {
          const newQRef = await addDoc(collection(db, "preguntas"), {
            ...qData,
            createdAt: new Date().toISOString()
          });
          preguntaId = newQRef.id;
          qCard.dataset.preguntaId = preguntaId;
        } else {
          await updateDoc(doc(db, "preguntas", preguntaId), qData);
        }

        totalQuestions++;
      }
    }

    // actualizar duración y questionCount en examen
    const totalSeconds = totalQuestions * 75;
    const minutes = totalQuestions ? Math.max(1, Math.round(totalSeconds / 60)) : 0;

    await updateDoc(examRef, {
      questionCount: totalQuestions,
      duration: minutes
    });

    alert("Examen guardado correctamente.");
    // recargar lista (para refrescar contadores)
    await loadExamsForCurrentSection();
    // mantenerte en editor (si quieres salir, usas "Volver a exámenes")

  } catch (e) {
    console.error("saveExamFull", e);
    alert("Error guardando examen");
  }
}

// ------------ VISTA USUARIOS ------------
async function loadUsersView() {
  hide(viewExams);
  hide(viewExamEditor);
  show(viewUsers);
  viewExams.classList.remove("active");
  viewExamEditor.classList.remove("active");
  viewUsers.classList.add("active");

  viewUsers.innerHTML = `
    <div class="users-header">
      <h3>Usuarios</h3>
      <div class="small muted">Solo muestra y permite editar rol/estado/fecha limite.</div>
    </div>
    <div id="usersList" class="users-list">
      <div class="small muted">Cargando usuarios...</div>
    </div>
  `;

  const usersList = $("usersList");
  try {
    const snap = await getDocs(collection(db, "users"));
    usersList.innerHTML = "";
    if (snap.empty) {
      usersList.innerHTML = `<div class="small muted">No hay usuarios registrados en la colección users.</div>`;
      return;
    }

    snap.forEach((uDoc) => {
      const d = uDoc.data();
      const row = document.createElement("div");
      row.className = "card user-row";

      const nombre = d.name || d.usuario || "";
      const email = d.email || "";
      const role = d.role || "user";
      const estado = d.estado || "habilitado";
      const expiracion = d.expiracion || "";

      row.innerHTML = `
        <div>
          <div style="font-weight:700;">${escapeHtml(nombre || "(sin nombre)")}</div>
          <div class="small muted">${escapeHtml(email || uDoc.id)}</div>
          <div class="small muted">Rol: ${escapeHtml(role)} · Estado: ${escapeHtml(estado)}</div>
          <div class="small muted">Límite acceso: ${escapeHtml(expiracion || "-")}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button class="btn btn-user-edit">Editar</button>
        </div>
      `;

      const btnEdit = row.querySelector(".btn-user-edit");
      btnEdit.onclick = async () => {
        // Para simplificar: prompts. Esto lo podemos pasar a inputs inline más adelante si quieres.
        const nuevoNombre = prompt("Nombre:", nombre);
        if (nuevoNombre === null) return;
        const nuevoRol = prompt("Rol (admin/user):", role);
        if (nuevoRol === null) return;
        const nuevoEstado = prompt("Estado (habilitado/inhabilitado):", estado);
        if (nuevoEstado === null) return;
        const nuevaFecha = prompt("Fecha límite de acceso (YYYY-MM-DD) o vacío:", expiracion);

        try {
          await setDoc(doc(db, "users", uDoc.id), {
            ...d,
            name: nuevoNombre,
            role: nuevoRol,
            estado: nuevoEstado,
            expiracion: nuevaFecha || ""
          }, { merge: true });
          alert("Usuario actualizado.");
          await loadUsersView();
        } catch (e) {
          console.error("update user", e);
          alert("Error actualizando usuario");
        }
      };

      usersList.appendChild(row);
    });

  } catch (e) {
    console.error("loadUsersView", e);
    const usersList = $("usersList");
    if (usersList) {
      usersList.innerHTML = `<div class="small muted">Error cargando usuarios</div>`;
    }
  }
}

// ------------ NAV LATERAL: EXÁMENES / USUARIOS ------------
function activateExamsView() {
  setActive(btnViewExams, true);
  setActive(btnViewUsers, false);
  show(viewExams);
  hide(viewExamEditor);
  hide(viewUsers);
  viewExams.classList.add("active");
  viewExamEditor.classList.remove("active");
  viewUsers.classList.remove("active");
  if (currentSectionId) {
    loadExamsForCurrentSection();
  }
}

if (btnViewExams) {
  btnViewExams.onclick = () => {
    activateExamsView();
  };
}

if (btnViewUsers) {
  btnViewUsers.onclick = () => {
    setActive(btnViewExams, false);
    setActive(btnViewUsers, true);
    loadUsersView();
  };
}

// ------------ INIT MANUAL (por si arranca sin sesión) ------------
(function init() {
  hide(screenAdmin);
  show(screenLogin);
})();
