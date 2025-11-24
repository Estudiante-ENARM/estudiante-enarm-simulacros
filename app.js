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

// Login
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

// Header
const btnLogout = document.getElementById("btn-logout");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const currentUserEmailSpan = document.getElementById("current-user-email");

// Sidebar
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("sidebar-sections");
const btnNewSection = document.getElementById("btn-new-section");
const btnUsersView = document.getElementById("btn-users-view");
const btnEditSocial = document.getElementById("btn-edit-social");
const socialButtons = document.querySelectorAll(".social-icon");

// Panel principal
const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examDetailView = document.getElementById("exam-detail-view");

const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");

const btnNewExam = document.getElementById("btn-new-exam");
const examsList = document.getElementById("exams-list");

const usersList = document.getElementById("users-list");
const btnNewUser = document.getElementById("btn-new-user");

// Detalle examen
const btnBackToExams = document.getElementById("btn-back-to-exams");
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question");
const questionsList = document.getElementById("questions-list");

// Modal genérico
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
 * UTILIDADES UI
 ***********************************************/
function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function setLoading(btn, isLoading, textDefault) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || textDefault || "Guardar";
    btn.disabled = false;
  }
}

function renderEmptyMessage(container, text) {
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

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

// Cerrar modal al hacer click fuera
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

modalCancel.addEventListener("click", () => {
  closeModal();
});

modalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (typeof modalSubmitHandler === "function") {
    await modalSubmitHandler();
  }
});

/***********************************************
 * SIDEBAR (MÓVIL)
 ***********************************************/
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

/***********************************************
 * LOGIN ADMIN
 ***********************************************/
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  hide(loginError);
  const btn = document.getElementById("btn-login");
  setLoading(btn, true);

  try {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Validar en colección users (ID = email)
    const userDocRef = doc(db, "users", user.email);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      throw new Error("Tu usuario no está registrado en Firestore (colección 'users').");
    }

    const data = userSnap.data();

    if (data.role !== "admin") {
      throw new Error("Tu usuario no tiene rol de administrador.");
    }

    const today = new Date().toISOString().slice(0, 10);
    if (data.expiryDate && data.expiryDate < today) {
      await updateDoc(userDocRef, { status: "inactivo" });
      throw new Error("Tu acceso ha vencido. Contacta al administrador para renovarlo.");
    }

    if (data.status !== "activo") {
      throw new Error("Tu usuario está inactivo. Contacta al administrador para activarlo.");
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = err.message || "No se pudo iniciar sesión. Revisa tus datos.";
    show(loginError);
    await signOut(auth).catch(() => {});
  } finally {
    setLoading(btn, false, "Entrar");
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  }
});

// Cambio de estado de autenticación
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmailSpan.textContent = user.email || "";
    hide(loginView);
    show(adminView);
    show(btnLogout);

    show(sectionsView);
    hide(usersView);
    hide(examDetailView);

    btnUsersView.classList.remove("btn-secondary");
    btnUsersView.classList.add("btn-outline");

    currentSectionId = null;
    currentExamId = null;
    currentSectionName = "";
    currentSectionTitle.textContent = "Selecciona una sección";
    currentSectionSubtitle.textContent = "Elige una sección en la barra lateral para ver sus exámenes.";
    hide(btnNewExam);
    renderEmptyMessage(examsList, "Aún no has seleccionado ninguna sección.");

    await Promise.all([loadSections(), loadSocialLinks()]);
  } else {
    show(loginView);
    hide(adminView);
    hide(btnLogout);
    currentUserEmailSpan.textContent = "";
    loginForm.reset();
  }
});
/***********************************************
 * SECCIONES
 ***********************************************/
