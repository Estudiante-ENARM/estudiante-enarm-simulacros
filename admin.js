/****************************************************
 * ADMIN.JS - Panel de Administrador
 * Plataforma Estudiante ENARM
 * - Gestión de secciones
 * - Gestión de solicitudes y casos clínicos
 * - Gestión de usuarios
 * - Configuración de pantalla principal
 * - Conceptos básicos de análisis
 *
 * ✅ CORRECCIONES APLICADAS (SIN FUNCIONES ELIMINAR):
 * 1) Banco de preguntas (panel banco): preguntas editables tipo examen (no JSON).
 * 2) Buscador "Agregar casos desde banco" en EXÁMENES y MINI:
 * - Busca en "questions" (solo casos banco: sin examId)
 * - Muestra tema + usageCount
 * - BLOQUEA duplicados dentro del mismo examen/mini (persistente con bankCaseId)
 * 3) usageCount robusto:
 * - Ajuste por delta al guardar examen, borrar examen, guardar mini banco
 ****************************************************/

// Firebase inicializado en firebase-config.js
importar { auth, db } desde "./firebase-config.js";

importar { initializeApp, getApps, getApp } desde "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

importar {
  ESPECIALIDADES,
  SUBTIPOS,
  DIFICULTADES,
  DIFICULTAD_PESOS,
  REGLAS_DE_EXAMEN_PREDETERMINADAS,
} de "./shared-constants.js";

importar {
  enAuthStateChanged,
  desconectar,
} de "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

importar {
  recopilación,
  doc,
  obtenerFirestore,
  obtenerDoc,
  obtenerDocs,
  consulta,
  dónde,
  Ordenar por,
  establecerDoc,
  agregarDoc,
  actualizarDoc,
  eliminarDoc,
  marca de tiempo del servidor,
  límite,
  empezarDespués,
  ID del documento,
  incremento,} de "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/****************************************************
 * REFERENCIAS DOM
 ****************************************************/

// Encabezado
const adminUserEmailSpan = document.getElementById("correo electrónico del usuario administrador");
const btnLogout = document.getElementById("admin-btn-logout");
constante btnToggleSidebar = document.getElementById("admin-btn-toggle-sidebar");

// Barra lateral
const sidebar = document.getElementById("admin-sidebar");
const sectionsList = document.getElementById("lista-de-secciones-de-admin");
const btnAddSection = document.getElementById("admin-btn-add-section");
const btnNavExams = document.getElementById("admin-btn-nav-exams");
const btnNavBank = document.getElementById("admin-btn-nav-bank");
const btnNavMini = document.getElementById("admin-btn-nav-mini");
const btnNavUsers = document.getElementById("admin-btn-nav-users");
constante btnNavAnalytics = document.getElementById("admin-btn-nav-analytics");
constante btnNavLanding = document.getElementById("admin-btn-nav-landing");
const btnNavImportExport = document.getElementById("admin-btn-nav-import-export");
const btnNavResources = document.getElementById("admin-btn-nav-resources");
const adminSocialIcons = document.querySelectorAll(".admin-social-icon");

// Paneles principales
const panelExams = document.getElementById("examenes-del-panel-de-administracion");
const panelBank = document.getElementById("banco-del-panel-de-administración");
const panelMini = document.getElementById("admin-panel-mini");
const panelUsers = document.getElementById("usuarios-del-panel-de-administración");
const panelAnalytics = document.getElementById("panel-de-administración-analytics");
const panelLanding = document.getElementById("panel-de-administración-landing");
const panelResources = document.getElementById("recursos-del-panel-de-administración");


// ==================== RESÚMENES DEL PANEL / GPC =====================
const resBtnRefresh = document.getElementById("admin-resources-btn-refresh");
const resBtnNewTopic = document.getElementById("admin-recursos-btn-nuevo-tema");
const resSearchInput = document.getElementById("búsqueda-de-recursos-de-administración");
const resSpecialtyFilter = document.getElementById("admin-recursos-especialidad");
const resTopicCount = document.getElementById("número-de-temas-de-recursos-de-administración");
const resTopicList = document.getElementById("lista-de-temas-de-recursos-de-administración");

const resBtnBack = document.getElementById("admin-recursos-btn-back");
const resEditorStatus = document.getElementById("estado del editor de recursos de administración");
const resTitleInput = document.getElementById("título-de-recursos-de-administración");
const resSpecialtyRawInput = document.getElementById("admin-recursos-specialty-raw");
const resLinksWrap = document.getElementById("enlaces-de-recursos-de-administración");
const resBtnAddLink = document.getElementById("admin-resources-btn-add-link");
const resBtnDelete = document.getElementById("admin-resources-btn-delete");
const resBtnSave = document.getElementById("admin-resources-btn-save");

// ==================== EXÁMENES DE PANEL =====================
const currentSectionTitle = document.getElementById("admin-título-de-la-sección-actual");
const examsListEl = document.getElementById("lista-de-examenes-de-admin");
const btnAddExam = document.getElementById("admin-btn-add-exam");
const btnImportExamsJson = document.getElementById("admin-btn-import-exams-json");

// Vista detalle examen
const examDetailView = document.getElementById("detalle-del-examen-de-administrador");
const btnBackToExams = document.getElementById("admin-btn-volver-a-los-examenes");
const examTitleInput = document.getElementById("entrada-de-título-de-examen-de-administrador");
const examCasesContainer = document.getElementById("admin-exam-cases");
const btnSaveExamAll = document.getElementById("admin-btn-guardar-examen");
constante btnAddCaseTop = documento.getElementById("admin-btn-add-case");
const btnImportExamJson = document.getElementById("admin-btn-import-exam");

// ==================== BUSCADOR "Agregar casos desde banco" EN DETALLE DE EXAMEN =====================
const bankSearchInput = document.getElementById("entrada-de-búsqueda-del-banco-de-administración");
const bankSearchResults = document.getElementById("resultados-de-busqueda-de-admin-bank");

// ==================== BUSCADOR "Agregar casos desde banco" EN MINI EXÁMENES ====================
const miniBankSearchInput = document.getElementById("entrada-de-búsqueda-mini-banco-admin");
const miniBankSearchResults = document.getElementById("resultados-de-busqueda-de-mini-banco-admin");

// ===================== GENERADOR AUTOMÁTICO (detalle de examen) ====================
const autoGenTopicsInput = document.getElementById("admin-auto-gen-topics");
const autoGenTargetsWrap = document.getElementById("admin-auto-gen-targets");
const autoGenBtnAddTarget = document.getElementById("admin-auto-gen-add-target");
const autoGenBtnGenerate = document.getElementById("admin-auto-gen-generate");
const autoGenSummary = document.getElementById("admin-auto-gen-summary");

// ===================== PANEL USUARIOS =====================
const newUserNameInput = document.getElementById("admin-nuevo-nombre-de-usuario");
const newUserEmailInput = document.getElementById("admin-nuevo-usuario-email");
const newUserPasswordInput = document.getElementById("admin-nueva-contraseña-de-usuario");
const newUserRoleSelect = document.getElementById("admin-nuevo-rol-de-usuario");
const newUserStatusSelect = document.getElementById("admin-nuevo-estado-de-usuario");
const newUserExpiryInput = document.getElementById("admin-nuevo-usuario-expiración");
const btnCreateUser = document.getElementById("admin-btn-create-user");
const usersTableContainer = document.getElementById("admin-usuarios-tabla");

// ==================== PANEL DE INICIO / CONFIGURACIÓN ====================
const landingTextArea = document.getElementById("admin-landing-text");
const monthlyLabelInput = document.getElementById("admin-etiqueta-mensual");
const monthlyPriceInput = document.getElementById("admin-precio-mensual");
const enarmLabelInput = document.getElementById("admin-enarm-label");
const enarmPriceInput = document.getElementById("admin-enarm-price");
const whatsappPhoneInput = document.getElementById("admin-whatsapp-phone");
const btnSaveLanding = document.getElementById("admin-btn-save-landing");

// Enlaces sociales en el panel de aterrizaje
const landingInstagramInput = document.getElementById("admin-instagram-link");
const landingWhatsappLinkInput = document.getElementById("enlace-de-admin-whatsapp");
const landingTiktokInput = document.getElementById("enlace-admin-tiktok");
const landingTelegramInput = document.getElementById("enlace-de-telegrama-de-administrador");

// ==================== ANÁLISIS DE PANEL ====================
const analyticsSummaryBox = document.getElementById("resumen-de-analíticas-de-admin");
const analyticsUsersBox = document.getElementById("admin-analytics-users");

// Modal genérico (reutilizable) -> SE CONSERVA, pero banco ya no lo usa
const modalOverlay = document.getElementById("admin-modal-overlay");
const modalBox = document.getElementById("admin-modal");
const modalTitle = document.getElementById("admin-modal-title");
const modalBody = document.getElementById("admin-modal-body");
const modalBtnCancel = document.getElementById("admin-modal-cancel");
const modalBtnOk = document.getElementById("admin-modal-ok");

deje que modalOkHandler = null;

/****************************************************
 * ALTERNAR BARRA LATERAL (HAMBURGUESA)
 ****************************************************/
si (btnToggleSidebar && barra lateral) {
  btnToggleSidebar.addEventListener("clic", () => {
    sidebar.classList.toggle("barra lateral--abrir");
  });
}

/****************************************************
 * CERRAR SESIÓN DE ADMINISTRADOR
 ****************************************************/
si (btnCerrar sesión) {
  btnLogout.addEventListener("clic", async () => {
    intentar {
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
    } captura (error) {
      console.error("Error al cerrar sesión (admin):", error);
      alert("No se pudo cerrar sesión. Intento nuevamente.");
    }
  });
}

/****************************************************
 * ESTADO EN MEMORIA
 ****************************************************/

deje que currentAdminUser = null; // Usuario de autenticación
let currentSectionId = nulo; // Sección seleccionada
let currentExamId = null; // examen abierto


/****************************************************
 * ESTADO DE NAVEGACIÓN (persistencia + botón Atrás)
 * Objetivo:
 * 1) Actualizar mantiene la misma vista/pestaña y contexto.
 * 2) Botón físico/gesto Atrás navega dentro de la jerarquía de la aplicación.
 ****************************************************/
constante ADMIN_NAV_STATE_VERSION = 1;
sea ​​_isRestoringNav = falso;

deje que adminNavState = {
  Panel: "Exámenes", // Exámenes | Banco | Mini | Usuarios | Análisis | Página de inicio | Recursos
  vista: "lista_exámenes", // lista_exámenes | detalle_examen | lista_recursos | detalle_recursos | nuevo_recursos | panel
  sectionId: nulo,
  examId: nulo,
  recursosTopicId: null,
  RecursosBuscar: "",
  RecursosClave de especialidad: "",
};

función getAdminNavStorageKey() {
  const id = usuarioAdministradorActual?.uid || usuarioAdministradorActual?.email || "anónimo";
  devuelve `admin_nav_v${VERSIÓN_ESTADO_ADMIN_NAV}_${id}`;
}

función readAdminNavState() {
  intentar {
    const raw = localStorage.getItem(getAdminNavStorageKey());
    si (!raw) devuelve nulo;
    constante analizada = JSON.parse(raw);
    si (!parsed || typeof parsed !== "object") devuelve null;
    devolver {
      ...adminNavState,
      ...analizado,
    };
  } atrapar {
    devuelve nulo;
  }
}

función persistAdminNavState() {
  intentar {
    localStorage.setItem(getAdminNavStorageKey(), JSON.stringify(adminNavState));
  } atrapar {}
}

función sameNavState(a, b) {
  intentar {
    devuelve JSON.stringify(a || {}) === JSON.stringify(b || {});
  } atrapar {
    devuelve falso;
  }
}

función pushAdminHistoryIfChanged() {
  si (_isRestoringNav) retorna;
  const prev = historial.estado?.adminNav;
  constante siguiente = { ...adminNavState };
  si (sameNavState(prev, next)) retorna;
  historial.pushState({ adminNav: siguiente }, "", ventana.ubicación.href);
}

función replaceAdminHistory() {
  intentar {
    historial.replaceState({ adminNav: { ...adminNavState } }, "", ventana.ubicación.href);
  } atrapar {}
}

función setSidebarActiveByPanel(panelId) {
  borrarBarraLateralActiva();
  si (panelId === "exámenes" y btnNavExams) btnNavExams.classList.add("barra lateral-btn--activa");
  si (panelId === "banco" y btnNavBank) btnNavBank.classList.add("barra lateral-btn--activa");
  si (panelId === "mini" && btnNavMini) btnNavMini.classList.add("barra lateral-btn--activa");
  si (panelId === "usuarios" y btnNavUsers) btnNavUsers.classList.add("barra lateral-btn--activa");
  si (panelId === "analytics" && btnNavAnalytics) btnNavAnalytics.classList.add("barra lateral-btn--activa");
  si (panelId === "aterrizaje" y btnNavLanding) btnNavLanding.classList.add("barra lateral-btn--activa");
  si (panelId === "recursos" y btnNavResources) btnNavResources.classList.add("barra lateral-btn--activa");
}

función asíncrona applyAdminNavState(estado) {
  si (!estado) retorna;

  _isRestoringNav = verdadero;
  intentar {
    adminNavState = { ...adminNavState, ...estado };
    persistirAdminNavState();

    // Panel
    setSidebarActiveByPanel(adminNavState.panel);
    setActivePanel(adminNavState.panel);

    // EXÁMENES
    si (adminNavState.panel === "exámenes") {
      // Seleccionar sección si aplica
      si (adminNavState.sectionId && adminNavState.sectionId !== currentSectionId) {
        const li = sectionsList?.querySelector(`.sidebar__section-item[data-section-id="${adminNavState.sectionId}"]`);
        nombre constante = li?.dataset?.sectionName || li?.querySelector(".sidebar__nombre-sección")?.textContent || "Sección";
        seleccionarSección(adminNavState.sectionId, nombre);
      }

      si (adminNavState.view === "detalle_del_examen" && adminNavState.Id_del_examen) {
        intentar {
          const exSnap = await getDoc(doc(db, "exámenes", adminNavState.examId));
          const exName = exSnap.exists() ? (exSnap.data()?.nombre || "") : "";
          esperar openExamDetail(adminNavState.examId, exName);
        } atrapar (err) {
          console.error("No se pudo restaurar el examen:", err);
        }
      } demás {
        // lista
        currentExamId = nulo;
        if (examCasesContainer) examCasesContainer.innerHTML = "";
        ocultar(examDetailView);
        si (currentSectionId) {
          cargarExámenesParaSección(currentSectionId);
        }
      }
    }

    // RECURSOS
    si (adminNavState.panel === "recursos") {
      esperar asegurarResourcesAdminLoaded();
      si (adminNavState.view === "detalle_de_recursos" y adminNavState.resourcesTopicId) {
        adminResourcesSelectTopic(adminNavState.resourcesTopicId);
      } de lo contrario si (adminNavState.view === "recursos_nuevos") {
        adminRecursosAbrirNuevoTema();
      } demás {
        adminRecursosOpenList();
      }
    }
  } finalmente {
    _isRestoringNav = falso;
  }
}

let currentExamCases = []; // Casos clínicos en memoria

// Token para evitar “superposición” de exámenes entre secciones
deje que examsLoadToken = 0;

// MINI EXÁMENES
deje que miniCasos = [];
deje que miniCasesLoadedOnce = falso;

// Cache banco para buscadores (carga incremental para escalar a 10,000 casos)
deje que bankCasesCache = [];
deje que bankCasesById = nuevo Mapa();
let bankCasesLoadedOnce = false; // al menos 1 lote cargado
let bankCasesAllLoaded = false; // ya se escaneó todo (o se alcanzó el tope)
let bankCasesLastDoc = null; // cursor de paginación (preguntas)
dejar bankCasesScanCount = 0; // cuántos documentos de preguntas se han escaneado (incluye no-banco)
deja que bankCasesOrderMode = "createdAt"; // "createdAt" | "nombre"
deje que bankCasesLoading = falso;

let bankSearchDebounceTimer = null;
deje que miniBankSearchDebounceTimer = null;

deje que bankSearchRunToken = 0;
dejar miniBankSearchRunToken = 0;

const BANK_SEARCH_BATCH_SIZE = 500; // lote de escaneo Firestore
constante BANK_SEARCH_MAX_RESULTS = 50; // resultados máximos a mostrar
constante BANK_SEARCH_MAX_BANK_CASES = 10000; // tope de casos banco a cachear


/****************************************************
 * UTILIDADES UI
 ****************************************************/

función show(el) {
  si (el) el.classList.remove("oculto");
}

función ocultar(el) {
  si (el) el.classList.add("oculto");
}

