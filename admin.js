/****************************************************
 * ADMIN.JS - Panel de Administrador
 * Plataforma Estudiante ENARM
 * - Gestión de secciones
 * - Gestión de exámenes y casos clínicos
 * - Gestión de usuarios
 * - Configuración de pantalla principal
 * - Analytics básicos
 *
 * ✅ CORRECCIONES APLICADAS (SIN ELIMINAR FUNCIONES):
 * 1) Banco de preguntas (panel bank): preguntas editables tipo examen (no JSON).
 * 2) Buscador "Agregar casos desde banco" en EXÁMENES y MINI:
 *    - Busca en "questions" (solo casos banco: sin examId)
 *    - Muestra topic + usageCount
 *    - BLOQUEA duplicados dentro del mismo examen/mini (persistente con bankCaseId)
 * 3) usageCount robusto:
 *    - Ajuste por delta al guardar examen, borrar examen, guardar mini bank
 ****************************************************/

(async function bootstrapAdmin() {
  try {
    const [cfg, appMod, sharedMod, authMod, fsMod, storageMod] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("./shared-constants.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js"),
    ]);

    const { auth, db } = cfg;

    const { initializeApp, getApps, getApp } = appMod;
    const { SPECIALTIES, SUBTYPES, DIFFICULTIES, DIFFICULTY_WEIGHTS, DEFAULT_EXAM_RULES } = sharedMod;

    const { onAuthStateChanged, signOut, getAuth, signInWithEmailAndPassword } = authMod;

    const {
      collection,
      doc,
      getFirestore,
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
      documentId,
      increment,
    } = fsMod;

    // Firebase Storage (solo se usa para la biblioteca de Resúmenes y GPC)
    const { getStorage, ref: storageRef, uploadBytes, getDownloadURL, deleteObject } = storageMod;

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
const btnNavBank = document.getElementById("admin-btn-nav-bank");
const btnNavMini = document.getElementById("admin-btn-nav-mini");
const btnNavUsers = document.getElementById("admin-btn-nav-users");
const btnNavAnalytics = document.getElementById("admin-btn-nav-analytics");
const btnNavLanding = document.getElementById("admin-btn-nav-landing");
const btnNavImportExport = document.getElementById("admin-btn-nav-import-export");
const btnNavResources = document.getElementById("admin-btn-nav-resources");


/****************************************************
 * ✅ ORDENAR (DRAG & DROP) BOTONES DEL PANEL (SOLO VISTA)
 * - No modifica la lógica de Secciones/Usuarios/Banco/etc; solo el orden visual de los botones del menú.
 * - Se guarda en localStorage por UID.
 ****************************************************/
function enableAdminPanelNavReorder() {
  try {
    if (enableAdminPanelNavReorder.__enabled) return;
    enableAdminPanelNavReorder.__enabled = true;
    const uid = auth?.currentUser?.uid || "anon";
    const key = `admin_panel_nav_order_v1_${uid}`;

    const items = [
      { k: "exams", el: btnNavExams },
      { k: "resources", el: btnNavResources },
      { k: "bank", el: btnNavBank },
      { k: "mini", el: btnNavMini },
      { k: "users", el: btnNavUsers },
      { k: "analytics", el: btnNavAnalytics },
      { k: "landing", el: btnNavLanding },
      { k: "importexport", el: btnNavImportExport },
    ].filter((x) => !!x.el);

    if (!items.length) return;
    const container = items[0].el.parentElement;
    if (!container) return;

    items.forEach(({ k, el }) => {
      el.setAttribute("draggable", "true");
      el.dataset.navKey = k;
      el.style.cursor = "grab";
    });

    const getOrder = () =>
      Array.from(container.querySelectorAll("button.sidebar-btn"))
        .map((b) => b.dataset.navKey)
        .filter(Boolean);

    const applyOrder = (order) => {
      if (!Array.isArray(order) || !order.length) return;
      const map = new Map(items.map((x) => [x.k, x.el]));
      order.forEach((k) => {
        const el = map.get(k);
        if (el) container.appendChild(el);
      });
      items.forEach(({ k, el }) => {
        if (!order.includes(k)) container.appendChild(el);
      });
    };

    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(saved)) applyOrder(saved);
    } catch {}

    let dragKey = null;

    container.addEventListener("dragstart", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest("button.sidebar-btn");
      if (!btn?.dataset?.navKey) return;
      dragKey = btn.dataset.navKey;
      btn.style.opacity = "0.6";
      e.dataTransfer?.setData("text/plain", dragKey);
      e.dataTransfer?.setDragImage?.(btn, 10, 10);
    });

    container.addEventListener("dragend", (e) => {
      const t = e.target;
      if (t instanceof HTMLElement) {
        const btn = t.closest("button.sidebar-btn");
        if (btn) btn.style.opacity = "";
      }
      dragKey = null;
      try {
        localStorage.setItem(key, JSON.stringify(getOrder()));
      } catch {}
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const overBtn = t.closest("button.sidebar-btn");
      if (!overBtn?.dataset?.navKey || overBtn.dataset.navKey === dragKey) return;

      const dragged = container.querySelector(`button.sidebar-btn[data-nav-key="${dragKey}"]`);
      if (!dragged) return;

      const rect = overBtn.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;

      if (before) container.insertBefore(dragged, overBtn);
      else container.insertBefore(dragged, overBtn.nextSibling);
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();
      try {
        localStorage.setItem(key, JSON.stringify(getOrder()));
      } catch {}
    });
  } catch (e) {
    console.warn("No se pudo habilitar reorden del menú:", e);
  }
}

const adminSocialIcons = document.querySelectorAll(".admin-social-icon");

// Paneles principales
const panelExams = document.getElementById("admin-panel-exams");
const panelBank = document.getElementById("admin-panel-bank");
const panelMini = document.getElementById("admin-panel-mini");
const panelUsers = document.getElementById("admin-panel-users");
const panelAnalytics = document.getElementById("admin-panel-analytics");
const panelLanding = document.getElementById("admin-panel-landing");
const panelResources = document.getElementById("admin-panel-resources");


// ==================== PANEL RESÚMENES / GPC ====================
const resBtnRefresh = document.getElementById("admin-resources-btn-refresh");
const resBtnNewTopic = document.getElementById("admin-resources-btn-new-topic");
const resAuthBox = document.getElementById("admin-resources-auth-box");
const resAuthStatus = document.getElementById("admin-resources-auth-status");
const resAuthEmailInput = document.getElementById("admin-resources-auth-email");
const resAuthPasswordInput = document.getElementById("admin-resources-auth-password");
const resAuthBtnLogin = document.getElementById("admin-resources-auth-login");
const resAuthBtnLogout = document.getElementById("admin-resources-auth-logout");
const resSearchInput = document.getElementById("admin-resources-search");
const resSpecialtyFilter = document.getElementById("admin-resources-specialty");
const resTopicCount = document.getElementById("admin-resources-topic-count");
const resTopicList = document.getElementById("admin-resources-topic-list");

const resBtnBack = document.getElementById("admin-resources-btn-back");
const resEditorStatus = document.getElementById("admin-resources-editor-status");
const resTitleInput = document.getElementById("admin-resources-title");
const resSpecialtyRawInput = document.getElementById("admin-resources-specialty-raw");
const resLinksWrap = document.getElementById("admin-resources-links");
// ✅ NUEVO: contenedor para insertar el recuadro de PDF de vista previa
const resTopicExamWrap = document.getElementById("admin-resources-topic-exam-wrap");
// ✅ Mini-examen del tema (topic_exams/{topicId})
const resTopicExamCasesWrap = document.getElementById("admin-resources-topic-exam-cases");
const resTopicExamEmpty = document.getElementById("admin-resources-topic-exam-empty");
const resTopicExamBtnAddCase = document.getElementById("admin-resources-topic-exam-btn-add-case");
const resTopicExamBtnSave = document.getElementById("admin-resources-topic-exam-btn-save");
const resTopicExamBtnDelete = document.getElementById("admin-resources-topic-exam-btn-delete");

const resBtnAddLink = document.getElementById("admin-resources-btn-add-link");
const resBtnDelete = document.getElementById("admin-resources-btn-delete");
const resBtnSave = document.getElementById("admin-resources-btn-save");

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

// ==================== BUSCADOR "Agregar casos desde banco" EN DETALLE DE EXAMEN ====================
const bankSearchInput = document.getElementById("admin-bank-search-input");
const bankSearchResults = document.getElementById("admin-bank-search-results");

// ==================== BUSCADOR "Agregar casos desde banco" EN MINI EXÁMENES ====================
const miniBankSearchInput = document.getElementById("admin-mini-bank-search-input");
const miniBankSearchResults = document.getElementById("admin-mini-bank-search-results");

// ==================== GENERADOR AUTOMÁTICO (detalle de examen) ====================
const autoGenTopicsInput = document.getElementById("admin-auto-gen-topics");
const autoGenTargetsWrap = document.getElementById("admin-auto-gen-targets");
const autoGenBtnAddTarget = document.getElementById("admin-auto-gen-add-target");
const autoGenBtnGenerate = document.getElementById("admin-auto-gen-generate");
const autoGenSummary = document.getElementById("admin-auto-gen-summary");

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

// Modal genérico (reutilizable) -> SE CONSERVA, pero banco ya no lo usa
const modalOverlay = document.getElementById("admin-modal-overlay");
const modalBox = document.getElementById("admin-modal");
const modalTitle = document.getElementById("admin-modal-title");
const modalBody = document.getElementById("admin-modal-body");
const modalBtnCancel = document.getElementById("admin-modal-cancel");
const modalBtnOk = document.getElementById("admin-modal-ok");

let modalOkHandler = null;

/****************************************************
 * TOGGLE BARRA LATERAL (HAMBURGUESA)
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

let currentAdminUser = null;       // Auth user
let currentSectionId = null;       // Sección seleccionada
let currentExamId = null;          // Examen abierto


/****************************************************
 * ESTADO DE NAVEGACIÓN (persistencia + botón Atrás)
 * Objetivo:
 * 1) Refresh mantiene la misma vista/pestaña y contexto.
 * 2) Botón físico/gesto Atrás navega dentro de la jerarquía de la app.
 ****************************************************/
const ADMIN_NAV_STATE_VERSION = 1;
let _isRestoringNav = false;

let adminNavState = {
  panel: "exams",            // exams | bank | mini | users | analytics | landing | resources
  view: "exams_list",        // exams_list | exam_detail | resources_list | resources_detail | resources_new | panel
  sectionId: null,
  examId: null,
  resourcesTopicId: null,
  resourcesSearch: "",
  resourcesSpecialtyKey: "",
};

function getAdminNavStorageKey() {
  const id = currentAdminUser?.uid || currentAdminUser?.email || "anon";
  return `admin_nav_v${ADMIN_NAV_STATE_VERSION}_${id}`;
}

function readAdminNavState() {
  try {
    const raw = localStorage.getItem(getAdminNavStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...adminNavState,
      ...parsed,
    };
  } catch {
    return null;
  }
}

function persistAdminNavState() {
  try {
    localStorage.setItem(getAdminNavStorageKey(), JSON.stringify(adminNavState));
  } catch {}
}

function sameNavState(a, b) {
  try {
    return JSON.stringify(a || {}) === JSON.stringify(b || {});
  } catch {
    return false;
  }
}

function pushAdminHistoryIfChanged() {
  if (_isRestoringNav) return;
  const prev = history.state?.adminNav;
  const next = { ...adminNavState };
  if (sameNavState(prev, next)) return;
  history.pushState({ adminNav: next }, "", window.location.href);
}

function replaceAdminHistory() {
  try {
    history.replaceState({ adminNav: { ...adminNavState } }, "", window.location.href);
  } catch {}
}

function setSidebarActiveByPanel(panelId) {
  clearSidebarActive();
  if (panelId === "exams" && btnNavExams) btnNavExams.classList.add("sidebar-btn--active");
  if (panelId === "bank" && btnNavBank) btnNavBank.classList.add("sidebar-btn--active");
  if (panelId === "mini" && btnNavMini) btnNavMini.classList.add("sidebar-btn--active");
  if (panelId === "users" && btnNavUsers) btnNavUsers.classList.add("sidebar-btn--active");
  if (panelId === "analytics" && btnNavAnalytics) btnNavAnalytics.classList.add("sidebar-btn--active");
  if (panelId === "landing" && btnNavLanding) btnNavLanding.classList.add("sidebar-btn--active");
  if (panelId === "resources" && btnNavResources) btnNavResources.classList.add("sidebar-btn--active");
}

async function applyAdminNavState(state) {
  if (!state) return;

  _isRestoringNav = true;
  try {
    adminNavState = { ...adminNavState, ...state };
    persistAdminNavState();

    // Panel
    setSidebarActiveByPanel(adminNavState.panel);
    setActivePanel(adminNavState.panel);

    // EXÁMENES
    if (adminNavState.panel === "exams") {
      // Seleccionar sección si aplica
      if (adminNavState.sectionId && adminNavState.sectionId !== currentSectionId) {
        const li = sectionsList?.querySelector(`.sidebar__section-item[data-section-id="${adminNavState.sectionId}"]`);
        const name = li?.dataset?.sectionName || li?.querySelector(".sidebar__section-name")?.textContent || "Sección";
        selectSection(adminNavState.sectionId, name);
      }

      if (adminNavState.view === "exam_detail" && adminNavState.examId) {
        try {
          const exSnap = await getDoc(doc(db, "exams", adminNavState.examId));
          const exName = exSnap.exists() ? (exSnap.data()?.name || "") : "";
          await openExamDetail(adminNavState.examId, exName);
        } catch (err) {
          console.error("No se pudo restaurar el examen:", err);
        }
      } else {
        // lista
        currentExamId = null;
        if (examCasesContainer) examCasesContainer.innerHTML = "";
        hide(examDetailView);
        if (currentSectionId) {
          loadExamsForSection(currentSectionId);
        }
      }
    }

    // RESOURCES
    if (adminNavState.panel === "resources") {
      await ensureResourcesAdminLoaded();
      if (adminNavState.view === "resources_detail" && adminNavState.resourcesTopicId) {
        adminResourcesSelectTopic(adminNavState.resourcesTopicId);
      } else if (adminNavState.view === "resources_new") {
        adminResourcesOpenNewTopic();
      } else {
        adminResourcesOpenList();
      }
    }
  } finally {
    _isRestoringNav = false;
  }
}

let currentExamCases = [];         // Casos clínicos en memoria

// Token para evitar “superposición” de exámenes entre secciones
let examsLoadToken = 0;

// MINI EXÁMENES
let miniCases = [];
let miniCasesLoadedOnce = false;

// Cache banco para buscadores (carga incremental para escalar a 10,000 casos)
let bankCasesCache = [];
let bankCasesById = new Map();
let bankCasesLoadedOnce = false;     // al menos 1 lote cargado
let bankCasesAllLoaded = false;      // ya se escaneó todo (o se alcanzó el tope)
let bankCasesLastDoc = null;         // cursor de paginación (questions)
let bankCasesScanCount = 0;          // cuántos docs de questions se han escaneado (incluye no-banco)
let bankCasesOrderMode = "createdAt"; // "createdAt" | "name"
let bankCasesLoading = false;

let bankSearchDebounceTimer = null;
let miniBankSearchDebounceTimer = null;

let bankSearchRunToken = 0;
let miniBankSearchRunToken = 0;

const BANK_SEARCH_BATCH_SIZE = 500;      // lote de escaneo Firestore
const BANK_SEARCH_MAX_RESULTS = 50;      // resultados máximos a mostrar
const BANK_SEARCH_MAX_BANK_CASES = 10000; // tope de casos banco a cachear

/****************************************************
 * ✅ REVISIÓN (PALOMITA) - Control de casos del banco
 * - Se guarda en cada doc de "questions" como:
 *   reviewed: boolean
 *   reviewedAt: timestamp|null
 *   reviewedBy: uid|null
 ****************************************************/

const bankReviewCache = new Map(); // id -> { reviewed: boolean, reviewedAt: any|null }

function reviewBadgeText(reviewed) {
  return reviewed ? "✓ Revisado" : "○ Sin revisar";
}

function setBadgeElState(badgeEl, reviewed) {
  if (!badgeEl) return;
  badgeEl.textContent = reviewBadgeText(reviewed);
  badgeEl.classList.toggle("badge--success", !!reviewed);
  badgeEl.classList.toggle("badge--muted", !reviewed);
}

function setReviewedBtnState(btnEl, reviewed) {
  if (!btnEl) return;
  btnEl.dataset.reviewed = reviewed ? "1" : "0";
  btnEl.classList.toggle("btn-success", !!reviewed);
  btnEl.classList.toggle("btn-outline", !reviewed);
  btnEl.textContent = reviewed ? "✓ Revisado" : "Marcar ✓";
}

function applyReviewedStateToUI(caseId, reviewed) {
  if (!caseId) return;

  // Badges en listas del banco
  document
    .querySelectorAll(`.admin-review-badge[data-id="${caseId}"]`)
    .forEach((el) => setBadgeElState(el, reviewed));

  // Botones "check" en listas del banco
  document
    .querySelectorAll(`.admin-bank-toggle-reviewed[data-id="${caseId}"]`)
    .forEach((el) => setReviewedBtnState(el, reviewed));

  // Badges en editor de exámenes y mini exámenes (si proviene del banco)
  document
    .querySelectorAll(`.admin-case-reviewed-badge[data-bank-id="${caseId}"], .mini-case-reviewed-badge[data-bank-id="${caseId}"]`)
    .forEach((el) => setBadgeElState(el, reviewed));
}

