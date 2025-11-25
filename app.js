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
// Vistas
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
// NUEVO: botón para “Pantalla principal”
const btnLandingView = document.getElementById("btn-landing-view");
const btnEditSocial = document.getElementById("btn-edit-social");
const socialButtons = document.querySelectorAll(".social-icon");

// Panel principal
const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const examDetailView = document.getElementById("exam-detail-view");

// NUEVO: vista de configuración de pantalla principal
const landingView = document.getElementById("landing-settings-view");
// Campos de configuración de landing (si aún no existen en HTML, no pasa nada)
const landingHeroTitleInput = document.getElementById("landing-hero-title");
const landingHeroSubtitleInput = document.getElementById("landing-hero-subtitle");
const landingCtaTextInput = document.getElementById("landing-cta-text");
const landingCtaUrlInput = document.getElementById("landing-cta-url");
const landingSaveBtn = document.getElementById("btn-save-landing");

const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");

const btnNewExam = document.getElementById("btn-new-exam");
const examsList = document.getElementById("exams-list");

const usersList = document.getElementById("users-list");
const btnCreateUser = document.getElementById("btn-create-user");

// Detalle examen
const btnBackToExams = document.getElementById("btn-back-to-exams");
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question"); // ahora solo de respaldo
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
 * LOGIN (ADMIN / ESTUDIANTE)
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

    // Validar vigencia y estado (aplica para admin y usuario)
    const today = new Date().toISOString().slice(0, 10);
    if (data.expiryDate && data.expiryDate < today) {
      await updateDoc(userDocRef, { status: "inactivo" });
      throw new Error("Tu acceso ha vencido. Contacta al administrador para renovarlo.");
    }

    if (data.status !== "activo") {
      throw new Error("Tu usuario está inactivo. Contacta al administrador para activarlo.");
    }

    // Redirección según rol
    if (data.role === "usuario") {
      // Rol estudiante → panel estudiante
      window.location.href = "student.html";
      return;
    }

    if (data.role !== "admin") {
      throw new Error("Tu usuario no tiene un rol válido para esta plataforma.");
    }

    // Si es admin, el onAuthStateChanged se encargará de mostrar panel admin

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

/***********************************************
 * CAMBIO DE ESTADO DE AUTENTICACIÓN
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDocRef = doc(db, "users", user.email);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        show(loginView);
        hide(adminView);
        currentUserEmailSpan.textContent = "";
        return;
      }

      const data = userSnap.data();
      const today = new Date().toISOString().slice(0, 10);

      // Vigencia y estado
      if (data.expiryDate && data.expiryDate < today) {
        await updateDoc(userDocRef, { status: "inactivo" });
        await signOut(auth);
        show(loginView);
        hide(adminView);
        currentUserEmailSpan.textContent = "";
        return;
      }

      if (data.status !== "activo") {
        await signOut(auth);
        show(loginView);
        hide(adminView);
        currentUserEmailSpan.textContent = "";
        return;
      }

      // Redirección si es usuario (estudiante)
      if (data.role === "usuario") {
        window.location.href = "student.html";
        return;
      }

      if (data.role !== "admin") {
        await signOut(auth);
        show(loginView);
        hide(adminView);
        currentUserEmailSpan.textContent = "";
        return;
      }

      // Rol admin → mostrar panel admin
      currentUserEmailSpan.textContent = user.email || "";
      hide(loginView);
      show(adminView);
      show(btnLogout);

      // Vista por defecto: secciones (landing y usuarios ocultos al inicio)
      show(sectionsView);
      hide(usersView);
      hide(examDetailView);
      if (landingView) hide(landingView);
      if (btnUsersView) {
        btnUsersView.classList.remove("btn-secondary");
        btnUsersView.classList.add("btn-outline");
      }
      if (btnLandingView) {
        btnLandingView.classList.remove("btn-secondary");
        btnLandingView.classList.add("btn-outline");
      }

      currentSectionId = null;
      currentExamId = null;
      currentSectionName = "";
      currentSectionTitle.textContent = "Selecciona una sección";
      currentSectionSubtitle.textContent =
        "Elige una sección en la barra lateral para ver sus exámenes.";
      hide(btnNewExam);
      renderEmptyMessage(examsList, "Aún no has seleccionado ninguna sección.");

      await Promise.all([
        loadSections(),
        loadSocialLinks(),
        loadLandingSettings(), // NUEVO: cargar configuración de pantalla principal
      ]);

    } catch (err) {
      console.error(err);
      await signOut(auth);
      show(loginView);
      hide(adminView);
      currentUserEmailSpan.textContent = "";
    }
  } else {
    show(loginView);
    hide(adminView);
    hide(btnLogout);
    currentUserEmailSpan.textContent = "";
    loginForm.reset();
  }
});

/***********************************************
 * SECCIONES (ADMIN)
 ***********************************************/
