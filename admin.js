/****************************************************
 * ADMIN.JS - Panel de Administrador
 * Plataforma Estudiante ENARM
 *
 * Correcciones incluidas:
 * 1) PANEL "BANCO DE PREGUNTAS" (colección: questions)
 *    - Carga estable (paginada) y filtros (topic / specialty / examId)
 *    - Búsqueda por texto (caseText + preguntas + justificación) en cliente
 *    - Edición INLINE (incluye preguntas) + Guardar + Eliminar
 *    - Manejo de errores (incl. índices faltantes)
 *
 * 2) BUSCADOR "AGREGAR CASOS DESDE BANCO" en detalle de examen
 *    - Ya NO depende de miniQuestions
 *    - Busca primero por topic exacto en questions
 *    - Si no encuentra, hace fallback a una búsqueda ligera (últimos N docs) y filtra local
 *    - Permite agregar al examen y:
 *      - Incrementa usageCount en el caso del banco (questions)
 *      - Muestra el contador en resultados
 ****************************************************/

// Firebase inicializado en firebase-config.js
import { auth, db } from "./firebase-config.js";

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
  orderBy,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  startAfter,
  increment,
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
const btnNavBank = document.getElementById("admin-btn-nav-bank"); // ✅ NUEVO
const btnNavMini = document.getElementById("admin-btn-nav-mini");
const btnNavUsers = document.getElementById("admin-btn-nav-users");
const btnNavAnalytics = document.getElementById("admin-btn-nav-analytics");
const btnNavLanding = document.getElementById("admin-btn-nav-landing");
const adminSocialIcons = document.querySelectorAll(".admin-social-icon");

// Paneles principales
const panelExams = document.getElementById("admin-panel-exams");
const panelBank = document.getElementById("admin-panel-bank"); // ✅ NUEVO
const panelMini = document.getElementById("admin-panel-mini");
const panelUsers = document.getElementById("admin-panel-users");
const panelAnalytics = document.getElementById("admin-panel-analytics");
const panelLanding = document.getElementById("admin-panel-landing");

// ==================== PANEL EXÁMENES ====================
const currentSectionTitle = document.getElementById("admin-current-section-title");
const examsListEl = document.getElementById("admin-exams-list");
const btnAddExam = document.getElementById("admin-btn-add-exam");
const btnImportExamsJson = document.getElementById("admin-btn-import-exams-json");

// Vista detalle examen
const examDetailView = document.getElementById("admin-exam-detail");
const btnBackToExams = document.getElementById("admin-btn-back-to-exams");
const examTitleInput = document.getElementById("admin-exam-title-input");
const examCasesContainer = document.getElementById("admin-exam-cases");
const btnSaveExamAll = document.getElementById("admin-btn-save-exam");
const btnAddCaseTop = document.getElementById("admin-btn-add-case");
const btnImportExamJson = document.getElementById("admin-btn-import-exam");

// ==================== BUSCADOR "AGREGAR CASOS DESDE BANCO" (EN EXAMEN) ====================
const bankSearchInput = document.getElementById("admin-bank-search-input");
const bankSearchResults = document.getElementById("admin-bank-search-results");

// ==================== PANEL BANCO (questions) ====================
const bankFilterSearch = document.getElementById("admin-bank-search");
const bankFilterTopic = document.getElementById("admin-bank-topic");
const bankFilterSpecialty = document.getElementById("admin-bank-specialty");
const bankFilterExamId = document.getElementById("admin-bank-examid");

const bankBtnClear = document.getElementById("admin-bank-btn-clear");
const bankBtnRefresh = document.getElementById("admin-bank-btn-refresh");
const bankBtnApply = document.getElementById("admin-bank-btn-apply");
const bankListEl = document.getElementById("admin-bank-list");
const bankBtnLoadMore = document.getElementById("admin-bank-btn-load-more");

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

// Modal genérico
const modalOverlay = document.getElementById("admin-modal-overlay");
const modalBox = document.getElementById("admin-modal");
const modalTitle = document.getElementById("admin-modal-title");
const modalBody = document.getElementById("admin-modal-body");
const modalBtnCancel = document.getElementById("admin-modal-cancel");
const modalBtnOk = document.getElementById("admin-modal-ok");

let modalOkHandler = null;

/****************************************************
 * TOGGLE BARRA LATERAL
 ****************************************************/
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });
}

/****************************************************
 * LOGOUT ADMIN
 ****************************************************/
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Error al cerrar sesión (admin):", error);
      alert("No se pudo cerrar sesión. Intenta nuevamente.");
    }
  });
}

/****************************************************
 * ESTADO EN MEMORIA
 ****************************************************/
let currentAdminUser = null;
let currentSectionId = null;
let currentExamId = null;
let currentExamCases = [];
let examsLoadToken = 0;

// MINI EXÁMENES (se mantiene)
let miniCases = [];
let miniCasesLoadedOnce = false;

// BUSCADOR “AGREGAR CASOS DESDE BANCO” (EN EXAMEN)
let examBankFallbackCache = [];
let examBankFallbackLoadedOnce = false;
let examBankDebounceTimer = null;

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
  const panels = [panelExams, panelBank, panelMini, panelUsers, panelAnalytics, panelLanding].filter(Boolean);
  panels.forEach((p) => hide(p));

  if (panelId === "exams") show(panelExams);
  if (panelId === "bank") show(panelBank);
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

/**
 * Abre un input file y devuelve el JSON parseado al callback.
 */
function openJsonFilePicker(onLoaded) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (typeof onLoaded === "function") {
          onLoaded(json);
        }
      } catch (err) {
        console.error("JSON inválido:", err);
        alert("El archivo no contiene un JSON válido.");
      }
    };

    reader.onerror = () => {
      console.error("Error leyendo el archivo JSON.");
      alert("No se pudo leer el archivo JSON.");
    };

    reader.readAsText(file);
  });

  input.click();
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
    if (e.target === modalOverlay) closeModal();
  });
}

if (modalBtnCancel) {
  modalBtnCancel.addEventListener("click", () => closeModal());
}

if (modalBtnOk) {
  modalBtnOk.addEventListener("click", async () => {
    if (typeof modalOkHandler === "function") {
      await modalOkHandler();
    }
  });
}

/****************************************************
 * NORMALIZACIÓN / LABELS
 ****************************************************/
