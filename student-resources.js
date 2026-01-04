// recursos-para-estudiantes.js
// Biblioteca de Resúmenes / PDFs / GPC (usa el 2° proyecto Firebase: pagina-buena)
// Objetivo: UI moderna + filtros robustos (sin romper simulacros).
// OPT PRO: vista previa segura para iOS (1 iframe + aceleración + reinicio completo) + delegación de eventos.
// REQ: PDF SOLO en vista previa. Resto SOLO pestaña nueva. NO descargas automáticas.

importar { initializeApp, getApps, getApp } desde "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
importar { getFirestore, colección, getDocs, getDoc, doc, consulta, orderBy } desde "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/****************************************************
 * Firebase (proyecto de BIBLIOTECA) - pagina-buena
 * ✅ CONFIGURACIÓN COMPLETA (SIN apiKey solo)
 ****************************************************/
constante RECURSOS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQsx1UlomuEw",
  dominio_de_autorización: "pagina-buena.firebaseapp.com",
  URL de la base de datos: "https://pagina-buena-default-rtdb.firebaseio.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.firebasestorage.app",
  Id. del remitente de mensajería: "810208199031",
  ID de aplicación: "1:810208199031:web:707a76b931ee7d2f002172",
};

deje que recursosDb = null;
función asegurarRecursosDb() {
  si (recursosDb) devuelve recursosDb;

  const existe = getApps().some((a) => a.name === "resourcesApp");
  const app = exists ? getApp("resourcesApp") : initializeApp(RESOURCES_FIREBASE_CONFIG, "resourcesApp");

  recursosDb = getFirestore(app);
  devolver recursosDb;
}

/****************************************************
 * Estado
 ****************************************************/
deje que _uiInitialized = falso;
deje que _dataLoaded = falso;
deje que _allTopics = [];

deje que selectedSpecialtyKey = "";
deje que searchQuery = "";

// navegación (sin modal)
deje que _selectedTopicId = nulo;

// guardamos link real y link de vista previa por separado
let _selectedPreviewUrl = ""; // Visor SIEMPRE (sin descarga)
let _selectedOpenUrl = ""; // para abrir en pestaña nueva

// progreso (almacenamiento local por usuario)
deje que _currentUserKey = "anónimo";

deje que viewEl, searchEl, specialtyEl, listEl, detailEl, countEl, emptyEl, loadingEl;
deje que progressTextEl, progressBarEl;

let modalRoot = nulo; // se conserva (no se elimina), pero ya no lo usamos para abrir temas

/****************************************************
 * ✅ Optimización iOS: vista previa estable (1 iframe + acelerador)
 ****************************************************/
constante IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
constante IS_MOBILE =
  ventana.matchMedia("(puntero:grueso)").coincidencias ||
  ventana.matchMedia("(hover: none)").matches ||
  ventana.matchMedia("(ancho máximo: 900px)").matches;

sea ​​_previewFrameEl = null;
sea ​​_previewBoxEl = null;
sea ​​_previewNoteEl = null;
sea ​​_previewOpenBtnEl = null;
deje que _previewLoadingEl = null;

deje que _previewToken = 0;
deje que _previewTimer = null;
deje que _previewLastSwitchAt = 0;

// programador de renderizado (evita renders en ráfaga)
deje que _renderScheduled = falso;

/****************************************************
 * Normalización y mapeo (FIX del filtro)
 ****************************************************/