async function ensureReviewCache(caseIds) {
  const unique = Array.from(new Set((caseIds || []).filter(Boolean)));
  const missing = unique.filter((id) => !bankReviewCache.has(id));
  if (!missing.length) return;

  const CHUNK = 30; // límite de Firestore "in"
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);

    try {
      const q = query(
        collection(db, "questions"),
        where(documentId(), "in", chunk)
      );

      const snap = await getDocs(q);
      const found = new Set();

      snap.forEach((d) => {
        const data = d.data() || {};
        const reviewed = !!data.reviewed;
        bankReviewCache.set(d.id, { reviewed, reviewedAt: data.reviewedAt || null });

        // Mantener caches de buscador sincronizados si existen
        const entry = bankCasesById.get(d.id);
        if (entry) entry.reviewed = reviewed;

        const cached = bankCasesCache.find((x) => x.id === d.id);
        if (cached) cached.reviewed = reviewed;

        found.add(d.id);
      });

      // docs no retornados => asumir no revisado (evita loops)
      chunk.forEach((id) => {
        if (!found.has(id)) bankReviewCache.set(id, { reviewed: false, reviewedAt: null });
      });
    } catch (err) {
      console.error("ensureReviewCache error:", err);
      chunk.forEach((id) => {
        if (!bankReviewCache.has(id)) bankReviewCache.set(id, { reviewed: false, reviewedAt: null });
      });
    }
  }
}

async function setBankCaseReviewed(caseId, nextReviewed) {
  if (!caseId) return;

  const prevReviewed =
    (bankReviewCache.has(caseId) ? !!bankReviewCache.get(caseId)?.reviewed : null) ??
    !!bankCasesById.get(caseId)?.reviewed;

  // Deshabilitar todos los botones asociados mientras se guarda
  const btns = Array.from(
    document.querySelectorAll(`.admin-bank-toggle-reviewed[data-id="${caseId}"]`)
  );
  btns.forEach((b) => (b.disabled = true));

  // Optimista (feedback inmediato)
  applyReviewedStateToUI(caseId, nextReviewed);

  try {
    await updateDoc(doc(db, "questions", caseId), {
      reviewed: nextReviewed,
      reviewedAt: nextReviewed ? serverTimestamp() : null,
      reviewedBy: nextReviewed ? (auth.currentUser?.uid || null) : null,
      updatedAt: serverTimestamp(),
    });

    bankReviewCache.set(caseId, { reviewed: nextReviewed, reviewedAt: null });

    const entry = bankCasesById.get(caseId);
    if (entry) entry.reviewed = nextReviewed;

    const cached = bankCasesCache.find((x) => x.id === caseId);
    if (cached) cached.reviewed = nextReviewed;

    applyReviewedStateToUI(caseId, nextReviewed);
  } catch (err) {
    console.error(err);
    applyReviewedStateToUI(caseId, prevReviewed);
    alert("No se pudo actualizar el check de revisión.");
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

let _examReviewRefreshToken = 0;
function scheduleRefreshExamReviewedBadges() {
  const token = ++_examReviewRefreshToken;
  setTimeout(async () => {
    if (token !== _examReviewRefreshToken) return;
    if (!examCasesContainer) return;

    const badgeEls = Array.from(examCasesContainer.querySelectorAll(".admin-case-reviewed-badge"));
    const ids = badgeEls.map((el) => el.dataset.bankId).filter(Boolean);
    if (!ids.length) return;

    await ensureReviewCache(ids);
    badgeEls.forEach((el) => {
      const st = bankReviewCache.get(el.dataset.bankId);
      setBadgeElState(el, !!st?.reviewed);
    });
  }, 60);
}

let _miniReviewRefreshToken = 0;
function scheduleRefreshMiniReviewedBadges() {
  const token = ++_miniReviewRefreshToken;
  setTimeout(async () => {
    if (token !== _miniReviewRefreshToken) return;
    if (!miniCasesContainer) return;

    const badgeEls = Array.from(miniCasesContainer.querySelectorAll(".mini-case-reviewed-badge"));
    const ids = badgeEls.map((el) => el.dataset.bankId).filter(Boolean);
    if (!ids.length) return;

    await ensureReviewCache(ids);
    badgeEls.forEach((el) => {
      const st = bankReviewCache.get(el.dataset.bankId);
      setBadgeElState(el, !!st?.reviewed);
    });
  }, 60);
}


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
  const panels = [panelExams, panelBank, panelMini, panelUsers, panelAnalytics, panelLanding, panelResources].filter(Boolean);
  panels.forEach((p) => hide(p));

  if (panelId === "exams") show(panelExams);
  if (panelId === "bank") show(panelBank);
  if (panelId === "mini") show(panelMini);
  if (panelId === "users") show(panelUsers);
  if (panelId === "analytics") show(panelAnalytics);
  if (panelId === "landing") show(panelLanding);
  if (panelId === "resources") show(panelResources);

  // Persist + history
  if (!_isRestoringNav) {
    adminNavState.panel = panelId;
    // Ajusta view base
    if (panelId === "exams") {
      adminNavState.view = examDetailView && !examDetailView.classList.contains("hidden") ? "exam_detail" : "exams_list";
    } else if (panelId === "resources") {
      adminNavState.view = adminNavState.resourcesTopicId ? "resources_detail" : "resources_list";
    } else {
      adminNavState.view = "panel";
    }
    persistAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

/****************************************************
 * RESÚMENES / GPC (ADMIN CRUD) - PROYECTO "pagina-buena"
 * Colección: "temas"
 * Campos:
 *  - title: string
 *  - specialty: string (texto libre)
 *  - links: [{ label, url, type }]
 ****************************************************/
const RESOURCES_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQsx1UlomuEw",
  authDomain: "pagina-buena.firebaseapp.com",
  databaseURL: "https://pagina-buena-default-rtdb.firebaseio.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.firebasestorage.app",
  messagingSenderId: "810208199031",
  appId: "1:810208199031:web:707a76b931ee7d2f002172",
};


let _resourcesApp = null;
let _resourcesDb = null;
let _resourcesAuth = null;
let _resourcesLoadedOnce = false;

let _resourcesTopics = [];
let _resourcesSelectedId = null;
let _resourcesTopicExam = { cases: [] };
let _resourcesIsNew = false;
let _resourcesDeleteArmed = false;
let _resourcesDeleteArmTimer = null;


let _resourcesStorage = null;

// Cache HTTP (Storage): ~10 meses
const RESOURCES_PDF_CACHE_MAX_AGE_SECONDS = 26280000; // ~304 días (~10 meses)

function bucketToGsUrl(bucket) {
  const b = (bucket || "").toString().trim().replace(/^gs:\/\//, "");
  if (!b) return null;
  return `gs://${b}`;
}

function ensureResourcesStorage(useFallbackBucket = false) {
  ensureResourcesDb(); // inicializa _resourcesApp
  const primaryGs = bucketToGsUrl(RESOURCES_FIREBASE_CONFIG.storageBucket);
  const fallbackGs = bucketToGsUrl(`${RESOURCES_FIREBASE_CONFIG.projectId}.appspot.com`);

  const chosen = useFallbackBucket ? (fallbackGs || primaryGs) : (primaryGs || fallbackGs);
  _resourcesStorage = chosen ? getStorage(_resourcesApp, chosen) : getStorage(_resourcesApp);
  _resourcesStorage.__isFallback = !!useFallbackBucket;
  return _resourcesStorage;
}

async function tryUploadWithBucketFallback(path, file, metadata) {
  // 1) Intenta con bucket configurado
  try {
    const st = ensureResourcesStorage(false);
    const r = storageRef(st, path);
    await uploadBytes(r, file, metadata);
    return { storage: st, ref: r };
  } catch (e1) {
    console.warn("Upload PDF falló con bucket primario; reintentando con fallback...", e1);
    // 2) Reintenta con fallback (projectId.appspot.com)
    const st2 = ensureResourcesStorage(true);
    const r2 = storageRef(st2, path);
    await uploadBytes(r2, file, metadata);
    return { storage: st2, ref: r2 };
  }
}

async function tryDeleteWithBucketFallback(path) {
  if (!path) return;
  try {
    const st = ensureResourcesStorage(false);
    await deleteObject(storageRef(st, path));
  } catch (e1) {
    console.warn("Delete PDF falló con bucket primario; reintentando con fallback...", e1);
    const st2 = ensureResourcesStorage(true);
    await deleteObject(storageRef(st2, path));
  }
}

function ensureResourcesDb() {
  if (_resourcesDb) return _resourcesDb;

  try {
    const existing = (getApps() || []).find((a) => a.name === "resourcesApp");
    _resourcesApp = existing || initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");
  } catch (err) {
    // Si el nombre ya existe, intenta getApp
    try {
      _resourcesApp = getApp("resourcesApp");
    } catch {
      console.error("No se pudo inicializar resourcesApp:", err);
      throw err;
    }
  }

  _resourcesDb = getFirestore(_resourcesApp);
  return _resourcesDb;
}
function ensureResourcesAuth() {
  if (_resourcesAuth) return _resourcesAuth;
  ensureResourcesDb(); // inicializa _resourcesApp
  _resourcesAuth = getAuth(_resourcesApp);
  return _resourcesAuth;
}

function updateResourcesAuthUi() {
  if (!resAuthStatus) return;

  const u = ensureResourcesAuth().currentUser;

  if (u) {
    resAuthStatus.textContent = `Biblioteca: conectado como ${u.email || u.uid}`;
    if (resAuthBtnLogin) resAuthBtnLogin.classList.add("hidden");
    if (resAuthBtnLogout) resAuthBtnLogout.classList.remove("hidden");
    if (resAuthEmailInput) resAuthEmailInput.disabled = true;
    if (resAuthPasswordInput) resAuthPasswordInput.disabled = true;
  } else {
    resAuthStatus.textContent = "Biblioteca: no autenticado (solo lectura).";
    if (resAuthBtnLogin) resAuthBtnLogin.classList.remove("hidden");
    if (resAuthBtnLogout) resAuthBtnLogout.classList.add("hidden");
    if (resAuthEmailInput) resAuthEmailInput.disabled = false;
    if (resAuthPasswordInput) resAuthPasswordInput.disabled = false;
  }
}


function canonicalizeSpecialty(text) {
  const t = (text || "").toString().trim().toLowerCase();
  if (!t) return "otros";
  if (t.includes("medicina interna") || t.includes("interna")) return "medicina_interna";
  if (t.includes("cirugía") || t.includes("cirugia")) return "cirugia_general";
  if (t.includes("pediatr")) return "pediatria";
  if (t.includes("gine") || t.includes("obst")) return "gine_obstetricia";
  if (t.includes("salud pública") || t.includes("salud publica") || t.includes("epid")) return "salud_publica";
  if (t.includes("acceso gratuito") || t.includes("gratis")) return "acceso_gratuito";
  return "otros";
}

function detectLinkType(url) {
  const u = (url || "").toString().toLowerCase().trim();
  if (!u) return "link";
  if (u.includes(".pdf") || u.includes("drive.google.com") || u.includes("docs.google.com")) {
    // Puede ser PDF en Drive; dejamos 'pdf' si el texto sugiere PDF
    if (u.includes(".pdf") || u.includes("pdf")) return "pdf";
  }
  return "link";
}

function setResEditorEnabled(enabled) {
  if (resTitleInput) resTitleInput.disabled = !enabled;
  if (resSpecialtyRawInput) resSpecialtyRawInput.disabled = !enabled;
  if (resBtnAddLink) resBtnAddLink.disabled = !enabled;
  if (resBtnSave) resBtnSave.disabled = !enabled;
  if (resBtnDelete) resBtnDelete.disabled = !enabled;
}

function renderResTopicCount() {
  if (!resTopicCount) return;
  const total = _resourcesTopics.length;
  const filtered = adminResourcesGetFiltered().length;
  resTopicCount.textContent = `${filtered} de ${total} temas`;
}

function adminResourcesGetFiltered() {
  const q = (resSearchInput?.value || adminNavState.resourcesSearch || "").toString().trim().toLowerCase();
  const key = (resSpecialtyFilter?.value || adminNavState.resourcesSpecialtyKey || "").toString();

  return _resourcesTopics.filter((t) => {
    const title = (t.title || "").toLowerCase();
    const spec = (t.specialty || "").toLowerCase();
    const matchesText = !q || title.includes(q) || spec.includes(q);
    const matchesSpec = !key || canonicalizeSpecialty(t.specialty) === key;
    return matchesText && matchesSpec;
  });
}

function renderResTopicList() {
  if (!resTopicList) return;

  const items = adminResourcesGetFiltered();
  renderResTopicCount();

  resTopicList.innerHTML = "";
  if (!items.length) {
    resTopicList.innerHTML = `<div class="empty-msg">No hay temas para mostrar.</div>`;
    return;
  }

  for (const t of items) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.padding = "10px";
    card.style.cursor = "pointer";
    if (t.id === _resourcesSelectedId && !_resourcesIsNew) {
      card.style.border = "2px solid var(--primary, #2b6cb0)";
    }

    const linkCount = Array.isArray(t.links) ? t.links.length : 0;
    const specLabel = (t.specialty || "").toString();

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(t.title || "(Sin título)")}</div>
          <div class="panel-subtitle">${escapeHtml(specLabel || "Sin especialidad")} · ${linkCount} link(s)</div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => adminResourcesSelectTopic(t.id));
    resTopicList.appendChild(card);
  }
}

function renderResLinksEditor(links) {
  if (!resLinksWrap) return;
  resLinksWrap.innerHTML = "";

  const arr = Array.isArray(links) ? links : [];
  if (!arr.length) {
    resLinksWrap.innerHTML = `<div class="panel-subtitle">Aún no hay links. Usa “Agregar link”.</div>`;
    return;
  }

  arr.forEach((l, idx) => {
    const row = document.createElement("div");
    row.dataset.resLinkRow = "1";
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 2fr auto";
    row.style.gap = "8px";
    row.style.alignItems = "end";
    row.style.marginTop = "8px";

    row.innerHTML = `
      <label class="field" style="margin:0;">
        <span>Etiqueta</span>
        <input type="text" data-res-link-label value="${escapeAttr(l?.label || "")}" placeholder="Ej. GPC (PDF)" />
      </label>

      <label class="field" style="margin:0;">
        <span>URL</span>
        <input type="text" data-res-link-url value="${escapeAttr(l?.url || "")}" placeholder="https://..." />
      </label>

      <button class="icon-btn" type="button" title="Quitar link" data-res-link-remove>🗑</button>
    `;

    row.querySelector("[data-res-link-remove]")?.addEventListener("click", () => {
      row.remove();
      // Si se vacía, re-render mensaje
      if (!resLinksWrap.querySelector("[data-res-link-row]")) {
        renderResLinksEditor([]);
      }
    });

    resLinksWrap.appendChild(row);
  });
}

function getResLinksFromEditor() {
  const rows = Array.from(resLinksWrap?.querySelectorAll("[data-res-link-row]") || []);
  const out = [];
  for (const r of rows) {
    const label = (r.querySelector("[data-res-link-label]")?.value || "").toString().trim();
    const url = (r.querySelector("[data-res-link-url]")?.value || "").toString().trim();
    if (!url) continue;
    out.push({ label: label || url, url, type: detectLinkType(url) });
  }
  return out;
}


/****************************************************
 * ✅ VISTA PREVIA (PDF EN GITHUB PAGES)
 * Firestore: temas/<id> puede tener:
 *   - previewPdf: { url, version, updatedAt }
 *   - y/o (legacy) previewPdfUrl / previewPdfVersion
 *
 * Nota importante:
 * - Para que el Service Worker cachee el PDF, el URL debe ser del MISMO ORIGEN
 *   que la página (GitHub Pages). Recomendado: rutas tipo /pdfs/tema.pdf
 * - Si reemplazas el PDF sin cambiar nombre, usa "Actualizar versión" para que
 *   el estudiante descargue la versión nueva (?v=...).
 ****************************************************/
let _resPreviewPdfUi = null;

function _resAbsUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    return new URL(s, window.location.href).toString();
  } catch {
    return "";
  }
}

function _resStripQueryHash(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.split("#")[0].split("?")[0];
}

function _resAppendVersionParam(rawUrl, version) {
  const u = String(rawUrl || "").trim();
  const v = String(version || "").trim();
  if (!u || !v) return u;
  try {
    const uu = new URL(u, window.location.href);
    uu.searchParams.set("v", v);
    return uu.toString();
  } catch {
    const sep = u.includes("?") ? "&" : "?";
    return u + sep + "v=" + encodeURIComponent(v);
  }
}