función setActivePanel(panelId) {
  const paneles = [panelExams, panelBank, panelMini, panelUsers, panelAnalytics, panelLanding, panelResources].filter(Boolean);
  paneles.forEach((p) => ocultar(p));

  si (panelId === "exámenes") mostrar(panelExámenes);
  si (panelId === "banco") mostrar(panelBank);
  si (panelId === "mini") mostrar(panelMini);
  si (panelId === "usuarios") mostrar(panelUsers);
  si (panelId === "analytics") mostrar(panelAnalytics);
  si (panelId === "aterrizaje") mostrar(panelAterrizaje);
  si (panelId === "recursos") mostrar(panelRecursos);

  // Persistir + historial
  si (!_isRestoringNav) {
    adminNavState.panel = panelId;
    // Ajustar la vista base
    si (panelId === "exámenes") {
      adminNavState.view = examDetailView && !examDetailView.classList.contains("hidden") ? "exam_detail": "exams_list";
    } de lo contrario si (panelId === "recursos") {
      adminNavState.view = adminNavState.resourcesTopicId ? "detalle_de_recursos": "lista_de_recursos";
    } demás {
      adminNavState.view = "panel";
    }
    persistirAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

/****************************************************
 * RESÚMENES / GPC (ADMIN CRUD) - PROYECTO "pagina-buena"
 * Colección: "temas"
 * Campos:
 * - título: cadena
 * - especialidad: cuerda (texto libre)
 * - enlaces: [{ etiqueta, url, tipo }]
 ****************************************************/
constante RECURSOS_FIREBASE_CONFIG = {
  clave API: "AIzaSyBiR8vCqkP1L0UILeM6X-hN4lh9uFR3Tco",
  dominio_de_autorización: "pagina-buena-10b57.firebaseapp.com",
  projectId: "pagina-buena-10b57",
  storageBucket: "pagina-buena-10b57.appspot.com",
  Id. del remitente de mensajería: "158112645052",
  ID de aplicación: "1:158112645052:web:56a23d4c61a51b516e7b7e",
};

deje que _resourcesApp = null;
deje que _resourcesDb = null;
deje que _resourcesLoadedOnce = falso;

deje que _recursosTemas = [];
deje que _resourcesSelectedId = nulo;
deje que _resourcesIsNew = falso;
deje que _resourcesDeleteArmed = falso;
deje que _resourcesDeleteArmTimer = null;

función asegurarRecursosDb() {
  si (_resourcesDb) devuelve _resourcesDb;

  intentar {
    const existente = (getApps() || []).find((a) => a.name === "resourcesApp");
    _resourcesApp = existente || initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");
  } atrapar (err) {
    // Si el nombre ya existe, intenta getApp
    intentar {
      _resourcesApp = getApp("resourcesApp");
    } atrapar {
      console.error("No se pudo inicializar resourcesApp:", err);
      lanzar err;
    }
  }

  _resourcesDb = obtenerFirestore(_resourcesApp);
  devolver _resourcesDb;
}

función canonicalizeSpecialty(texto) {
  const t = (texto || "").toString().trim().toLowerCase();
  si (!t) devuelve "otros";
  if (t.includes("medicina interna") || t.includes("interna")) return "medicina_interna";
  if (t.includes("cirugía") || t.includes("cirugia")) return "cirugia_general";
  si (t.includes("pediatr")) devuelve "pediatria";
  if (t.includes("gine") || t.includes("obst")) return "gine_obstetricia";
  if (t.includes("salud pública") || t.includes("salud publica") || t.includes("epid")) return "salud_publica";
  if (t.includes("acceso gratuito") || t.includes("gratis")) return "acceso_gratuito";
  return "otros";
}

función detectarLinkType(url) {
  constante u = (url || "").toString().toLowerCase().trim();
  si (!u) devuelve "enlace";
  si (u.includes(".pdf") || u.includes("drive.google.com") || u.includes("docs.google.com")) {
    // Puede ser PDF en Drive; dejamos 'pdf' si el texto sugiere PDF
    si (u.includes(".pdf") || u.includes("pdf")) devuelve "pdf";
  }
  devolver "enlace";
}

función setResEditorEnabled(habilitado) {
  si (resTitleInput) resTitleInput.disabled = !enabled;
  si (resSpecialtyRawInput) resSpecialtyRawInput.disabled = !enabled;
  si (resBtnAddLink) resBtnAddLink.disabled = !enabled;
  si (resBtnSave) resBtnSave.disabled = !enabled;
  si (resBtnDelete) resBtnDelete.disabled = !enabled;
}

función renderResTopicCount() {
  si (!resTopicCount) retorna;
  constante total = _recursosTemas.length;
  const filtrado = adminResourcesGetFiltered().length;
  resTopicCount.textContent = `${filtrado} de ${total} temas`;
}

función adminResourcesGetFiltered() {
  const q = (resSearchInput?.value || adminNavState.resourcesSearch || "").toString().trim().toLowerCase();
  clave constante = (resSpecialtyFilter?.valor || adminNavState.resourcesSpecialtyKey || "").toString();

  devolver _resourcesTopics.filter((t) => {
    constante título = (t.título || "").toLowerCase();
    const spec = (t.specialty || "").toLowerCase();
    const matchesText = !q || título.includes(q) || especificación.includes(q);
    const matchesSpec = !key || canonicalizeSpecialty(t.specialty) === clave;
    devuelve coincidenciasTexto y coincidenciasEspec;
  });
}

función renderResTopicList() {
  si (!resTopicList) retorna;

  constantes elementos = adminResourcesGetFiltered();
  renderResTopicCount();

  resTopicList.innerHTML = "";
  si (!elementos.longitud) {
    resTopicList.innerHTML = `<div class="empty-msg">No hay temas para mostrar.</div>`;
    devolver;
  }

  para (const t de elementos) {
    constante tarjeta = documento.createElement("div");
    tarjeta.className = "tarjeta";
    tarjeta.estilo.relleno = "10px";
    card.style.cursor = "puntero";
    si (t.id === _resourcesSelectedId && !_resourcesIsNew) {
      card.style.border = "2px sólido var(--primary, #2b6cb0)";
    }

    const linkCount = Array.isArray(t.links) ? t.links.length : 0;
    const specLabel = (t.specialty || "").toString();

    tarjeta.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(t.title || "(Sin título)")}</div>
          <div class="panel-subtitle">${escapeHtml(specLabel || "Sin especialidad")} · ${linkCount} enlace(s)</div>
        </div>
      </div>
    `;

    card.addEventListener("clic", () => adminResourcesSelectTopic(t.id));
    resTopicList.appendChild(tarjeta);
  }
}

función renderResLinksEditor(enlaces) {
  si (!resLinksWrap) retorna;
  resLinksWrap.innerHTML = "";

  const arr = Array.isArray(enlaces) ? enlaces : [];
  si (!arr.length) {
    resLinksWrap.innerHTML = `<div class="panel-subtitle">Aún no hay enlaces. Usa “Agregar enlace”.</div>`;
    devolver;
  }

  arr.paraCada((l, idx) => {
    constante fila = document.createElement("div");
    fila.dataset.resLinkRow = "1";
    fila.estilo.pantalla = "cuadrícula";
    fila.style.gridTemplateColumns = "1fr 2fr automático";
    fila.estilo.espacio = "8px";
    fila.style.alignItems = "fin";
    fila.style.marginTop = "8px";

    fila.innerHTML = `
      <label clase="campo" estilo="margen:0;">
        Etiqueta
        <input type="text" data-res-link-label value="${escapeAttr(l?.label || "")}" placeholder="Ej. GPC (PDF)" />
      </etiqueta>

      <label clase="campo" estilo="margen:0;">
        URL
        <input type="text" data-res-link-url value="${escapeAttr(l?.url || "")}" placeholder="https://..." />
      </etiqueta>

      <button class="icon-btn" type="button" title="Quitar enlace" data-res-link-remove>🗑</button>
    `;

    fila.querySelector("[datos-res-link-remove]")?.addEventListener("clic", () => {
      fila.eliminar();
      // Si se vacía, re-render mensaje
      si (!resLinksWrap.querySelector("[data-res-link-row]")) {
        renderResLinksEditor([]);
      }
    });

    resLinksWrap.appendChild(fila);
  });
}

función getResLinksFromEditor() {
  const filas = Array.from(resLinksWrap?.querySelectorAll("[datos-res-enlace-fila]") || []);
  constante fuera = [];
  para (const r de filas) {
    etiqueta constante = (r.querySelector("[etiqueta-del-enlace-de-respuesta-datos]")?.valor || "").toString().trim();
    const url = (r.querySelector("[url-enlace-res-datos]")?.value || "").toString().trim();
    si (!url) continúa;
    out.push({ etiqueta: etiqueta || url, url, tipo: detectLinkType(url) });
  }
  volver afuera;
}

función adminResourcesFillEditor(tema) {
  _resourcesIsNew = falso;
  _resourcesSelectedId = tema?.id || nulo;

  si (resTitleInput) resTitleInput.value = tema?.title || "";
  si (resSpecialtyRawInput) resSpecialtyRawInput.valor = tema?.especialidad || "";
  if (resEditorStatus) resEditorStatus.textContent = _resourcesSelectedId ? `Editando: ${topic?.title || ""}` : "Editor de tema";

  renderResLinksEditor(tema?.enlaces || []);
  setResEditorEnabled(verdadero);

  si (resBtnDelete) resBtnDelete.disabled = !_resourcesSelectedId;

  // Estado + historia
  si (!_isRestoringNav) {
    adminNavState.panel = "recursos";
    adminNavState.view = "detalle_de_recursos";
    adminNavState.resourcesTopicId = _resourcesSelectedId;
    adminNavState.resourcesSearch = (resSearchInput?.value || "").toString();
    adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter?.value || "").toString();
    persistirAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

función adminResourcesOpenList() {
  _resourcesIsNew = falso;
  _resourcesSelectedId = nulo;

  if (resEditorStatus) resEditorStatus.textContent = "Selecciona un tema o crea uno nuevo.";
  si (resTitleInput) resTitleInput.valor = "";
  si (resSpecialtyRawInput) resSpecialtyRawInput.valor = "";
  renderResLinksEditor([]);
  setResEditorEnabled(falso);

  si (!_isRestoringNav) {
    adminNavState.panel = "recursos";
    adminNavState.view = "lista_de_recursos";
    adminNavState.resourcesTopicId = nulo;
    adminNavState.resourcesSearch = (resSearchInput?.value || "").toString();
    adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter?.value || "").toString();
    persistirAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

función adminResourcesOpenNewTopic() {
  _resourcesIsNew = verdadero;
  _resourcesSelectedId = nulo;

  if (resEditorStatus) resEditorStatus.textContent = "Creando un nuevo tema";
  si (resTitleInput) resTitleInput.valor = "";
  si (resSpecialtyRawInput) resSpecialtyRawInput.valor = "";
  renderResLinksEditor([]);
  setResEditorEnabled(verdadero);
  si (resBtnDelete) resBtnDelete.disabled = verdadero;

  si (!_isRestoringNav) {
    adminNavState.panel = "recursos";
    adminNavState.view = "recursos_nuevos";
    adminNavState.resourcesTopicId = nulo;
    adminNavState.resourcesSearch = (resSearchInput?.value || "").toString();
    adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter?.value || "").toString();
    persistirAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

función adminResourcesSelectTopic(topicId) {
  const t = _resourcesTopics.find((x) => x.id === topicId);
  si (!t) {
    adminRecursosOpenList();
    devolver;
  }
  adminResourcesFillEditor(t);
  renderResTopicList();
}

función asíncrona loadResourcesTopics() {
  constante rdb = asegurarRecursosDb();
  const q = consulta(colección(rdb, "temas"), orderBy("título", "asc"));
  constante snap = esperar getDocs(q);
  _recursosTemas = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  renderResTopicList();
  renderResTopicCount();
}

función asíncrona ensureResourcesAdminLoaded() {
  si (_resourcesLoadedOnce) retorna;
  _resourcesLoadedOnce = verdadero;

  // Precarga filtros desde estado persistente
  si (resSearchInput && adminNavState.resourcesSearch) resSearchInput.value = adminNavState.resourcesSearch;
  si (resSpecialtyFilter && adminNavState.resourcesSpecialtyKey) resSpecialtyFilter.value = adminNavState.resourcesSpecialtyKey;

  // Vincular eventos (una sola vez)
  resBtnRefresh?.addEventListener("clic", async () => {
    esperar cargaRecursosTemas();
  });

  resBtnNewTopic?.addEventListener("clic", () => {
    adminRecursosAbrirNuevoTema();
    renderResTopicList();
  });

  resBtnBack?.addEventListener("clic", () => {
    const st = historial.estado?.adminNav;
    si (st && (st.view === "detalle_de_recursos" || st.view === "nuevos_recursos")) {
      historia.atrás();
      devolver;
    }
    adminRecursosOpenList();
    renderResTopicList();
  });

  resSearchInput?.addEventListener("entrada", () => {
    si (!_isRestoringNav) {
      adminNavState.resourcesSearch = (resSearchInput.value || "").toString();
      persistirAdminNavState();
    }
    renderResTopicList();
  });

  resSpecialtyFilter?.addEventListener("cambio", () => {
    si (!_isRestoringNav) {
      adminNavState.resourcesSpecialtyKey = (resSpecialtyFilter.value || "").toString();
      persistirAdminNavState();
    }
    renderResTopicList();
  });

  resBtnAddLink?.addEventListener("clic", () => {
    // Si estaba vacío, limpia el mensaje y crea la primera fila
    si (!resLinksWrap.querySelector("[data-res-link-row]")) {
      resLinksWrap.innerHTML = "";
    }
    renderResLinksEditor([...getResLinksFromEditor(), { etiqueta: "", url: "", tipo: "enlace" }]);
  });

  resBtnSave?.addEventListener("clic", async () => {
    constante título = (resTitleInput?.valor || "").toString().trim();
    constante especialidad = (resSpecialtyRawInput?.valor || "").toString().trim();
    constantes enlaces = getResLinksFromEditor();

    si (!título) {
      if (resEditorStatus) resEditorStatus.textContent = "El título es obligatorio.";
      devolver;
    }

    constante rdb = asegurarRecursosDb();
    carga útil constante = {
      título,
      especialidad,
      campo de golf,
      actualizadoEn: serverTimestamp(),
    };

    setLoadingButton(resBtnSave, true, "Guardar");
    intentar {
      si (_resourcesSelectedId && !_resourcesIsNew) {
        esperar updateDoc(doc(rdb, "temas", _resourcesSelectedId), carga útil);
      } demás {
        carga útil.createdAt = serverTimestamp();
        const created = await addDoc(collection(rdb, "temas"), payload);
        _resourcesSelectedId = creado.id;
        _resourcesIsNew = falso;
      }

      esperar cargaRecursosTemas();

      si (_resourcesSelectedId) {
        adminResourcesSelectTopic(_resourcesSelectedId);
      } demás {
        adminRecursosOpenList();
      }
    } atrapar (err) {
      consola.error(err);
      if (resEditorStatus) resEditorStatus.textContent = "No se pudo guardar el tema.";
    } finalmente {
      setLoadingButton(resBtnSave, false, "Guardar");
    }
  });

  resBtnDelete?.addEventListener("clic", async () => {
    si (!_resourcesSelectedId || _resourcesIsNew) devolver;

    // Confirmación sin ventanas emergentes: doble click en <= 6s
    si (!_recursosEliminarArmado) {
      _resourcesDeleteArmed = verdadero;
      if (resEditorStatus) resEditorStatus.textContent = 'Confirmar eliminación: presione "Eliminar" otra vez (6s).';
      si (_resourcesDeleteArmTimer) clearTimeout(_resourcesDeleteArmTimer);
      _resourcesDeleteArmTimer = setTimeout(() => {
        _resourcesDeleteArmed = falso;
        _resourcesDeleteArmTimer = nulo;
        if (resEditorStatus) resEditorStatus.textContent = "Eliminación cancelada.";
      }, 6000);
      devolver;
    }

    _resourcesDeleteArmed = falso;
    si (_resourcesDeleteArmTimer) clearTimeout(_resourcesDeleteArmTimer);
    _resourcesDeleteArmTimer = nulo;

    constante rdb = asegurarRecursosDb();
    setLoadingButton(resBtnDelete, verdadero, "Eliminar");
    intentar {
      esperar deleteDoc(doc(rdb, "temas", _resourcesSelectedId));
      _resourcesSelectedId = nulo;
      _resourcesIsNew = falso;
      esperar cargaRecursosTemas();
      adminRecursosOpenList();
      renderResTopicList();
      if (resEditorStatus) resEditorStatus.textContent = "Tema eliminado.";
    } atrapar (err) {
      consola.error(err);
      if (resEditorStatus) resEditorStatus.textContent = "No se pudo eliminar el tema.";
    } finalmente {
      setLoadingButton(resBtnDelete, false, "Eliminar");
    }
  });



  // Cargar datos
  esperar cargaRecursosTemas();
  adminRecursosOpenList();
}

función escapeHtml(str) {
  devolver (str || "")
    .toString()
    .replace(/&/g, "&")
    .reemplazar(/</g, "<")
    .reemplazar(/>/g, ">")
    .reemplazar(/"/g, """)
    .replace(/'/g, "'");
}

función escapeAttr(str) {
  devolver escapeHtml(str).replace(/`/g, "`");
}



función setLoadingButton(btn, isLoading, textDefault = "Guardar") {
  si (!btn) retorna;
  si (estáCargando) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = verdadero;
  } demás {
    btn.textContent = btn.dataset.originalText || texto predeterminado;
    btn.disabled = falso;
  }
}

función renderEmptyMessage(contenedor, texto) {
  si (!contenedor) retorna;
  contenedor.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${texto}
    </div>
  `;
}

/**
 * Abre un archivo de entrada y devuelve el JSON analizado al callback.
 */
función openJsonFilePicker(onLoaded) {
  constante entrada = document.createElement("entrada");
  entrada.type = "archivo";
  entrada.aceptar = "aplicacion/json,.json";

  entrada.addEventListener("cambio", () => {
    const archivo = entrada.archivos && entrada.archivos[0];
    si (!archivo) retorna;

    const lector = nuevo FileReader();

    lector.onload = () => {
      intentar {
        const json = JSON.parse(lector.resultado);
        si (tipo de onLoaded === "función") {
          al cargar(json);
        }
      } atrapar (err) {
        console.error("JSON inválido:", err);
        alert("El archivo no contiene un JSON válido.");
      }
    };

    lector.onerror = () => {
      console.error("Error al leer el archivo JSON.");
      alert("No se pudo leer el archivo JSON.");
    };

    lector.readAsText(archivo);
  });

  entrada.click();
}

/****************************************************
 * MODAL GENÉRICO (SE CONSERVA PARA SECCIONES/USUARIOS/ETC)
 ****************************************************/

función openModal({ título, bodyHtml, onOk }) {
  si (!modalOverlay || !modalBox) retorna;
  modalTitle.textContent = título || "";
  modalBody.innerHTML = bodyHtml || "";
  modalOkHandler = onOk || nulo;
  mostrar(modalOverlay);
}

función closeModal() {
  si (!modalOverlay) retorna;
  modalBody.innerHTML = "";
  modalOkHandler = nulo;
  ocultar(superposición modal);
}

si (superposición modal) {
  modalOverlay.addEventListener("clic", (e) => {
    si (e.target === modalOverlay) {
      cerrarModal();
    }
  });
}

si (modalBtnCancel) {
  modalBtnCancel.addEventListener("clic", () => {
    cerrarModal();
  });
}

si (modalBtnOk) {
  modalBtnOk.addEventListener("clic", async () => {
    si (tipo de modalOkHandler === "función") {
      esperar modalOkHandler();
    }
  });
}

/****************************************************
 * AYUDANTES: normalización y etiquetas
 ****************************************************/

función normalizarTexto(str) {
  devolver (str || "")
    .toString()
    .toLowerCase()
    .normalizar("NFD")
    .reemplazar(/[\u0300-\u036f]/g, "")
    .reemplazar(/\s+/g, " ")
    .recortar();
}

función getSpecialtyLabel(clave) {
  si (!key) devuelve "";
  devolver ESPECIALIDADES && ESPECIALIDADES[clave] ? ESPECIALIDADES[clave] : clave;
}

// ✅ util: identifica si un doc de questions es "banco" (no es caso dentro de un examen)
función isBankCaseDoc(datos) {
  const ex = (datos?.examId || "").toString().trim();
  devolver !ex; // banco = sin examId
}

/****************************************************
 * ✅ BLOQUEO DUPLICADOS: conjuntos por bankCaseId
 ****************************************************/

función obtenerCurrentExamBankCaseIdsSet() {
  constante conjunto = nuevo Conjunto();
  (casosdeexamenactuales || []).forEach((c) => {
    si (c && c.bankCaseId) establecer.add(c.bankCaseId);
  });
  conjunto de retorno;
}

función getMiniBankCaseIdsSet() {
  constante conjunto = nuevo Conjunto();
  (miniCasos || []).forEach((c) => {
    si (c && c.bankCaseId) establecer.add(c.bankCaseId);
  });
  conjunto de retorno;
}

/****************************************************
 * ✅ usageCount robusto: ayudantes delta
 ****************************************************/

función countIds(arr) {
  constante m = nuevo Mapa();
  (arr || []).paraCada((id) => {
    si (!id) retorna;
    m.set(id, (m.get(id) || 0) + 1);
  });
  devolver m;
}

función asíncrona applyUsageDelta(prevIds, newIds) {
  constante prevMap = countIds(prevIds);
  constante nuevoMapa = countIds(nuevosIds);

  constante allIds = nuevo Conjunto([...prevMap.keys(), ...newMap.keys()]);
  const actualizaciones = [];

  allIds.paraCada((id) => {
    constante delta = (newMap.get(id) || 0) - (prevMap.get(id) || 0);
    si (delta !== 0) {
      actualizaciones.push(
        updateDoc(doc(db, "preguntas", id), {
          usageCount: incremento(delta),
          actualizadoEn: serverTimestamp(),
        }).catch((e) => console.warn("No se pudo ajustar useCount:", id, e))
      );
    }
  });

  si (actualizaciones.longitud) {
    esperar Promise.all(actualizaciones);
  }

  // refrescar cache de buscadores para que useCount se vea actualizado
  restablecerCasosBancaSearchCache();
}


función resetBankCasesSearchCache() {
  bankCasesCache = [];
  bankCasesById = nuevo Mapa();
  bankCasesLoadedOnce = falso;
  bankCasesAllLoaded = falso;
  bankCasesLastDoc = nulo;
  recuentoDeCasosBancoScan = 0;
  bankCasesOrderMode = "creadoEn";
  bankCasesLoading = falso;
}

/****************************************************
 * BUSCADOR DE BANCO PARA AGREGAR CASOS A EXAMEN Y MINI
 * ✅ usa "preguntas" (solo casos banco: sin examId)
 ****************************************************/


función asíncrona loadMoreBankCasesFromFirestore(batchSize = BANK_SEARCH_BATCH_SIZE) {
  si (bankCasesLoading || bankCasesAllLoaded) devolver { agregado: [], escaneado: 0 };

  // Tope duro (petición del usuario: hasta ~10,000 casos banco)
  si (bankCasesCache.length >= BÚSQUEDA_BANCO_MÁXIMA_BANCO_CASOS) {
    bankCasesAllLoaded = verdadero;
    devolver { añadido: [], escaneado: 0 };
  }

  bankCasesLoading = verdadero;

  intentar {
    deje qBase;

    // Preferimos orden por createAt; si falla, caeremos en un documentId
    intentar {
      qBase = consulta(
        colección(db, "preguntas"),
        ordenarPor("creadoEn", "desc"),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        límite(tamaño del lote)
      );
      bankCasesOrderMode = "creadoEn";
    } captura (e1) {
      qBase = consulta(
        colección(db, "preguntas"),
        ordenarPor(documentId()),
        ...(bankCasesLastDoc ? [startAfter(bankCasesLastDoc)] : []),
        límite(tamaño del lote)
      );
      bankCasesOrderMode = "nombre";
    }

    constante snap = esperar getDocs(qBase);

    si (!snap || !snap.docs || !snap.docs.length) {
      bankCasesAllLoaded = verdadero;
      devolver { añadido: [], escaneado: 0 };
    }

    bankCasesLastDoc = snap.docs[snap.docs.length - 1];
    bankCasesScanCount += tamaño de ajuste;

    // Convertir y filtrar solo casos "banco" (= sin examId)
    constante añadida = [];

    para (const d de snap.docs) {
      si (!d || !d.id) continuar;
      si (bankCasesById.has(d.id)) continuar;

      constante datos = d.datos() || {};
      constante conId = { id: d.id, ...data };

      si (!isBankCaseDoc(withId)) continuar;

      const preguntasArr = Array.isArray(conId.preguntas) ? conId.preguntas : [];
      const temaTxt = (conId.tema || "").toString();

      entrada constante = {
        ...conId,
        preguntas: preguntasArr,
        tema: temaTxt,
        _normCase: normalizarTexto(conId.caseText || ""),
        _normTopic: normalizarTexto(temaTxt),
        _normSpec: normalizarTexto(conId.especialidad || ""),
        _normQs: normalizarTexto(preguntasArr.map((q) => q.preguntaTexto || "").join(" ")),
      };

      bankCasesById.set(entrada.id, entrada);
      bankCasesCache.push(entrada);
      añadido.push(entrada);

      si (bankCasesCache.length >= BÚSQUEDA_BANCO_MÁXIMA_BANCO_CASOS) {
        bankCasesAllLoaded = verdadero;
        romper;
      }
    }

    // Si el lote fue menor al solicitado, probablemente lleguemos al final
    si (snap.size < batchSize) bankCasesAllLoaded = verdadero;

    bankCasesLoadedOnce = verdadero;
    devolver { añadido, escaneado: snap.size };
  } atrapar (err) {
    console.error("Error al cargar banco incremental:", err);
    // degradar a "allLoaded" para que no se quede en bucle
    bankCasesAllLoaded = verdadero;
    devolver { añadido: [], escaneado: 0 };
  } finalmente {
    bankCasesLoading = falso;
  }
}

función asíncrona loadBankCasesIfNeeded() {
  // Carga mínima inicial para mostrar que el banco está disponible.
  si (bankCasesLoadedOnce) retorna;

  si (!bankSearchResults && !miniBankSearchResults) retorna;

  constante objetivo = resultadosBúsquedaBanco || resultadosBúsquedaMiniBanco;

  objetivo.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      Cargando banco de casos (modo incremental)…
    </div>
  `;

  esperar cargarMásCasosBancaDesdeFirestore(TAMAÑO_DE_LOTE_DE_BÚSQUEDA_BANCARIA);

  // Mensaje inicial
  constante msg = bankCasesCache.length
    ? `Banco listo. Escribe para buscar. (Cargados: ${bankCasesCache.length} · Escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · seguirá cargando según tu búsqueda"})`
    : "No se encontraron casos en el banco.";

  si (bankSearchResults) renderEmptyMessage(bankSearchResults, msg);
  si (miniBankSearchResults) renderEmptyMessage(miniBankSearchResults, msg);
}

