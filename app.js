// --- Firebase modular (v9+) desde CDN ---
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
  addDoc,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
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

// --- DOM ---
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("sidebar-sections");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const btnNewSection = document.getElementById("btn-new-section");
const btnUsersView = document.getElementById("btn-users-view");
const btnEditSocial = document.getElementById("btn-edit-social");

const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");
const currentUserEmailSpan = document.getElementById("current-user-email");

const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examDetailView = document.getElementById("exam-detail-view");

const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById(
  "current-section-subtitle"
);
const examsList = document.getElementById("exams-list");
const btnNewExam = document.getElementById("btn-new-exam");

const usersList = document.getElementById("users-list");
const btnNewUser = document.getElementById("btn-new-user");

// NUEVOS elementos para edición directa del examen
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const questionsList = document.getElementById("questions-list");
const btnBackToExams = document.getElementById("btn-back-to-exams");
const btnNewQuestion = document.getElementById("btn-new-question");

const socialButtons = document.querySelectorAll(".social-icon");

// Modal genérico (se sigue usando para secciones, usuarios, redes)
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalFields = document.getElementById("modal-fields");
const modalForm = document.getElementById("modal-form");
const modalCancel = document.getElementById("modal-cancel");

// Estado
let currentSectionId = null;
let currentExamId = null;
let modalSubmitHandler = null;

// Colecciones
const colSections = collection(db, "sections");
const colExams = collection(db, "exams");
const colUsers = collection(db, "users");
const colQuestions = collection(db, "questions");
const docSettingsSocial = doc(db, "settings", "socialLinks");

// --- Utilidades UI ---
function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function setLoading(btn, isLoading, textDefault = "Guardar") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || textDefault;
    btn.disabled = false;
  }
}

function renderEmptyMessage(container, text) {
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

// Modal genérico
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

// --- AUTH / LOGIN ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  hide(loginError);

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  const btn = document.getElementById("btn-login");
  setLoading(btn, true);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Buscar en colección users por email
    const qUsers = query(colUsers, where("email", "==", user.email));
    const snap = await getDocs(qUsers);

    if (snap.empty) {
      throw new Error(
        "Tu usuario no está registrado en la colección 'users'."
      );
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    if (userData.role !== "admin") {
      throw new Error("Tu usuario no tiene rol de administrador.");
    }

    // Fecha límite
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (userData.expiryDate && userData.expiryDate < today) {
      await updateDoc(userDoc.ref, { status: "inactivo" });
      throw new Error(
        "Tu acceso ha vencido. Contacta al administrador para renovarlo."
      );
    }

    if (userData.status !== "activo") {
      throw new Error(
        "Tu usuario está inactivo. Contacta al administrador para activarlo."
      );
    }
  } catch (err) {
    console.error(err);
    loginError.textContent =
      err.message || "No se pudo iniciar sesión. Revisa tus datos.";
    show(loginError);
    await signOut(auth).catch(() => {});
  } finally {
    setLoading(btn, false);
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmailSpan.textContent = user.email || "";
    hide(loginView);
    show(adminView);
    show(btnLogout);

    // Vista por defecto: secciones
    show(sectionsView);
    hide(usersView);
    hide(examDetailView);
    btnUsersView.classList.remove("btn-secondary");
    btnUsersView.classList.add("btn-outline");

    currentSectionId = null;
    currentExamId = null;
    currentSectionTitle.textContent = "Selecciona una sección";
    currentSectionSubtitle.textContent =
      "Elige una sección en la barra lateral para ver sus exámenes.";
    hide(btnNewExam);
    renderEmptyMessage(
      examsList,
      "Aún no has seleccionado ninguna sección."
    );

    await Promise.all([loadSections(), loadSocialLinks()]);
  } else {
    show(loginView);
    hide(adminView);
    hide(btnLogout);
    currentUserEmailSpan.textContent = "";
    loginForm.reset();
  }
});