function ensureResourcesPreviewPdfUi() {
  if (_resPreviewPdfUi) return _resPreviewPdfUi;

  // ✅ Preferimos el bloque existente en admin.html (si existe)
  const existingWrap = document.getElementById("admin-resources-preview-pdf-wrap");
  if (existingWrap) {
    const status = existingWrap.querySelector("#admin-resources-preview-pdf-status") || existingWrap.querySelector(".panel-subtitle");
    const chooseBtn = existingWrap.querySelector("#admin-resources-preview-pdf-btn-choose");
    const uploadBtn = existingWrap.querySelector("#admin-resources-preview-pdf-btn-upload");
    const deleteBtn = existingWrap.querySelector("#admin-resources-preview-pdf-btn-delete");
    const bumpBtn = existingWrap.querySelector("#admin-resources-preview-pdf-btn-save");
    const fileInput = existingWrap.querySelector("#admin-resources-preview-pdf-input");

    // Oculta input de archivo (ya no subimos a Storage en plan Spark)
    if (fileInput) fileInput.style.display = "none";

    // Ajusta etiquetas de botones (sin tocar otros paneles)
    if (chooseBtn) chooseBtn.textContent = "Abrir PDF";
    if (uploadBtn) uploadBtn.textContent = "Guardar URL";
    if (deleteBtn) deleteBtn.textContent = "Eliminar URL";
    if (bumpBtn) bumpBtn.textContent = "Actualizar versión";

    // Ajusta texto de ayuda (si existe)
    const subtitle = existingWrap.querySelector(".panel-subtitle");
    if (subtitle) {
      subtitle.innerHTML = `
        Pega la URL del PDF alojado en <b>GitHub Pages</b>. Recomendado: <b>/pdfs/tema.pdf</b> (mismo dominio).
        <br/>Si reemplazas el PDF sin cambiar nombre, pulsa <b>Actualizar versión</b> para forzar descarga de la nueva versión.
      `;
    }

    // Inserta input de URL si no existe
    let urlInput = existingWrap.querySelector("#admin-resources-preview-pdf-url");
    if (!urlInput) {
      const label = document.createElement("label");
      label.className = "field";
      label.style.marginTop = "10px";
      label.innerHTML = `
        <span>URL del PDF para vista previa (GitHub Pages)</span>
        <input id="admin-resources-preview-pdf-url" type="text"
          placeholder="/pdfs/mi-tema.pdf  (recomendado)  o  https://tuusuario.github.io/pdfs/mi-tema.pdf" />
      `;

      // Coloca el input justo antes del status
      if (status?.parentNode) status.parentNode.insertBefore(label, status);
      else existingWrap.appendChild(label);

      urlInput = label.querySelector("input");
    }

    // Inserta display de versión si no existe
    let verEl = existingWrap.querySelector("#admin-resources-preview-pdf-version");
    if (!verEl) {
      verEl = document.createElement("div");
      verEl.id = "admin-resources-preview-pdf-version";
      verEl.className = "panel-subtitle";
      verEl.style.marginTop = "6px";
      verEl.textContent = "Versión: —";
      urlInput?.parentNode?.insertAdjacentElement("afterend", verEl);
    }

    _resPreviewPdfUi = {
      box: existingWrap,
      status,
      openBtn: chooseBtn,
      uploadBtn,
      delBtn: deleteBtn,
      bumpBtn,
      urlInput,
      verEl,
    };
    return _resPreviewPdfUi;
  }

  // ✅ Fallback: si por alguna razón el bloque no existe en HTML, lo creamos
  if (!resTopicExamWrap) return null;

  const box = document.createElement("div");
  box.id = "admin-resources-preview-pdf-wrap";
  box.className = "card";
  box.style.marginTop = "12px";
  box.style.padding = "12px";

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
      <div style="min-width:220px;">
        <div style="font-weight:700;font-size:13px;">Vista previa (PDF en GitHub Pages)</div>
        <div class="panel-subtitle" style="margin-top:4px;">
          Pega la URL del PDF. Recomendado: <b>/pdfs/tema.pdf</b> (mismo dominio).
          <br/>Usa <b>Actualizar versión</b> si reemplazas el PDF sin cambiar nombre.
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button id="admin-resources-preview-pdf-btn-choose" class="btn btn-outline btn-sm" type="button">Abrir PDF</button>
        <button id="admin-resources-preview-pdf-btn-upload" class="btn btn-primary btn-sm" type="button">Guardar URL</button>
        <button id="admin-resources-preview-pdf-btn-delete" class="btn btn-secondary btn-sm" type="button">Eliminar URL</button>
        <button id="admin-resources-preview-pdf-btn-save" class="btn btn-outline btn-sm" type="button">Actualizar versión</button>
      </div>
    </div>

    <label class="field" style="margin-top:10px;">
      <span>URL del PDF para vista previa (GitHub Pages)</span>
      <input id="admin-resources-preview-pdf-url" type="text"
        placeholder="/pdfs/mi-tema.pdf  (recomendado)  o  https://tuusuario.github.io/pdfs/mi-tema.pdf" />
    </label>

    <div id="admin-resources-preview-pdf-version" class="panel-subtitle" style="margin-top:6px;">Versión: —</div>
    <div id="admin-resources-preview-pdf-status" class="panel-subtitle" style="margin-top:10px;">—</div>
  `;

  // Inserta justo antes del bloque Repaso/Mini-examen
  resTopicExamWrap.parentNode?.insertBefore(box, resTopicExamWrap);

  const status = box.querySelector("#admin-resources-preview-pdf-status");
  const openBtn = box.querySelector("#admin-resources-preview-pdf-btn-choose");
  const uploadBtn = box.querySelector("#admin-resources-preview-pdf-btn-upload");
  const delBtn = box.querySelector("#admin-resources-preview-pdf-btn-delete");
  const bumpBtn = box.querySelector("#admin-resources-preview-pdf-btn-save");
  const urlInput = box.querySelector("#admin-resources-preview-pdf-url");
  const verEl = box.querySelector("#admin-resources-preview-pdf-version");

  _resPreviewPdfUi = { box, status, openBtn, uploadBtn, delBtn, bumpBtn, urlInput, verEl };
  return _resPreviewPdfUi;
}

function _resGetTopicPreviewUrl(topic) {
  if (topic?.previewPdf && typeof topic.previewPdf === "object" && topic.previewPdf.url != null) {
    return String(topic.previewPdf.url || "").trim();
  }
  return String(topic?.previewPdfUrl || "").trim();
}

function _resGetTopicPreviewVer(topic) {
  if (topic?.previewPdf && typeof topic.previewPdf === "object" && topic.previewPdf.version != null) {
    const v = Number(topic.previewPdf.version);
    return Number.isFinite(v) ? v : 0;
  }
  const v = Number(topic?.previewPdfVersion);
  return Number.isFinite(v) ? v : 0;
}

function renderResourcesPreviewPdfUi(topic) {
  const ui = ensureResourcesPreviewPdfUi();
  if (!ui) return;

  const hasTopic = !!(topic && topic.id);
  const isAuthed = !!ensureResourcesAuth()?.currentUser;

  const url = _resGetTopicPreviewUrl(topic);
  const ver = _resGetTopicPreviewVer(topic);
  const abs = _resAbsUrl(url);

  if (ui.urlInput) ui.urlInput.value = url || "";

  if (!hasTopic) {
    ui.status && (ui.status.textContent = "Selecciona un tema.");
    ui.verEl && (ui.verEl.textContent = "Versión: —");
  } else if (!isAuthed) {
    ui.status && (ui.status.textContent = "Inicia sesión en Biblioteca para guardar/eliminar la URL del PDF.");
    ui.verEl && (ui.verEl.textContent = url ? `Versión: v${Math.max(1, ver || 1)}` : "Versión: —");
  } else if (url) {
    ui.status && (ui.status.textContent = "URL de vista previa configurada.");
    ui.verEl && (ui.verEl.textContent = `Versión: v${Math.max(1, ver || 1)}`);
  } else {
    ui.status && (ui.status.textContent = "Aún no hay URL de PDF para vista previa en este tema.");
    ui.verEl && (ui.verEl.textContent = "Versión: —");
  }

  // Botones
  if (ui.openBtn) {
    ui.openBtn.disabled = !abs;
  }
  if (ui.uploadBtn) ui.uploadBtn.disabled = !(hasTopic && isAuthed);
  if (ui.delBtn) ui.delBtn.disabled = !(hasTopic && isAuthed && !!url);
  if (ui.bumpBtn) ui.bumpBtn.disabled = !(hasTopic && isAuthed && !!url);
}

async function adminResourcesOpenPreviewPdf() {
  const ui = ensureResourcesPreviewPdfUi();
  if (!ui) return;

  const topic = _resourcesTopics.find((t) => t.id === _resourcesSelectedId) || {};
  const url = _resGetTopicPreviewUrl(topic);
  const ver = _resGetTopicPreviewVer(topic);
  if (!url) return;

  // Abrir con versión para que si el alumno actualiza, sea consistente
  const withV = _resAppendVersionParam(url, String(ver || 1));
  const abs = _resAbsUrl(withV);
  if (!abs) return;
  window.open(abs, "_blank", "noopener");
}

// Mantengo el nombre de función para no tocar el resto del código
async function adminResourcesUploadPreviewPdf() {
  const ui = ensureResourcesPreviewPdfUi();
  if (!ui) return;

  if (!_resourcesSelectedId) {
    alert("Selecciona un tema antes de guardar la URL del PDF.");
    return;
  }

  const u = ensureResourcesAuth()?.currentUser;
  if (!u) {
    alert("Primero inicia sesión en Biblioteca para poder guardar la URL del PDF.");
    return;
  }

  const rawUrl = String(ui.urlInput?.value || "").trim();
  if (!rawUrl) {
    alert("Pega la URL del PDF (ej. /pdfs/mi-tema.pdf).");
    return;
  }

  const clean = _resStripQueryHash(rawUrl).toLowerCase();
  if (!clean.endsWith(".pdf")) {
    alert("El URL debe apuntar a un archivo .pdf");
    return;
  }

  // Si cambia el URL, subimos versión automáticamente
  const topic = _resourcesTopics.find((t) => t.id === _resourcesSelectedId) || {};
  const prevUrl = _resGetTopicPreviewUrl(topic);
  const prevVer = _resGetTopicPreviewVer(topic);

  const url = rawUrl;
  const ver = (url !== prevUrl) ? Math.max(1, (prevVer || 0) + 1) : Math.max(1, (prevVer || 1));

  setLoadingButton(ui.uploadBtn, true, "Guardar URL");
  try {
    await updateDoc(doc(ensureResourcesDb(), "temas", _resourcesSelectedId), {
      // Nuevo formato recomendado
      previewPdf: {
        url: url,
        version: ver,
        updatedAt: serverTimestamp(),
      },
      // Compatibilidad con versiones anteriores
      previewPdfUrl: url,
      previewPdfVersion: ver,
      previewPdfUpdatedAt: serverTimestamp(),
      // Si antes usabas Storage, limpiamos el path para no confundir
      previewPdfPath: "",
    });

    await loadResourcesTopics();
    const refreshed = _resourcesTopics.find((t) => t.id === _resourcesSelectedId);
    renderResourcesPreviewPdfUi(refreshed || { id: _resourcesSelectedId });

    alert("URL de PDF para vista previa guardada.");
  } catch (err) {
    console.error(err);
    alert("No se pudo guardar. Revisa sesión de biblioteca y reglas de Firestore (temas).");
  } finally {
    setLoadingButton(ui.uploadBtn, false, "Guardar URL");
  }
}

// Mantengo el nombre de función para no tocar el resto del código
async function adminResourcesDeletePreviewPdf() {
  const ui = ensureResourcesPreviewPdfUi();
  if (!ui) return;

  if (!_resourcesSelectedId) {
    alert("Selecciona un tema.");
    return;
  }

  const u = ensureResourcesAuth()?.currentUser;
  if (!u) {
    alert("Primero inicia sesión en Biblioteca.");
    return;
  }

  const topic = _resourcesTopics.find((t) => t.id === _resourcesSelectedId) || {};
  const currentUrl = _resGetTopicPreviewUrl(topic);
  if (!currentUrl) {
    alert("Este tema no tiene URL de vista previa.");
    return;
  }

  const ok = confirm("¿Eliminar la URL del PDF de vista previa de este tema?");
  if (!ok) return;

  setLoadingButton(ui.delBtn, true, "Eliminar URL");
  try {
    await updateDoc(doc(ensureResourcesDb(), "temas", _resourcesSelectedId), {
      previewPdf: { url: "", version: 0, updatedAt: serverTimestamp() },
      previewPdfUrl: "",
      previewPdfVersion: 0,
      previewPdfUpdatedAt: serverTimestamp(),
      previewPdfPath: "",
    });

    if (ui.urlInput) ui.urlInput.value = "";

    await loadResourcesTopics();
    const refreshed = _resourcesTopics.find((t) => t.id === _resourcesSelectedId);
    renderResourcesPreviewPdfUi(refreshed || { id: _resourcesSelectedId });

    alert("URL eliminada.");
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar la URL. Revisa sesión de biblioteca y reglas de Firestore.");
  } finally {
    setLoadingButton(ui.delBtn, false, "Eliminar URL");
  }
}

async function adminResourcesBumpPreviewPdfVersion() {
  const ui = ensureResourcesPreviewPdfUi();
  if (!ui) return;

  if (!_resourcesSelectedId) {
    alert("Selecciona un tema.");
    return;
  }

  const u = ensureResourcesAuth()?.currentUser;
  if (!u) {
    alert("Primero inicia sesión en Biblioteca.");
    return;
  }

  const topic = _resourcesTopics.find((t) => t.id === _resourcesSelectedId) || {};
  const url = _resGetTopicPreviewUrl(topic);
  const prevVer = _resGetTopicPreviewVer(topic);
  if (!url) {
    alert("Primero guarda una URL de PDF.");
    return;
  }

  const ver = Math.max(1, (prevVer || 0) + 1);

  setLoadingButton(ui.bumpBtn, true, "Actualizar versión");
  try {
    await updateDoc(doc(ensureResourcesDb(), "temas", _resourcesSelectedId), {
      previewPdf: { url: url, version: ver, updatedAt: serverTimestamp() },
      previewPdfUrl: url,
      previewPdfVersion: ver,
      previewPdfUpdatedAt: serverTimestamp(),
    });

    await loadResourcesTopics();
    const refreshed = _resourcesTopics.find((t) => t.id === _resourcesSelectedId);
    renderResourcesPreviewPdfUi(refreshed || { id: _resourcesSelectedId });

    alert(`Versión actualizada a v${ver}.`);
  } catch (err) {
    console.error(err);
    alert("No se pudo actualizar la versión.");
  } finally {
    setLoadingButton(ui.bumpBtn, false, "Actualizar versión");
  }
}
function applyResourcesRepasoLabels() {
  // Solo cambia UI visible de la biblioteca
  try {
    const wrap = document.getElementById("admin-resources-topic-exam-wrap");
    if (!wrap) return;
    // Título es el primer div del header interno
    const header = wrap.querySelector("div") || null;
    if (header && /Mini-examen del tema/i.test(header.textContent || "")) {
      header.textContent = "Repaso del tema";
    }
  } catch {}
}

function adminResourcesFillEditor(topic) {
  _resourcesIsNew = false;
  _resourcesSelectedId = topic?.id || null;

  if (resTitleInput) resTitleInput.value = topic?.title || "";
  if (resSpecialtyRawInput) resSpecialtyRawInput.value = topic?.specialty || "";
  if (resEditorStatus) resEditorStatus.textContent = _resourcesSelectedId ? `Editando: ${topic?.title || ""}` : "Editor de tema";

  renderResLinksEditor(topic?.links || []);
  setResEditorEnabled(true);

  // ✅ Vista previa PDF (Storage)
  renderResourcesPreviewPdfUi(topic);

  // ✅ Mini-examen del tema
  adminResourcesLoadTopicExam(_resourcesSelectedId);

  if (resBtnDelete) resBtnDelete.disabled = !_resourcesSelectedId;

  // Estado + history
  if (!_isRestoringNav) {
    adminNavState.panel = "resources";
    adminNavState.view = "resources_detail";
    adminNavState.resourcesTopicId = _resourcesSelectedId;
    adminNavState.resourcesSearch = (resSearchInput?.value || "").toString();
    adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter?.value || "").toString();
    persistAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

/****************************************************
 * BIBLIOTECA (pagina-buena) - Mini-examen por tema
 * Colección: topic_exams/{topicId}
 * Estructura: { topicId, cases:[{caseText, questions:[{questionText, optionA-D, correctOption, justification}]}], updatedAt }
 ****************************************************/
async function adminResourcesLoadTopicExam(topicId) {
  if (!topicId) {
    _resourcesTopicExam = { cases: [] };
    renderResourcesTopicExamEditor();
    return;
  }

  try {
    const db = ensureResourcesDb();
    const ref = doc(db, "topic_exams", String(topicId));
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      _resourcesTopicExam = { cases: [] };
    } else {
      const data = snap.data() || {};
      _resourcesTopicExam = {
        cases: Array.isArray(data.cases) ? data.cases : [],
      };
    }

    renderResourcesTopicExamEditor();
  } catch (err) {
    console.error("Error cargando topic_exams:", err);
    _resourcesTopicExam = { cases: [] };
    renderResourcesTopicExamEditor();
  }
}

function renderResourcesTopicExamEditor() {
  if (!resTopicExamCasesWrap || !resTopicExamEmpty) return;

  const cases = Array.isArray(_resourcesTopicExam?.cases) ? _resourcesTopicExam.cases : [];
  resTopicExamCasesWrap.innerHTML = "";

  if (!cases.length) {
    resTopicExamEmpty.classList.remove("hidden");
    return;
  }

  resTopicExamEmpty.classList.add("hidden");

  cases.forEach((c, ci) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.padding = "10px";
    card.style.marginTop = "10px";

    const questions = Array.isArray(c?.questions) ? c.questions : [];

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-weight:700;font-size:13px;">Caso ${ci + 1}</div>
        <button type="button" class="btn btn-secondary btn-sm" data-te-action="delete-case" data-ci="${ci}">Eliminar caso</button>
      </div>

      <label class="field" style="margin-top:10px;">
        <span>Texto del caso clínico</span>
        <textarea class="te-case-text" data-ci="${ci}" rows="4" placeholder="Escribe el caso clínico...">${escapeHtml(c?.caseText || "")}</textarea>
      </label>

      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-weight:700;font-size:12px;">Preguntas</div>
        <button type="button" class="btn btn-outline btn-sm" data-te-action="add-question" data-ci="${ci}">+ Agregar pregunta</button>
      </div>

      <div class="te-questions" data-ci="${ci}" style="margin-top:8px;"></div>
    `;

    const qWrap = card.querySelector(".te-questions");
    questions.forEach((q, qi) => {
      const qCard = document.createElement("div");
      qCard.className = "card";
      qCard.style.padding = "10px";
      qCard.style.marginTop = "8px";

      qCard.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-weight:700;font-size:12px;">Pregunta ${qi + 1}</div>
          <button type="button" class="btn btn-secondary btn-sm" data-te-action="delete-question" data-ci="${ci}" data-qi="${qi}">Eliminar</button>
        </div>

        <label class="field" style="margin-top:8px;">
          <span>Pregunta</span>
          <textarea class="te-q-text" data-ci="${ci}" data-qi="${qi}" rows="2" placeholder="Texto de la pregunta...">${escapeHtml(q?.questionText || "")}</textarea>
        </label>

        <div class="grid-2" style="margin-top:8px;gap:8px;">
          <label class="field"><span>Opción A</span><input class="te-opt" data-ci="${ci}" data-qi="${qi}" data-opt="A" value="${escapeHtml(q?.optionA || "")}" /></label>
          <label class="field"><span>Opción B</span><input class="te-opt" data-ci="${ci}" data-qi="${qi}" data-opt="B" value="${escapeHtml(q?.optionB || "")}" /></label>
          <label class="field"><span>Opción C</span><input class="te-opt" data-ci="${ci}" data-qi="${qi}" data-opt="C" value="${escapeHtml(q?.optionC || "")}" /></label>
          <label class="field"><span>Opción D</span><input class="te-opt" data-ci="${ci}" data-qi="${qi}" data-opt="D" value="${escapeHtml(q?.optionD || "")}" /></label>
        </div>

        <div class="grid-2" style="margin-top:8px;gap:8px;">
          <label class="field">
            <span>Respuesta correcta</span>
            <select class="te-correct" data-ci="${ci}" data-qi="${qi}">
              <option value="A" ${q?.correctOption === "A" ? "selected" : ""}>A</option>
              <option value="B" ${q?.correctOption === "B" ? "selected" : ""}>B</option>
              <option value="C" ${q?.correctOption === "C" ? "selected" : ""}>C</option>
              <option value="D" ${q?.correctOption === "D" ? "selected" : ""}>D</option>
            </select>
          </label>

          <label class="field">
            <span>Justificación</span>
            <textarea class="te-just" data-ci="${ci}" data-qi="${qi}" rows="2" placeholder="Justificación breve...">${escapeHtml(q?.justification || "")}</textarea>
          </label>
        </div>
      `;
      qWrap.appendChild(qCard);
    });

    resTopicExamCasesWrap.appendChild(card);
  });
}

function adminResourcesAddTopicCase() {
  // ✅ Mantener lo escrito antes de re-render
  adminResourcesSyncTopicExamFromDom();
  if (!_resourcesTopicExam || !Array.isArray(_resourcesTopicExam.cases)) _resourcesTopicExam = { cases: [] };

  _resourcesTopicExam.cases.push({
    caseText: "",
    questions: [
      {
        questionText: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctOption: "A",
        justification: "",
      },
    ],
  });

  renderResourcesTopicExamEditor();
}

function adminResourcesAddTopicQuestion(ci) {
  // ✅ Mantener lo escrito antes de re-render
  adminResourcesSyncTopicExamFromDom();
  const c = _resourcesTopicExam?.cases?.[ci];
  if (!c) return;
  if (!Array.isArray(c.questions)) c.questions = [];
  c.questions.push({
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    justification: "",
  });
  renderResourcesTopicExamEditor();
}

function adminResourcesDeleteTopicCase(ci) {
  // ✅ Mantener lo escrito antes de re-render
  adminResourcesSyncTopicExamFromDom();
  if (!_resourcesTopicExam?.cases) return;
  _resourcesTopicExam.cases.splice(ci, 1);
  renderResourcesTopicExamEditor();
}

function adminResourcesDeleteTopicQuestion(ci, qi) {
  // ✅ Mantener lo escrito antes de re-render
  adminResourcesSyncTopicExamFromDom();
  const c = _resourcesTopicExam?.cases?.[ci];
  if (!c?.questions) return;
  c.questions.splice(qi, 1);
  renderResourcesTopicExamEditor();
}

function adminResourcesSyncTopicExamFromDom() {
  if (!resTopicExamCasesWrap) return;

  const cases = Array.isArray(_resourcesTopicExam?.cases) ? _resourcesTopicExam.cases : [];
  // caseText
  resTopicExamCasesWrap.querySelectorAll(".te-case-text").forEach((el) => {
    const ci = Number(el.dataset.ci);
    if (!Number.isFinite(ci) || !cases[ci]) return;
    cases[ci].caseText = (el.value || "").trim();
  });

  // question text
  resTopicExamCasesWrap.querySelectorAll(".te-q-text").forEach((el) => {
    const ci = Number(el.dataset.ci);
    const qi = Number(el.dataset.qi);
    if (!cases[ci] || !cases[ci].questions?.[qi]) return;
    cases[ci].questions[qi].questionText = (el.value || "").trim();
  });

  // options
  resTopicExamCasesWrap.querySelectorAll(".te-opt").forEach((el) => {
    const ci = Number(el.dataset.ci);
    const qi = Number(el.dataset.qi);
    const opt = el.dataset.opt;
    if (!cases[ci] || !cases[ci].questions?.[qi]) return;
    const v = (el.value || "").trim();
    if (opt === "A") cases[ci].questions[qi].optionA = v;
    if (opt === "B") cases[ci].questions[qi].optionB = v;
    if (opt === "C") cases[ci].questions[qi].optionC = v;
    if (opt === "D") cases[ci].questions[qi].optionD = v;
  });

  // correct
  resTopicExamCasesWrap.querySelectorAll(".te-correct").forEach((el) => {
    const ci = Number(el.dataset.ci);
    const qi = Number(el.dataset.qi);
    if (!cases[ci] || !cases[ci].questions?.[qi]) return;
    const v = String(el.value || "A");
    cases[ci].questions[qi].correctOption = ["A", "B", "C", "D"].includes(v) ? v : "A";
  });

  // justification
  resTopicExamCasesWrap.querySelectorAll(".te-just").forEach((el) => {
    const ci = Number(el.dataset.ci);
    const qi = Number(el.dataset.qi);
    if (!cases[ci] || !cases[ci].questions?.[qi]) return;
    cases[ci].questions[qi].justification = (el.value || "").trim();
  });

  _resourcesTopicExam.cases = cases;
}

async function adminResourcesSaveTopicExam() {
  if (!_resourcesSelectedId) {
    alert("Primero selecciona o guarda un tema.");
    return;
  }

  adminResourcesSyncTopicExamFromDom();

  const cases = Array.isArray(_resourcesTopicExam?.cases) ? _resourcesTopicExam.cases : [];
  // Validación ligera: casoText y preguntas mínimas
  for (let ci = 0; ci < cases.length; ci++) {
    if (!String(cases[ci].caseText || "").trim()) {
      alert(`Falta el texto del caso en Caso ${ci + 1}.`);
      return;
    }
    const qs = Array.isArray(cases[ci].questions) ? cases[ci].questions : [];
    if (!qs.length) {
      alert(`El Caso ${ci + 1} debe tener al menos 1 pregunta.`);
      return;
    }
    for (let qi = 0; qi < qs.length; qi++) {
      const q = qs[qi];
      if (!String(q.questionText || "").trim()) {
        alert(`Falta texto de pregunta en Caso ${ci + 1}, Pregunta ${qi + 1}.`);
        return;
      }
      if (!String(q.optionA || "").trim() || !String(q.optionB || "").trim() || !String(q.optionC || "").trim() || !String(q.optionD || "").trim()) {
        alert(`Faltan opciones en Caso ${ci + 1}, Pregunta ${qi + 1}.`);
        return;
      }
    }
  }

  try {
    const db = ensureResourcesDb();
    const ref = doc(db, "topic_exams", String(_resourcesSelectedId));
    await setDoc(ref, { topicId: String(_resourcesSelectedId), cases, updatedAt: serverTimestamp() }, { merge: true });
    alert("Repaso del tema guardado.");
  } catch (err) {
    console.error(err);
    alert("No se pudo guardar el repaso del tema.");
  }
}

async function adminResourcesDeleteTopicExam() {
  if (!_resourcesSelectedId) return;

  const ok = confirm("¿Eliminar mini-examen de este tema?");
  if (!ok) return;

  try {
    const db = ensureResourcesDb();
    const ref = doc(db, "topic_exams", String(_resourcesSelectedId));
    await deleteDoc(ref);
    _resourcesTopicExam = { cases: [] };
    renderResourcesTopicExamEditor();
    alert("Repaso del tema eliminado.");
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar el repaso del tema.");
  }
}


function adminResourcesOpenList() {
  _resourcesIsNew = false;
  _resourcesSelectedId = null;

  if (resEditorStatus) resEditorStatus.textContent = "Selecciona un tema o crea uno nuevo.";
  if (resTitleInput) resTitleInput.value = "";
  if (resSpecialtyRawInput) resSpecialtyRawInput.value = "";
  renderResLinksEditor([]);
  setResEditorEnabled(false);
  renderResourcesPreviewPdfUi(null);

  if (!_isRestoringNav) {
    adminNavState.panel = "resources";
    adminNavState.view = "resources_list";
    adminNavState.resourcesTopicId = null;
    adminNavState.resourcesSearch = (resSearchInput?.value || "").toString();
    adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter?.value || "").toString();
    persistAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

function adminResourcesOpenNewTopic() {
  _resourcesIsNew = true;
  _resourcesSelectedId = null;

  if (resEditorStatus) resEditorStatus.textContent = "Creando un nuevo tema";
  if (resTitleInput) resTitleInput.value = "";
  if (resSpecialtyRawInput) resSpecialtyRawInput.value = "";
  renderResLinksEditor([]);
  setResEditorEnabled(true);
  renderResourcesPreviewPdfUi(null);
  if (resBtnDelete) resBtnDelete.disabled = true;

  if (!_isRestoringNav) {
    adminNavState.panel = "resources";
    adminNavState.view = "resources_new";
    adminNavState.resourcesTopicId = null;
    adminNavState.resourcesSearch = (resSearchInput?.value || "").toString();
    adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter?.value || "").toString();
    persistAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

function adminResourcesSelectTopic(topicId) {
  const t = _resourcesTopics.find((x) => x.id === topicId);
  if (!t) {
    adminResourcesOpenList();
    return;
  }
  adminResourcesFillEditor(t);
  renderResTopicList();
}

async function loadResourcesTopics() {
  const rdb = ensureResourcesDb();
  const q = query(collection(rdb, "temas"), orderBy("title", "asc"));
  const snap = await getDocs(q);
  _resourcesTopics = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  renderResTopicList();
  renderResTopicCount();
}

async function ensureResourcesAdminLoaded() {
  if (_resourcesLoadedOnce) return;
  _resourcesLoadedOnce = true;

  // Pre-carga filtros desde estado persistido
  if (resSearchInput && adminNavState.resourcesSearch) resSearchInput.value = adminNavState.resourcesSearch;
  if (resSpecialtyFilter && adminNavState.resourcesSpecialtyKey) resSpecialtyFilter.value = adminNavState.resourcesSpecialtyKey;

    // Auth para edición (Firestore rules exigen request.auth para create/update/delete)
  try {
    if (resAuthEmailInput && !resAuthEmailInput.value) {
      resAuthEmailInput.value = auth?.currentUser?.email || "";
    }

    // Actualiza UI cuando cambia sesión de la biblioteca
    onAuthStateChanged(ensureResourcesAuth(), () => {
      updateResourcesAuthUi();
      // Re-render de recuadro PDF según sesión
      const t = _resourcesTopics.find((x) => x.id === _resourcesSelectedId) || null;
      renderResourcesPreviewPdfUi(t);
    });
    updateResourcesAuthUi();

    resAuthBtnLogin?.addEventListener("click", async () => {
      const email = (resAuthEmailInput?.value || "").toString().trim();
      const pass = (resAuthPasswordInput?.value || "").toString();
      if (!email || !pass) {
        alert("Ingresa email y contraseña para editar la biblioteca.");
        return;
      }

      setLoadingButton(resAuthBtnLogin, true, "Iniciar sesión");
      try {
        await signInWithEmailAndPassword(ensureResourcesAuth(), email, pass);
        if (resAuthPasswordInput) resAuthPasswordInput.value = "";
        updateResourcesAuthUi();
      } catch (e) {
        console.error("Error login biblioteca:", e);
        alert("No se pudo iniciar sesión en la biblioteca. Revisa credenciales y reglas.");
      } finally {
        setLoadingButton(resAuthBtnLogin, false, "Iniciar sesión");
      }
    });

    resAuthBtnLogout?.addEventListener("click", async () => {
      try {
        await signOut(ensureResourcesAuth());
        updateResourcesAuthUi();
      } catch (e) {
        console.error("Error cerrando sesión biblioteca:", e);
      }
    });
  } catch (e) {
    console.error("No se pudo inicializar auth de biblioteca:", e);
  }
// Bind eventos (una sola vez)

// ✅ Inserta recuadro de PDF + aplica etiqueta "Repaso del tema"
ensureResourcesPreviewPdfUi();
applyResourcesRepasoLabels();

// Eventos PDF (solo se ejecutan una vez)
const __pdfUi = ensureResourcesPreviewPdfUi();
__pdfUi?.uploadBtn?.addEventListener("click", adminResourcesUploadPreviewPdf);
__pdfUi?.delBtn?.addEventListener("click", adminResourcesDeletePreviewPdf);
__pdfUi?.openBtn?.addEventListener("click", adminResourcesOpenPreviewPdf);
__pdfUi?.bumpBtn?.addEventListener("click", adminResourcesBumpPreviewPdfVersion);

  resBtnRefresh?.addEventListener("click", async () => {
    await loadResourcesTopics();
  });

  resBtnNewTopic?.addEventListener("click", () => {
    adminResourcesOpenNewTopic();
    renderResTopicList();
  });

  resBtnBack?.addEventListener("click", () => {
    const st = history.state?.adminNav;
    if (st && (st.view === "resources_detail" || st.view === "resources_new")) {
      history.back();
      return;
    }
    adminResourcesOpenList();
    renderResTopicList();
  });

  resSearchInput?.addEventListener("input", () => {
    if (!_isRestoringNav) {
      adminNavState.resourcesSearch = (resSearchInput.value || "").toString();
      persistAdminNavState();
    }
    renderResTopicList();
  });

  resSpecialtyFilter?.addEventListener("change", () => {
    if (!_isRestoringNav) {
      adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter.value || "").toString();
      persistAdminNavState();
    }
    renderResTopicList();
  });

  resBtnAddLink?.addEventListener("click", () => {
    // Si estaba vacío, limpia el mensaje y crea la primera fila
    if (!resLinksWrap.querySelector("[data-res-link-row]")) {
      resLinksWrap.innerHTML = "";
    }
    renderResLinksEditor([...getResLinksFromEditor(), { label: "", url: "", type: "link" }]);
  });

  resBtnSave?.addEventListener("click", async () => {
    if (!ensureResourcesAuth().currentUser) {
      if (resEditorStatus) resEditorStatus.textContent = "Para guardar necesitas iniciar sesión en la biblioteca.";
      resAuthBox?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const title = (resTitleInput?.value || "").toString().trim();
    const specialty = (resSpecialtyRawInput?.value || "").toString().trim();
    const links = getResLinksFromEditor();

    if (!title) {
      if (resEditorStatus) resEditorStatus.textContent = "El título es obligatorio."; 
      return;
    }

    const rdb = ensureResourcesDb();
    const payload = {
      title,
      specialty,
      links,
      updatedAt: serverTimestamp(),
    };

    setLoadingButton(resBtnSave, true, "Guardar");
    try {
      if (_resourcesSelectedId && !_resourcesIsNew) {
        await updateDoc(doc(rdb, "temas", _resourcesSelectedId), payload);
      } else {
        payload.createdAt = serverTimestamp();
        const created = await addDoc(collection(rdb, "temas"), payload);
        _resourcesSelectedId = created.id;
        _resourcesIsNew = false;
      }

      await loadResourcesTopics();

      if (_resourcesSelectedId) {
        adminResourcesSelectTopic(_resourcesSelectedId);
      } else {
        adminResourcesOpenList();
      }
    } catch (err) {
      console.error(err);
      if (resEditorStatus) resEditorStatus.textContent = "No se pudo guardar el tema.";
    } finally {
      setLoadingButton(resBtnSave, false, "Guardar");
    }
  });

  resBtnDelete?.addEventListener("click", async () => {
    if (!_resourcesSelectedId || _resourcesIsNew) return;

    if (!ensureResourcesAuth().currentUser) {
      if (resEditorStatus) resEditorStatus.textContent = "Para eliminar necesitas iniciar sesión en la biblioteca.";
      resAuthBox?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Confirmación sin ventanas emergentes: doble click en <= 6s
    if (!_resourcesDeleteArmed) {
      _resourcesDeleteArmed = true;
      if (resEditorStatus) resEditorStatus.textContent = 'Confirma eliminación: pulsa "Eliminar" otra vez (6s).';
      if (_resourcesDeleteArmTimer) clearTimeout(_resourcesDeleteArmTimer);
      _resourcesDeleteArmTimer = setTimeout(() => {
        _resourcesDeleteArmed = false;
        _resourcesDeleteArmTimer = null;
        if (resEditorStatus) resEditorStatus.textContent = "Eliminación cancelada.";
      }, 6000);
      return;
    }

    _resourcesDeleteArmed = false;
    if (_resourcesDeleteArmTimer) clearTimeout(_resourcesDeleteArmTimer);
    _resourcesDeleteArmTimer = null;

    const rdb = ensureResourcesDb();
    setLoadingButton(resBtnDelete, true, "Eliminar");
    try {
      await deleteDoc(doc(rdb, "temas", _resourcesSelectedId));
      _resourcesSelectedId = null;
      _resourcesIsNew = false;
      await loadResourcesTopics();
      adminResourcesOpenList();
      renderResTopicList();
      if (resEditorStatus) resEditorStatus.textContent = "Tema eliminado.";
    } catch (err) {
      console.error(err);
      if (resEditorStatus) resEditorStatus.textContent = "No se pudo eliminar el tema.";
    } finally {
      setLoadingButton(resBtnDelete, false, "Eliminar");
    }
  });

  // ✅ Mini-examen del tema (topic_exams)
  resTopicExamBtnAddCase?.addEventListener("click", () => {
    adminResourcesAddTopicCase();
  });

  resTopicExamBtnSave?.addEventListener("click", async () => {
    await adminResourcesSaveTopicExam();
  });

  resTopicExamBtnDelete?.addEventListener("click", async () => {
    await adminResourcesDeleteTopicExam();
  });

  // Event delegation (agregar/eliminar dentro de casos)
  resTopicExamCasesWrap?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-te-action]");
    if (!btn) return;
    const action = btn.dataset.teAction;
    const ci = Number(btn.dataset.ci);
    const qi = Number(btn.dataset.qi);

    if (action === "add-question") adminResourcesAddTopicQuestion(ci);
    if (action === "delete-case") adminResourcesDeleteTopicCase(ci);
    if (action === "delete-question") adminResourcesDeleteTopicQuestion(ci, qi);
  });



  // Cargar datos
  await loadResourcesTopics();
  adminResourcesOpenList();
}

function escapeHtml(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, "&#096;");
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
 * MODAL GENÉRICO (SE CONSERVA PARA SECCIONES/USUARIOS/ETC)
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
 * HELPERS: normalización y labels
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

// ✅ util: identifica si un doc de questions es "banco" (no es caso dentro de un examen)
function isBankCaseDoc(data) {
  const ex = (data?.examId || "").toString().trim();
  return !ex; // banco = sin examId
}

/****************************************************
 * ✅ BLOQUEO DUPLICADOS: sets por bankCaseId
 ****************************************************/

function getCurrentExamBankCaseIdsSet() {
  const set = new Set();
  (currentExamCases || []).forEach((c) => {
    if (c && c.bankCaseId) set.add(c.bankCaseId);
  });
  return set;
}

function getMiniBankCaseIdsSet() {
  const set = new Set();
  (miniCases || []).forEach((c) => {
    if (c && c.bankCaseId) set.add(c.bankCaseId);
  });
  return set;
}

/****************************************************
 * ✅ usageCount robusto: delta helpers
 ****************************************************/

function countIds(arr) {
  const m = new Map();
  (arr || []).forEach((id) => {
    if (!id) return;
    m.set(id, (m.get(id) || 0) + 1);
  });
  return m;
}

async function applyUsageDelta(prevIds, newIds) {
  const prevMap = countIds(prevIds);
  const newMap = countIds(newIds);

  const allIds = new Set([...prevMap.keys(), ...newMap.keys()]);
  const updates = [];

  allIds.forEach((id) => {
    const delta = (newMap.get(id) || 0) - (prevMap.get(id) || 0);
    if (delta !== 0) {
      updates.push(
        updateDoc(doc(db, "questions", id), {
          usageCount: increment(delta),
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn("No se pudo ajustar usageCount:", id, e))
      );
    }
  });

  if (updates.length) {
    await Promise.all(updates);
  }

  // refrescar cache de buscadores para que usageCount se vea actualizado
  resetBankCasesSearchCache();
}


function resetBankCasesSearchCache() {
  bankCasesCache = [];
  bankCasesById = new Map();
  bankCasesLoadedOnce = false;
  bankCasesAllLoaded = false;
  bankCasesLastDoc = null;
  bankCasesScanCount = 0;
  bankCasesOrderMode = "createdAt";
  bankCasesLoading = false;
}

/****************************************************
 * BUSCADOR DE BANCO PARA AGREGAR CASOS A EXAMEN Y MINI
 * ✅ usa "questions" (solo casos banco: sin examId)
 ****************************************************/


async function loadMoreBankCasesFromFirestore(batchSize = BANK_SEARCH_BATCH_SIZE) {
  if (bankCasesLoading || bankCasesAllLoaded) return { added: [], scanned: 0 };

  // Tope duro (petición del usuario: hasta ~10,000 casos banco)
  if (bankCasesCache.length >= BANK_SEARCH_MAX_BANK_CASES) {
    bankCasesAllLoaded = true;
    return { added: [], scanned: 0 };
  }

  bankCasesLoading = true;

  try {
    let qBase;

    // Preferimos orden por createdAt; si falla, caemos a documentId
    try {
      qBase = query(
        collection(db, "questions"),
        orderBy("createdAt", "desc"),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        limit(batchSize)
      );
      bankCasesOrderMode = "createdAt";
    } catch (e1) {
      qBase = query(
        collection(db, "questions"),
        orderBy(documentId()),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        limit(batchSize)
      );
      bankCasesOrderMode = "name";
    }

    const snap = await getDocs(qBase);

    if (!snap || !snap.docs || !snap.docs.length) {
      bankCasesAllLoaded = true;
      return { added: [], scanned: 0 };
    }

    bankCasesLastDoc = snap.docs[snap.docs.length - 1];
    bankCasesScanCount += snap.size;

    // Convertir y filtrar solo casos "banco" (= sin examId)
    const added = [];

    for (const d of snap.docs) {
      if (!d || !d.id) continue;
      if (bankCasesById.has(d.id)) continue;

      const data = d.data() || {};
      const withId = { id: d.id, ...data };

      if (!isBankCaseDoc(withId)) continue;

      const questionsArr = Array.isArray(withId.questions) ? withId.questions : [];
      const topicTxt = (withId.topic || "").toString();

      const entry = {
        ...withId,
        questions: questionsArr,
        topic: topicTxt,
        _normCase: normalizeText(withId.caseText || ""),
        _normTopic: normalizeText(topicTxt),
        _normSpec: normalizeText(withId.specialty || ""),
        _normQs: normalizeText(questionsArr.map((q) => q.questionText || "").join(" ")),
      };

      bankCasesById.set(entry.id, entry);
      bankCasesCache.push(entry);
      added.push(entry);

      if (bankCasesCache.length >= BANK_SEARCH_MAX_BANK_CASES) {
        bankCasesAllLoaded = true;
        break;
      }
    }

    // Si el lote fue menor al solicitado, probablemente llegamos al final
    if (snap.size < batchSize) bankCasesAllLoaded = true;

    bankCasesLoadedOnce = true;
    return { added, scanned: snap.size };
  } catch (err) {
    console.error("Error cargando banco incremental:", err);
    // degradar a "allLoaded" para que no se quede en loop
    bankCasesAllLoaded = true;
    return { added: [], scanned: 0 };
  } finally {
    bankCasesLoading = false;
  }
}

async function loadBankCasesIfNeeded() {
  // Carga mínima inicial para mostrar que el banco está disponible.
  if (bankCasesLoadedOnce) return;

  if (!bankSearchResults && !miniBankSearchResults) return;

  const target = bankSearchResults || miniBankSearchResults;

  target.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      Cargando banco de casos (modo incremental)…
    </div>
  `;

  await loadMoreBankCasesFromFirestore(BANK_SEARCH_BATCH_SIZE);

  // Mensaje inicial
  const msg = bankCasesCache.length
    ? `Banco listo. Escribe para buscar. (Cargados: ${bankCasesCache.length} · Escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · seguirá cargando según tu búsqueda"})`
    : "No se encontraron casos en el banco.";

  if (bankSearchResults) renderEmptyMessage(bankSearchResults, msg);
  if (miniBankSearchResults) renderEmptyMessage(miniBankSearchResults, msg);
}

function tokenizeBankSearch(rawQuery) {
  const q = normalizeText(rawQuery);
  if (!q) return [];
  const tokens = q.split(" ").filter((t) => t.length >= 2);
  return tokens.slice(0, 6); // tope para evitar queries demasiado costosas
}

function bankCaseMatchesTokens(c, tokens) {
  if (!tokens || !tokens.length) return false;
  const haystack = `${c._normTopic} ${c._normSpec} ${c._normCase} ${c._normQs}`;
  return tokens.every((t) => haystack.includes(t));
}

function searchBankCases(rawQuery, maxResults = BANK_SEARCH_MAX_RESULTS) {
  const tokens = tokenizeBankSearch(rawQuery);
  if (!tokens.length) return [];

  const results = [];
  for (const c of bankCasesCache) {
    if (bankCaseMatchesTokens(c, tokens)) results.push(c);
    if (results.length >= maxResults) break;
  }
  return results;
}

async function searchBankCasesAsync(rawQuery, opts = {}) {
  const maxResults = Number(opts.maxResults || BANK_SEARCH_MAX_RESULTS);
  const batchSize = Number(opts.batchSize || BANK_SEARCH_BATCH_SIZE);
  const cancelFn = typeof opts.isCancelled === "function" ? opts.isCancelled : () => false;

  const tokens = tokenizeBankSearch(rawQuery);
  if (!tokens.length) {
    return {
      results: [],
      meta: {
        tokens: 0,
        cached: bankCasesCache.length,
        scanned: bankCasesScanCount,
        allLoaded: bankCasesAllLoaded,
      },
    };
  }

  // 1) buscar en cache actual
  let results = [];
  for (const c of bankCasesCache) {
    if (cancelFn()) return { results: [], meta: { cancelled: true } };
    if (bankCaseMatchesTokens(c, tokens)) results.push(c);
    if (results.length >= maxResults) break;
  }

  // 2) si no hay suficientes resultados, seguir cargando lotes hasta:
  //    a) llegar al tope de resultados, o b) escanear todo (para ser "correcto")
  while (!bankCasesAllLoaded && results.length < maxResults) {
    if (cancelFn()) return { results: [], meta: { cancelled: true } };

    const { added } = await loadMoreBankCasesFromFirestore(batchSize);
    if (cancelFn()) return { results: [], meta: { cancelled: true } };

    if (!added || !added.length) {
      // Sin nuevos -> fin
      break;
    }

    for (const c of added) {
      if (bankCaseMatchesTokens(c, tokens)) results.push(c);
      if (results.length >= maxResults) break;
    }
  }

  // Dedup + cap
  const seen = new Set();
  results = results.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  results = results.slice(0, maxResults);

  return {
    results,
    meta: {
      tokens: tokens.length,
      cached: bankCasesCache.length,
      scanned: bankCasesScanCount,
      allLoaded: bankCasesAllLoaded,
      capped: results.length >= maxResults && !bankCasesAllLoaded,
    },
  };
}
function renderBankSearchResults(results, queryText, meta = null) {
  if (!bankSearchResults) return;

  if (!queryText) {
    const baseMsg = bankCasesLoadedOnce
      ? `Banco listo. Escribe un tema arriba para buscar (cargados: ${bankCasesCache.length}).`
      : "Escribe un tema para buscar.";

    const stats = meta
      ? ` Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " (cargando según búsqueda)"}`
      : "";

    renderEmptyMessage(bankSearchResults, baseMsg + stats);
    return;
  }

  if (!results.length) {
    renderEmptyMessage(
      bankSearchResults,
      `Sin resultados para "${queryText}". Prueba con otro término.`
    );
    return;
  }

  // ✅ set de ya agregados en este examen (por bankCaseId = id del doc banco)
  const usedSet = getCurrentExamBankCaseIdsSet();

  const statsBar = meta ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af;">
      Coincidencias: ${results.length}${meta.capped ? " (mostrando primeras coincidencias; refina búsqueda)" : ""} · Cargados: ${meta.cached ?? bankCasesCache.length} · Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " · buscando…"}
    </div>
  ` : "";

  const html = statsBar + results
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
      const snippet = (c.caseText || "").slice(0, 220);
      const topicTxt = (c.topic || "").toString();
      const usage = typeof c.usageCount === "number" ? c.usageCount : 0;

      const isUsed = usedSet.has(c.id);
      const reviewed = !!c.reviewed;

      return `
        <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <span>${topicTxt ? topicTxt : (specLabel ? specLabel : "Caso del banco")}</span>
                <span class="badge ${reviewed ? "badge--success" : "badge--muted"} admin-review-badge" data-id="${c.id}">
                  ${reviewed ? "✓ Revisado" : "○ Sin revisar"}
                </span>
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${specLabel ? specLabel : "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"} · Usado: ${usage}
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-sm ${reviewed ? "btn-success" : "btn-outline"} admin-bank-toggle-reviewed" data-id="${c.id}" data-reviewed="${reviewed ? "1" : "0"}">
                ${reviewed ? "✓ Revisado" : "Marcar ✓"}
              </button>
              <button class="btn btn-sm btn-primary admin-bank-add-case" data-id="${c.id}" ${isUsed ? "disabled" : ""}>
                ${isUsed ? "Ya está en este examen" : "Agregar a este examen"}
              </button>
            </div>
          </div>

          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .join("");

  bankSearchResults.innerHTML = html;

  // ✅ Botón de palomita (revisado) dentro del buscador
  bankSearchResults
    .querySelectorAll(".admin-bank-toggle-reviewed")
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const current = btn.dataset.reviewed === "1";
        await setBankCaseReviewed(id, !current);
      });
    });

  bankSearchResultsbankSearchResults
    .querySelectorAll(".admin-bank-add-case")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const found = bankCasesById.get(id) || bankCasesCache.find((x) => x.id === id);
        if (!found) return;

        if (!currentExamId) {
          alert("Primero abre un examen.");
          return;
        }

        // ✅ bloqueo duro (por si el UI no alcanzó a refrescar)
        syncCurrentExamCasesFromDOM();
        const usedNow = getCurrentExamBankCaseIdsSet();
        if (usedNow.has(id)) {
          alert("Ese caso ya está agregado en este examen. No se puede repetir.");
          return;
        }

        const cloned = {
          bankCaseId: found.id, // ✅ persistente
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

        btn.textContent = "Agregado";
        btn.disabled = true;
      });
    });
}