async function loadSections() {
  const snap = await getDocs(collection(db, "sections"));
  sidebarSections.innerHTML = "";

  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="font-size:12px;color:#6b7280;padding:4px 6px;">
        No hay secciones aún.
      </li>`;
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    if (id === currentSectionId) {
      li.classList.add("sidebar__section-item--active");
    }

    li.innerHTML = `
      <div class="sidebar__section-name">${data.name}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-section">✏</button>
        <button class="icon-btn delete-section">🗑</button>
      </div>
    `;

    // Selección de sección
    li.addEventListener("click", () => {
      handleSelectSection(id, data.name, li);
    });

    // Editar sección
    li.querySelector(".edit-section").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(id, data.name);
    });

    // Eliminar sección
    li.querySelector(".delete-section").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("¿Eliminar esta sección y TODO su contenido?");
      if (!ok) return;
      await deleteSectionWithAllData(id);

      if (currentSectionId === id) {
        currentSectionId = null;
        currentExamId = null;
        currentSectionTitle.textContent = "Selecciona una sección";
        hide(btnNewExam);
        renderEmptyMessage(examsList, "Aún no has seleccionado ninguna sección.");
      }
      await loadSections();
    });

    sidebarSections.appendChild(li);
  });
}

function handleSelectSection(id, name, li) {
  currentSectionId = id;
  currentSectionName = name;
  currentExamId = null;

  document.querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));

  li.classList.add("sidebar__section-item--active");

  show(sectionsView);
  hide(usersView);
  hide(examDetailView);

  sidebar.classList.remove("sidebar--open");

  currentSectionTitle.textContent = currentSectionName;
  currentSectionSubtitle.textContent =
    "Gestiona los exámenes de esta sección.";
  show(btnNewExam);
  loadExamsForSection(id);
}

async function deleteSectionWithAllData(sectionId) {
  const exQ = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const examsSnap = await getDocs(exQ);

  for (const ex of examsSnap.docs) {
    const examId = ex.id;

    const qCases = query(collection(db, "questions"), where("examId", "==", examId));
    const casesSnap = await getDocs(qCases);

    for (const c of casesSnap.docs) {
      await deleteDoc(c.ref);
    }

    await deleteDoc(ex.ref);
  }
  await deleteDoc(doc(db, "sections", sectionId));
}

// Modal crear sección
function openNewSectionModal() {
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
      const btn = modalSubmit;
      setLoading(btn, true);

      try {
        const ref = await addDoc(collection(db, "sections"), {
          name,
          createdAt: serverTimestamp(),
        });
        currentSectionId = ref.id;
        currentSectionName = name;
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo crear la sección.");
      } finally {
        setLoading(btn, false);
      }
    },
  });
}

function openEditSectionModal(id, nameCurrent) {
  openModal({
    title: "Editar sección",
    fieldsHtml: `
      <label class="field">
        <span>Nombre de la sección</span>
        <input type="text" id="field-section-name" value="${nameCurrent}" required />
      </label>
    `,
    onSubmit: async () => {
      const name = document.getElementById("field-section-name").value.trim();
      if (!name) return;
      const btn = modalSubmit;
      setLoading(btn, true);

      try {
        await updateDoc(doc(db, "sections", id), { name });
        if (currentSectionId === id) {
          currentSectionName = name;
          currentSectionTitle.textContent = name;
        }
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar la sección.");
      } finally {
        setLoading(btn, false);
      }
    },
  });
}

btnNewSection.addEventListener("click", openNewSectionModal);

/***********************************************
 * EXÁMENES
 ***********************************************/
async function loadExamsForSection(sectionId) {
  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(
      examsList,
      "No hay exámenes en esta sección. Usa “Nuevo examen”."
    );
    return;
  }

  examsList.innerHTML = "";

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${data.name}</div>
        <div class="card-item__actions">
          <button class="btn btn-secondary btn-sm open-exam">Abrir</button>
          <button class="icon-btn edit-exam">✏</button>
          <button class="icon-btn delete-exam">🗑</button>
        </div>
      </div>
      <div class="card-item__badge-row">
        <div class="badge">
          <span class="badge-dot"></span>
          ${data.attemptsCount || 0} intentos
        </div>
      </div>
    `;

    card.querySelector(".open-exam").addEventListener("click", () => {
      openExamDetail(id, data.name);
    });

    card.querySelector(".edit-exam").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditExamModal(id, data.name);
    });

    card.querySelector(".delete-exam").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("¿Eliminar este examen y TODOS sus casos clínicos?");
      if (!ok) return;

      const qCases = query(collection(db, "questions"), where("examId", "==", id));
      const casesSnap = await getDocs(qCases);
      for (const cDoc of casesSnap.docs) {
        await deleteDoc(cDoc.ref);
      }

      await deleteDoc(doc(db, "exams", id));
      loadExamsForSection(sectionId);
    });

    examsList.appendChild(card);
  });
}