función tokenizeBankSearch(rawQuery) {
  constante q = normalizarTexto(rawQuery);
  si (!q) devuelve [];
  const tokens = q.split(" ").filter((t) => t.length >= 2);
  devolver tokens.slice(0, 6); // tope para evitar consultas demasiado costosas
}

función bankCaseMatchesTokens(c, tokens) {
  si (!tokens || !tokens.length) devuelve falso;
  constante pajar = `${c._normTopic} ${c._normSpec} ${c._normCase} ${c._normQs}`;
  devuelve tokens.every((t) => haystack.includes(t));
}

función buscarCasosBancos(rawQuery, maxResults = BANCO_BÚSQUEDA_MÁXIMO_RESULTADOS) {
  constante tokens = tokenizeBankSearch(rawQuery);
  si (!tokens.length) devuelve [];

  const resultados = [];
  para (const c de bankCasesCache) {
    si (bankCaseMatchesTokens(c, tokens)) resultados.push(c);
    si (resultados.length >= maxResults) romper;
  }
  devolver resultados;
}

función asincrónica searchBankCasesAsync(rawQuery, opts = {}) {
  constante maxResults = Número(opts.maxResults || MÁXIMOS_RESULTADOS_BÚSQUEDA_BANCARIA);
  constanteLoteSize = Número(opts.loteSize || TAMAÑO_LOTE_BÚSQUEDA_BANCARIA);
  const cancelFn = typeof opts.isCancelled === "función" ? opts.isCancelled : () => falso;

  constante tokens = tokenizeBankSearch(rawQuery);
  si (!tokens.length) {
    devolver {
      resultados: [],
      meta: {
        fichas: 0,
        en caché: bankCasesCache.length,
        escaneado: bankCasesScanCount,
        allLoaded: casos bancarios todos cargados,
      },
    };
  }

  // 1) buscar en caché actual
  deje resultados = [];
  para (const c de bankCasesCache) {
    si (cancelFn()) devuelve { resultados: [], meta: { cancelado: verdadero } };
    si (bankCaseMatchesTokens(c, tokens)) resultados.push(c);
    si (resultados.length >= maxResults) romper;
  }

  // 2) si no hay suficientes resultados, seguir cargando lotes hasta:
  // a) llegar al tope de resultados, ob) escanear todo (para ser "correcto")
  mientras (!bankCasesAllLoaded && resultados.length < maxResults) {
    si (cancelFn()) devuelve { resultados: [], meta: { cancelado: verdadero } };

    const { agregado } = await loadMoreBankCasesFromFirestore(batchSize);
    si (cancelFn()) devuelve { resultados: [], meta: { cancelado: verdadero } };

    si (!añadido || !añadido.longitud) {
      // Sin nuevos -> fin
      romper;
    }

    para (const c de añadido) {
      si (bankCaseMatchesTokens(c, tokens)) resultados.push(c);
      si (resultados.length >= maxResults) romper;
    }
  }

  // Deduplicación + límite
  const visto = nuevo Conjunto();
  resultados = resultados.filtro((x) => (visto.tiene(x.id) ? falso : (visto.añadir(x.id), verdadero)));
  resultados = resultados.slice(0, maxResults);

  devolver {
    resultados,
    meta: {
      tokens: tokens.length,
      en caché: bankCasesCache.length,
      escaneado: bankCasesScanCount,
      allLoaded: casos bancarios todos cargados,
      limitado: resultados.length >= maxResults && !bankCasesAllLoaded,
    },
  };
}
función renderBankSearchResults(resultados, queryText, meta = null) {
  si (!bankSearchResults) retorna;

  si (!texto de consulta) {
    constante baseMsg = bankCasesLoadedOnce
      ? `Banco listo. Escribe un tema arriba para buscar (cargados: ${bankCasesCache.length}).`
      : "Escribe un tema para buscar.";

    estadísticas constantes = meta
      ? ` Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " (cargando según búsqueda)"}`
      : "";

    renderEmptyMessage(bankSearchResults, baseMsg + estadísticas);
    devolver;
  }

  si (!resultados.longitud) {
    renderMensajeVacío(
      Resultados de búsqueda bancaria,
      `Sin resultados para "${queryText}". Prueba con otro término.`
    );
    devolver;
  }

  // ✅ set de ya agregados en este examen (por bankCaseId = id del doc banco)
  constante usedSet = getCurrentExamBankCaseIdsSet();

  constante statsBar = meta ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af;">
      Coincidencias: ${results.length}${meta.capped ? " (mostrando primeras coincidencias; refina búsqueda)" : ""} · Cargados: ${meta.cached ?? bankCasesCache.length} · Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " · buscando…"}
    </div>
  ` : "";

  const html = statsBar + resultados
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.preguntas) ? c.preguntas.length : 0;
      fragmento constante = (c.caseText || "").slice(0, 220);
      constante temaTxt = (c.tema || "").toString();
      const uso = tipo de c.usageCount === "número" ? c.usageCount : 0;

      constante isUsed = usedSet.has(c.id);

      regresar `
        <div clase="elemento-de-tarjeta" estilo="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">
                ${topicTxt ? topicTxt : (specLabel ? specLabel : "Caso del banco")}
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${specLabel ? specLabel : "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"} · Usado: ${usage}
              </div>
            </div>
            <button class="btn btn-sm btn-primary admin-bank-add-case" data-id="${c.id}" ${isUsed ? "disabled" : ""}>
              ${¿se utiliza? "Ya está en este examen": "Agregar a este examen"}
            </botón>
          </div>
          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .unirse("");

  bankSearchResults.innerHTML = html;

  Resultados de búsqueda bancaria
    .querySelectorAll(".admin-bank-add-case")
    .paraCada((btn) => {
      btn.addEventListener("clic", async () => {
        constante id = btn.conjunto de datos.id;
        constante encontrado = bankCasesById.get(id) || bankCasesCache.find((x) => x.id === id);
        si (!encontrado) retorna;

        si (!currentExamId) {
          alert("Primero abre un examen.");
          devolver;
        }

        // ✅ bloqueo duro (por si el UI no alcanzó a refrescar)
        sincronizarCasosDeExámenesActualesDesdeDOM();
        const usedNow = getCurrentExamBankCaseIdsSet();
        si (usadoAhora.tiene(id)) {
          alert("Ese caso ya está agregado en este examen. No se puede repetir.");
          devolver;
        }

        constante clonada = {
          bankCaseId: found.id, // ✅ persistente
          caseText: encontrado.caseText || "",
          especialidad: found.specialty || "",
          tema: (encontrado.tema || "").toString(),
          preguntas: Array.isArray(encontrado.preguntas)
            ? encontrado.preguntas.mapa((q) => ({
                preguntaTexto: q.preguntaTexto || "",
                opciónA: q.opcionA || "",
                opciónB: q.opcionB || "",
                opciónC: q.opcionC || "",
                opciónD: q.opcionD || "",
                opcióncorrecta: q.opcióncorrecta || "",
                justificación: q.justificación || "",
                subtipo: q.subtipo || "salud_publica",
                dificultad: q.dificultad || "medios",
              }))
            : [crearPreguntaVacía()],
        };

        currentExamCases.push(clonado);
        renderizarCasosDeExamen();

        btn.textContent = "Agregado";
        btn.disabled = verdadero;
      });
    });
}

función initBankSearchUI() {
  si (!bankSearchInput || !bankSearchResults) regresa;
  si (bankSearchInput.dataset.bound === "1") devolver;
  bankSearchInput.dataset.bound = "1";

  bankSearchInput.addEventListener("entrada", () => {
    si (bankSearchDebounceTimer) clearTimeout(bankSearchDebounceTimer);
    bankSearchDebounceTimer = establecerTiempo de espera(async () => {
      constante raw = bankSearchInput.valor || "";
      constante recortada = raw.trim();
      const miToken = ++bankSearchRunToken;

      si (!recortado) {
        renderBankSearchResults([], "", { escaneado: bankCasesScanCount, almacenado en caché: bankCasesCache.length, allLoaded: bankCasesAllLoaded });
        devolver;
      }

      // retroalimentación inmediata
      renderMensajeVacío(
        Resultados de búsqueda bancaria,
        `Buscando "${escapeHtml(trimmed)}"… (cargados: ${bankCasesCache.length} · escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · buscando en todo el banco"})`
      );

      const { resultados, meta } = await searchBankCasesAsync(recortado, {
        maxResults: MÁXIMOS_RESULTADOS_DE_BÚSQUEDA_BANCARIA,
        tamaño_del_lote: TAMAÑO_DE_LOTE_DE_BÚSQUEDA_BANCARIA,
        isCancelled: () => myToken !== bankSearchRunToken,
      });

      if (myToken! == bankSearchRunToken) regresa;

      renderBankSearchResults(resultados, recortado, meta);
    }, 320);
  });
}

función resetBankSearchUI() {
  si (bankSearchInput) bankSearchInput.value = "";
  if (bankSearchResults) bankSearchResults.innerHTML = "";
}

/****************************************************
 * ✅ BUSCADOR DE BANCO PARA MINI EXÁMENES (mismo banco cache)
 ****************************************************/