function initBankSearchUI() {
  if (!bankSearchInput || !bankSearchResults) return;
  if (bankSearchInput.dataset.bound === "1") return;
  bankSearchInput.dataset.bound = "1";

  bankSearchInput.addEventListener("input", () => {
    if (bankSearchDebounceTimer) clearTimeout(bankSearchDebounceTimer);
    bankSearchDebounceTimer = setTimeout(async () => {
      const raw = bankSearchInput.value || "";
      const trimmed = raw.trim();
      const myToken = ++bankSearchRunToken;

      if (!trimmed) {
        renderBankSearchResults([], "", { scanned: bankCasesScanCount, cached: bankCasesCache.length, allLoaded: bankCasesAllLoaded });
        return;
      }

      // feedback inmediato
      renderEmptyMessage(
        bankSearchResults,
        `Buscando "${escapeHtml(trimmed)}"… (cargados: ${bankCasesCache.length} · escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · buscando en todo el banco"})`
      );

      const { results, meta } = await searchBankCasesAsync(trimmed, {
        maxResults: BANK_SEARCH_MAX_RESULTS,
        batchSize: BANK_SEARCH_BATCH_SIZE,
        isCancelled: () => myToken !== bankSearchRunToken,
      });

      if (myToken !== bankSearchRunToken) return;

      renderBankSearchResults(results, trimmed, meta);
    }, 320);
  });
}

