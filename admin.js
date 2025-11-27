/****************************************************
 * ADMIN.JS - Panel de Administrador
 * Plataforma Estudiante ENARM
 * - Gestión de secciones
 * - Gestión de exámenes y casos clínicos
 * - Gestión de usuarios
 * - Configuración de pantalla principal
 * - Analytics básicos
 ****************************************************/

// Firebase inicializado en firebase.js
import { auth, db } from "./firebase.js";

import {
  SPECIALTIES,
  SUBTYPES,
  DIFFICULTIES,
  DIFFICULTY_WEIGHTS,
  DEFAULT_EXAM_RULES,
} from "./shared-constants.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


/****************************************************
 * REFERENCIAS DOM
 ****************************************************/

// Header
const adminUserEmailSpan = document.getElementById("admin-user-email");
const btnLogout = document.getElementById("admin-btn-logout");
const btnToggleSidebar = document.getElementById("admin-btn-toggle-sidebar");

// Sidebar
const sidebar = document.getElementById("admin-sidebar");
const sectionsList = document.getElementById("admin-sections-list");
const btnAddSection = document.getElementById("admin-btn-add-section");
const btnNavExams = document.getElementById("admin-btn-nav-exams");
const btnNavMini = document.getElementById("admin-btn-nav-mini");
const btnNavUsers = document.getElementById("admin-btn-nav-users");
const btnNavAnalytics = document.getElementById("admin-btn-nav-analytics");
const btnNavLanding = document.getElementById("admin-btn-nav-landing");
const adminSocialIcons = document.querySelectorAll(".admin-social-icon");

// Paneles principales
const panelExams = document.getElementById("admin-panel-exams");
const panelMini = document.getElementById("admin-panel-mini");
const panelUsers = document.getElementById("admin-panel-users");
const panelAnalytics = document.getElementById("admin-panel-analytics");
const panelLanding = document.getElementById("admin-panel-landing");

// ==================== PANEL EXÁMENES ====================
const currentSectionTitle = document.getElementById("admin-current-section-title");
const examsListEl = document.getElementById("admin-exams-list");
const btnAddExam = document.getElementById("admin-btn-add-exam");

// Vista detalle examen
const examDetailView = document.getElementById("admin-exam-detail");
const btnBackToExams = document.getElementById("admin-btn-back-to-exams");
const examTitleInput = document.getElementById("admin-exam-title-input");
const examCasesContainer = document.getElementById("admin-exam-cases");
const btnSaveExamAll = document.getElementById("admin-btn-save-exam");

// ==================== PANEL USUARIOS ====================
const newUserNameInput = document.getElementById("admin-new-user-name");
const newUserEmailInput = document.getElementById("admin-new-user-email");
const newUserPasswordInput = document.getElementById("admin-new-user-password");
const newUserRoleSelect = document.getElementById("admin-new-user-role");
const newUserStatusSelect = document.getElementById("admin-new-user-status");
const newUserExpiryInput = document.getElementById("admin-new-user-expiry");
const btnCreateUser = document.getElementById("admin-btn-create-user");
const usersTableContainer = document.getElementById("admin-users-table");

// ==================== PANEL LANDING / SETTINGS ====================
const landingTextArea = document.getElementById("admin-landing-text");
const monthlyLabelInput = document.getElementById("admin-monthly-label");
const monthlyPriceInput = document.getElementById("admin-monthly-price");
const enarmLabelInput = document.getElementById("admin-enarm-label");
const enarmPriceInput = document.getElementById("admin-enarm-price");
const whatsappPhoneInput = document.getElementById("admin-whatsapp-phone");
const btnSaveLanding = document.getElementById("admin-btn-save-landing");

// Social links en panel landing
const landingInstagramInput = document.getElementById("admin-instagram-link");
const landingWhatsappLinkInput = document.getElementById("admin-whatsapp-link");
const landingTiktokInput = document.getElementById("admin-tiktok-link");
const landingTelegramInput = document.getElementById("admin-telegram-link");

// ==================== PANEL ANALYTICS ====================
const analyticsSummaryBox = document.getElementById("admin-analytics-summary");
const analyticsUsersBox = document.getElementById("admin-analytics-users");

// Modal genérico (reutilizable)
const modalOverlay = document.getElementById("admin-modal-overlay");
const modalBox = document.getElementById("admin-modal");
const modalTitle = document.getElementById("admin-modal-title");
const modalBody = document.getElementById("admin-modal-body");
const modalBtnCancel = document.getElementById("admin-modal-cancel");
const modalBtnOk = document.getElementById("admin-modal-ok");

let modalOkHandler = null;

/****************************************************
 * ESTADO EN MEMORIA
 ****************************************************/

let currentAdminUser = null;       // Auth user
let currentSectionId = null;       // Sección seleccionada
let currentExamId = null;          // Examen abierto
let currentExamCases = [];         // Casos clínicos en memoria


/****************************************************
 * UTILIDADES UI
 ****************************************************/

function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function setActivePanel(panelId) {
  const panels = [panelExams, panelMini, panelUsers, panelAnalytics, panelLanding];
  panels.forEach((p) => hide(p));

  if (panelId === "exams") show(panelExams);
  if (panelId === "mini") show(panelMini);
  if (panelId === "users") show(panelUsers);
  if (panelId === "analytics") show(panelAnalytics);
  if (panelId === "landing") show(panelLanding);
}

