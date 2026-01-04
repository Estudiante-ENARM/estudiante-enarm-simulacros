/****************************************************
 * estudiante.js (CORREGIDO)
 ****************************************************/
importar { auth, db } desde "./firebase-config.js";

importar {
  enAuthStateChanged,
  desconectar,
} de "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

importar {
  recopilación,
  doc,
  obtenerDoc,
  obtenerDocs,
  consulta,
  dónde,
  Ordenar por,
  establecerDoc,
  marca de tiempo del servidor,
  matrizUnion,
} de "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

importar {
  ESPECIALIDADES,
  SUBTIPOS,
  DIFICULTADES,
  DIFICULTAD_PESOS,
  REGLAS_DE_EXAMEN_PREDETERMINADAS,
} de "./shared-constants.js";

// ✅ Biblioteca de Resúmenes/GPC (2° proyecto Firebase)
importar {
  initStudentResourcesUI,
  activarRecursosEstudiantiles,
  establecerIdentidadDeUsuarioDeRecursosDeEstudiante,
} de "./student-resources.js";

/****************************************************
 * ETIQUETAS
 ****************************************************/
const ETIQUETAS_DE_ESPECIALIDAD = ESPECIALIDADES || {};
constante SUBTIPO_ETIQUETAS = SUBTIPOS || {};
const ETIQUETAS_DE_DIFICULTAD = DIFICULTADES || {};

/****************************************************
 *DOM
 ****************************************************/
// Diseño / navegación
constante barra lateral = document.getElementById("barra lateral");
constante btnToggleSidebar = document.getElementById("btn-toggle-sidebar");

const btnMiniExamsSidebar = document.getElementById("estudiante-mini-examenes-btn");
const sidebarSections = document.getElementById("secciones-de-la-barra-lateral-del-estudiante");
const btnProgressView = document.getElementById("progreso-del-estudiante-btn");

// ✅ botón Biblioteca
const btnResourcesView = document.getElementById("recursos-para-estudiantes-btn");

const socialButtons = document.querySelectorAll(".icono-social");

// Encabezado
const studentUserEmailSpan = document.getElementById("correo electrónico del usuario del estudiante");
const btnLogout = document.getElementById("estudiante-btn-logout");

// Vistas principales
const miniBuilderView = document.getElementById("vista-de-mini-examenes-de-estudiante");
const miniExamPlaceholderView = document.getElementById("estudiante-mini-examen-vista");
const examsView = document.getElementById("vista-examenes-estudiante");
const examDetailView = document.getElementById("vista-detalle-del-examen-del-estudiante");
const progressView = document.getElementById("vista-del-progreso-del-estudiante");

// ✅ vista Biblioteca
const recursosView = document.getElementById("vista-de-recursos-del-estudiante");

// Mini examen (constructor)
const miniNumQuestionsSelect = document.getElementById("estudiante-mini-num-preguntas");
const miniSpecialtyCheckboxes = document.querySelectorAll(".mini-especialidad-del-estudiante");
const miniRandomCheckbox = document.getElementById("estudiante-mini-random");
constante miniRandomToggleBtn = documento.querySelector(
  '#student-mini-exams-view label.mini-random-toggle[for="student-mini-random"]'
);
const miniStartBtn = document.getElementById("estudiante-mini-start-btn");

// Exámenes por sección
const sectionTitle = document.getElementById("estudiante-título-sección-actual");
const sectionSubtitle = document.getElementById("estudiante-sección-actual-subtítulo");
const examsList = document.getElementById("lista-de-examenes-de-estudiantes");

// Detalle de examen
const btnBackToExams = document.getElementById("estudiante-btn-volver-a-los-examenes");
const examTitle = document.getElementById("titulo-del-examen-del-estudiante");
const examSubtitle = document.getElementById("subtitulo-examen-estudiante");
const examTimerEl = document.getElementById("temporizador-de-examen-del-estudiante");
const examMetaText = document.getElementById("meta-texto-del-examen-del-estudiante");
const questionsList = document.getElementById("lista-de-preguntas-del-estudiante");
const btnSubmitExam = document.getElementById("estudiante-btn-enviar-examen");

// Resultados
const resultBanner = document.getElementById("banner-de-resultados-del-estudiante");
const resultValues ​​= document.getElementById("valores-de-resultados-del-estudiante");

// Progreso
const progressUsername = document.getElementById("nombre-de-usuario-de-progreso-del-estudiante");
const progressSectionsContainer = document.getElementById("secciones-de-progreso-del-estudiante");
const progressGlobalEl = document.getElementById("progreso-del-estudiante-global");
const progressChartCanvas = document.getElementById("gráfico-de-progreso-del-estudiante");

deje que progressChartInstance = null;

// Biblioteca (2° proyecto Firebase)
deje que recursosActivadosOnce = falso;

// ✅ Mini-examen por tema (Biblioteca)
ventana.addEventListener("estudiante:openTopicExam", (e) => {
  intentar {
    const detalle = e?.detalle || {};
    si (!detalle.casos || !Array.isArray(detalle.casos)) devolver;
    startTopicExamFromResources(detalle);
  } atrapar (err) {
    consola.error(err);
  }
});

/****************************************************
 * ESTADO
 ****************************************************/
deje que currentUser = null;
deje que currentUserProfile = null;

deje que examRules = {
  IntentosMáximos: ¿REGLAS_DE_EXAMEN_PREDETERMINADAS?.IntentosMáximos || 3,
  tiempoPorPreguntaSegundos: ¿REGLAS_DE_EXAMEN_PREDETERMINADAS?.tiempoPorPreguntaSegundos || 90,
};

deje que currentView = "sección";
deje que currentSectionId = nulo;
deje que currentSectionName = null;

deje que currentExamMode = null; // "sección" | "mini"
deje que currentExamId = nulo;
deje que currentExamQuestions = [];
deje que currentExamTotalSeconds = 0;
deje que currentExamTimerId = nulo;
deje que currentExamPreviousAttempts = 0;

// Mini exámenes
deje miniCasesCache = [];

// Tokens anti-superposición
deje que examsLoadToken = 0;
deje que progressLoadToken = 0;

/****************************************************
 * UTILIDADES
 ****************************************************/
función show(el) {
  si (el) el.classList.remove("oculto");
}
función ocultar(el) {
  si (el) el.classList.add("oculto");
}


función setSidebarSectionsVisible(visible) {
  si (!sidebarSections) retorna;
  si (visible) sidebarSections.classList.remove("oculto");
  de lo contrario sidebarSections.classList.add("oculto");
}
sea ​​_examsMenuOpen = falso;


función formatMinutesFromSeconds(totalSeconds) {
  const minutos = Math.ceil(totalSeconds / 60);
  devolver `${minutos} min`;
}