async function loadSections() {
  const snap = await getDocs(collection(db, "sections"));
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

    li.innerHTML = `
      <div class="sidebar__section-name">${data.name || "Sección sin título"}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-section" title="Editar sección">✏</button>
        <button class="icon-btn delete-section" title="Eliminar sección">🗑</button>
      </div>
    `;

    // Click en todo el recuadro → seleccionar sección
    li.addEventListener("click", () => {
      handleSelectSection(id, data.name, li);
    });

    // Editar sección
    li.querySelector(".edit-section").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(id, data.name || "");
    });

    // Eliminar sección
    li.querySelector(".delete-section").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = window.confirm(
        "¿Eliminar esta sección y TODOS sus exámenes y casos clínicos asociados?"
      );
      if (!ok) return;
      await deleteSectionWithAllData(id);
      if (currentSectionId === id) {
        currentSectionId = null;
        currentExamId = null;
        currentSectionName = "";
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

function handleSelectSection(id, name, li) {
  currentSectionId = id;
  currentSectionName = name || "Sección";
  currentExamId = null;

  document
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));
  li.classList.add("sidebar__section-item--active");

  // Mostrar vista de secciones y ocultar las demás
  show(sectionsView);
  hide(usersView);
  hide(examDetailView);
  if (landingView) hide(landingView);

  if (btnUsersView) {
    btnUsersView.classList.remove("btn-secondary");
    btnUsersView.classList.add("btn-outline");
  }
  if (btnLandingView) {
    btnLandingView.classList.remove("btn-secondary");
    btnLandingView.classList.add("btn-outline");
  }

  sidebar.classList.remove("sidebar--open");

  currentSectionTitle.textContent = currentSectionName;
  currentSectionSubtitle.textContent =
    "Gestiona los exámenes de esta sección.";
  show(btnNewExam);
  loadExamsForSection(id);
}