function normalizeText(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpecialtyLabel(key) {
  if (!key) return "";
  return SPECIALTIES && SPECIALTIES[key] ? SPECIALTIES[key] : key;
}

/****************************************************
 * VALIDACIÓN DE SESIÓN Y CARGA INICIAL (ADMIN)
 ****************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.email);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("Tu usuario no existe en la base de datos de Estudiante ENARM.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const data = userSnap.data();

    if (data.role !== "admin") {
      alert("Acceso no autorizado. Este usuario no es administrador.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentAdminUser = {
      uid: user.uid,
      email: user.email,
      ...data,
    };

    if (adminUserEmailSpan) adminUserEmailSpan.textContent = user.email;
  } catch (err) {
    console.error("Error obteniendo perfil de administrador:", err);
    alert("Error cargando datos de administrador.");
    return;
  }

  // Carga básica
  try {
    await loadSections();
  } catch (err) {
    console.error("Error cargando secciones:", err);
  }

  try {
    await loadLandingSettings();
  } catch (err) {
    console.error("Error cargando configuración de landing:", err);
  }

  console.log("admin.js cargado correctamente y panel inicializado.");
});

/****************************************************
 * NAVEGACIÓN LATERAL
 ****************************************************/
function clearSidebarActive() {
  [
    btnNavExams,
    btnNavBank,
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

if (btnNavBank) {
  btnNavBank.addEventListener("click", () => {
    clearSidebarActive();
    btnNavBank.classList.add("sidebar-btn--active");
    setActivePanel("bank");
    sidebar.classList.remove("sidebar--open");
    loadBankPanel(true);
  });
}

if (btnNavMini) {
  btnNavMini.addEventListener("click", () => {
    clearSidebarActive();
    btnNavMini.classList.add("sidebar-btn--active");
    setActivePanel("mini");
    sidebar.classList.remove("sidebar--open");
    loadMiniCases();
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

  const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(qSec);
  sectionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(sectionsList, "No hay secciones. Crea la primera.");
    currentSectionId = null;
    if (currentSectionTitle) currentSectionTitle.textContent = "Sin secciones";
    if (examsListEl) examsListEl.innerHTML = "";
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

    li.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("admin-edit-section") ||
        e.target.classList.contains("admin-delete-section")
      ) return;
      selectSection(id, name);
    });

    li.querySelector(".admin-edit-section").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditSectionModal(id, name);
    });

    li.querySelector(".admin-delete-section").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = window.confirm("¿Eliminar esta sección y TODOS los exámenes y casos clínicos asociados?");
      if (!ok) return;
      await deleteSectionWithAllData(id);
      await loadSections();
      if (currentSectionId === id) {
        currentSectionId = null;
        if (currentSectionTitle) currentSectionTitle.textContent = "Sin sección seleccionada";
        if (examsListEl) examsListEl.innerHTML = "";
      }
    });

    // Drag & drop
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      li.classList.add("dragging");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
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

    if (first) {
      first = false;
      selectSection(id, name);
      li.classList.add("sidebar__section-item--active");
    }
  });
}

function selectSection(id, name) {
  currentSectionId = id;
  if (currentSectionTitle) currentSectionTitle.textContent = name || "Sección";

  sectionsList
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));

  const activeLi = sectionsList.querySelector(`.sidebar__section-item[data-section-id="${id}"]`);
  if (activeLi) activeLi.classList.add("sidebar__section-item--active");

  loadExamsForSection(id);
}

async function saveSectionsOrder() {
  if (!sectionsList) return;
  const items = Array.from(sectionsList.querySelectorAll(".sidebar__section-item"));
  const batchUpdates = items.map((li, index) => updateDoc(doc(db, "sections", li.dataset.sectionId), { order: index }));
  try {
    await Promise.all(batchUpdates);
  } catch (err) {
    console.error("Error actualizando orden de secciones:", err);
  }
}

async function deleteSectionWithAllData(sectionId) {
  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const exSnap = await getDocs(qEx);

  for (const ex of exSnap.docs) {
    const examId = ex.id;

    const qCases = query(collection(db, "questions"), where("examId", "==", examId));
    const caseSnap = await getDocs(qCases);

    for (const c of caseSnap.docs) await deleteDoc(c.ref);
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
      setLoadingButton(modalBtnOk, true);
      try {
        await updateDoc(doc(db, "sections", sectionId), { name });
        await loadSections();
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar la sección.");
      } finally {
        setLoadingButton(modalBtnOk, false, "Guardar");
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

        setLoadingButton(modalBtnOk, true);

        try {
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
          setLoadingButton(modalBtnOk, false, "Guardar");
        }
      },
    });
  });
}

/**
 * Devuelve el ID de la sección por nombre; si no existe, la crea.
 */
