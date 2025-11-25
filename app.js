/***********************************************
 * FIREBASE (MODULAR v11) - CONFIGURACIÓN
 ***********************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- Configuración Firebase ---
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

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/
const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const currentUserEmailSpan = document.getElementById("current-user-email");
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("sidebar-sections");
const btnNewSection = document.getElementById("btn-new-section");
const btnUsersView = document.getElementById("btn-users-view");
const btnEditSocial = document.getElementById("btn-edit-social");
const socialButtons = document.querySelectorAll(".social-icon");
const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examDetailView = document.getElementById("exam-detail-view");
const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");
const btnNewExam = document.getElementById("btn-new-exam");
const examsList = document.getElementById("exams-list");
const usersList = document.getElementById("users-list");
const btnCreateUser = document.getElementById("btn-create-user");
const btnBackToExams = document.getElementById("btn-back-to-exams");
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question");
const questionsList = document.getElementById("questions-list");

// Modal
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalFields = document.getElementById("modal-fields");
const modalForm = document.getElementById("modal-form");
const modalCancel = document.getElementById("modal-cancel");
const modalSubmit = document.getElementById("modal-submit");

/***********************************************
 * ESTADO
 ***********************************************/
let currentSectionId = null;
let currentSectionName = "";
let currentExamId = null;
let modalSubmitHandler = null;

/***********************************************
 * UI HELPERS
 ***********************************************/
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

/***********************************************
 * MODAL GENÉRICO
 ***********************************************/
function openModal({ title, fieldsHtml, onSubmit }) {
  modalTitle.textContent = title;
  modalFields.innerHTML = fieldsHtml;
  modalSubmitHandler = onSubmit;
  show(modalOverlay);
}
function closeModal() {
  modalFields.innerHTML = "";
  modalSubmitHandler = null;
  hide(modalOverlay);
}
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });
modalCancel.addEventListener("click", closeModal);
modalForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (typeof modalSubmitHandler === "function") await modalSubmitHandler();
});

/***********************************************
 * LOGIN
 ***********************************************/
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  loginError.textContent = "";
  hide(loginError);

  try {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const userSnap = await getDoc(doc(db, "users", user.email));
    if (!userSnap.exists()) throw new Error("Usuario no registrado en Firestore.");

    const data = userSnap.data();
    const today = new Date().toISOString().slice(0, 10);

    if (data.expiryDate && data.expiryDate < today)
      throw new Error("Tu acceso ha expirado.");

    if (data.status !== "activo")
      throw new Error("Tu usuario está inactivo.");

    if (data.role === "usuario") {
      window.location.href = "student.html";
      return;
    }

    if (data.role !== "admin") throw new Error("Rol inválido.");

  } catch (err) {
    loginError.textContent = err.message;
    show(loginError);
    await signOut(auth).catch(() => {});
  }
});

/***********************************************
 * AUTH STATE
 ***********************************************/
onAuthStateChanged(auth, async user => {
  if (!user) {
    show(loginView);
    hide(adminView);
    return;
  }

  const snap = await getDoc(doc(db, "users", user.email));
  if (!snap.exists()) {
    await signOut(auth);
    return;
  }

  const data = snap.data();
  const today = new Date().toISOString().slice(0, 10);

  if (data.expiryDate && data.expiryDate < today) {
    await updateDoc(doc(db, "users", user.email), { status: "inactivo" });
    await signOut(auth);
    return;
  }

  if (data.status !== "activo") {
    await signOut(auth);
    return;
  }

  if (data.role === "usuario") {
    window.location.href = "student.html";
    return;
  }

  // ADMIN
  show(adminView);
  hide(loginView);
  currentUserEmailSpan.textContent = user.email;

  await loadSections();
  await loadSocialLinks();
});

/***********************************************
 * SECCIONES ADMIN
 ***********************************************/
