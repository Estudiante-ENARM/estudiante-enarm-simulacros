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

// --- Configuración Firebase (tu bloque tal cual) ---
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105",
};

// Initialize Firebase
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

const examDetailTitle = document.getElementById("exam-detail-title");
const questionsList = document.getElementById("questions-list");
const btnBackToExams = document.getElementById("btn-back-to-exams");
const btnNewQuestion = document.getElementById("btn-new-question");

const socialButtons = document.querySelectorAll(".social-icon");

// Modal genérico
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalFields = document.getElementById("modal-fields");
const modalForm = document.getElementById("modal-form");
const modalCancel = document.getElementById("modal-cancel");

// Estado global simple
let currentSectionId = null;
let currentExamId = null;
let modalSubmitHandler = null;

// Colecciones
const colSections = collection(db, "sections");
const colExams = collection(db, "exams");
const colUsers = collection(db, "users");
const docSettingsSocial = doc(db, "settings", "socialLinks");
const colQuestions = collection(db, "questions");

// --- Utilidades de UI ---
function show(element) {
  element.classList.remove("hidden");
}
function hide(element) {
  element.classList.add("hidden");
}

function setLoading(btn, isLoading, text = "Guardar") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || text;
    btn.disabled = false;
  }
}

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

// Mensaje simple en contenedores vacíos
function renderEmptyMessage(container, text) {
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

// --- Auth ---
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

    // Validar rol y estado en colección "users"
    const q = query(colUsers, where("email", "==", user.email));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error(
        "Tu usuario no está registrado en la colección de usuarios."
      );
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    // Verificar rol administrador
    if (userData.role !== "admin") {
      throw new Error("Tu usuario no tiene rol de administrador.");
    }

    // Verificar fecha límite y estado
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (userData.expiryDate && userData.expiryDate < todayStr) {
      // Forzar a inactivo si ya expiró
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

    // Si pasa todas las validaciones, el estado onAuthStateChanged hará el resto.
  } catch (err) {
    console.error(err);
    loginError.textContent = err.message || "No se pudo iniciar sesión.";
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
    // Autenticado
    currentUserEmailSpan.textContent = user.email;
    hide(loginView);
    show(adminView);
    show(btnLogout);

    // Vista por defecto: secciones / exámenes
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
    // No autenticado
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

// Cerrar sidebar al seleccionar sección en móvil (se manejará en el evento de sección)

// --- Secciones ---
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
    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    if (docSnap.id === currentSectionId) {
      li.classList.add("sidebar__section-item--active");
    }
    li.dataset.id = docSnap.id;

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

    // Click en toda la fila -> seleccionar sección
    left.addEventListener("click", () => {
      currentSectionId = docSnap.id;
      currentExamId = null;
      // Marcar activa
      document
        .querySelectorAll(".sidebar__section-item")
        .forEach((el) => el.classList.remove("sidebar__section-item--active"));
      li.classList.add("sidebar__section-item--active");

      // Vista exámenes
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
      loadExamsForSection(docSnap.id);
    });

    btnEdit.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(docSnap.id, data);
    });

    btnDelete.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmDelete = window.confirm(
        "¿Eliminar esta sección y todos sus exámenes?"
      );
      if (!confirmDelete) return;

      await deleteSectionWithExams(docSnap.id);
      if (currentSectionId === docSnap.id) {
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
  // Borrar exámenes asociados
  const qExams = query(colExams, where("sectionId", "==", sectionId));
  const examsSnap = await getDocs(qExams);
  for (const examDoc of examsSnap.docs) {
    // Borrar preguntas asociadas
    const qQuestions = query(
      colQuestions,
      where("examId", "==", examDoc.id)
    );
    const questionsSnap = await getDocs(qQuestions);
    for (const qDoc of questionsSnap.docs) {
      await deleteDoc(qDoc.ref);
    }

    await deleteDoc(examDoc.ref);
  }

  // Borrar sección
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
        await addDoc(colSections, {
          name,
          createdAt: serverTimestamp(),
        });
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

// --- Exámenes ---
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
      currentExamId = docSnap.id;
      examDetailTitle.textContent = data.name || "Examen";
      showExamDetailView();
      loadQuestionsForExam(currentExamId);
    });

    btnEdit.addEventListener("click", () => {
      openEditExamModal(docSnap.id, data);
    });

    btnDelete.addEventListener("click", async () => {
      const confirmDelete = window.confirm(
        "¿Eliminar este examen y todas sus preguntas?"
      );
      if (!confirmDelete) return;

      // Borrar preguntas
      const qQuestions = query(
        colQuestions,
        where("examId", "==", docSnap.id)
      );
      const questionsSnap = await getDocs(qQuestions);
      for (const qDoc of questionsSnap.docs) {
        await deleteDoc(qDoc.ref);
      }

      await deleteDoc(doc(db, "exams", docSnap.id));
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
        await addDoc(colExams, {
          name,
          sectionId: currentSectionId,
          attemptsCount: 0,
          createdAt: serverTimestamp(),
        });
        await loadExamsForSection(currentSectionId);
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
        if (currentExamId === id) {
          examDetailTitle.textContent = name;
        }
        if (currentSectionId) {
          await loadExamsForSection(currentSectionId);
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

// --- Vista detalle de examen / preguntas ---
function showExamDetailView() {
  hide(sectionsView);
  hide(usersView);
  show(examDetailView);
}

btnBackToExams.addEventListener("click", () => {
  show(sectionsView);
  hide(usersView);
  hide(examDetailView);
});

async function loadQuestionsForExam(examId) {
  const q = query(colQuestions, where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    renderEmptyMessage(
      questionsList,
      "No hay preguntas en este examen. Crea la primera con el botón “Nueva pregunta”."
    );
    return;
  }

  questionsList.innerHTML = "";

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const card = document.createElement("div");
    card.className = "card-item";

    const titleRow = document.createElement("div");
    titleRow.className = "card-item__title-row";

    const title = document.createElement("div");
    title.className = "card-item__title";
    const textPreview =
      (data.caseText || "").length > 90
        ? data.caseText.slice(0, 90) + "..."
        : data.caseText || "Caso clínico sin texto";
    title.textContent = textPreview;

    const actions = document.createElement("div");
    actions.className = "card-item__actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "icon-btn";
    btnEdit.textContent = "✏";
    btnEdit.title = "Editar pregunta";

    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-btn";
    btnDelete.textContent = "🗑";
    btnDelete.title = "Eliminar pregunta";

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    titleRow.appendChild(title);
    titleRow.appendChild(actions);

    const badgeRow = document.createElement("div");
    badgeRow.className = "card-item__badge-row";
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.innerHTML = `<span class="badge-dot"></span> Respuesta correcta: ${
      data.correctOption || "—"
    }`;

    badgeRow.appendChild(badge);

    card.appendChild(titleRow);
    card.appendChild(badgeRow);

    btnEdit.addEventListener("click", () => {
      openQuestionModal(docSnap.id, data);
    });

    btnDelete.addEventListener("click", async () => {
      const confirmDelete = window.confirm("¿Eliminar esta pregunta?");
      if (!confirmDelete) return;
      await deleteDoc(doc(db, "questions", docSnap.id));
      loadQuestionsForExam(examId);
    });

    questionsList.appendChild(card);
  });
}

function openQuestionModal(id = null, data = {}) {
  const isEdit = Boolean(id);

  openModal({
    title: isEdit ? "Editar pregunta" : "Nueva pregunta",
    fieldsHtml: `
      <label class="field">
        <span>Caso clínico</span>
        <textarea id="field-case-text" required>${
          data.caseText || ""
        }</textarea>
      </label>

      <label class="field">
        <span>Inciso A</span>
        <input type="text" id="field-option-a" required value="${
          data.optionA || ""
        }" />
      </label>

      <label class="field">
        <span>Inciso B</span>
        <input type="text" id="field-option-b" required value="${
          data.optionB || ""
        }" />
      </label>

      <label class="field">
        <span>Inciso C</span>
        <input type="text" id="field-option-c" required value="${
          data.optionC || ""
        }" />
      </label>

      <label class="field">
        <span>Inciso D</span>
        <input type="text" id="field-option-d" required value="${
          data.optionD || ""
        }" />
      </label>

      <label class="field">
        <span>Respuesta correcta</span>
        <select id="field-correct-option" required>
          <option value="">Selecciona una opción</option>
          <option value="A" ${
            data.correctOption === "A" ? "selected" : ""
          }>A</option>
          <option value="B" ${
            data.correctOption === "B" ? "selected" : ""
          }>B</option>
          <option value="C" ${
            data.correctOption === "C" ? "selected" : ""
          }>C</option>
          <option value="D" ${
            data.correctOption === "D" ? "selected" : ""
          }>D</option>
        </select>
      </label>

      <label class="field">
        <span>Justificación</span>
        <textarea id="field-justification" required>${
          data.justification || ""
        }</textarea>
      </label>
    `,
    onSubmit: async () => {
      const caseText = document
        .getElementById("field-case-text")
        .value.trim();
      const optionA = document.getElementById("field-option-a").value.trim();
      const optionB = document.getElementById("field-option-b").value.trim();
      const optionC = document.getElementById("field-option-c").value.trim();
      const optionD = document.getElementById("field-option-d").value.trim();
      const correctOption = document.getElementById(
        "field-correct-option"
      ).value;
      const justification = document
        .getElementById("field-justification")
        .value.trim();

      if (
        !caseText ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD ||
        !correctOption ||
        !justification
      ) {
        return;
      }

      const submitBtn = document.getElementById("modal-submit");
      setLoading(submitBtn, true);

      try {
        if (!currentExamId) {
          throw new Error("No hay examen seleccionado.");
        }

        const payload = {
          examId: currentExamId,
          caseText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          justification,
          updatedAt: serverTimestamp(),
        };

        if (isEdit) {
          await updateDoc(doc(db, "questions", id), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(colQuestions, payload);
        }

        await loadQuestionsForExam(currentExamId);
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo guardar la pregunta.");
      } finally {
        setLoading(submitBtn, false);
      }
    },
  });
}

btnNewQuestion.addEventListener("click", () => openQuestionModal());

// --- Usuarios ---
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const updates = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    let status = data.status || "inactivo";
    const expiry = data.expiryDate || "";

    // Si tiene fecha y ya pasó, forzamos a inactivo
    if (expiry && expiry < todayStr && status === "activo") {
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

  // Ejecutar actualizaciones de estado inactivo
  if (updates.length) {
    Promise.all(updates).catch((e) => console.error(e));
  }

  // Listeners
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

  let existingDataPromise = Promise.resolve(null);
  if (isEdit) {
    existingDataPromise = getDoc(doc(db, "users", id)).then((d) =>
      d.exists() ? d.data() : null
    );
  }

  existingDataPromise.then((data = {}) => {
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

// Cambiar vista a usuarios
btnUsersView.addEventListener("click", () => {
  hide(sectionsView);
  hide(examDetailView);
  show(usersView);
  btnUsersView.classList.remove("btn-outline");
  btnUsersView.classList.add("btn-secondary");
  loadUsers();
});

// --- Redes sociales ---
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
            }).catch(async (err) => {
              // Si no existe el doc, lo creamos
              if (err.code === "not-found") {
                await addDoc(collection(db, "settings"), {
                  instagram,
                  whatsapp,
                  tiktok,
                  telegram,
                  createdAt: serverTimestamp(),
                });
              } else {
                throw err;
              }
            });

            await loadSocialLinks();
            closeModal();
          } catch (err) {
            console.error(err);
            alert("No se pudieron guardar los enlaces.");
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

// --- Modal: eventos globales ---
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