// --- Sidebar móvil ---
btnToggleSidebar.addEventListener("click", () => {
  sidebar.classList.toggle("sidebar--open");
});

// --- SECCIONES ---
async function loadSections() {
  const snap = await getDocs(colSections);
  sidebarSections.innerHTML = "";

  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="font-size:12px;color:#6b7280;padding:4px 6px;">
        No hay secciones aún.
      </li>
    `;
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
    li.dataset.id = id;

    const left = document.createElement("div");
    left.className = "sidebar__section-name";
    left.textContent = data.name || "Sección sin título";

    const actions = document.createElement("div");
    actions.className = "sidebar__section-actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "icon-btn";
    btnEdit.title = "Editar sección";
    btnEdit.textContent = "✏";

    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-btn";
    btnDelete.title = "Eliminar sección";
    btnDelete.textContent = "🗑";

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    li.appendChild(left);
    li.appendChild(actions);

    // Seleccionar sección (click en el nombre)
    left.addEventListener("click", () => {
      currentSectionId = id;
      currentExamId = null;

      document
        .querySelectorAll(".sidebar__section-item")
        .forEach((el) =>
          el.classList.remove("sidebar__section-item--active")
        );
      li.classList.add("sidebar__section-item--active");

      show(sectionsView);
      hide(usersView);
      hide(examDetailView);
      btnUsersView.classList.remove("btn-secondary");
      btnUsersView.classList.add("btn-outline");

      sidebar.classList.remove("sidebar--open");

      currentSectionTitle.textContent = data.name || "Sección";
      currentSectionSubtitle.textContent =
        "Gestiona los exámenes de esta sección.";
      show(btnNewExam);
      loadExamsForSection(id);
    });

    btnEdit.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(id, data);
    });

    btnDelete.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmDelete = window.confirm(
        "¿Eliminar esta sección y todos sus exámenes?"
      );
      if (!confirmDelete) return;
      await deleteSectionWithExams(id);
      if (currentSectionId === id) {
        currentSectionId = null;
        currentExamId = null;
        currentSectionTitle.textContent = "Selecciona una sección";
        currentSectionSubtitle.textContent =
          "Elige una sección en la barra lateral para ver sus exámenes.";
        hide(btnNewExam);
        renderEmptyMessage(
          examsList,
          "Aún no has seleccionado ninguna sección."
        );
      }
      await loadSections();
    });

    sidebarSections.appendChild(li);
  });
}

async function deleteSectionWithExams(sectionId) {
  const qExams = query(colExams, where("sectionId", "==", sectionId));
  const examsSnap = await getDocs(qExams);

  for (const exDoc of examsSnap.docs) {
    const exId = exDoc.id;
    const qQuestions = query(colQuestions, where("examId", "==", exId));
    const qSnap = await getDocs(qQuestions);
    for (const qDoc of qSnap.docs) {
      await deleteDoc(qDoc.ref);
    }
    await deleteDoc(exDoc.ref);
  }

  await deleteDoc(doc(db, "sections", sectionId));
}

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
      const input = document.getElementById("field-section-name");
      const name = input.value.trim();
      if (!name) return;

      const submitBtn = document.getElementById("modal-submit");
      setLoading(submitBtn, true);

      try {
        const docRef = await addDoc(colSections, {
          name,
          createdAt: serverTimestamp(),
        });
        currentSectionId = docRef.id;
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo crear la sección.");
      } finally {
        setLoading(submitBtn, false);
      }
    },
  });
}

function openEditSectionModal(id, data) {
  openModal({
    title: "Editar sección",
    fieldsHtml: `
      <label class="field">
        <span>Nombre de la sección</span>
        <input type="text" id="field-section-name" required value="${
          data.name || ""
        }" />
      </label>
    `,
    onSubmit: async () => {
      const input = document.getElementById("field-section-name");
      const name = input.value.trim();
      if (!name) return;

      const submitBtn = document.getElementById("modal-submit");
      setLoading(submitBtn, true);

      try {
        await updateDoc(doc(db, "sections", id), { name });
        if (currentSectionId === id) {
          currentSectionTitle.textContent = name;
        }
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar la sección.");
      } finally {
        setLoading(submitBtn, false);
      }
    },
  });
}

btnNewSection.addEventListener("click", openNewSectionModal);

// --- EXÁMENES ---
async function loadExamsForSection(sectionId) {
  const qEx = query(colExams, where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(
      examsList,
      "No hay exámenes en esta sección. Crea el primero con el botón “Nuevo examen”."
    );
    return;
  }

  examsList.innerHTML = "";

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const card = document.createElement("div");
    card.className = "card-item";

    const titleRow = document.createElement("div");
    titleRow.className = "card-item__title-row";

    const title = document.createElement("div");
    title.className = "card-item__title";
    title.textContent = data.name || "Examen sin título";

    const actions = document.createElement("div");
    actions.className = "card-item__actions";

    const btnOpen = document.createElement("button");
    btnOpen.className = "btn btn-secondary";
    btnOpen.style.fontSize = "12px";
    btnOpen.textContent = "Abrir";

    const btnEdit = document.createElement("button");
    btnEdit.className = "icon-btn";
    btnEdit.textContent = "✏";
    btnEdit.title = "Editar nombre";

    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-btn";
    btnDelete.textContent = "🗑";
    btnDelete.title = "Eliminar examen";

    actions.appendChild(btnOpen);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    titleRow.appendChild(title);
    titleRow.appendChild(actions);

    const badgeRow = document.createElement("div");
    badgeRow.className = "card-item__badge-row";
    const attempts = document.createElement("div");
    attempts.className = "badge";
    attempts.innerHTML = `<span class="badge-dot"></span> ${
      data.attemptsCount || 0
    } intentos`;

    badgeRow.appendChild(attempts);

    card.appendChild(titleRow);
    card.appendChild(badgeRow);

    btnOpen.addEventListener("click", () => {
      openExamDetail(id, data);
    });

    btnEdit.addEventListener("click", () => {
      openEditExamModal(id, data);
    });

    btnDelete.addEventListener("click", async () => {
      const confirmDelete = window.confirm(
        "¿Eliminar este examen y todas sus preguntas?"
      );
      if (!confirmDelete) return;

      // Borrar preguntas del examen
      const qQuestions = query(
        colQuestions,
        where("examId", "==", id)
      );
      const qSnap = await getDocs(qQuestions);
      for (const qDoc of qSnap.docs) {
        await deleteDoc(qDoc.ref);
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
      const input = document.getElementById("field-exam-name");
      const name = input.value.trim();
      if (!name) return;

      const submitBtn = document.getElementById("modal-submit");
      setLoading(submitBtn, true);

      try {
        const docRef = await addDoc(colExams, {
          name,
          sectionId: currentSectionId,
          attemptsCount: 0,
          createdAt: serverTimestamp(),
        });
        await loadExamsForSection(currentSectionId);
        openExamDetail(docRef.id, { name });
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo crear el examen.");
      } finally {
        setLoading(submitBtn, false);
      }
    },
  });
}

function openEditExamModal(id, data) {
  openModal({
    title: "Editar examen",
    fieldsHtml: `
      <label class="field">
        <span>Nombre del examen</span>
        <input type="text" id="field-exam-name" required value="${
          data.name || ""
        }" />
      </label>
    `,
    onSubmit: async () => {
      const input = document.getElementById("field-exam-name");
      const name = input.value.trim();
      if (!name) return;

      const submitBtn = document.getElementById("modal-submit");
      setLoading(submitBtn, true);

      try {
        await updateDoc(doc(db, "exams", id), { name });
        if (currentSectionId) {
          await loadExamsForSection(currentSectionId);
        }
        // si estás en el detalle de este examen, actualizamos el input
        if (currentExamId === id && examNameInput) {
          examNameInput.value = name;
        }
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar el examen.");
      } finally {
        setLoading(submitBtn, false);
      }
    },
  });
}

btnNewExam.addEventListener("click", openNewExamModal);

// --- DETALLE DE EXAMEN + PREGUNTAS (EDICIÓN EN PANTALLA) ---
function openExamDetail(examId, examData) {
  currentExamId = examId;

  show(examDetailView);
  hide(sectionsView);
  hide(usersView);

  if (examNameInput) {
    examNameInput.value = examData.name || "";
  }

  loadQuestionsForExam(examId);
}

btnBackToExams.addEventListener("click", () => {
  show(sectionsView);
  hide(usersView);
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
  setLoading(btn, true, "Guardar nombre");
  try {
    await updateDoc(doc(db, "exams", currentExamId), {
      name,
      updatedAt: serverTimestamp(),
    });
    if (currentSectionId) {
      await loadExamsForSection(currentSectionId);
    }
    alert("Nombre del examen actualizado.");
  } catch (err) {
    console.error(err);
    alert("No se pudo actualizar el examen.");
  } finally {
    setLoading(btn, false, "Guardar nombre");
  }
});

async function loadQuestionsForExam(examId) {
  const q = query(colQuestions, where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    renderEmptyMessage(
      questionsList,
      "No hay preguntas en este examen. Usa “Nueva pregunta” para agregar."
    );
    return;
  }

  questionsList.innerHTML = "";

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    renderQuestionCard(docSnap.id, data);
  });
}

// Render de una tarjeta de pregunta editable en la pantalla
function renderQuestionCard(id, data) {
  const card = document.createElement("div");
  card.className = "card-item";
  card.dataset.id = id;

  card.innerHTML = `
    <div class="field">
      <span>Caso clínico</span>
      <textarea class="q-case" required></textarea>
    </div>

    <div class="field">
      <span>Inciso A</span>
      <input type="text" class="q-a" required />
    </div>

    <div class="field">
      <span>Inciso B</span>
      <input type="text" class="q-b" required />
    </div>

    <div class="field">
      <span>Inciso C</span>
      <input type="text" class="q-c" required />
    </div>

    <div class="field">
      <span>Inciso D</span>
      <input type="text" class="q-d" required />
    </div>

    <div class="field">
      <span>Respuesta correcta</span>
      <select class="q-correct" required>
        <option value="">Selecciona</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>
    </div>

    <div class="field">
      <span>Justificación</span>
      <textarea class="q-just" required></textarea>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
      <button type="button" class="btn btn-outline btn-sm q-delete">Eliminar</button>
      <button type="button" class="btn btn-secondary btn-sm q-save">Guardar</button>
    </div>
  `;

  // Asignar valores
  card.querySelector(".q-case").value = data.caseText || "";
  card.querySelector(".q-a").value = data.optionA || "";
  card.querySelector(".q-b").value = data.optionB || "";
  card.querySelector(".q-c").value = data.optionC || "";
  card.querySelector(".q-d").value = data.optionD || "";
  card.querySelector(".q-correct").value = data.correctOption || "";
  card.querySelector(".q-just").value = data.justification || "";

  const btnSave = card.querySelector(".q-save");
  const btnDelete = card.querySelector(".q-delete");

  btnSave.addEventListener("click", async () => {
    if (!currentExamId) return;

    const caseText = card.querySelector(".q-case").value.trim();
    const optionA = card.querySelector(".q-a").value.trim();
    const optionB = card.querySelector(".q-b").value.trim();
    const optionC = card.querySelector(".q-c").value.trim();
    const optionD = card.querySelector(".q-d").value.trim();
    const correctOption = card.querySelector(".q-correct").value;
    const justification = card.querySelector(".q-just").value.trim();

    if (
      !caseText ||
      !optionA ||
      !optionB ||
      !optionC ||
      !optionD ||
      !correctOption ||
      !justification
    ) {
      alert("Completa todos los campos de la pregunta.");
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = "Guardando...";

    try {
      await updateDoc(doc(db, "questions", id), {
        examId: currentExamId,
        caseText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        justification,
        updatedAt: serverTimestamp(),
      });
      alert("Pregunta actualizada.");
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la pregunta.");
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Guardar";
    }
  });

  btnDelete.addEventListener("click", async () => {
    const confirmDelete = window.confirm("¿Eliminar esta pregunta?");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "questions", id));
      await loadQuestionsForExam(currentExamId);
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la pregunta.");
    }
  });

  questionsList.appendChild(card);
}

// Nueva tarjeta en blanco (para crear pregunta)
function renderNewQuestionCard() {
  const card = document.createElement("div");
  card.className = "card-item";

  card.innerHTML = `
    <div class="field">
      <span>Caso clínico</span>
      <textarea class="q-case" required></textarea>
    </div>

    <div class="field">
      <span>Inciso A</span>
      <input type="text" class="q-a" required />
    </div>

    <div class="field">
      <span>Inciso B</span>
      <input type="text" class="q-b" required />
    </div>

    <div class="field">
      <span>Inciso C</span>
      <input type="text" class="q-c" required />
    </div>

    <div class="field">
      <span>Inciso D</span>
      <input type="text" class="q-d" required />
    </div>

    <div class="field">
      <span>Respuesta correcta</span>
      <select class="q-correct" required>
        <option value="">Selecciona</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>
    </div>

    <div class="field">
      <span>Justificación</span>
      <textarea class="q-just" required></textarea>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
      <button type="button" class="btn btn-outline btn-sm q-cancel">Cancelar</button>
      <button type="button" class="btn btn-primary btn-sm q-create">Crear</button>
    </div>
  `;

  const btnCreate = card.querySelector(".q-create");
  const btnCancel = card.querySelector(".q-cancel");

  btnCreate.addEventListener("click", async () => {
    if (!currentExamId) return;

    const caseText = card.querySelector(".q-case").value.trim();
    const optionA = card.querySelector(".q-a").value.trim();
    const optionB = card.querySelector(".q-b").value.trim();
    const optionC = card.querySelector(".q-c").value.trim();
    const optionD = card.querySelector(".q-d").value.trim();
    const correctOption = card.querySelector(".q-correct").value;
    const justification = card.querySelector(".q-just").value.trim();

    if (
      !caseText ||
      !optionA ||
      !optionB ||
      !optionC ||
      !optionD ||
      !correctOption ||
      !justification
    ) {
      alert("Completa todos los campos de la pregunta.");
      return;
    }

    btnCreate.disabled = true;
    btnCreate.textContent = "Creando...";

    try {
      await addDoc(colQuestions, {
        examId: currentExamId,
        caseText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        justification,
        createdAt: serverTimestamp(),
      });
      await loadQuestionsForExam(currentExamId);
    } catch (err) {
      console.error(err);
      alert("No se pudo crear la pregunta.");
    } finally {
      btnCreate.disabled = false;
      btnCreate.textContent = "Crear";
    }
  });

  btnCancel.addEventListener("click", () => {
    card.remove();
    if (!questionsList.children.length) {
      renderEmptyMessage(
        questionsList,
        "No hay preguntas en este examen. Usa “Nueva pregunta” para agregar."
      );
    }
  });

  questionsList.appendChild(card);
}

btnNewQuestion.addEventListener("click", () => {
  if (!currentExamId) {
    alert("Primero selecciona o crea un examen.");
    return;
  }
  // Si antes había mensaje vacío, limpiamos
  const hasEmptyMessage =
    questionsList.children.length === 1 &&
    questionsList.querySelector(".card") &&
    questionsList.querySelector(".card").textContent.includes("No hay preguntas");
  if (hasEmptyMessage) {
    questionsList.innerHTML = "";
  }
  renderNewQuestionCard();
});

// --- USUARIOS ---
async function loadUsers() {
  const snap = await getDocs(colUsers);

  if (snap.empty) {
    usersList.innerHTML = "";
    renderEmptyMessage(
      usersList,
      "No hay usuarios registrados. Crea el primero con el botón “Nuevo usuario”."
    );
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

  const today = new Date().toISOString().slice(0, 10);
  const updates = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    let status = data.status || "inactivo";
    const expiry = data.expiryDate || "";

    if (expiry && expiry < today && status === "activo") {
      status = "inactivo";
      updates.push(updateDoc(docSnap.ref, { status: "inactivo" }));
    }

    const chipStatusClass =
      status === "activo" ? "chip--activo" : "chip--inactivo";
    const chipRoleClass =
      data.role === "admin" ? "chip--admin" : "chip--user";

    html += `
      <tr data-id="${docSnap.id}">
        <td>${data.name || ""}</td>
        <td>${data.email || ""}</td>
        <td><span class="chip ${chipStatusClass}">${status}</span></td>
        <td><span class="chip ${chipRoleClass}">${data.role || ""}</span></td>
        <td>${expiry || "—"}</td>
        <td>
          <button class="icon-btn" data-action="edit">✏</button>
          <button class="icon-btn" data-action="delete">🗑</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  usersList.innerHTML = html;

  if (updates.length) {
    Promise.all(updates).catch((e) => console.error(e));
  }

  usersList.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = row.dataset.id;
    const btnEdit = row.querySelector('button[data-action="edit"]');
    const btnDelete = row.querySelector('button[data-action="delete"]');

    btnEdit.addEventListener("click", () => {
      openUserModal(id);
    });

    btnDelete.addEventListener("click", async () => {
      const confirmDelete = window.confirm(
        "¿Eliminar este usuario de la plataforma?"
      );
      if (!confirmDelete) return;
      await deleteDoc(doc(db, "users", id));
      loadUsers();
    });
  });
}