async function loadSections() {
  const snap = await getDocs(collection(db, "sections"));
  sidebarSections.innerHTML = "";

  if (snap.empty) {
    sidebarSections.innerHTML = `<li>No hay secciones.</li>`;
    return;
  }

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.innerHTML = `
      <div class="sidebar__section-name">${data.name}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-section">✏</button>
        <button class="icon-btn delete-section">🗑</button>
      </div>
    `;

    li.addEventListener("click", () => selectSection(id, data.name, li));
    li.querySelector(".edit-section").addEventListener("click", e => {
      e.stopPropagation();
      openEditSectionModal(id, data.name);
    });
    li.querySelector(".delete-section").addEventListener("click", async e => {
      e.stopPropagation();
      await deleteSectionWithAll(id);
      await loadSections();
    });

    sidebarSections.appendChild(li);
  });
}

function selectSection(id, name, element) {
  currentSectionId = id;
  currentSectionName = name;

  document.querySelectorAll(".sidebar__section-item")
    .forEach(li => li.classList.remove("active"));

  element.classList.add("active");

  currentSectionTitle.textContent = name;
  show(btnNewExam);
  loadExams(id);
}

async function deleteSectionWithAll(sectionId) {
  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const exSnap = await getDocs(qEx);

  for (const ex of exSnap.docs) {
    const qCases = query(collection(db, "questions"), where("examId", "==", ex.id));
    const caseSnap = await getDocs(qCases);
    for (const c of caseSnap.docs) await deleteDoc(c.ref);
    await deleteDoc(ex.ref);
  }

  await deleteDoc(doc(db, "sections", sectionId));
}

/***********************************************
 * EXÁMENES ADMIN
 ***********************************************/