function resetBankSearchUI() {
  if (bankSearchInput) bankSearchInput.value = "";
  if (bankSearchResults) bankSearchResults.innerHTML = "";
}

/****************************************************
 * ✅ BUSCADOR DE BANCO PARA MINI EXÁMENES (mismo banco cache)
 ****************************************************/

function renderMiniBankSearchResults(results, queryText, meta = null) {
  if (!miniBankSearchResults) return;

  if (!queryText) {
    const baseMsg = bankCasesLoadedOnce
      ? `Banco listo. Escribe para buscar (cargados: ${bankCasesCache.length}).`
      : "Escribe para buscar.";

    const stats = meta
      ? ` Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " (cargando según búsqueda)"}`
      : "";

    renderEmptyMessage(miniBankSearchResults, baseMsg + stats);
    return;
  }

  if (!results.length) {
    renderEmptyMessage(
      miniBankSearchResults,
      `Sin resultados para "${queryText}". Prueba con otro término.`
    );
    return;
  }

  const usedSet = getMiniBankCaseIdsSet();

  const statsBar = meta ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af;">
      Coincidencias: ${results.length}${meta.capped ? " (mostrando primeras coincidencias; refina búsqueda)" : ""} · Cargados: ${meta.cached ?? bankCasesCache.length} · Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " · buscando…"}
    </div>
  ` : "";

  const html = statsBar + results
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
      const snippet = (c.caseText || "").slice(0, 220);
      const topicTxt = (c.topic || "").toString();
      const usage = typeof c.usageCount === "number" ? c.usageCount : 0;

      const isUsed = usedSet.has(c.id);
      const reviewed = !!c.reviewed;

      return `
        <div class="card-item" style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <span>${topicTxt ? topicTxt : (specLabel ? specLabel : "Caso del banco")}</span>
                <span class="badge ${reviewed ? "badge--success" : "badge--muted"} admin-review-badge" data-id="${c.id}">
                  ${reviewed ? "✓ Revisado" : "○ Sin revisar"}
                </span>
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${specLabel ? specLabel : "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"} · Usado: ${usage}
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button class="btn btn-sm ${reviewed ? "btn-success" : "btn-outline"} admin-bank-toggle-reviewed" data-id="${c.id}" data-reviewed="${reviewed ? "1" : "0"}">
                ${reviewed ? "✓ Revisado" : "Marcar ✓"}
              </button>
              <button class="btn btn-sm btn-primary admin-mini-bank-add-case" data-id="${c.id}" ${isUsed ? "disabled" : ""}>
                ${isUsed ? "Ya está en mini" : "Agregar a mini exámenes"}
              </button>
            </div>
          </div>

          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .join("");

  miniBankSearchResults.innerHTML = html;

  // ✅ Botón de palomita (revisado) dentro del buscador (mini)
  miniBankSearchResults
    .querySelectorAll(".admin-bank-toggle-reviewed")
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const current = btn.dataset.reviewed === "1";
        await setBankCaseReviewed(id, !current);
      });
    });

  miniBankSearchResults
    .querySelectorAll(".admin-mini-bank-add-case")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const found = bankCasesById.get(id) || bankCasesCache.find((x) => x.id === id);
        if (!found) return;

        syncMiniCasesFromDOM();

        const usedNow = getMiniBankCaseIdsSet();
        if (usedNow.has(id)) {
          alert("Ese caso ya está agregado en mini exámenes. No se puede repetir.");
          return;
        }

        const cloned = {
          id: null,
          bankCaseId: found.id, // ✅ persistente
          caseText: found.caseText || "",
          specialty: found.specialty || "",
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

        miniCases.push(cloned);
        renderMiniCases();

        btn.textContent = "Agregado";
        btn.disabled = true;
      });
    });
}

