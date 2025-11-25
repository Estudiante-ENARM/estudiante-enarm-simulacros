/******************************************************
 * FIREBASE (MODULAR v11)
 ******************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/******************************************************
 * CONFIGURACIÓN FIREBASE
 ******************************************************/
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

/******************************************************
 * REFERENCIAS DOM – LOGIN
 ******************************************************/
const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");

const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");

const landingCard = document.getElementById("landing-card");
const landingText = document.getElementById("landing-text");
const btnFreeAccess = document.getElementById("btn-free-access");
const btnPriceMonth = document.getElementById("btn-price-month");
const btnPriceFull = document.getElementById("btn-price-full");

/******************************************************
 * REFERENCIAS DOM – ADMIN PANEL
 ******************************************************/
const sidebar = document.getElementById("sidebar");
const sidebarSections = document.getElementById("sidebar-sections");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

const btnNewSection = document.getElementById("btn-new-section");
const btnUsersView = document.getElementById("btn-users-view");
const btnLandingView = document.getElementById("btn-landing-view");

const currentUserEmailSpan = document.getElementById("current-user-email");
const btnLogout = document.getElementById("btn-logout");

const sectionsView = document.getElementById("sections-view");
const usersView = document.getElementById("users-view");
const landingSettingsView = document.getElementById("landing-settings-view");

const currentSectionTitle = document.getElementById("current-section-title");
const currentSectionSubtitle = document.getElementById("current-section-subtitle");

const examsList = document.getElementById("exams-list");
const btnNewExam = document.getElementById("btn-new-exam");

const examDetailView = document.getElementById("exam-detail-view");
const examMetaCard = document.getElementById("exam-meta-card");
const examNameInput = document.getElementById("exam-name-input");
const btnSaveExamMeta = document.getElementById("btn-save-exam-meta");
const btnNewQuestion = document.getElementById("btn-new-question");
const questionsList = document.getElementById("questions-list");

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalFields = document.getElementById("modal-fields");
const modalForm = document.getElementById("modal-form");
const modalCancel = document.getElementById("modal-cancel");
const modalSubmit = document.getElementById("modal-submit");

/******************************************************
 * LANDING SETTINGS (admin)
 ******************************************************/
const landingHeroTitle = document.getElementById("landing-hero-title");
const landingHeroSubtitle = document.getElementById("landing-hero-subtitle");
const landingCtaText = document.getElementById("landing-cta-text");
const landingCtaUrl = document.getElementById("landing-cta-url");
const btnSaveLanding = document.getElementById("btn-save-landing");

/******************************************************
 * VARIABLES GLOBALES
 ******************************************************/
let currentUser = null;
let currentRole = null;
let currentSectionId = null;
let currentExamId = null;

/******************************************************
 * UTILIDADES
 ******************************************************/
function show(el) {
  if (el) el.classList.remove("hidden");
}
function hide(el) {
  if (el) el.classList.add("hidden");
}
function resetPanel() {
  hide(sectionsView);
  hide(usersView);
  hide(landingSettingsView);
  hide(examDetailView);
}

/******************************************************
 * LOGIN
 ******************************************************/
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value.trim();

  try {
    btnLogin.disabled = true;

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const userDoc = await getDoc(doc(db, "users", user.email));

    if (!userDoc.exists()) {
      loginError.textContent = "Tu usuario no está registrado.";
      loginError.classList.remove("hidden");
      await signOut(auth);
      btnLogin.disabled = false;
      return;
    }

    const data = userDoc.data();
    currentRole = data.role;

    if (data.status !== "activo") {
      loginError.textContent = "Tu usuario está inactivo.";
      loginError.classList.remove("hidden");
      await signOut(auth);
      btnLogin.disabled = false;
      return;
    }

    if (currentRole === "admin") {
      hide(loginView);
      show(adminView);
      currentUserEmailSpan.textContent = email;

      await loadSections();
      await loadLandingSettings();
    } else {
      window.location.href = "student.html";
    }

  } catch (err) {
    console.error(err);
    loginError.textContent = "Correo o contraseña incorrectos.";
    loginError.classList.remove("hidden");
  }

  btnLogin.disabled = false;
});