función renderMiniBankSearchResults(resultados, queryText, meta = null) {
  si (!miniBankSearchResults) retorna;

  si (!texto de consulta) {
    constante baseMsg = bankCasesLoadedOnce
      ? `Banco listo. Escribe para buscar (cargados: ${bankCasesCache.length}).`
      : "Escribe para buscar.";

    estadísticas constantes = meta
      ? ` Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " (cargando según búsqueda)"}`
      : "";

    renderEmptyMessage(miniBankSearchResults, baseMsg + estadísticas);
    devolver;
  }

  si (!resultados.longitud) {
    renderMensajeVacío(
      Resultados de búsqueda de miniBank,
      `Sin resultados para "${queryText}". Prueba con otro término.`
    );
    devolver;
  }

  constante usedSet = getMiniBankCaseIdsSet();

  constante statsBar = meta ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af;">
      Coincidencias: ${results.length}${meta.capped ? " (mostrando primeras coincidencias; refina búsqueda)" : ""} · Cargados: ${meta.cached ?? bankCasesCache.length} · Escaneados: ${meta.scanned ?? bankCasesScanCount}${(meta.allLoaded ?? bankCasesAllLoaded) ? "" : " · buscando…"}
    </div>
  ` : "";

  const html = statsBar + resultados
    .map((c) => {
      const specLabel = getSpecialtyLabel(c.specialty);
      const qCount = Array.isArray(c.preguntas) ? c.preguntas.length : 0;
      fragmento constante = (c.caseText || "").slice(0, 220);
      constante temaTxt = (c.tema || "").toString();
      const uso = tipo de c.usageCount === "número" ? c.usageCount : 0;

      constante isUsed = usedSet.has(c.id);

      regresar `
        <div clase="elemento-de-tarjeta" estilo="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">
                ${topicTxt ? topicTxt : (specLabel ? specLabel : "Caso del banco")}
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">
                ${specLabel ? specLabel : "—"} · ${qCount} pregunta${qCount === 1 ? "" : "s"} · Usado: ${usage}
              </div>
            </div>
            <button class="btn btn-sm btn-primary admin-mini-bank-add-case" data-id="${c.id}" ${isUsed ? "disabled" : ""}>
              ${¿se utiliza? "Ya está en mini": "Agregar a mini solicitudes"}
            </botón>
          </div>

          <div style="font-size:13px;line-height:1.45;color:#e5e7eb;">
            ${snippet}${(c.caseText || "").length > 220 ? "…" : ""}
          </div>
        </div>
      `;
    })
    .unirse("");

  miniBankSearchResults.innerHTML = html;

  Resultados de búsqueda de miniBank
    .querySelectorAll(".admin-mini-bank-add-case")
    .paraCada((btn) => {
      btn.addEventListener("clic", async () => {
        constante id = btn.conjunto de datos.id;
        constante encontrado = bankCasesById.get(id) || bankCasesCache.find((x) => x.id === id);
        si (!encontrado) retorna;

        sincronizarMiniCasesFromDOM();

        const usadoAhora = getMiniBankCaseIdsSet();
        si (usadoAhora.tiene(id)) {
          alert("Ese caso ya está agregado en mini exámenes. No se puede repetir.");
          devolver;
        }

        constante clonada = {
          id: nulo,
          bankCaseId: found.id, // ✅ persistente
          caseText: encontrado.caseText || "",
          especialidad: found.specialty || "",
          preguntas: Array.isArray(encontrado.preguntas)
            ? encontrado.preguntas.mapa((q) => ({
                preguntaTexto: q.preguntaTexto || "",
                opciónA: q.opcionA || "",
                opciónB: q.opcionB || "",
                opciónC: q.opcionC || "",
                opciónD: q.opcionD || "",
                opcióncorrecta: q.opcióncorrecta || "",
                justificación: q.justificación || "",
                subtipo: q.subtipo || "salud_publica",
                dificultad: q.dificultad || "medios",
              }))
            : [crearPreguntaVacía()],
        };

        miniCases.push(clonado);
        renderMiniCases();

        btn.textContent = "Agregado";
        btn.disabled = verdadero;
      });
    });
}

función initMiniBankSearchUI() {
  si (!miniBankSearchInput || !miniBankSearchResults) devolver;
  si (miniBankSearchInput.dataset.bound === "1") devolver;
  miniBankSearchInput.dataset.bound = "1";

  miniBankSearchInput.addEventListener("entrada", () => {
    si (miniBankSearchDebounceTimer) clearTimeout(miniBankSearchDebounceTimer);

    miniBankSearchDebounceTimer = setTimeout(async () => {
      constante raw = miniBankSearchInput.valor || "";
      constante recortada = raw.trim();
      const miToken = ++miniBankSearchRunToken;

      si (!recortado) {
        renderMiniBankSearchResults([], "", { escaneado: bankCasesScanCount, almacenado en caché: bankCasesCache.length, allLoaded: bankCasesAllLoaded });
        devolver;
      }

      renderMensajeVacío(
        Resultados de búsqueda de miniBank,
        `Buscando "${escapeHtml(trimmed)}"… (cargados: ${bankCasesCache.length} · escaneados: ${bankCasesScanCount}${bankCasesAllLoaded ? "" : " · buscando en todo el banco"})`
      );

      const { resultados, meta } = await searchBankCasesAsync(recortado, {
        maxResults: MÁXIMOS_RESULTADOS_DE_BÚSQUEDA_BANCARIA,
        tamaño_del_lote: TAMAÑO_DE_LOTE_DE_BÚSQUEDA_BANCARIA,
        está cancelado: () => myToken !== miniBankSearchRunToken,
      });

      if (myToken! == miniBankSearchRunToken) regresa;

      renderMiniBankSearchResults(resultados, recortado, meta);
    }, 320);
  });
}

función resetMiniBankSearchUI() {
  si (miniBankSearchInput) miniBankSearchInput.valor = "";
  if (miniBankSearchResults) miniBankSearchResults.innerHTML = "";
}


/****************************************************
 * ✅ GENERADOR AUTOMÁTICO DE EXÁMENES (POR TEMAS + CUPOS POR ESPECIALIDAD/SUBTIPO)
 * - No altera el flujo existente: solo rellena currentExamCases y renderiza.
 * - Prioriza casos con menor useCount.
 ****************************************************/

función buildAutoGenTargetRow(inicial = {}) {
  si (!autoGenTargetsWrap) devuelve nulo;

  constante fila = document.createElement("div");
  fila.className = "auto-gen-row";
  fila.estilo.pantalla = "cuadrícula";
  fila.style.gridTemplateColumns = "1.4fr 1.2fr 0.8fr automático";
  fila.estilo.espacio = "8px";
  fila.style.alignItems = "fin";
  fila.style.marginTop = "10px";

  const specialityValue = initial.specialty || Object.keys(ESPECIALIDADES)[0] || "";
  const subtypeValue = initial.subtype || "urgencias";
  const countValue = typeof initial.count === "número" ? initial.count : 0;

  fila.innerHTML = `
    <label clase="campo" estilo="margen:0;">
      <span>Especialidad</span>
      <select class="auto-gen-specialty">
        ${Object.entries(ESPECIALIDADES)
          .map(([k, etiqueta]) => `<opción valor="${k}" ${k === specialityValue ? "seleccionado" : ""}>${etiqueta}</opción>`)
          .unirse("")}
      </seleccionar>
    </etiqueta>

    <label clase="campo" estilo="margen:0;">
      Subtipo
      <seleccionar clase="subtipo-gen-automático">
        ${Objeto.entradas(SUBTIPOS)
          .map(([k, etiqueta]) => `<opción valor="${k}" ${k === subtipoValor ? "seleccionado" : ""}>${etiqueta}</opción>`)
          .unirse("")}
      </seleccionar>
    </etiqueta>

    <label clase="campo" estilo="margen:0;">
      <span># preguntas</span>
      <input clase="auto-gen-count" tipo="número" min="0" paso="1" valor="${countValue}" />
    </etiqueta>

    <button type="button" class="btn btn-outline btn-sm auto-gen-remove" style="height:40px;">
      Quitar
    </botón>
  `;

  fila.querySelector(".auto-gen-remove")?.addEventListener("clic", () => {
    fila.eliminar();
    renderAutoGenSummary();
  });

  fila.querySelectorAll("seleccionar,entrada").forEach((el) => {
    el.addEventListener("cambio", renderAutoGenSummary);
    el.addEventListener("entrada", renderAutoGenSummary);
  });

  fila de retorno;
}

función getAutoGenTargetsFromUI() {
  si (!autoGenTargetsWrap) devuelve [];
  constante filas = autoGenTargetsWrap.querySelectorAll(".auto-gen-row");
  const objetivos = [];
  filas.paraCada((r) => {
    const especialidad = r.querySelector(".auto-gen-specialty")?.valor || "";
    constante subtipo = r.querySelector(".auto-gen-subtype")?.valor || "";
    const count = Número(r.querySelector(".auto-gen-count")?.valor || 0);

    si (!especialidad || !subtipo) retorna;
    si (!Number.isFinite(count) || count <= 0) devolver;

    objetivos.push({ especialidad, subtipo, conteo });
  });
  objetivos de retorno;
}

función parseAutoGenTopicQueries(raw) {
  const txt = (raw || "").toString().trim();
  si (!txt) devuelve [];
  líneas constantes = txt
    .dividir(/\n|\r/)
    .map((s) => s.trim())
    .filtro(Booleano);

  // Cada línea es una consulta; si hay una sola línea con comas, también se permite
  si (líneas.longitud === 1 && líneas[0].incluye(",")) {
    líneas de retorno[0]
      .dividir(",")
      .map((s) => s.trim())
      .filter(booleano)
      .map((q) => tokenizeBankSearch(q));
  }

  devolver líneas.map((q) => tokenizeBankSearch(q));
}

función bankCaseMatchesAnyTopicQuery(bankCase, topicQueriesTokens) {
  si (!topicQueriesTokens || !topicQueriesTokens.length) devuelve verdadero;
  devolver temaQueriesTokens.some((tokens) => tokens.length && bankCaseMatchesTokens(bankCase, tokens));
}

función renderAutoGenSummary() {
  si (!autoGenSummary) retorna;

  constante objetivos = getAutoGenTargetsFromUI();
  const total = objetivos.reduce((acc, t) => acc + t.count, 0);

  si (!objetivos.longitud) {
    autoGenSummary.innerHTML = `
      <div style="font-size:12px;color:#9ca3af;">
        Agrega al menos un objetivo (especialidad + subtipo + # preguntas).
      </div>
    `;
    devolver;
  }

  // Agrupar por especialidad
  constante porSpec = {};
  objetivos.paraCada((t) => {
    si (!porEspec[t.especialidad]) porEspec[t.especialidad] = [];
    porSpec[t.specialty].push(t);
  });

  líneas constantes = Object.entries(bySpec).map(([spec, items]) => {
    constante specLabel = getSpecialtyLabel(especificación);
    partes constantes = elementos
      .map((it) => `${SUBTIPOS[it.subtipo] || it.subtipo}: ${it.count}`)
      .unirse(" · ");
    devolver `<div style="margin-top:6px;"><b>${escapeHtml(specLabel || spec)}</b>: ${escapeHtml(partes)}</div>`;
  });

  autoGenSummary.innerHTML = `
    <div style="font-size:12px;color:#9ca3af;">
      Objetivo total: <b style="color:#e5e7eb;">${total}</b> preguntas
      ${líneas.join("")}
    </div>
  `;
}

función asíncrona ensureBankLoadedForGenerator(minCandidates = 1) {
  // Asegura que haya caché inicial
  esperar loadBankCasesIfNeeded();

  // Si ya hay suficientes en caché o ya se cargó todo, OK.
  si (bankCasesAllLoaded || bankCasesCache.length >= minCandidates) devolver;

  // Degradar: cargar unos lotes extra.
  deje que el guardia = 0;
  mientras (!bankCasesAllLoaded && bankCasesCache.length < minCandidates && guard < 25) {
    guardia++;
    esperar cargarMásCasosBancaDesdeFirestore(TAMAÑO_DE_LOTE_DE_BÚSQUEDA_BANCARIA);
  }
}

función computeSubtypeCountsForCaseQuestions(preguntasArr) {
  const counts = { salud_publica: 0, medicina_familiar: 0, urgencias: 0 };
  (preguntasArr || []).forEach((q) => {
    const st = (q && q.subtype) ? q.subtype : "salud_publica";
    si (counts[st] === indefinido) counts[st] = 0;
    cuenta[st] += 1;
  });
  el retorno cuenta;
}

función cloneBankCaseForExam(bankCase, keptIdxs) {
  const allQs = Array.isArray(bankCase.preguntas) ? bankCase.preguntas : [];
  const idxs = Array.isArray(keptIdxs) && keptIdxs.length ? keptIdxs : allQs.map((_, i) => i);

  const pickedQs = idxs.map((i) => allQs[i]).filter(Boolean).map((q) => ({
    preguntaTexto: q.preguntaTexto || "",
    opciónA: q.opcionA || "",
    opciónB: q.opcionB || "",
    opciónC: q.opcionC || "",
    opciónD: q.opcionD || "",
    opcióncorrecta: q.opcióncorrecta || "",
    justificación: q.justificación || "",
    subtipo: q.subtipo || "salud_publica",
    dificultad: q.dificultad || "medios",
  }));

  // Seguridad: mínimo 2 preguntas por caso (requisito del usuario)
  si (pickedQs.length < 2) {
    // reserva: no clonar
    devuelve nulo;
  }

  devolver {
    bankCaseId: bankCase.id,
    caseText: bankCase.caseText || "",
    especialidad: bankCase.specialty || "",
    tema: (bankCase.topic || "").toString(),
    preguntas: pickedQs,
  };
}

función buildRemainingMap(objetivos) {
  const restante = nuevo Mapa();
  objetivos.paraCada((t) => {
    clave constante = `${t.specialty}|${t.subtype}`;
    restante.set(clave, (restante.get(clave) || 0) + Número(t.count || 0));
  });
  devolver restante;
}

función total_residual(mapa_residual) {
  sea ​​total = 0;
  para (const v de remainingMap.values()) total += v;
  devolver total;
}

función restanteParaEspecialidad(maparestante, especialidad) {
  sea ​​total = 0;
  para (const [k, v] de remainingMap.entries()) {
    si (k.startsWith(`${especialidad}|`)) total += v;
  }
  devolver total;
}

función canFitVariant(remainingMap, especialidad, contribCounts) {
  para (const [subtipo, c] de Object.entries(contribCounts)) {
    const need = remainingMap.get(`${especialidad}|${subtipo}`) || 0;
    si (c > need) devuelve falso;
  }
  devuelve verdadero;
}

función applyVariant(remainingMap, especialidad, contribCounts) {
  para (const [subtipo, c] de Object.entries(contribCounts)) {
    const clave = `${especialidad}|${subtipo}`;
    const need = remainingMap.get(clave) || 0;
    remainingMap.set(clave, Math.max(0, necesidad - c));
  }
}

función pickBestVariantForCase(bankCase, remainingMap) {
  const qs = Array.isArray(bankCase.preguntas) ? bankCase.preguntas : [];
  si (qs.length < 2) devuelve nulo;

  const variantes = [];
  si (qs.length === 2) {
    variantes.push([0, 1]);
  } de lo contrario si (qs.length >= 3) {
    variantes.push([0, 1, 2], [0, 1], [0, 2], [1, 2]);
  }

  constante spec = bankCase.specialty || "";
  si (!spec) devuelve nulo;

  sea ​​mejor = nulo;

  para (const idxs de variantes) {
    constante pickedQs = idxs.map((i) => qs[i]).filter(Boolean);
    constante contrib = computeSubtypeCountsForCaseQuestions(pickedQs);

    // Solo evaluamos variantes que NO se pasan del cupo solicitado.
    si (!canFitVariant(remainingMap, spec, contrib)) continuar;

    // puntaje = # preguntas que realmente cubren necesidades (aquí será = total variante)
    puntuación constante = idxs.length;

    si (!mejor || puntuación > mejor.puntuación) {
      mejor = { idxs, contrib, puntuación };
    }
  }

  devolver mejor;
}

función asíncrona runAutoGenerator() {
  si (!currentExamId) {
    alert("Primero abre un examen.");
    devolver;
  }

  constante objetivos = getAutoGenTargetsFromUI();
  si (!objetivos.longitud) {
    alert("Define al menos un objetivo (especialidad + subtipo + # preguntas).");
    devolver;
  }

  constante topicQueriesTokens = parseAutoGenTopicQueries(autoGenTopicsInput?.value || "");

  // objetivo total
  const remainingMap = buildRemainingMap(objetivos);
  const totalTarget = totalRestante(MapaRestante);
  si (objetivo total <= 0) {
    alert("El total objetivo debe ser mayor a 0.");
    devolver;
  }

  

  // El generador trabaja por casos clínicos (2–3 preguntas). Con total objetivo < 2 no hay forma de cumplir.
  si (objetivototal < 2) {
    alert("Con un total objetivo menor a 2 no se puede generar, porque cada caso clínico aporta 2–3 preguntas. Sube el cupo o agrega otro subtipo para completar 2+ preguntas.");
    devolver;
  }

  // Si alguna especialidad quedó con 1 pregunta total, también es imposible (cada caso tiene 2+ preguntas de esa especialidad).
  constante porSpecTotals = {};
  objetivos.paraCada((t) => {
    porSpecTotals[t.specialty] = (porSpecTotals[t.specialty] || 0) + Número(t.count || 0);
  });
  const impossibleSpecs = Object.entries(bySpecTotals).filter(([_, n]) => n === 1);
  si (imposibleSpecs.length) {
    etiqueta constante = impossibleSpecs.map(([s]) => getSpecialtyLabel(s) || s).join(", ");
    alert("No se puede generar porque pediste 1 pregunta total en: " + label + ". Cada caso clínico tiene 2–3 preguntas. Ajusta el cupo por esa especialidad (2+).");
    devolver;
  }
// Carga banco suficiente (mejor esfuerzo)
  const hasTopics = Array.isArray(topicQueriesTokens) && topicQueriesTokens.length > 0;
  constante cargaDeseada = tieneTemas ? Math.max(800, objetivoTotal * 12) : Math.max(400, objetivoTotal * 6);
  esperar asegurarBankLoadedForGenerator(Math.min(desiredLoad, 2000));
// Filtrar candidatos
  const allowedSpecs = nuevo Conjunto(objetivos.map((t) => t.specialty));

  constante candidatos = bankCasesCache
    .filter((c) => c && c.id && allowedSpecs.has(c.specialty))
    .filter((c) => bankCaseMatchesAnyTopicQuery(c, topicQueriesTokens))
    .slice(); // copiar

  // Orden: useCount asc (prioridad 0 usos), luego por createAt desc
  candidatos.sort((a, b) => {
    const ua = typeof a.usageCount === "número" ? a.usageCount : 0;
    const ub = typeof b.usageCount === "número" ? b.usageCount : 0;
    if (ua !== ub) return ua - ub;

    constante sa = a.createdAt?.segundos || 0;
    constante sb = b.createdAt?.segundos || 0;
    devolver sb - sa;
  });

  // Generar selección
  constante seleccionada = [];
  constante selectedIds = nuevo Conjunto();

  // Para evitar duplicados con lo ya cargado en el examen actual
  sincronizarCasosDeExamenActualesDesdeDOM ();
  constante yaEnExamen = getCurrentExamBankCaseIdsSet();
  para (const id de yaEnExamen) selectedIds.add(id);

  // Greedy por especialidad: recorre candidatos y agrega si encaja
  para (const c de candidatos) {
    si (totalrestante(maparestante) <= 0) romper;
    si (!c || !c.id) continuar;
    si (selectedIds.has(c.id)) continuar;

    // Si para la especialidad ya no falta nada, saltar
    si (restanteParaEspecialidad(maparestante, c.especialidad) <= 0) continuar;

    constante mejor = pickBestVariantForCase(c, mapaRemanente);
    si (!mejor) continuar;

    const clonado = cloneBankCaseForExam(c, best.idxs);
    si (!clonado) continuar;

    // Aplicar contribución
    aplicarVariante(MapaRestante, c.especialidad, mejor.contribución);

    seleccionado.push(clonado);
    selectedIds.add(c.id);
  }

  const restanteDespués = restanteTotal(maparestante);

  si (!seleccionado.longitud) {
    const specLabel = objetivos
      .map((t) => `${getSpecialtyLabel(t.specialty) || t.specialty} / ${SUBTIPOS[t.subtipo] || t.subtipo}: ${t.count}`)
      .join("| ");
    constante temaTxt = (autoGenTopicsInput?.valor || "").trim();
    alerta(
      "No se encontraron casos que cumplan tus criterios.\n\n" +
        "Objetivos: " + specLabel + (topicTxt ? ("\nTemas: " + topicTxt): "") + "\n\n" +
        "Sugerencias: (1) aumenta el cupo total (cada caso aporta 2–3 preguntas), (2) agrega cupos para más subtipos (los casos suelen mezclar subtipos), (3) usa temas menos restrictivos o déjalos vacíos para probar disponibilidad."
    );
    devolver;
  }

  si (restanteDespués > 0) {
    alerta(
      "No fue posible completar el examen con los cupos solicitados usando los filtros actuales (temas/especialidades/subtipos).\n" +
        "Se generó una parte, pero faltan " + restanteAfter + " preguntas por completar.\n" +
        "Ajusta los cupos o usa temas menos restrictivos."
    );
  }
// Reemplazar casos actuales por los generados (sin borrar el examen hasta que guardes)
  currentExamCases = seleccionado;
  renderizarCasosDeExamen();

  // Resumen final
  si (autoGenSummary) {
    constante totalesgenerados = {};
    seleccionado.paraCada((cc) => {
      constante spec = cc.specialty || "";
      if (!generatedTotals[spec]) generateTotals[spec] = { salud_publica: 0, medicina_familiar: 0, urgencias: 0 };
      (cc.preguntas || []).forEach((q) => {
        const st = q.subtipo || "salud_publica";
        si (generatedTotals[spec][st] === indefinido) generatedTotals[spec][st] = 0;
        totalesgenerados[especificación][st] += 1;
      });
    });

    líneas constantes = Object.entries(generatedTotals).map(([spec, counts]) => {
      constante specLabel = getSpecialtyLabel(especificación);
      const partes = Object.entries(cuenta)
        .filtro(([_, v]) => v > 0)
        .map(([st, v]) => `${SUBTIPOS[st] || st}: ${v}`)
        .unirse(" · ");
      devolver `<div style="margin-top:6px;"><b>${escapeHtml(specLabel || spec)}</b>: ${escapeHtml(partes || "—")}</div>`;
    });

    autoGenSummary.innerHTML = `
      <div style="font-size:12px;color:#9ca3af;">
        Generado: <b style="color:#e5e7eb;">${selected.reduce((acc, c) => acc + (c.questions?.length || 0), 0)}</b> preguntas en
        <b style="color:#e5e7eb;">${selected.length}</b> casos.
        ${restanteDespués > 0 ? `<div style="margin-top:6px;color:#fca5a5;">Pendiente por completar: ${remainingAfter} preguntas.</div>` : ""}
        ${líneas.join("")}
        <div style="margin-top:8px;">
          Nota: el uso (usageCount) se ajusta hasta que guarda el examen.
        </div>
      </div>
    `;
  }
}

función initAutoGeneratorUI() {
  si (!autoGenTargetsWrap || !autoGenBtnAddTarget || !autoGenBtnGenerate) devolver;
  si (autoGenBtnGenerate.dataset.bound === "1") devolver;

  autoGenBtnGenerate.dataset.bound = "1";

  // Estado inicial: una fila por defecto
  si (!autoGenTargetsWrap.querySelector(".auto-gen-row")) {
    const first = buildAutoGenTargetRow({ especialidad: Object.keys(ESPECIALIDADES)[0], subtipo: "urgencias", count: 10 });
    si (primero) autoGenTargetsWrap.appendChild(primero);
  }

  renderAutoGenSummary();

  autoGenBtnAddTarget.addEventListener("clic", () => {
    const row = buildAutoGenTargetRow({ especialidad: Object.keys(ESPECIALIDADES)[0], subtipo: "urgencias", count: 10 });
    si (fila) autoGenTargetsWrap.appendChild(fila);
    renderAutoGenSummary();
  });

  autoGenBtnGenerate.addEventListener("clic", async () => {
    constante btn = autoGenBtnGenerate;
    setLoadingButton(btn, true, "Generar");
    intentar {
      esperar runAutoGenerator();
    } captura (e) {
      console.error("Error generando examen automático:", e);
      alert("Ocurrió un error al generar el examen automático. Revisa consola.");
    } finalmente {
      setLoadingButton(btn, false, "Generar");
    }
  });

  autoGenTopicsInput?.addEventListener("entrada", () => {
    // No recalcula búsqueda todavía, solo refresca resumen
    renderAutoGenSummary();
  });
}

/****************************************************
 * VALIDACIÓN DE SESIÓN Y CARGA INICIAL (ADMIN)
 ****************************************************/
onAuthStateChanged(auth, async (usuario) => {
  si (!usuario) {
    ventana.ubicación.href = "index.html";
    devolver;
  }

  intentar {
    const userRef = doc(db, "usuarios", usuario.email);
    constante userSnap = await getDoc(userRef);

    si (!userSnap.exists()) {
      alert("Tu usuario no existe en la base de datos de Estudiante ENARM.");
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
      devolver;
    }

    constante datos = userSnap.data();

    si (datos.rol !== "admin") {
      alert("Acceso no autorizado. Este usuario no es administrador.");
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
      devolver;
    }

    usuarioAdminactual = {
      uid: usuario.uid,
      correo electrónico: usuario.email,
      ...datos,
    };

    si (adminUserEmailSpan) {
      adminUserEmailSpan.textContent = usuario.correo electrónico;
    }

    // Restaurar estado de navegación (refresh / regreso desde otras páginas)
    constante restaurada = readAdminNavState();
    si (restaurado) {
      adminNavState = {...adminNavState, ...restaurado};
    }

  } atrapar (err) {
    console.error("Error al obtener el perfil de administrador:", err);
    alert("Error al cargar datos de administrador.");
    devolver;
  }

  // Inicializar buscadores
  initBankSearchUI();
  initMiniBankSearchUI();
  initAutoGeneratorUI();

  intentar {
    _isRestoringNav = verdadero;
    esperar loadSections();
    _isRestoringNav = falso;

    // Aplicar panel/vista restaurada (si existe)
    intentar {
      espere applyAdminNavState(adminNavState);
    } atrapar (err) {
      console.error("Error aplicando estado restaurado:", err);
    }

    // Asegura estado base en historial para que 'Atrás' funcione dentro de la aplicación
    reemplazarAdminHistory();

  } atrapar (err) {
    console.error("Error al cargar secciones:", err);
  }

  intentar {
    esperar loadLandingSettings();
  } atrapar (err) {
    console.error("Error al cargar la configuración de aterrizaje:", err);
  }

  console.log("admin.js cargado correctamente y panel inicializado (carga mínima).");
});

/****************************************************
 * NAVEGACIÓN LATERAL
 ****************************************************/

función clearSidebarActive() {
  [
    Exámenes btnNav,
    Banco btnNav,
    btnNavMini,
    Usuarios de btnNav,
    Análisis btnNav,
    btnNavLanding,
    btnNavImportExport,
  ].forEach((b) => b && b.classList.remove("barra lateral-btn--activo"));
}

si (btnNavExams) {
  btnNavExams.addEventListener("clic", () => {
    borrarBarraLateralActiva();
    btnNavExams.classList.add("barra lateral-btn--activa");
    setActivePanel("exámenes");
    sidebar.classList.remove("barra lateral--abrir");
  });
}

si (btnNavBank) {
  btnNavBank.addEventListener("clic", async () => {
    borrarBarraLateralActiva();
    btnNavBank.classList.add("barra lateral-btn--activa");
    setActivePanel("banco");
    sidebar.classList.remove("barra lateral--abrir");

    esperar loadQuestionsBank(verdadero);
  });
}

si (btnNavMini) {
  btnNavMini.addEventListener("clic", async () => {
    borrarBarraLateralActiva();
    btnNavMini.classList.add("barra lateral-btn--activa");
    setActivePanel("mini");
    sidebar.classList.remove("barra lateral--abrir");

    cargarMiniCases();

    restablecerMiniBankSearchUI();
    esperar loadBankCasesIfNeeded();
  });
}

si (btnNavUsers) {
  btnNavUsers.addEventListener("clic", () => {
    borrarBarraLateralActiva();
    btnNavUsers.classList.add("barra lateral-btn--activa");
    setActivePanel("usuarios");
    sidebar.classList.remove("barra lateral--abrir");
    cargarUsuarios();
  });
}

si (btnNavAnalytics) {
  btnNavAnalytics.addEventListener("clic", () => {
    borrarBarraLateralActiva();
    btnNavAnalytics.classList.add("barra lateral-btn--activa");
    setActivePanel("analítica");
    sidebar.classList.remove("barra lateral--abrir");
    cargarAnalyticsSummary();
  });
}

si (btnNavLanding) {
  btnNavLanding.addEventListener("clic", () => {
    borrarBarraLateralActiva();
    btnNavLanding.classList.add("barra lateral-btn--activa");
    setActivePanel("aterrizaje");
    sidebar.classList.remove("barra lateral--abrir");
    cargarConfiguraciónDeAterrizaje();
    cargarSocialLinksIntoLanding();
  });
}



si (btnNavResources) {
  btnNavResources.addEventListener("clic", async () => {
    borrarBarraLateralActiva();
    btnNavResources.classList.add("barra lateral-btn--activa");
    setActivePanel("recursos");
    sidebar.classList.remove("barra lateral--abrir");
    esperar asegurarResourcesAdminLoaded();
    // Al entrar, restaurante lista/detalle según estado
    si (adminNavState.resourcesTopicId) {
      adminResourcesSelectTopic(adminNavState.resourcesTopicId);
    } demás {
      adminRecursosOpenList();
    }
  });
}

si (btnNavImportExport) {
  btnNavImportExport.addEventListener("clic", () => {
    // Redirigir a la pantalla de Importación/Exportación (import-exam.html)
    // Nota: no cambia estado de paneles porque salimos de la página.
    borrarBarraLateralActiva();
    btnNavImportExport.classList.add("barra lateral-btn--activa");
    sidebar.classList.remove("barra lateral--abrir");
    ventana.ubicación.href = "import-examen.html";
  });
}


/****************************************************
 * POPSTATE (Botón Atrás / Gesto móvil)
 ****************************************************/
ventana.addEventListener("popstate", (e) => {
  constante st = e.state?.adminNav;
  si (!st) retorna;
  // Restaurar navegación interna
  aplicarAdminNavState(st);
});

/****************************************************
 * SECCIONES (CRUD + REORDENAR) (SIN CAMBIOS)
 ****************************************************/

función asíncrona loadSections() {
  si (!seccionesList) retorna;

  const qSec = consulta(colección(db, "secciones"), orderBy("orden", "asc"));
  constante snap = esperar getDocs(qSec);
  seccionesList.innerHTML = "";

  si (snap.vacío) {
    renderEmptyMessage(sectionsList, "No hay secciones. Crea la primera.");
    currentSectionId = nulo;
    currentSectionTitle.textContent = "Sin secciones";
    exámenesListEl.innerHTML = "";
    devolver;
  }

  // Preferencia: restaurar la última sección si aplica
  constante preferredSectionId =
    adminNavState?.panel === "exámenes" || adminNavState?.view?.startsWith("examen")
      ? (adminNavState.sectionId || nulo)
      : nulo;

  deje seleccionado = falso;
  deje que firstId = null;
  deje que firstName = null;

  snap.paraCada((docSnap) => {
    constante datos = docSnap.data();
    constante id = docSnap.id;
    nombre constante = (datos?.nombre || "").toString() || "Sección";

    si (!firstId) {
      primerId = id;
      nombre = nombre;
    }

    constante li = document.createElement("li");
    li.className = "elemento de sección__barra lateral";
    li.draggable = verdadero;
    li.dataset.sectionId = id;
    li.dataset.sectionName = nombre;

    li.innerHTML = `
      <div class="sidebar__section-name">${nombre}</div>
      <div class="barra lateral__sección-acciones">
        <button class="icon-btn admin-edit-section" title="Editar sección">✏</button>
        <button class="icon-btn admin-delete-section" title="Eliminar sección">🗑</button>
      </div>
    `;

    li.addEventListener("clic", (e) => {
      si (
        e.target.classList.contains("sección-de-edición-de-administrador") ||
        e.target.classList.contains("sección de eliminación de administrador")
      ) {
        devolver;
      }
      selectSection(id, nombre);
      // Persistir + historial
      si (!_isRestoringNav) {
        adminNavState.sectionId = id;
        adminNavState.examId = nulo;
        adminNavState.view = "lista_de_exámenes";
        persistirAdminNavState();
        pushAdminHistoryIfChanged();
      }
    });

    li
      .querySelector(".sección-de-edición-de-admin")
      .addEventListener("clic", (e) => {
        e.stopPropagation();
        openEditSectionModal(id, nombre);
      });

    li
      .querySelector(".admin-eliminar-sección")
      .addEventListener("clic", async (e) => {
        e.stopPropagation();
        const ok = ventana.confirm(
          "¿Eliminar esta sección y TODOS los solicitudes y casos clínicos asociados?"
        );
        si (!ok) retorna;
        esperar deleteSectionWithAllData(id);
        esperar loadSections();
        si (currentSectionId === id) {
          currentSectionId = nulo;
          currentSectionTitle.textContent = "Sin sección seleccionada";
          exámenesListEl.innerHTML = "";
        }
      });

    li.addEventListener("arrastrar inicio", (e) => {
      e.dataTransfer.effectAllowed = "mover";
      li.classList.add("arrastrando");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("arrastrando");
      guardarSeccionesOrden();
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      const arrastrando = sectionsList.querySelector(".arrastrando");
      si (!arrastrando || arrastrando === li) return;
      constante delimitadora = li.getBoundingClientRect();
      const offset = e.clientY - delimitador.superior;
      si (desplazamiento > altura delimitadora / 2) {
        seccionesList.insertBefore(arrastrando, li.nextSibling);
      } demás {
        seccionesList.insertBefore(arrastrando, li);
      }
    });

    seccionesList.appendChild(li);

    // Restauración: selecciona la sección preferida (si existe)
    si (!seleccionado && IdDeSecciónPreferida && id === IdDeSecciónPreferida) {
      seleccionado = verdadero;
      selectSection(id, nombre);
      li.classList.add("barra lateral__sección-elemento--activo");
    }
  });

  // Fallback: selecciona la primera sección SOLO si estamos en panel de solicitudes
  si (!seleccionado && (adminNavState?.panel === "exámenes")) {
    si (primerId) {
      const firstLi = sectionsList.querySelector(`.sidebar__section-item[data-section-id="${firstId}"]`);
      si (firstLi) firstLi.classList.add("sidebar__section-item--activo");
      selectSection(primerId, primerNombre || "Sección");
      adminNavState.sectionId = primerId;
      adminNavState.view = "lista_de_exámenes";
      adminNavState.examId = nulo;
      persistirAdminNavState();
      si (!_isRestoringNav) {
        reemplazarAdminHistory();
      }
    }
  }
}

función selectSection(id, nombre) {
  currentSectionId = id;
  currentSectionTitle.textContent = nombre || "Sección";

  Lista de secciones
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));
  const activeLi = seccionesList.querySelector(
    `.sidebar__section-item[sección-de-datos-id="${id}"]`
  );
  si (activoLi) {
    activeLi.classList.add("barra lateral__sección-elemento--activo");
  }

  cargarExámenesParaSección(id);

  si (!_isRestoringNav) {
    adminNavState.sectionId = id;
    adminNavState.examId = nulo;
    adminNavState.view = "lista_de_exámenes";
    persistirAdminNavState();
    pushAdminHistoryIfChanged();
  }
}

función asíncrona saveSectionsOrder() {
  si (!seccionesList) retorna;
  const items = Array.from(
    seccionesList.querySelectorAll(".sidebar__section-item")
  );
  const batchUpdates = items.map((li, índice) => {
    constante id = li.dataset.sectionId;
    devolver updateDoc(doc(db, "secciones", id), { orden: índice });
  });
  intentar {
    esperar Promise.all(batchUpdates);
  } atrapar (err) {
    console.error("Error actualizando orden de secciones:", err);
  }
}

función asíncrona deleteSectionWithAllData(sectionId) {
  constante qEx = consulta(
    colección(db, "exámenes"),
    donde("secciónId", "==", secciónId)
  );
  constante exSnap = esperar getDocs(qEx);

  para (const ex de exSnap.docs) {
    constante examId = ex.id;

    constante qCases = consulta(
      colección(db, "preguntas"),
      donde("IdExamen", "==", IdExamen)
    );
    const caseSnap = esperar getDocs(qCases);

    // ✅ ajustar useCount por borrar examen (bankCaseId)
    constante bankIds = caseSnap.docs
      .map((d) => (d.data() || {}).bankCaseId)
      .filtro(Booleano);
    si (bankIds.length) {
      espere applyUsageDelta(bankIds, []); // decrementa todo lo que estaba usado en ese examen
    }

    para (const c de caseSnap.docs) {
      esperar deleteDoc(c.ref);
    }

    esperar deleteDoc(ex.ref);
  }

  esperar deleteDoc(doc(db, "secciones", sectionId));
}

función openEditSectionModal(sectionId, currentName) {
  openModal({
    título: "Editar sección",
    cuerpoHtml: `
      <label class="campo">
        <span>Nombre de la sección</span>
        <input type="text" id="nombre-de-sección-modal" value="${nombre-actual || ""}" />
      </etiqueta>
    `,
    onOk: async() => {
      const input = document.getElementById("nombre-de-sección-modal");
      constante nombre = entrada.valor.trim();
      si (!nombre) {
        alert("Escribe un nombre.");
        devolver;
      }
      constante btn = modalBtnOk;
      setLoadingButton(btn, verdadero);
      intentar {
        esperar updateDoc(doc(db, "secciones", sectionId), { nombre });
        esperar loadSections();
        cerrarModal();
      } atrapar (err) {
        consola.error(err);
        alert("No se pudo actualizar la sección.");
      } finalmente {
        setLoadingButton(btn, false, "Guardar");
      }
    },
  });
}

si (btnAddSection) {
  btnAddSection.addEventListener("clic", () => {
    openModal({
      título: "Nueva sección",
      cuerpoHtml: `
        <label class="campo">
          <span>Nombre de la sección</span>
          <input type="text" id="nombre-de-sección-modal" />
        </etiqueta>
      `,
      onOk: async() => {
        const input = document.getElementById("modal-nueva-sección-nombre");
        constante nombre = entrada.valor.trim();
        si (!nombre) {
          alert("Escribe un nombre.");
          devolver;
        }

        constante btn = modalBtnOk;
        setLoadingButton(btn, verdadero);

        intentar {
          const qSec = await getDocs(colección(db, "secciones"));
          constante orden = qSec.size;

          esperar addDoc(colección(db, "secciones"), {
            nombre,
            orden,
            creadoEn: serverTimestamp(),
          });

          esperar loadSections();
          cerrarModal();
        } atrapar (err) {
          consola.error(err);
          alert("No se pudo crear la sección.");
        } finalmente {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

/**
 * Devuelve el ID de la sección por nombre; si no existe, la crea.
 */
función asíncrona getOrCreateSectionByName(nombre) {
  const trimmed = (nombre || "").trim();
  si (!trimmed) arroja nuevo Error("sectionName vacío en JSON.");

  constante qByName = consulta(
    colección(db, "secciones"),
    donde("nombre", "==", recortado)
  );
  constante snap = esperar getDocs(qByName);
  si (!snap.vacío) {
    devolver snap.docs[0].id;
  }

  const all = await getDocs(colección(db, "secciones"));
  const orden = todos.tamaño;

  const ref = await addDoc(colección(db, "secciones"), {
    nombre: recortado,
    orden,
    creadoEn: serverTimestamp(),
  });

  devolver ref.id;
}

/****************************************************
 * EXÁMENES (LISTA POR SECCIÓN)
 ****************************************************/

función asíncrona loadExamsForSection(sectionId) {
  si (!examsListEl) retorna;
  exámenesListEl.innerHTML = "";

  constante thisLoadToken = ++examsLoadToken;

  constante qEx = consulta(
    colección(db, "exámenes"),
    donde("secciónId", "==", secciónId)
  );
  constante snap = esperar getDocs(qEx);

  si (esteToken de carga !== examenesToken de carga || sectionId !== currentSectionId) {
    devolver;
  }

  si (snap.vacío) {
    renderMensajeVacío(
      exámenesListEl,
      "No hay solicitudes en esta sección. Crea el primero."
    );
    devolver;
  }

  constante sortedDocs = snap.docs
    .rebanada()
    .sort((a, b) => {
      const nombreA = (a.datos().nombre || "").toString();
      const nombreB = (b.datos().nombre || "").toString();
      devolver nombreA.localeCompare(nombreB, "es", {
        numérico: verdadero,
        sensibilidad: "base",
      });
    });

  sortedDocs.paraCada((docSnap) => {
    constante examId = docSnap.id;
    constante datos = docSnap.data();
    nombre constante = nombre.datos || "Examen sin título";

    constante tarjeta = documento.createElement("div");
    card.className = "elemento-de-tarjeta";

    tarjeta.innerHTML = `
      <div class="tarjeta-elemento__título-fila">
        <div class="card-item__title">${nombre}</div>
        <div class="card-item__actions">
          <button class="btn btn-sm btn-secundaria admin-open-exam">Abrir</button>
          <button class="icon-btn admin-edit-exam" title="Editar nombre">✏</button>
          <button class="icon-btn admin-delete-exam" title="Eliminar examen">🗑</button>
        </div>
      </div>
    `;

    tarjeta
      .querySelector(".admin-open-exam")
      .addEventListener("clic", () => openExamDetail(examId, nombre));

    tarjeta
      .querySelector(".admin-edit-exam")
      .addEventListener("clic", () =>
        openEditExamNameModal(examId, nombre)
      );

    tarjeta
      .querySelector(".admin-delete-exam")
      .addEventListener("clic", async () => {
        const ok = ventana.confirm(
          "¿Eliminar este examen y todos sus casos clínicos?"
        );
        si (!ok) retorna;

        // ✅ Antes de borrar, recolectar bankCaseId para bajar useCount
        constante qCases = consulta(
          colección(db, "preguntas"),
          donde("IdExamen", "==", IdExamen)
        );
        constante snapCases = esperar getDocs(qCases);

        const bankIds = snapCases.docs
          .map((d) => (d.data() || {}).bankCaseId)
          .filtro(Booleano);

        si (bankIds.length) {
          espere applyUsageDelta(bankIds, []); // decrementa lo usado por ese examen
        }

        para (const c de snapCases.docs) {
          esperar deleteDoc(c.ref);
        }

        esperar deleteDoc(doc(db, "exámenes", examId));
        cargarExámenesParaSección(secciónId);
      });

    exámenesListEl.appendChild(tarjeta);
  });
}

si (btnAddExam) {
  btnAddExam.addEventListener("clic", () => {
    si (!currentSectionId) {
      alert("Selecciona primero una sección.");
      devolver;
    }
    openModal({
      título: "Nuevo examen",
      cuerpoHtml: `
        <label class="campo">
          <span>Nombre del examen</span>
          <input type="text" id="modal-nuevo-nombre-del-examen" />
        </etiqueta>
      `,
      onOk: async() => {
        const input = document.getElementById("modal-nuevo-nombre-del-examen");
        constante nombre = entrada.valor.trim();
        si (!nombre) {
          alert("Escribe un nombre.");
          devolver;
        }

        constante btn = modalBtnOk;
        setLoadingButton(btn, verdadero);

        intentar {
          const docRef = await addDoc(colección(db, "exámenes"), {
            nombre,
            sectionId: currentSectionId,
            creadoEn: serverTimestamp(),
          });
          esperar cargarExámenesParaSección(currentSectionId);
          cerrarModal();
          openExamDetail(docRef.id, nombre);
        } atrapar (err) {
          consola.error(err);
          alert("No se pudo crear el examen.");
        } finalmente {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

función openEditExamNameModal(examId, currentName) {
  openModal({
    título: "Editar nombre del examen",
    cuerpoHtml: `
      <label class="campo">
        <span>Nombre del examen</span>
        <input type="text" id="modal-edit-exam-name" value="${currentName || ""}" />
      </etiqueta>
    `,
    onOk: async() => {
      const input = document.getElementById("modal-edit-examen-nombre");
      constante nombre = entrada.valor.trim();
      si (!nombre) {
        alert("Escribe un nombre.");
        devolver;
      }
      constante btn = modalBtnOk;
      setLoadingButton(btn, verdadero);
      intentar {
        esperar updateDoc(doc(db, "exámenes", examId), {
          nombre,
          actualizadoEn: serverTimestamp(),
        });
        esperar cargarExámenesParaSección(currentSectionId);
        si (currentExamId === examId && examTitleInput) {
          examTitleInput.value = nombre;
        }
        cerrarModal();
      } atrapar (err) {
        consola.error(err);
        alert("No se pudo actualizar el examen.");
      } finalmente {
        setLoadingButton(btn, false, "Guardar");
      }
    },
  });
}

/**
 * Importar varios solicitudes desde un JSON
 */
función asíncrona importExamsFromJson(json) {
  deje que examsArray = [];

  si (Array.isArray(json)) {
    examsArray = json;
  } de lo contrario si (json && Array.isArray(json.exams)) {
    examsArray = json.exams;
  }

  si (!examsArray.length) {
    alert("El JSON no contiene ningún examen (se esperaba un arreglo).");
    devolver;
  }

  const ok = ventana.confirm(
    `Se crearán ${examsArray.length} solicitudes nuevas a partir del JSON. ` +
    `Cada examen incluye sus casos clínicos y preguntas.\n\n¿Continuar?`
  );
  si (!ok) retorna;

  para (const examSpec de examsArray) {
    const sectionName = examSpec.sectionName || examSpec.section || null;
    const nombreexamen = especificaciónexamen.nombreexamen || examenSpec.name || "Examen sin título";

    si (!nombreSección) {
      console.warn("Examen sin nombre de sección, se omite:", especificación de examen);
      continuar;
    }

    const sectionId = await getOrCreateSectionByName(nombreDeSección);

    const examRef = await addDoc(colección(db, "exámenes"), {
      nombre: examName,
      secciónId,
      creadoEn: serverTimestamp(),
    });
    constante examId = examRef.id;

    const casesArr = Array.isArray(examSpec.cases) ? examSpec.cases : [];

    para (const caseSpec de casesArr) {
      const caseText = caseSpec.caseText || casoSpec.caso || "";
      const especialidad = caseSpec.specialty || "";
      constante tema = (caseSpec.tema || "").toString().trim();

      constante preguntasSrc = Array.isArray(caseSpec.preguntas)
        ? caseSpec.preguntas
        : [];

      const preguntasFormatted = preguntasSrc
        .map((q) => ({
          preguntaTexto: q.preguntaTexto || q.pregunta || "",
          opciónA: q.opciónA || qa || "",
          opciónB: q.opcionB || qb || "",
          opciónC: q.opcionC || qc || "",
          opciónD: q.opcionD || qd || "",
          opciónCorrecta: q.opciónCorrecta || q.correcto || q.respuesta || "",
          subtipo: q.subtipo || "salud_publica",
          dificultad: q.dificultad || "medios",
          justificación: q.justificación || q.explicación || "",
        }))
        .filtrar(
          (q) =>
            q.preguntaTexto &&
            q.opcionA &&
            q.opcionB &&
            q.opcionC &&
            q.opcionD &&
            q.opcióncorrecta &&
            q.justificación
        );

      si (!textoCaso || !preguntasFormato.longitud) {
        console.warn("Caso omitido por falta de datos:", caseSpec);
        continuar;
      }

      esperar addDoc(colección(db, "preguntas"), {
        ID de examen,
        bankCaseId: null, // ✅ importado no viene del banco
        casoTexto,
        especialidad,
        tema,
        preguntas: preguntasFormateadas,
        creadoEn: serverTimestamp(),
      });
    }
  }

  alert("Importación de solicitudes desde JSON completada.");

  esperar loadSections();
  si (currentSectionId) {
    esperar cargarExámenesParaSección(currentSectionId);
  }
}

si (btnImportExamsJson) {
  btnImportExamsJson.addEventListener("clic", () => {
    openJsonFilePicker(async (json) => {
      intentar {
        esperar importExamsFromJson(json);
      } atrapar (err) {
        console.error("Error al importar solicitudes desde JSON:", err);
        alert("Hubo un error al importar los exámenes. Revisa la consola.");
      }
    });
  });
}

/****************************************************
 * DETALLE DE EXAMEN (CASOS CLÍNICOS + PREGUNTAS)
 ****************************************************/

función createEmptyQuestion() {
  devolver {
    preguntaTexto: "",
    opciónA: "",
    opciónB: "",
    opciónC: "",
    opciónD: "",
    opcióncorrecta: "",
    justificación: "",
    subtipo: "salud_publica",
    dificultad: "medios",
  };
}

función createEmptyCase() {
  devolver {
    bankCaseId: nulo,
    casoTexto: "",
    especialidad: "",
    tema: "",
    preguntas: [createEmptyQuestion()],
  };
}

/**
 * Sincroniza currentExamCases con TODO lo escrito en el DOM actual.
 */
función syncCurrentExamCasesFromDOM() {
  si (!examCasesContainer) retorna;

  const caseBlocks = examCasesContainer.querySelectorAll(".examen-caso-bloque");
  constante nuevosCasos = [];

  caseBlocks.forEach((bloque) => {
    constante caseText =
      bloque.querySelector(".admin-case-text")?.value.trim() || "";
    const especialidad =
      bloque.querySelector(".admin-case-specialty")?.valor || "";
    tema constante =
      bloque.querySelector(".tema-del-caso-de-administración")?.value.trim() || "";

    const bankCaseId = (bloque.dataset.bankCaseId || "").trim() || null;

    const qBlocks = block.querySelectorAll(".bloque-de-preguntas-de-examen");
    const preguntas = [];

    qBlocks.paraCada((qb) => {
      constante preguntaTexto =
        qb.querySelector(".admin-q-pregunta")?.value.trim() || "";
      constante opciónA = qb.querySelector(".admin-qa")?.value.trim() || "";
      constante opciónB = qb.querySelector(".admin-qb")?.value.trim() || "";
      constante opciónC = qb.querySelector(".admin-qc")?.valor.trim() || "";
      constante opciónD = qb.querySelector(".admin-qd")?.valor.trim() || "";
      constante opcióncorrecta =
        qb.querySelector(".admin-q-correct")?.valor || "";
      subtipo constante =
        qb.querySelector(".admin-q-subtype")?.valor || "salud_publica";
      dificultad constante =
        qb.querySelector(".admin-q-difficulty")?.value || "medios";
      justificación constante =
        qb.querySelector(".admin-q-justification")?.value.trim() || "";

      constante todoVacío =
        !preguntaTexto &&
        !opcionA &&
        !opcionB &&
        !opcionC &&
        !opcionD &&
        !justificación;

      si (allEmpty) retorna;

      preguntas.push({
        preguntaTexto,
        opciónA,
        opciónB,
        opciónC,
        opciónD,
        Opción correcta,
        subtipo,
        dificultad,
        justificación,
      });
    });

    si (!caseText && !preguntas.longitud) devolver;

    nuevosCasos.push({
      ID de caso bancario,
      casoTexto,
      especialidad,
      tema,
      preguntas: preguntas.longitud ? preguntas : [createEmptyQuestion()],
    });
  });

  casosdeexamenactuales =
    newCases.length > 0 ? newCases : [createEmptyCase()];
}

función asíncrona openExamDetail(examId, examName) {
  si (!_isRestoringNav) {
    adminNavState.panel = "exámenes";
    adminNavState.view = "detalle_del_examen";
    adminNavState.examId = idExamen;
    adminNavState.sectionId = currentSectionId || adminNavState.sectionId;
    persistirAdminNavState();
    pushAdminHistoryIfChanged();
  }
  currentExamId = IdExamen;
  casosDeExamenActuales = [];

  mostrar(panelExámenes);
  mostrar(examDetailView);

  restablecerBankSearchUI();

  si (examTitleInput) {
    examTitleInput.value = nombreExamen || "";
  }
  si (ContenedorCasosExamen) {
    examCasesContainer.innerHTML = "";
  }

  constante qCases = consulta(
    colección(db, "preguntas"),
    donde("IdExamen", "==", IdExamen)
  );
  constante snap = esperar getDocs(qCases);

  si (snap.vacío) {
    currentExamCases = [createEmptyCase()];
  } demás {
    CasosDeExámenesActuales = snap.docs.map((d) => {
      constante datos = d.datos() || {};
      devolver {
        identificación: d.id,
        ...datos,
        tema: (datos?.tema || "").toString(),
        bankCaseId: datos.bankCaseId || nulo,
      };
    });
  }

  renderizarCasosDeExamen();

  esperar loadBankCasesIfNeeded();
}
/****************************************************
 *CONTINÚA ADMIN.JS - PARTE 2/2
 ****************************************************/

función renderExamCases() {
  si (!examCasesContainer) retorna;
  examCasesContainer.innerHTML = "";

  si (!currentExamCases.length) {
    currentExamCases.push(createEmptyCase());
  }

  currentExamCases.forEach((caseData, índice) => {
    constante wrapper = document.createElement("div");
    wrapper.className = "tarjeta examen-caso-bloque";
    wrapper.dataset.caseIndex = índice;

    // ✅ Persistencia en DOM para sincronizar + guardado
    wrapper.dataset.bankCaseId = caseData.bankCaseId || "";

    const specialityValue = caseData.specialty || "";
    constante valorDeTema = (caseData.tema || "").toString();
    constante preguntasArr = Array.isArray(caseData.preguntas)
      ? caseData.preguntas
      : [];

    wrapper.innerHTML = `
      <div clase="flex-row" estilo="justificar-contenido:espacio-entre;alinear-elementos:centro;margen-inferior:10px;">
        <h3 style="font-size:15px;font-weight:600;">
          Caso clínico ${index + 1}
        </h3>
        <button type="button" class="btn btn-sm btn-outline admin-delete-case">
          Eliminar caso clínico
        </botón>
      </div>

      <label class="campo">
        <span>Especialidad</span>
        <select class="especialidad-de-casos-de-administración">
          <option value="">Selecciona...</option>
          ${Object.entries(ESPECIALIDADES)
            .mapa(
              ([clave, etiqueta]) =>
                `<opción valor="${clave}" ${
                  clave === valorEspecialidad ? "seleccionado" : ""
                }>${etiqueta}</opción>`
            )
            .unirse("")}
        </seleccionar>
      </etiqueta>

      <label class="campo">
        <span>Tema (tópico)</span>
        <input type="text" class="admin-case-topic" value="${topicValue.replace(/"/g, """)}" placeholder="Escribe el tema..." />
      </etiqueta>

      <label class="campo">
        <span>Texto del caso clínico</span>
        <textarea class="admin-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </etiqueta>

      <div class="preguntas-de-caso-de-administración-de-lista-de-tarjetas"></div>

      <div clase="flex-row" estilo="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-add-question">
          + Agregar pregunta
        </botón>
      </div>
    `;

    const qContainer = wrapper.querySelector(".preguntas-de-caso-de-administración");

    si (!preguntasArr.longitud) {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    } demás {
      preguntasArr.forEach((qData) => {
        qContainer.appendChild(renderQuestionBlock(qData));
      });
    }

    envoltura
      .querySelector(".admin-add-question")
      .addEventListener("clic", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

    envoltura
      .querySelector(".admin-eliminar-caso")
      .addEventListener("clic", () => {
        constante idx = parseInt(wrapper.dataset.caseIndex, 10);
        si (Number.isNaN(idx)) retorna;
        sincronizarCasosDeExámenesActualesDesdeDOM();
        currentExamCases.splice(idx, 1);
        renderizarCasosDeExamen();
      });

    examCasesContainer.appendChild(envoltorio);
  });

  constante bottomActions = document.createElement("div");
  bottomActions.className = "flex-row";
  bottomActions.style.justifyContent = "extremo flexible";
  bottomActions.style.marginTop = "16px";

  bottomActions.innerHTML = `
    <button type="button" class="btn btn-secondary" id="admin-btn-add-case-bottom">
      + Agregar caso clínico
    </botón>
    <button type="button" class="btn btn-primary" id="admin-btn-save-exam-bottom">
      Guardar examen
    </botón>
  `;

  examCasesContainer.appendChild(accionesinferiores);

  constante btnAddCaseBottom = document.getElementById("admin-btn-add-case-bottom");
  const btnSaveExamBottom = document.getElementById("admin-btn-save-exam-bottom");

  si (btnAddCaseBottom) {
    btnAddCaseBottom.addEventListener("clic", () => {
      si (!currentExamId) {
        alert("Primero abre un examen.");
        devolver;
      }
      sincronizarCasosDeExámenesActualesDesdeDOM();
      currentExamCases.push(createEmptyCase());
      renderizarCasosDeExamen();
    });
  }

  si (btnGuardarExamenInferior && btnGuardarExamenTodo) {
    btnSaveExamBottom.addEventListener("clic", () => {
      btnGuardarExamenTodo.click();
    });
  }
}

función renderQuestionBlock(qData) {
  constante {
    preguntaTexto = "",
    opciónA = "",
    opciónB = "",
    opciónC = "",
    opciónD = "",
    opcióncorrecta = "",
    justificación = "",
    subtipo = "salud_publica",
    dificultad = "medios",
  } = qDatos;

  constante tarjeta = documento.createElement("div");
  card.className = "tarjeta-elemento-examen-pregunta-bloque";

  tarjeta.innerHTML = `
    <label class="campo">
      <span>Pregunta</span>
      <textarea class="admin-q-question" rows="2">${questionText}</textarea>
    </etiqueta>

    <label class="campo">
      Opción A
      <input type="text" class="admin-qa" value="${optionA}" />
    </etiqueta>

    <label class="campo">
      Opción B
      <input type="text" class="admin-qb" value="${optionB}" />
    </etiqueta>

    <label class="campo">
      Opción C
      <input type="text" class="admin-qc" value="${optionC}" />
    </etiqueta>

    <label class="campo">
      Opción D
      <input tipo="texto" clase="admin-qd" valor="${opciónD}" />
    </etiqueta>

    <label class="campo">
      <span>Respuesta correcta</span>
      <seleccionar clase="admin-q-correct">
        <option value="">Selección</option>
        <option value="A" ${correctOption === "A" ? "selected" : ""}>A</option>
        <opción valor="B" ${OpciónCorrecta === "B" ? "seleccionado" : ""}>B</opción>
        <opción valor="C" ${OpciónCorrecta === "C" ? "seleccionado" : ""}>C</opción>
        <opción valor="D" ${opcióncorrecta === "D" ? "seleccionado" : ""}>D</opción>
      </seleccionar>
    </etiqueta>

    <label class="campo">
      <span>Tipo de pregunta</span>
      <seleccionar clase="admin-q-subtype">
        ${Objeto.entradas(SUBTIPOS)
          .mapa(
            ([clave, etiqueta]) =>
              `<opción valor="${clave}" ${
                clave === subtipo ? "seleccionado" : ""
              }>${etiqueta}</opción>`
          )
          .unirse("")}
      </seleccionar>
    </etiqueta>

    <label class="campo">
      Dificultad
      <select class="admin-q-difficulty">
        ${Objeto.entradas(DIFICULTADES)
          .mapa(
            ([clave, etiqueta]) =>
              `<opción valor="${clave}" ${
                clave === dificultad ? "seleccionado" : ""
              }>${etiqueta}</opción>`
          )
          .unirse("")}
      </seleccionar>
    </etiqueta>

    <label class="campo">
      <span>Justificación</span>
      <textarea class="admin-q-justification" rows="2">${justificación}</textarea>
    </etiqueta>

    <div style="text-align:right;margin-top:6px;">
      <button type="button" class="btn btn-sm btn-outline admin-delete-question">
        Eliminar pregunta
      </botón>
    </div>
  `;

  tarjeta
    .querySelector(".admin-eliminar-pregunta")
    .addEventListener("clic", () => {
      tarjeta.eliminar();
    });

  tarjeta de devolución;
}

// Botón "Volver a solicitudes"
si (btnVolverAExámenes) {
  btnBackToExams.addEventListener("clic", () => {
    const st = historial.estado?.adminNav;
    si (st && st.view === "detalle_del_examen") {
      // Mantiene coherencia con el botón físico/gesto "Atrás"
      historia.atrás();
      devolver;
    }

    // Fallback (por si no hay estado en la historia)
    currentExamId = nulo;
    casosDeExamenActuales = [];
    if (examCasesContainer) examCasesContainer.innerHTML = "";
    ocultar(examDetailView);
    mostrar(panelExámenes);

    restablecerBankSearchUI();

    si (currentSectionId) {
      cargarExámenesParaSección(currentSectionId);
    }

    si (!_isRestoringNav) {
      adminNavState.panel = "exámenes";
      adminNavState.view = "lista_de_exámenes";
      adminNavState.examId = nulo;
      adminNavState.sectionId = currentSectionId || adminNavState.sectionId;
      persistirAdminNavState();
      reemplazarAdminHistory();
    }
  });
}

// Guardar examen (✅ con delta de useCount y persistencia bankCaseId)
si (btnGuardarExamenTodo) {
  btnSaveExamAll.addEventListener("clic", async () => {
    si (!currentExamId) {
      alert("No hay examen seleccionado.");
      devolver;
    }

    constante nuevoNombre = examTitleInput.value.trim();
    si (!nuevoNombre) {
      alert("Escribe un nombre para el examen.");
      devolver;
    }

    const caseBlocks = examCasesContainer.querySelectorAll(".examen-caso-bloque");
    si (!caseBlocks.length) {
      alert("Debes agregar al menos un caso clínico.");
      devolver;
    }

    // ✅ Anteriores (para delta)
    deje prevBankIds = [];
    intentar {
      constante qPrev = consulta(
        colección(db, "preguntas"),
        donde("IdExamen", "==", IdExamenActual)
      );
      constante prevSnap = esperar getDocs(qPrev);
      prevBankIds = prevSnap.docs
        .map((d) => (d.data() || {}).bankCaseId)
        .filtro(Booleano);
    } captura (e) {
      console.warn("No se pudieron cargar anteriores para delta useCount:", e);
    }

    constante casosParaGuardar = [];

    para (bloque constante de caseBlocks) {
      constante caseText = bloque.querySelector(".admin-case-text").value.trim();
      const especialidad = bloque.querySelector(".admin-case-specialty").valor;
      constante tema = bloque.querySelector(".admin-case-topic")?.value.trim() || "";
      const bankCaseId = (bloque.dataset.bankCaseId || "").trim() || null;

      si (!caseText) {
        alert("Escribe el texto del caso clínico.");
        devolver;
      }

      const qBlocks = block.querySelectorAll(".bloque-de-preguntas-de-examen");
      si (!qBlocks.length) {
        alert("Cada caso clínico debe tener al menos una pregunta.");
        devolver;
      }

      const preguntas = [];

      para (const qb de qBlocks) {
        constante preguntaTexto = qb.querySelector(".admin-q-pregunta").valor.trim();
        constante opciónA = qb.querySelector(".admin-qa").valor.trim();
        constante opciónB = qb.querySelector(".admin-qb").valor.trim();
        constante opciónC = qb.querySelector(".admin-qc").valor.trim();
        constante opciónD = qb.querySelector(".admin-qd").valor.trim();
        constante correctOption = qb.querySelector(".admin-q-correct").valor;
        constante subtipo = qb.querySelector(".admin-q-subtype").valor;
        constante dificultad = qb.querySelector(".admin-q-difficulty").valor;
        justificación constante = qb
          .querySelector(".admin-q-justification")
          .valor.trim();

        si (
          !TextoDePregunta ||
          !opcionA ||
          !opcionB ||
          !opcionC ||
          !opcionD ||
          !OpciónCorrecta ||
          !justificación
        ) {
          alert("Completa todos los campos de cada pregunta.");
          devolver;
        }

        preguntas.push({
          preguntaTexto,
          opciónA,
          opciónB,
          opciónC,
          opciónD,
          Opción correcta,
          subtipo,
          dificultad,
          justificación,
        });
      }

      casosParaGuardar.push({
        ID de caso bancario,
        casoTexto,
        especialidad,
        tema,
        preguntas,
      });
    }

    constante newBankIds = casosParaGuardar.map((c) => c.bankCaseId).filter(Boolean);

    constante btn = btnGuardarExamenTodo;
    setLoadingButton(btn, true, "Guardar examen");

    intentar {
      esperar updateDoc(doc(db, "exámenes", currentExamId), {
        nombre: nuevoNombre,
        actualizadoEn: serverTimestamp(),
      });

      // borrar anteriores
      constante qPrev = consulta(
        colección(db, "preguntas"),
        donde("IdExamen", "==", IdExamenActual)
      );
      constante prevSnap = esperar getDocs(qPrev);
      para (const c de prevSnap.docs) {
        esperar deleteDoc(c.ref);
      }

      // guardar nuevos
      para (const c de casosParaGuardar) {
        esperar addDoc(colección(db, "preguntas"), {
          examId: currentExamId,
          bankCaseId: c.bankCaseId || nulo, // ✅ persistente
          casoTexto: c.casoTexto,
          especialidad: c.especialidad,
          tema: c.topic || "",
          preguntas: c.preguntas,
          creadoEn: serverTimestamp(),
        });
      }

      // ✅ Ajuste real de useCount
      esperar applyUsageDelta(prevBankIds, newBankIds);

      alert("Examen guardado correctamente.");
      si (currentSectionId) {
        esperar cargarExámenesParaSección(currentSectionId);
      }

      // refrescar buscador (para que se deshabiliten bien y refresque usado)
      restablecerBankSearchUI();
      esperar loadBankCasesIfNeeded();
    } atrapar (err) {
      consola.error(err);
      alert("Hubo un error al guardar el examen.");
    } finalmente {
      setLoadingButton(btn, false, "Guardar examen");
    }
  });
}

// Botón "Agregar caso clínico" superior
si (btnAddCaseTop) {
  btnAddCaseTop.addEventListener("clic", () => {
    si (!currentExamId) {
      alert("Primero abre un examen.");
      devolver;
    }
    sincronizarCasosDeExámenesActualesDesdeDOM();
    currentExamCases.push(createEmptyCase());
    renderizarCasosDeExamen();
  });
}

/**
 * Importar un solo examen (JSON) directamente al formulario del examen abierto.
 */
función normalizarPreguntaDesdeJson(raw) {
  devolver {
    preguntaTexto: raw.preguntaTexto || raw.pregunta || "",
    opciónA: raw.opciónA || crudo.a || "",
    opciónB: raw.opcionB || raw.b || "",
    opciónC: raw.opcionC || raw.c || "",
    opciónD: raw.opcionD || raw.d || "",
    opciónCorrecta: raw.opciónCorrecta || raw.correcto || raw.respuesta || "",
    subtipo: raw.subtype || "salud_publica",
    dificultad: raw.difficulty || "media",
    justificación: raw.justification || raw.explanation || "",
  };
}

función cargarExamFromJsonIntoUI(json) {
  constante nombreExamen =
    (json && (json.nombreExamen || json.nombre)) ||
    (examTitleInput ? examTitleInput.valor : "");

  si (examTitleInput && examName) {
    examTitleInput.value = nombreExamen;
  }

  deje que casesArr = [];

  si (Array.isArray(json)) {
    casosArr = json;
  } de lo contrario si (Array.isArray(json.cases)) {
    casosArr = json.casos;
  } demás {
    alerta(
      "El JSON debe ser un objeto con propiedad 'cases' o un arreglo de casos clínicos."
    );
    devolver;
  }

  si (!casesArr.length) {
    alert("El JSON no contiene casos clínicos.");
    devolver;
  }

  CasosDeExamenActuales = casosArr.map((c) => {
    const caseText = c.caseText || c.caso || "";
    const especialidad = c.especialidad || "";
    constante tema = (c.tema || "").toString().trim();
    const qsRaw = Array.isArray(c.preguntas) ? c.preguntas : [];
    preguntas constantes =
      qsRaw.longitud > 0
        ? qsRaw.map((q) => normalizarPreguntaDeJson(q))
        : [crearPreguntaVacía()];

    devolver { bankCaseId: null, caseText, especialidad, tema, preguntas };
  });

  renderizarCasosDeExamen();
}

si (btnImportExamJson) {
  btnImportExamJson.addEventListener("clic", () => {
    si (!examDetailView || examDetailView.classList.contains("oculto")) {
      alert("Abre primero un examen para poder importar.");
      devolver;
    }

    openJsonFilePicker((json) => {
      intentar {
        cargarExamFromJsonIntoUI(json);
      } atrapar (err) {
        console.error("Error al cargar examen desde JSON:", err);
        alert("No se pudo cargar el examen desde el JSON.");
      }
    });
  });
}

/****************************************************
 * BANCO DE PREGUNTAS (preguntas) – Panel administrador-panel-banco
 * ✅ Preguntas editables tipo examen (no JSON)
 ****************************************************/

const bankFilterCaseText = document.getElementById("búsqueda-bancaria-administrador");
const bankFilterTopic = document.getElementById("tema-del-banco-de-administración");
const bankFilterSpecialty = document.getElementById("admin-bank-specialty");
const bankFilterExamId = document.getElementById("admin-bank-examid");

const btnBankClear = document.getElementById("admin-bank-btn-clear");
const btnBankRefresh = document.getElementById("admin-bank-btn-refresh");
const btnBankApply = document.getElementById("admin-bank-btn-apply");

const bankListEl = document.getElementById("admin-banco-lista");
const btnBankLoadMore = document.getElementById("admin-bank-btn-load-more");

// Estado del banco
deje que bankPageSize = 20;
deje que bankLastDoc = null;
deje que bankIsLoading = falso;
deje que bankHasMore = verdadero;

// Filtros actuales
deje que bankActiveFilters = {
  casoTexto: "",
  tema: "",
  especialidad: "",
  ID del examen: "",
};

función getBankFiltersFromUI() {
  devolver {
    caseText: (bankFilterCaseText?.value || "").trim(),
    tema: (bankFilterTopic?.value || "").trim(),
    especialidad: (bankFilterSpecialty?.value || "").trim(),
    IdExamen: (IDExamenFiltrBanco?.valor || "").recortar(),
  };
}

función bankCaseMatchesFilters(docData, filtros) {
  const caseText = normalizeText(docData.caseText || "");
  constante tema = normalizarTexto((docData.tema || "").toString());
  constante especialidad = normalizarTexto((docData.especialidad || "").toString());
  constante examId = normalizeText((docData.examId || "").toString());

  constante fCase = normalizarTexto(filtros.caseText || "");
  const fTopic = normalizeText(filtros.tema || "");
  const fSpec = normalizeText(filtros.specialty || "");
  constante fExam = normalizarTexto(filtros.examId || "");

  si (fCase && !caseText.includes(fCase)) devuelve falso;
  si (fTopic && !topic.includes(fTopic)) devuelve falso;
  si (fSpec && !specialty.includes(fSpec)) devuelve falso;
  si (fExam && !examId.includes(fExam)) devuelve falso;

  devuelve verdadero;
}

// ayudantes
función escapeHtml(str) {
  devolver (str || "")
    .toString()
    .replace(/&/g, "&")
    .reemplazar(/</g, "<")
    .reemplazar(/>/g, ">")
    .replace(/"/g, """);
}