function setLoadingButton(btn, isLoading, textDefault = "Guardar") {
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
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${text}
    </div>
  `;
}

/****************************************************
 * MODAL GENÉRICO
 ****************************************************/

function openModal({ title, bodyHtml, onOk }) {
  if (!modalOverlay || !modalBox) return;
  modalTitle.textContent = title || "";
  modalBody.innerHTML = bodyHtml || "";
  modalOkHandler = onOk || null;
  show(modalOverlay);
}

function closeModal() {
  if (!modalOverlay) return;
  modalBody.innerHTML = "";
  modalOkHandler = null;
  hide(modalOverlay);
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

if (modalBtnCancel) {
  modalBtnCancel.addEventListener("click", () => {
    closeModal();
  });
}

if (modalBtnOk) {
  modalBtnOk.addEventListener("click", async () => {
    if (typeof modalOkHandler === "function") {
      await modalOkHandler();
    }
  });
}

/****************************************************
 * AUTH / VERIFICACIÓN DE ADMIN
 ****************************************************/

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const userDocRef = doc(db, "users", user.email);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      alert("Tu usuario no está configurado en Firestore.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const data = snap.data();

    const today = new Date().toISOString().slice(0, 10);
    if (data.expiryDate && data.expiryDate < today) {
      await updateDoc(userDocRef, { status: "inactivo" });
      alert("Tu acceso ha vencido. Contacta al administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (data.status !== "activo") {
      alert("Tu usuario está inactivo.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (data.role !== "admin") {
      alert("Este panel es solo para administradores.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentAdminUser = user;
    if (adminUserEmailSpan) {
      adminUserEmailSpan.textContent = user.email || "";
    }

    // Carga inicial
    await Promise.all([
      loadSections(),
      loadLandingSettings(),
      loadSocialLinks(),
      loadAnalyticsSummary(),
    ]);

    setActivePanel("exams"); // por defecto secciones/exámenes

  } catch (err) {
    console.error(err);
    alert("Error cargando datos de administrador.");
    await signOut(auth);
    window.location.href = "index.html";
  }
});

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    } finally {
      window.location.href = "index.html";
    }
  });
}

if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

/****************************************************
 * NAVEGACIÓN LATERAL
 ****************************************************/

function clearSidebarActive() {
  [
    btnNavExams,
    btnNavMini,
    btnNavUsers,
    btnNavAnalytics,
    btnNavLanding,
  ].forEach((b) => b && b.classList.remove("sidebar-btn--active"));
}

if (btnNavExams) {
  btnNavExams.addEventListener("click", () => {
    clearSidebarActive();
    btnNavExams.classList.add("sidebar-btn--active");
    setActivePanel("exams");
    sidebar.classList.remove("sidebar--open");
  });
}

if (btnNavMini) {
  btnNavMini.addEventListener("click", () => {
    clearSidebarActive();
    btnNavMini.classList.add("sidebar-btn--active");
    setActivePanel("mini");
    sidebar.classList.remove("sidebar--open");
  });
}

if (btnNavUsers) {
  btnNavUsers.addEventListener("click", () => {
    clearSidebarActive();
    btnNavUsers.classList.add("sidebar-btn--active");
    setActivePanel("users");
    sidebar.classList.remove("sidebar--open");
    loadUsers();
  });
}

if (btnNavAnalytics) {
  btnNavAnalytics.addEventListener("click", () => {
    clearSidebarActive();
    btnNavAnalytics.classList.add("sidebar-btn--active");
    setActivePanel("analytics");
    sidebar.classList.remove("sidebar--open");
    loadAnalyticsSummary();
  });
}

if (btnNavLanding) {
  btnNavLanding.addEventListener("click", () => {
    clearSidebarActive();
    btnNavLanding.classList.add("sidebar-btn--active");
    setActivePanel("landing");
    sidebar.classList.remove("sidebar--open");
    loadLandingSettings();
    loadSocialLinksIntoLanding();
  });
}

/****************************************************
 * SECCIONES (CRUD + REORDENAR)
 ****************************************************/

async function loadSections() {
  if (!sectionsList) return;

  const qSec = query(
    collection(db, "sections"),
    orderBy("order", "asc")
  );

  const snap = await getDocs(qSec);
  sectionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(sectionsList, "No hay secciones. Crea la primera.");
    currentSectionId = null;
    currentSectionTitle.textContent = "Sin secciones";
    examsListEl.innerHTML = "";
    return;
  }

  let first = true;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "Sección sin título";

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.draggable = true;
    li.dataset.sectionId = id;

    li.innerHTML = `
      <div class="sidebar__section-name">${name}</div>
      <div class="sidebar__section-actions">
        <button class="icon-btn admin-edit-section" title="Editar sección">✏</button>
        <button class="icon-btn admin-delete-section" title="Eliminar sección">🗑</button>
      </div>
    `;

    // Click en el recuadro → seleccionar sección
    li.addEventListener("click", (e) => {
      // Evitar que editar/eliminar disparen select
      if (
        e.target.classList.contains("admin-edit-section") ||
        e.target.classList.contains("admin-delete-section")
      ) {
        return;
      }
      selectSection(id, name);
    });

    // Editar
    li
      .querySelector(".admin-edit-section")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        openEditSectionModal(id, name);
      });

    // Eliminar
    li
      .querySelector(".admin-delete-section")
      .addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = window.confirm(
          "¿Eliminar esta sección y TODOS los exámenes y casos clínicos asociados?"
        );
        if (!ok) return;
        await deleteSectionWithAllData(id);
        await loadSections();
        if (currentSectionId === id) {
          currentSectionId = null;
          currentSectionTitle.textContent = "Sin sección seleccionada";
          examsListEl.innerHTML = "";
        }
      });

    // Drag & drop (solo orden visual + update order)
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      li.classList.add("dragging");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      // Recalcular orden y guardar en Firestore
      saveSectionsOrder();
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = sectionsList.querySelector(".dragging");
      if (!dragging || dragging === li) return;
      const bounding = li.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset > bounding.height / 2) {
        sectionsList.insertBefore(dragging, li.nextSibling);
      } else {
        sectionsList.insertBefore(dragging, li);
      }
    });

    sectionsList.appendChild(li);

    // Seleccionar la primera sección al cargar
    if (first) {
      first = false;
      selectSection(id, name);
      li.classList.add("sidebar__section-item--active");
    }
  });
}

function selectSection(id, name) {
  currentSectionId = id;
  currentSectionTitle.textContent = name || "Sección";

  // Resaltar activa
  sectionsList
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));
  const activeLi = sectionsList.querySelector(
    `.sidebar__section-item[data-section-id="${id}"]`
  );
  if (activeLi) {
    activeLi.classList.add("sidebar__section-item--active");
  }

  // Cargar exámenes de esa sección
  loadExamsForSection(id);
}

async function saveSectionsOrder() {
  if (!sectionsList) return;
  const items = Array.from(
    sectionsList.querySelectorAll(".sidebar__section-item")
  );
  const batchUpdates = items.map((li, index) => {
    const id = li.dataset.sectionId;
    return updateDoc(doc(db, "sections", id), { order: index });
  });
  try {
    await Promise.all(batchUpdates);
  } catch (err) {
    console.error("Error actualizando orden de secciones:", err);
  }
}

async function deleteSectionWithAllData(sectionId) {
  // Eliminar exámenes de esta sección y sus preguntas (casos)
  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );
  const exSnap = await getDocs(qEx);

  for (const ex of exSnap.docs) {
    const examId = ex.id;

    const qCases = query(
      collection(db, "questions"),
      where("examId", "==", examId)
    );
    const caseSnap = await getDocs(qCases);

    for (const c of caseSnap.docs) {
      await deleteDoc(c.ref);
    }

    await deleteDoc(ex.ref);
  }

  await deleteDoc(doc(db, "sections", sectionId));
}

function openEditSectionModal(sectionId, currentName) {
  openModal({
    title: "Editar sección",
    bodyHtml: `
      <label class="field">
        <span>Nombre de la sección</span>
        <input type="text" id="modal-section-name" value="${currentName || ""}" />
      </label>
    `,
    onOk: async () => {
      const input = document.getElementById("modal-section-name");
      const name = input.value.trim();
      if (!name) {
        alert("Escribe un nombre.");
        return;
      }
      const btn = modalBtnOk;
      setLoadingButton(btn, true);
      try {
        await updateDoc(doc(db, "sections", sectionId), { name });
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar la sección.");
      } finally {
        setLoadingButton(btn, false, "Guardar");
      }
    },
  });
}

if (btnAddSection) {
  btnAddSection.addEventListener("click", () => {
    openModal({
      title: "Nueva sección",
      bodyHtml: `
        <label class="field">
          <span>Nombre de la sección</span>
          <input type="text" id="modal-new-section-name" />
        </label>
      `,
      onOk: async () => {
        const input = document.getElementById("modal-new-section-name");
        const name = input.value.trim();
        if (!name) {
          alert("Escribe un nombre.");
          return;
        }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          // Calcular orden = última posición
          const qSec = await getDocs(collection(db, "sections"));
          const order = qSec.size;

          await addDoc(collection(db, "sections"), {
            name,
            order,
            createdAt: serverTimestamp(),
          });

          await loadSections();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo crear la sección.");
        } finally {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

/****************************************************
 * EXÁMENES (LISTA POR SECCIÓN)
 ****************************************************/

async function loadExamsForSection(sectionId) {
  if (!examsListEl) return;
  examsListEl.innerHTML = "";

  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qEx);

  if (snap.empty) {
    renderEmptyMessage(
      examsListEl,
      "No hay exámenes en esta sección. Crea el primero."
    );
    return;
  }

  snap.forEach((docSnap) => {
    const examId = docSnap.id;
    const data = docSnap.data();
    const name = data.name || "Examen sin título";

    const card = document.createElement("div");
    card.className = "card-item";

    card.innerHTML = `
      <div class="card-item__title-row">
        <div class="card-item__title">${name}</div>
        <div class="card-item__actions">
          <button class="btn btn-sm btn-secondary admin-open-exam">Abrir</button>
          <button class="icon-btn admin-edit-exam" title="Editar nombre">✏</button>
          <button class="icon-btn admin-delete-exam" title="Eliminar examen">🗑</button>
        </div>
      </div>
    `;

    card
      .querySelector(".admin-open-exam")
      .addEventListener("click", () => openExamDetail(examId, name));

    card
      .querySelector(".admin-edit-exam")
      .addEventListener("click", () =>
        openEditExamNameModal(examId, name)
      );

    card
      .querySelector(".admin-delete-exam")
      .addEventListener("click", async () => {
        const ok = window.confirm(
          "¿Eliminar este examen y todos sus casos clínicos?"
        );
        if (!ok) return;

        const qCases = query(
          collection(db, "questions"),
          where("examId", "==", examId)
        );
        const snapCases = await getDocs(qCases);
        for (const c of snapCases.docs) {
          await deleteDoc(c.ref);
        }

        await deleteDoc(doc(db, "exams", examId));
        loadExamsForSection(sectionId);
      });

    examsListEl.appendChild(card);
  });
}

if (btnAddExam) {
  btnAddExam.addEventListener("click", () => {
    if (!currentSectionId) {
      alert("Selecciona primero una sección.");
      return;
    }
    openModal({
      title: "Nuevo examen",
      bodyHtml: `
        <label class="field">
          <span>Nombre del examen</span>
          <input type="text" id="modal-new-exam-name" />
        </label>
      `,
      onOk: async () => {
        const input = document.getElementById("modal-new-exam-name");
        const name = input.value.trim();
        if (!name) {
          alert("Escribe un nombre.");
          return;
        }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          const docRef = await addDoc(collection(db, "exams"), {
            name,
            sectionId: currentSectionId,
            createdAt: serverTimestamp(),
          });
          await loadExamsForSection(currentSectionId);
          closeModal();
          // Opcional: abrir directamente
          openExamDetail(docRef.id, name);
        } catch (err) {
          console.error(err);
          alert("No se pudo crear el examen.");
        } finally {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

function openEditExamNameModal(examId, currentName) {
  openModal({
    title: "Editar nombre del examen",
    bodyHtml: `
      <label class="field">
        <span>Nombre del examen</span>
        <input type="text" id="modal-edit-exam-name" value="${currentName || ""}" />
      </label>
    `,
    onOk: async () => {
      const input = document.getElementById("modal-edit-exam-name");
      const name = input.value.trim();
      if (!name) {
        alert("Escribe un nombre.");
        return;
      }
      const btn = modalBtnOk;
      setLoadingButton(btn, true);
      try {
        await updateDoc(doc(db, "exams", examId), {
          name,
          updatedAt: serverTimestamp(),
        });
        await loadExamsForSection(currentSectionId);
        if (currentExamId === examId && examTitleInput) {
          examTitleInput.value = name;
        }
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar el examen.");
      } finally {
        setLoadingButton(btn, false, "Guardar");
      }
    },
  });
}

/****************************************************
 * DETALLE DE EXAMEN (CASOS CLÍNICOS + PREGUNTAS)
 ****************************************************/

function createEmptyQuestion() {
  return {
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "",
    justification: "",
    subtype: "salud_publica",
    difficulty: "media",
  };
}

function createEmptyCase() {
  return {
    caseText: "",
    specialty: "",
    questions: [createEmptyQuestion()], // al menos 1 pregunta vacía
  };
}

async function openExamDetail(examId, examName) {
  currentExamId = examId;
  currentExamCases = [];

  // Aseguramos que el panel de exámenes esté visible
  show(panelExams);
  show(examDetailView);

  if (examTitleInput) {
    examTitleInput.value = examName || "";
  }
  if (examCasesContainer) {
    examCasesContainer.innerHTML = "";
  }

  // Traer casos clínicos de la colección "questions"
  const qCases = query(
    collection(db, "questions"),
    where("examId", "==", examId)
  );
  const snap = await getDocs(qCases);

  if (snap.empty) {
    // Si no hay casos todavía, arrancamos con uno vacío
    currentExamCases = [createEmptyCase()];
  } else {
    currentExamCases = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  }

  renderExamCases();
}

function renderExamCases() {
  if (!examCasesContainer) return;
  examCasesContainer.innerHTML = "";

  // Si por alguna razón no hay casos en memoria, aseguramos uno vacío
  if (!currentExamCases.length) {
    currentExamCases.push(createEmptyCase());
  }

  currentExamCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card exam-case-block";
    wrapper.dataset.caseIndex = index;

    const specialtyValue = caseData.specialty || "";
    const questionsArr = Array.isArray(caseData.questions)
      ? caseData.questions
      : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">
          Caso clínico ${index + 1}
        </h3>
        <button type="button" class="btn btn-sm btn-outline admin-delete-case">
          Eliminar caso clínico
        </button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-case-specialty">
          <option value="">Selecciona...</option>
          ${Object.entries(SPECIALTIES)
            .map(
              ([key, label]) =>
                `<option value="${key}" ${
                  key === specialtyValue ? "selected" : ""
                }>${label}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-add-question">
          + Agregar pregunta
        </button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-case-questions");

    if (!questionsArr.length) {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    } else {
      questionsArr.forEach((qData) => {
        qContainer.appendChild(renderQuestionBlock(qData));
      });
    }

    wrapper
      .querySelector(".admin-add-question")
      .addEventListener("click", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

    wrapper
      .querySelector(".admin-delete-case")
      .addEventListener("click", () => {
        const idx = parseInt(wrapper.dataset.caseIndex, 10);
        if (Number.isNaN(idx)) return;
        currentExamCases.splice(idx, 1);
        renderExamCases();
      });

    examCasesContainer.appendChild(wrapper);
  });

  // --- BOTONES INFERIORES (duplicados) ---
  const bottomActions = document.createElement("div");
  bottomActions.className = "flex-row";
  bottomActions.style.justifyContent = "flex-end";
  bottomActions.style.marginTop = "16px";

  bottomActions.innerHTML = `
    <button type="button" class="btn btn-secondary" id="admin-btn-add-case-bottom">
      + Agregar caso clínico
    </button>
    <button type="button" class="btn btn-primary" id="admin-btn-save-exam-bottom">
      Guardar examen
    </button>
  `;

  examCasesContainer.appendChild(bottomActions);

  // Eventos de los botones inferiores reutilizando la misma lógica
  const btnAddCaseBottom = document.getElementById("admin-btn-add-case-bottom");
  const btnSaveExamBottom = document.getElementById("admin-btn-save-exam-bottom");

  if (btnAddCaseBottom) {
    btnAddCaseBottom.addEventListener("click", () => {
      if (!currentExamId) {
        alert("Primero abre un examen.");
        return;
      }
      currentExamCases.push(createEmptyCase());
      renderExamCases();
    });
  }

  if (btnSaveExamBottom && btnSaveExamAll) {
    btnSaveExamBottom.addEventListener("click", () => {
      btnSaveExamAll.click(); // dispara el mismo guardado que el botón superior
    });
  }
}