/******************************************************
 * LOGOUT
 ******************************************************/
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
/******************************************************
 * AUTH STATE CHANGE
 ******************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    show(loginView);
    hide(adminView);
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "users", user.email));

    if (!userSnap.exists()) {
      await signOut(auth);
      show(loginView);
      hide(adminView);
      return;
    }

    const data = userSnap.data();
    currentUser = user;
    currentRole = data.role;

    // Si está vencido
    const today = new Date().toISOString().slice(0, 10);
    if (data.expiryDate && data.expiryDate < today) {
      await updateDoc(doc(db, "users", user.email), { status: "inactivo" });
      await signOut(auth);
      show(loginView);
      return;
    }

    if (data.status !== "activo") {
      await signOut(auth);
      show(loginView);
      return;
    }

    // Si no es admin → lo enviamos al panel del estudiante
    if (currentRole !== "admin") {
      window.location.href = "student.html";
      return;
    }

    // Cargar panel admin
    hide(loginView);
    show(adminView);
    currentUserEmailSpan.textContent = currentUser.email;

    resetPanel();
    show(sectionsView);

    await Promise.all([
      loadSections(),
      loadLandingSettings(),
      loadSocialLinksAdmin(),
    ]);

  } catch (err) {
    console.error(err);
    await signOut(auth);
  }
});

/******************************************************
 * CARGA DE SECCIONES (ADMIN)
 ******************************************************/
async function loadSections() {
  sidebarSections.innerHTML = "";

  const snap = await getDocs(collection(db, "sections"));

  if (snap.empty) {
    sidebarSections.innerHTML = `
      <li style="padding:4px 8px;color:#9aa1ad;font-size:13px;">
        No hay secciones registradas.
      </li>
    `;
    examsList.innerHTML = "";
    currentSectionTitle.textContent = "Sin secciones";
    currentSectionSubtitle.textContent = "Crea la primera sección.";
    hide(btnNewExam);
    return;
  }

  snap.forEach((docSnap) => {
    const id = docSnap.id;
    const data = docSnap.data();

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.innerHTML = `
      <div class="sidebar__section-name">${data.name}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn edit-section">✏</button>
        <button class="icon-btn delete-section">🗑</button>
      </div>
    `;

    // Seleccionar sección
    li.addEventListener("click", () => selectSection(id, data.name, li));

    // Editar sección
    li.querySelector(".edit-section").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(id, data.name);
    });

    // Eliminar sección
    li.querySelector(".delete-section").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("¿Eliminar sección y todos sus exámenes?");
      if (!ok) return;

      await deleteSectionCascade(id);
      await loadSections();
    });

    sidebarSections.appendChild(li);
  });
}

async function deleteSectionCascade(sectionId) {
  const examsQ = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const examsSnap = await getDocs(examsQ);

  for (const ex of examsSnap.docs) {
    const examId = ex.id;

    const casQ = query(collection(db, "questions"), where("examId", "==", examId));
    const casSnap = await getDocs(casQ);

    for (const c of casSnap.docs) {
      await deleteDoc(doc(db, "questions", c.id));
    }

    await deleteDoc(doc(db, "exams", examId));
  }

  await deleteDoc(doc(db, "sections", sectionId));
}

function selectSection(id, name, liElement) {
  currentSectionId = id;

  document.querySelectorAll(".sidebar__section-item").forEach((el) =>
    el.classList.remove("sidebar__section-item--active")
  );
  liElement.classList.add("sidebar__section-item--active");

  resetPanel();
  show(sectionsView);

  currentSectionTitle.textContent = name;
  currentSectionSubtitle.textContent = "Exámenes de esta sección";
  show(btnNewExam);

  loadExams(id);
}