async function getOrCreateSectionByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("sectionName vacío en JSON.");

  const qByName = query(collection(db, "sections"), where("name", "==", trimmed));
  const snap = await getDocs(qByName);
  if (!snap.empty) return snap.docs[0].id;

  const all = await getDocs(collection(db, "sections"));
  const order = all.size;

  const ref = await addDoc(collection(db, "sections"), {
    name: trimmed,
    order,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/****************************************************
 * EXÁMENES (LISTA POR SECCIÓN)
 ****************************************************/
async function loadExamsForSection(sectionId) {
  if (!examsListEl) return;
  examsListEl.innerHTML = "";

  const thisLoadToken = ++examsLoadToken;

  const qEx = query(collection(db, "exams"), where("sectionId", "==", sectionId));
  const snap = await getDocs(qEx);

  if (thisLoadToken !== examsLoadToken || sectionId !== currentSectionId) return;

  if (snap.empty) {
    renderEmptyMessage(examsListEl, "No hay exámenes en esta sección. Crea el primero.");
    return;
  }

  const sortedDocs = snap.docs.slice().sort((a, b) => {
    const nameA = (a.data().name || "").toString();
    const nameB = (b.data().name || "").toString();
    return nameA.localeCompare(nameB, "es", { numeric: true, sensitivity: "base" });
  });

  sortedDocs.forEach((docSnap) => {
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

    card.querySelector(".admin-open-exam").addEventListener("click", () => openExamDetail(examId, name));

    card.querySelector(".admin-edit-exam").addEventListener("click", () => openEditExamNameModal(examId, name));

    card.querySelector(".admin-delete-exam").addEventListener("click", async () => {
      const ok = window.confirm("¿Eliminar este examen y todos sus casos clínicos?");
      if (!ok) return;

      const qCases = query(collection(db, "questions"), where("examId", "==", examId));
      const snapCases = await getDocs(qCases);
      for (const c of snapCases.docs) await deleteDoc(c.ref);

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

        setLoadingButton(modalBtnOk, true);

        try {
          const docRef = await addDoc(collection(db, "exams"), {
            name,
            sectionId: currentSectionId,
            createdAt: serverTimestamp(),
          });
          await loadExamsForSection(currentSectionId);
          closeModal();
          openExamDetail(docRef.id, name);
        } catch (err) {
          console.error(err);
          alert("No se pudo crear el examen.");
        } finally {
          setLoadingButton(modalBtnOk, false, "Guardar");
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
      setLoadingButton(modalBtnOk, true);
      try {
        await updateDoc(doc(db, "exams", examId), { name, updatedAt: serverTimestamp() });
        await loadExamsForSection(currentSectionId);
        if (currentExamId === examId && examTitleInput) examTitleInput.value = name;
        closeModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo actualizar el examen.");
      } finally {
        setLoadingButton(modalBtnOk, false, "Guardar");
      }
    },
  });
}

/**
 * Importar varios exámenes desde un JSON
 */
async function importExamsFromJson(json) {
  let examsArray = [];

  if (Array.isArray(json)) examsArray = json;
  else if (json && Array.isArray(json.exams)) examsArray = json.exams;

  if (!examsArray.length) {
    alert("El JSON no contiene ningún examen (se esperaba un arreglo).");
    return;
  }

  const ok = window.confirm(`Se crearán ${examsArray.length} exámenes nuevos a partir del JSON.\n\n¿Continuar?`);
  if (!ok) return;

  for (const examSpec of examsArray) {
    const sectionName = examSpec.sectionName || examSpec.section || null;
    const examName = examSpec.examName || examSpec.name || "Examen sin título";

    if (!sectionName) continue;

    const sectionId = await getOrCreateSectionByName(sectionName);

    const examRef = await addDoc(collection(db, "exams"), {
      name: examName,
      sectionId,
      createdAt: serverTimestamp(),
    });
    const examId = examRef.id;

    const casesArr = Array.isArray(examSpec.cases) ? examSpec.cases : [];

    for (const caseSpec of casesArr) {
      const caseText = caseSpec.caseText || caseSpec.case || "";
      const specialty = caseSpec.specialty || "";
      const topic = (caseSpec.topic || "").toString().trim();

      const questionsSrc = Array.isArray(caseSpec.questions) ? caseSpec.questions : [];
      const questionsFormatted = questionsSrc
        .map((q) => ({
          questionText: q.questionText || q.question || "",
          optionA: q.optionA || q.a || "",
          optionB: q.optionB || q.b || "",
          optionC: q.optionC || q.c || "",
          optionD: q.optionD || q.d || "",
          correctOption: q.correctOption || q.correct || q.answer || "",
          subtype: q.subtype || "salud_publica",
          difficulty: q.difficulty || "media",
          justification: q.justification || q.explanation || "",
        }))
        .filter(
          (q) =>
            q.questionText &&
            q.optionA &&
            q.optionB &&
            q.optionC &&
            q.optionD &&
            q.correctOption &&
            q.justification
        );

      if (!caseText || !questionsFormatted.length) continue;

      await addDoc(collection(db, "questions"), {
        examId,
        caseText,
        specialty,
        topic,
        questions: questionsFormatted,
        createdAt: serverTimestamp(),
      });
    }
  }

  alert("Importación de exámenes desde JSON completada.");

  await loadSections();
  if (currentSectionId) await loadExamsForSection(currentSectionId);
}

if (btnImportExamsJson) {
  btnImportExamsJson.addEventListener("click", () => {
    openJsonFilePicker(async (json) => {
      try {
        await importExamsFromJson(json);
      } catch (err) {
        console.error("Error importando exámenes desde JSON:", err);
        alert("Hubo un error al importar los exámenes. Revisa la consola.");
      }
    });
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
    topic: "",
    questions: [createEmptyQuestion()],
  };
}

/**
 * Sincroniza currentExamCases con TODO lo escrito en el DOM actual.
 */
function syncCurrentExamCasesFromDOM() {
  if (!examCasesContainer) return;

  const caseBlocks = examCasesContainer.querySelectorAll(".exam-case-block");
  const newCases = [];

  caseBlocks.forEach((block) => {
    const caseText = block.querySelector(".admin-case-text")?.value.trim() || "";
    const specialty = block.querySelector(".admin-case-specialty")?.value || "";
    const topic = block.querySelector(".admin-case-topic")?.value.trim() || "";

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText = qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption = qb.querySelector(".admin-q-correct")?.value || "";
      const subtype = qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty = qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification = qb.querySelector(".admin-q-justification")?.value.trim() || "";

      const allEmpty = !questionText && !optionA && !optionB && !optionC && !optionD && !justification;
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

    if (!caseText && !questions.length) return;

    newCases.push({
      caseText,
      specialty,
      topic,
      questions: questions.length ? questions : [createEmptyQuestion()],
    });
  });

  currentExamCases = newCases.length > 0 ? newCases : [createEmptyCase()];
}

async function openExamDetail(examId, examName) {
  currentExamId = examId;
  currentExamCases = [];

  show(panelExams);
  show(examDetailView);

  resetExamBankSearchUI();

  if (examTitleInput) examTitleInput.value = examName || "";
  if (examCasesContainer) examCasesContainer.innerHTML = "";

  const qCases = query(collection(db, "questions"), where("examId", "==", examId));
  const snap = await getDocs(qCases);

  if (snap.empty) {
    currentExamCases = [createEmptyCase()];
  } else {
    currentExamCases = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      topic: (d.data()?.topic || "").toString(),
    }));
  }

  renderExamCases();
}

function renderExamCases() {
  if (!examCasesContainer) return;
  examCasesContainer.innerHTML = "";

  if (!currentExamCases.length) currentExamCases.push(createEmptyCase());

  currentExamCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card exam-case-block";
    wrapper.dataset.caseIndex = index;

    const specialtyValue = caseData.specialty || "";
    const topicValue = (caseData.topic || "").toString();
    const questionsArr = Array.isArray(caseData.questions) ? caseData.questions : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">Caso clínico ${index + 1}</h3>
        <button type="button" class="btn btn-sm btn-outline admin-delete-case">Eliminar caso clínico</button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-case-specialty">
          <option value="">Selecciona...</option>
          ${Object.entries(SPECIALTIES)
            .map(([key, label]) => `<option value="${key}" ${key === specialtyValue ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>Tema (topic)</span>
        <input type="text" class="admin-case-topic" value="${topicValue.replace(/"/g, "&quot;")}" />
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-add-question">+ Agregar pregunta</button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-case-questions");

    if (!questionsArr.length) qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    else questionsArr.forEach((qData) => qContainer.appendChild(renderQuestionBlock(qData)));

    wrapper.querySelector(".admin-add-question").addEventListener("click", () => {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    });

    wrapper.querySelector(".admin-delete-case").addEventListener("click", () => {
      const idx = parseInt(wrapper.dataset.caseIndex, 10);
      if (Number.isNaN(idx)) return;
      syncCurrentExamCasesFromDOM();
      currentExamCases.splice(idx, 1);
      renderExamCases();
    });

    examCasesContainer.appendChild(wrapper);
  });

  const bottomActions = document.createElement("div");
  bottomActions.className = "flex-row";
  bottomActions.style.justifyContent = "flex-end";
  bottomActions.style.marginTop = "16px";

  bottomActions.innerHTML = `
    <button type="button" class="btn btn-secondary" id="admin-btn-add-case-bottom">+ Agregar caso clínico</button>
    <button type="button" class="btn btn-primary" id="admin-btn-save-exam-bottom">Guardar examen</button>
  `;

  examCasesContainer.appendChild(bottomActions);

  const btnAddCaseBottom = document.getElementById("admin-btn-add-case-bottom");
  const btnSaveExamBottom = document.getElementById("admin-btn-save-exam-bottom");

  if (btnAddCaseBottom) {
    btnAddCaseBottom.addEventListener("click", () => {
      if (!currentExamId) {
        alert("Primero abre un examen.");
        return;
      }
      syncCurrentExamCasesFromDOM();
      currentExamCases.push(createEmptyCase());
      renderExamCases();
    });
  }

  if (btnSaveExamBottom && btnSaveExamAll) {
    btnSaveExamBottom.addEventListener("click", () => btnSaveExamAll.click());
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

    <label class="field"><span>Opción A</span><input type="text" class="admin-q-a" value="${optionA}" /></label>
    <label class="field"><span>Opción B</span><input type="text" class="admin-q-b" value="${optionB}" /></label>
    <label class="field"><span>Opción C</span><input type="text" class="admin-q-c" value="${optionC}" /></label>
    <label class="field"><span>Opción D</span><input type="text" class="admin-q-d" value="${optionD}" /></label>

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
          .map(([key, label]) => `<option value="${key}" ${key === subtype ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </label>

    <label class="field">
      <span>Dificultad</span>
      <select class="admin-q-difficulty">
        ${Object.entries(DIFFICULTIES)
          .map(([key, label]) => `<option value="${key}" ${key === difficulty ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </label>

    <label class="field">
      <span>Justificación</span>
      <textarea class="admin-q-justification" rows="2">${justification}</textarea>
    </label>

    <div style="text-align:right;margin-top:6px;">
      <button type="button" class="btn btn-sm btn-outline admin-delete-question">Eliminar pregunta</button>
    </div>
  `;

  card.querySelector(".admin-delete-question").addEventListener("click", () => card.remove());
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
    resetExamBankSearchUI();
    if (currentSectionId) loadExamsForSection(currentSectionId);
  });
}

// Guardar examen
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
      const topic = block.querySelector(".admin-case-topic")?.value.trim() || "";

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
        const justification = qb.querySelector(".admin-q-justification").value.trim();

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
          subtype,
          difficulty,
          justification,
        });
      }

      casesToSave.push({ caseText, specialty, topic, questions });
    }

    setLoadingButton(btnSaveExamAll, true, "Guardar examen");

    try {
      await updateDoc(doc(db, "exams", currentExamId), {
        name: newName,
        updatedAt: serverTimestamp(),
      });

      // Eliminar casos previos del examen
      const qPrev = query(collection(db, "questions"), where("examId", "==", currentExamId));
      const prevSnap = await getDocs(qPrev);
      for (const c of prevSnap.docs) await deleteDoc(c.ref);

      // Guardar casos nuevos del examen
      for (const c of casesToSave) {
        await addDoc(collection(db, "questions"), {
          examId: currentExamId,
          caseText: c.caseText,
          specialty: c.specialty,
          topic: c.topic || "",
          questions: c.questions,
          createdAt: serverTimestamp(),
        });
      }

      alert("Examen guardado correctamente.");
      if (currentSectionId) await loadExamsForSection(currentSectionId);
    } catch (err) {
      console.error(err);
      alert("Hubo un error al guardar el examen.");
    } finally {
      setLoadingButton(btnSaveExamAll, false, "Guardar examen");
    }
  });
}