function renderQuestionBlock(qData) {
  const {
    questionText = "",
    optionA = "",
    optionB = "",
    optionC = "",
    optionD = "",
    correctOption = "",
    justification = "",
    subtype = "salud_publica",
    difficulty = "media",
  } = qData;

  const card = document.createElement("div");
  card.className = "card-item exam-question-block";

  card.innerHTML = `
    <label class="field">
      <span>Pregunta</span>
      <textarea class="admin-q-question" rows="2">${questionText}</textarea>
    </label>

    <label class="field">
      <span>Opción A</span>
      <input type="text" class="admin-q-a" value="${optionA}" />
    </label>

    <label class="field">
      <span>Opción B</span>
      <input type="text" class="admin-q-b" value="${optionB}" />
    </label>

    <label class="field">
      <span>Opción C</span>
      <input type="text" class="admin-q-c" value="${optionC}" />
    </label>

    <label class="field">
      <span>Opción D</span>
      <input type="text" class="admin-q-d" value="${optionD}" />
    </label>

    <label class="field">
      <span>Respuesta correcta</span>
      <select class="admin-q-correct">
        <option value="">Selecciona</option>
        <option value="A" ${correctOption === "A" ? "selected" : ""}>A</option>
        <option value="B" ${correctOption === "B" ? "selected" : ""}>B</option>
        <option value="C" ${correctOption === "C" ? "selected" : ""}>C</option>
        <option value="D" ${correctOption === "D" ? "selected" : ""}>D</option>
      </select>
    </label>

    <label class="field">
      <span>Tipo de pregunta</span>
      <select class="admin-q-subtype">
        ${Object.entries(SUBTYPES)
          .map(
            ([key, label]) =>
              `<option value="${key}" ${
                key === subtype ? "selected" : ""
              }>${label}</option>`
          )
          .join("")}
      </select>
    </label>

    <label class="field">
      <span>Dificultad</span>
      <select class="admin-q-difficulty">
        ${Object.entries(DIFFICULTIES)
          .map(
            ([key, label]) =>
              `<option value="${key}" ${
                key === difficulty ? "selected" : ""
              }>${label}</option>`
          )
          .join("")}
      </select>
    </label>

    <label class="field">
      <span>Justificación</span>
      <textarea class="admin-q-justification" rows="2">${justification}</textarea>
    </label>

    <div style="text-align:right;margin-top:6px;">
      <button type="button" class="btn btn-sm btn-outline admin-delete-question">
        Eliminar pregunta
      </button>
    </div>
  `;

  card
    .querySelector(".admin-delete-question")
    .addEventListener("click", () => {
      card.remove();
    });

  return card;
}