/******************************************************
 * MODAL – CREAR SECCIÓN
 ******************************************************/
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

      await setDoc(doc(collection(db, "sections")), {
        name,
        createdAt: serverTimestamp(),
      });

      closeModal();
      await loadSections();
    },
  });
});

/******************************************************
 * MODAL – EDITAR SECCIÓN
 ******************************************************/
function openEditSectionModal(id, currentName) {
  openModal({
    title: "Editar sección",
    fieldsHtml: `
      <label class="field">
        <span>Nombre</span>
        <input type="text" id="field-section-edit" value="${currentName}" required />
      </label>
    `,
    onSubmit: async () => {
      const value = document.getElementById("field-section-edit").value.trim();
      if (!value) return;

      await updateDoc(doc(db, "sections", id), { name: value });
      closeModal();
      await loadSections();
    },
  });
}

/******************************************************
 * CARGAR EXÁMENES
 ******************************************************/
async function loadExams(sectionId) {
  examsList.innerHTML = "";

  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  if (snap.empty) {
    examsList.innerHTML = `
      <div class="card" style="padding:12px 14px;color:#9aa1ad;font-size:13px;">
        No hay exámenes en esta sección.
      </div>
    `;
    return;
  }

  snap.forEach((docSnap) => {
    const id = docSnap.id;
    const data = docSnap.data();

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
    `;

    // Abrir detalle
    card.querySelector(".open-exam").addEventListener("click", () => {
      openExamDetail(id, data.name);
    });

    // Editar
    card.querySelector(".edit-exam").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditExamModal(id, data.name);
    });

    // Eliminar
    card.querySelector(".delete-exam").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("¿Eliminar examen y todas sus preguntas?");
      if (!ok) return;

      const casQ = query(collection(db, "questions"), where("examId", "==", id));
      const casSnap = await getDocs(casQ);
      for (const c of casSnap.docs) {
        await deleteDoc(doc(db, "questions", c.id));
      }

      await deleteDoc(doc(db, "exams", id));
      loadExams(sectionId);
    });

    examsList.appendChild(card);
  });
}

/******************************************************
 * NUEVO EXAMEN
 ******************************************************/
btnNewExam.addEventListener("click", () => {
  if (!currentSectionId) return;

  openModal({
    title: "Nuevo examen",
    fieldsHtml: `
      <label class="field">
        <span>Nombre del examen</span>
        <input type="text" id="new-exam-name" required />
      </label>
    `,
    onSubmit: async () => {
      const name = document.getElementById("new-exam-name").value.trim();
      if (!name) return;

      await setDoc(doc(collection(db, "exams")), {
        name,
        sectionId: currentSectionId,
        createdAt: serverTimestamp(),
        attemptsCount: 0,
      });

      closeModal();
      loadExams(currentSectionId);
    },
  });
});
/******************************************************
 * EDITAR EXAMEN (MODAL)
 ******************************************************/
function openEditExamModal(id, name) {
  openModal({
    title: "Editar examen",
    fieldsHtml: `
      <label class="field">
        <span>Nuevo nombre</span>
        <input type="text" id="edit-exam-name" value="${name}" required />
      </label>
    `,
    onSubmit: async () => {
      const newName = document.getElementById("edit-exam-name").value.trim();
      if (!newName) return;

      await updateDoc(doc(db, "exams", id), { 
        name: newName,
        updatedAt: serverTimestamp(),
      });

      closeModal();
      loadExams(currentSectionId);
    },
  });
}

/******************************************************
 * ABRIR DETALLE DE EXAMEN
 ******************************************************/
function openExamDetail(examId, examName) {
  currentExamId = examId;
  currentExamName = examName;

  hide(sectionsView);
  hide(usersView);
  hide(landingView);
  show(examDetailView);

  examNameInput.value = examName;
  loadCasesForExam(examId);
}

btnBackToExams.addEventListener("click", () => {
  show(sectionsView);
  hide(examDetailView);
  currentExamId = null;
});

/******************************************************
 * GUARDAR META DEL EXAMEN (NOMBRE)
 ******************************************************/
btnSaveExamMeta.addEventListener("click", async () => {
  if (!currentExamId) return;

  const newName = examNameInput.value.trim();
  if (!newName) {
    alert("Escribe un nombre para el examen.");
    return;
  }

  setLoading(btnSaveExamMeta, true, "Guardar nombre");

  try {
    await updateDoc(doc(db, "exams", currentExamId), {
      name: newName,
      updatedAt: serverTimestamp(),
    });

    await loadExams(currentSectionId);
    alert("Nombre actualizado correctamente.");
  } catch (err) {
    console.error(err);
    alert("Error al actualizar el examen.");
  } finally {
    setLoading(btnSaveExamMeta, false, "Guardar nombre");
  }
});

/******************************************************
 * CARGAR CASOS CLÍNICOS DE UN EXAMEN
 ******************************************************/
async function loadCasesForExam(examId) {
  questionsList.innerHTML = "";

  const q = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(q);

  if (snap.empty) {
    renderEmptyMessage(questionsList, "No hay casos clínicos. Crea uno nuevo.");
    return;
  }

  snap.forEach((docSnap) => {
    renderCaseBlock(docSnap.id, docSnap.data());
  });
}

/******************************************************
 * BLOQUE DE CASO CLÍNICO COMPLETO
 ******************************************************/
function renderCaseBlock(caseId, data) {
  const specialty = data.specialty || "";
  const caseText = data.caseText || "";
  const questionsArr = Array.isArray(data.questions) ? data.questions : [];

  const card = document.createElement("div");
  card.className = "card";
  card.dataset.caseId = caseId;

  card.innerHTML = `
    <label class="field">
      <span>Especialidad</span>
      <select class="case-specialty">
        <option value="">Selecciona</option>
        <option value="medicina_interna" ${specialty === "medicina_interna" ? "selected" : ""}>Medicina interna</option>
        <option value="pediatria" ${specialty === "pediatria" ? "selected" : ""}>Pediatría</option>
        <option value="ginecologia_obstetricia" ${specialty === "ginecologia_obstetricia" ? "selected" : ""}>Ginecología y obstetricia</option>
        <option value="cirugia_general" ${specialty === "cirugia_general" ? "selected" : ""}>Cirugía general</option>
      </select>
    </label>

    <label class="field">
      <span>Caso clínico</span>
      <textarea class="case-text" rows="4">${caseText}</textarea>
    </label>

    <div class="cards-list case-questions"></div>

    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <button class="btn btn-sm btn-primary btn-add-question">+ Agregar pregunta</button>
      <button class="btn btn-sm btn-secondary btn-save-case">Guardar caso</button>
      <button class="btn btn-sm btn-outline btn-delete-case">Eliminar caso</button>
      <button class="btn btn-sm btn-primary btn-new-case">+ Nuevo caso clínico</button>
    </div>
  `;

  const container = card.querySelector(".case-questions");

  // Preguntas existentes
  if (questionsArr.length > 0) {
    questionsArr.forEach((q) => {
      container.appendChild(renderQuestionBlock(q));
    });
  } else {
    container.appendChild(renderQuestionBlock());
  }

  // Agregar pregunta
  card.querySelector(".btn-add-question").addEventListener("click", () => {
    container.appendChild(renderQuestionBlock());
  });

  // Guardar caso
  card.querySelector(".btn-save-case").addEventListener("click", () => {
    saveCaseBlock(caseId, card);
  });

  // Eliminar caso
  card.querySelector(".btn-delete-case").addEventListener("click", async () => {
    if (confirm("¿Eliminar este caso clínico?")) {
      await deleteDoc(doc(db, "questions", caseId));
      loadCasesForExam(currentExamId);
    }
  });

  // Nuevo caso
  card.querySelector(".btn-new-case").addEventListener("click", async () => {
    await addDoc(collection(db, "questions"), {
      examId: currentExamId,
      specialty: "",
      caseText: "",
      questions: [],
      createdAt: serverTimestamp(),
    });

    loadCasesForExam(currentExamId);
  });

  questionsList.appendChild(card);
}

/******************************************************
 * BLOQUE INDIVIDUAL DE PREGUNTA (A–D)
 ******************************************************/
function renderQuestionBlock(q = {}) {
  const questionText = q.questionText || "";
  const optionA = q.optionA || "";
  const optionB = q.optionB || "";
  const optionC = q.optionC || "";
  const optionD = q.optionD || "";
  const correct = q.correctOption || "";
  const justification = q.justification || "";
  const difficulty = q.difficulty || "media";
  const subtype = q.subtype || "salud_publica";

  const card = document.createElement("div");
  card.className = "card-item";

  card.innerHTML = `
    <label class="field">
      <span>Pregunta</span>
      <textarea class="q-question" rows="2">${questionText}</textarea>
    </label>

    <label class="field"><span>A</span><input type="text" class="q-a" value="${optionA}" /></label>
    <label class="field"><span>B</span><input type="text" class="q-b" value="${optionB}" /></label>
    <label class="field"><span>C</span><input type="text" class="q-c" value="${optionC}" /></label>
    <label class="field"><span>D</span><input type="text" class="q-d" value="${optionD}" /></label>

    <label class="field">
      <span>Correcta</span>
      <select class="q-correct">
        <option value="">Selecciona</option>
        <option value="A" ${correct === "A" ? "selected" : ""}>A</option>
        <option value="B" ${correct === "B" ? "selected" : ""}>B</option>
        <option value="C" ${correct === "C" ? "selected" : ""}>C</option>
        <option value="D" ${correct === "D" ? "selected" : ""}>D</option>
      </select>
    </label>

    <label class="field">
      <span>Dificultad</span>
      <select class="q-difficulty">
        <option value="baja" ${difficulty === "baja" ? "selected" : ""}>Baja</option>
        <option value="media" ${difficulty === "media" ? "selected" : ""}>Media</option>
        <option value="alta" ${difficulty === "alta" ? "selected" : ""}>Alta</option>
      </select>
    </label>

    <label class="field">
      <span>Tipo</span>
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

    <div style="text-align:right;">
      <button class="btn btn-sm btn-outline btn-delete-question">Eliminar pregunta</button>
    </div>
  `;

  card.querySelector(".btn-delete-question").addEventListener("click", () => {
    card.remove();
  });

  return card;
}
/******************************************************
 * GUARDAR CASO CLÍNICO COMPLETO
 ******************************************************/
async function saveCaseBlock(caseId, card) {
  if (!currentExamId) {
    alert("Primero selecciona un examen.");
    return;
  }

  const specialty = card.querySelector(".case-specialty")?.value || "";
  const caseText = card.querySelector(".case-text").value.trim();

  if (!caseText) {
    alert("Debes escribir el caso clínico.");
    return;
  }

  const qCards = card.querySelectorAll(".case-questions .card-item");
  if (qCards.length === 0) {
    alert("Debes agregar al menos una pregunta.");
    return;
  }

  const questions = [];
  for (const qc of qCards) {
    const questionText = qc.querySelector(".q-question").value.trim();
    const optionA = qc.querySelector(".q-a").value.trim();
    const optionB = qc.querySelector(".q-b").value.trim();
    const optionC = qc.querySelector(".q-c").value.trim();
    const optionD = qc.querySelector(".q-d").value.trim();
    const correct = qc.querySelector(".q-correct").value;
    const justification = qc.querySelector(".q-just").value.trim();
    const difficulty = qc.querySelector(".q-difficulty").value;
    const subtype = qc.querySelector(".q-subtype").value;

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !correct || !justification) {
      alert("Completa todos los campos de cada pregunta.");
      return;
    }

    const weight =
      difficulty === "alta" ? 3 :
      difficulty === "media" ? 2 : 1;

    questions.push({
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: correct,
      justification,
      difficulty,
      difficultyWeight: weight,
      subtype,
    });
  }

  try {
    await updateDoc(doc(db, "questions", caseId), {
      examId: currentExamId,
      specialty,
      caseText,
      questions,
      updatedAt: serverTimestamp(),
    });

    alert("Caso clínico guardado correctamente.");
    await loadCasesForExam(currentExamId);

  } catch (err) {
    console.error(err);
    alert("Error guardando el caso clínico.");
  }
}

/******************************************************
 * VISTA USUARIOS (LISTA)
 ******************************************************/
async function loadUsers() {
  usersList.innerHTML = "";

  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    renderEmptyMessage(usersList, "No hay usuarios registrados.");
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Estado</th>
          <th>Rol</th>
          <th>Fecha límite</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    html += `
      <tr data-id="${docSnap.id}">
        <td>${d.name || ""}</td>
        <td>${d.email || ""}</td>
        <td>
          <span class="chip ${d.status === "activo" ? "chip--activo" : "chip--inactivo"}">
            ${d.status}
          </span>
        </td>
        <td>
          <span class="chip ${d.role === "admin" ? "chip--admin" : "chip--user"}">
            ${d.role}
          </span>
        </td>
        <td>${d.expiryDate || "—"}</td>
        <td>
          <button class="icon-btn" data-action="edit">✏</button>
          <button class="icon-btn" data-action="delete">🗑</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  usersList.innerHTML = html;

  // Acciones
  usersList.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = row.dataset.id;

    row.querySelector('button[data-action="edit"]').addEventListener("click", () => {
      openUserModal(id);
    });

    row.querySelector('button[data-action="delete"]').addEventListener("click", async () => {
      if (confirm("¿Eliminar este usuario?")) {
        await deleteDoc(doc(db, "users", id));
        loadUsers();
      }
    });
  });
}