función formatTimer(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  devuelve `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

función toFixedNice(num, decimales = 2) {
  si (!isFinite(num)) devuelve "0";
  devuelve Número(num.toFixed(decimales)).toString();
}

función renderEmptyMessage(contenedor, texto) {
  si (!contenedor) retorna;
  contenedor.innerHTML = `
    <div class="card" style="padding:12px 14px;font-size:13px;color:#9ca3af;">
      ${texto}
    </div>
  `;
}

función svgIcon(tipo) {
  si (tipo === "preguntas") {
    regresar `
      <svg ancho="28" alto="28" viewBox="0 0 24 24" relleno="ninguno" trazo="#3b82f6" ancho-trazo="1.7" límite-línea-trazo="redondo" unión-línea-trazo="redondo">
        <rect x="4" y="4" ancho="16" alto="16" rx="2"></rect>
        <línea x1="8" y1="9" x2="16" y2="9"></línea>
        <línea x1="8" y1="13" x2="13" y2="13"></línea>
        <circle cx="9" cy="17" r="0.8"></circle>
      </svg>`;
  }
  si (tipo === "tiempo") {
    regresar `
      <svg ancho="28" alto="28" viewBox="0 0 24 24" relleno="ninguno" trazo="#0ea5e9" ancho-trazo="1.7" límite-línea-trazo="redondo" unión-línea-trazo="redondo">
        <circle cx="12" cy="13" r="7"></circle>
        <polyline points="12 10 12 13 15 15"></polyline>
        <línea x1="9" y1="4" x2="15" y2="4"></línea>
      </svg>`;
  }
  si (tipo === "intentos") {
    regresar `
      <svg ancho="28" alto="28" viewBox="0 0 24 24" relleno="ninguno" trazo="#22c55e" ancho-trazo="1.7" límite-línea-trazo="redondo" unión-línea-trazo="redondo">
        <ruta d="M12 2v3"></ruta>
        <ruta d="M5.2 5.2l2.1 2.1"></ruta>
        <ruta d="M18.8 5.2l-2.1 2.1"></ruta>
        <circle cx="12" cy="14" r="6"></circle>
        <ruta d="M10 14l2 2 3-3"></ruta>
      </svg>`;
  }
  devolver "";
}

/****************************************************
 *PERSISTENCIA (REFRESH + ATRÁS)
 ****************************************************/
sea ​​isRestoringState = falso;

// Examinar en curso (para actualizar)
deje que currentExamEndAtMs = null; // marca de tiempo ms
deje que currentExamAnswers = {}; // { [qIndex:número]: "A"|"B"|"C"|"D" }

función normalizarTexto(s) {
  devuelve cadena(s || "")
    .normalizar("NFD")
    .reemplazar(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .reemplazar(/[_-]+/g, " ")
    .reemplazar(/\s+/g, " ")
    .recortar();
}

función getStudentStorageKey(sufijo) {
  const email = usuarioActual?.email || "anónimo";
  devuelve `enarm_student_${suffix}_${encodeURIComponent(email)}`;
}

función safeJsonParse(str, fallback = null) {
  intentar {
    devuelve JSON.parse(str);
  } atrapar {
    retorno de reserva;
  }
}

función leerEstadoEstudiante() {
  si (!currentUser) devuelve nulo;
  const raw = localStorage.getItem(getStudentStorageKey("estado"));
  devuelve safeJsonParse(raw, null);
}

función escribirEstadoEstudiante(siguiente) {
  si (!currentUser) retorna;
  localStorage.setItem(getStudentStorageKey("estado"), JSON.stringify(siguiente));
}

función patchStudentState(parche) {
  const prev = leerEstadoEstudiante() || {};
  constante siguiente = { ...prev, ...patch };
  escribirEstadoEstudiante(siguiente);
  volver a continuación;
}

función clearStudentExamState() {
  si (!currentUser) retorna;
  const prev = leerEstadoEstudiante() || {};
  constante siguiente = { ...prev };
  eliminar next.exam;
  // Nota: NO borramos view/section para que el usuario vuelva donde estaba.
  escribirEstadoEstudiante(siguiente);
  borrarAlmacenamientoDeRespuestasDeExamen();
}

función pushHistoryState(nav, { reemplazar = falso } = {}) {
  si (isRestoringState) retorna;
  constante carga útil = { studentNav: nav };
  intentar {
    si (reemplazar) history.replaceState(payload, "");
    de lo contrario history.pushState(carga útil, "");
  } atrapar (err) {
    console.warn("No se pudo escribir story state:", err);
  }
}

función persistViewState(vista) {
  parcheEstadoEstudiante({
    vista,
    sectionId: currentSectionId || nulo,
    nombreDeSección: nombreDeSecciónActual || null,
  });
  pushHistoryState({ vista, sectionId: currentSectionId || null, examen: null });
}

función construirCurrentExamState() {
  devolver {
    modo: currentExamMode || nulo,
    examId: currentExamId || nulo,
    Nombre del examen: Título del examen?.Contenido del texto || "",
    totalSeconds: totalSecondsdelexamenactual || 0,
    endAtMs: currentExamEndAtMs || nulo,
    sectionId: currentSectionId || nulo,
    nombreDeSección: nombreDeSecciónActual || null,
    Preguntas: Array.isArray(currentExamQuestions) ? currentExamQuestions : [],
    respuestas: currentExamAnswers || {},
    guardadoEnMs: Fecha.ahora(),
  };
}

/** ✅ CORREGIDO: se cerraba mal y “encerraba” helpers */
función persistCurrentExamState({ replaceHistory = false } = {}) {
  examen constante = buildCurrentExamState();
  parcheEstadoEstudiante({
    vista: "examen",
    sectionId: examen.sectionId,
    sectionName: examen.sectionName,
    examen,
  });
  pushHistoryState(
    { vista: "examen", sectionId: exam.sectionId || null, examen },
    { reemplazar: reemplazarHistorial }
  );
}

/****************************************************
 * STORAGE RESPUESTAS (CORREGIDO: fuera de persistCurrentExamState)
 ****************************************************/
función obtenerClaveDeAlmacenamientoDeRespuestasDeExamen() {
  devolver getStudentStorageKey("respuestas_del_examen");
}

función leerRespuestasDeExamenDesdeAlmacenamiento() {
  si (!currentUser) devuelve {};
  constante raw = localStorage.getItem(getExamAnswersStorageKey());
  devolver safeJsonParse(raw, {}) || {};
}

función escribirRespuestasDeExamenAlAlmacenamiento(respuestas) {
  si (!currentUser) retorna;
  localStorage.setItem(getExamAnswersStorageKey(), JSON.stringify(respuestas || {}));
}

función clearExamAnswersStorage() {
  si (!currentUser) retorna;
  localStorage.removeItem(obtenerClaveDeAlmacenamientoDeRespuestasDeExamen());
}

función restaurarRespuestasAlDOM() {
  si (!preguntasList) retorna;
  const respuestas = currentExamAnswers || {};
  Objeto.keys(respuestas).forEach((k) => {
    const idx = Número(k);
    const val = respuestas[k];
    si (!Number.isFinite(idx) || !val) retorna;
    const input = document.querySelector(`input[nombre="q_${idx}"][valor="${val}"]`);
    si (entrada) entrada.checked = verdadero;
  });
}

función renderExamQuestionsFromCurrentState() {
  si (!preguntasList) retorna;

  preguntasList.innerHTML = "";

  si (!Array.isArray(preguntasdelexamenactual) ||preguntasdelexamenactual.length === 0) {
    renderEmptyMessage(questionsList, "No se han cargado preguntas.");
    devolver;
  }

  sea ​​globalIndex = 0;
  deje que caseIndex = 0;

  deje que activeCaseText = null;
  deje que activeCaseSpecialty = null;
  deje que caseBlock = null;
  deje que questionsWrapper = null;
  deje que localIndex = 0;

  PreguntasDeExamenActuales.paraCada((q) => {
    const caseText = q.caseText || "";
    const specialityKey = q.specialty || nulo;

    si (caseText! == activeCaseText) {
      // cierra caso anterior
      si (caseBlock && questionsWrapper) {
        caseBlock.appendChild(preguntasWrapper);
        preguntasList.appendChild(caseBlock);
      }

      // abre nuevo caso
      índice de caso += 1;
      activeCaseText = textoCaso;
      activeCaseSpecialty = claveEspecialidad;
      índice local = 0;

      caseBlock = documento.createElement("div");
      caseBlock.className = "bloque-de-caso";

      caseBlock.innerHTML = `
        <h4>Caso clínico ${caseIndex}</h4>
        <div class="case-text">${caseText}</div>
      `;

      preguntasWrapper = document.createElement("div");
    }

    constante idx = índice global;

    const difficultLabel = DIFFICULTY_LABELS[q.difficulty] || "No definida";
    const subtypeLabel = SUBTYPE_LABELS[q.subtype] || "General";
    constante specialityLabel =
      ETIQUETAS_ESPECIALES[especialidad_de_caso_activo] ||
      Especialidad de caso activo ||
      "No definida";

    constante qBlock = documento.createElement("div");
    qBlock.className = "bloque-de-preguntas";
    qBlock.conjunto de datos.qIndex = idx;

    qBlock.innerHTML = `
      <h5>Pregunta ${localIndex + 1}</h5>
      <p>${q.questionText || ""}</p>

      <div class="panel-subtitle question-meta" style="font-size:12px;margin-bottom:8px;display:none;">
        Especialidad: <strong>${specialtyLabel}</strong> ·
        Tipo: <strong>${subtypeLabel}</strong> ·
        Dificultad: <strong>${difficultyLabel}</strong>
      </div>

      <div class="opciones-de-pregunta">
        <label><tipo de entrada="radio" nombre="q_${idx}" valor="A"> A) ${q.optionA || ""}</label>
        <label><tipo de entrada="radio" nombre="q_${idx}" valor="B"> B) ${q.optionB || ""}</label>
        <label><tipo de entrada="radio" nombre="q_${idx}" valor="C"> C) ${q.optionC || ""}</label>
        <label><tipo de entrada="radio" nombre="q_${idx}" valor="D"> D) ${q.optionD || ""}</label>
      </div>

      <div class="cuadro de justificación">
        <strong>Justificación:</strong><br>
        ${q.justificación || ""}
      </div>
    `;

    preguntasWrapper.appendChild(qBlock);
    índice global += 1;
    índice local += 1;
  });

  // último caso
  si (caseBlock && questionsWrapper) {
    caseBlock.appendChild(preguntasWrapper);
    preguntasList.appendChild(caseBlock);
  }
}

función asíncrona restoreExamFromState(examState, { replaceHistory = false } = {}) {
  si (!estadoExamen || !Array.isArray(estadoExamen.preguntas) || estadoExamen.preguntas.longitud === 0) {
    devuelve falso;
  }

  // restaurante estado base
  modoExamenActual = EstadoExamen.modo || nulo;
  currentExamId = examState.examId || nulo;
  SegundosTotalesdelExamenActual = Número(EstadoDelExamen.SegundosTotales) || 0;
  currentExamEndAtMs = Número(examState.endAtMs) || nulo;
  PreguntasDeExamenActuales = EstadoDeExamen.preguntas || [];
  // Respuestas: siempre priorizamos el almacenamiento separado
  respuestasDeExamenActuales = leerRespuestasDeExamenDesdeAlmacenamiento();
  IntentosAnterioresdelExamenActual = 0;

  si (examState.sectionId) currentSectionId = examState.sectionId;
  si (estadoExamen.nombreSección) nombreSecciónActual = estadoExamen.nombreSección;

  // Interfaz de usuario
  ocultar(examenesView);
  ocultar(progressView);
  ocultar(recursosView);
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  mostrar(examDetailView);

  si (resultBanner) resultBanner.style.display = "ninguno";
  si (valoresResultados) valoresResultados.innerHTML = "";

  títuloexamen.textContent = estadoexamen.nombreexamen || (currentExamMode === "mini" ? "Mini examen personalizado" : "Examen");
  examenSubtítulo.textoContenido =
    modoExamenActual === "mini"
      ? "Mini examen restaurado. Puedes continuar donde lo dejaste."
      : "Examen restaurado. Puedes continuar donde lo dejaste.";

  constante totalPreguntas = PreguntasDeExamenActuales.length || 0;
  constante totalSegundos = totalSegundosExamenActual || 0;

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos: <strong>${currentExamMode === "mini" ? "Sin límite" : "En curso"}</strong>
  `;

  si (btnSubmitExam) {
    btnSubmitExam.disabled = falso;
    btnSubmitExam.style.display = "flexible en línea";
  }

  renderizarPreguntasDeExamenDesdeElEstadoActual();
  restaurarRespuestasADOM();

  // Cronómetro por endAtMs
  startExamTimer(totalSeconds, currentExamEndAtMs);

  // si ya venció, auto-envía
  si (finaldelexamenactualenMs && Fecha.ahora() >= finaldelexamenactualenMs) {
    intentar {
      si (currentExamTimerId) {
        clearInterval(currentExamTimerId);
        currentExamTimerId = nulo;
      }
      if (examTimerEl) examTimerEl.textContent = "00:00";
      alert("El tiempo se agotó mientras estabas fuera, tu examen se enviará automáticamente.");
      persistCurrentExamState({reemplazarHistorial: verdadero});
      esperar enviarExamenParaEstudiante(verdadero);
    } atrapar (err) {
      console.error("Error auto-enviando examen restaurado:", err);
    }
  }

  // persiste (para actualizar consecutivamente)
  persistCurrentExamState({ reemplazarHistorial });

  devuelve verdadero;
}