// Botón "Volver a exámenes"
if (btnBackToExams) {
  btnBackToExams.addEventListener("click", () => {
    currentExamId = null;
    currentExamCases = [];
    if (examCasesContainer) examCasesContainer.innerHTML = "";
    hide(examDetailView);
    show(panelExams);
    if (currentSectionId) {
      loadExamsForSection(currentSectionId);
    }
  });
}

// Guardar examen (botón superior)
if (btnSaveExamAll) {
  btnSaveExamAll.addEventListener("click", async () => {
    if (!currentExamId) {
      alert("No hay examen seleccionado.");
      return;
    }

    const newName = examTitleInput.value.trim();
    if (!newName) {
      alert("Escribe un nombre para el examen.");
      return;
    }

    const caseBlocks = examCasesContainer.querySelectorAll(".exam-case-block");
    if (!caseBlocks.length) {
      alert("Debes agregar al menos un caso clínico.");
      return;
    }

    const casesToSave = [];

    for (const block of caseBlocks) {
      const caseText = block.querySelector(".admin-case-text").value.trim();
      const specialty = block.querySelector(".admin-case-specialty").value;

      if (!caseText) {
        alert("Escribe el texto del caso clínico.");
        return;
      }

      const qBlocks = block.querySelectorAll(".exam-question-block");
      if (!qBlocks.length) {
        alert("Cada caso clínico debe tener al menos una pregunta.");
        return;
      }

      const questions = [];

      for (const qb of qBlocks) {
        const questionText = qb.querySelector(".admin-q-question").value.trim();
        const optionA = qb.querySelector(".admin-q-a").value.trim();
        const optionB = qb.querySelector(".admin-q-b").value.trim();
        const optionC = qb.querySelector(".admin-q-c").value.trim();
        const optionD = qb.querySelector(".admin-q-d").value.trim();
        const correctOption = qb.querySelector(".admin-q-correct").value;
        const subtype = qb.querySelector(".admin-q-subtype").value;
        const difficulty = qb.querySelector(".admin-q-difficulty").value;
        const justification = qb
          .querySelector(".admin-q-justification")
          .value.trim();

        if (
          !questionText ||
          !optionA ||
          !optionB ||
          !optionC ||
          !optionD ||
          !correctOption ||
          !justification
        ) {
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
          subtype,
          difficulty,
          justification,
        });
      }

      casesToSave.push({
        caseText,
        specialty,
        questions,
      });
    }

    const btn = btnSaveExamAll;
    setLoadingButton(btn, true, "Guardar examen");

    try {
      await updateDoc(doc(db, "exams", currentExamId), {
        name: newName,
        updatedAt: serverTimestamp(),
      });

      const qPrev = query(
        collection(db, "questions"),
        where("examId", "==", currentExamId)
      );
      const prevSnap = await getDocs(qPrev);
      for (const c of prevSnap.docs) {
        await deleteDoc(c.ref);
      }

      for (const c of casesToSave) {
        await addDoc(collection(db, "questions"), {
          examId: currentExamId,
          caseText: c.caseText,
          specialty: c.specialty,
          questions: c.questions,
          createdAt: serverTimestamp(),
        });
      }

      alert("Examen guardado correctamente.");
      if (currentSectionId) {
        await loadExamsForSection(currentSectionId);
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error al guardar el examen.");
    } finally {
      setLoadingButton(btn, false, "Guardar examen");
    }
  });
}