/******************************************************
 * MODAL USUARIO
 ******************************************************/
function openUserModal(id = null) {
  const editing = Boolean(id);

  const fetchData = editing
    ? getDoc(doc(db, "users", id)).then((s) => (s.exists() ? s.data() : {}))
    : Promise.resolve({});

  fetchData.then((data) => {
    openModal({
      title: editing ? "Editar usuario" : "Nuevo usuario",
      fieldsHtml: `
        <label class="field">
          <span>Nombre</span>
          <input id="u-name" type="text" value="${data.name || ""}" required />
        </label>

        <label class="field">
          <span>Email</span>
          <input id="u-email" type="email" value="${data.email || ""}" ${editing ? "readonly" : ""} />
        </label>

        <label class="field">
          <span>Contraseña</span>
          <input id="u-pass" type="text" value="${data.password || ""}" required />
        </label>

        <label class="field">
          <span>Estado</span>
          <select id="u-status">
            <option value="activo" ${data.status === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${data.status === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </label>

        <label class="field">
          <span>Rol</span>
          <select id="u-role">
            <option value="admin" ${data.role === "admin" ? "selected" : ""}>Administrador</option>
            <option value="usuario" ${data.role === "usuario" ? "selected" : ""}>Usuario</option>
          </select>
        </label>

        <label class="field">
          <span>Fecha límite</span>
          <input id="u-exp" type="date" value="${data.expiryDate || ""}" />
        </label>
      `,
      onSubmit: async () => {
        const name = document.getElementById("u-name").value.trim();
        const email = document.getElementById("u-email").value.trim();
        const password = document.getElementById("u-pass").value.trim();
        const status = document.getElementById("u-status").value;
        const role = document.getElementById("u-role").value;
        const expiry = document.getElementById("u-exp").value;

        if (!name || !email || !password) {
          alert("Completa todos los campos obligatorios.");
          return;
        }

        const payload = {
          name,
          email,
          password,
          status,
          role,
          expiryDate: expiry,
          updatedAt: serverTimestamp(),
        };

        try {
          if (editing) {
            await updateDoc(doc(db, "users", email), payload);
          } else {
            payload.createdAt = serverTimestamp();
            await setDoc(doc(db, "users", email), payload);
            alert("Usuario creado. Recuerda crearlo también en Firebase Authentication.");
          }
          closeModal();
          loadUsers();
        } catch (err) {
          console.error(err);
          alert("No se pudo guardar el usuario.");
        }
      }
    });
  });
}