// Botón "Agregar caso clínico" superior
if (btnAddCaseTop) {
  btnAddCaseTop.addEventListener("click", () => {
    if (!currentExamId) {
      alert("Primero abre un examen.");
      return;
    }
    syncCurrentExamCasesFromDOM();
    currentExamCases.push(createEmptyCase());
    renderExamCases();
  });
}

/**
 * Importar un solo examen (JSON) al formulario del examen abierto.
 */
function normalizeQuestionFromJson(raw) {
  return {
    questionText: raw.questionText || raw.question || "",
    optionA: raw.optionA || raw.a || "",
    optionB: raw.optionB || raw.b || "",
    optionC: raw.optionC || raw.c || "",
    optionD: raw.optionD || raw.d || "",
    correctOption: raw.correctOption || raw.correct || raw.answer || "",
    subtype: raw.subtype || "salud_publica",
    difficulty: raw.difficulty || "media",
    justification: raw.justification || raw.explanation || "",
  };
}

function loadExamFromJsonIntoUI(json) {
  const examName = (json && (json.examName || json.name)) || (examTitleInput ? examTitleInput.value : "");
  if (examTitleInput && examName) examTitleInput.value = examName;

  let casesArr = [];
  if (Array.isArray(json)) casesArr = json;
  else if (Array.isArray(json.cases)) casesArr = json.cases;
  else {
    alert("El JSON debe ser un objeto con propiedad 'cases' o un arreglo de casos clínicos.");
    return;
  }

  if (!casesArr.length) {
    alert("El JSON no contiene casos clínicos.");
    return;
  }

  currentExamCases = casesArr.map((c) => {
    const caseText = c.caseText || c.case || "";
    const specialty = c.specialty || "";
    const topic = (c.topic || "").toString().trim();
    const qsRaw = Array.isArray(c.questions) ? c.questions : [];
    const questions = qsRaw.length > 0 ? qsRaw.map((q) => normalizeQuestionFromJson(q)) : [createEmptyQuestion()];
    return { caseText, specialty, topic, questions };
  });

  renderExamCases();
}

if (btnImportExamJson) {
  btnImportExamJson.addEventListener("click", () => {
    if (!examDetailView || examDetailView.classList.contains("hidden")) {
      alert("Abre primero un examen para poder importar.");
      return;
    }

    openJsonFilePicker((json) => {
      try {
        loadExamFromJsonIntoUI(json);
      } catch (err) {
        console.error("Error cargando examen desde JSON:", err);
        alert("No se pudo cargar el examen desde el JSON.");
      }
    });
  });
}

/****************************************************
 * BUSCADOR EN EXAMEN: AGREGAR CASOS DESDE BANCO (questions)
 ****************************************************/
function resetExamBankSearchUI() {
  if (bankSearchInput) bankSearchInput.value = "";
  if (bankSearchResults) bankSearchResults.innerHTML = "";
}