// Botón "Agregar caso clínico" SUPERIOR
const btnAddCase = document.getElementById("admin-btn-add-case");
if (btnAddCase) {
  btnAddCase.addEventListener("click", () => {
    if (!currentExamId) {
      alert("Primero abre un examen.");
      return;
    }

    currentExamCases.push(createEmptyCase());
    renderExamCases();
  });
}

/****************************************************
 * MINI EXÁMENES – BANCO GLOBAL DE CASOS
 * Colección en Firestore: "miniQuestions"
 ****************************************************/

// Elementos del DOM del panel de mini exámenes
const miniCasesContainer = document.getElementById("admin-mini-cases");
const btnMiniAddCase = document.getElementById("admin-mini-btn-add-case");
const btnMiniSaveAll = document.getElementById("admin-mini-btn-save-all");

// Estado en memoria del banco global
let miniCases = [];
let miniCasesLoadedOnce = false;

/**
 * Reconstruye miniCases leyendo TODO lo que está escrito
 * actualmente en el DOM (casos + preguntas).
 * Sirve para NO perder cambios al agregar un nuevo caso.
 */
function syncMiniCasesFromDOM() {
  if (!miniCasesContainer) return;

  const caseBlocks = miniCasesContainer.querySelectorAll(".mini-case-block");
  const newCases = [];

  caseBlocks.forEach((block) => {
    const idx = parseInt(block.dataset.caseIndex, 10);
    const prev = !Number.isNaN(idx) && miniCases[idx] ? miniCases[idx] : {};

    const caseText = block
      .querySelector(".admin-mini-case-text")
      ?.value.trim() || "";
    const specialty =
      block.querySelector(".admin-mini-case-specialty")?.value || "";

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText =
        qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption = qb.querySelector(".admin-q-correct")?.value || "A";
      const subtype = qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty =
        qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification =
        qb.querySelector(".admin-q-justification")?.value.trim() || "";

      // Si TODA la pregunta está vacía, la saltamos
      const allEmpty =
        !questionText &&
        !optionA &&
        !optionB &&
        !optionC &&
        !optionD &&
        !justification;

      if (allEmpty) return;

      questions.push({
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        subtype,
        difficulty,
        justification,
      });
    });

    // Si el caso y TODAS sus preguntas están vacíos, no se agrega
    if (!caseText && !questions.length) return;

    newCases.push({
      id: prev.id || null,
      caseText,
      specialty,
      questions,
    });
  });

  // Si el admin borró todo manualmente, dejamos al menos un caso vacío
  miniCases =
    newCases.length > 0
      ? newCases
      : [
          {
            id: null,
            caseText: "",
            specialty: "",
            questions: [createEmptyQuestion()],
          },
        ];
}