función asíncrona restoreStudentStateAfterInit() {
  si (!currentUser) devuelve falso;

  constante estado = leerEstadoEstudiante();
  si (!estado) devuelve falso;

  isRestoringState = verdadero;
  intentar {
    si (estado.examen) {
      const ok = await restoreExamFromState(estado.examen, { replaceHistory: true });
      si (ok) devuelve verdadero;
    }

    const vista = estado.vista || "sección";
    si (vista === "recursos") {
      esperar switchToResourcesView({ restaurar: verdadero });
      pushHistoryState({ vista: "recursos", sectionId: estado.sectionId || null, examen: null }, { reemplazar: true });
      devuelve verdadero;
    }
    si (vista === "progreso") {
      esperar switchToProgressView({ restaurar: verdadero });
      pushHistoryState({ vista: "progreso", sectionId: estado.sectionId || null, examen: null }, { reemplazar: true });
      devuelve verdadero;
    }
    si (vista === "mini") {
      switchToMiniView({ restaurar: verdadero });
      pushHistoryState({ vista: "mini", sectionId: estado.sectionId || null, examen: null }, { reemplazar: true });
      devuelve verdadero;
    }

    switchToSectionView({ restaurar: verdadero });
    pushHistoryState({ vista: "sección", sectionId: estado.sectionId || null, examen: null }, { reemplazar: true });
    devuelve verdadero;
  } atrapar (err) {
    console.error("Error restaurante estado del estudiante:", err);
    devuelve falso;
  } finalmente {
    isRestoringState = falso;
  }
}

// Soporte al gesto/botón "Atrás" en móviles
ventana.addEventListener("popstate", async (e) => {
  si (!currentUser) retorna;
  const nav = e.state?.studentNav;
  si (!nav) retorna;

  isRestoringState = verdadero;
  intentar {
    si (nav.examen) {
      esperar restaurarExamFromState(nav.exam, { reemplazarHistorial: verdadero });
      devolver;
    }

    si (nav.view === "recursos") {
      esperar switchToResourcesView({ restaurar: verdadero });
      devolver;
    }
    si (nav.view === "progreso") {
      esperar switchToProgressView({ restaurar: verdadero });
      devolver;
    }
    si (nav.view === "mini") {
      switchToMiniView({ restaurar: verdadero });
      devolver;
    }
    switchToSectionView({ restaurar: verdadero });
  } atrapar (err) {
    console.error("Error al aplicar popstate estudiante:", err);
  } finalmente {
    isRestoringState = falso;
  }
});

/****************************************************
 * ESTUDIANTE AUTORIZADO
 ****************************************************/
onAuthStateChanged(auth, async (usuario) => {
  si (!usuario) {
    ventana.ubicación.href = "index.html";
    devolver;
  }

  intentar {
    const userRef = doc(db, "usuarios", usuario.email);
    constante snap = await getDoc(userRef);

    si (!snap.existe()) {
      alert("Tu usuario no está configurado en Firestore. Contacta al administrador.");
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
      devolver;
    }

    constante datos = snap.data();

    if (datos.rol !== "usuario") {
      alert("Este panel es solo para estudiantes.");
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
      devolver;
    }

    si (datos.estado && datos.estado !== "activo") {
      alert("Tu usuario está inactivo. Contacta al administrador.");
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
      devolver;
    }

    const hoy = nueva Fecha().toISOString().slice(0, 10);
    si (datos.fechadevencimiento && datos.fechadevencimiento < hoy) {
      alert("Tu acceso ha vencido. Contacta al administrador.");
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
      devolver;
    }

    usuarioActual = usuario;
    currentUserProfile = datos;

    // Biblioteca: identidad por usuario para progreso local
    intentar {
      setStudentResourcesUserIdentity(usuario.correo electrónico);
    } captura (e) {
      console.warn("No se pudo establecer identidad de biblioteca:", e);
    }

    si (estudianteUsuarioEmailSpan) {
      StudentUserEmailSpan.textContent = usuario.correo electrónico;
    }

    esperar loadExamRules();
    esperar cargaSocialLinksForStudent();
    espere cargarSeccionesParaEstudiante();

    // ✅ prepara UI de Biblioteca (sin cargar datos aún)
    initStudentResourcesUI();

    // ✅ Restaurar última vista
    constante restaurada = esperar restaurarStudentStateAfterInit();
    si (!restaurado) {
      cambiarAVistaDeSección();
    }
  } atrapar (err) {
    console.error("Error validando usuario estudiante", err);
    alert("Error validando tu acceso. Intenta más tarde.");
    esperar signOut(auth);
    ventana.ubicación.href = "index.html";
  }
});

/****************************************************
 * OYENTES GENERALES
 ****************************************************/
si (btnToggleSidebar) {
  btnToggleSidebar.addEventListener("clic", () => {
    si (barra lateral) barra lateral.classList.toggle("barra lateral--abrir");
  });
}

si (btnCerrar sesión) {
  btnLogout.addEventListener("clic", async () => {
    intentar {
      esperar signOut(auth);
      ventana.ubicación.href = "index.html";
    } atrapar (err) {
      consola.error(err);
      alert("No se pudo cerrar sesión. Intento de nuevo.");
    }
  });
}

si (btnMiniExamsSidebar) {
  btnMiniExamsSidebar.addEventListener("clic", () => {
    cambiarAMiniView();
  });
}

si (btnExamsSidebar) {
  btnExamsSidebar.addEventListener("clic", () => {
    _examsMenuOpen = !_examsMenuOpen;
    setSidebarSectionsVisible(_examsMenuOpen);
    cambiarAVistaDeSección();
  });
}


// Biblioteca
si (btnResourcesView) {
  btnResourcesView.addEventListener("clic", () => {
    cambiarAVistaDeRecursos();
  });
}

si (btnProgressView) {
  btnProgressView.addEventListener("clic", () => {
    cambiarAProgressView();
  });
}

si (miniStartBtn) {
  miniStartBtn.addEventListener("clic", () => {
    iniciarMiniExamFromBuilder();
  });
}

si (btnVolverAExámenes) {
  btnBackToExams.addEventListener("clic", () => {
    manejarRegresarDesdeExamen();
  });
}

si (btnSubmitExam) {
  btnSubmitExam.addEventListener("clic", () => submitExamForStudent(falso));
}

// ✅ Persistir respuestas seleccionadas
si (preguntasList && !preguntasList.conjuntodedatos.respuestasBound) {
  preguntasList.dataset.answersBound = "1";
  preguntasList.addEventListener("cambio", (e) => {
    constante objetivo = e.objetivo;
    si (!objetivo || !objetivo.coincidencias || !objetivo.coincidencias('input[type="radio"]')) devolver;

    const nombre = objetivo.getAttribute("nombre") || "";
    si (!nombre.startsWith("q_")) retorna;

    const idx = Número(nombre.slice(2));
    si (!Number.isFinite(idx)) retorna;

    respuestasdelexamenactuales = respuestasdelexamenactuales || {};
    currentExamAnswers[idx] = objetivo.valor;

    // ✅ CORREGIDO: guardar también en almacenamiento
    escribirRespuestasDeExamenAlAlmacenamiento(RespuestasDeExamenActuales);

    si (modoDeExamenActual && PreguntasDeExamenActuales && PreguntasDeExamenActuales.longitud) {
      persistCurrentExamState({reemplazarHistorial: verdadero});
    }
  });
}

/* chips especialidades mini examen (robusto) */
constante miniSpecialtiesGrid = documento.querySelector(
  "#vista-de-mini-exámenes-para-estudiantes .cuadrícula-de-mini-especialidades"
);

función syncMiniSpecialtyChip(chipEl, cbEl) {
  si (!chipEl || !cbEl) retorna;
  chipEl.classList.toggle("mini-chip-especial--activo", !!cbEl.checked);
  chipEl.setAttribute("aria-pressed", cbEl.checked ? "true" : "false");
}

función initMiniSpecialtyChips() {
  si (!miniSpecialtiesGrid) retorna;

  miniSpecialtiesGrid.querySelectorAll(".mini-specialty-chip").forEach((chip) => {
    const cb = chip.querySelector("input.estudiante-mini-especialidad");
    si (!cb) retorna;
    si (!chip.hasAttribute("tabindex")) chip.setAttribute("tabindex", "0");
    chip.setAttribute("rol", "botón");
    syncMiniSpecialtyChip(chip, cb);
  });

  si (miniSpecialtiesGrid.dataset.bound === "1") devolver;
  miniSpecialtiesGrid.dataset.bound = "1";

  miniSpecialtiesGrid.addEventListener("clic", (e) => {
    const chip = e.target.closest(".mini-chip-especializado");
    si (!chip || !miniSpecialtiesGrid.contains(chip)) devolver;

    si (e.objetivo && e.objetivo.coincidencias && e.objetivo.coincidencias("input.mini-especialidad-del-estudiante")) {
      constante cb = e.objetivo;
      syncMiniSpecialtyChip(chip, cb);
      devolver;
    }

    e.preventDefault();
    const cb = chip.querySelector("input.estudiante-mini-especialidad");
    si (!cb) retorna;

    cb.checked = !cb.checked;
    syncMiniSpecialtyChip(chip, cb);
  });

  miniSpecialtiesGrid.addEventListener("keydown", (e) => {
    si (e.key !== "Enter" && e.key !== " ") devolver;

    const chip = e.target.closest(".mini-chip-especializado");
    si (!chip || !miniSpecialtiesGrid.contains(chip)) devolver;

    e.preventDefault();
    const cb = chip.querySelector("input.estudiante-mini-especialidad");
    si (!cb) retorna;

    cb.checked = !cb.checked;
    syncMiniSpecialtyChip(chip, cb);
  });

  miniSpecialtiesGrid.querySelectorAll("input.mini-especialidad-del-estudiante").forEach((cb) => {
    cb.addEventListener("cambio", () => {
      const chip = cb.closest(".mini-chip-especial");
      si (chip) syncMiniSpecialtyChip(chip, cb);
    });
  });
}

initMiniSpecialtyChips();

/* alternar mini examen aleatorio */
si (miniRandomCheckbox) {
  constante syncRandom = () => {
    si (miniRandomToggleBtn) {
      miniRandomToggleBtn.setAttribute(
        "aria-prensada",
        miniRandomCheckbox.checked ? "verdadero" : "falso"
      );
    }
  };
  sincronización aleatoria();
  miniRandomCheckbox.addEventListener("cambio", syncRandom);
}

función asíncrona asegurarStudentResourcesActivated() {
  initStudentResourcesUI();
  si (recursosActivadosUna vez) retorna;
  esperar activarRecursosEstudiantiles();
  recursosActivadosUna vez = verdadero;
}