function openNewExamModal() {
  if (!currentSectionId) return;

  openModal({
    title: "Nuevo examen",
    fieldsHtml: `
      <label class="field">
        <span>Nombre del examen</span>
        <input type="text" id="field-exam-name" required />
      </label>
    `,
    onSubmit: async () => {
      const name = document.getElementById("field-exam-name").value.trim();
      if (!name) return;

      const btn = modalSubmit;
      setLoading(btn, true);

      try {
        const ref = await addDoc(collection(db, "exams"), {
          name,
          sectionId: currentSectionId,
          attemptsCount: 0,
          createdAt: serverTimestamp(),
        });
        loadExamsForSection(currentSectionId);
        openExamDetail(ref.id, name);
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo crear el examen.");
      } finally {
        setLoading(btn, false);
      }
    },
  });
}

btnNewExam.addEventListener("click", openNewExamModal);

/***********************************************
 * DETALLE DEL EXAMEN
 ***********************************************/
function openExamDetail(examId, examName) {
  currentExamId = examId;

  show(examDetailView);
  hide(sectionsView);
  hide(usersView);

  examNameInput.value = examName;

  loadCasesForExam(examId);
}

btnBackToExams.addEventListener("click", () => {
  show(sectionsView);
  hide(examDetailView);
  currentExamId = null;
});

btnSaveExamMeta.addEventListener("click", async () => {
  if (!currentExamId) return;

  const name = examNameInput.value.trim();
  if (!name) {
    alert("Escribe un nombre para el examen.");
    return;
  }

  const btn = btnSaveExamMeta;
  setLoading(btn, true);

  try {
    await updateDoc(doc(db, "exams", currentExamId), {
      name,
      updatedAt: serverTimestamp(),
    });
    loadExamsForSection(currentSectionId);
    alert("Nombre actualizado.");
  } catch (err) {
    console.error(err);
    alert("Error al actualizar.");
  } finally {
    setLoading(btn, false);
  }
});
/***********************************************
 * CASOS CLÍNICOS (VARIAS PREGUNTAS)
 ***********************************************/
async function loadCasesForExam(examId) {
  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  questionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(
      questionsList,
      "No hay casos clínicos. Usa “+ Nueva pregunta” para crear el primero."
    );
    return;
  }

  snap.forEach((docSnap) => {
    renderCaseBlock(docSnap.id, docSnap.data());
  });
}

function renderCaseBlock(caseId, data) {
  const caseCard = document.createElement("div");
  caseCard.className = "card";
  caseCard.dataset.caseId = caseId;

  caseCard.innerHTML = `
    <label class="field">
      <span>Caso clínico</span>
      <textarea class="case-text" rows="4">${data.caseText || ""}</textarea>
    </label>

    <div class="cards-list case-questions"></div>

    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
      <button class="btn btn-sm btn-primary btn-add-question">+ Agregar pregunta</button>
      <button class="btn btn-sm btn-secondary btn-save-case">Guardar caso</button>
      <button class="btn btn-sm btn-outline btn-delete-case">Eliminar caso</button>
    </div>
  `;

  const questionsContainer = caseCard.querySelector(".case-questions");
  const questions = Array.isArray(data.questions) ? data.questions : [];

  if (questions.length === 0) {
    questionsContainer.appendChild(renderQuestionBlock());
  } else {
    questions.forEach((q) => questionsContainer.appendChild(renderQuestionBlock(q)));
  }

  // Agregar pregunta
  caseCard.querySelector(".btn-add-question").addEventListener("click", () => {
    questionsContainer.appendChild(renderQuestionBlock());
  });

  // Guardar caso
  caseCard.querySelector(".btn-save-case").addEventListener("click", async () => {
    saveCaseBlock(caseId, caseCard);
  });

  // Eliminar caso
  caseCard.querySelector(".btn-delete-case").addEventListener("click", async () => {
    if (!confirm("¿Eliminar este caso clínico y todas sus preguntas?")) return;
    await deleteDoc(doc(db, "questions", caseId));
    await loadCasesForExam(currentExamId);
  });

  questionsList.appendChild(caseCard);
}