function openUserModal(id = null) {
  const isEdit = Boolean(id);
  let dataPromise = Promise.resolve(null);

  if (isEdit) {
    dataPromise = getDoc(doc(db, "users", id)).then((d) =>
      d.exists() ? d.data() : null
    );
  }

  dataPromise.then((data = {}) => {
    openModal({
      title: isEdit ? "Editar usuario" : "Nuevo usuario",
      fieldsHtml: `
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="field-user-name" required value="${
            data.name || ""
          }" />
        </label>

        <label class="field">
          <span>Correo</span>
          <input type="email" id="field-user-email" required value="${
            data.email || ""
          }" />
        </label>

        <label class="field">
          <span>Contraseña (visible solo para admin)</span>
          <input type="text" id="field-user-password" required value="${
            data.password || ""
          }" />
        </label>

        <label class="field">
          <span>Estado</span>
          <select id="field-user-status">
            <option value="activo" ${
              data.status === "activo" ? "selected" : ""
            }>Activo</option>
            <option value="inactivo" ${
              data.status === "inactivo" ? "selected" : ""
            }>Inactivo</option>
          </select>
        </label>

        <label class="field">
          <span>Rol</span>
          <select id="field-user-role">
            <option value="admin" ${
              data.role === "admin" ? "selected" : ""
            }>Administrador</option>
            <option value="usuario" ${
              data.role === "usuario" ? "selected" : ""
            }>Usuario</option>
          </select>
        </label>

        <label class="field">
          <span>Fecha límite de acceso (YYYY-MM-DD)</span>
          <input type="date" id="field-user-expiry" value="${
            data.expiryDate || ""
          }" />
        </label>
      `,
      onSubmit: async () => {
        const name = document
          .getElementById("field-user-name")
          .value.trim();
        const email = document
          .getElementById("field-user-email")
          .value.trim();
        const password = document
          .getElementById("field-user-password")
          .value.trim();
        const status = document.getElementById("field-user-status").value;
        const role = document.getElementById("field-user-role").value;
        const expiryDate =
          document.getElementById("field-user-expiry").value || "";

        if (!name || !email || !password) return;

        const submitBtn = document.getElementById("modal-submit");
        setLoading(submitBtn, true);

        try {
          const payload = {
            name,
            email,
            password,
            status,
            role,
            expiryDate,
            updatedAt: serverTimestamp(),
          };

          if (isEdit) {
            await updateDoc(doc(db, "users", id), payload);
          } else {
            payload.createdAt = serverTimestamp();
            await addDoc(colUsers, payload);
            alert(
              "Usuario creado en Firestore.\nRecuerda: si quieres que pueda iniciar sesión, también debes crearlo en Firebase Authentication con el mismo correo y contraseña."
            );
          }

          await loadUsers();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo guardar el usuario.");
        } finally {
          setLoading(submitBtn, false);
        }
      },
    });
  });
}