async function loadExamBankFallbackCacheIfNeeded() {
  if (examBankFallbackLoadedOnce) return;

  // Cache “ligero”: últimos 600 docs, para fallback local
  try {
    const snap = await getDocs(query(collection(db, "questions"), orderBy("createdAt", "desc"), limit(600)));
    examBankFallbackCache = snap.docs.map((d) => {
      const data = d.data() || {};
      const qs = Array.isArray(data.questions) ? data.questions : [];
      return {
        id: d.id,
        examId: data.examId || null,
        caseText: data.caseText || "",
        specialty: data.specialty || "",
        topic: data.topic || "",
        usageCount: typeof data.usageCount === "number" ? data.usageCount : 0,
        questions: qs,
        _norm: normalizeText(
          `${data.topic || ""} ${data.caseText || ""} ${qs.map((q) => q.questionText || "").join(" ")}`
        ),
      };
    });

    examBankFallbackLoadedOnce = true;
  } catch (e) {
    console.error("Error cargando cache fallback del banco:", e);
    examBankFallbackCache = [];
    examBankFallbackLoadedOnce = false;
  }
}

function renderExamBankSearchResults(results, rawQuery) {
  if (!bankSearchResults) return;

  const queryText = (rawQuery || "").trim();
  if (!queryText) {
    renderEmptyMessage(bankSearchResults, "Escribe un tema para buscar.");
    return;
  }

  if (!results.length) {
    renderEmptyMessage(bankSearchResults, "Sin resultados.");
    return;
  }

  const html = results
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
      const usage = typeof c.usageCount === "number" ? c.usageCount : 0;
      const snippet = (c.caseText || "").slice(0, 220);

      return `
        <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">
                ${specLabel ? specLabel : "Caso"}
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${qCount} pregunta${qCount === 1 ? "" : "s"} · Uso: ${usage}
              </div>
            </div>
            <button class="btn btn-sm btn-primary admin-bank-add-case" data-id="${c.id}">
              Agregar a este examen
            </button>
          </div>
          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .join("");

  bankSearchResults.innerHTML = html;

  bankSearchResults.querySelectorAll(".admin-bank-add-case").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const found = results.find((x) => x.id === id);
      if (!found) return;

      if (!currentExamId) {
        alert("Primero abre un examen.");
        return;
      }

      syncCurrentExamCasesFromDOM();

      const cloned = {
        caseText: found.caseText || "",
        specialty: found.specialty || "",
        topic: (found.topic || "").toString(),
        questions: Array.isArray(found.questions)
          ? found.questions.map((q) => ({
              questionText: q.questionText || "",
              optionA: q.optionA || "",
              optionB: q.optionB || "",
              optionC: q.optionC || "",
              optionD: q.optionD || "",
              correctOption: q.correctOption || "",
              justification: q.justification || "",
              subtype: q.subtype || "salud_publica",
              difficulty: q.difficulty || "media",
            }))
          : [createEmptyQuestion()],
      };

      currentExamCases.push(cloned);
      renderExamCases();

      // Incrementar contador en el caso del banco (questions)
      try {
        await updateDoc(doc(db, "questions", id), {
          usageCount: increment(1),
          updatedAt: serverTimestamp(),
        });

        // reflejo inmediato
        found.usageCount = (found.usageCount || 0) + 1;
        btn.textContent = "Agregado";
        btn.disabled = true;
      } catch (e) {
        console.error("No se pudo incrementar usageCount:", e);
        btn.textContent = "Agregado";
        btn.disabled = true;
      }
    });
  });
}

async function searchExamBankByTopicFirst(raw) {
  const topic = (raw || "").trim();
  if (!topic) return [];

  // 1) Búsqueda exacta por topic en Firestore (rápida)
  try {
    const snap = await getDocs(
      query(collection(db, "questions"), where("topic", "==", topic), orderBy("createdAt", "desc"), limit(20))
    );

    const rows = snap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          examId: data.examId || null,
          caseText: data.caseText || "",
          specialty: data.specialty || "",
          topic: data.topic || "",
          usageCount: typeof data.usageCount === "number" ? data.usageCount : 0,
          questions: Array.isArray(data.questions) ? data.questions : [],
        };
      })
      // por defecto, no mezclar con casos que ya son de exámenes (si tienen examId)
      .filter((r) => !r.examId);

    if (rows.length) return rows;
  } catch (e) {
    // si falta índice, cae al fallback local
    console.error("Búsqueda exacta por topic falló (posible índice):", e);
  }

  // 2) Fallback: cache local ligera y filtro por tokens
  await loadExamBankFallbackCacheIfNeeded();
  const q = normalizeText(topic);
  const tokens = q.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return [];

  const results = [];
  for (const c of examBankFallbackCache) {
    if (c.examId) continue; // por defecto solo banco general
    const ok = tokens.every((t) => c._norm.includes(t));
    if (ok) results.push(c);
    if (results.length >= 20) break;
  }

  return results;
}

function initExamBankSearchUI() {
  if (!bankSearchInput || !bankSearchResults) return;

  if (bankSearchInput.dataset.bound === "1") return;
  bankSearchInput.dataset.bound = "1";

  bankSearchInput.addEventListener("input", () => {
    if (examBankDebounceTimer) clearTimeout(examBankDebounceTimer);
    examBankDebounceTimer = setTimeout(async () => {
      const raw = bankSearchInput.value || "";
      if (!raw.trim()) {
        renderEmptyMessage(bankSearchResults, "Escribe un tema para buscar.");
        return;
      }

      bankSearchResults.innerHTML = `
        <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
          Buscando…
        </div>
      `;

      const res = await searchExamBankByTopicFirst(raw.trim());
      renderExamBankSearchResults(res, raw.trim());
    }, 260);
  });
}
initExamBankSearchUI();

/****************************************************
 * MINI EXÁMENES – BANCO GLOBAL (colección miniQuestions)
 * (Se mantiene igual)
 ****************************************************/
const miniCasesContainer = document.getElementById("admin-mini-cases");
const btnMiniAddCase = document.getElementById("admin-mini-btn-add-case");
const btnMiniSaveAll = document.getElementById("admin-mini-btn-save-all");

function syncMiniCasesFromDOM() {
  if (!miniCasesContainer) return;

  const caseBlocks = miniCasesContainer.querySelectorAll(".mini-case-block");
  const newCases = [];

  caseBlocks.forEach((block) => {
    const idx = parseInt(block.dataset.caseIndex, 10);
    const prev = !Number.isNaN(idx) && miniCases[idx] ? miniCases[idx] : {};

    const caseText = block.querySelector(".admin-mini-case-text")?.value.trim() || "";
    const specialty = block.querySelector(".admin-mini-case-specialty")?.value || "";

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText = qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption = qb.querySelector(".admin-q-correct")?.value || "A";
      const subtype = qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty = qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification = qb.querySelector(".admin-q-justification")?.value.trim() || "";

      const allEmpty = !questionText && !optionA && !optionB && !optionC && !optionD && !justification;
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

    if (!caseText && !questions.length) return;

    newCases.push({
      id: prev.id || null,
      caseText,
      specialty,
      questions,
    });
  });

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

async function loadMiniCases() {
  if (!miniCasesContainer) return;

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
        questions: Array.isArray(data.questions) && data.questions.length ? data.questions : [createEmptyQuestion()],
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

function renderMiniCases() {
  if (!miniCasesContainer) return;
  miniCasesContainer.innerHTML = "";

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
    const questionsArr = Array.isArray(caseData.questions) ? caseData.questions : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;">Caso clínico global ${index + 1}</h3>
        <button type="button" class="btn btn-sm btn-outline admin-mini-delete-case">Eliminar caso</button>
      </div>

      <label class="field">
        <span>Especialidad</span>
        <select class="admin-mini-case-specialty">
          <option value="">Selecciona…</option>
          ${Object.entries(SPECIALTIES)
            .map(([key, label]) => `<option value="${key}" ${key === specialtyValue ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </label>

      <label class="field">
        <span>Texto del caso clínico</span>
        <textarea class="admin-mini-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </label>

      <div class="cards-list admin-mini-case-questions"></div>

      <div class="flex-row" style="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-mini-add-question">+ Agregar pregunta</button>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-mini-case-questions");

    if (!questionsArr.length) qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    else questionsArr.forEach((qData) => qContainer.appendChild(renderQuestionBlock(qData)));

    wrapper.querySelector(".admin-mini-add-question").addEventListener("click", () => {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    });

    wrapper.querySelector(".admin-mini-delete-case").addEventListener("click", () => {
      const idx = parseInt(wrapper.dataset.caseIndex, 10);
      if (Number.isNaN(idx)) return;
      miniCases.splice(idx, 1);
      renderMiniCases();
    });

    miniCasesContainer.appendChild(wrapper);
  });

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