function initMiniBankSearchUI() {
  if (!miniBankSearchInput || !miniBankSearchResults) return;
  if (miniBankSearchInput.dataset.bound === "1") return;
  miniBankSearchInput.dataset.bound = "1";

  miniBankSearchInput.addEventListener("input", () => {
    if (miniBankSearchDebounceTimer) clearTimeout(miniBankSearchDebounceTimer);

    miniBankSearchDebounceTimer = setTimeout(async () => {
      const raw = miniBankSearchInput.value || "";
      const trimmed = raw.trim();
      const myToken = ++miniBankSearchRunToken;

      if (!trimmed) {
        renderMiniBankSearchResults([], "", { scanned: bankCasesScanCount, cached: bankCasesCache.length, allLoaded: bankCasesAllLoaded });
        return;
      }

      renderEmptyMessage(
        miniBankSearchResults,
        `Buscando "${escapeHtml(trimmed)}"… (cargados: ${bankCasesCache.length} · escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · buscando en todo el banco"})`
      );

      const { results, meta } = await searchBankCasesAsync(trimmed, {
        maxResults: BANK_SEARCH_MAX_RESULTS,
        batchSize: BANK_SEARCH_BATCH_SIZE,
        isCancelled: () => myToken !== miniBankSearchRunToken,
      });

      if (myToken !== miniBankSearchRunToken) return;

      renderMiniBankSearchResults(results, trimmed, meta);
    }, 320);
  });
}

function resetMiniBankSearchUI() {
  if (miniBankSearchInput) miniBankSearchInput.value = "";
  if (miniBankSearchResults) miniBankSearchResults.innerHTML = "";
}


/****************************************************
 * ✅ GENERADOR AUTOMÁTICO DE EXÁMENES (POR TEMAS + CUPOS POR ESPECIALIDAD/SUBTIPO)
 * - No altera el flujo existente: solo rellena currentExamCases y renderiza.
 * - Prioriza casos con menor usageCount.
 ****************************************************/

function buildAutoGenTargetRow(initial = {}) {
  if (!autoGenTargetsWrap) return null;

  const row = document.createElement("div");
  row.className = "auto-gen-row";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1.4fr 1.2fr 0.8fr auto";
  row.style.gap = "8px";
  row.style.alignItems = "end";
  row.style.marginTop = "10px";

  const specialtyValue = initial.specialty || Object.keys(SPECIALTIES)[0] || "";
  const subtypeValue = initial.subtype || "urgencias";
  const countValue = typeof initial.count === "number" ? initial.count : 0;

  row.innerHTML = `
    <label class="field" style="margin:0;">
      <span>Especialidad</span>
      <select class="auto-gen-specialty">
        ${Object.entries(SPECIALTIES)
          .map(([k, label]) => `<option value="${k}" ${k === specialtyValue ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </label>

    <label class="field" style="margin:0;">
      <span>Subtipo</span>
      <select class="auto-gen-subtype">
        ${Object.entries(SUBTYPES)
          .map(([k, label]) => `<option value="${k}" ${k === subtypeValue ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </label>

    <label class="field" style="margin:0;">
      <span># preguntas</span>
      <input class="auto-gen-count" type="number" min="0" step="1" value="${countValue}" />
    </label>

    <button type="button" class="btn btn-outline btn-sm auto-gen-remove" style="height:40px;">
      Quitar
    </button>
  `;

  row.querySelector(".auto-gen-remove")?.addEventListener("click", () => {
    row.remove();
    renderAutoGenSummary();
  });

  row.querySelectorAll("select,input").forEach((el) => {
    el.addEventListener("change", renderAutoGenSummary);
    el.addEventListener("input", renderAutoGenSummary);
  });

  return row;
}

function getAutoGenTargetsFromUI() {
  if (!autoGenTargetsWrap) return [];
  const rows = autoGenTargetsWrap.querySelectorAll(".auto-gen-row");
  const targets = [];
  rows.forEach((r) => {
    const specialty = r.querySelector(".auto-gen-specialty")?.value || "";
    const subtype = r.querySelector(".auto-gen-subtype")?.value || "";
    const count = Number(r.querySelector(".auto-gen-count")?.value || 0);

    if (!specialty || !subtype) return;
    if (!Number.isFinite(count) || count <= 0) return;

    targets.push({ specialty, subtype, count });
  });
  return targets;
}

function parseAutoGenTopicQueries(raw) {
  const txt = (raw || "").toString().trim();
  if (!txt) return [];
  const lines = txt
    .split(/\n|\r/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Cada línea es un query; si hay una sola línea con comas, también se permite
  if (lines.length === 1 && lines[0].includes(",")) {
    return lines[0]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((q) => tokenizeBankSearch(q));
  }

  return lines.map((q) => tokenizeBankSearch(q));
}

function bankCaseMatchesAnyTopicQuery(bankCase, topicQueriesTokens) {
  if (!topicQueriesTokens || !topicQueriesTokens.length) return true;
  return topicQueriesTokens.some((tokens) => tokens.length && bankCaseMatchesTokens(bankCase, tokens));
}

function renderAutoGenSummary() {
  if (!autoGenSummary) return;

  const targets = getAutoGenTargetsFromUI();
  const total = targets.reduce((acc, t) => acc + t.count, 0);

  if (!targets.length) {
    autoGenSummary.innerHTML = `
      <div style="font-size:12px;color:#9ca3af;">
        Agrega al menos un objetivo (especialidad + subtipo + # preguntas).
      </div>
    `;
    return;
  }

  // Agrupar por especialidad
  const bySpec = {};
  targets.forEach((t) => {
    if (!bySpec[t.specialty]) bySpec[t.specialty] = [];
    bySpec[t.specialty].push(t);
  });

  const lines = Object.entries(bySpec).map(([spec, items]) => {
    const specLabel = getSpecialtyLabel(spec);
    const parts = items
      .map((it) => `${SUBTYPES[it.subtype] || it.subtype}: ${it.count}`)
      .join(" · ");
    return `<div style="margin-top:6px;"><b>${escapeHtml(specLabel || spec)}</b>: ${escapeHtml(parts)}</div>`;
  });

  autoGenSummary.innerHTML = `
    <div style="font-size:12px;color:#9ca3af;">
      Total objetivo: <b style="color:#e5e7eb;">${total}</b> preguntas
      ${lines.join("")}
    </div>
  `;
}

async function ensureBankLoadedForGenerator(minCandidates = 1) {
  // Asegura que haya cache inicial
  await loadBankCasesIfNeeded();

  // Si ya hay suficientes en cache o ya se cargó todo, OK.
  if (bankCasesAllLoaded || bankCasesCache.length >= minCandidates) return;

  // Degradar: cargar unos lotes extra.
  let guard = 0;
  while (!bankCasesAllLoaded && bankCasesCache.length < minCandidates && guard < 25) {
    guard++;
    await loadMoreBankCasesFromFirestore(BANK_SEARCH_BATCH_SIZE);
  }
}

function computeSubtypeCountsForCaseQuestions(questionsArr) {
  const counts = { salud_publica: 0, medicina_familiar: 0, urgencias: 0 };
  (questionsArr || []).forEach((q) => {
    const st = (q && q.subtype) ? q.subtype : "salud_publica";
    if (counts[st] === undefined) counts[st] = 0;
    counts[st] += 1;
  });
  return counts;
}

function cloneBankCaseForExam(bankCase, keptIdxs) {
  const allQs = Array.isArray(bankCase.questions) ? bankCase.questions : [];
  const idxs = Array.isArray(keptIdxs) && keptIdxs.length ? keptIdxs : allQs.map((_, i) => i);

  const pickedQs = idxs.map((i) => allQs[i]).filter(Boolean).map((q) => ({
    questionText: q.questionText || "",
    optionA: q.optionA || "",
    optionB: q.optionB || "",
    optionC: q.optionC || "",
    optionD: q.optionD || "",
    correctOption: q.correctOption || "",
    justification: q.justification || "",
    subtype: q.subtype || "salud_publica",
    difficulty: q.difficulty || "media",
  }));

  // Seguridad: mínimo 2 preguntas por caso (requisito del usuario)
  if (pickedQs.length < 2) {
    // fallback: no clonar
    return null;
  }

  return {
    bankCaseId: bankCase.id,
    caseText: bankCase.caseText || "",
    specialty: bankCase.specialty || "",
    topic: (bankCase.topic || "").toString(),
    questions: pickedQs,
  };
}

function buildRemainingMap(targets) {
  const remaining = new Map();
  targets.forEach((t) => {
    const key = `${t.specialty}|${t.subtype}`;
    remaining.set(key, (remaining.get(key) || 0) + Number(t.count || 0));
  });
  return remaining;
}

function remainingTotal(remainingMap) {
  let total = 0;
  for (const v of remainingMap.values()) total += v;
  return total;
}

function remainingForSpecialty(remainingMap, specialty) {
  let total = 0;
  for (const [k, v] of remainingMap.entries()) {
    if (k.startsWith(`${specialty}|`)) total += v;
  }
  return total;
}

function canFitVariant(remainingMap, specialty, contribCounts) {
  for (const [subtype, c] of Object.entries(contribCounts)) {
    const need = remainingMap.get(`${specialty}|${subtype}`) || 0;
    if (c > need) return false;
  }
  return true;
}

function applyVariant(remainingMap, specialty, contribCounts) {
  for (const [subtype, c] of Object.entries(contribCounts)) {
    const key = `${specialty}|${subtype}`;
    const need = remainingMap.get(key) || 0;
    remainingMap.set(key, Math.max(0, need - c));
  }
}

function pickBestVariantForCase(bankCase, remainingMap) {
  const qs = Array.isArray(bankCase.questions) ? bankCase.questions : [];
  if (qs.length < 2) return null;

  const variants = [];
  if (qs.length === 2) {
    variants.push([0, 1]);
  } else if (qs.length >= 3) {
    variants.push([0, 1, 2], [0, 1], [0, 2], [1, 2]);
  }

  const spec = bankCase.specialty || "";
  if (!spec) return null;

  let best = null;

  for (const idxs of variants) {
    const pickedQs = idxs.map((i) => qs[i]).filter(Boolean);
    const contrib = computeSubtypeCountsForCaseQuestions(pickedQs);

    // Solo evaluamos variantes que NO se pasan del cupo solicitado.
    if (!canFitVariant(remainingMap, spec, contrib)) continue;

    // score = # preguntas que realmente cubren necesidades (aquí será = total variante)
    const score = idxs.length;

    if (!best || score > best.score) {
      best = { idxs, contrib, score };
    }
  }

  return best;
}

async function runAutoGenerator() {
  if (!currentExamId) {
    alert("Primero abre un examen.");
    return;
  }

  const targets = getAutoGenTargetsFromUI();
  if (!targets.length) {
    alert("Define al menos un objetivo (especialidad + subtipo + # preguntas).");
    return;
  }

  const topicQueriesTokens = parseAutoGenTopicQueries(autoGenTopicsInput?.value || "");

  // total objetivo
  const remainingMap = buildRemainingMap(targets);
  const totalTarget = remainingTotal(remainingMap);
  if (totalTarget <= 0) {
    alert("El total objetivo debe ser mayor a 0.");
    return;
  }

  

  // El generador trabaja por casos clínicos (2–3 preguntas). Con total objetivo < 2 no hay forma de cumplir.
  if (totalTarget < 2) {
    alert("Con un total objetivo menor a 2 no se puede generar, porque cada caso clínico aporta 2–3 preguntas. Sube el cupo o agrega otro subtipo para completar 2+ preguntas.");
    return;
  }

  // Si alguna especialidad quedó con 1 pregunta total, también es imposible (cada caso tiene 2+ preguntas de esa especialidad).
  const bySpecTotals = {};
  targets.forEach((t) => {
    bySpecTotals[t.specialty] = (bySpecTotals[t.specialty] || 0) + Number(t.count || 0);
  });
  const impossibleSpecs = Object.entries(bySpecTotals).filter(([_, n]) => n === 1);
  if (impossibleSpecs.length) {
    const label = impossibleSpecs.map(([s]) => getSpecialtyLabel(s) || s).join(", ");
    alert("No se puede generar porque pediste 1 pregunta total en: " + label + ". Cada caso clínico tiene 2–3 preguntas. Ajusta el cupo por esa especialidad (2+).");
    return;
  }
// Cargar banco suficiente (best-effort)
  const hasTopics = Array.isArray(topicQueriesTokens) && topicQueriesTokens.length > 0;
  const desiredLoad = hasTopics ? Math.max(800, totalTarget * 12) : Math.max(400, totalTarget * 6);
  await ensureBankLoadedForGenerator(Math.min(desiredLoad, 2000));
// Filtrar candidatos
  const allowedSpecs = new Set(targets.map((t) => t.specialty));

  const candidates = bankCasesCache
    .filter((c) => c && c.id && allowedSpecs.has(c.specialty))
    .filter((c) => bankCaseMatchesAnyTopicQuery(c, topicQueriesTokens))
    .slice(); // copy

  // Orden: usageCount asc (prioridad 0 usos), luego por createdAt desc
  candidates.sort((a, b) => {
    const ua = typeof a.usageCount === "number" ? a.usageCount : 0;
    const ub = typeof b.usageCount === "number" ? b.usageCount : 0;
    if (ua !== ub) return ua - ub;

    const sa = a.createdAt?.seconds || 0;
    const sb = b.createdAt?.seconds || 0;
    return sb - sa;
  });

  // Generar selección
  const selected = [];
  const selectedIds = new Set();

  // Para evitar duplicados con lo ya cargado en el examen actual
  syncCurrentExamCasesFromDOM();
  const alreadyInExam = getCurrentExamBankCaseIdsSet();
  for (const id of alreadyInExam) selectedIds.add(id);

  // Greedy por especialidad: recorre candidatos y agrega si encaja
  for (const c of candidates) {
    if (remainingTotal(remainingMap) <= 0) break;
    if (!c || !c.id) continue;
    if (selectedIds.has(c.id)) continue;

    // Si para la especialidad ya no falta nada, saltar
    if (remainingForSpecialty(remainingMap, c.specialty) <= 0) continue;

    const best = pickBestVariantForCase(c, remainingMap);
    if (!best) continue;

    const cloned = cloneBankCaseForExam(c, best.idxs);
    if (!cloned) continue;

    // Aplicar contribución
    applyVariant(remainingMap, c.specialty, best.contrib);

    selected.push(cloned);
    selectedIds.add(c.id);
  }

  const remainingAfter = remainingTotal(remainingMap);

  if (!selected.length) {
    const specLabel = targets
      .map((t) => `${getSpecialtyLabel(t.specialty) || t.specialty} / ${SUBTYPES[t.subtype] || t.subtype}: ${t.count}`)
      .join(" | ");
    const topicTxt = (autoGenTopicsInput?.value || "").trim();
    alert(
      "No se encontraron casos que cumplan tus criterios.\n\n" +
        "Objetivos: " + specLabel + (topicTxt ? ("\nTemas: " + topicTxt) : "") + "\n\n" +
        "Sugerencias: (1) aumenta el cupo total (cada caso aporta 2–3 preguntas), (2) agrega cupos para más subtipos (los casos suelen mezclar subtipos), (3) usa temas menos restrictivos o déjalos vacío para probar disponibilidad."
    );
    return;
  }

  if (remainingAfter > 0) {
    alert(
      "No fue posible completar el examen con los cupos solicitados usando los filtros actuales (temas/especialidades/subtipos).\n" +
        "Se generó una parte, pero faltan " + remainingAfter + " preguntas por completar.\n" +
        "Ajusta los cupos o usa temas menos restrictivos."
    );
  }
// Reemplazar casos actuales por los generados (sin borrar el examen hasta que guardes)
  currentExamCases = selected;
  renderExamCases();

  // Summary final
  if (autoGenSummary) {
    const generatedTotals = {};
    selected.forEach((cc) => {
      const spec = cc.specialty || "";
      if (!generatedTotals[spec]) generatedTotals[spec] = { salud_publica: 0, medicina_familiar: 0, urgencias: 0 };
      (cc.questions || []).forEach((q) => {
        const st = q.subtype || "salud_publica";
        if (generatedTotals[spec][st] === undefined) generatedTotals[spec][st] = 0;
        generatedTotals[spec][st] += 1;
      });
    });

    const lines = Object.entries(generatedTotals).map(([spec, counts]) => {
      const specLabel = getSpecialtyLabel(spec);
      const parts = Object.entries(counts)
        .filter(([_, v]) => v > 0)
        .map(([st, v]) => `${SUBTYPES[st] || st}: ${v}`)
        .join(" · ");
      return `<div style="margin-top:6px;"><b>${escapeHtml(specLabel || spec)}</b>: ${escapeHtml(parts || "—")}</div>`;
    });

    autoGenSummary.innerHTML = `
      <div style="font-size:12px;color:#9ca3af;">
        Generado: <b style="color:#e5e7eb;">${selected.reduce((acc, c) => acc + (c.questions?.length || 0), 0)}</b> preguntas en
        <b style="color:#e5e7eb;">${selected.length}</b> casos.
        ${remainingAfter > 0 ? `<div style="margin-top:6px;color:#fca5a5;">Pendiente por completar: ${remainingAfter} preguntas.</div>` : ""}
        ${lines.join("")}
        <div style="margin-top:8px;">
          Nota: el uso (usageCount) se ajusta hasta que guardes el examen.
        </div>
      </div>
    `;
  }
}

function initAutoGeneratorUI() {
  if (!autoGenTargetsWrap || !autoGenBtnAddTarget || !autoGenBtnGenerate) return;
  if (autoGenBtnGenerate.dataset.bound === "1") return;

  autoGenBtnGenerate.dataset.bound = "1";

  // Estado inicial: una fila por defecto
  if (!autoGenTargetsWrap.querySelector(".auto-gen-row")) {
    const first = buildAutoGenTargetRow({ specialty: Object.keys(SPECIALTIES)[0], subtype: "urgencias", count: 10 });
    if (first) autoGenTargetsWrap.appendChild(first);
  }

  renderAutoGenSummary();

  autoGenBtnAddTarget.addEventListener("click", () => {
    const row = buildAutoGenTargetRow({ specialty: Object.keys(SPECIALTIES)[0], subtype: "urgencias", count: 10 });
    if (row) autoGenTargetsWrap.appendChild(row);
    renderAutoGenSummary();
  });

  autoGenBtnGenerate.addEventListener("click", async () => {
    const btn = autoGenBtnGenerate;
    setLoadingButton(btn, true, "Generar");
    try {
      await runAutoGenerator();
    } catch (e) {
      console.error("Error generando examen automático:", e);
      alert("Ocurrió un error al generar el examen automático. Revisa consola.");
    } finally {
      setLoadingButton(btn, false, "Generar");
    }
  });

  autoGenTopicsInput?.addEventListener("input", () => {
    // No recalcula búsqueda todavía, solo refresca resumen
    renderAutoGenSummary();
  });
}

/****************************************************
 * VALIDACIÓN DE SESIÓN Y CARGA INICIAL (ADMIN)
 ****************************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

    // ✅ Habilita reorden del menú (solo visual)
    enableAdminPanelNavReorder();


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

    if (adminUserEmailSpan) {
      adminUserEmailSpan.textContent = user.email;
    }

    // Restaurar estado de navegación (refresh / regreso desde otras páginas)
    const restored = readAdminNavState();
    if (restored) {
      adminNavState = { ...adminNavState, ...restored };
    }

  } catch (err) {
    console.error("Error obteniendo perfil de administrador:", err);
    alert("Error cargando datos de administrador.");
    return;
  }

  // Inicializar buscadores
  initBankSearchUI();
  initMiniBankSearchUI();
  initAutoGeneratorUI();

  try {
    _isRestoringNav = true;
    await loadSections();
    _isRestoringNav = false;

    // Aplicar panel/vista restaurada (si existe)
    try {
      await applyAdminNavState(adminNavState);
    } catch (err) {
      console.error("Error aplicando estado restaurado:", err);
    }

    // Asegura estado base en history para que 'Atrás' funcione dentro de la app
    replaceAdminHistory();

  } catch (err) {
    console.error("Error cargando secciones:", err);
  }

  try {
    await loadLandingSettings();
  } catch (err) {
    console.error("Error cargando configuración de landing:", err);
  }

  console.log("admin.js cargado correctamente y panel inicializado (carga mínima).");
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
    btnNavImportExport,
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
  btnNavBank.addEventListener("click", async () => {
    clearSidebarActive();
    btnNavBank.classList.add("sidebar-btn--active");
    setActivePanel("bank");
    sidebar.classList.remove("sidebar--open");

    await loadQuestionsBank(true);
  });
}

if (btnNavMini) {
  btnNavMini.addEventListener("click", async () => {
    clearSidebarActive();
    btnNavMini.classList.add("sidebar-btn--active");
    setActivePanel("mini");
    sidebar.classList.remove("sidebar--open");

    loadMiniCases();

    resetMiniBankSearchUI();
    await loadBankCasesIfNeeded();
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



if (btnNavResources) {
  btnNavResources.addEventListener("click", async () => {
    clearSidebarActive();
    btnNavResources.classList.add("sidebar-btn--active");
    setActivePanel("resources");
    sidebar.classList.remove("sidebar--open");
    await ensureResourcesAdminLoaded();
    // Al entrar, restaura lista/detalle según estado
    if (adminNavState.resourcesTopicId) {
      adminResourcesSelectTopic(adminNavState.resourcesTopicId);
    } else {
      adminResourcesOpenList();
    }
  });
}

if (btnNavImportExport) {
  btnNavImportExport.addEventListener("click", () => {
    // Redirige a la pantalla de Import / Export (import-exam.html)
    // Nota: no cambia estado de paneles porque salimos de la página.
    clearSidebarActive();
    btnNavImportExport.classList.add("sidebar-btn--active");
    sidebar.classList.remove("sidebar--open");
    window.location.href = "import-exam.html";
  });
}


/****************************************************
 * POPSTATE (Botón Atrás / Gesto móvil)
 ****************************************************/
window.addEventListener("popstate", (e) => {
  const st = e.state?.adminNav;
  if (!st) return;
  // Restaurar navegación interna
  applyAdminNavState(st);
});

/****************************************************
 * SECCIONES (CRUD + REORDENAR) (SIN CAMBIOS)
 ****************************************************/

async function loadSections() {
  if (!sectionsList) return;

  const qSec = query(collection(db, "sections"), orderBy("order", "asc"));
  const snap = await getDocs(qSec);
  sectionsList.innerHTML = "";

  if (snap.empty) {
    renderEmptyMessage(sectionsList, "No hay secciones. Crea la primera.");
    currentSectionId = null;
    currentSectionTitle.textContent = "Sin secciones";
    examsListEl.innerHTML = "";
    return;
  }

  // Preferencia: restaurar la última sección si aplica
  const preferredSectionId =
    adminNavState?.panel === "exams" || adminNavState?.view?.startsWith("exam")
      ? (adminNavState.sectionId || null)
      : null;

  let selected = false;
  let firstId = null;
  let firstName = null;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = (data?.name || "").toString() || "Sección";

    if (!firstId) {
      firstId = id;
      firstName = name;
    }

    const li = document.createElement("li");
    li.className = "sidebar__section-item";
    li.draggable = true;
    li.dataset.sectionId = id;
    li.dataset.sectionName = name;

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
      ) {
        return;
      }
      selectSection(id, name);
      // Persist + history
      if (!_isRestoringNav) {
        adminNavState.sectionId = id;
        adminNavState.examId = null;
        adminNavState.view = "exams_list";
        persistAdminNavState();
        pushAdminHistoryIfChanged();
      }
    });

    li
      .querySelector(".admin-edit-section")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        openEditSectionModal(id, name);
      });

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

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
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

    // Restauración: selecciona la sección preferida (si existe)
    if (!selected && preferredSectionId && id === preferredSectionId) {
      selected = true;
      selectSection(id, name);
      li.classList.add("sidebar__section-item--active");
    }
  });

  // Fallback: selecciona la primera sección SOLO si estamos en panel exámenes
  if (!selected && (adminNavState?.panel === "exams")) {
    if (firstId) {
      const firstLi = sectionsList.querySelector(`.sidebar__section-item[data-section-id="${firstId}"]`);
      if (firstLi) firstLi.classList.add("sidebar__section-item--active");
      selectSection(firstId, firstName || "Sección");
      adminNavState.sectionId = firstId;
      adminNavState.view = "exams_list";
      adminNavState.examId = null;
      persistAdminNavState();
      if (!_isRestoringNav) {
        replaceAdminHistory();
      }
    }
  }
}