function renderQuestionBlock(qData = {}) {
  const card = document.createElement("div");
  card.className = "card-item";

  card.innerHTML = `
    <label class="field">
      <span>Pregunta</span>
      <textarea class="q-question" rows="2">${qData.questionText || ""}</textarea>
    </label>

    <label class="field"><span>Inciso A</span><input class="q-a" value="${qData.optionA || ""}"></label>
    <label class="field"><span>Inciso B</span><input class="q-b" value="${qData.optionB || ""}"></label>
    <label class="field"><span>Inciso C</span><input class="q-c" value="${qData.optionC || ""}"></label>
    <label class="field"><span>Inciso D</span><input class="q-d" value="${qData.optionD || ""}"></label>

    <label class="field">
      <span>Respuesta correcta</span>
      <select class="q-correct">
        <option value="">Selecciona</option>
        <option value="A" ${qData.correctOption === "A" ? "selected" : ""}>A</option>
        <option value="B" ${qData.correctOption === "B" ? "selected" : ""}>B</option>
        <option value="C" ${qData.correctOption === "C" ? "selected" : ""}>C</option>
        <option value="D" ${qData.correctOption === "D" ? "selected" : ""}>D</option>
      </select>
    </label>

    <label class="field">
      <span>Justificación</span>
      <textarea class="q-just" rows="2">${qData.justification || ""}</textarea>
    </label>

    <div style="display:flex; justify-content:flex-end;">
      <button class="btn btn-sm btn-outline btn-delete-question">Eliminar pregunta</button>
    </div>
  `;

  card.querySelector(".btn-delete-question").addEventListener("click", () => {
    card.remove();
  });

  return card;
}

async function saveCaseBlock(caseId, caseCard) {
  const caseText = caseCard.querySelector(".case-text").value.trim();
  const questionCards = caseCard.querySelectorAll(".case-questions .card-item");

  if (!caseText) {
    alert("Escribe el texto del caso clínico.");
    return;
  }

  if (questionCards.length === 0) {
    alert("Agrega al menos una pregunta.");
    return;
  }

  const questions = [];

  for (const card of questionCards) {
    const questionText = card.querySelector(".q-question").value.trim();
    const optionA = card.querySelector(".q-a").value.trim();
    const optionB = card.querySelector(".q-b").value.trim();
    const optionC = card.querySelector(".q-c").value.trim();
    const optionD = card.querySelector(".q-d").value.trim();
    const correctOption = card.querySelector(".q-correct").value;
    const justification = card.querySelector(".q-just").value.trim();

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption || !justification) {
      alert("Completa todos los campos antes de guardar.");
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
    });
  }

  await updateDoc(doc(db, "questions", caseId), {
    examId: currentExamId,
    caseText,
    questions,
    updatedAt: serverTimestamp(),
  });

  alert("Caso clínico guardado.");
  loadCasesForExam(currentExamId);
}

// Crear caso vacío
btnNewQuestion.addEventListener("click", async () => {
  if (!currentExamId) return alert("Selecciona un examen primero.");

  await addDoc(collection(db, "questions"), {
    examId: currentExamId,
    caseText: "",
    questions: [],
    createdAt: serverTimestamp(),
  });

  loadCasesForExam(currentExamId);
});

/***********************************************
 * USUARIOS
 ***********************************************/
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersList.innerHTML = "";
    renderEmptyMessage(
      usersList,
      "No hay usuarios. Usa “+ Nuevo usuario”."
    );
    return;
  }

  let html = `
    <table>
      <thead><tr>
        <th>Nombre</th><th>Correo</th><th>Estado</th><th>Rol</th><th>Fecha límite</th><th></th>
      </tr></thead><tbody>
  `;

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    html += `
      <tr data-id="${docSnap.id}">
        <td>${d.name}</td>
        <td>${d.email}</td>
        <td><span class="chip ${d.status === "activo" ? "chip--activo" : "chip--inactivo"}">${d.status}</span></td>
        <td><span class="chip ${d.role === "admin" ? "chip--admin" : "chip--user"}">${d.role}</span></td>
        <td>${d.expiryDate || "---"}</td>
        <td>
          <button class="icon-btn" data-action="edit">✏</button>
          <button class="icon-btn" data-action="delete">🗑</button>
        </td>
      </tr>`;
  });

  html += "</tbody></table>";
  usersList.innerHTML = html;

  // Eventos
  usersList.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = row.dataset.id;

    row.querySelector('[data-action="edit"]').addEventListener("click", () => {
      openUserModal(id);
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm("¿Eliminar este usuario?")) return;
      await deleteDoc(doc(db, "users", id));
      loadUsers();
    });
  });
}

/***********************************************
 * MODAL DE USUARIOS (CREAR / EDITAR)
 ***********************************************/