función renderBankItem(docId, datos) {
  const specLabel = getSpecialtyLabel(datos.specialty || "");
  const topicTxt = (datos.tema || "").toString();
  const qCount = Array.isArray(datos.preguntas) ? datos.preguntas.length : 0;
  const uso = tipo de datos.conteoDeUso === "número" ? datos.conteoDeUso: 0;

  constante wrap = document.createElement("div");
  wrap.className = "elemento-de-tarjeta";
  wrap.dataset.id = docId;
  wrap.dataset.mode = "vista";

  fragmento constante = escapeHtml((datos.caseText || "").slice(0, 240));
  const hasMore = (datos.caseText || "").length > 240;

  wrap.innerHTML = `
    <div clase="artículo-de-tarjeta__título-fila" estilo="alinear-artículos:flex-start;">
      <div style="flex:1;">
        <div clase="título del elemento de tarjeta" estilo="margen inferior:6px;">
          ${escapeHtml(topicTxt || specLabel || "Caso (preguntas)")}
        </div>
        <div style="font-size:12px;color:#9ca3af;">
          <div><strong>ID:</strong> <code>${docId}</code></div>
          <div><strong>ID del examen:</strong> <code>${escapeHtml((data.examId || "—") + "")}</code></div>
          <div><strong>Tema:</strong> ${escapeHtml(topicTxt || "—")}</div>
          <div><strong>Preguntas:</strong> ${qCount}</div>
          <div><strong>Usado:</strong> ${usage}</div>
        </div>
      </div>

      <div class="card-item__actions">
        <button class="btn btn-sm btn-secondary admin-bank-inline-edit">Editar</button>
        Eliminar
      </div>
    </div>

    <div class="admin-bank-view" style="font-size:13px;line-height:1.45;color:#e5e7eb;margin-top:10px;">
      ${snippet}${hasMore ? "…" : ""}
    </div>

    <div class="admin-bank-edit hidden" style="margin-top:12px;">
      <div clase="tarjeta" estilo="relleno:12px;">
        <label class="campo">
          <span>Especialidad</span>
          <select class="admin-bank-edit-specialty">
            <option value="">Selecciona...</option>
            ${Object.entries(ESPECIALIDADES)
              .map(([clave, etiqueta]) => `<opción valor="${clave}" ${clave === (datos.especialidad || "") ? "seleccionado" : ""}>${etiqueta}</opción>`)
              .unirse("")}
          </seleccionar>
        </etiqueta>

        <label class="campo">
          <span>Tema (tópico)</span>
          <input type="text" class="admin-bank-edit-topic" value="${escapeHtml((data.topic || "") + "")}" />
        </etiqueta>

        <label class="campo">
          <span>Texto del caso clínico</span>
          <textarea class="admin-bank-edit-caseText" rows="5">${escapeHtml(data.caseText || "")}</textarea>
        </etiqueta>

        <div class="card" style="padding:12px;margin-top:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-weight:600;font-size:13px;">Preguntas</div>
            <button type="button" class="btn btn-sm btn-primary admin-bank-add-question">+ Agregar pregunta</button>
          </div>
          <div class="tarjetas-lista-administrador-banco-preguntas" style="margin-top:10px;"></div>
        </div>

        <div clase="flex-row" estilo="justificar-contenido:flex-end;espacio:8px;margen-superior:10px;">
          Cancelar
          <button class="btn btn-sm btn-primary admin-bank-inline-save">Guardar</button>
        </div>
      </div>
    </div>
  `;

  const btnEdit = wrap.querySelector(".admin-bank-inline-edit");
  constante btnDelete = wrap.querySelector(".admin-bank-inline-delete");
  constante btnCancel = wrap.querySelector(".admin-bank-inline-cancel");
  constante btnSave = wrap.querySelector(".admin-bank-inline-save");
  constante viewEl = wrap.querySelector(".admin-bank-view");
  constante editEl = wrap.querySelector(".admin-bank-edit");

  // ✅ cargar preguntas en modo editor (UI tipo examen)
  const bankQContainer = wrap.querySelector(".admin-bank-preguntas");
  const initialQs = Array.isArray(datos.preguntas) && datos.preguntas.length ? datos.preguntas : [createEmptyQuestion()];
  initialQs.forEach((q) => bankQContainer.appendChild(renderQuestionBlock(q)));

  wrap.querySelector(".admin-bank-add-question").addEventListener("clic", () => {
    bankQContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
  });

  btnEdit.addEventListener("clic", () => {
    wrap.dataset.mode = "editar";
    viewEl.classList.add("oculto");
    editEl.classList.remove("oculto");
    btnEdit.disabled = verdadero;
  });

  btnCancel.addEventListener("clic", () => {
    wrap.dataset.mode = "vista";
    viewEl.classList.remove("oculto");
    editEl.classList.add("oculto");
    btnEdit.disabled = falso;
  });

  btnDelete.addEventListener("clic", async () => {
    const ok = window.confirm("¿Eliminar este caso del banco (preguntas)?");
    si (!ok) retorna;

    intentar {
      esperar deleteDoc(doc(db, "preguntas", docId));
      envolver.eliminar();

      bankCasesLoadedOnce = falso;
      bankCasesCache = [];
    } atrapar (err) {
      consola.error(err);
      alert("No se pudo eliminar el caso.");
    }
  });

  btnSave.addEventListener("clic", async () => {
    const especialidad = wrap.querySelector(".admin-bank-edit-specialty").valor || "";
    constante tema = wrap.querySelector(".admin-bank-edit-topic").value.trim();
    constante caseText = wrap.querySelector(".admin-bank-edit-caseText").value.trim();

    si (!caseText) {
      alert("El texto del caso clínico no puede ir vacío.");
      devolver;
    }

    // ✅ recolectar preguntas desde UI
    const qBlocks = wrap.querySelectorAll(".admin-bank-questions .exam-question-block");
    const preguntasParsed = [];

    para (const qb de qBlocks) {
      constante preguntaTexto = qb.querySelector(".admin-q-pregunta").valor.trim();
      constante opciónA = qb.querySelector(".admin-qa").valor.trim();
      constante opciónB = qb.querySelector(".admin-qb").valor.trim();
      constante opciónC = qb.querySelector(".admin-qc").valor.trim();
      constante opciónD = qb.querySelector(".admin-qd").valor.trim();
      constante correctOption = qb.querySelector(".admin-q-correct").valor;
      constante subtipo = qb.querySelector(".admin-q-subtype").valor;
      constante dificultad = qb.querySelector(".admin-q-difficulty").valor;
      const justificación = qb.querySelector(".admin-q-justification").value.trim();

      si (!TextoDePregunta || !opciónA || !opciónB || !opciónC || !opciónD || !opciónCorrecta || !justificación) {
        alert("Completa todos los campos de todas las preguntas.");
        devolver;
      }

      preguntasParsed.push({
        preguntaTexto,
        opciónA,
        opciónB,
        opciónC,
        opciónD,
        Opción correcta,
        subtipo,
        dificultad,
        justificación,
      });
    }

    si (!preguntasParsed.length) {
      alert("Debe existir al menos una pregunta.");
      devolver;
    }

    setLoadingButton(btnSave, true, "Guardar");

    intentar {
      esperar updateDoc(doc(db, "preguntas", docId), {
        especialidad,
        tema,
        casoTexto,
        preguntas: preguntasAnalizadas,
        actualizadoEn: serverTimestamp(),
      });

      bankCasesLoadedOnce = falso;
      bankCasesCache = [];

      esperar loadQuestionsBank(verdadero);
    } atrapar (err) {
      consola.error(err);
      alert("No se pudo guardar la edición del caso.");
    } finalmente {
      setLoadingButton(btnSave, false, "Guardar");
    }
  });

  envoltura de devolución;
}