function selectSection(id, name) {
  currentSectionId = id;
  currentSectionTitle.textContent = name || "Sección";

  sectionsList
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));
  const activeLi = sectionsList.querySelector(
    `.sidebar__section-item[data-section-id="${id}"]`
  );
  if (activeLi) {
    activeLi.classList.add("sidebar__section-item--active");
  }

  loadExamsForSection(id);

  if (!_isRestoringNav) {
    adminNavState.sectionId = id;
    adminNavState.examId = null;
    adminNavState.view = "exams_list";
    persistAdminNavState();
    pushAdminHistoryIfChanged();
  }
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

    // ✅ ajustar usageCount por borrar examen (bankCaseId)
    const bankIds = caseSnap.docs
      .map((d) => (d.data() || {}).bankCaseId)
      .filter(Boolean);
    if (bankIds.length) {
      await applyUsageDelta(bankIds, []); // decrementa todo lo que estaba usado en ese examen
    }

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

/**
 * Devuelve el ID de la sección por nombre; si no existe, la crea.
 */
async function getOrCreateSectionByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("sectionName vacío en JSON.");

  const qByName = query(
    collection(db, "sections"),
    where("name", "==", trimmed)
  );
  const snap = await getDocs(qByName);
  if (!snap.empty) {
    return snap.docs[0].id;
  }

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

  const qEx = query(
    collection(db, "exams"),
    where("sectionId", "==", sectionId)
  );
  const snap = await getDocs(qEx);

  if (thisLoadToken !== examsLoadToken || sectionId !== currentSectionId) {
    return;
  }

  if (snap.empty) {
    renderEmptyMessage(
      examsListEl,
      "No hay exámenes en esta sección. Crea el primero."
    );
    return;
  }

  const sortedDocs = snap.docs
    .slice()
    .sort((a, b) => {
      const nameA = (a.data().name || "").toString();
      const nameB = (b.data().name || "").toString();
      return nameA.localeCompare(nameB, "es", {
        numeric: true,
        sensitivity: "base",
      });
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

        // ✅ Antes de borrar, recolectar bankCaseId para bajar usageCount
        const qCases = query(
          collection(db, "questions"),
          where("examId", "==", examId)
        );
        const snapCases = await getDocs(qCases);

        const bankIds = snapCases.docs
          .map((d) => (d.data() || {}).bankCaseId)
          .filter(Boolean);

        if (bankIds.length) {
          await applyUsageDelta(bankIds, []); // decrementa lo usado por ese examen
        }

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

/**
 * Importar varios exámenes desde un JSON
 */
async function importExamsFromJson(json) {
  let examsArray = [];

  if (Array.isArray(json)) {
    examsArray = json;
  } else if (json && Array.isArray(json.exams)) {
    examsArray = json.exams;
  }

  if (!examsArray.length) {
    alert("El JSON no contiene ningún examen (se esperaba un arreglo).");
    return;
  }

  const ok = window.confirm(
    `Se crearán ${examsArray.length} exámenes nuevos a partir del JSON. ` +
    `Cada examen incluirá sus casos clínicos y preguntas.\n\n¿Continuar?`
  );
  if (!ok) return;

  for (const examSpec of examsArray) {
    const sectionName = examSpec.sectionName || examSpec.section || null;
    const examName = examSpec.examName || examSpec.name || "Examen sin título";

    if (!sectionName) {
      console.warn("Examen sin sectionName, se omite:", examSpec);
      continue;
    }

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

      const questionsSrc = Array.isArray(caseSpec.questions)
        ? caseSpec.questions
        : [];

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

      if (!caseText || !questionsFormatted.length) {
        console.warn("Caso omitido por falta de datos:", caseSpec);
        continue;
      }

      await addDoc(collection(db, "questions"), {
        examId,
        bankCaseId: null, // ✅ importado no viene del banco
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
  if (currentSectionId) {
    await loadExamsForSection(currentSectionId);
  }
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
    bankCaseId: null,
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
    const caseText =
      block.querySelector(".admin-case-text")?.value.trim() || "";
    const specialty =
      block.querySelector(".admin-case-specialty")?.value || "";
    const topic =
      block.querySelector(".admin-case-topic")?.value.trim() || "";

    const bankCaseId = (block.dataset.bankCaseId || "").trim() || null;

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText =
        qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption =
        qb.querySelector(".admin-q-correct")?.value || "";
      const subtype =
        qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty =
        qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification =
        qb.querySelector(".admin-q-justification")?.value.trim() || "";

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

    if (!caseText && !questions.length) return;

    newCases.push({
      bankCaseId,
      caseText,
      specialty,
      topic,
      questions: questions.length ? questions : [createEmptyQuestion()],
    });
  });

  currentExamCases =
    newCases.length > 0 ? newCases : [createEmptyCase()];
}

async function openExamDetail(examId, examName) {
  if (!_isRestoringNav) {
    adminNavState.panel = "exams";
    adminNavState.view = "exam_detail";
    adminNavState.examId = examId;
    adminNavState.sectionId = currentSectionId || adminNavState.sectionId;
    persistAdminNavState();
    pushAdminHistoryIfChanged();
  }
  currentExamId = examId;
  currentExamCases = [];

  show(panelExams);
  show(examDetailView);

  resetBankSearchUI();

  if (examTitleInput) {
    examTitleInput.value = examName || "";
  }
  if (examCasesContainer) {
    examCasesContainer.innerHTML = "";
  }

  const qCases = query(
    collection(db, "questions"),
    where("examId", "==", examId)
  );
  const snap = await getDocs(qCases);

  if (snap.empty) {
    currentExamCases = [createEmptyCase()];
  } else {
    currentExamCases = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        topic: (data?.topic || "").toString(),
        bankCaseId: data.bankCaseId || null,
      };
    });
  }

  renderExamCases();

  await loadBankCasesIfNeeded();
}
/****************************************************
 * CONTINÚA ADMIN.JS - PARTE 2/2
 ****************************************************/

function renderExamCases() {
  if (!examCasesContainer) return;
  examCasesContainer.innerHTML = "";

  if (!currentExamCases.length) {
    currentExamCases.push(createEmptyCase());
  }

  currentExamCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card exam-case-block";
    wrapper.dataset.caseIndex = index;

    // ✅ Persistencia en DOM para sync + guardado
    wrapper.dataset.bankCaseId = caseData.bankCaseId || "";

    const specialtyValue = caseData.specialty || "";
    const topicValue = (caseData.topic || "").toString();
    const questionsArr = Array.isArray(caseData.questions)
      ? caseData.questions
      : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span>Caso clínico ${index + 1}</span>
          ${caseData.bankCaseId ? `<span class="badge badge--muted admin-case-reviewed-badge" data-bank-id="${caseData.bankCaseId}">○ Sin revisar</span>` : ""}
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
        <span>Tema (topic)</span>
        <input type="text" class="admin-case-topic" value="${topicValue.replace(/"/g, "&quot;")}" placeholder="Escribe el tema..." />
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
    <button type="button" class="btn btn-secondary" id="admin-btn-add-case-bottom">
      + Agregar caso clínico
    </button>
    <button type="button" class="btn btn-primary" id="admin-btn-save-exam-bottom">
      Guardar examen
    </button>
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
    btnSaveExamBottom.addEventListener("click", () => {
      btnSaveExamAll.click();
    });
  }

  // ✅ refrescar palomitas según estado en banco
  scheduleRefreshExamReviewedBadges();

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
    const st = history.state?.adminNav;
    if (st && st.view === "exam_detail") {
      // Mantiene coherencia con el botón físico/gesto "Atrás"
      history.back();
      return;
    }

    // Fallback (por si no hay estado en history)
    currentExamId = null;
    currentExamCases = [];
    if (examCasesContainer) examCasesContainer.innerHTML = "";
    hide(examDetailView);
    show(panelExams);

    resetBankSearchUI();

    if (currentSectionId) {
      loadExamsForSection(currentSectionId);
    }

    if (!_isRestoringNav) {
      adminNavState.panel = "exams";
      adminNavState.view = "exams_list";
      adminNavState.examId = null;
      adminNavState.sectionId = currentSectionId || adminNavState.sectionId;
      persistAdminNavState();
      replaceAdminHistory();
    }
  });
}