async function loadExams(sectionId) {
  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  examsList.innerHTML = "";

  if (snap.empty) {
    examsList.innerHTML = `<p>No hay exámenes.</p>`;
    return;
  }

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div>${data.name}</div>
        <div>
          <button class="btn btn-secondary open">Abrir</button>
          <button class="icon-btn edit">✏</button>
          <button class="icon-btn delete">🗑</button>
        </div>
      </div>
    `;

    card.querySelector(".open").addEventListener("click", () => openExam(docSnap.id, data.name));
    card.querySelector(".edit").addEventListener("click", () => openEditExamModal(docSnap.id, data.name));
    card.querySelector(".delete").addEventListener("click", async () => {
      await deleteDoc(doc(db, "exams", docSnap.id));
      loadExams(sectionId);
    });

    examsList.appendChild(card);
  });
}

function openExam(examId, examName) {
  currentExamId = examId;

  show(examDetailView);
  hide(sectionsView);

  examNameInput.value = examName;
  loadCases(examId);
}

/***********************************************
 * CASOS CLÍNICOS ADMIN (PARTE 1)
 ***********************************************/
async function loadCases(examId) {
  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  questionsList.innerHTML = "";

  if (snap.empty) {
    questionsList.innerHTML = `<p>No hay casos clínicos.</p>`;
    return;
  }

  snap.forEach(docSnap => renderCase(docSnap.id, docSnap.data()));
}

function renderCase(caseId, data) {
  const caseCard = document.createElement("div");
  caseCard.className = "card";
  caseCard.dataset.caseId = caseId;

  caseCard.innerHTML = `
    <label class="field">
      <span>Especialidad</span>
      <select class="case-specialty">
        <option value="">Selecciona</option>
        <option value="medicina_interna" ${data.specialty==="medicina_interna"?"selected":""}>Medicina interna</option>
        <option value="pediatria" ${data.specialty==="pediatria"?"selected":""}>Pediatría</option>
        <option value="gine_obstetricia" ${data.specialty==="gine_obstetricia"?"selected":""}>Ginecología y obstetricia</option>
        <option value="cirugia_general" ${data.specialty==="cirugia_general"?"selected":""}>Cirugía general</option>
      </select>
    </label>

    <label class="field">
      <span>Caso clínico</span>
      <textarea class="case-text" rows="4">${data.caseText||""}</textarea>
    </label>

    <div class="cards-list case-questions"></div>

    <div class="flex-row" style="gap:8px;margin-top:8px;">
      <button class="btn btn-sm btn-primary add-question">+ Pregunta</button>
      <button class="btn btn-sm btn-secondary save-case">Guardar</button>
      <button class="btn btn-sm btn-outline delete-case">Eliminar</button>
      <button class="btn btn-sm btn-primary new-case">+ Nuevo caso</button>
    </div>
  `;

  const qContainer = caseCard.querySelector(".case-questions");
  const arr = Array.isArray(data.questions) ? data.questions : [];
  arr.forEach(q => qContainer.appendChild(renderQuestion(q)));
  if (arr.length === 0) qContainer.appendChild(renderQuestion());

  questionsList.appendChild(caseCard);
}
/***********************************************
 * CASOS CLÍNICOS ADMIN (VERSIÓN COMPLETA)
 ***********************************************/

// Sobrescribimos renderCase con la versión completa
function renderCase(caseId, data) {
  const caseCard = document.createElement("div");
  caseCard.className = "card";
  caseCard.dataset.caseId = caseId;

  caseCard.innerHTML = `
    <label class="field">
      <span>Especialidad del caso clínico</span>
      <select class="case-specialty">
        <option value="">Selecciona una especialidad</option>
        <option value="medicina_interna" ${data.specialty === "medicina_interna" ? "selected" : ""}>Medicina interna</option>
        <option value="pediatria" ${data.specialty === "pediatria" ? "selected" : ""}>Pediatría</option>
        <option value="gine_obstetricia" ${data.specialty === "gine_obstetricia" ? "selected" : ""}>Ginecología y obstetricia</option>
        <option value="cirugia_general" ${data.specialty === "cirugia_general" ? "selected" : ""}>Cirugía general</option>
      </select>
    </label>

    <label class="field">
      <span>Caso clínico</span>
      <textarea class="case-text" rows="4">${data.caseText || ""}</textarea>
    </label>

    <div class="cards-list case-questions"></div>

    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <button type="button" class="btn btn-sm btn-primary add-question">
        + Agregar pregunta
      </button>
      <button type="button" class="btn btn-sm btn-secondary save-case">
        Guardar caso clínico
      </button>
      <button type="button" class="btn btn-sm btn-outline delete-case">
        Eliminar caso clínico
      </button>
      <button type="button" class="btn btn-sm btn-primary new-case">
        + Nuevo caso clínico
      </button>
    </div>
  `;

  const qContainer = caseCard.querySelector(".case-questions");
  const arr = Array.isArray(data.questions) ? data.questions : [];
  if (arr.length === 0) {
    qContainer.appendChild(renderQuestion());
  } else {
    arr.forEach(q => qContainer.appendChild(renderQuestion(q)));
  }

  // Eventos
  caseCard.querySelector(".add-question").addEventListener("click", () => {
    qContainer.appendChild(renderQuestion());
  });

  caseCard.querySelector(".save-case").addEventListener("click", async () => {
    await saveCase(caseId, caseCard);
  });

  caseCard.querySelector(".delete-case").addEventListener("click", async () => {
    const ok = window.confirm("¿Eliminar este caso clínico y todas sus preguntas?");
    if (!ok) return;
    await deleteDoc(doc(db, "questions", caseId));
    if (currentExamId) await loadCases(currentExamId);
  });

  caseCard.querySelector(".new-case").addEventListener("click", async () => {
    if (!currentExamId) {
      alert("Primero selecciona o crea un examen.");
      return;
    }
    await addDoc(collection(db, "questions"), {
      examId: currentExamId,
      caseText: "",
      specialty: "",
      questions: [],
      createdAt: serverTimestamp(),
    });
    await loadCases(currentExamId);
  });

  questionsList.appendChild(caseCard);
}

function renderQuestion(qData = {}) {
  const {
    questionText = "",
    optionA = "",
    optionB = "",
    optionC = "",
    optionD = "",
    correctOption = "",
    justification = "",
    difficulty = "media",
    subtype = "salud_publica",
  } = qData;

  const card = document.createElement("div");
  card.className = "card-item";

  card.innerHTML = `
    <label class="field">
      <span>Pregunta</span>
      <textarea class="q-question" rows="2">${questionText}</textarea>
    </label>

    <label class="field">
      <span>Inciso A</span>
      <input type="text" class="q-a" value="${optionA}" />
    </label>

    <label class="field">
      <span>Inciso B</span>
      <input type="text" class="q-b" value="${optionB}" />
    </label>

    <label class="field">
      <span>Inciso C</span>
      <input type="text" class="q-c" value="${optionC}" />
    </label>

    <label class="field">
      <span>Inciso D</span>
      <input type="text" class="q-d" value="${optionD}" />
    </label>

    <label class="field">
      <span>Respuesta correcta</span>
      <select class="q-correct">
        <option value="">Selecciona</option>
        <option value="A" ${correctOption === "A" ? "selected" : ""}>A</option>
        <option value="B" ${correctOption === "B" ? "selected" : ""}>B</option>
        <option value="C" ${correctOption === "C" ? "selected" : ""}>C</option>
        <option value="D" ${correctOption === "D" ? "selected" : ""}>D</option>
      </select>
    </label>

    <label class="field">
      <span>Dificultad</span>
      <select class="q-difficulty">
        <option value="baja" ${difficulty === "baja" ? "selected" : ""}>Baja (1 punto)</option>
        <option value="media" ${difficulty === "media" ? "selected" : ""}>Media (2 puntos)</option>
        <option value="alta" ${difficulty === "alta" ? "selected" : ""}>Alta (3 puntos)</option>
      </select>
    </label>

    <label class="field">
      <span>Tipo de pregunta</span>
      <select class="q-subtype">
        <option value="salud_publica" ${subtype === "salud_publica" ? "selected" : ""}>Salud pública</option>
        <option value="medicina_familiar" ${subtype === "medicina_familiar" ? "selected" : ""}>Medicina familiar</option>
        <option value="urgencias" ${subtype === "urgencias" ? "selected" : ""}>Urgencias</option>
      </select>
    </label>

    <label class="field">
      <span>Justificación</span>
      <textarea class="q-just" rows="2">${justification}</textarea>
    </label>

    <div style="display:flex;justify-content:flex-end;margin-top:6px;">
      <button type="button" class="btn btn-sm btn-outline delete-question">
        Eliminar pregunta
      </button>
    </div>
  `;

  card.querySelector(".delete-question").addEventListener("click", () => {
    card.remove();
  });

  return card;
}

async function saveCase(caseId, caseCard) {
  if (!currentExamId) return;

  const specialty = caseCard.querySelector(".case-specialty").value;
  const caseText = caseCard.querySelector(".case-text").value.trim();
  const qCards = caseCard.querySelectorAll(".case-questions .card-item");

  if (!caseText) {
    alert("Escribe el texto del caso clínico.");
    return;
  }
  if (!qCards.length) {
    alert("Agrega al menos una pregunta.");
    return;
  }

  const questions = [];
  for (const card of qCards) {
    const questionText = card.querySelector(".q-question").value.trim();
    const optionA = card.querySelector(".q-a").value.trim();
    const optionB = card.querySelector(".q-b").value.trim();
    const optionC = card.querySelector(".q-c").value.trim();
    const optionD = card.querySelector(".q-d").value.trim();
    const correctOption = card.querySelector(".q-correct").value;
    const justification = card.querySelector(".q-just").value.trim();

    const difficulty = (card.querySelector(".q-difficulty")?.value) || "media";
    const subtype = (card.querySelector(".q-subtype")?.value) || "salud_publica";

    const difficultyWeight =
      difficulty === "alta" ? 3 :
      difficulty === "media" ? 2 : 1;

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption || !justification) {
      alert("Completa todos los campos de cada pregunta.");
      return;
    }

    questions.push({
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      justification,
      difficulty,
      difficultyWeight,
      subtype,
    });
  }

  await updateDoc(doc(db, "questions", caseId), {
    examId: currentExamId,
    caseText,
    specialty: specialty || "",
    questions,
    updatedAt: serverTimestamp(),
  });

  alert("Caso clínico guardado correctamente.");
  if (currentExamId) await loadCases(currentExamId);
}

// Botón global “Nuevo caso clínico”
btnNewQuestion.addEventListener("click", async () => {
  if (!currentExamId) {
    alert("Primero selecciona o crea un examen.");
    return;
  }
  await addDoc(collection(db, "questions"), {
    examId: currentExamId,
    caseText: "",
    specialty: "",
    questions: [],
    createdAt: serverTimestamp(),
  });
  await loadCases(currentExamId);
});

/***********************************************
 * GUARDAR NOMBRE DE EXAMEN Y NAVEGACIÓN
 ***********************************************/
btnSaveExamMeta.addEventListener("click", async () => {
  if (!currentExamId) return;

  const name = examNameInput.value.trim();
  if (!name) {
    alert("Escribe un nombre para el examen.");
    return;
  }

  await updateDoc(doc(db, "exams", currentExamId), {
    name,
    updatedAt: serverTimestamp(),
  });

  if (currentSectionId) await loadExams(currentSectionId);
  alert("Nombre del examen actualizado.");
});

btnBackToExams.addEventListener("click", () => {
  currentExamId = null;
  hide(examDetailView);
  show(sectionsView);
});

/***********************************************
 * USUARIOS (ADMIN)
 ***********************************************/
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersList.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        No hay usuarios registrados.
      </div>
    `;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Estado</th>
          <th>Rol</th>
          <th>Fecha límite</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const status = d.status || "inactivo";
    const role = d.role || "usuario";

    html += `
      <tr data-id="${docSnap.id}">
        <td>${d.name || ""}</td>
        <td>${d.email || ""}</td>
        <td><span class="chip ${status === "activo" ? "chip--activo" : "chip--inactivo"}">${status}</span></td>
        <td><span class="chip ${role === "admin" ? "chip--admin" : "chip--user"}">${role}</span></td>
        <td>${d.expiryDate || "—"}</td>
        <td>
          <button class="icon-btn edit-user">✏</button>
          <button class="icon-btn delete-user">🗑</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  usersList.innerHTML = html;

  usersList.querySelectorAll("tr[data-id]").forEach(row => {
    const id = row.dataset.id;
    row.querySelector(".edit-user").addEventListener("click", () => openUserModal(id));
    row.querySelector(".delete-user").addEventListener("click", async () => {
      const ok = window.confirm("¿Eliminar este usuario?");
      if (!ok) return;
      await deleteDoc(doc(db, "users", id));
      await loadUsers();
    });
  });
}

function openUserModal(id = null) {
  const isEdit = Boolean(id);
  let dataPromise = Promise.resolve(null);

  if (isEdit) {
    dataPromise = getDoc(doc(db, "users", id)).then(d => d.exists() ? d.data() : null);
  }

  dataPromise.then((d = {}) => {
    const docId = isEdit ? id : (d.email || "");

    openModal({
      title: isEdit ? "Editar usuario" : "Nuevo usuario",
      fieldsHtml: `
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="field-user-name" required value="${d.name || ""}" />
        </label>

        <label class="field">
          <span>Correo (ID de documento)</span>
          <input type="email" id="field-user-email" ${isEdit ? "readonly" : ""} value="${d.email || ""}" />
        </label>

        <label class="field">
          <span>ID documento</span>
          <input type="text" id="field-user-docid" readonly value="${docId || ""}" />
        </label>

        <label class="field">
          <span>Contraseña (solo admin)</span>
          <input type="text" id="field-user-password" required value="${d.password || ""}" />
        </label>

        <label class="field">
          <span>Estado</span>
          <select id="field-user-status">
            <option value="activo" ${d.status === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${d.status === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </label>

        <label class="field">
          <span>Rol</span>
          <select id="field-user-role">
            <option value="admin" ${d.role === "admin" ? "selected" : ""}>Administrador</option>
            <option value="usuario" ${d.role === "usuario" ? "selected" : ""}>Usuario</option>
          </select>
        </label>

        <label class="field">
          <span>Fecha límite de acceso</span>
          <input type="date" id="field-user-expiry" value="${d.expiryDate || ""}" />
        </label>
      `,
      onSubmit: async () => {
        const name = document.getElementById("field-user-name").value.trim();
        const email = document.getElementById("field-user-email").value.trim();
        const password = document.getElementById("field-user-password").value.trim();
        const status = document.getElementById("field-user-status").value;
        const role = document.getElementById("field-user-role").value;
        const expiryDate = document.getElementById("field-user-expiry").value || "";

        if (!name || !email || !password) {
          alert("Nombre, correo y contraseña son obligatorios.");
          return;
        }

        const docIdFinal = email;
        const payload = {
          name,
          email,
          password,
          status,
          role,
          expiryDate,
          updatedAt: serverTimestamp(),
        };

        if (!isEdit) payload.createdAt = serverTimestamp();

        await setDoc(doc(db, "users", docIdFinal), payload, { merge: true });

        if (!isEdit) {
          alert("Usuario creado en Firestore. Recuerda crear también el usuario en Authentication.");
        }

        await loadUsers();
        closeModal();
      },
    });

    if (!isEdit) {
      const emailInput = document.getElementById("field-user-email");
      const docIdInput = document.getElementById("field-user-docid");
      emailInput.addEventListener("input", () => {
        docIdInput.value = emailInput.value.trim();
      });
    }
  });
}

btnCreateUser.addEventListener("click", async () => {
  const name = document.getElementById("new-user-name").value.trim();
  const email = document.getElementById("new-user-email").value.trim();
  const password = document.getElementById("new-user-password").value.trim();
  const status = document.getElementById("new-user-status").value;
  const role = document.getElementById("new-user-role").value;
  const expiryDate = document.getElementById("new-user-expiry").value || "";

  if (!name || !email || !password) {
    alert("Nombre, correo y contraseña son obligatorios.");
    return;
  }

  await setDoc(doc(db, "users", email), {
    name,
    email,
    password,
    status,
    role,
    expiryDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  alert("Usuario creado en Firestore. Recuerda crearlo también en Authentication.");

  document.getElementById("new-user-name").value = "";
  document.getElementById("new-user-email").value = "";
  document.getElementById("new-user-password").value = "";
  document.getElementById("new-user-status").value = "activo";
  document.getElementById("new-user-role").value = "usuario";
  document.getElementById("new-user-expiry").value = "";

  await loadUsers();
});

/***********************************************
 * REDES SOCIALES
 ***********************************************/
async function loadSocialLinks() {
  const snap = await getDoc(doc(db, "settings", "socialLinks"));
  if (!snap.exists()) return;
  const data = snap.data();

  socialButtons.forEach(btn => {
    const network = btn.dataset.network;
    if (data[network]) btn.dataset.url = data[network];
  });
}

btnEditSocial.addEventListener("click", async () => {
  let data = {};
  const snap = await getDoc(doc(db, "settings", "socialLinks"));
  if (snap.exists()) data = snap.data();

  openModal({
    title: "Enlaces de redes sociales",
    fieldsHtml: `
      <label class="field">
        <span>Instagram</span>
        <input type="url" id="field-instagram" value="${data.instagram || ""}" />
      </label>
      <label class="field">
        <span>WhatsApp</span>
        <input type="url" id="field-whatsapp" value="${data.whatsapp || ""}" />
      </label>
      <label class="field">
        <span>TikTok</span>
        <input type="url" id="field-tiktok" value="${data.tiktok || ""}" />
      </label>
      <label class="field">
        <span>Telegram</span>
        <input type="url" id="field-telegram" value="${data.telegram || ""}" />
      </label>
    `,
    onSubmit: async () => {
      const instagram = document.getElementById("field-instagram").value.trim();
      const whatsapp = document.getElementById("field-whatsapp").value.trim();
      const tiktok = document.getElementById("field-tiktok").value.trim();
      const telegram = document.getElementById("field-telegram").value.trim();

      await setDoc(
        doc(db, "settings", "socialLinks"),
        {
          instagram,
          whatsapp,
          tiktok,
          telegram,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await loadSocialLinks();
      closeModal();
    },
  });
});

socialButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const url = btn.dataset.url;
    if (!url) {
      alert("No se ha configurado el enlace de esta red social.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  });
});

/***********************************************
 * BOTONES GENERALES
 ***********************************************/
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

btnUsersView.addEventListener("click", () => {
  hide(sectionsView);
  hide(examDetailView);
  show(usersView);
  loadUsers();
});

btnNewSection.addEventListener("click", () => {
  openModal({
    title: "Nueva sección",
    fieldsHtml: `
      <label class="field">
        <span>Nombre de la sección</span>
        <input type="text" id="field-section-name" required />
      </label>
    `,
    onSubmit: async () => {
      const name = document.getElementById("field-section-name").value.trim();
      if (!name) return;
      await addDoc(collection(db, "sections"), {
        name,
        createdAt: serverTimestamp(),
      });
      await loadSections();
      closeModal();
    },
  });
});

// Sidebar móvil
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}