función asíncrona loadQuestionsBank(reset = false) {
  si (!bankListEl) retorna;
  si (bankIsLoading) retorna;

  bankIsLoading = verdadero;

  si (reiniciar) {
    bankListEl.innerHTML = "";
    bancoLastDoc = nulo; //cursor de escaneo (preguntas)
    bancoTieneMás = verdadero;
    si (btnBankLoadMore) btnBankLoadMore.disabled = verdadero;
  }

  si (!bankListEl.children.length) {
    bankListEl.innerHTML = `
      <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
        Cargando banco de preguntas (preguntas)…
      </div>
    `;
  }

  intentar {
    constante filtros = bankActiveFilters || obtenerBankFiltersFromUI();

    // Estrategia: escanear por lotes y renderear SOLO coincidencias,
    // hasta llenar una "página" (bankPageSize) o llegar al final.
    constante scanBatch = 250;
    deje que se represente = 0;
    deje que safetyLoops = 0;

    // si venimos de resetear, limpiar marcador de posición
    if (restablecer) bankListEl.innerHTML = "";

    mientras (bankHasMore && renderizado < bankPageSize) {
      bucles de seguridad++;
      si (buclesdeseguridad > 80) {
        // evita bucles infinitos en caso de filtros muy restrictivos + colección enorme
        romper;
      }

      deje qBase;
      intentar {
        qBase = consulta(
          colección(db, "preguntas"),
          ordenarPor("creadoEn", "desc"),
          ...(bankLastDoc? [startAfter(bankLastDoc)] : []),
          límite(scanBatch)
        );
      } captura (e) {
        qBase = consulta(
          colección(db, "preguntas"),
          ...(bankLastDoc? [startAfter(bankLastDoc)] : []),
          límite(scanBatch)
        );
      }

      constante snap = esperar getDocs(qBase);

      si (!snap || !snap.docs || !snap.docs.length) {
        bancoTieneMás = falso;
        romper;
      }

      bancoLastDoc = snap.docs[snap.docs.length - 1];

      // Si el lote vino incompleto, probablemente ya es el final
      si (snap.size < scanBatch) {
        // Ojo: aún puede haber más, pero Firestore normalmente devuelve < limit al final
        // Lo marcamos como que no hay más para evitar escaneos infinitos.
        bancoTieneMás = falso;
      } demás {
        bancoTieneMás = verdadero;
      }

      para (const d de snap.docs) {
        constante datos = d.datos() || {};
        si (!bankCaseMatchesFilters(datos, filtros)) continuar;

        bankListEl.appendChild(renderBankItem(d.id, datos));
        renderizado++;

        si (renderizado >= bankPageSize) romper;
      }
    }

    si (!bankListEl.children.length) {
      renderEmptyMessage(bankListEl, "No hay resultados con esos filtros. Pruebe otros términos.");
    }

    si (btnBankLoadMore) {
      btnBankLoadMore.disabled = !bankHasMore;
    }
  } atrapar (err) {
    consola.error(err);
    renderEmptyMessage(bankListEl, "Error al cargar el banco. Revisa la consola.");
    si (btnBankLoadMore) btnBankLoadMore.disabled = verdadero;
  } finalmente {
    bankIsLoading = falso;
  }
}