función normalizarTexto(s) {
  devuelve cadena(s || "")
    .normalizar("NFD")
    .reemplazar(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .reemplazar(/[_-]+/g, " ")
    .reemplazar(/\s+/g, " ")
    .recortar();
}

función canonicalizeSpecialty(raw) {
  const n = normalizarTexto(raw);

  if (n.includes("acceso gratuito")) return "acceso_gratuito";
  if (n.includes("cirugia")) devuelve "cirugia_general";
  if (n.includes("medicina interna") || (n.includes("medicina") && n.includes("interna"))) return "medicina_interna";
  si (n.includes("pediatr")) devuelve "pediatria";
  if (n.includes("gine") || n.includes("obst")) return "gine_obstetricia";

  return "otros";
}

función specialtyLabelFromKey(clave) {
  interruptor (tecla) {
    caso "medicina_interna":
      devolver "Medicina interna";
    caso "cirugia_general":
      volver "Cirugía general";
    caso "pediatría":
      volver "Pediatría";
    caso "gine_obstetricia":
      volver "Ginecología y Obstetricia";
    caso "acceso_gratuito":
      devolver "Acceso gratuito limitado";
    por defecto:
      devolver "Otros";
  }
}

/****************************************************
 * Interfaz de usuario de ayudantes
 ****************************************************/
función show(el) {
  si (el) el.classList.remove("oculto");
}
función ocultar(el) {
  si (el) el.classList.add("oculto");
}

función escapeHtml(str) {
  devolver cadena (str || "")
    .replace(/&/g, "&")
    .reemplazar(/</g, "<")
    .reemplazar(/>/g, ">")
    .reemplazar(/"/g, """)
    .replace(/'/g, "'");
}

función guessLinkType(etiqueta, url) {
  const l = normalizeText(etiqueta);
  const u = normalizarTexto(url);

  // Resumen/Word/Docs -> NO se previsualiza (se abre link real)
  si (l.includes("resumen") || l.includes("word") || u.includes("docs.google.com/document") || u.includes(".doc")) {
    devolver "resumen";
  }

  // GPC: NO vista previa (solo pestaña nueva) aunque sea PDF
  if (l.includes("gpc") || l.includes("guia") || l.includes("practica clínica")) {
    devolver "gpc";
  }

  // PDF
  si (l.includes("pdf") || u.includes(".pdf") || u.includes("aplicacion/pdf")) {
    devolver "pdf";
  }
  si (u.includes("drive.google.com/file")) devuelve "pdf";
  si (u.includes("drive.google.com/uc") y u.includes("id=")) devuelve "pdf";

  devolver "otro";
}

función buildLinkGroups(tema) {
  const links = Array.isArray(tema.links) ? tema.links : [];
  const grupos = { resumen: [], pdf: [], gpc: [], otro: [] };

  enlaces.paraCada((x) => {
    const label = x?.label || x?.name || x?.title || "Documento";
    constante url = x?.url || x?.href || "";
    si (!url) retorna;

    constante tipo = guessLinkType(etiqueta, url);
    grupos[tipo].push({ etiqueta, url });
  });

  grupos.resumen.sort((a, b) => a.label.localeCompare(b.label));
  grupos.pdf.sort((a, b) => a.label.localeCompare(b.label));
  grupos.gpc.sort((a, b) => a.label.localeCompare(b.label));
  grupos.otro.sort((a, b) => a.label.localeCompare(b.label));

  grupos de retorno;
}

/****************************************************
 * Progreso (almacenamiento local)
 ****************************************************/
función getProgressStorageKey() {
  devuelve `recursos_completados_${_currentUserKey}`;
}

función loadCompletedSet() {
  intentar {
    const raw = localStorage.getItem(getProgressStorageKey());
    const arr = raw ? JSON.parse(raw) : [];
    devolver nuevo Conjunto(Array.isArray(arr) ? arr : []);
  } atrapar {
    devolver nuevo Conjunto();
  }
}

función saveCompletedSet(conjunto) {
  intentar {
    localStorage.setItem(getProgressStorageKey(), JSON.stringify(Array.from(set)));
  } atrapar {
    // sin operación
  }
}

función isTopicCompleted(topicId) {
  devolver loadCompletedSet().has(String(topicId));
}

función toggleTopicCompleted(topicId) {
  constante id = String(temaId);
  constante set = loadCompletedSet();
  si (set.has(id)) set.delete(id);
  de lo contrario set.add(id);
  saveCompletedSet(conjunto);
}

/****************************************************
 * Ayudas de vista previa (PDF en línea SOLAMENTE, sin descargas)
 ****************************************************/
función extractDriveFileId(url) {
  constante u = Cadena(url || "");

  // /archivo/d/<id>
  constante m1 = u.match(/\/archivo\/d\/([^/]+)/i);
  si (m1 && m1[1]) devuelve m1[1];

  // ?id=<id>
  constante m2 = u.match(/[?&]id=([^&]+)/i);
  si (m2 && m2[1]) devuelve m2[1];

  devolver "";
}

función makeDrivePreviewViewerUrl(fileId) {
  si (!fileId) devuelve "";
  devuelve `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

función makeDriveViewUrl(fileId) {
  si (!fileId) devuelve "";
  devuelve `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

función makeGoogleGviewUrl(pdfUrl) {
  si (!pdfUrl) devuelve "";
  devuelve `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdfUrl)}`;
}

función makePreviewUrl(url) {
  constante raw = String(url || "").trim();
  const n = normalizarTexto(raw);

  si (!raw) devuelve "";

  // Si ya es un espectador, lo respetamos
  si (n.includes("docs.google.com/gview?embedded=1")) devuelve sin procesar;
  si (n.includes("drive.google.com/file") y n.includes("/preview")) devuelve sin procesar;

  // Unidad (archivo o uc): SIEMPRE usar /preview
  si (n.includes("drive.google.com")) {
    constante id = extractDriveFileId(raw);
    si (id) devuelve makeDrivePreviewViewerUrl(id);
    devolver "";
  }

  // PDF directo: usar gview para evitar descarga automática
  si (n.includes(".pdf") || n.includes("aplicacion/pdf")) {
    devolver makeGoogleGviewUrl(raw);
  }

  devolver "";
}

función makeOpenUrl(url) {
  constante raw = String(url || "").trim();
  const n = normalizarTexto(raw);
  si (!raw) devuelve "";

  si (n.includes("drive.google.com")) {
    constante id = extractDriveFileId(raw);
    si (id) devuelve makeDriveViewUrl(id);
    devolver crudo;
  }

  devolver crudo;
}

/****************************************************
 * ✅ Control DOM de vista previa (1 iframe + acelerador + reinicio completo)
 ****************************************************/
función cachePreviewDomRefs() {
  si (!listEl) retorna;

  _previewFrameEl = listEl.querySelector("#marco-de-vista-previa-de-recursos-para-estudiantes");
  _previewBoxEl = listEl.querySelector("#cuadro-de-vista-previa-de-recursos-para-estudiantes");
  _previewNoteEl = listEl.querySelector("#nota-de-vista-previa-de-recursos-para-estudiantes");
  _previewOpenBtnEl = listEl.querySelector("#recursos-para-estudiantes-abrir-nueva-pestaña");
  _previewLoadingEl = listEl.querySelector("#recursos-para-estudiantes-vista-previa-carga");

  si (_previewFrameEl && !_previewFrameEl.dataset.bound) {
    _previewFrameEl.dataset.bound = "1";

    _previewFrameEl.addEventListener("cargar", () => {
      si (!_previewFrameEl) retorna;
      si (Cadena(_previewToken) !== Cadena(_previewFrameEl.dataset.token || "")) devolver;
      setPreviewLoading(falso);
    });

    _previewFrameEl.addEventListener("error", () => {
      si (!_previewFrameEl) retorna;
      si (Cadena(_previewToken) !== Cadena(_previewFrameEl.dataset.token || "")) devolver;
      setPreviewLoading(falso);
      mostrarVistaPreviaNoDisponibleNota();
    });
  }
}

función setPreviewLoading(on) {
  si (!_previewLoadingEl) retorna;
  si (activado) _previewLoadingEl.classList.remove("oculto");
  de lo contrario _previewLoadingEl.classList.add("oculto");
}

función mostrarPreviewUnavailableNote(texto personalizado) {
  si (_previewNoteEl) {
    _previewNoteEl.textContent = texto personalizado || "No se pudo mostrar el PDF aquí. Ábrelo en pestaña nueva.";
  }
  si (_previewBoxEl) _previewBoxEl.classList.add("oculto");
}

función disposeInlinePreview() {
  intentar {
    si (_previewFrameEl) _previewFrameEl.src = "acerca de:en blanco";
  } atrapar {}
  setPreviewLoading(falso);
  clearTimeout(_previewTimer);
  _previewTimer = nulo;
}

función applyPreviewToDom(token) {
  si (!_previewFrameEl) retorna;

  // botón abrir (solo si hay PDF seleccionado)
  si (_previewOpenBtnEl) {
    si (_selectedOpenUrl) {
      _previewOpenBtnEl.classList.remove("oculto");
      _previewOpenBtnEl.setAttribute("href", _selectedOpenUrl);
    } demás {
      _previewOpenBtnEl.classList.add("oculto");
      _previewOpenBtnEl.removeAttribute("href");
    }
  }

  // si no hay vista previa (no hay PDF o no se pudo construir URL)
  si (!_selectedPreviewUrl) {
    _previewFrameEl.src = "acerca de:en blanco";
    showPreviewUnavailableNote("Este tema no tiene PDF para vista previa.");
    devolver;
  }

  si (_previewBoxEl) _previewBoxEl.classList.remove("oculto");
  if (_previewNoteEl) _previewNoteEl.textContent = "Vista previa (PDF)";

  setPreviewLoading(verdadero);

  // REINICIO COMPLETO
  _previewFrameEl.dataset.token = String(token);
  _previewFrameEl.src = "acerca de:en blanco";

  solicitudAnimationFrame(() => {
    si (token !== _previewToken) retorna;

    constante url = _selectedPreviewUrl;
    constante sep = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${sep}v=${token}`;

    _previewFrameEl.dataset.token = String(token);
    _previewFrameEl.src = URL final;
  });
}

función schedulePreviewUpdate() {
  si (!_previewFrameEl) retorna;

  const ahora = rendimiento.now();
  constante minGap = IS_IOS ? 650 : IS_MOBILE ? 450 : 150;
  const wait = Math.max(0, minGap - (ahora - _previewLastSwitchAt));
  _previewLastSwitchAt = ahora;

  clearTimeout(_previewTimer);
  constante token = +++_previewToken;

  _previewTimer = establecerTiempoDeVista(() => {
    aplicarPreviewToDom(token);
  }, esperar);
}

/****************************************************
 * Modal (SE CONSERVA)
 ****************************************************/
función asegurarModal() {
  si (modalRoot) retorna;

  modalRoot = documento.createElement("div");
  modalRoot.id = "recursos-estudiantes-modal";
  modalRoot.className = "recursos-modales ocultos";
  modalRoot.setAttribute("aria-hidden", "verdadero");

  modalRoot.innerHTML = `
    <div class="resources-modal__overlay" data-close="1"></div>
    <div class="resources-modal__panel" role="dialog" aria-modal="true" aria-label="Biblioteca de recursos">
      <div class="resources-modal__header">
        <div class="resources-modal__headtext">
          <div class="resources-modal__badge" id="student-resources-modal-specialty">—</div>
          <div class="resources-modal__title" id="student-resources-modal-title">—</div>
        </div>
        <button class="btn btn-outline btn-sm" id="student-resources-modal-close">Cerrar</button>
      </div>
      <div class="recursos-modal__body" id="recursos-para-estudiantes-modal-body"></div>
    </div>
  `;

  documento.cuerpo.appendChild(modalRoot);

  const closeBtn = modalRoot.querySelector("#recursos-para-estudiantes-modal-close");
  const superposición = modalRoot.querySelector("[data-close='1']");

  closeBtn?.addEventListener("clic", closeModal);
  superposición?.addEventListener("clic", closeModal);

  documento.addEventListener("keydown", (e) => {
    si (e.key === "Escape" && modalRoot && !modalRoot.classList.contains("hidden")) closeModal();
  });
}

función closeModal() {
  si (!modalRoot) retorna;
  modalRoot.classList.add("oculto");
  modalRoot.setAttribute("aria-hidden", "verdadero");
  document.body.classList.remove("modal-abierto");
}

/****************************************************
 * Inicialización de la interfaz de usuario
 ****************************************************/
función de exportación initStudentResourcesUI() {
  si (_uiInitialized) retorna;
  _uiInitialized = verdadero;

  viewEl = document.getElementById("vista-de-recursos-para-estudiantes");
  searchEl = document.getElementById("busqueda-de-recursos-para-estudiantes");
  especialidadEl = document.getElementById("recursos-para-estudiantes-especialidad");
  listEl = document.getElementById("lista-de-recursos-para-estudiantes");
  detailEl = document.getElementById("detalle-de-recursos-para-estudiantes");
  countEl = document.getElementById("número-de-recursos-para-estudiantes");
  emptyEl = document.getElementById("recursos-para-estudiantes-vacíos");
  loadingEl = document.getElementById("carga-de-recursos-para-estudiantes");
  progressTextEl = document.getElementById("texto-de-progreso-de-recursos-para-estudiantes");
  progressBarEl = document.getElementById("barra-de-progreso-de-recursos-para-estudiantes");

  si (viewEl) viewEl.setAttribute("data-ui", "tarjetas");
  if (detalleEl) detalleEl.innerHTML = "";

  // Ocultar columna derecha (si existe) y usar todo el ancho para lista
  si (detalleEl) {
    const rightCol = detailEl.closest("div");
    si (columnaderecha) col.claseLista.add("oculto");
  }
  si (listaEl) {
    constante leftCol = listEl.closest("div");
    si (columna izquierda) {
      leftCol.style.flex = "1 1 100%";
      leftCol.style.minWidth = "0";
    }
  }

  si (especialidadEl && !especialidadEl.conjuntodedatos.límite) {
    especialidadEl.dataset.bound = "1";
    especialidadEl.innerHTML = `
      <option value="">Todas</option>
      <option value="medicina_interna">Medicina interna</option>
      <option value="cirugia_general">Cirugía general</option>
      <option value="pediatria">Pediatría</option>
      <option value="gine_obstetricia">Ginecología y Obstetricia</option>
      <option value="acceso_gratuito">Acceso gratuito limitado</option>
    `;
    specialtyEl.addEventListener("cambio", () => {
      selectedSpecialtyKey = especialidadEl.valor || "";
      _selectedTopicId = nulo;
      _selectedPreviewUrl = "";
      _selectedOpenUrl = "";
      disponerVistaPreviaEnLínea();
      programarRender();
    });
  }

  si (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";

    // debounce liviano para no renderizar en ráfaga
    sea ​​t = nulo;
    searchEl.addEventListener("entrada", () => {
      clearTimeout(t);
      t = establecerTiempo de espera(() => {
        consultaDeBúsqueda = String(buscarEl.valor || "").trim();
        _selectedTopicId = nulo;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        disponerVistaPreviaEnLínea();
        programarRender();
      }, 120);
    });
  }

  // Delegación de eventos (1 oyente solista, más ligero)
  si (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = "1";

    listEl.addEventListener("clic", async (e) => {
      constante objetivo = e.objetivo;

      // VISTA DE LISTA: abrir tarjeta
      const openBtn = objetivo?.más cercano?.(".tarjeta-de-recurso__abierta");
      const card = target?.closest?.(".tarjeta-de-recurso");
      si (openBtn || tarjeta) {
        const root = openBtn || tarjeta;
        const id = root?.getAttribute?.("id-del-tema-de-datos");
        si (id) {
          e.preventDefault();
          e.stopPropagation();
          disponerVistaPreviaEnLínea();
          _selectedTopicId = id;
          _selectedPreviewUrl = "";
          _selectedOpenUrl = "";
          programarRender();
          devolver;
        }
      }

      // VISTA DE DETALLE: atrás
      si (objetivo?.más cercano?.("#student-resources-back")) {
        e.preventDefault();
        disponerVistaPreviaEnLínea();
        _selectedTopicId = nulo;
        _selectedPreviewUrl = "";
        _selectedOpenUrl = "";
        programarRender();
        devolver;
      }
      // VISTA DETALLADA: iniciar mini-examen del tema
      si (objetivo?.más cercano?.("#recursos-para-estudiantes-inicio-tema-examen")) {
        e.preventDefault();
        intentar {
          const db = await asegurarResourcesDb();
          const ref = doc(db, "tema_exámenes", String(_selectedTopicId));
          constante snap = esperar obtenerDoc(ref);
          si (!snap.existe()) {
            alert("Este tema aún no tiene mini-examen configurado.");
            devolver;
          }
          constante datos = snap.data() || {};
          const casos = Array.isArray(datos.casos) ? datos.casos : [];
          constante tema = _allTopics.find((t) => String(t.id) === String(_selectedTopicId));
          const topicTitle = topic?.title || "Mini-examen del tema";

          ventana.dispatchEvent(
            nuevo CustomEvent("estudiante:openTopicExam", {
              detalle: { topicId: String(_selectedTopicId), topicTitle, casos },
            })
          );
        } atrapar (err) {
          consola.error(err);
          alert("No se pudo iniciar el mini-examen. Intento de nuevo.");
        }
        devolver;
      }



      // VISTA DE DETALLE: completa
      si (objetivo?.más cercano?.("#student-resources-complete")) {
        e.preventDefault();
        constante tema = getSelectedTopic();
        si (tema) {
          toggleTopicCompleted(tema.id);
          programarRender();
        }
        devolver;
      }

      // VISTA DE DETALLE: botón de vista previa (PDF SOLO)
      const previewBtn = target?.closest?.("botón[url-vista-previa-de-datos]");
      si (previewBtn) {
        e.preventDefault();

        const raw = previewBtn.getAttribute("url-vista-previa-de-datos") || "";
        si (!raw) retorna;

        // Abrir en nueva pestaña: visor preferido (sin descarga)
        _selectedOpenUrl = makeOpenUrl(sin procesar);

        // Vista previa: visor SIEMPRE (sin descarga)
        constante vista previa = makePreviewUrl(raw);
        _selectedPreviewUrl = vista previa || "";

        // Marca visual (ARIA) sin re-render
        listEl.querySelectorAll("botón[url-vista-previa-de-datos][aria-pressed='true']").forEach((b) => {
          b.setAttribute("aria-presionado", "falso");
        });
        previewBtn.setAttribute("aria-pressed", "verdadero");

        vista previa en cachéDomRefs();
        programarPreviewUpdate();
        devolver;
      }
    });
  }

  // Si la pestaña se oculta, corta el iframe (reduce congelaciones en iOS)
  si (!documento.documentElement.dataset.resourcesVisBound) {
    documento.documentElement.dataset.resourcesVisBound = "1";
    document.addEventListener("cambio de visibilidad", () => {
      si (documento.oculto) disposeInlinePreview();
    });
  }

  asegurarModal();
}

/****************************************************
 * Cargar datos
 ****************************************************/
exportar función asíncrona activateStudentResources() {
  initStudentResourcesUI();

  intentar {
    mostrar(cargandoEl);
    ocultar(vacíoEl);

    si (!_datos cargados) {
      constante db = asegurarRecursosDb();
      const q = consulta(colección(db, "temas"), orderBy("título", "asc"));
      constante snap = esperar getDocs(q);

      _allTopics = snap.docs.map((d) => {
        constante datos = d.datos() || {};
        const especialidadRaw = datos.especialidad || "";
        devolver {
          identificación: d.id,
          título: datos.título || "Tema sin título",
          especialidad: especialidadCruda,
          specialtyKey: canonicalizeSpecialty(specialtyRaw),
          enlaces: Array.isArray(datos.enlaces) ? datos.enlaces : [],
        };
      });

      _dataLoaded = verdadero;
    }

    scheduleRender(verdadero);
  } atrapar (err) {
    console.error("Error al cargar biblioteca (temas):", err);
    si (listaEl) {
      listaEl.innerHTML = `
        <div clase="tarjeta" estilo="relleno:12px 14px;">
          <div class="panel-subtitle">No se pudieron cargar los temas. Intento de nuevo.</div>
        </div>
      `;
    }
  } finalmente {
    ocultar(cargandoEl);
  }
}

/****************************************************
 * API opcional: configurar usuario
 ****************************************************/
función de exportación setStudentResourcesUserIdentity(emailOrUid) {
  _currentUserKey = normalizeText(emailOrUid || "anónimo") || "anónimo";
}

/****************************************************
 * API: estadísticas de progreso para la vista "Progreso"
 ****************************************************/
exportar función asíncrona getStudentResourcesProgressStats(opciones = {}) {
  const { includeAccesoGratuito = false } = opciones || {};
  intentar {
    // Cargar datos si aún no está
    si (!_datos cargados) {
      constante db = asegurarRecursosDb();
      const q = consulta(colección(db, "temas"), orderBy("título", "asc"));
      constante snap = esperar getDocs(q);

      _allTopics = snap.docs.map((d) => {
        constante datos = d.datos() || {};
        const especialidadRaw = datos.especialidad || "";
        devolver {
          identificación: d.id,
          título: datos.título || "Tema sin título",
          especialidad: especialidadCruda,
          specialtyKey: canonicalizeSpecialty(specialtyRaw),
          enlaces: Array.isArray(datos.enlaces) ? datos.enlaces : [],
        };
      });

      _dataLoaded = verdadero;
    }

    const topics = includeAccesoGratuito
      ?_todos los temas
      : _allTopics.filter((t) => t.specialtyKey !== "acceso_gratuito");

    constante set = loadCompletedSet();
    constante topicIds = nuevo Conjunto(temas.map((t) => String(t.id)));

    deje que completeCount = 0;
    establecer.paraCada((id) => {
      si (topicIds.has(String(id))) completedCount += 1;
    });

    const total = temas.longitud;
    constante porcentaje = total > 0 ? (conteo completado / total) * 100 : 0;

    devolver { totalTopics: total, completedTopics: completedCount, porcentaje };
  } atrapar (err) {
    console.error("Error al obtener estadísticas de biblioteca:", err);
    devolver { totalTopics: 0, completeTopics: 0, porcentaje: 0 };
  }
}

/****************************************************
 * Prestar
 ****************************************************/
función aplicarFiltros(temas) {
  const q = normalizarTexto(ConsultaDeBúsqueda);
  constante seleccionado = claveEspecialSeleccionada || "";

  devolver temas.filter((t) => {
    si (!seleccionado) {
      si (t.specialtyKey === "acceso_gratuito") devuelve falso;
    } demás {
      si (t.specialtyKey !== seleccionado) devuelve falso;
    }

    si (!q) devuelve verdadero;

    constante titulo = normalizarTexto(t.titulo);
    const sp = normalizeText(t.specialty);
    devolver título.includes(q) || sp.includes(q);
  });
}

función getSelectedTopic() {
  si (!_selectedTopicId) devuelve nulo;
  devolver _allTopics.find((t) => String(t.id) === String(_selectedTopicId)) || nulo;
}

función scheduleRender(forceImmediate = false) {
  si (!_dataLoaded || !listEl) retorna;

  si (fuerzaInmediata) {
    _renderScheduled = falso;
    prestar();
    devolver;
  }

  si (_renderScheduled) retorna;
  _renderScheduled = verdadero;

  solicitudAnimationFrame(() => {
    _renderScheduled = falso;
    prestar();
  });
}

función render() {
  si (!listEl) retorna;

  constante filtrada = aplicarFiltros(_todosLosTemas);

  // ✅ Progreso (según filtros actuales)
  si (progressTextEl && progressBarEl) {
    const includeAccesoGratuito = !selectedSpecialtyKey || selectedSpecialtyKey === "acceso_gratuito";
    constante topicsForStats = includeAccesoGratuito
      ?_todos los temas
      : _allTopics.filter((t) => t.specialtyKey !== "acceso_gratuito");

    constante topicIds = nuevo Set(temasParaEstadísticas.map((t) => String(t.id)));
    constante set = loadCompletedSet();
    deje que completeCount = 0;
    establecer.paraCada((id) => {
      si (topicIds.has(String(id))) completedCount += 1;
    });

    constante total = topicIds.size;
    constante pct = total ? Math.round((completedCount / total) * 100) : 0;

    ProgressTextEl.textContent = `${completedCount} / ${total} (${pct}%)`;
    progressBarEl.style.width = `${pct}%`;
  }


  si (countEl) countEl.textContent = `${filtered.length} tema${filtered.length === 1 ? "" : "s"}`;

  constante seleccionado = getSelectedTopic();
  si (seleccionado) {
    ocultar(vacíoEl);
    renderTopicDetail(seleccionado);
    devolver;
  }

  // vista de lista
  si (!filtrado.longitud) {
    listaEl.innerHTML = "";
    mostrar(vacíoEl);
    devolver;
  }

  ocultar(vacíoEl);
  listEl.classList.add("cuadrícula-de-recursos");

  const frag = documento.createDocumentFragment();

  filtrado.paraCada((t) => {
    const grupos = buildLinkGroups(t);
    const hasResumen = grupos.resumen.length > 0;
    const pdfCount = grupos.pdf.length;
    const gpcCount = grupos.gpc.length;
    const otherCount = grupos.otro.length;

    const spLabel = specialtyLabelFromKey(t.specialtyKey);
    constante completado = isTopicCompleted(t.id);

    constantes insignias = [];
    si (completado) insignias.push(`<span class="resource-badge">Completado</span>`);
    si (tieneCurrículum) insignias.push(`<span class="resource-badge">Currículum</span>`);
    si (pdfCount) insignias.push(`<span class="resource-badge">PDF ${pdfCount}</span>`);
    si (gpcCount) insignias.push(`<span class="resource-badge">GPC ${gpcCount}</span>`);
    si (otherCount) insignias.push(`<span class="resource-badge resource-badge--muted">Otros ${otherCount}</span>`);

    constante tarjeta = documento.createElement("div");
    card.className = `tarjeta-de-recurso ${completado ? "tarjeta-de-recurso--completado" : ""}`;
    card.setAttribute("id-del-tema-de-datos", String(t.id));
    tarjeta.innerHTML = `
      <div class="tarjeta-de-recursos__top">
        <div class="tarjeta-de-recurso__meta">
          <div class="resource-card__specialty">${escapeHtml(spLabel)}</div>
          <div class="resource-card__title">${escapeHtml(t.title)}</div>
        </div>
        <button clase="btn btn-primary btn-sm tarjeta-de-recursos__abierta" tipo="botón" id-de-tema-de-datos="${escapeHtml(
          Cadena(t.id)
        )}">Abrir</button>
      </div>
      <div class="resource-card__badges">${insignias.join("")}</div>
    `;

    frag.appendChild(tarjeta);
  });

  listaEl.innerHTML = "";
  listaEl.appendChild(fragmento);
}

función renderTopicDetail(tema) {
  const spLabel = specialtyLabelFromKey(tema.specialtyKey);
  const grupos = buildLinkGroups(tema);

  // ✅ Al abrir el tema: cargar vista previa AUTOMÁTICO del primer PDF (visor, sin descargar)
  si (!_selectedOpenUrl) {
    const firstPdf = grupos.pdf[0]?.url || "";
    si (primerPdf) {
      _selectedOpenUrl = makeOpenUrl(primerPdf);
      _selectedPreviewUrl = makePreviewUrl(primerPdf);
    } demás {
      _selectedOpenUrl = "";
      _selectedPreviewUrl = "";
    }
  }

  // Si no hay PDF, aseguramos que no intentaremos previsualizar nada
  si (!grupos.pdf.longitud) {
    _selectedOpenUrl = "";
    _selectedPreviewUrl = "";
  }

  const completado = isTopicCompleted(tema.id);

  // Helpers de botones (sin textos extra)
  const newTabLinks = (elementos) =>
    (elementos || [])
      .mapa(
        (l) => `
      <a clase="btn btn-outline btn-sm btn-external" href="${escapeHtml(makeOpenUrl(l.url))}" objetivo="_blank" rel="noopener noreferrer">
        ${escapeHtml(l.label)} <span class="btn-external__icon" aria-hidden="true">↗</span>
      </a>
    `
      )
      .unirse("");

  // Resúmenes: abrir en pestaña nueva
  const resumenLinks = newTabLinks(grupos.resumen);

  // PDF: botones de vista previa
  const previewButtons = (elementos) =>
    (elementos || [])
      .mapa(
        (l) => `
      <botón
        clase="btn btn-outline btn-sm btn-preview"
        vista previa de datos-url="${escapeHtml(l.url)}"
        tipo="botón"
        aria-pressed="falso"
      >${escapeHtml(l.label)}</button>
    `
      )
      .unirse("");

  const pdfBtns = previewButtons(grupos.pdf);

  // GPC/Otros: NO se previsualizan. Solo pestaña nueva.
  const gpcLinks = newTabLinks(grupos.gpc);
  const otherLinks = newTabLinks(grupos.otro);

  constante previewBlock = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:14px;">Vista previa</div>
          Vista previa (PDF)
        </div>

        <a
          id="recursos-para-estudiantes-abrir-nueva-pestaña"
          clase="btn btn-primary btn-sm oculto"
          href="#"
          objetivo="_en blanco"
          rel="sin abridor ni referenciador"
        >
          Abrir PDF
        </a>
      </div>

      <división
        id="cuadro de vista previa de recursos para estudiantes"
        clase="oculto"
        estilo="margen superior:12px; ancho:100%; alto:70vh; radio del borde:12px; desbordamiento:oculto; borde:1px sólido #e5e7eb; posición:relativa;"
      >
        <división
          id="vista previa de recursos para estudiantes"
          clase="oculto"
          estilo="posición:absoluta; recuadro:0; visualización:flexible; alinear elementos:centrar; justificar contenido:centrar; fondo:rgba(255,255,255,.85); índice z:2; peso de fuente:700;"
        >
          Cargando…
        </div>

        <iframe
          id="marco de vista previa de recursos para estudiantes"
          título="Vista previa"
          src="acerca de:en blanco"
          estilo="ancho:100%;alto:100%;borde:0;"
          cargando="ansioso"
        ></iframe>
      </div>
    </div>
  `;

  // ✅ Un solo bloque "Recursos" sin textos extra / sin paréntesis.
  // Orden: PDFs (vista previa) -> Resúmenes -> GPC -> Otros
  const allButtons = [pdfBtns, resumenLinks, gpcLinks, otrosLinks].filter(Boolean).join("");

  constante recursosPanel = `
    <div class="tarjeta recurso-tarjeta-unificada" style="margin-top:12px;">
      <div class="resource-unified-card__header">
        <div class="resource-unified-card__title">Recursos</div>
      </div>
      <div class="tarjeta-unificada-de-recursos__body">
        <div class="botones-unificados-de-recursos">
          ${todos los botones || `<div class="panel-subtitle">No hay recursos en este tema.</div>`}
        </div>
      </div>
    </div>
  `;

  listEl.classList.remove("cuadrícula-de-recursos");

  listaEl.innerHTML = `
    <div clase="tarjeta" estilo="relleno:14px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="ancho mínimo:240px;">
          <div class="panel-subtitle">${escapeHtml(spLabel)}</div>
          <div style="font-weight:800;font-size:18px; margin-top:4px;">${escapeHtml(tema.título)}</div>
          ${completado ? `<div style="margin-top:10px;"><span class="resource-detail-chip">✓ Completado</span></div>` : ``}
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button id="student-resources-back" class="btn btn-outline btn-sm" type="button">← Volver</button>
          <button id="recursos-para-estudiantes-completos" class="btn ${completado ? "btn-outline" : "btn-primary"} btn-sm" type="button">
            ${completado? "Marcar como no completado" : "Marcar como completado"}
          </botón>
        </div>
      </div>
    </div>

    ${previewBlock}
    ${resourcesPanel}

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:700;font-size:14px;">Mini-examen del tema</div>
      <div class="panel-subtitle" style="margin-top:4px;">Resuelve un caso clínico con preguntas de este tema.</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="student-resources-start-topic-exam" class="btn btn-primary btn-sm" type="button">Iniciar mini-examen</button>
      </div>
    </div>

  `;

  vista previa en cachéDomRefs();

  // Marca inicial activa (si existe) - SOLO PDFs
  si (_selectedOpenUrl && grupos.pdf.length) {
    const firstRaw = grupos.pdf[0]?.url || "";
    si (firstRaw) {
      const matchBtn = listEl.querySelector(`button[data-preview-url="${CSS.escape(firstRaw)}"]`);
      si (matchBtn) matchBtn.setAttribute("aria-pressed", "verdadero");
    }
  }

  programarPreviewUpdate();
}