// Guardar examen (✅ con delta de usageCount y persistencia bankCaseId)
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

    // ✅ Previos (para delta)
    let prevBankIds = [];
    try {
      const qPrev = query(
        collection(db, "questions"),
        where("examId", "==", currentExamId)
      );
      const prevSnap = await getDocs(qPrev);
      prevBankIds = prevSnap.docs
        .map((d) => (d.data() || {}).bankCaseId)
        .filter(Boolean);
    } catch (e) {
      console.warn("No se pudieron cargar previos para delta usageCount:", e);
    }

    const casesToSave = [];

    for (const block of caseBlocks) {
      const caseText = block.querySelector(".admin-case-text").value.trim();
      const specialty = block.querySelector(".admin-case-specialty").value;
      const topic = block.querySelector(".admin-case-topic")?.value.trim() || "";
      const bankCaseId = (block.dataset.bankCaseId || "").trim() || null;

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
        bankCaseId,
        caseText,
        specialty,
        topic,
        questions,
      });
    }

    const newBankIds = casesToSave.map((c) => c.bankCaseId).filter(Boolean);

    const btn = btnSaveExamAll;
    setLoadingButton(btn, true, "Guardar examen");

    try {
      await updateDoc(doc(db, "exams", currentExamId), {
        name: newName,
        updatedAt: serverTimestamp(),
      });

      // borrar previos
      const qPrev = query(
        collection(db, "questions"),
        where("examId", "==", currentExamId)
      );
      const prevSnap = await getDocs(qPrev);
      for (const c of prevSnap.docs) {
        await deleteDoc(c.ref);
      }

      // guardar nuevos
      for (const c of casesToSave) {
        await addDoc(collection(db, "questions"), {
          examId: currentExamId,
          bankCaseId: c.bankCaseId || null, // ✅ persistente
          caseText: c.caseText,
          specialty: c.specialty,
          topic: c.topic || "",
          questions: c.questions,
          createdAt: serverTimestamp(),
        });
      }

      // ✅ Ajuste real de usageCount
      await applyUsageDelta(prevBankIds, newBankIds);

      alert("Examen guardado correctamente.");
      if (currentSectionId) {
        await loadExamsForSection(currentSectionId);
      }

      // refrescar buscador (para que se deshabiliten bien y refresque usado)
      resetBankSearchUI();
      await loadBankCasesIfNeeded();
    } catch (err) {
      console.error(err);
      alert("Hubo un error al guardar el examen.");
    } finally {
      setLoadingButton(btn, false, "Guardar examen");
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
 * Importar un solo examen (JSON) directamente al formulario del examen abierto.
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
  const examName =
    (json && (json.examName || json.name)) ||
    (examTitleInput ? examTitleInput.value : "");

  if (examTitleInput && examName) {
    examTitleInput.value = examName;
  }

  let casesArr = [];

  if (Array.isArray(json)) {
    casesArr = json;
  } else if (Array.isArray(json.cases)) {
    casesArr = json.cases;
  } else {
    alert(
      "El JSON debe ser un objeto con propiedad 'cases' o un arreglo de casos clínicos."
    );
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
    const questions =
      qsRaw.length > 0
        ? qsRaw.map((q) => normalizeQuestionFromJson(q))
        : [createEmptyQuestion()];

    return { bankCaseId: null, caseText, specialty, topic, questions };
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
 * BANCO DE PREGUNTAS (questions) – Panel admin-panel-bank
 * ✅ Preguntas editables tipo examen (no JSON)
 ****************************************************/

const bankFilterCaseText = document.getElementById("admin-bank-search");
const bankFilterTopic = document.getElementById("admin-bank-topic");
const bankFilterSpecialty = document.getElementById("admin-bank-specialty");
const bankFilterExamId = document.getElementById("admin-bank-examid");

const btnBankClear = document.getElementById("admin-bank-btn-clear");
const btnBankRefresh = document.getElementById("admin-bank-btn-refresh");
const btnBankApply = document.getElementById("admin-bank-btn-apply");

const bankListEl = document.getElementById("admin-bank-list");
const btnBankLoadMore = document.getElementById("admin-bank-btn-load-more");

// Estado del banco
let bankPageSize = 20;
let bankLastDoc = null;
let bankIsLoading = false;
let bankHasMore = true;

// Filtros actuales
let bankActiveFilters = {
  caseText: "",
  topic: "",
  specialty: "",
  examId: "",
};

function getBankFiltersFromUI() {
  return {
    caseText: (bankFilterCaseText?.value || "").trim(),
    topic: (bankFilterTopic?.value || "").trim(),
    specialty: (bankFilterSpecialty?.value || "").trim(),
    examId: (bankFilterExamId?.value || "").trim(),
  };
}

function bankCaseMatchesFilters(docData, filters) {
  const caseText = normalizeText(docData.caseText || "");
  const topic = normalizeText((docData.topic || "").toString());
  const specialty = normalizeText((docData.specialty || "").toString());
  const examId = normalizeText((docData.examId || "").toString());

  const fCase = normalizeText(filters.caseText || "");
  const fTopic = normalizeText(filters.topic || "");
  const fSpec = normalizeText(filters.specialty || "");
  const fExam = normalizeText(filters.examId || "");

  if (fCase && !caseText.includes(fCase)) return false;
  if (fTopic && !topic.includes(fTopic)) return false;
  if (fSpec && !specialty.includes(fSpec)) return false;
  if (fExam && !examId.includes(fExam)) return false;

  return true;
}

// helpers (usa escapeHtml global definida arriba)

function renderBankItem(docId, data) {
  const specLabel = getSpecialtyLabel(data.specialty || "");
  const topicTxt = (data.topic || "").toString();
  const qCount = Array.isArray(data.questions) ? data.questions.length : 0;
  const usage = typeof data.usageCount === "number" ? data.usageCount : 0;
  const isBankDoc = !data.examId;
  const reviewed = isBankDoc ? !!data.reviewed : false;


  const wrap = document.createElement("div");
  wrap.className = "card-item";
  wrap.dataset.id = docId;
  wrap.dataset.mode = "view";

  const snippet = escapeHtml((data.caseText || "").slice(0, 240));
  const hasMore = (data.caseText || "").length > 240;

  wrap.innerHTML = `
    <div class="card-item__title-row" style="align-items:flex-start;">
      <div style="flex:1;">
        <div class="card-item__title" style="margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${escapeHtml(topicTxt || specLabel || "Caso (questions)")}</span>
          <span class="badge ${reviewed ? "badge--success" : "badge--muted"} admin-review-badge" data-id="${docId}" style="${isBankDoc ? "" : "display:none;"}">
            ${reviewed ? "✓ Revisado" : "○ Sin revisar"}
          </span>
        </div>
        <div style="font-size:12px;color:#9ca3af;">
          <div><strong>ID:</strong> <code>${docId}</code></div>
          <div><strong>ExamID:</strong> <code>${escapeHtml((data.examId || "—") + "")}</code></div>
          <div><strong>Tema:</strong> ${escapeHtml(topicTxt || "—")}</div>
          <div><strong>Preguntas:</strong> ${qCount}</div>
          <div><strong>Usado:</strong> ${usage}</div>
        </div>
      </div>

      <div class="card-item__actions">
        <button class="btn btn-sm ${reviewed ? "btn-success" : "btn-outline"} admin-bank-toggle-reviewed" data-id="${docId}" data-reviewed="${reviewed ? "1" : "0"}" style="${isBankDoc ? "" : "display:none;"}">
          ${reviewed ? "✓ Revisado" : "Marcar ✓"}
        </button>
        <button class="btn btn-sm btn-secondary admin-bank-inline-edit">Editar</button>
        <button class="btn btn-sm btn-outline admin-bank-inline-delete">Eliminar</button>
      </div>
    </div>

    <div class="admin-bank-view" style="font-size:13px;line-height:1.45;color:#e5e7eb;margin-top:10px;">
      ${snippet}${hasMore ? "…" : ""}
    </div>

    <div class="admin-bank-edit hidden" style="margin-top:12px;">
      <div class="card" style="padding:12px;">
        <label class="field">
          <span>Especialidad</span>
          <select class="admin-bank-edit-specialty">
            <option value="">Selecciona...</option>
            ${Object.entries(SPECIALTIES)
              .map(([key, label]) => `<option value="${key}" ${key === (data.specialty || "") ? "selected" : ""}>${label}</option>`)
              .join("")}
          </select>
        </label>

        <label class="field">
          <span>Tema (topic)</span>
          <input type="text" class="admin-bank-edit-topic" value="${escapeHtml((data.topic || "") + "")}" />
        </label>

        <label class="field">
          <span>Texto del caso clínico</span>
          <textarea class="admin-bank-edit-caseText" rows="5">${escapeHtml(data.caseText || "")}</textarea>
        </label>

        <div class="card" style="padding:12px;margin-top:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-weight:600;font-size:13px;">Preguntas</div>
            <button type="button" class="btn btn-sm btn-primary admin-bank-add-question">+ Agregar pregunta</button>
          </div>
          <div class="cards-list admin-bank-questions" style="margin-top:10px;"></div>
        </div>

        <div class="flex-row" style="justify-content:flex-end;gap:8px;margin-top:10px;">
          <button class="btn btn-sm btn-outline admin-bank-inline-cancel">Cancelar</button>
          <button class="btn btn-sm btn-primary admin-bank-inline-save">Guardar</button>
        </div>
      </div>
    </div>
  `;

  const btnEdit = wrap.querySelector(".admin-bank-inline-edit");
  const btnDelete = wrap.querySelector(".admin-bank-inline-delete");
  const btnCancel = wrap.querySelector(".admin-bank-inline-cancel");
  const btnSave = wrap.querySelector(".admin-bank-inline-save");
  const btnReviewed = wrap.querySelector(".admin-bank-toggle-reviewed");
  const viewEl = wrap.querySelector(".admin-bank-view");
  const editEl = wrap.querySelector(".admin-bank-edit");

  // ✅ palomita "Revisado"
  if (isBankDoc && btnReviewed) {
    btnReviewed.addEventListener("click", async (e) => {
      e.stopPropagation();
      const current = btnReviewed.dataset.reviewed === "1";
      await setBankCaseReviewed(docId, !current);
    });
  }

  // ✅ cargar preguntas en modo editor (UI tipo examen)
  const bankQContainer = wrap.querySelector(".admin-bank-questions");
  const initialQs = Array.isArray(data.questions) && data.questions.length ? data.questions : [createEmptyQuestion()];
  initialQs.forEach((q) => bankQContainer.appendChild(renderQuestionBlock(q)));

  wrap.querySelector(".admin-bank-add-question").addEventListener("click", () => {
    bankQContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
  });

  btnEdit.addEventListener("click", () => {
    wrap.dataset.mode = "edit";
    viewEl.classList.add("hidden");
    editEl.classList.remove("hidden");
    btnEdit.disabled = true;
  });

  btnCancel.addEventListener("click", () => {
    wrap.dataset.mode = "view";
    viewEl.classList.remove("hidden");
    editEl.classList.add("hidden");
    btnEdit.disabled = false;
  });

  btnDelete.addEventListener("click", async () => {
    const ok = window.confirm("¿Eliminar este caso del banco (questions)?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "questions", docId));
      wrap.remove();

      bankCasesLoadedOnce = false;
      bankCasesCache = [];
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el caso.");
    }
  });

  btnSave.addEventListener("click", async () => {
    const specialty = wrap.querySelector(".admin-bank-edit-specialty").value || "";
    const topic = wrap.querySelector(".admin-bank-edit-topic").value.trim();
    const caseText = wrap.querySelector(".admin-bank-edit-caseText").value.trim();

    if (!caseText) {
      alert("El texto del caso clínico no puede ir vacío.");
      return;
    }

    // ✅ recolectar preguntas desde UI
    const qBlocks = wrap.querySelectorAll(".admin-bank-questions .exam-question-block");
    const questionsParsed = [];

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
        alert("Completa todos los campos de todas las preguntas.");
        return;
      }

      questionsParsed.push({
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

    if (!questionsParsed.length) {
      alert("Debe existir al menos una pregunta.");
      return;
    }

    setLoadingButton(btnSave, true, "Guardar");

    try {
      await updateDoc(doc(db, "questions", docId), {
        specialty,
        topic,
        caseText,
        questions: questionsParsed,
        updatedAt: serverTimestamp(),
      });

      bankCasesLoadedOnce = false;
      bankCasesCache = [];

      await loadQuestionsBank(true);
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la edición del caso.");
    } finally {
      setLoadingButton(btnSave, false, "Guardar");
    }
  });

  return wrap;
}

async function loadQuestionsBank(reset = false) {
  if (!bankListEl) return;
  if (bankIsLoading) return;

  bankIsLoading = true;

  if (reset) {
    bankListEl.innerHTML = "";
    bankLastDoc = null; // cursor de escaneo (questions)
    bankHasMore = true;
    if (btnBankLoadMore) btnBankLoadMore.disabled = true;
  }

  if (!bankListEl.children.length) {
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        Cargando banco de preguntas (questions)…
      </div>
    `;
  }

  try {
    const filters = bankActiveFilters || getBankFiltersFromUI();

    // Estrategia: escanear por lotes y renderear SOLO coincidencias,
    // hasta llenar una "página" (bankPageSize) o llegar al final.
    const scanBatch = 250;
    let rendered = 0;
    let safetyLoops = 0;

    // si venimos de reset, limpiar placeholder
    if (reset) bankListEl.innerHTML = "";

    while (bankHasMore && rendered < bankPageSize) {
      safetyLoops++;
      if (safetyLoops > 80) {
        // evita loops infinitos en caso de filtros muy restrictivos + colección enorme
        break;
      }

      let qBase;
      try {
        qBase = query(
          collection(db, "questions"),
          orderBy("createdAt", "desc"),
          ...(bankLastDoc ? [startAfter(bankLastDoc)] : []),
          limit(scanBatch)
        );
      } catch (e) {
        qBase = query(
          collection(db, "questions"),
          ...(bankLastDoc ? [startAfter(bankLastDoc)] : []),
          limit(scanBatch)
        );
      }

      const snap = await getDocs(qBase);

      if (!snap || !snap.docs || !snap.docs.length) {
        bankHasMore = false;
        break;
      }

      bankLastDoc = snap.docs[snap.docs.length - 1];

      // Si el lote vino incompleto, probablemente ya es el final
      if (snap.size < scanBatch) {
        // Ojo: aún puede haber más, pero Firestore normalmente devuelve < limit al final
        // Lo marcamos como que no hay más para evitar scans infinitos.
        bankHasMore = false;
      } else {
        bankHasMore = true;
      }

      for (const d of snap.docs) {
        const data = d.data() || {};
        if (!bankCaseMatchesFilters(data, filters)) continue;

        bankListEl.appendChild(renderBankItem(d.id, data));
        rendered++;

        if (rendered >= bankPageSize) break;
      }
    }

    if (!bankListEl.children.length) {
      renderEmptyMessage(bankListEl, "No hay resultados con esos filtros. Prueba otros términos.");
    }

    if (btnBankLoadMore) {
      btnBankLoadMore.disabled = !bankHasMore;
    }
  } catch (err) {
    console.error(err);
    renderEmptyMessage(bankListEl, "Error al cargar el banco. Revisa la consola.");
    if (btnBankLoadMore) btnBankLoadMore.disabled = true;
  } finally {
    bankIsLoading = false;
  }
}

if (btnBankApply) {
  btnBankApply.addEventListener("click", () => {
    bankActiveFilters = getBankFiltersFromUI();
    loadQuestionsBank(true);
  });
}

if (btnBankRefresh) {
  btnBankRefresh.addEventListener("click", () => {
    loadQuestionsBank(true);
  });
}

if (btnBankClear) {
  btnBankClear.addEventListener("click", () => {
    if (bankFilterCaseText) bankFilterCaseText.value = "";
    if (bankFilterTopic) bankFilterTopic.value = "";
    if (bankFilterSpecialty) bankFilterSpecialty.value = "";
    if (bankFilterExamId) bankFilterExamId.value = "";
    bankActiveFilters = { caseText: "", topic: "", specialty: "", examId: "" };
    loadQuestionsBank(true);
  });
}

if (btnBankLoadMore) {
  btnBankLoadMore.addEventListener("click", () => {
    if (!bankHasMore) return;
    loadQuestionsBank(false);
  });
}

/****************************************************
 * MINI EXÁMENES – BANCO GLOBAL DE CASOS (miniQuestions)
 * ✅ guarda bankCaseId y ajusta usageCount por delta al guardar
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

    const caseText =
      block.querySelector(".admin-mini-case-text")?.value.trim() || "";
    const specialty =
      block.querySelector(".admin-mini-case-specialty")?.value || "";

    const bankCaseId = (block.dataset.bankCaseId || "").trim() || (prev.bankCaseId || null);

    const qBlocks = block.querySelectorAll(".exam-question-block");
    const questions = [];

    qBlocks.forEach((qb) => {
      const questionText =
        qb.querySelector(".admin-q-question")?.value.trim() || "";
      const optionA = qb.querySelector(".admin-q-a")?.value.trim() || "";
      const optionB = qb.querySelector(".admin-q-b")?.value.trim() || "";
      const optionC = qb.querySelector(".admin-q-c")?.value.trim() || "";
      const optionD = qb.querySelector(".admin-q-d")?.value.trim() || "";
      const correctOption =
        qb.querySelector(".admin-q-correct")?.value || "A";
      const subtype =
        qb.querySelector(".admin-q-subtype")?.value || "salud_publica";
      const difficulty =
        qb.querySelector(".admin-q-difficulty")?.value || "media";
      const justification =
        qb.querySelector(".admin-q-justification")?.value.trim() || "";

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

    if (!caseText && !questions.length) return;

    newCases.push({
      id: prev.id || null,
      bankCaseId,
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
            bankCaseId: null,
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
        bankCaseId: data.bankCaseId || null,
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
      bankCaseId: null,
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
      bankCaseId: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
  }

  miniCases.forEach((caseData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card mini-case-block";
    wrapper.dataset.caseIndex = index;

    // ✅ persistencia en DOM
    wrapper.dataset.bankCaseId = caseData.bankCaseId || "";

    const specialtyValue = caseData.specialty || "";
    const questionsArr = Array.isArray(caseData.questions)
      ? caseData.questions
      : [];

    wrapper.innerHTML = `
      <div class="flex-row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span>Caso clínico global ${index + 1}</span>
          ${caseData.bankCaseId ? `<span class="badge badge--muted mini-case-reviewed-badge" data-bank-id="${caseData.bankCaseId}">○ Sin revisar</span>` : ""}
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

    wrapper
      .querySelector(".admin-mini-add-question")
      .addEventListener("click", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

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


  // ✅ refrescar palomitas según estado en banco
  scheduleRefreshMiniReviewedBadges();
}

if (btnMiniAddCase && miniCasesContainer) {
  btnMiniAddCase.addEventListener("click", () => {
    syncMiniCasesFromDOM();
    miniCases.push({
      id: null,
      bankCaseId: null,
      caseText: "",
      specialty: "",
      questions: [createEmptyQuestion()],
    });
    renderMiniCases();
  });
}

async function handleSaveMiniBank() {
  if (!miniCasesContainer) return;

  // ✅ prev para delta usageCount
  let prevBankIds = [];
  try {
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    prevBankIds = prevSnap.docs.map(d => (d.data() || {}).bankCaseId).filter(Boolean);
  } catch (e) {
    console.warn("No se pudieron leer previos miniQuestions para delta:", e);
  }

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

  const newBankIds = miniCases.map(c => c.bankCaseId).filter(Boolean);

  const btn = btnMiniSaveAll;
  if (btn) setLoadingButton(btn, true, "Guardar banco");

  try {
    const prevSnap = await getDocs(collection(db, "miniQuestions"));
    for (const d of prevSnap.docs) {
      await deleteDoc(d.ref);
    }

    for (const c of miniCases) {
      await addDoc(collection(db, "miniQuestions"), {
        bankCaseId: c.bankCaseId || null, // ✅
        caseText: c.caseText,
        specialty: c.specialty,
        questions: c.questions,
        createdAt: serverTimestamp(),
      });
    }

    // ✅ delta usageCount real
    await applyUsageDelta(prevBankIds, newBankIds);

    alert("Banco de mini exámenes guardado correctamente.");
  } catch (err) {
    console.error(err);
    alert("Hubo un error al guardar el banco de mini exámenes.");
  } finally {
    if (btn) setLoadingButton(btn, false, "Guardar banco");
  }
}

if (btnMiniSaveAll && miniCasesContainer) {
  btnMiniSaveAll.addEventListener("click", handleSaveMiniBank);
}

/****************************************************
 * USUARIOS (CRUD) (SIN CAMBIOS)
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
 * PANTALLA PRINCIPAL / LANDING (SIN CAMBIOS)
 ****************************************************/

async function loadLandingSettings() {
  if (!landingTextArea) return;

  try {
    const ref = doc(db, "settings", "landingPage");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
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
 * SOCIAL LINKS (SIN CAMBIOS)
 ****************************************************/

async function loadSocialLinks() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

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

async function loadSocialLinksIntoLanding() {
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    if (landingInstagramInput)
      landingInstagramInput.value = data.instagram || "";
    if (landingWhatsappLinkInput)
      landingWhatsappLinkInput.value = data.whatsapp || "";
    if (landingTiktokInput) landingTiktokInput.value = data.tiktok || "";
    if (landingTelegramInput)
      landingTelegramInput.value = data.telegram || "";
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
 * ANALYTICS BÁSICOS (SIN CAMBIOS)
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

    const userRows = [];
    for (const u of usersSnap.docs) {
      const userData = u.data();
      const email = userData.email || u.id;
      const name = userData.name || email;

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
console.log("admin.js cargado correctamente (banco editable + bloqueo duplicados + usageCount delta).");

  } catch (err) {
    console.error("Admin bootstrap error:", err);
  }
})();