/****************************************************
 * CAMBIO DE VISTAS
 ****************************************************/
función switchToMiniView(opts = {}) {
  _examsMenuOpen = falso;
  setSidebarSectionsVisible(falso);

  vistaActual = "mini";
  ocultar(examenesView);
  ocultar(examDetailView);
  ocultar(progressView);
  ocultar(recursosView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  mostrar(miniBuilderView);
  initMiniSpecialtyChips();
  si (barra lateral) barra lateral.classList.remove("barra lateral--abrir");
  si (!opts.restore) persistViewState("mini");
}

función switchToSectionView(opts = {}) {
  _examsMenuOpen = falso;
  setSidebarSectionsVisible(falso);

  currentView = "sección";
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  ocultar(examDetailView);
  ocultar(progressView);
  ocultar(recursosView);
  mostrar(examenesView);
  si (barra lateral) barra lateral.classList.remove("barra lateral--abrir");
  si (!opts.restore) persistViewState("sección");
}

// Vista Biblioteca
función asíncrona switchToResourcesView(opts = {}) {
  _examsMenuOpen = falso;
  setSidebarSectionsVisible(falso);

  currentView = "recursos";
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  ocultar(examenesView);
  ocultar(examDetailView);
  ocultar(progressView);
  mostrar(recursosView);
  si (barra lateral) barra lateral.classList.remove("barra lateral--abrir");

  si (!opts.restore) persistViewState("recursos");

  intentar {
    esperar asegurarStudentResourcesActivated();
  } atrapar (err) {
    console.error("Error al activar la biblioteca:", err);
  }
}

función asíncrona switchToProgressView(opts = {}) {
  _examsMenuOpen = falso;
  setSidebarSectionsVisible(falso);

  currentView = "progreso";
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  ocultar(examenesView);
  ocultar(examDetailView);
  ocultar(recursosView);
  mostrar(progressView);
  si (barra lateral) barra lateral.classList.remove("barra lateral--abrir");

  si (!opts.restore) persistViewState("progreso");
  esperar loadStudentProgress();
}

/****************************************************
 * CONFIGURACIÓN GLOBAL
 ****************************************************/
función asíncrona loadExamRules() {
  intentar {
    const snap = await getDoc(doc(db, "reglasdelexamen", "predeterminado"));
    si (!snap.exists()) retorna;

    constante datos = snap.data();
    si (tipo de datos.maxAttempts === "número") examRules.maxAttempts = datos.maxAttempts;
    si (tipo de datos.timePerQuestionSeconds === "número") examRules.timePerQuestionSeconds = datos.timePerQuestionSeconds;
  } atrapar (err) {
    console.error("Error al leer examRules/default:", err);
  }
}

/****************************************************
 * REDES SOCIALES
 ****************************************************/
función asíncrona loadSocialLinksForStudent() {
  intentar {
    const snap = await getDoc(doc(db, "configuraciones", "socialLinks"));
    si (snap.exists()) {
      constante datos = snap.data();
      botonessociales.paraCada((btn) => {
        constante red = btn.dataset.network;
        si (datos[red]) btn.dataset.url = datos[red];
        de lo contrario elimine btn.dataset.url;
      });
    }
  } atrapar (err) {
    console.error("Error al leer settings/socialLinks:", err);
  }

  botonessociales.paraCada((btn) => {
    btn.addEventListener("clic", () => {
      constante url = btn.dataset.url;
      si (!url) {
        alert("Aún no se ha configurado el enlace de esta red social.");
        devolver;
      }
      ventana.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

función selectSectionForStudent({ id, nombre, li, shouldSwitchView = true }) {
  si (!id) retorna;

  documento
    .querySelectorAll(".sidebar__section-item")
    .forEach((el) => el.classList.remove("sidebar__section-item--active"));

  si (li) li.classList.add("sidebar__section-item--activo");

  currentSectionId = id;
  NombreDeSecciónActual = nombre || "Sección";

  si (títuloDeSección) TítuloDeSección.textoContenido = NombreDeSecciónActual;
  if (sectionSubtitle) sectionSubtitle.textContent = "Simulacros de esta sección.";

  patchStudentState({ sectionId: currentSectionId, sectionName: currentSectionName });

  si (deberíaCambiarVista) cambiarASecciónVista();
  cargarExamenesParaSecciónParaEstudiante(id);
}

/****************************************************
 * SECCIONES (ESTUDIANTE)
 ****************************************************/
función asíncrona loadSectionsForStudent() {
  const qSec = consulta(colección(db, "secciones"), orderBy("orden", "asc"));
  constante snap = esperar getDocs(qSec);

  si (!sidebarSections) retorna;
  sidebarSections.innerHTML = "";

  const EstadoSalvado = leerEstadoEstudiante();
  constante preferredSectionId = savedState?.sectionId || nulo;

  si (snap.vacío) {
    Secciones de la barra lateral.innerHTML = `
      <li style="font-size:12px;color:#cbd5f5;padding:4px 6px;">
        Aún no hay secciones configuradas.
      </li>`;
    renderEmptyMessage(examsList, "No hay exámenes disponibles.");
    devolver;
  }

  deje que firstSectionId = null;
  deje que firstSectionName = null;

  snap.paraCada((docSnap) => {
    constante datos = docSnap.data();
    constante id = docSnap.id;
    nombre constante = nombre.datos || "Sección sin título";

    si (firstSectionId == null) {
      primeraSecciónId = id;
      firstSectionName = nombre;
    }

    constante li = document.createElement("li");
    li.className = "elemento de sección__barra lateral";
    li.dataset.sectionId = id;
    li.innerHTML = `<div class="sidebar__section-name">${nombre}</div>`;

    li.addEventListener("clic", () => {
      selectSectionForStudent({ id, nombre, li, shouldSwitchView: true });
    });

    barra lateralSections.appendChild(li);
  });

  constante targetSectionId =
    IdDeSecciónPreferida y SeccionesDeBarraSide.querySelector(`[idDeSecciónDeDatos="${IdDeSecciónPreferida}"]`)
      ? IdDeSecciónPreferida
      :primerIdDeSección;

  si (targetSectionId) {
    constante liObjetivo =
      sidebarSections.querySelector(`[data-section-id="${targetSectionId}"]`) ||
      sidebarSections.querySelector(".sidebar__section-item");
    constante nombreObjetivo = liObjetivo
      ? liTarget.querySelector(".sidebar__section-name")?.textContent || firstSectionName
      :nombreDePrimeraSección;

    seleccionarSecciónParaEstudiante({
      id: targetSectionId,
      nombre: nombreObjetivo,
      li: liObjetivo,
      shouldSwitchView: falso,
    });
  }
}

/****************************************************
 * EXÁMENES POR SECCIÓN (LISTA OPTIMIZADA)
 ****************************************************/
función asíncrona loadExamsForSectionForStudent(sectionId) {
  const thisToken = ++exámenesLoadToken;

  si (!examsList) retorna;
  ListaExámenes.innerHTML = `
    <div class="tarjeta">
      <p class="panel-subtitle">Cargando solicitudes…</p>
    </div>
  `;

  si (!sectionId) {
    si (thisToken !== examsLoadToken) devolver;
    renderEmptyMessage(examsList, "No se ha seleccionado ninguna sección.");
    devolver;
  }

  intentar {
    const qEx = consulta(colección(db, "exámenes"), donde("sectionId", "==", sectionId));
    constante snap = esperar getDocs(qEx);

    si (esteToken !== examsLoadToken || sectionId !== currentSectionId) devolver;

    si (snap.vacío) {
      renderEmptyMessage(examsList, "No hay exámenes disponibles en esta sección.");
      devolver;
    }

    constante fragmento = documento.createDocumentFragment();

    const examsData = await Promise.all(
      snap.docs.map(async (docSnap) => {
        constante exData = docSnap.data();
        constante examId = docSnap.id;
        const examName = exData.name || "Examen sin título";

        deje que los intentos utilizados sean 0;
        let lastAttemptText = "Sin intentos anteriores.";
        deje totalPreguntas = 0;

        const qQuestions = consulta(colección(db, "preguntas"), donde("examId", "==", examId));

        si (usuarioactual) {
          const attemptRef = doc(db, "usuarios", currentUser.email, "intentosdeexamen", examId);

          const [intentoSnap, qSnap] = await Promise.all([getDoc(intentoRef), getDocs(qQuestions)]);

          si (intentoSnap.existe()) {
            constante en = attemptSnap.data();
            intentosUsados ​​= en.intentos || 0;
            si (en.últimoIntento && tipo de en.últimoIntento.hastaFecha === "función") {
              últimoIntentoTexto = en.últimoIntento.hastaFecha().toLocaleDateString();
            }
          }

          qSnap.paraCada((qDoc) => {
            constante qData = qDoc.data();
            const arr = Array.isArray(qData.preguntas) ? qData.preguntas : [];
            totalPreguntas+= arr.length;
          });
        } demás {
          constante qSnap = await getDocs(qPreguntas);
          qSnap.paraCada((qDoc) => {
            constante qData = qDoc.data();
            const arr = Array.isArray(qData.preguntas) ? qData.preguntas : [];
            totalPreguntas+= arr.length;
          });
        }

        devolver { examId, examName, intentosUsados, lastAttemptText, totalQuestions };
      })
    );

    si (esteToken !== examsLoadToken || sectionId !== currentSectionId) devolver;

    si (!examsData.length) {
      renderEmptyMessage(examsList, "No hay exámenes disponibles en esta sección.");
      devolver;
    }

    constante maxIntentos = reglasdelexamen.maxIntentos;
    constante timePerQuestion = reglasDeExamen.timePerQuestionSeconds;

    examsData.forEach(({ IdExamen, NombreExamen, IntentosUsados, TextoÚltimoIntento, PreguntasTotales }) => {
      si (totalPreguntas === 0) {
        constante tarjeta = documento.createElement("div");
        card.className = "elemento-de-tarjeta";
        tarjeta.innerHTML = `
          <div class="tarjeta-elemento__título-fila">
            <div class="card-item__title">${nombreExamen}</div>
            <span class="badge" style="background:#fbbf24;color:#78350f;">En preparación</span>
          </div>
          <div class="panel-subtitle" style="margin-top:8px;">
            Aún no hay preguntas cargadas para este examen.
          </div>
        `;
        fragmento.appendChild(tarjeta);
        devolver;
      }

      constante totalSegundos = totalPreguntas * tiempoPorPregunta;
      constante totalTimeFormatted = formatMinutesFromSeconds(totalSeconds);
      const deshabilitado = intentos utilizados >= máximo intentos;
      texto de estado constante = deshabilitado? "Sin intentos disponibles" : "Disponible";

      constante tarjeta = documento.createElement("div");
      card.className = "elemento-de-tarjeta";
      si (deshabilitado) card.style.opacity = 0.7;

      tarjeta.innerHTML = `
        <div clase="artículo-de-tarjeta__título-fila" estilo="alinear-artículos:flex-start;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="ancho:40px;alto:40px;radio del borde:999px;pantalla:flexible;alinear elementos:centrar;justificar contenido:centrar;fondo:rgba(37,99,235,0.08);">
              <svg ancho="26" alto="26" viewBox="0 0 24 24" trazo="#1d4ed8" ancho-trazo="1.8" relleno="ninguno">
                <rect x="3" y="4" ancho="18" alto="15" rx="2"></rect>
                <línea x1="7" y1="9" x2="17" y2="9"></línea>
                <línea x1="7" y1="13" x2="12" y2="13"></línea>
              </svg>
            </div>
            <div>
              <div class="card-item__title">${nombreExamen}</div>
              <div class="panel-subtitle" style="margin-top:3px;">
                Simulacro ENARM · ${currentSectionName || "Sección"}
              </div>
            </div>
          </div>

          <span class="insignia">
            <span class="badge-dot"></span>${Texto de estado}
          </span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;font-size:13px;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${svgIcon("preguntas")}
            <div>
              <strong>${totalQuestions} preguntas</strong>
              <div class="panel-subtitle">Casos clínicos</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            ${svgIcon("tiempo")}
            <div>
              <strong>${totalTimeFormatted}</strong>
              <div class="panel-subtitle">Tiempo estimado</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            ${svgIcon("intentos")}
            <div>
              Intentos: ${intentosUsados} / ${intentosMáximos}
              <div class="panel-subtitle">Último intento: ${lastAttemptText}</div>
            </div>
          </div>
        </div>

        <div style="margin-top:14px;text-align:right;">
          ${
            desactivado
              ? `<button class="btn btn-outline" disabled>Sin intentos disponibles</button>`
              : `<button class="btn btn-primary student-start-exam-btn">Iniciar examen</button>`
          }
        </div>
      `;

      si (!deshabilitado) {
        const btnStart = card.querySelector(".estudiante-inicio-examen-btn");
        btnStart.addEventListener("clic", () => {
          iniciarSecciónExamenParaEstudiante({
            ID de examen,
            nombreExamen,
            totalPreguntas,
            totalSegundos,
            intentosUsados,
            máximosIntentos,
          });
        });
      }

      fragmento.appendChild(tarjeta);
    });

    exámenesList.innerHTML = "";
    exámenesList.appendChild(fragmento);
  } atrapar (err) {
    console.error("Error al cargar solicitudes de la sección:", err);
    si (thisToken !== examsLoadToken) devolver;
    renderEmptyMessage(examsList, "Hubo un error al cargar los exámenes. Intento nuevamente.");
  }
}

/****************************************************
 * ALEATORIO
 ****************************************************/
función shuffleArray(arr) {
  constante copia = arr.slice();
  para (sea i = copia.length - 1; i > 0; i--) {
    constante j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  devolver copia;
}

/****************************************************
 * MINI EXÁMENES – CARGA BANCO
 ****************************************************/
función asíncrona loadMiniCasesOnce() {
  si (miniCasesCache.length > 0) retorna;

  intentar {
    const snap = await getDocs(colección(db, "miniPreguntas"));
    si (snap.vacío) {
      miniCasosCache = [];
      devolver;
    }

    constante arr = [];
    snap.paraCada((docSnap) => {
      constante datos = docSnap.data();
      const caseText = datos.caseText || "";
      const especialidad = datos.especialidad || nulo;
      const preguntas = Array.isArray(datos.preguntas) ? datos.preguntas : [];

      si (!caseText || preguntas.length === 0) return;

      arr.push({
        identificación: docSnap.id,
        casoTexto,
        especialidad,
        preguntas,
      });
    });

    miniCasosCache = arr;
  } atrapar (err) {
    console.error("Error al cargar miniPreguntas:", err);
    miniCasosCache = [];
  }
}

/****************************************************
 * MINI EXÁMENES – EXAMEN DE CONSTRUCCIÓN
 ****************************************************/
función asíncrona startMiniExamFromBuilder() {
  si (!miniNumPreguntasSeleccionar) {
    alert("El módulo de mini solicitudes no está configurado en esta vista.");
    devolver;
  }

  const numQuestions = parseInt(miniNumQuestionsSelect.value, 10) || 10;

  const selectedSpecialties = Array.from(miniSpecialtyCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.valor);

  constante randomOnly = miniRandomCheckbox ? miniRandomCheckbox.checked : verdadero;

  esperar loadMiniCasesOnce();

  si (!miniCasesCache.length) {
    alert("Aún no hay casos clínicos configurados para mini exámenes.");
    devolver;
  }

  deje que poolCases = miniCasesCache.slice();
  si (especialidadesseleccionadas.length > 0) {
    poolCases = poolCases.filter((c) => selectedSpecialties.includes(c.specialty));
  }

  si (!poolCases.length) {
    alert("No hay casos clínicos que coincidan con los filtros elegidos.");
    devolver;
  }

  constante preguntaPool = [];
  poolCases.forEach((caseData) => {
    const especialidad = caseData.specialty || null;
    const caseText = caseData.caseText || "";
    (caseData.preguntas || []).forEach((q) => {
      preguntaPool.push({
        caseId: caseData.id,
        casoTexto,
        especialidad,
        preguntaTexto: q.preguntaTexto,
        opciónA: q.opcionA,
        opciónB: q.opcionB,
        opciónC: q.opcionC,
        opciónD: q.opcionD,
        opcióncorrecta: q.opcióncorrecta,
        justificación: q.justificación,
        dificultad: q.dificultad || "baja",
        subtipo: q.subtipo || "salud_publica",
      });
    });
  });

  si (!questionPool.length) {
    alert("No se encontraron preguntas en los casos seleccionados.");
    devolver;
  }

  const basePool = randomOnly ? shuffleArray(questionPool) : questionPool;
  const selectedQuestions = basePool.slice(0, numQuestions);

  si (!PreguntasSeleccionadas.length) {
    alert("No se pudieron seleccionar preguntas para el mini examen.");
    devolver;
  }

  modoExamenActual = "mini";
  currentExamId = nulo;
  IntentosAnterioresdelExamenActual = 0;
  PreguntasDeExamenActuales = [];

  // ✅ CORREGIDO: totalSeconds NO existe aquí
  constante timePerQuestion = reglasDeExamen.timePerQuestionSeconds;
  currentExamTotalSeconds = PreguntasSeleccionadas.length * tiempoPorPregunta;

  currentExamEndAtMs = Fecha.ahora() + currentExamTotalSeconds * 1000;
  respuestasdelexamenactual = {};
  borrarAlmacenamientoDeRespuestasDeExamen();
  escribirRespuestasDeExamenAlAlmacenamiento(RespuestasDeExamenActuales);

  si (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = nulo;
  }

  si (resultBanner) resultBanner.style.display = "ninguno";
  si (valoresResultados) valoresResultados.innerHTML = "";

  ocultar(examenesView);
  ocultar(progressView);
  ocultar(recursosView);
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  mostrar(examDetailView);

  examTitle.textContent = "Mini examen personalizado";
  examenSubtítulo.textoContenido =
    "Resuelve el mini examen con preguntas aleatorias de los casos clínicos disponibles.";

  constante totalPreguntas = PreguntasSeleccionadas.length;

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(currentExamTotalSeconds)}</strong><br>
    🔁 Intentos: <strong>Sin límite</strong>
  `;

  preguntasList.innerHTML = "";

  constante caseMap = nuevo Mapa();
  PreguntasSeleccionadas.paraCada((q) => {
    si (!caseMap.tiene(q.caseId)) {
      caseMap.set(q.caseId, {
        casoTexto: q.casoTexto,
        especialidad: q.specialty,
        preguntas: [],
      });
    }
    caseMap.get(q.caseId).preguntas.push(q);
  });

  sea ​​globalIndex = 0;

  Matriz.from(caseMap.values()).forEach((caseData, caseIndex) => {
    constante caseBlock = document.createElement("div");
    caseBlock.className = "bloque-de-caso";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="case-text">${caseData.caseText}</div>
    `;

    constante questionsWrapper = document.createElement("div");

    caseData.preguntas.paraCada((q, índice local) => {
      constante idx = índice global;

      PreguntasDeExamenActuales.push({
        caseText: caseData.caseText,
        preguntaTexto: q.preguntaTexto,
        opciónA: q.opcionA,
        opciónB: q.opcionB,
        opciónC: q.opcionC,
        opciónD: q.opcionD,
        opcióncorrecta: q.opcióncorrecta,
        justificación: q.justificación,
        especialidad: caseData.specialty,
        dificultad: q.dificultad || "baja",
        subtipo: q.subtipo || "salud_publica",
      });

      const difficultLabel = DIFFICULTY_LABELS[q.difficulty] || "No definida";
      const subtypeLabel = SUBTYPE_LABELS[q.subtype] || "General";
      constante specialityLabel =
        SPECIALTY_LABELS[caseData.specialty] || caseData.specialty || "No definida";

      constante qBlock = documento.createElement("div");
      qBlock.className = "bloque-de-preguntas";
      qBlock.conjunto de datos.qIndex = idx;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${q.questionText}</p>

        <div class="panel-subtitle question-meta" style="font-size:12px;margin-bottom:8px;display:none;">
          Especialidad: <strong>${specialtyLabel}</strong> ·
          Tipo: <strong>${subtypeLabel}</strong> ·
          Dificultad: <strong>${difficultyLabel}</strong>
        </div>

        <div class="opciones-de-pregunta">
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="A"> A) ${q.optionA}</label>
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="B"> B) ${q.optionB}</label>
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="C"> C) ${q.optionC}</label>
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="D"> D) ${q.optionD}</label>
        </div>

        <div class="cuadro de justificación">
          <strong>Justificación:</strong><br>
          ${q.justificación || ""}
        </div>
      `;

      preguntasWrapper.appendChild(qBlock);
      índice global++;
    });

    caseBlock.appendChild(preguntasWrapper);
    preguntasList.appendChild(caseBlock);
  });

  // Persistencia para refrescar
  persistirCurrentExamState();
  startExamTimer(segundostotalesdelexamenactual, findelexamenactualenms);
}


/****************************************************
 * BIBLIOTECA – INICIAR MINI-EXAMEN POR TEMA
 * (No consuma intentos, no se guarda intento en Firestore)
 ****************************************************/
función startTopicExamFromResources({ topicId, topicTitle, cases }) {
  constante plana = [];
  (casos || []).forEach((c) => {
    const caseText = c?.caseText || "";
    const qs = Array.isArray(c?.preguntas) ? c.preguntas : [];
    qs.paraCada((q) => {
      plano.push({
        casoTexto,
        preguntaTexto: q?.preguntaTexto || "",
        opciónA: q?.opcionA || "",
        opciónB: q?.opcionB || "",
        opciónC: q?.opcionC || "",
        opciónD: q?.opcionD || "",
        opcióncorrecta: q?.opcióncorrecta || "A",
        justificación: q?.justificación || "",
        especialidad: "",
        dificultad: "",
        subtipo: "",
      });
    });
  });

  si (!plano.longitud) {
    alert("Este tema aún no tiene mini-examen configurado.");
    devolver;
  }

  currentExamMode = "tema";
  currentExamId = `tema:${topicId || "desconocido"}`;
  IntentosAnterioresdelExamenActual = 0;
  currentExamQuestions = plano;
  respuestasdelexamenactual = {};

  constante timePerQuestion = reglasDeExamen.timePerQuestionSeconds;
  currentExamTotalSeconds = flat.length * tiempoPorPregunta;

  si (resultBanner) resultBanner.style.display = "ninguno";
  si (valoresResultados) valoresResultados.innerHTML = "";

  if (título del examen) título del examen.textContent = título del tema || "Mini-examen del tema";
  if (examSubtitle) examSubtitle.textContent = "Resuelve y finaliza cuando termines.";

  si (examMetaText) {
    examMetaText.innerHTML = `
      📘 Preguntas: <strong>${flat.length}</strong><br>
      🕒 Tiempo total: <strong>${formatMinutesFromSeconds(currentExamTotalSeconds)}</strong><br>
      🔁 Intentos: <strong>No aplica</strong>
    `;
  }

  ocultar(examenesView);
  ocultar(progressView);
  ocultar(recursosView);
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  mostrar(examDetailView);

  renderizarPreguntasDeExamenDesdeElEstadoActual();
  startExamTimer(segundostotalesdelexamenactual);
}


/****************************************************
 * EXÁMENES POR SECCIÓN – INICIAR
 ****************************************************/
función asíncrona startSectionExamForStudent({
  ID de examen,
  nombreExamen,
  totalPreguntas,
  totalSegundos,
  intentosUsados,
  máximosIntentos,
}) {
  si (intentosUsados ​​>= máxIntentos) {
    alert("Has agotado tus intentos para este examen.");
    devolver;
  }

  currentExamMode = "sección";
  currentExamId = IdExamen;
  TotalSegundosExamenActual = totalSegundos;
  currentExamPreviousAttempts = intentosUsados;
  PreguntasDeExamenActuales = [];

  currentExamEndAtMs = Fecha.ahora() + currentExamTotalSeconds * 1000;
  respuestasdelexamenactual = {};
  borrarAlmacenamientoDeRespuestasDeExamen();
  escribirRespuestasDeExamenAlAlmacenamiento(RespuestasDeExamenActuales);

  si (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = nulo;
  }

  ocultar(examenesView);
  ocultar(progressView);
  ocultar(recursosView);
  ocultar(miniBuilderView);
  si (miniExamPlaceholderView) ocultar (miniExamPlaceholderView);
  mostrar(examDetailView);

  si (resultBanner) resultBanner.style.display = "ninguno";
  si (valoresResultados) valoresResultados.innerHTML = "";

  títulodelexamen.textContent = nombredelexamen;
  examSubtitle.textContent = "Resuelve cuidadosamente y envía antes de que termine el tiempo.";

  examMetaText.innerHTML = `
    📘 Preguntas: <strong>${totalQuestions}</strong><br>
    🕒 Tiempo total: <strong>${formatMinutesFromSeconds(totalSeconds)}</strong><br>
    🔁 Intentos: <strong>${attemptsUsed} de ${maxAttempts}</strong>
  `;

  esperar cargarPreguntasParaSecciónExamen(examId);

  // Persistencia para refrescar
  persistirCurrentExamState();

  startExamTimer(segundostotalesdelexamenactual, findelexamenactualenms);
}

/****************************************************
 * CARGAR PREGUNTAS EXAMEN POR SECCIÓN
 ****************************************************/
función asíncrona loadQuestionsForSectionExam(examId) {
  si (!preguntasList) retorna;
  preguntasList.innerHTML = "";

  const qQuestions = consulta(colección(db, "preguntas"), donde("examId", "==", examId));
  const snap = await obtenerDocs(qPreguntas);

  si (snap.vacío) {
    renderEmptyMessage(questionsList, "No se han cargado preguntas.");
    devolver;
  }

  const casos = [];
  snap.paraCada((docSnap) => {
    constante datos = docSnap.data();
    const caseText = datos.caseText || "";
    const arr = Array.isArray(datos.preguntas) ? datos.preguntas : [];
    const specialityKey = datos.specialty || nulo;

    si (arr.length > 0) {
      casos.push({
        casoTexto,
        especialidad: especialidadKey,
        preguntas: arr,
      });
    }
  });

  si (!casos.longitud) {
    renderEmptyMessage(questionsList, "No existen preguntas configuradas.");
    devolver;
  }

  // ✅ CORREGIDO: aquí SOLO renderizamos y llenamos currentExamQuestions.
  PreguntasDeExamenActuales = [];

  sea ​​globalIndex = 0;

  casos.paraCada((datosDeCaso, índiceDeCaso) => {
    constante caseBlock = document.createElement("div");
    caseBlock.className = "bloque-de-caso";

    caseBlock.innerHTML = `
      <h4>Caso clínico ${caseIndex + 1}</h4>
      <div class="case-text">${caseData.caseText}</div>
    `;

    constante questionsWrapper = document.createElement("div");

    caseData.preguntas.paraCada((q, índice local) => {
      constante idx = índice global;

      PreguntasDeExamenActuales.push({
        caseText: caseData.caseText,
        preguntaTexto: q.preguntaTexto,
        opciónA: q.opcionA,
        opciónB: q.opcionB,
        opciónC: q.opcionC,
        opciónD: q.opcionD,
        opcióncorrecta: q.opcióncorrecta,
        justificación: q.justificación,
        especialidad: caseData.specialty,
        dificultad: q.dificultad || "baja",
        subtipo: q.subtipo || "salud_publica",
      });

      const difficultLabel = DIFFICULTY_LABELS[q.difficulty] || "No definida";
      const subtypeLabel = SUBTYPE_LABELS[q.subtype] || "General";
      constante specialityLabel =
        SPECIALTY_LABELS[caseData.specialty] || caseData.specialty || "No definida";

      constante qBlock = documento.createElement("div");
      qBlock.className = "bloque-de-preguntas";
      qBlock.conjunto de datos.qIndex = idx;

      qBlock.innerHTML = `
        <h5>Pregunta ${localIndex + 1}</h5>
        <p>${q.questionText}</p>

        <div class="panel-subtitle question-meta" style="font-size:12px;margin-bottom:8px;display:none;">
          Especialidad: <strong>${specialtyLabel}</strong> ·
          Tipo: <strong>${subtypeLabel}</strong> ·
          Dificultad: <strong>${difficultyLabel}</strong>
        </div>

        <div class="opciones-de-pregunta">
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="A"> A) ${q.optionA}</label>
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="B"> B) ${q.optionB}</label>
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="C"> C) ${q.optionC}</label>
          <label><tipo de entrada="radio" nombre="q_${idx}" valor="D"> D) ${q.optionD}</label>
        </div>

        <div class="cuadro de justificación">
          <strong>Justificación:</strong><br>
          ${q.justificación || ""}
        </div>
      `;

      preguntasWrapper.appendChild(qBlock);
      índice global++;
    });

    caseBlock.appendChild(preguntasWrapper);
    preguntasList.appendChild(caseBlock);
  });
}

/****************************************************
 * CRONÓMETRO
 ****************************************************/
función startExamTimer(totalSeconds, endAtMs = null) {
  si (!examTimerEl) retorna;

  si (currentExamTimerId) clearInterval(currentExamTimerId);

  si (!endAtMs) {
    endAtMs = Fecha.ahora() + (Número(totalSegundos) || 0) * 1000;
  }

  actualExamenFinAlMs = finAlMs;

  constante computarRestante = () => {
    const diffMs = (currentExamEndAtMs || 0) - Fecha.now();
    devuelve Math.max(0, Math.ceil(diffMs / 1000));
  };

  deje que restante = computeRemaining();
  examTimerEl.textContent = formatTimer(restante);

  currentExamTimerId = setInterval(() => {
    restante = computeRemaining();

    si (restante <= 0) {
      clearInterval(currentExamTimerId);
      currentExamTimerId = nulo;
      examTimerEl.textContent = "00:00";
      alert("El tiempo se agotó, tu examen se enviará automáticamente.");
      enviarExamenParaEstudiante(verdadero);
      devolver;
    }

    examTimerEl.textContent = formatTimer(restante);
  }, 1000);
}

/****************************************************
 * ENVÍO DE EXAMEN
 ****************************************************/
función asíncrona submitExamForStudent(auto = false) {
  si (!preguntasdeexamenactuales.longitud) {
    alert("No hay examen cargado.");
    devolver;
  }

  si (btnSubmitExam) btnSubmitExam.disabled = verdadero;
  si (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = nulo;
  }

  constante totalQuestions = currentExamQuestions.length;
  deje que globalCorrect = 0;
  deje que globalWeightedCorrect = 0;
  deje que globalWeightedTotal = 0;

  const detalle = {};

  constante specStats = {};
  Objeto.keys(ETIQUETAS_ESPECIALES).forEach((k) => {
    estadísticas de especificación[k] = {
      nombre: ETIQUETAS_ESPECIALES[k],
      correcto: 0,
      total: 0,
      subtipos: {
        salud_publica: { correcto: 0, total: 0 },
        medicina_familiar: { correcto: 0, total: 0 },
        urgencias: { correcto: 0, total: 0 },
      },
    };
  });

  constante estadísticas de dificultad = {
    alta: { correctos: 0, totales: 0 },
    medios: { correctos: 0, total: 0 },
    baja: { correctos: 0, totales: 0 },
  };

  PreguntasDeExamenActuales.paraCada((q, idx) => {
    constante selectedInput = document.querySelector(`input[nombre="q_${idx}"]:checked`);
    const seleccionado = selectedInput ? selectedInput.value : null;

    constante correcto = q.correctOption;
    const resultado = seleccionado === ¿correcto? "correcto" : "incorrecto";

    const especialidad = q.especialidad;
    const dificultad = q.dificultad || "baja";
    const subtipo = q.subtipo || "salud_publica";

    constante peso = (PESOS_DIFICULTAD && PESOS_DIFICULTAD[dificultad]) || 1;
    globalWeightedTotal += peso;

    si (resultado === "correcto") {
      globalCorrect++;
      globalWeightedCorrect += peso;
    }

    si (especialidad && specStats[especialidad]) {
      specStats[especialidad].total++;
      si (resultado === "correcto") specStats[especialidad].correct++;

      si (specStats[especialidad].subtipos[subtipo]) {
        specStats[especialidad].subtipos[subtipo].total++;
        si (resultado === "correcto") specStats[especialidad].subtipos[subtipo].correcto++;
      }
    }

    si (dificultadStats[dificultad]) {
      dificultadStats[dificultad].total++;
      si (resultado === "correcto") dificultadStats[dificultad].correcto++;
    }

    detalle[`q${idx}`] = {
      seleccionado,
      opciónCorrecta: correcto,
      resultado,
      especialidad,
      dificultad,
      subtipo,
      peso,
    };

    const card = preguntasList?.querySelector?.(`[data-q-index="${idx}"]`);
    si (tarjeta) {
      const just = card.querySelector(".cuadro-de-justificación");
      const meta = card.querySelector(".pregunta-meta");

      si (solo) solo.estilo.display = "bloque";
      si (meta) meta.style.display = "bloque";

      const etiquetas = card.querySelectorAll("etiqueta");
      etiquetas.paraCada((lab) => {
        constante entrada = lab.querySelector("entrada");
        si (!input) retorna;

        lab.style.border = "1px sólido transparente";
        laboratorio.estilo.borderRadius = "6px";
        laboratorio.estilo.padding = "4px 6px";

        si (entrada.valor === correcto) {
          laboratorio.estilo.colorborder = "#16a34a";
          laboratorio.estilo.fondo = "#dcfce7";
        }
        si (seleccionado === valor_entrada && seleccionado !== correcto) {
          laboratorio.estilo.borderColor = "#b91c1c";
          laboratorio.estilo.fondo = "#fee2e2";
        }
      });
    }
  });

  const puntuaciónRaw = totalPreguntas > 0 ? Math.round((globalCorrect / totalPreguntas) * 100) : 0;

  constante puntuación ponderada =
    globalWeightedTotal > 0 ? (globalWeightedCorrect / globalWeightedTotal) * 100 : 0;

  si (modoExamenActual === "sección" && IdExamenActual && UsuarioActual) {
    intentar {
      const attemptRef = doc(db, "usuarios", currentUser.email, "intentosDeExamen", currentExamId);

      const prevSnap = await getDoc(intentoRef);
      constante prevData = prevSnap.exists() ? prevSnap.data() : {};
      constante viejosIntentos =
        tipo de prevData.intentos === "número"
          ? prevData.intentos
          : intentos previos del examen actual || 0;

      constante historyEntry = {
        Puntuación: puntuación ponderada,
        puntuaciónRaw,
        correctCount: globalCorrect,
        totalPreguntas,
        sectionId: currentSectionId,
        nombreDeSección: nombreDeSecciónActual || "",
        createdAt: nueva fecha(),
      };

      esperar setDoc(
        intentoRef,
        {
          intentos: intentosantiguos + 1,
          últimoIntento: serverTimestamp(),
          Puntuación: puntuación ponderada,
          puntuaciónRaw,
          correctCount: globalCorrect,
          totalPreguntas,
          puntosponderados: globalWeightedCorrect,
          totalponderado: totalponderadoglobal,
          detalle,
          descomponer: {
            especialidades: specStats,
            dificultades: estadísticas de dificultad,
          },
          historial: arrayUnion(historialEntrada),
        },
        { fusionar: verdadero }
      );
    } atrapar (err) {
      console.error("Error al guardar intento de examen:", err);
      alert("Hubo un error guardando tu intento, pero se calcularon tus resultados.");
    }
  }

  // limpiar persistencia de examen en curso
  borrarEstadoDeExamenDeEstudiante();

  renderPremiumResults({
    auto,
    globalCorrecto,
    totalPreguntas,
    puntuación ponderada,
    puntosponderados: globalWeightedCorrect,
    totalponderado: totalponderadoglobal,
    estadísticas de especificaciones,
    estadísticas de dificultad,
    showBreakdown: currentExamMode !== "tema",
  });

  si (btnSubmitExam) {
    btnSubmitExam.disabled = verdadero;
    btnSubmitExam.style.display = "ninguno";
  }
}

/****************************************************
 * RESULTADOS – TABLAS
 ****************************************************/
función renderPremiumResults({
  auto,
  globalCorrecto,
  totalPreguntas,
  puntuación ponderada,
  puntos ponderados,
  total ponderado,
  estadísticas de especificaciones,
  estadísticas de dificultad,
  showBreakdown = verdadero,
}) {
  si (!resultBanner || !resultValues) {
    alerta(
      `Examen enviado.\nAciertos: ${globalCorrect}/${totalQuestions}\nCalificación: ${toFixedNice(scoreWeighted)}%`
    );
    devolver;
  }

  constante mensaje = auto
    ? "El examen fue enviado automáticamente al agotar el tiempo."
    : "Tu examen se envió correctamente. Revisa tus resultados detallados.";

  const weightedLine = `${toFixedNice(weightedPoints, 2)} / ${toFixedNice(weightedTotal, 2)} puntos`;

  constante tablaGeneral = `
    <table class="tabla-de-resultados">
      <cabeza>
        <tr>
          Indicador
          Valor
        </tr>
      </cabeza>
      <cuerpo>
        <tr>
          <td>Aciertos</td>
          <td>${globalCorrect} de ${totalQuestions}</td>
        </tr>
        <tr>
          <td>Totalmente ponderado</td>
          <td>${weightedLine}</td>
        </tr>
        <tr>
          <td>Calificación ponderada</td>
          <td>${toFixedNice(puntuación ponderada)}%</td>
        </tr>
      </tbody>
    </tabla>
  `;

  constante tablaPorSubtipoEspecialidad = `
    <table class="tabla-de-resultados tabla-de-resultados--compacta">
      <cabeza>
        <tr>
          Especialidad
          Salud pública
          Medicina familiar
          Urgencias
        </tr>
      </cabeza>
      <cuerpo>
        ${Objeto.keys(ETIQUETAS_ESPECIALES)
          .map((clave) => {
            const st = specStats[clave] || {};
            const sp = st.subtypes?.salud_publica || { correctos: 0, totales: 0 };
            const mf = st.subtypes?.medicina_familiar || { correctos: 0, totales: 0 };
            const ur = st.subtipos?.urgencias || { correcto: 0, total: 0 };
            regresar `
              <tr>
                <td>${ETIQUETAS_ESPECIALES[clave]}</td>
                <td>${sp.correcto} / ${sp.total}</td>
                <td>${mf.correcto} / ${mf.total}</td>
                <td>${ur.correcto} / ${ur.total}</td>
              </tr>
            `;
          })
          .unirse("")}
      </tbody>
    </tabla>
  `;

  constante tablaPorDificultad = `
    <table class="tabla-de-resultados tabla-de-resultados--compacta">
      <cabeza>
        <tr>
          Dificultad
          Aciertos
        </tr>
      </cabeza>
      <cuerpo>
        ${["alta", "media", "baja"]
          .map((d) => {
            const s = difficultyStats[d] || { correctos: 0, totales: 0 };
            constante etiqueta = ETIQUETAS_DE_DIFICULTAD[d] || d;
            regresar `
              <tr>
                <td>${etiqueta}</td>
                <td>${s.correcto} / ${s.total}</td>
              </tr>
            `;
          })
          .unirse("")}
      </tbody>
    </tabla>
  `;

  resultValues.innerHTML = `
    <div class="result-message">${mensaje}</div>
    <div class="tablas-de-resultados">
      ${tablaGeneral}
      ${showBreakdown ? tableBySpecialtySubtype : ''}
      ${showBreakdown ? tablaPorDificultad : ''}
    </div>
  `;

  resultBanner.style.display = "bloque";
  window.scrollTo({ top: 0, comportamiento: "suave" });
}

/****************************************************
 * VOLVER DESDE EXAMEN
 ****************************************************/
función asíncrona handleBackFromExam() {
  const cameFromMini = modoExamenActual === "mini";

  si (currentExamTimerId) {
    clearInterval(currentExamTimerId);
    currentExamTimerId = nulo;
  }

  modoExamenActual = nulo;
  currentExamId = nulo;
  PreguntasDeExamenActuales = [];
  currentExamEndAtMs = nulo;
  respuestasdelexamenactual = {};
  borrarAlmacenamientoDeRespuestasDeExamen();
  escribirRespuestasDeExamenAlAlmacenamiento(RespuestasDeExamenActuales);

  borrarEstadoDeExamenDeEstudiante();

  if (lista de preguntas) lista de preguntas.innerHTML = "";
  if (examTimerEl) examTimerEl.textContent = "--:--";

  si (resultBanner) resultBanner.style.display = "ninguno";
  si (valoresResultados) valoresResultados.innerHTML = "";

  si (btnSubmitExam) {
    btnSubmitExam.disabled = falso;
    btnSubmitExam.style.display = "flexible en línea";
  }

  ocultar(examDetailView);
  ocultar(progressView);
  ocultar(recursosView);

  si (vinoDeMini) {
    cambiarAMiniView();
  } demás {
    constante restaurada = esperar restaurarStudentStateAfterInit();
    si (!restaurado) switchToSectionView();
  }
}

/****************************************************
 * PROGRESO DEL ESTUDIANTE
 **************************************** *************/
función asíncrona loadStudentProgress() {
  si (!currentUser) retorna;

  constante esteToken = ++progressLoadToken;

  si (progressNombreUsuario) {
    progresoNombre de usuario.textContent =
      "Estudiante: " + (PerfilUsuarioActual?.nombre || UsuarioActual.correo electrónico);
  }

  si (progressSectionsContainer) {
    ProgressSectionsContainer.innerHTML = `
      <div class="tarjeta">
        <p class="panel-subtitle">Cargando progreso…</p>
      </div>
    `;
  }
  si (progresoGlobalEl) {
    progresoGlobalEl.innerHTML = "";
  }

  intentar {
    const [seccionesSnap, exámenesSnap, intentosSnap] = await Promise.all([
      getDocs(colección(db, "secciones")),
      getDocs(colección(db, "exámenes")),
      getDocs(colección(db, "usuarios", currentUser.email, "intentosdeexamen")),
    ]);

    si (thisToken !== progressLoadToken) retorna;

    const seccionesMap = {};
    seccionesSnap.forEach((docSnap) => {
      seccionesMap[docSnap.id] = {
        identificación: docSnap.id,
        nombre: docSnap.data().nombre || "Sección",
      };
    });

    constante secciónStats = {};
    Objeto.valores(seccionesMapa).paraCada((s) => {
      secciónStats[s.id] = {
        nombre: s.name,
        Puntuación total: 0,
        exámenesCount: 0,
        correcto: 0,
        total de preguntas: 0,
      };
    });

    const examsMap = {};
    exámenesSnap.forEach((docSnap) => {
      constante d = docSnap.data();
      examsMap[docSnap.id] = {
        ID de examen: docSnap.id,
        nombre: d.name || "Examen",
        sectionId: d.sectionId || nulo,
      };
    });

    constante examLatestResults = [];
    constante examHistoryResults = [];

    intentosSnap.forEach((docSnap) => {
      constante en = docSnap.data();
      constante examId = docSnap.id;
      const examDef = examsMap[examId] || {};

      const nombreDeExamen = nombreDefExamen || en.nombreexamen || "Examen";
      constante sectionId = at.sectionId || examDef.sectionId || null;
      constante nombreSección =
        en.sectionName || (sectionId && sectionsMap[sectionId]?.name) || "Sección";

      const puntuación = typeof en.puntuación === "número" ? en.puntuación : 0;
      constante correcta = en.correctCount || 0;
      constante totalQ = en.totalPreguntas || 0;
      const último intento = at.último intento? at.lastAttempt.toDate() : nulo;

      examLatestResults.push({
        ID de examen,
        nombreExamen,
        secciónId,
        nombreDeSección,
        puntaje,
        correctCount: correcto,
        totalPreguntas: totalQ,
        último intento,
      });

      si (secciónId && secciónStats[secciónId]) {
        sectionStats[sectionId].totalScore += puntuación;
        secciónStats[secciónId].examsCount++;
        sectionStats[sectionId].correct += correcto;
        secciónEstadísticas[secciónId].totalPreguntas += totalQ;
      }

      const historyArr = Array.isArray(at.history) ? at.history : [];
      si (historyArr.length === 0) {
        examHistoryResults.push({ examId, examName, sectionId, sectionName, puntuación, últimoIntento });
      } demás {
        historyArr.forEach((h) => {
          const hScore = typeof h.score === "número" ? h.score : puntuación;
          deje que hDate = h.createdAt || h.date || en.lastAttempt;
          si (hDate && tipo de hDate.toDate === "función") hDate = hDate.toDate();
          ResultadosDeHistorialDeExámenes.push({
            ID de examen,
            nombreExamen,
            secciónId,
            nombreDeSección,
            Puntuación: hScore,
            últimoIntento: hDate || últimoIntento,
          });
        });
      }
    });

    si (progressSectionsContainer) {
      ProgressSectionsContainer.innerHTML = "";

      Objeto.valores(seccionesMapa).paraCada((s) => {
        const st = sectionStats[s.id] || { examsCount: 0, totalScore: 0, correct: 0, totalQuestions: 0 };
        const exámenesCnt = st.examsCount || 0;

        constante tarjeta = documento.createElement("div");
        card.className = "tarjeta-de-sección-de-progreso";

        si (!examsCnt) {
          tarjeta.innerHTML = `
            <div class="título-de-sección-de-progreso">${s.name}</div>
            <div>Sin intentos aún.</div>
          `;
        } demás {
          constante avg = st.totalScore / examsCnt;
          tarjeta.innerHTML = `
            <div class="título-de-sección-de-progreso">${s.name}</div>
            <div><strong>Promedio:</strong> ${toFixedNice(avg, 1)}%</div>
            <div><strong>Aciertos:</strong> ${st.correct} / ${st.totalQuestions}</div>
            <div><strong>Exámenes realizados:</strong> ${examsCnt}</div>
          `;
        }

        progressSectionsContainer.appendChild(tarjeta);
      });
    }

    constante totalExams = examLatestResults.length;
    const totalCorrect = examLatestResults.reduce((suma, r) ​​=> suma + (r.correctCount || 0), 0);
    const totalQuestions = examLatestResults.reduce((suma, r) ​​=> suma + (r.totalQuestions || 0), 0);
    constante globalAvg =
      totalExámenes > 0
        ? examLatestResults.reduce((suma, r) ​​=> suma + (r.puntuación || 0), 0) / totalExams
        :0;

    si (progresoGlobalEl) {
      progresoGlobalEl.innerHTML = `
        <div><strong>Exámenes realizados:</strong> ${totalExams}</div>
        <div><strong>Aciertos acumulados:</strong> ${totalCorrect} de ${totalQuestions}</div>
        <div><strong>Promedio general:</strong> ${toFixedNice(globalAvg, 1)}%</div>
      `;
    }

    // Progreso Biblioteca (Resúmenes/GPC)
    intentar {
      esperar asegurarStudentResourcesActivated();

      const countEl = document.getElementById("número-de-recursos-para-estudiantes");
      const totalText = countEl ? (countEl.textContent || "") : "";
      const mTotal = totalText.match(/(\d+)/);
      const totalTopics = mTotal ? Número(mTotal[1]) : 0;

      constante userKey = normalizeText(currentUser.email);
      const completedRaw = localStorage.getItem(`recursos_completados_${userKey}`) || "[]";
      constante completedArr = safeJsonParse(completedRaw, []);
      const TemasCompletados = Array.isArray(ArrCompletado) ?ArrCompletado.length : 0;

      const pct = totalTemas > 0 ? Math.round((Temas completados / totalTemas) * 100) : 0;

      si (progresoGlobalEl) {
        progresoGlobalEl.innerHTML += `
          <div><strong>Biblioteca (Resúmenes/GPC):</strong> ${completedTopics} / ${totalTopics} (${pct}%)</div>
        `;
      }
    } captura (e) {
      console.warn("No se pudo calcular el progreso de la biblioteca:", e);
    }

    renderProgressChart(resultadosdelhistorialdelexamen);
  } atrapar (err) {
    console.error("Error cargando progreso del estudiante:", err);
    si (thisToken !== progressLoadToken) retorna;
    si (progressSectionsContainer) {
      ProgressSectionsContainer.innerHTML = `
        <div class="tarjeta">
          <p class="panel-subtitle">No se pudo cargar el progreso.</p>
        </div>
      `;
    }
  }
}

/****************************************************
 * GRÁFICA DE PROGRESO – Chart.js
 ****************************************************/
función renderProgressChart(examResults) {
  si (!progressChartCanvas) retorna;

  constante ordenada = resultadosdelexamen
    .rebanada()
    .sort((a, b) => {
      constante A = a.últimoIntento ? a.últimoIntento.getTime() : 0;
      constante B = b.últimoIntento ? b.últimoIntento.getTime() : 0;
      devolver A - B;
    });

  constante ctx = progressChartCanvas.getContext("2d");

  si (!ordenado.longitud) {
    si (progressChartInstance) {
      progressChartInstance.destroy();
      progressChartInstance = nulo;
    }
    ctx.clearRect(0, 0, progressChartCanvas.ancho, progressChartCanvas.alto);
    devolver;
  }

  const etiquetas = sorted.map((_, i) => `Intento ${i + 1}`);
  const datos = ordenados.map((r) => (tipo de r.score === "número" ? r.score : 0));

  constante grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, "rgba(37,99,235,0.25)");
  grad.addColorStop(1, "rgba(37,99,235,0)");

  si (progressChartInstance) progressChartInstance.destroy();

  // eslint-deshabilitar-siguiente-línea sin indefinición
  progressChartInstance = nuevo Gráfico(ctx, {
    tipo: "línea",
    datos: {
      etiquetas,
      conjuntos de datos: [
        {
          etiqueta: "Calificación ponderada",
          datos,
          color del borde: "#2563eb",
          Color de fondo: degradado,
          Ancho del borde: 2,
          radio del punto: 3,
          puntoFondoColor: "#1d4ed8",
          tensión: 0,3,
          relleno: verdadero,
        },
      ],
    },
    opciones: {
      responsivo: verdadero,
      mantenerRelaciónDeAspecto: falso,
      escalas: {
        y: { min: 0, máx: 100, ticks: { stepSize: 10 } },
      },
      complementos: {
        leyenda: { display: false },
        información sobre herramientas: {
          devoluciones de llamada: {
            título: (elementos) => {
              constante i = elementos[0].dataIndex;
              const r = ordenado[i];
              return `Intento ${i + 1} — ${r.examName} (${r.sectionName})`;
            },
            etiqueta: (artículo) => {
              constante i = elemento.dataIndex;
              const r = ordenado[i];
              const puntuación = typeof r.puntuación === "número" ? toFixedNice(r.puntuación, 1) : "0.0";
              const cuando = r.lastAttempt instancia de Fecha ? r.lastAttempt.toLocaleString("es-MX") : "";
              volver cuando? `Calificación: ${score}% — ${when}` : `Calificación: ${score}%`;
            },
          },
        },
      },
    },
  });
}