async function deleteSectionWithAllData(sectionId) {
  const qExams = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const examsSnap = await getDocs(qExams);
  for (const exDoc of examsSnap.docs) {
    const exId = exDoc.id;
    const qCases = query(collection(db, "questions"), where("examId", "==", exId));
    const caseSnap = await getDocs(qCases);
    for (const cDoc of caseSnap.docs) {
      await deleteDoc(cDoc.ref);
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

      const submitBtn = modalSubmit;
      setLoading(submitBtn, true);

      try {
        const docRef = await addDoc(collection(db, "sections"), {
          name,
          createdAt: serverTimestamp(),
        });
        currentSectionId = docRef.id;
        currentSectionName = name;
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

function openEditSectionModal(id, currentName) {
  openModal({
    title: "Editar sección",
    fieldsHtml: `
      <label class="field">
        <span>Nombre de la sección</span>
        <input type="text" id="field-section-name" required value="${currentName}" />
      </label>
    `,
    onSubmit: async () => {
      const input = document.getElementById("field-section-name");
      const name = input.value.trim();
      if (!name) return;

      const submitBtn = modalSubmit;
      setLoading(submitBtn, true);

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
        setLoading(submitBtn, false);
      }
    },
  });
}

btnNewSection.addEventListener("click", openNewSectionModal);

/***********************************************
 * EXÁMENES (ADMIN)
 ***********************************************/
// (Sigue en la Parte 2/5)
/***********************************************
 * EXÁMENES (ADMIN)
 ***********************************************/
async function loadExamsForSection(sectionId) {
  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
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

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${data.name || "Examen sin título"}</div>
        <div class="card-item__actions">
          <button class="btn btn-secondary btn-sm open-exam">Abrir</button>
          <button class="icon-btn edit-exam" title="Editar nombre">✏</button>
          <button class="icon-btn delete-exam" title="Eliminar examen">🗑</button>
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
      openExamDetail(id, data.name || "Examen");
    });

    card.querySelector(".edit-exam").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditExamModal(id, data.name || "");
    });

    card.querySelector(".delete-exam").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = window.confirm(
        "¿Eliminar este examen y todos sus casos clínicos y preguntas?"
      );
      if (!ok) return;

      const qCases = query(collection(db, "questions"), where("examId", "==", id));
      const caseSnap = await getDocs(qCases);
      for (const cDoc of caseSnap.docs) {
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
      const input = document.getElementById("field-exam-name");
      const name = input.value.trim();
      if (!name) return;

      const btn = modalSubmit;
      setLoading(btn, true);

      try {
        const docRef = await addDoc(collection(db, "exams"), {
          name,
          sectionId: currentSectionId,
          attemptsCount: 0,
          createdAt: serverTimestamp(),
        });
        await loadExamsForSection(currentSectionId);
        openExamDetail(docRef.id, name);
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

function openEditExamModal(id, currentName) {
  openModal({
    title: "Editar examen",
    fieldsHtml: `
      <label class="field">
        <span>Nombre del examen</span>
        <input type="text" id="field-exam-name" required value="${currentName}" />
      </label>
    `,
    onSubmit: async () => {
      const input = document.getElementById("field-exam-name");
      const name = input.value.trim();
      if (!name) return;

      const btn = modalSubmit;
      setLoading(btn, true);

      try {
        await updateDoc(doc(db, "exams", id), {
          name,
          updatedAt: serverTimestamp(),
        });
        if (currentSectionId) {
          await loadExamsForSection(currentSectionId);
        }
        if (currentExamId === id && examNameInput) {
          examNameInput.value = name;
        }
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar el examen.");
      } finally {
        setLoading(btn, false);
      }
    },
  });
}

btnNewExam.addEventListener("click", openNewExamModal);

/***********************************************
 * DETALLE DE EXAMEN (ADMIN)
 ***********************************************/
function openExamDetail(examId, examName) {
  currentExamId = examId;

  show(examDetailView);
  hide(sectionsView);
  hide(usersView);
  if (landingView) hide(landingView);

  if (examNameInput) {
    examNameInput.value = examName || "";
  }

  loadCasesForExam(examId);
}

btnBackToExams.addEventListener("click", () => {
  show(sectionsView);
  hide(usersView);
  hide(examDetailView);
  if (landingView) hide(landingView);
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
/***********************************************
 * CASOS CLÍNICOS CON VARIAS PREGUNTAS (ADMIN)
 ***********************************************/
async function loadCasesForExam(examId) {
  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  questionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(
      questionsList,
      "No hay casos clínicos ni preguntas en este examen. Crea el primer caso clínico."
    );
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    renderCaseBlock(docSnap.id, data);
  });
}

/**
 * Renderiza un bloque de caso clínico:
 * - Especialidad
 * - Texto caso clínico
 * - Preguntas internas
 * - Botones admin
 */
function renderCaseBlock(caseId, data) {
  const specialityValue = data.specialty || "";

  const caseCard = document.createElement("div");
  caseCard.className = "card";
  caseCard.dataset.caseId = caseId;

  caseCard.innerHTML = `
    <label class="field">
      <span>Especialidad del caso clínico</span>
      <select class="case-specialty">
        <option value="">Selecciona una especialidad</option>
        <option value="medicina_interna" ${specialityValue === "medicina_interna" ? "selected" : ""}>Medicina interna</option>
        <option value="pediatria" ${specialityValue === "pediatria" ? "selected" : ""}>Pediatría</option>
        <option value="ginecologia_obstetricia" ${specialityValue === "ginecologia_obstetricia" ? "selected" : ""}>Ginecología y obstetricia</option>
        <option value="cirugia_general" ${specialityValue === "cirugia_general" ? "selected" : ""}>Cirugía general</option>
      </select>
    </label>

    <label class="field">
      <span>Caso clínico</span>
      <textarea class="case-text" rows="4">${data.caseText || ""}</textarea>
    </label>

    <div class="cards-list case-questions"></div>

    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <button type="button" class="btn btn-sm btn-primary btn-add-question">
        + Agregar pregunta
      </button>
      <button type="button" class="btn btn-sm btn-secondary btn-save-case">
        Guardar caso clínico
      </button>
      <button type="button" class="btn btn-sm btn-outline btn-delete-case">
        Eliminar caso clínico
      </button>
      <button type="button" class="btn btn-sm btn-primary btn-new-case">
        + Nueva pregunta (nuevo caso clínico)
      </button>
    </div>
  `;

  const questionsContainer = caseCard.querySelector(".case-questions");
  const questionsArray = Array.isArray(data.questions) ? data.questions : [];

  // Render preguntas existentes
  if (questionsArray.length === 0) {
    questionsContainer.appendChild(renderQuestionBlock());
  } else {
    questionsArray.forEach((qData) => {
      questionsContainer.appendChild(renderQuestionBlock(qData));
    });
  }

  // Agregar pregunta
  caseCard
    .querySelector(".btn-add-question")
    .addEventListener("click", () => {
      questionsContainer.appendChild(renderQuestionBlock());
    });

  // Guardar caso
  caseCard
    .querySelector(".btn-save-case")
    .addEventListener("click", async () => {
      await saveCaseBlock(caseId, caseCard);
    });

  // Eliminar caso completo
  caseCard
    .querySelector(".btn-delete-case")
    .addEventListener("click", async () => {
      const ok = window.confirm("¿Eliminar este caso clínico y TODAS sus preguntas?");
      if (!ok) return;
      await deleteDoc(doc(db, "questions", caseId));
      await loadCasesForExam(currentExamId);
    });

  // Nuevo caso clínico vacío
  caseCard
    .querySelector(".btn-new-case")
    .addEventListener("click", async () => {
      if (!currentExamId) {
        alert("Primero selecciona o crea un examen.");
        return;
      }
      try {
        await addDoc(collection(db, "questions"), {
          examId: currentExamId,
          caseText: "",
          specialty: "",
          questions: [],
          createdAt: serverTimestamp(),
        });
        await loadCasesForExam(currentExamId);
      } catch (err) {
        console.error(err);
        alert("No se pudo crear el nuevo caso clínico.");
      }
    });

  questionsList.appendChild(caseCard);
}

/***********************************************
 * BLOQUE INDIVIDUAL DE PREGUNTA (A–D + dificultad + subtipo)
 ***********************************************/
function renderQuestionBlock(qData = {}) {
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

    <label class="field"><span>Inciso A</span>
      <input type="text" class="q-a" value="${optionA}" />
    </label>

    <label class="field"><span>Inciso B</span>
      <input type="text" class="q-b" value="${optionB}" />
    </label>

    <label class="field"><span>Inciso C</span>
      <input type="text" class="q-c" value="${optionC}" />
    </label>

    <label class="field"><span>Inciso D</span>
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
      <button type="button" class="btn btn-sm btn-outline btn-delete-question">
        Eliminar pregunta
      </button>
    </div>
  `;

  card.querySelector(".btn-delete-question").addEventListener("click", () => {
    card.remove();
  });

  return card;
}

/***********************************************
 * GUARDAR CASO CLÍNICO COMPLETO
 ***********************************************/
async function saveCaseBlock(caseId, caseCard) {
  if (!currentExamId) return;

  const specialty = caseCard.querySelector(".case-specialty")?.value || "";
  const caseText = caseCard.querySelector(".case-text").value.trim();
  const questionCards = caseCard.querySelectorAll(".case-questions .card-item");

  if (!caseText) {
    alert("Escribe el texto del caso clínico.");
    return;
  }

  if (questionCards.length === 0) {
    alert("Debes agregar al menos una pregunta.");
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
    const difficulty = card.querySelector(".q-difficulty").value;
    const subtype = card.querySelector(".q-subtype").value;

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption || !justification) {
      alert("Completa todos los campos de cada pregunta.");
      return;
    }

    const difficultyWeight =
      difficulty === "alta" ? 3 :
      difficulty === "media" ? 2 : 1;

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

  try {
    await updateDoc(doc(db, "questions", caseId), {
      examId: currentExamId,
      caseText,
      specialty,
      questions,
      updatedAt: serverTimestamp(),
    });
    alert("Caso clínico guardado correctamente.");
    await loadCasesForExam(currentExamId);
  } catch (err) {
    console.error(err);
    alert("No se pudo guardar el caso clínico.");
  }
}
/***********************************************
 * USUARIOS (ADMIN) - LISTADO + CRUD
 ***********************************************/
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersList.innerHTML = "";
    renderEmptyMessage(
      usersList,
      "No hay usuarios registrados. Crea el primero con el formulario superior."
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

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const status = data.status || "inactivo";
    const role = data.role || "usuario";
    const expiry = data.expiryDate || "";
    const id = docSnap.id;

    const chipStatusClass =
      status === "activo" ? "chip--activo" : "chip--inactivo";
    const chipRoleClass = role === "admin" ? "chip--admin" : "chip--user";

    html += `
      <tr data-id="${id}">
        <td>${data.name || ""}</td>
        <td>${data.email || ""}</td>
        <td><span class="chip ${chipStatusClass}">${status}</span></td>
        <td><span class="chip ${chipRoleClass}">${role}</span></td>
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

  // Acciones por fila
  usersList.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = row.dataset.id;
    const btnEdit = row.querySelector('button[data-action="edit"]');
    const btnDelete = row.querySelector('button[data-action="delete"]');

    btnEdit.addEventListener("click", () => openUserModal(id));

    btnDelete.addEventListener("click", async () => {
      const ok = window.confirm("¿Eliminar este usuario?");
      if (!ok) return;
      await deleteDoc(doc(db, "users", id));
      loadUsers();
    });
  });
}