// Carga inicial del banco desde Firestore
async function loadMiniCases() {
  if (!miniCasesContainer) return;

  // Si ya se cargó una vez y hay estado en memoria, reusar (no pisar lo que edite)
  if (miniCasesLoadedOnce && miniCases.length) {
    renderMiniCases();
    return;
  }

  miniCasesContainer.innerHTML = `
    <div class="card">
      <p class="panel-subtitle">Cargando banco de mini exámenes…</p>
    </div>
  `;

  try {
    const snap = await getDocs(collection(db, "miniQuestions"));
    miniCases = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        caseText: data.caseText || "",
        specialty: data.specialty || "",
        questions:
          Array.isArray(data.questions) && data.questions.length
            ? data.questions
            : [createEmptyQuestion()],
      };
    });
  } catch (err) {
    console.error(err);
    miniCases = [];
    miniCasesContainer.innerHTML = `
      <div class="card">
        <p class="panel-subtitle">Error al cargar el banco de mini exámenes.</p>
      </div>
    `;
    return;
  }

  if (!miniCases.length) {
    miniCases.push({
      id: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
  }

  miniCasesLoadedOnce = true;
  renderMiniCases();
}

// Pinta todos los casos del banco global en el panel
function renderMiniCases() {
  if (!miniCasesContainer) return;
  miniCasesContainer.innerHTML = "";

  // Si no hay casos, mostramos mensaje y un caso vacío
  if (!miniCases.length) {
    miniCases.push({
      id: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
  }

  miniCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card mini-case-block";
    wrapper.dataset.caseIndex = index;

    const specialtyValue = caseData.specialty || "";
    const questionsArr = Array.isArray(caseData.questions)
      ? caseData.questions
      : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">
          Caso clínico global ${index + 1}
        </h3>
        <button type="button" class="btn btn-sm btn-outline admin-mini-delete-case">
          Eliminar caso
        </button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-mini-case-specialty">
          <option value="">Selecciona…</option>
          ${Object.entries(SPECIALTIES)
            .map(
              ([key, label]) =>
                `<option value="${key}" ${
                  key === specialtyValue ? "selected" : ""
                }>${label}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-mini-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-mini-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-mini-add-question">
          + Agregar pregunta
        </button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-mini-case-questions");

    if (!questionsArr.length) {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    } else {
      questionsArr.forEach((qData) => {
        qContainer.appendChild(renderQuestionBlock(qData));
      });
    }

    // Agregar nueva pregunta dentro del caso
    wrapper
      .querySelector(".admin-mini-add-question")
      .addEventListener("click", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

    // Eliminar caso del arreglo y volver a pintar
    wrapper
      .querySelector(".admin-mini-delete-case")
      .addEventListener("click", () => {
        const idx = parseInt(wrapper.dataset.caseIndex, 10);
        if (Number.isNaN(idx)) return;
        miniCases.splice(idx, 1);
        renderMiniCases();
      });

    miniCasesContainer.appendChild(wrapper);
  });

  // Botones inferiores duplicados
  const bottom = document.createElement("div");
  bottom.className = "flex-row";
  bottom.style.justifyContent = "flex-end";
  bottom.style.gap = "8px";
  bottom.style.marginTop = "12px";

  const btnAddBottom = document.createElement("button");
  btnAddBottom.type = "button";
  btnAddBottom.className = "btn btn-sm btn-secondary";
  btnAddBottom.textContent = "+ Agregar caso clínico";
  btnAddBottom.addEventListener("click", () => {
    if (btnMiniAddCase) btnMiniAddCase.click();
  });

  const btnSaveBottom = document.createElement("button");
  btnSaveBottom.type = "button";
  btnSaveBottom.className = "btn btn-sm btn-primary";
  btnSaveBottom.textContent = "Guardar banco";
  btnSaveBottom.addEventListener("click", () => {
    if (btnMiniSaveAll) btnMiniSaveAll.click();
  });

  bottom.appendChild(btnAddBottom);
  bottom.appendChild(btnSaveBottom);
  miniCasesContainer.appendChild(bottom);
}

// Botón superior: agregar caso al banco global
if (btnMiniAddCase && miniCasesContainer) {
  btnMiniAddCase.addEventListener("click", () => {
    // Antes de agregar, capturamos TODO lo que ya esté escrito
    syncMiniCasesFromDOM();
    miniCases.push({
      id: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
    renderMiniCases();
  });
}

// Handler común para "Guardar banco"
async function handleSaveMiniBank() {
  if (!miniCasesContainer) return;

  // Reconstruir desde el DOM para asegurarnos de tomar lo último
  syncMiniCasesFromDOM();

  if (!miniCases.length) {
    if (
      !confirm(
        "No hay casos en el banco. Si continúas, se eliminarán todos los casos previos de mini exámenes. ¿Continuar?"
      )
    ) {
      return;
    }
  }

  // Validaciones rápidas
  for (const c of miniCases) {
    if (!c.caseText.trim()) {
      alert("Escribe el texto del caso clínico en todos los casos.");
      return;
    }
    if (!c.questions.length) {
      alert(
        "Cada caso clínico del banco debe tener al menos una pregunta."
      );
      return;
    }
    for (const q of c.questions) {
      if (
        !q.questionText ||
        !q.optionA ||
        !q.optionB ||
        !q.optionC ||
        !q.optionD ||
        !q.correctOption ||
        !q.justification
      ) {
        alert("Completa todos los campos en todas las preguntas del banco.");
        return;
      }
    }
  }

  const btn = btnMiniSaveAll;
  if (btn) setLoadingButton(btn, true, "Guardar banco");

  try {
    // 1) Borrar banco previo
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    for (const d of prevSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 2) Guardar nuevo banco COMPLETO
    for (const c of miniCases) {
      await addDoc(collection(db, "miniQuestions"), {
        caseText: c.caseText,
        specialty: c.specialty,
        questions: c.questions,
        createdAt: serverTimestamp(),
      });
    }

    alert("Banco de mini exámenes guardado correctamente.");
  } catch (err) {
    console.error(err);
    alert("Hubo un error al guardar el banco de mini exámenes.");
  } finally {
    if (btn) setLoadingButton(btn, false, "Guardar banco");
  }
}

// Botón “Guardar banco” – sobrescribe la colección miniQuestions
if (btnMiniSaveAll && miniCasesContainer) {
  btnMiniSaveAll.addEventListener("click", handleSaveMiniBank);
}

// Cargar banco al iniciar (si el panel existe)
if (typeof panelMini !== "undefined" && panelMini && miniCasesContainer) {
  loadMiniCases();
}


/****************************************************
 * USUARIOS (CRUD)
 ****************************************************/

async function loadUsers() {
  if (!usersTableContainer) return;

  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersTableContainer.innerHTML = "";
    renderEmptyMessage(
      usersTableContainer,
      "No hay usuarios creados. Usa el formulario superior para crear uno."
    );
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Rol</th>
          <th>Estado</th>
          <th>Vence</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "";
    const email = data.email || id;
    const role = data.role || "usuario";
    const status = data.status || "inactivo";
    const expiry = data.expiryDate || "";

    const chipRoleClass = role === "admin" ? "chip--admin" : "chip--user";
    const chipStatusClass =
      status === "activo" ? "chip--activo" : "chip--inactivo";

    html += `
      <tr data-id="${id}">
        <td>${name}</td>
        <td>${email}</td>
        <td><span class="chip ${chipRoleClass}">${role}</span></td>
        <td><span class="chip ${chipStatusClass}">${status}</span></td>
        <td>${expiry || "—"}</td>
        <td>
          <button class="icon-btn admin-edit-user" title="Editar">✏</button>
          <button class="icon-btn admin-delete-user" title="Eliminar">🗑</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  usersTableContainer.innerHTML = html;

  usersTableContainer
    .querySelectorAll("tr[data-id]")
    .forEach((row) => attachUserRowEvents(row));
}

function attachUserRowEvents(row) {
  const id = row.dataset.id;
  const btnEdit = row.querySelector(".admin-edit-user");
  const btnDelete = row.querySelector(".admin-delete-user");

  btnEdit.addEventListener("click", () => openUserEditModal(id));
  btnDelete.addEventListener("click", async () => {
    const ok = window.confirm("¿Eliminar este usuario?");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "users", id));
      loadUsers();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el usuario.");
    }
  });
}

if (btnCreateUser) {
  btnCreateUser.addEventListener("click", async () => {
    const name = newUserNameInput.value.trim();
    const email = newUserEmailInput.value.trim();
    const password = newUserPasswordInput.value.trim();
    const role = newUserRoleSelect.value;
    const status = newUserStatusSelect.value;
    const expiry = newUserExpiryInput.value || "";

    if (!name || !email || !password) {
      alert("Nombre, correo y contraseña son obligatorios.");
      return;
    }

    try {
      await setDoc(doc(db, "users", email), {
        name,
        email,
        password,
        role,
        status,
        expiryDate: expiry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert(
        "Usuario creado en Firestore.\nRecuerda crearlo también en Firebase Authentication manualmente."
      );

      newUserNameInput.value = "";
      newUserEmailInput.value = "";
      newUserPasswordInput.value = "";
      newUserRoleSelect.value = "usuario";
      newUserStatusSelect.value = "activo";
      newUserExpiryInput.value = "";

      loadUsers();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear el usuario.");
    }
  });
}

function openUserEditModal(userId) {
  const ref = doc(db, "users", userId);
  getDoc(ref).then((snap) => {
    if (!snap.exists()) {
      alert("No se encontró el usuario.");
      return;
    }

    const data = snap.data();

    openModal({
      title: "Editar usuario",
      bodyHtml: `
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="modal-user-name" value="${data.name || ""}" />
        </label>
        <label class="field">
          <span>Correo (ID)</span>
          <input type="email" id="modal-user-email" value="${data.email || userId}" readonly />
        </label>
        <label class="field">
          <span>Contraseña (referencia)</span>
          <input type="text" id="modal-user-password" value="${data.password || ""}" />
        </label>
        <label class="field">
          <span>Rol</span>
          <select id="modal-user-role">
            <option value="admin" ${
              data.role === "admin" ? "selected" : ""
            }>Administrador</option>
            <option value="usuario" ${
              data.role === "usuario" ? "selected" : ""
            }>Usuario</option>
          </select>
        </label>
        <label class="field">
          <span>Estado</span>
          <select id="modal-user-status">
            <option value="activo" ${
              data.status === "activo" ? "selected" : ""
            }>Activo</option>
            <option value="inactivo" ${
              data.status === "inactivo" ? "selected" : ""
            }>Inactivo</option>
          </select>
        </label>
        <label class="field">
          <span>Fecha de vencimiento</span>
          <input type="date" id="modal-user-expiry" value="${data.expiryDate || ""}" />
        </label>
      `,
      onOk: async () => {
        const name = document.getElementById("modal-user-name").value.trim();
        const email = document.getElementById("modal-user-email").value.trim();
        const password = document
          .getElementById("modal-user-password")
          .value.trim();
        const role = document.getElementById("modal-user-role").value;
        const status = document.getElementById("modal-user-status").value;
        const expiry = document.getElementById("modal-user-expiry").value || "";

        if (!name || !email) {
          alert("Nombre y correo son obligatorios.");
          return;
        }

        const btn = modalBtnOk;
        setLoadingButton(btn, true);

        try {
          await updateDoc(doc(db, "users", email), {
            name,
            email,
            password,
            role,
            status,
            expiryDate: expiry,
            updatedAt: serverTimestamp(),
          });
          await loadUsers();
          closeModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo actualizar el usuario.");
        } finally {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

/****************************************************
 * PANTALLA PRINCIPAL / LANDING (settings/landingPage)
 ****************************************************/

async function loadLandingSettings() {
  if (!landingTextArea) return;

  try {
    const ref = doc(db, "settings", "landingPage");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Valores por defecto
      landingTextArea.value =
        "Aquí podrás conocer todo lo que incluye la plataforma Estudiante ENARM.";
      monthlyLabelInput.value = "Plan mensual";
      monthlyPriceInput.value = "0";
      enarmLabelInput.value = "Plan ENARM 2026";
      enarmPriceInput.value = "0";
      whatsappPhoneInput.value = "+525515656316";
      return;
    }

    const data = snap.data();

    landingTextArea.value = data.description || "";
    monthlyLabelInput.value = data.monthlyLabel || "Plan mensual";
    monthlyPriceInput.value = data.monthlyPrice || "0";
    enarmLabelInput.value = data.enarmLabel || "Plan ENARM 2026";
    enarmPriceInput.value = data.enarmPrice || "0";
    whatsappPhoneInput.value = data.whatsappPhone || "+525515656316";
  } catch (err) {
    console.error("Error cargando landingPage:", err);
  }
}

if (btnSaveLanding) {
  btnSaveLanding.addEventListener("click", async () => {
    if (!landingTextArea) return;

    const description = landingTextArea.value.trim();
    const monthlyLabel = monthlyLabelInput.value.trim() || "Plan mensual";
    const monthlyPrice = monthlyPriceInput.value.trim() || "0";
    const enarmLabel = enarmLabelInput.value.trim() || "Plan ENARM 2026";
    const enarmPrice = enarmPriceInput.value.trim() || "0";
    const whatsappPhone =
      whatsappPhoneInput.value.trim() || "+525515656316";

    const btn = btnSaveLanding;
    setLoadingButton(btn, true);

    try {
      await setDoc(
        doc(db, "settings", "landingPage"),
        {
          description,
          monthlyLabel,
          monthlyPrice,
          enarmLabel,
          enarmPrice,
          whatsappPhone,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Pantalla principal guardada.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la pantalla principal.");
    } finally {
      setLoadingButton(btn, false, "Guardar");
    }
  });
}

/****************************************************
 * SOCIAL LINKS (settings/socialLinks)
 ****************************************************/

async function loadSocialLinks() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    // Sidebar icons
    adminSocialIcons.forEach((icon) => {
      const network = icon.dataset.network;
      if (data[network]) {
        icon.dataset.url = data[network];
      }
    });
  } catch (err) {
    console.error("Error cargando socialLinks:", err);
  }

  adminSocialIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const url = icon.dataset.url;
      if (!url) {
        alert("No se ha configurado el enlace para esta red social.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

// Para panel de pantalla principal
async function loadSocialLinksIntoLanding() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    if (landingInstagramInput) landingInstagramInput.value = data.instagram || "";
    if (landingWhatsappLinkInput) landingWhatsappLinkInput.value = data.whatsapp || "";
    if (landingTiktokInput) landingTiktokInput.value = data.tiktok || "";
    if (landingTelegramInput) landingTelegramInput.value = data.telegram || "";
  } catch (err) {
    console.error("Error cargando socialLinks para panel landing:", err);
  }
}

// Guardar links de redes en pantalla principal
const btnSaveSocialLinks = document.getElementById("admin-btn-save-social-links");
if (btnSaveSocialLinks) {
  btnSaveSocialLinks.addEventListener("click", async () => {
    const instagram = landingInstagramInput.value.trim();
    const whatsapp = landingWhatsappLinkInput.value.trim();
    const tiktok = landingTiktokInput.value.trim();
    const telegram = landingTelegramInput.value.trim();

    const btn = btnSaveSocialLinks;
    setLoadingButton(btn, true);

    try {
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

      alert("Links de redes sociales guardados.");
      // Recargar para sidebar
      loadSocialLinks();
    } catch (err) {
      console.error(err);
      alert("No se pudieron guardar los links de redes.");
    } finally {
      setLoadingButton(btn, false, "Guardar");
    }
  });
}

/****************************************************
 * ANALYTICS BÁSICOS (administrador)
 ****************************************************/

async function loadAnalyticsSummary() {
  if (!analyticsSummaryBox || !analyticsUsersBox) return;

  try {
    const sectionsSnap = await getDocs(collection(db, "sections"));
    const examsSnap = await getDocs(collection(db, "exams"));
    const casesSnap = await getDocs(collection(db, "questions"));
    const usersSnap = await getDocs(collection(db, "users"));

    let totalCases = 0;
    let totalQuestions = 0;

    casesSnap.forEach((docSnap) => {
      totalCases += 1;
      const data = docSnap.data();
      const arr = Array.isArray(data.questions) ? data.questions : [];
      totalQuestions += arr.length;
    });

    analyticsSummaryBox.innerHTML = `
      <div class="card">
        <h3 style="font-size:16px;margin-bottom:8px;">Resumen global</h3>
        <p>Secciones: <strong>${sectionsSnap.size}</strong></p>
        <p>Exámenes: <strong>${examsSnap.size}</strong></p>
        <p>Casos clínicos: <strong>${totalCases}</strong></p>
        <p>Preguntas totales: <strong>${totalQuestions}</strong></p>
      </div>
    `;

    // Promedios de usuarios (por ahora: promedio global de sus exámenes)
    const userRows = [];
    for (const u of usersSnap.docs) {
      const userData = u.data();
      const email = userData.email || u.id;
      const name = userData.name || email;

      // Subcolección examAttempts
      const attemptsSnap = await getDocs(
        collection(db, "users", email, "examAttempts")
      );

      if (attemptsSnap.empty) continue;

      let sumScore = 0;
      let count = 0;

      attemptsSnap.forEach((a) => {
        const d = a.data();
        if (typeof d.score === "number") {
          sumScore += d.score;
          count++;
        }
      });

      const avg = count ? sumScore / count : 0;
      userRows.push({ name, email, avg, exams: count });
    }

    if (!userRows.length) {
      analyticsUsersBox.innerHTML = `
        <div class="card">
          <p>Aún no hay intentos de exámenes registrados.</p>
        </div>
      `;
      return;
    }

    let tableHtml = `
      <div class="card">
        <h3 style="font-size:16px;margin-bottom:8px;">Promedios por usuario</h3>
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Intentos</th>
              <th>Promedio ponderado</th>
            </tr>
          </thead>
          <tbody>
    `;

    userRows.forEach((u) => {
      tableHtml += `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.exams}</td>
          <td>${u.avg.toFixed(1)}%</td>
        </tr>
      `;
    });

    tableHtml += "</tbody></table></div>";
    analyticsUsersBox.innerHTML = tableHtml;
  } catch (err) {
    console.error("Error cargando analytics:", err);
    analyticsSummaryBox.innerHTML = `
      <div class="card">
        <p>No se pudieron cargar las estadísticas.</p>
      </div>
    `;
  }
}

/****************************************************
 * FIN ADMIN.JS
 ****************************************************/
console.log("admin.js cargado correctamente.");