si (btnBankApply) {
  btnBankApply.addEventListener("clic", () => {
    FiltrosActivosBanco = obtenerFiltrosBancoDesdeUI();
    cargarPreguntasBanco(verdadero);
  });
}

si (btnBankRefresh) {
  btnBankRefresh.addEventListener("clic", () => {
    cargarPreguntasBanco(verdadero);
  });
}

si (btnBankClear) {
  btnBankClear.addEventListener("clic", () => {
    si (bankFilterCaseText) bankFilterCaseText.valor = "";
    si (tema de filtro del banco) tema de filtro del banco.valor = "";
    if (bankFilterSpecialty) bankFilterSpecialty.value = "";
    si (bankFilterExamId) bankFilterExamId.value = "";
    bankActiveFilters = { caseText: "", tema: "", especialidad: "", examId: "" };
    cargarPreguntasBanco(verdadero);
  });
}

si (btnBankLoadMore) {
  btnBankLoadMore.addEventListener("clic", () => {
    si (!bankHasMore) retorna;
    cargarPreguntasBanco(falso);
  });
}

/****************************************************
 * MINI EXÁMENES – BANCO GLOBAL DE CASOS (miniPreguntas)
 * ✅ guarda bankCaseId y ajusta useCount por delta al guardar
 ****************************************************/

const miniCasesContainer = document.getElementById("admin-mini-cases");
constante btnMiniAddCase = document.getElementById("admin-mini-btn-add-case");
constante btnMiniSaveAll = document.getElementById("admin-mini-btn-save-all");

función syncMiniCasesFromDOM() {
  si (!miniCasesContainer) retorna;

  const caseBlocks = miniCasesContainer.querySelectorAll(".mini-case-block");
  constante nuevosCasos = [];

  caseBlocks.forEach((bloque) => {
    constante idx = parseInt(bloque.conjunto de datos.índice de caso, 10);
    const prev = !Number.isNaN(idx) && miniCases[idx] ? miniCases[idx] : {};

    constante caseText =
      bloque.querySelector(".admin-mini-case-text")?.value.trim() || "";
    const especialidad =
      bloque.querySelector(".admin-mini-case-specialty")?.valor || "";

    const bankCaseId = (bloque.dataset.bankCaseId || "").trim() || (prev.bankCaseId || null);

    const qBlocks = block.querySelectorAll(".bloque-de-preguntas-de-examen");
    const preguntas = [];

    qBlocks.paraCada((qb) => {
      constante preguntaTexto =
        qb.querySelector(".admin-q-pregunta")?.value.trim() || "";
      constante opciónA = qb.querySelector(".admin-qa")?.value.trim() || "";
      constante opciónB = qb.querySelector(".admin-qb")?.value.trim() || "";
      constante opciónC = qb.querySelector(".admin-qc")?.valor.trim() || "";
      constante opciónD = qb.querySelector(".admin-qd")?.valor.trim() || "";
      constante opcióncorrecta =
        qb.querySelector(".admin-q-correct")?.valor || "A";
      subtipo constante =
        qb.querySelector(".admin-q-subtype")?.valor || "salud_publica";
      dificultad constante =
        qb.querySelector(".admin-q-difficulty")?.value || "medios";
      justificación constante =
        qb.querySelector(".admin-q-justification")?.value.trim() || "";

      constante todoVacío =
        !preguntaTexto &&
        !opcionA &&
        !opcionB &&
        !opcionC &&
        !opcionD &&
        !justificación;

      si (allEmpty) retorna;

      preguntas.push({
        preguntaTexto,
        opciónA,
        opciónB,
        opciónC,
        opciónD,
        Opción correcta,
        subtipo,
        dificultad,
        justificación,
      });
    });

    si (!caseText && !preguntas.longitud) devolver;

    nuevosCasos.push({
      id: prev.id || nulo,
      ID de caso bancario,
      casoTexto,
      especialidad,
      preguntas,
    });
  });

  miniCasos =
    newCases.length > 0
      ? nuevos casos
      :[
          {
            id: nulo,
            bankCaseId: nulo,
            casoTexto: "",
            especialidad: "",
            preguntas: [createEmptyQuestion()],
          },
        ];
}

función asíncrona loadMiniCases() {
  si (!miniCasesContainer) retorna;

  si (miniCasesLoadedOnce && miniCases.length) {
    renderMiniCases();
    devolver;
  }

  miniCasesContainer.innerHTML = `
    <div class="tarjeta">
      <p class="panel-subtitle">Cargando banco de mini solicitudes…</p>
    </div>
  `;

  intentar {
    const snap = await getDocs(colección(db, "miniPreguntas"));
    miniCasos = snap.docs.map((d) => {
      constante datos = d.data();
      devolver {
        identificación: d.id,
        bankCaseId: datos.bankCaseId || nulo,
        caseText: datos.caseText || "",
        especialidad: datos.especialidad || "",
        preguntas:
          Array.isArray(datos.preguntas) && datos.preguntas.longitud
            ? datos.preguntas
            : [crearPreguntaVacía()],
      };
    });
  } atrapar (err) {
    consola.error(err);
    miniCasos = [];
    miniCasesContainer.innerHTML = `
      <div class="tarjeta">
        <p class="panel-subtitle">Error al cargar el banco de mini solicitudes.</p>
      </div>
    `;
    devolver;
  }

  si (!miniCases.length) {
    miniCasos.push({
      id: nulo,
      bankCaseId: nulo,
      casoTexto: "",
      especialidad: "",
      preguntas: [createEmptyQuestion()],
    });
  }

  miniCasesLoadedOnce = verdadero;
  renderMiniCases();
}