if (btnMiniAddCase && miniCasesContainer) {
  btnMiniAddCase.addEventListener("click", () => {
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

async function handleSaveMiniBank() {
  if (!miniCasesContainer) return;

  syncMiniCasesFromDOM();

  if (!miniCases.length) {
    if (!confirm("No hay casos en el banco. Si continúas, se eliminarán todos los casos previos. ¿Continuar?")) return;
  }

  for (const c of miniCases) {
    if (!c.caseText.trim()) {
      alert("Escribe el texto del caso clínico en todos los casos.");
      return;
    }
    if (!c.questions.length) {
      alert("Cada caso clínico del banco debe tener al menos una pregunta.");
      return;
    }
    for (const q of c.questions) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctOption || !q.justification) {
        alert("Completa todos los campos en todas las preguntas del banco.");
        return;
      }
    }
  }

  if (btnMiniSaveAll) setLoadingButton(btnMiniSaveAll, true, "Guardar banco");

  try {
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    for (const d of prevSnap.docs) await deleteDoc(d.ref);

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
    if (btnMiniSaveAll) setLoadingButton(btnMiniSaveAll, false, "Guardar banco");
  }
}

if (btnMiniSaveAll && miniCasesContainer) {
  btnMiniSaveAll.addEventListener("click", handleSaveMiniBank);
}

/****************************************************
 * USUARIOS (CRUD)
 ****************************************************/
async function loadUsers() {
  if (!usersTableContainer) return;

  const snap = await getDocs(collection(db, "users"));

  if (snap.empty) {
    usersTableContainer.innerHTML = "";
    renderEmptyMessage(usersTableContainer, "No hay usuarios creados. Usa el formulario superior para crear uno.");
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
    const chipStatusClass = status === "activo" ? "chip--activo" : "chip--inactivo";

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

  usersTableContainer.querySelectorAll("tr[data-id]").forEach((row) => attachUserRowEvents(row));
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

      alert("Usuario creado en Firestore.\nRecuerda crearlo también en Firebase Authentication manualmente.");

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
        <label class="field"><span>Nombre</span><input type="text" id="modal-user-name" value="${data.name || ""}" /></label>
        <label class="field"><span>Correo (ID)</span><input type="email" id="modal-user-email" value="${data.email || userId}" readonly /></label>
        <label class="field"><span>Contraseña (referencia)</span><input type="text" id="modal-user-password" value="${data.password || ""}" /></label>
        <label class="field">
          <span>Rol</span>
          <select id="modal-user-role">
            <option value="admin" ${data.role === "admin" ? "selected" : ""}>Administrador</option>
            <option value="usuario" ${data.role === "usuario" ? "selected" : ""}>Usuario</option>
          </select>
        </label>
        <label class="field">
          <span>Estado</span>
          <select id="modal-user-status">
            <option value="activo" ${data.status === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${data.status === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </label>
        <label class="field"><span>Fecha de vencimiento</span><input type="date" id="modal-user-expiry" value="${data.expiryDate || ""}" /></label>
      `,
      onOk: async () => {
        const name = document.getElementById("modal-user-name").value.trim();
        const email = document.getElementById("modal-user-email").value.trim();
        const password = document.getElementById("modal-user-password").value.trim();
        const role = document.getElementById("modal-user-role").value;
        const status = document.getElementById("modal-user-status").value;
        const expiry = document.getElementById("modal-user-expiry").value || "";

        if (!name || !email) {
          alert("Nombre y correo son obligatorios.");
          return;
        }

        setLoadingButton(modalBtnOk, true);

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
          setLoadingButton(modalBtnOk, false, "Guardar");
        }
      },
    });
  });
}

/****************************************************
 * PANTALLA PRINCIPAL / LANDING
 ****************************************************/
async function loadLandingSettings() {
  if (!landingTextArea) return;

  try {
    const ref = doc(db, "settings", "landingPage");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      landingTextArea.value = "";
      monthlyLabelInput.value = "";
      monthlyPriceInput.value = "0";
      enarmLabelInput.value = "";
      enarmPriceInput.value = "0";
      whatsappPhoneInput.value = "";
      return;
    }

    const data = snap.data();

    landingTextArea.value = data.description || "";
    monthlyLabelInput.value = data.monthlyLabel || "";
    monthlyPriceInput.value = data.monthlyPrice || "0";
    enarmLabelInput.value = data.enarmLabel || "";
    enarmPriceInput.value = data.enarmPrice || "0";
    whatsappPhoneInput.value = data.whatsappPhone || "";
  } catch (err) {
    console.error("Error cargando landingPage:", err);
  }
}

if (btnSaveLanding) {
  btnSaveLanding.addEventListener("click", async () => {
    if (!landingTextArea) return;

    const description = landingTextArea.value.trim();
    const monthlyLabel = monthlyLabelInput.value.trim();
    const monthlyPrice = monthlyPriceInput.value.trim() || "0";
    const enarmLabel = enarmLabelInput.value.trim();
    const enarmPrice = enarmPriceInput.value.trim() || "0";
    const whatsappPhone = whatsappPhoneInput.value.trim();

    setLoadingButton(btnSaveLanding, true);

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
      setLoadingButton(btnSaveLanding, false, "Guardar");
    }
  });
}

/****************************************************
 * SOCIAL LINKS
 ****************************************************/
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

const btnSaveSocialLinks = document.getElementById("admin-btn-save-social-links");
if (btnSaveSocialLinks) {
  btnSaveSocialLinks.addEventListener("click", async () => {
    const instagram = landingInstagramInput.value.trim();
    const whatsapp = landingWhatsappLinkInput.value.trim();
    const tiktok = landingTiktokInput.value.trim();
    const telegram = landingTelegramInput.value.trim();

    setLoadingButton(btnSaveSocialLinks, true);

    try {
      await setDoc(
        doc(db, "settings", "socialLinks"),
        { instagram, whatsapp, tiktok, telegram, updatedAt: serverTimestamp() },
        { merge: true }
      );

      alert("Links de redes sociales guardados.");
    } catch (err) {
      console.error(err);
      alert("No se pudieron guardar los links de redes.");
    } finally {
      setLoadingButton(btnSaveSocialLinks, false, "Guardar");
    }
  });
}

/****************************************************
 * ANALYTICS BÁSICOS
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

    analyticsUsersBox.innerHTML = `
      <div class="card">
        <p>Panel de promedios por usuario (si aplica) se mantiene.</p>
      </div>
    `;
  } catch (err) {
    console.error("Error cargando analytics:", err);
    analyticsSummaryBox.innerHTML = `<div class="card"><p>No se pudieron cargar las estadísticas.</p></div>`;
  }
}

/****************************************************
 * BANCO (questions) – LISTA + FILTROS + EDICIÓN INLINE
 ****************************************************/
let bankPageLastDoc = null;
let bankPageHasMore = true;
let bankCurrentBaseRows = [];
let bankIsLoading = false;

function bankNormalize(str) {
  return normalizeText(str);
}

function getBankFilters() {
  return {
    searchText: (bankFilterSearch?.value || "").trim(),
    topic: (bankFilterTopic?.value || "").trim(),
    specialty: (bankFilterSpecialty?.value || "").trim(),
    examId: (bankFilterExamId?.value || "").trim(),
  };
}

// Query Firestore con wheres exactos (lo demás se filtra en cliente)
function buildBankFirestoreQuery({ topic, specialty, examId }, cursorDoc) {
  const wheres = [];

  // NOTA: topic/especialidad/examId son filtros exactos
  if (topic) wheres.push(where("topic", "==", topic));
  if (specialty) wheres.push(where("specialty", "==", specialty));
  if (examId) wheres.push(where("examId", "==", examId));

  const parts = [
    collection(db, "questions"),
    ...wheres,
    orderBy("createdAt", "desc"),
    limit(25),
  ];

  if (cursorDoc) parts.splice(parts.length - 1, 0, startAfter(cursorDoc));
  return query(...parts);
}

function renderBankError(msg) {
  if (!bankListEl) return;
  bankListEl.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#fecaca;border:1px solid rgba(248,113,113,.35);">
      ${msg || "Error cargando banco. Revisa consola."}
    </div>
  `;
}

function bankRowToHaystack(row) {
  const caseText = bankNormalize(row.caseText || "");
  const qs = Array.isArray(row.questions) ? row.questions : [];
  const qText = bankNormalize(qs.map((q) => q.questionText || "").join(" "));
  const just = bankNormalize(qs.map((q) => q.justification || "").join(" "));
  const topic = bankNormalize(row.topic || "");
  return `${topic} ${caseText} ${qText} ${just}`;
}

function applyLocalTextFilter(rows, searchText) {
  const s = bankNormalize(searchText);
  if (!s) return rows;

  const tokens = s.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return rows;

  return rows.filter((r) => {
    const hay = bankRowToHaystack(r);
    return tokens.every((t) => hay.includes(t));
  });
}

function renderBankList(rows) {
  if (!bankListEl) return;

  if (!rows.length) {
    renderEmptyMessage(bankListEl, "No hay casos con esos filtros.");
    return;
  }

  const html = rows
    .map((r) => {
      const specLabel = getSpecialtyLabel(r.specialty);
      const qArr = Array.isArray(r.questions) ? r.questions : [];
      const usage = typeof r.usageCount === "number" ? r.usageCount : 0;

      const questionsHtml = qArr
        .map((q, idx) => {
          return `
            <div class="card-item" style="border:1px solid rgba(148,163,184,.18);">
              <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">Pregunta ${idx + 1}</div>

              <label class="field">
                <span>Pregunta</span>
                <textarea class="bank-q-question" data-qindex="${idx}" rows="2">${q.questionText || ""}</textarea>
              </label>

              <div class="create-user-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
                <label class="field"><span>Opción A</span>
                  <input class="bank-q-a" data-qindex="${idx}" type="text" value="${(q.optionA || "").replace(/"/g, "&quot;")}" />
                </label>
                <label class="field"><span>Opción B</span>
                  <input class="bank-q-b" data-qindex="${idx}" type="text" value="${(q.optionB || "").replace(/"/g, "&quot;")}" />
                </label>
                <label class="field"><span>Opción C</span>
                  <input class="bank-q-c" data-qindex="${idx}" type="text" value="${(q.optionC || "").replace(/"/g, "&quot;")}" />
                </label>
                <label class="field"><span>Opción D</span>
                  <input class="bank-q-d" data-qindex="${idx}" type="text" value="${(q.optionD || "").replace(/"/g, "&quot;")}" />
                </label>
              </div>

              <div class="create-user-grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <label class="field"><span>Correcta</span>
                  <select class="bank-q-correct" data-qindex="${idx}">
                    <option value="">Selecciona</option>
                    <option value="A" ${q.correctOption === "A" ? "selected" : ""}>A</option>
                    <option value="B" ${q.correctOption === "B" ? "selected" : ""}>B</option>
                    <option value="C" ${q.correctOption === "C" ? "selected" : ""}>C</option>
                    <option value="D" ${q.correctOption === "D" ? "selected" : ""}>D</option>
                  </select>
                </label>

                <label class="field"><span>Subtype</span>
                  <select class="bank-q-subtype" data-qindex="${idx}">
                    ${Object.entries(SUBTYPES)
                      .map(([k, label]) => `<option value="${k}" ${q.subtype === k ? "selected" : ""}>${label}</option>`)
                      .join("")}
                  </select>
                </label>

                <label class="field"><span>Dificultad</span>
                  <select class="bank-q-difficulty" data-qindex="${idx}">
                    ${Object.entries(DIFFICULTIES)
                      .map(([k, label]) => `<option value="${k}" ${q.difficulty === k ? "selected" : ""}>${label}</option>`)
                      .join("")}
                  </select>
                </label>
              </div>

              <label class="field">
                <span>Justificación</span>
                <textarea class="bank-q-justification" data-qindex="${idx}" rows="2">${q.justification || ""}</textarea>
              </label>
            </div>
          `;
        })
        .join("");

      return `
        <div class="card bank-case-block" data-id="${r.id}">
          <div class="flex-row" style="justify-content:space-between;align-items:flex-start;gap:10px;">
            <div style="flex:1;">
              <div style="font-weight:700;font-size:14px;">
                ${specLabel || "Caso"}
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:4px;">
                Uso: <strong>${usage}</strong>
                ${r.examId ? ` | ExamID: <code>${r.examId}</code>` : ""}
              </div>
            </div>

            <div class="flex-row" style="justify-content:flex-end;gap:8px;">
              <button class="btn btn-sm btn-primary bank-btn-save">Guardar</button>
              <button class="btn btn-sm btn-outline bank-btn-delete">Eliminar</button>
            </div>
          </div>

          <div class="create-user-grid" style="margin-top:10px;">
            <label class="field">
              <span>Topic</span>
              <input class="bank-topic" type="text" value="${(r.topic || "").replace(/"/g, "&quot;")}" />
            </label>

            <label class="field">
              <span>Specialty</span>
              <input class="bank-specialty" type="text" value="${(r.specialty || "").replace(/"/g, "&quot;")}" />
            </label>
          </div>

          <label class="field">
            <span>Texto del caso</span>
            <textarea class="bank-caseText" rows="4">${r.caseText || ""}</textarea>
          </label>

          <div class="cards-list" style="margin-top:10px;">
            ${questionsHtml}
          </div>
        </div>
      `;
    })
    .join("");

  bankListEl.innerHTML = html;

  bankListEl.querySelectorAll(".bank-case-block").forEach((block) => {
    const id = block.dataset.id;
    const btnSave = block.querySelector(".bank-btn-save");
    const btnDelete = block.querySelector(".bank-btn-delete");

    btnSave.addEventListener("click", async () => {
      try {
        const caseText = block.querySelector(".bank-caseText").value.trim();
        const topic = block.querySelector(".bank-topic").value.trim();
        const specialty = block.querySelector(".bank-specialty").value.trim();

        const qCount = block.querySelectorAll(".bank-q-question").length;
        const questions = [];

        for (let i = 0; i < qCount; i++) {
          const questionText = block.querySelector(`.bank-q-question[data-qindex="${i}"]`)?.value.trim() || "";
          const optionA = block.querySelector(`.bank-q-a[data-qindex="${i}"]`)?.value.trim() || "";
          const optionB = block.querySelector(`.bank-q-b[data-qindex="${i}"]`)?.value.trim() || "";
          const optionC = block.querySelector(`.bank-q-c[data-qindex="${i}"]`)?.value.trim() || "";
          const optionD = block.querySelector(`.bank-q-d[data-qindex="${i}"]`)?.value.trim() || "";
          const correctOption = block.querySelector(`.bank-q-correct[data-qindex="${i}"]`)?.value || "";
          const subtype = block.querySelector(`.bank-q-subtype[data-qindex="${i}"]`)?.value || "salud_publica";
          const difficulty = block.querySelector(`.bank-q-difficulty[data-qindex="${i}"]`)?.value || "media";
          const justification = block.querySelector(`.bank-q-justification[data-qindex="${i}"]`)?.value.trim() || "";

          questions.push({ questionText, optionA, optionB, optionC, optionD, correctOption, subtype, difficulty, justification });
        }

        if (!caseText) {
          alert("caseText vacío.");
          return;
        }

        for (const q of questions) {
          if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctOption || !q.justification) {
            alert("Hay preguntas incompletas. Completa todos los campos.");
            return;
          }
        }

        await updateDoc(doc(db, "questions", id), {
          caseText,
          topic,
          specialty,
          questions,
          updatedAt: serverTimestamp(),
        });

        alert("Guardado.");
      } catch (e) {
        console.error("Error guardando caso en banco:", e);
        alert("Error al guardar. Revisa consola.");
      }
    });

    btnDelete.addEventListener("click", async () => {
      const ok = confirm("¿Eliminar este caso del banco? Esta acción no se puede deshacer.");
      if (!ok) return;

      try {
        await deleteDoc(doc(db, "questions", id));
        block.remove();
      } catch (e) {
        console.error("Error eliminando caso del banco:", e);
        alert("No se pudo eliminar. Revisa consola.");
      }
    });
  });
}

async function loadBankPanel(reset = false) {
  if (!bankListEl) return;
  if (bankIsLoading) return;

  const { searchText, topic, specialty, examId } = getBankFilters();

  if (reset) {
    bankPageLastDoc = null;
    bankPageHasMore = true;
    bankCurrentBaseRows = [];
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        Cargando banco…
      </div>
    `;
  }

  if (!bankPageHasMore && !reset) return;

  bankIsLoading = true;

  try {
    const qBank = buildBankFirestoreQuery({ topic, specialty, examId }, bankPageLastDoc);
    const snap = await getDocs(qBank);

    if (!snap.empty) bankPageLastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < 25) bankPageHasMore = false;

    const rows = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        usageCount: typeof data.usageCount === "number" ? data.usageCount : 0,
      };
    });

    // Por defecto (cuando NO filtras por examId), mostramos solo banco general (sin examId)
    const rowsDefaultBankOnly =
      examId
        ? rows
        : rows.filter((r) => !r.examId);

    bankCurrentBaseRows = reset ? rowsDefaultBankOnly : bankCurrentBaseRows.concat(rowsDefaultBankOnly);

    const finalRows = applyLocalTextFilter(bankCurrentBaseRows, searchText);
    renderBankList(finalRows);

    if (bankBtnLoadMore) {
      bankBtnLoadMore.disabled = !bankPageHasMore;
      bankBtnLoadMore.style.opacity = bankPageHasMore ? "1" : ".6";
    }
  } catch (e) {
    console.error("Error cargando banco (questions):", e);

    // Si el error es por índice faltante, Firebase lo imprime en consola con un link para crearlo.
    renderBankError("Error cargando banco. Revisa consola (posible índice faltante).");
  } finally {
    bankIsLoading = false;
  }
}

// Botones del panel Banco
if (bankBtnApply) bankBtnApply.addEventListener("click", () => loadBankPanel(true));
if (bankBtnRefresh) bankBtnRefresh.addEventListener("click", () => loadBankPanel(true));

if (bankBtnClear) {
  bankBtnClear.addEventListener("click", () => {
    if (bankFilterSearch) bankFilterSearch.value = "";
    if (bankFilterTopic) bankFilterTopic.value = "";
    if (bankFilterSpecialty) bankFilterSpecialty.value = "";
    if (bankFilterExamId) bankFilterExamId.value = "";
    loadBankPanel(true);
  });
}

if (bankBtnLoadMore) {
  bankBtnLoadMore.addEventListener("click", () => loadBankPanel(false));
}

/****************************************************
 * FIN ADMIN.JS
 ****************************************************/
console.log("admin.js cargado correctamente (Banco + Buscador examen + usageCount).");