btnNewUser.addEventListener("click", () => openUserModal());

btnUsersView.addEventListener("click", () => {
  hide(sectionsView);
  hide(examDetailView);
  show(usersView);
  btnUsersView.classList.remove("btn-outline");
  btnUsersView.classList.add("btn-secondary");
  loadUsers();
});

// --- REDES SOCIALES ---
async function loadSocialLinks() {
  try {
    const snap = await getDoc(docSettingsSocial);
    if (!snap.exists()) return;

    const data = snap.data();
    socialButtons.forEach((btn) => {
      const network = btn.dataset.network;
      if (data[network]) {
        btn.dataset.url = data[network];
      } else {
        delete btn.dataset.url;
      }
    });
  } catch (err) {
    console.error(err);
  }
}

btnEditSocial.addEventListener("click", () => {
  getDoc(docSettingsSocial)
    .then((snap) => (snap.exists() ? snap.data() : {}))
    .then((data = {}) => {
      openModal({
        title: "Enlaces de redes sociales",
        fieldsHtml: `
          <label class="field">
            <span>Instagram (URL)</span>
            <input type="url" id="field-instagram" value="${
              data.instagram || ""
            }" />
          </label>
          <label class="field">
            <span>WhatsApp (URL)</span>
            <input type="url" id="field-whatsapp" value="${
              data.whatsapp || ""
            }" />
          </label>
          <label class="field">
            <span>TikTok (URL)</span>
            <input type="url" id="field-tiktok" value="${
              data.tiktok || ""
            }" />
          </label>
          <label class="field">
            <span>Telegram (URL)</span>
            <input type="url" id="field-telegram" value="${
              data.telegram || ""
            }" />
          </label>
        `,
        onSubmit: async () => {
          const instagram =
            document.getElementById("field-instagram").value.trim();
          const whatsapp =
            document.getElementById("field-whatsapp").value.trim();
          const tiktok = document
            .getElementById("field-tiktok")
            .value.trim();
          const telegram = document
            .getElementById("field-telegram")
            .value.trim();

          const submitBtn = document.getElementById("modal-submit");
          setLoading(submitBtn, true);

          try {
            await updateDoc(docSettingsSocial, {
              instagram,
              whatsapp,
              tiktok,
              telegram,
              updatedAt: serverTimestamp(),
            });
            await loadSocialLinks();
            closeModal();
          } catch (err) {
            // Si el doc no existe, lo creamos
            try {
              await addDoc(collection(db, "settings"), {
                instagram,
                whatsapp,
                tiktok,
                telegram,
                createdAt: serverTimestamp(),
              });
              await loadSocialLinks();
              closeModal();
            } catch (err2) {
              console.error(err2);
              alert("No se pudieron guardar los enlaces.");
            }
          } finally {
            setLoading(submitBtn, false);
          }
        },
      });
    });
});

socialButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.dataset.url;
    if (!url) {
      alert("No se ha configurado el enlace de esta red social.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  });
});

// --- MODAL GENÉRICO ---
modalCancel.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

modalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (typeof modalSubmitHandler === "function") {
    await modalSubmitHandler();
  }
});