/******************************************************
 * REDES SOCIALES (ADMIN)
 ******************************************************/
async function loadSocialLinksAdmin() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data();
    socialButtons.forEach((btn) => {
      const key = btn.dataset.network;
      if (data[key]) btn.dataset.url = data[key];
    });

  } catch (err) {
    console.error(err);
  }
}

btnEditSocial.addEventListener("click", async () => {
  let data = {};
  const snap = await getDoc(doc(db, "settings", "socialLinks"));
  if (snap.exists()) data = snap.data();

  openModal({
    title: "Redes sociales",
    fieldsHtml: `
      <label class="field"><span>Instagram</span><input id="soc-instagram" type="url" value="${data.instagram || ""}" /></label>
      <label class="field"><span>WhatsApp</span><input id="soc-whatsapp" type="url" value="${data.whatsapp || ""}" /></label>
      <label class="field"><span>TikTok</span><input id="soc-tiktok" type="url" value="${data.tiktok || ""}" /></label>
      <label class="field"><span>Telegram</span><input id="soc-telegram" type="url" value="${data.telegram || ""}" /></label>
    `,
    onSubmit: async () => {
      const instagram = document.getElementById("soc-instagram").value.trim();
      const whatsapp = document.getElementById("soc-whatsapp").value.trim();
      const tiktok = document.getElementById("soc-tiktok").value.trim();
      const telegram = document.getElementById("soc-telegram").value.trim();

      try {
        await setDoc(
          doc(db, "settings", "socialLinks"),
          { instagram, whatsapp, tiktok, telegram, updatedAt: serverTimestamp() },
          { merge: true }
        );
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudieron guardar los enlaces.");
      }
    }
  });
});