function openUserModal(id = null) {
  const isEdit = Boolean(id);

  const dataPromise = isEdit
    ? getDoc(doc(db, "users", id)).then((d) => (d.exists() ? d.data() : {}))
    : Promise.resolve({});

  dataPromise.then((data) => {
    openModal({
      title: isEdit ? "Editar usuario" : "Nuevo usuario",
      fieldsHtml: `
        <label class="field"><span>Nombre</span>
          <input type="text" id="field-user-name" value="${data.name || ""}" required>
        </label>

        <label class="field"><span>Correo (ID)</span>
          <input type="email" id="field-user-email" value="${data.email || ""}" ${isEdit ? "readonly" : ""} required>
        </label>

        <label class="field"><span>Contraseña</span>
          <input type="text" id="field-user-password" value="${data.password || ""}" required>
        </label>

        <label class="field"><span>Estado</span>
          <select id="field-user-status">
            <option value="activo" ${data.status === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${data.status === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </label>

        <label class="field"><span>Rol</span>
          <select id="field-user-role">
            <option value="admin" ${data.role === "admin" ? "selected" : ""}>Administrador</option>
            <option value="usuario" ${data.role === "usuario" ? "selected" : ""}>Usuario</option>
          </select>
        </label>

        <label class="field"><span>Fecha límite</span>
          <input type="date" id="field-user-expiry" value="${data.expiryDate || ""}">
        </label>
      `,
      onSubmit: async () => {
        const name = document.getElementById("field-user-name").value.trim();
        const email = document.getElementById("field-user-email").value.trim();
        const password = document.getElementById("field-user-password").value.trim();
        const status = document.getElementById("field-user-status").value;
        const role = document.getElementById("field-user-role").value;
        const expiryDate = document.getElementById("field-user-expiry").value;

        if (!name || !email || !password) {
          alert("Todos los campos son obligatorios.");
          return;
        }

        const payload = {
          name,
          email,
          password,
          status,
          role,
          expiryDate,
          updatedAt: serverTimestamp(),
        };

        const btn = modalSubmit;
        setLoading(btn, true);

        try {
          if (isEdit) {
            await updateDoc(doc(db, "users", email), payload);
          } else {
            payload.createdAt = serverTimestamp();
            await setDoc(doc(db, "users", email), payload);
            alert("Usuario creado. RECUERDA crear también este usuario en Firebase Authentication.");
          }

          loadUsers();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo guardar el usuario.");
        } finally {
          setLoading(btn, false);
        }
      },
    });
  });
}

/***********************************************
 * EVENTO CORREGIDO PARA "NUEVO USUARIO"
 ***********************************************/
if (btnNewUser) {
  btnNewUser.addEventListener("click", () => openUserModal(null));
}

// Refuerzo adicional por si el DOM recarga secciones dinámicamente
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-new-user") {
    openUserModal(null);
  }
});

/***********************************************
 * REDES SOCIALES
 ***********************************************/
async function loadSocialLinks() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data();
    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      if (data[network]) btn.dataset.url = data[network];
    });
  } catch (err) {
    console.error(err);
  }
}

btnEditSocial.addEventListener("click", async () => {
  let data = {};
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (snap.exists()) data = snap.data();
  } catch {}

  openModal({
    title: "Redes sociales",
    fieldsHtml: `
      <label class="field"><span>Instagram</span><input id="field-instagram" value="${data.instagram || ""}"></label>
      <label class="field"><span>WhatsApp</span><input id="field-whatsapp" value="${data.whatsapp || ""}"></label>
      <label class="field"><span>TikTok</span><input id="field-tiktok" value="${data.tiktok || ""}"></label>
      <label class="field"><span>Telegram</span><input id="field-telegram" value="${data.telegram || ""}"></label>
    `,
    onSubmit: async () => {
      const instagram = document.getElementById("field-instagram").value.trim();
      const whatsapp = document.getElementById("field-whatsapp").value.trim();
      const tiktok = document.getElementById("field-tiktok").value.trim();
      const telegram = document.getElementById("field-telegram").value.trim();

      const btn = modalSubmit;
      setLoading(btn, true);

      try {
        await updateDoc(doc(db, "settings", "socialLinks"), {
          instagram,
          whatsapp,
          tiktok,
          telegram,
          updatedAt: serverTimestamp(),
        });
      } catch {
        await setDoc(doc(db, "settings", "socialLinks"), {
          instagram,
          whatsapp,
          tiktok,
          telegram,
          createdAt: serverTimestamp(),
        });
      }

      await loadSocialLinks();
      setLoading(btn, false);
      closeModal();
    },
  });
});

socialButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.dataset.url;
    if (!url) return alert("No se ha configurado esta red social.");
    window.open(url, "_blank");
  });
});