/***********************************************
 * MODAL USUARIO (EDITAR / CREAR)
 ***********************************************/
function openUserModal(id = null) {
  const isEdit = Boolean(id);

  let dataPromise = Promise.resolve({});
  if (isEdit) {
    dataPromise = getDoc(doc(db, "users", id)).then((s) =>
      s.exists() ? s.data() : {}
    );
  }

  dataPromise.then((data) => {
    const docId = isEdit ? id : (data.email || "");

    openModal({
      title: isEdit ? "Editar usuario" : "Nuevo usuario",
      fieldsHtml: `
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="field-user-name" required value="${data.name || ""}" />
        </label>

        <label class="field">
          <span>Correo (ID del documento)</span>
          <input type="email" id="field-user-email" ${isEdit ? "readonly" : ""} value="${data.email || ""}" />
        </label>

        <label class="field">
          <span>ID Firestore</span>
          <input type="text" id="field-user-docid" readonly value="${docId}" />
        </label>

        <label class="field">
          <span>Contraseña</span>
          <input type="text" id="field-user-password" required value="${data.password || ""}" />
        </label>

        <label class="field">
          <span>Estado</span>
          <select id="field-user-status">
            <option value="activo" ${data.status === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${data.status === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </label>

        <label class="field">
          <span>Rol</span>
          <select id="field-user-role">
            <option value="admin" ${data.role === "admin" ? "selected" : ""}>Administrador</option>
            <option value="usuario" ${data.role === "usuario" ? "selected" : ""}>Usuario</option>
          </select>
        </label>

        <label class="field">
          <span>Fecha límite</span>
          <input type="date" id="field-user-expiry" value="${data.expiryDate || ""}" />
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

        const submitBtn = modalSubmit;
        setLoading(submitBtn, true);

        try {
          if (isEdit) {
            await updateDoc(doc(db, "users", docIdFinal), payload);
          } else {
            payload.createdAt = serverTimestamp();
            await setDoc(doc(db, "users", docIdFinal), payload);
            alert("Usuario creado. También créalo en Firebase Authentication.");
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

    // Actualizar ID dinámicamente (solo nuevo usuario)
    if (!isEdit) {
      const emailEl = document.getElementById("field-user-email");
      const docIdEl = document.getElementById("field-user-docid");
      emailEl.addEventListener("input", () => {
        docIdEl.value = emailEl.value.trim();
      });
    }
  });
}

/***********************************************
 * CREAR USUARIO (FORM FIJO)
 ***********************************************/
btnCreateUser.addEventListener("click", async () => {
  const name = document.getElementById("new-user-name").value.trim();
  const email = document.getElementById("new-user-email").value.trim();
  const password = document.getElementById("new-user-password").value.trim();
  const status = document.getElementById("new-user-status").value;
  const role = document.getElementById("new-user-role").value;
  const expiryDate =
    document.getElementById("new-user-expiry").value || "";

  if (!name || !email || !password) {
    alert("Nombre, correo y contraseña obligatorios.");
    return;
  }

  try {
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

    alert("Usuario creado. Recuerda crearlo también en Authentication.");

    // Reset
    document.getElementById("new-user-name").value = "";
    document.getElementById("new-user-email").value = "";
    document.getElementById("new-user-password").value = "";
    document.getElementById("new-user-status").value = "activo";
    document.getElementById("new-user-role").value = "usuario";
    document.getElementById("new-user-expiry").value = "";

    await loadUsers();
  } catch (err) {
    console.error(err);
    alert("No se pudo crear el usuario.");
  }
});

// Abrir vista usuarios
btnUsersView.addEventListener("click", () => {
  hide(sectionsView);
  hide(examDetailView);
  show(usersView);

  btnUsersView.classList.remove("btn-outline");
  btnUsersView.classList.add("btn-secondary");

  loadUsers();
});
/***********************************************
 * REDES SOCIALES (ADMIN) - settings/socialLinks
 ***********************************************/
async function loadSocialLinks() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
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
    console.error("Error cargando socialLinks:", err);
  }
}

btnEditSocial.addEventListener("click", async () => {
  let data = {};
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error(err);
  }

  openModal({
    title: "Enlaces de redes sociales",
    fieldsHtml: `
      <label class="field">
        <span>Instagram (URL)</span>
        <input type="url" id="field-instagram" value="${data.instagram || ""}" />
      </label>
      <label class="field">
        <span>WhatsApp (URL)</span>
        <input type="url" id="field-whatsapp" value="${data.whatsapp || ""}" />
      </label>
      <label class="field">
        <span>TikTok (URL)</span>
        <input type="url" id="field-tiktok" value="${data.tiktok || ""}" />
      </label>
      <label class="field">
        <span>Telegram (URL)</span>
        <input type="url" id="field-telegram" value="${data.telegram || ""}" />
      </label>
    `,
    onSubmit: async () => {
      const instagram = document.getElementById("field-instagram").value.trim();
      const whatsapp = document.getElementById("field-whatsapp").value.trim();
      const tiktok = document.getElementById("field-tiktok").value.trim();
      const telegram = document.getElementById("field-telegram").value.trim();

      const submitBtn = modalSubmit;
      setLoading(submitBtn, true);

      try {
        await updateDoc(doc(db, "settings", "socialLinks"), {
          instagram,
          whatsapp,
          tiktok,
          telegram,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          await setDoc(doc(db, "settings", "socialLinks"), {
            instagram,
            whatsapp,
            tiktok,
            telegram,
            createdAt: serverTimestamp(),
          });
        } catch (err2) {
          console.error(err2);
          alert("No se pudieron guardar los enlaces.");
        }
      } finally {
        await loadSocialLinks();
        setLoading(submitBtn, false);
        closeModal();
      }
    },
  });
});

// Abrir redes sociales desde botón en sidebar
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

/***********************************************
 * FIN DEL ARCHIVO APP.JS
 ***********************************************/
console.log("Admin panel cargado correctamente.");