función renderMiniCases() {
  si (!miniCasesContainer) retorna;
  miniCasesContainer.innerHTML = "";

  si (!miniCases.length) {
    miniCasos.push({
      id: nulo,
      bankCaseId: nulo,
      casoTexto: "",
      especialidad: "",
      preguntas: [createEmptyQuestion()],
    });
  }

  miniCasos.forEach((caseData, índice) => {
    constante wrapper = document.createElement("div");
    wrapper.className = "bloque-mini-estuche-de-tarjeta";
    wrapper.dataset.caseIndex = índice;

    // ✅ persistencia en DOM
    wrapper.dataset.bankCaseId = caseData.bankCaseId || "";

    const specialityValue = caseData.specialty || "";
    constante preguntasArr = Array.isArray(caseData.preguntas)
      ? caseData.preguntas
      : [];

    wrapper.innerHTML = `
      <div clase="flex-row" estilo="justificar-contenido:espacio-entre;alinear-elementos:centro;margen-inferior:10px;">
        <h3 style="font-size:15px;font-weight:600;">
          Caso clínico global ${index + 1}
        </h3>
        <button type="button" class="btn btn-sm btn-outline admin-mini-delete-case">
          Eliminar caso
        </botón>
      </div>

      <label class="campo">
        <span>Especialidad</span>
        <seleccionar clase="admin-mini-case-specialty">
          <option value="">Selecciona…</option>
          ${Object.entries(ESPECIALIDADES)
            .mapa(
              ([clave, etiqueta]) =>
                `<opción valor="${key y}" ${
                  clave === valorEspecialidad ? "seleccionado" : ""
                }>${etiqueta}</opción>`
            )
            .unirse("")}
        </seleccionar>
      </etiqueta>

      <label class="campo">
        <span>Texto del caso clínico</span>
        <textarea class="admin-mini-case-text" rows="4">${caseData.caseText || ""}</textarea>
      </etiqueta>

      <div class="tarjetas-lista-administrador-mini-caso-preguntas"></div>

      <div clase="flex-row" estilo="justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-sm btn-primary admin-mini-add-question">
          + Agregar pregunta
        </botón>
      </div>
    `;

    const qContainer = wrapper.querySelector(".admin-mini-case-questions");

    si (!preguntasArr.longitud) {
      qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
    } demás {
      preguntasArr.forEach((qData) => {
        qContainer.appendChild(renderQuestionBlock(qData));
      });
    }

    envoltura
      .querySelector(".admin-mini-add-question")
      .addEventListener("clic", () => {
        qContainer.appendChild(renderQuestionBlock(createEmptyQuestion()));
      });

    envoltura
      .querySelector(".admin-mini-eliminar-caso")
      .addEventListener("clic", () => {
        constante idx = parseInt(wrapper.dataset.caseIndex, 10);
        si (Number.isNaN(idx)) retorna;
        miniCasos.splice(idx, 1);
        renderMiniCases();
      });

    miniCasesContainer.appendChild(envoltorio);
  });

  constante inferior = document.createElement("div");
  inferior.className = "flex-row";
  inferior.style.justifyContent = "extremo flexible";
  fondo.estilo.espacio = "8px";
  inferior.estilo.marginTop = "12px";

  const btnAddBottom = document.createElement("botón");
  btnAddBottom.type = "botón";
  btnAddBottom.className = "btn btn-sm btn-secundario";
  btnAddBottom.textContent = "+ Agregar caso clínico";
  btnAddBottom.addEventListener("clic", () => {
    si (btnMiniAddCase) btnMiniAddCase.click();
  });

  const btnSaveBottom = document.createElement("botón");
  btnSaveBottom.type = "botón";
  btnSaveBottom.className = "btn btn-sm btn-primary";
  btnSaveBottom.textContent = "Guardar banco";
  btnSaveBottom.addEventListener("clic", () => {
    si (btnMiniSaveAll) btnMiniSaveAll.click();
  });

  inferior.appendChild(btnAddBottom);
  inferior.appendChild(btnSaveBottom);
  miniCasesContainer.appendChild(abajo);
}

si (btnMiniAddCase && miniCasesContainer) {
  btnMiniAddCase.addEventListener("clic", () => {
    sincronizarMiniCasesFromDOM();
    miniCasos.push({
      id: nulo,
      bankCaseId: nulo,
      casoTexto: "",
      especialidad: "",
      preguntas: [createEmptyQuestion()],
    });
    renderMiniCases();
  });
}

función asíncrona handleSaveMiniBank() {
  si (!miniCasesContainer) retorna;

  // ✅ anterior para delta usageCount
  deje prevBankIds = [];
  intentar {
    const prevSnap = await getDocs(colección(db, "miniPreguntas"));
    prevBankIds = prevSnap.docs.map(d => (d.data() || {}).bankCaseId).filter(Boolean);
  } captura (e) {
    console.warn("No se pudieron leer miniPreguntas anteriores para delta:", e);
  }

  sincronizarMiniCasesFromDOM();

  si (!miniCases.length) {
    si (
      !confirmar(
        "No hay casos en el banco. Si continúas, se eliminarán todos los casos previos de mini solicitudes. ¿Continuar?"
      )
    ) {
      devolver;
    }
  }

  para (const c de miniCasos) {
    si (!c.caseText.trim()) {
      alert("Escribe el texto del caso clínico en todos los casos.");
      devolver;
    }
    si (!c.preguntas.longitud) {
      alert("Cada caso clínico del banco debe tener al menos una pregunta.");
      devolver;
    }
    para (const q de c.preguntas) {
      si (
        !q.preguntaTexto ||
        !q.opcionA ||
        !q.opcionB ||
        !q.opcionC ||
        !q.opcionD ||
        !q.opcioncorrecta ||
        !q.justificación
      ) {
        alert("Completa todos los campos en todas las preguntas del banco.");
        devolver;
      }
    }
  }

  constante newBankIds = miniCases.map(c => c.bankCaseId).filter(Boolean);

  constante btn = btnMiniSaveAll;
  if (btn) setLoadingButton(btn, true, "Guardar banco");

  intentar {
    const prevSnap = await getDocs(colección(db, "miniPreguntas"));
    para (const d de prevSnap.docs) {
      esperar deleteDoc(d.ref);
    }

    para (const c de miniCasos) {
      esperar addDoc(colección(db, "miniPreguntas"), {
        bankCaseId: c.bankCaseId || nulo, // ✅
        casoTexto: c.casoTexto,
        especialidad: c.especialidad,
        preguntas: c.preguntas,
        creadoEn: serverTimestamp(),
      });
    }

    // ✅ recuento de uso delta real
    esperar applyUsageDelta(prevBankIds, newBankIds);

    alert("Banco de mini expedientes guardado correctamente.");
  } atrapar (err) {
    consola.error(err);
    alert("Hubo un error al guardar el banco de mini solicitudes.");
  } finalmente {
    if (btn) setLoadingButton(btn, false, "Guardar banco");
  }
}

si (btnMiniSaveAll && miniCasesContainer) {
  btnMiniSaveAll.addEventListener("clic", handleSaveMiniBank);
}

/****************************************************
 * USUARIOS (CRUD) (SIN CAMBIOS)
 ****************************************************/

función asíncrona loadUsers() {
  si (!usersTableContainer) retorna;

  const snap = await getDocs(colección(db, "usuarios"));

  si (snap.vacío) {
    usuariosTableContainer.innerHTML = "";
    renderMensajeVacío(
      usuariosTableContainer,
      "No hay usuarios creados. Usa el formulario superior para crear uno."
    );
    devolver;
  }

  deje que html = `
    <tabla>
      <cabeza>
        <tr>
          <th>Nombre</th>
          Correo
          Rol
          Estado
          Vence
          <th></th>
        </tr>
      </cabeza>
      <cuerpo>
  `;

  snap.paraCada((docSnap) => {
    constante datos = docSnap.data();
    constante id = docSnap.id;
    const nombre = datos.nombre || "";
    constante email = datos.email || id;
    rol constante = data.role || "usuario";
    estado constante = datos.status || "inactivo";
    const expiry = datos.fechaDeExpiración || "";

    const chipRoleClass = rol === "admin" ? "chip--admin" : "chip--usuario";
    constante chipStatusClass =
      estado === "activo" ? "chip--activo" : "chip--inactivo";

    html += `
      <tr data-id="${id}">
        <td>${nombre}</td>
        <td>${correo electrónico}</td>
        <td><span class="chip ${chipRoleClass}">${rol}</span></td>
        <td><span class="chip ${chipStatusClass}">${estado}</span></td>
        <td>${caducidad || "—"}</td>
        <td>
          <button class="icon-btn admin-edit-user" title="Editar">✏</button>
          <button class="icon-btn admin-delete-user" title="Eliminar">🗑</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  usuariosTableContainer.innerHTML = html;

  usuariosTableContainer
    .querySelectorAll("tr[id-de-datos]")
    .forEach((fila) => attachUserRowEvents(fila));
}

función attachUserRowEvents(fila) {
  constante id = fila.conjunto de datos.id;
  const btnEdit = row.querySelector(".admin-edit-user");
  const btnDelete = fila.querySelector(".admin-delete-user");

  btnEdit.addEventListener("clic", () => openUserEditModal(id));
  btnDelete.addEventListener("clic", async () => {
    const ok = window.confirm("¿Eliminar este usuario?");
    si (!ok) retorna;
    intentar {
      esperar deleteDoc(doc(db, "usuarios", id));
      cargarUsuarios();
    } atrapar (err) {
      consola.error(err);
      alert("No se pudo eliminar el usuario.");
    }
  });
}

si (btnCreateUser) {
  btnCreateUser.addEventListener("clic", async () => {
    constante nombre = nuevoNombreUsuarioInput.value.trim();
    constante correo electrónico = newUserEmailInput.value.trim();
    constante contraseña = newUserPasswordInput.value.trim();
    constante rol = newUserRoleSelect.valor;
    constante estado = newUserStatusSelect.valor;
    constante expiración = newUserExpiryInput.value || "";

    si (!nombre || !correo electrónico || !contraseña) {
      alert("Nombre, correo y contraseña son obligatorios.");
      devolver;
    }

    intentar {
      esperar setDoc(doc(db, "usuarios", correo electrónico), {
        nombre,
        correo electrónico,
        contraseña,
        role,
        estado,
        fecha de caducidad: caducidad,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      alerta(
        "Usuario creado en Firestore.\nRecuerde crearlo también en Firebase Authentication manualmente."
      );

      nuevoNombreUsuarioInput.value = "";
      nuevoUserEmailInput.valor = "";
      nuevaContraseñaDeUsuarioInput.valor = "";
      newUserRoleSelect.value = "usuario";
      newUserStatusSelect.value = "activo";
      nuevoUserExpiryInput.valor = "";

      cargarUsuarios();
    } atrapar (err) {
      consola.error(err);
      alert("No se pudo crear el usuario.");
    }
  });
}

función openUserEditModal(userId) {
  const ref = doc(db, "usuarios", userId);
  obtenerDoc(ref).luego((snap) => {
    si (!snap.existe()) {
      alert("No se encontró el usuario.");
      devolver;
    }

    constante datos = snap.data();

    openModal({
      título: "Editar usuario",
      cuerpoHtml: `
        <label class="campo">
          <span>Nombre</span>
          <input type="text" id="nombre-de-usuario-modal" value="${data.name || ""}" />
        </etiqueta>
        <label class="campo">
          <span>Correo (ID)</span>
          <input type="email" id="modal-user-email" value="${data.email || userId}" readonly />
        </etiqueta>
        <label class="campo">
          <span>Contraseña (referencia)</span>
          <input type="text" id="modal-user-password" value="${data.password || ""}" />
        </etiqueta>
        <label class="campo">
          Rol
          <seleccionar id="rol-de-usuario-modal">
            <opción valor="admin" ${
              data.role === "admin" ? "seleccionado" : ""
            }>Administrador</opción>
            <opción valor="usuario" ${
              data.role === "usuario" ? "seleccionado" : ""
            }>Usuario</option>
          </seleccionar>
        </etiqueta>
        <label class="campo">
          <span>Estado</span>
          <select id="estado-de-usuario-modal">
            <opción valor="activo" ${
              data.status === "activo" ? "seleccionado" : ""
            }>Activo</opción>
            <opción valor="inactivo" ${
              data.status === "inactivo" ? "seleccionado" : ""
            }>Inactivo</opción>
          </seleccionar>
        </etiqueta>
        <label class="campo">
          <span>Fecha de vencimiento</span>
          <input type="fecha" id="modal-user-expiry" valor="${data.expiryDate || ""}" />
        </etiqueta>
      `,
      onOk: async() => {
        const nombre = document.getElementById("nombre-de-usuario-modal").value.trim();
        const email = document.getElementById("modal-usuario-email").value.trim();
        const contraseña = documento
          .getElementById("modal-usuario-contraseña")
          .valor.trim();
        const role = document.getElementById("modal-user-role").value;
        const status = document.getElementById("estado-del-usuario-modal").value;
        const expiry = document.getElementById("modal-user-expiry").value || "";

        si (!nombre || !correo electrónico) {
          alert("Nombre y correo son obligatorios.");
          devolver;
        }

        constante btn = modalBtnOk;
        setLoadingButton(btn, verdadero);

        intentar {
          esperar updateDoc(doc(db, "usuarios", correo electrónico), {
            nombre,
            correo electrónico,
            contraseña,
            role,
            estado,
            fecha de caducidad: caducidad,
            actualizadoEn: serverTimestamp(),
          });
          esperar cargarUsers();
          cerrarModal();
        } atrapar (err) {
          consola.error(err);
          alert("No se pudo actualizar el usuario.");
        } finalmente {
          setLoadingButton(btn, false, "Guardar");
        }
      },
    });
  });
}

/****************************************************
 * PANTALLA PRINCIPAL / ATERRIZAJE (SIN CAMBIOS)
 ****************************************************/

función asíncrona loadLandingSettings() {
  si (!landingTextArea) retorna;

  intentar {
    const ref = doc(db, "configuración", "landingPage");
    constante snap = esperar obtenerDoc(ref);

    si (!snap.existe()) {
      áreaDeTextoDeAterrizaje.valor =
        "Aquí podrás conocer todo lo que incluye la plataforma Estudiante ENARM.";
      monthlyLabelInput.value = "Plan mensual";
      mensualPriceInput.value = "0";
      enarmLabelInput.value = "Plan ENARM 2026";
      enarmPriceInput.valor = "0";
      whatsappPhoneInput.valor = "+525515656316";
      devolver;
    }

    constante datos = snap.data();

    landingTextArea.value = datos.descripción || "";
    monthlyLabelInput.value = data.monthlyLabel || "Plan mensual";
    entradaPrecioMensual.valor = datos.PrecioMensual || "0";
    enarmLabelInput.value = data.enarmLabel || "Plan ENARM 2026";
    enarmPriceInput.value = datos.enarmPrice || "0";
    whatsappPhoneInput.valor = datos.whatsappPhone || "+525515656316";
  } atrapar (err) {
    console.error("Error al cargar landingPage:", err);
  }
}

si (btnGuardarAterrizaje) {
  btnSaveLanding.addEventListener("clic", async () => {
    si (!landingTextArea) retorna;

    constante descripción = landingTextArea.value.trim();
    const monthlyLabel = monthlyLabelInput.value.trim() || "Plan mensual";
    const precioMensual = PrecioMensualInput.value.trim() || "0";
    const enarmLabel = enarmLabelInput.value.trim() || "Plan ENARM 2026";
    constante enarmPrice = enarmPriceInput.value.trim() || "0";
    constante whatsappPhone =
      whatsappPhoneInput.value.trim() || "+525515656316";

    constante btn = btnSaveLanding;
    setLoadingButton(btn, verdadero);

    intentar {
      esperar setDoc(
        doc(db, "configuración", "página de destino"),
        {
          descripción,
          etiqueta mensual,
          Precio mensual,
          etiqueta enarm,
          enarmPrice,
          WhatsAppTeléfono,
          actualizadoEn: serverTimestamp(),
        },
        { fusionar: verdadero }
      );

      alert("Pantalla principal guardada.");
    } atrapar (err) {
      consola.error(err);
      alert("Error al guardar la pantalla principal.");
    } finalmente {
      setLoadingButton(btn, false, "Guardar");
    }
  });
}

/****************************************************
 * ENLACES SOCIALES (SIN CAMBIOS)
 ****************************************************/

función asíncrona loadSocialLinks() {
  intentar {
    const ref = doc(db, "configuración", "enlaces sociales");
    constante snap = esperar obtenerDoc(ref);
    si (!snap.exists()) retorna;

    constante datos = snap.data();

    adminSocialIcons.forEach((icono) => {
      const red = icono.conjunto de datos.red;
      si (datos[red]) {
        icon.dataset.url = datos[red];
      }
    });
  } atrapar (err) {
    console.error("Error al cargar enlaces sociales:", err);
  }

  adminSocialIcons.forEach((icono) => {
    icon.addEventListener("clic", () => {
      const url = icono.conjunto de datos.url;
      si (!url) {
        alert("No se ha configurado el enlace para esta red social.");
        devolver;
      }
      ventana.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

función asíncrona loadSocialLinksIntoLanding() {
  intentar {
    const ref = doc(db, "configuración", "enlaces sociales");
    constante snap = esperar obtenerDoc(ref);
    si (!snap.exists()) retorna;

    constante datos = snap.data();

    si (aterrizajeInstagramInput)
      landingInstagramInput.value = datos.instagram || "";
    si (aterrizajeWhatsappLinkInput)
      aterrizajeWhatsappLinkInput.valor = datos.whatsapp || "";
    si (landingTiktokInput) landingTiktokInput.valor = datos.tiktok || "";
    si (aterrizajeTelegramInput)
      landingTelegramInput.value = datos.telegrama || "";
  } atrapar (err) {
    console.error("Error al cargar socialLinks para el panel de inicio:", err);
  }
}

const btnSaveSocialLinks = document.getElementById("admin-btn-guardar-enlaces-sociales");
si (btnGuardarEnlacesSociales) {
  btnSaveSocialLinks.addEventListener("clic", async () => {
    constante instagram = landingInstagramInput.value.trim();
    constante whatsapp = landingWhatsappLinkInput.value.trim();
    constante tiktok = landingTiktokInput.value.trim();
    constante telegrama = landingTelegramInput.value.trim();

    constante btn = btnSaveSocialLinks;
    setLoadingButton(btn, verdadero);

    intentar {
      esperar setDoc(
        doc(db, "configuración", "enlaces sociales"),
        {
          Instagram,
          WhatsApp,
          tik tok,
          telegrama,
          actualizadoEn: serverTimestamp(),
        },
        { fusionar: verdadero }
      );

      alert("Enlaces de redes sociales guardados.");
      cargarSocialLinks();
    } atrapar (err) {
      consola.error(err);
      alert("No se pudieron guardar los enlaces de redes.");
    } finalmente {
      setLoadingButton(btn, false, "Guardar");
    }
  });
}

/****************************************************
 * ANÁLISIS BÁSICOS (SIN CAMBIOS)
 ****************************************************/

función asíncrona loadAnalyticsSummary() {
  si (!analyticsSummaryBox || !analyticsUsersBox) devolver;

  intentar {
    const sectionsSnap = await getDocs(colección(db, "secciones"));
    const examsSnap = await getDocs(colección(db, "exámenes"));
    const casesSnap = await getDocs(colección(db, "preguntas"));
    const usersSnap = await getDocs(colección(db, "usuarios"));

    deje totalCases = 0;
    deje totalPreguntas = 0;

    casosSnap.forEach((docSnap) => {
      totalCasos+= 1;
      constante datos = docSnap.data();
      const arr = Array.isArray(datos.preguntas) ? datos.preguntas : [];
      totalPreguntas+= arr.length;
    });

    analyticsSummaryBox.innerHTML = `
      <div class="tarjeta">
        <h3 style="font-size:16px;margin-bottom:8px;">Currículum global</h3>
        <p>Secciones: <strong>${sectionsSnap.size}</strong></p>
        <p>Exámenes: <strong>${examsSnap.size}</strong></p>
        <p>Casos clínicos: <strong>${totalCases}</strong></p>
        <p>Preguntas totales: <strong>${totalQuestions}</strong></p>
      </div>
    `;

    constante userRows = [];
    para (const u de usersSnap.docs) {
      constante userData = u.data();
      const email = userData.email || u.id;
      const nombre = userData.name || correo electrónico;

      const intentosSnap = esperar obtenerDocs(
        colección(db, "usuarios", correo electrónico, "intentosdeexamen")
      );

      si (intentosSnap.empty) continuar;

      sea ​​sumaPuntuación = 0;
      deje que el conteo sea 0;

      intentosSnap.forEach((a) => {
        constante d = a.data();
        si (tipo de d.score === "número") {
          sumaPuntuación += d.puntuación;
          contar++;
        }
      });

      const avg = count ? sumaPuntuación / count : 0;
      userRows.push({ nombre, correo electrónico, promedio, exámenes: recuento });
    }

    si (!userRows.length) {
      analyticsUsersBox.innerHTML = `
        <div class="tarjeta">
          <p>Aún no hay intentos de solicitudes registradas.</p>
        </div>
      `;
      devolver;
    }

    deje que tableHtml = `
      <div class="tarjeta">
        <h3 style="font-size:16px;margin-bottom:8px;">Promedios por usuario</h3>
        <tabla>
          <cabeza>
            <tr>
              <th>Usuario</th>
              Correo
              Intentos
              Promedio ponderado
            </tr>
          </cabeza>
          <cuerpo>
    `;

    userRows.forEach((u) => {
      tablaHtml += `
        <tr>
          <td>${u.nombre}</td>
          <td>${u.email}</td>
          <td>${u.exams}</td>
          <td>${u.avg.toFixed(1)}%</td>
        </tr>
      `;
    });

    tablaHtml += "</tbody></tabla></div>";
    analyticsUsersBox.innerHTML = tablaHtml;
  } atrapar (err) {
    console.error("Error al cargar análisis:", err);
    analyticsSummaryBox.innerHTML = `
      <div class="tarjeta">
        <p>No se pudieron cargar las estadísticas.</p>
      </div>
    `;
  }
}

/****************************************************
 * FIN ADMIN.JS
 ****************************************************/
console.log("admin.js cargado correctamente (banco editable + bloqueo duplicados + useCount delta).");