/******************************************************
 * PANTALLA PRINCIPAL (ADMIN)
 ******************************************************/
btnLandingView?.addEventListener("click", async () => {
  hide(sectionsView);
  hide(usersView);
  hide(examDetailView);
  show(landingView);

  await loadLandingSettings();
});

async function loadLandingSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "landingPage"));
    if (!snap.exists()) return;

    const data = snap.data();
    if (landingHeroTitleInput) landingHeroTitleInput.value = data.heroTitle || "";
    if (landingHeroSubtitleInput) landingHeroSubtitleInput.value = data.heroSubtitle || "";
    if (landingCtaTextInput) landingCtaTextInput.value = data.ctaText || "";
    if (landingCtaUrlInput) landingCtaUrlInput.value = data.ctaUrl || "";

  } catch (err) {
    console.error(err);
  }
}

landingSaveBtn?.addEventListener("click", async () => {
  const heroTitle = landingHeroTitleInput.value.trim();
  const heroSubtitle = landingHeroSubtitleInput.value.trim();
  const ctaText = landingCtaTextInput.value.trim();
  const ctaUrl = landingCtaUrlInput.value.trim();

  try {
    await setDoc(
      doc(db, "settings", "landingPage"),
      { heroTitle, heroSubtitle, ctaText, ctaUrl, updatedAt: serverTimestamp() },
      { merge: true }
    );
    alert("Pantalla principal guardada correctamente.");
  } catch (err) {
    console.error(err);
    alert("No se pudo guardar la configuración.");
  }
});

/******************************************************
 * LOGOUT
 ******************************************************/
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

/******************************************************
 * FIN
 ******************************************************/
console.log("Admin panel cargado correctamente.");
