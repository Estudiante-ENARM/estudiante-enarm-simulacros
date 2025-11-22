// app.js - Versión con Casos Clínicos (A.1) + estructura Firestore nueva
// - sections        (name, order, createdAt)
// - exams           (sectionId, title, description, duration, createdAt)
// - casosClinicos   (examId, titulo, texto, orden, createdAt)
// - preguntas       (examId, casoId, pregunta, opciones[], correcta, justificacion, orden, createdAt)
// - users           (email, name, role, estado?, expiracion?, createdAt)
// - attempts        (opcional, para contar intentos por examen)

// ---------------------- IMPORTS FIREBASE (modular CDN) ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------------------- CONFIG FIREBASE ----------------------
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------- CONSTANTES ----------------------
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";
const AUTO_RECONSTRUCT_ENABLED = true;

// ---------------------- SELECTORES DOM ----------------------
const $ = id => document.getElementById(id);

// Left sidebar / main
const sectionsList   = $('sectionsList');
const mainContent    = $('mainContent');
const loginScreen    = $('loginScreen');
const studentScreen  = $('studentScreen');
const studentTitle   = $('studentTitle');
const examsList      = $('examsList');
const editButtons    = $('editButtons');
const btnEdit        = $('btnEdit');
const btnSave        = $('btnSave');

// Exam screen
const examScreen     = $('examScreen');
const examTitle      = $('examTitle');
const examTimer      = $('examTimer');
const examForm       = $('examForm');
const btnFinishExam  = $('btnFinishExam');
const editExamButtons= $('editExamButtons');
const btnEditExam    = $('btnEditExam');
const btnSaveExam    = $('btnSaveExam');

// Results
const resultScreen   = $('resultScreen');

// Top / auth
const inputEmail     = $('inputEmail');
const inputPassword  = $('inputPassword');
const btnLogin       = $('btnLogin');
const btnCancel      = $('btnCancel');
const loginMessage   = $('loginMessage');
const userInfo       = $('userInfo');
const authButtons    = $('authButtons');

// Admin right sidebar (buttons)
const adminSidebar        = $('adminSidebar');
const adminAddSection     = $('adminAddSection');
const adminAddExam        = $('adminAddExam');
const adminEditQuestions  = $('adminEditQuestions');
const adminUsers          = $('adminUsers');
const adminLinks          = $('adminLinks');
const adminLogout         = $('adminLogout');

// Socials / countdown
const mainCountdownEl = $('mainCountdown');
const linkInstagram   = $('link-instagram');
const linkWhatsApp    = $('link-whatsapp');
const linkTelegram    = $('link-telegram');
const linkTikTok      = $('link-tiktok');

// ensure placeholders exist (por si falta algún id en el HTML)
function ensure(id) {
  if (!$(id)) {
    const d = document.createElement('div');
    d.id = id;
    d.className = 'hidden';
    document.body.appendChild(d);
  }
}
[
  'sectionsList','mainContent','loginScreen','studentScreen','examsList','editButtons','btnEdit','btnSave',
  'examScreen','examTitle','examTimer','examForm','btnFinishExam','editExamButtons','btnEditExam','btnSaveExam',
  'resultScreen','inputEmail','inputPassword','btnLogin','btnCancel','loginMessage','userInfo','authButtons',
  'adminSidebar','adminAddSection','adminAddExam','adminEditQuestions','adminUsers','adminLinks','adminLogout',
  'mainCountdown','link-instagram','link-whatsapp','link-telegram','link-tiktok','studentTitle'
].forEach(ensure);

// ---------------------- ESTADO GLOBAL ----------------------
let currentUser       = null;    // {uid, email, role, estado, expiracion}
let currentSectionId  = null;
let currentExam       = null;    // { id, title, ... }
let examTimerInterval = null;
let examRemainingSeconds = 0;

// draft para edición de exámenes (solo títulos / borrado)
let draft = {
  exams: {},      // examId -> { title, deleted:bool }
  questions: {},  // reservado si se usa editor avanzado
  newExams: []    // { tempId, title, description, duration, sectionId }
};

// ---------------------- UTILIDADES ----------------------
function show(el){ if(!el) return; el.classList.remove('hidden'); }
function hide(el){ if(!el) return; el.classList.add('hidden'); }
function escapeHtml(s){
  if(s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
function qid(){ return 'id_' + Math.random().toString(36).slice(2,9); }

// ---------------------- COUNTDOWN ----------------------
function startMainCountdown(){
  try {
    const target = new Date('2026-09-23T00:00:00');
    const el = mainCountdownEl || document.createElement('div');
    function tick(){
      const now = new Date();
      let diff = Math.floor((target - now)/1000);
      if (diff <= 0) { el.textContent = 'Evento iniciado'; return; }
      const days = Math.floor(diff/86400); diff -= days*86400;
      const hrs  = Math.floor(diff/3600);  diff -= hrs*3600;
      const mins = Math.floor(diff/60);    const secs = diff%60;
      el.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }
    tick();
    setInterval(tick,1000);
  } catch(e){ console.warn(e); }
}
startMainCountdown();

// ---------------------- AUTO-RECONSTRUCT ----------------------
let _autoRan = false;
async function ensureDefaults(){
  if (!AUTO_RECONSTRUCT_ENABLED || _autoRan) return;
  _autoRan = true;
  try {
    // Asegurar al menos 1 sección
    const sSnap = await getDocs(query(collection(db,'sections'), limit(1)));
    if (sSnap.empty) {
      await addDoc(collection(db,'sections'), {
        name: 'Sección 1',
        order: 1,
        createdAt: new Date().toISOString()
      });
    }

    // Asegurar usuario admin base en colección users
    const uSnap = await getDocs(query(collection(db,'users'), limit(1)));
    if (uSnap.empty) {
      await setDoc(doc(db,'users', ADMIN_UID), {
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        estado: 'habilitado',
        expiracion: '',
        createdAt: new Date().toISOString()
      });
    }
  } catch(e){ console.warn('ensureDefaults', e); }
}

// ---------------------- CARGA Y RENDER SECCIONES ----------------------
async function loadSections(){
  sectionsList.innerHTML = '';
  try {
    await ensureDefaults();
    const sSnap = await getDocs(query(collection(db,'sections'), orderBy('name')));
    if (sSnap.empty) {
      const docRef = await addDoc(collection(db,'sections'), {
        name:'Sección 1',
        order:1,
        createdAt: new Date().toISOString()
      });
      console.log('Sección por defecto creada', docRef.id);
      return loadSections();
    }

    sSnap.forEach(s => {
      const data = s.data();
      const el = document.createElement('div');
      el.className = 'section-item';
      el.textContent = data.name || 'Sección';
      el.dataset.id = s.id;
      el.onclick = () => selectSection(s.id, data.name);
      sectionsList.appendChild(el);
    });

    // Auto-seleccionar primera sección SOLO si ya hay usuario logueado
    if (currentUser && !currentSectionId && sSnap.docs.length) {
      const first = sSnap.docs[0];
      selectSection(first.id, first.data().name);
    }

  } catch(e){
    console.error('loadSections', e);
    sectionsList.innerHTML = '<div class="muted">Error cargando secciones</div>';
  }
}

async function selectSection(id, nombreSeccion){
  currentSectionId = id;

  // marcar sección activa
  Array.from(sectionsList.children)
    .forEach(ch => ch.classList.toggle('active', ch.dataset.id === id));

  if (studentTitle) {
    studentTitle.textContent = nombreSeccion
      ? `Sección: ${nombreSeccion}`
      : 'Sección seleccionada';
  }

  // mostrar listado de exámenes
  show(studentScreen);
  hide(loginScreen);
  hide(examScreen);
  hide(resultScreen);

  await renderExamsForSection(id);
}

// ---------------------- RENDER EXÁMENES (FULL WIDTH) ----------------------
async function renderExamsForSection(sectionId){
  examsList.innerHTML = '';
  if (!sectionId) {
    examsList.innerHTML = '<div class="muted">Selecciona una sección</div>';
    return;
  }

  try {
    const qExams = query(
      collection(db,'exams'),
      where('sectionId','==', sectionId),
      orderBy('title')
    );
    const snap = await getDocs(qExams);

    if (snap.empty) {
      examsList.innerHTML = '<div class="muted">No hay exámenes en esta sección</div>';
      return;
    }

    draft.exams = {};
    draft.newExams = [];

    snap.forEach(e => {
      const data = e.data();
      const examId = e.id;

      draft.exams[examId] = {
        title: data.title || '',
        deleted: false
      };

      const card = document.createElement('div');
      card.className = 'examBox';
      card.dataset.eid = examId;

      const left = document.createElement('div');
      left.innerHTML = `
        <div class="title" data-title>${escapeHtml(data.title || 'Examen')}</div>
        <div class="small muted">
          ${escapeHtml(data.description || '')}
          ${data.duration ? ' · ' + data.duration + ' min' : ''}
        </div>
      `;

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.flexDirection = 'column';
      right.style.alignItems = 'flex-end';
      right.style.gap = '8px';
      right.innerHTML = `
        <div class="examAttempts" id="attempt_${examId}">0/3</div>
        <div><button class="btn viewExam" data-open="${examId}">Abrir</button></div>
      `;

      const openBtn = right.querySelector('button[data-open]');
      openBtn.onclick = () => openExam(examId);

      card.appendChild(left);
      card.appendChild(right);
      examsList.appendChild(card);

      updateAttemptsDisplay(examId);
    });

    // mostrar controles de edición solo a admin
    if (currentUser && currentUser.role === 'admin') {
      show(editButtons);
    } else {
      hide(editButtons);
    }

  } catch(e){
    console.error('renderExamsForSection', e);
    examsList.innerHTML = '<div class="muted">Error cargando exámenes</div>';
  }
}

// ---------------------- ATTEMPTS DISPLAY ----------------------
async function updateAttemptsDisplay(examId){
  try {
    if (!currentUser) return;
    const attId = `${currentUser.uid}_${examId}`;
    const aSnap = await getDoc(doc(db,'attempts', attId));
    const used = aSnap.exists() ? (aSnap.data().used || 0) : 0;
    const el = document.getElementById(`attempt_${examId}`);
    if (el) el.textContent = `${used}/3`;
  } catch(e){ console.warn('updateAttemptsDisplay', e); }
}

// ---------------------- ABRIR EXAMEN (CASOS + PREGUNTAS) ----------------------
async function openExam(examId){
  try {
    if (!currentUser) {
      alert('Inicia sesión para resolver el examen.');
      return;
    }

    const eSnap = await getDoc(doc(db,'exams', examId));
    if (!eSnap.exists()) {
      alert('Examen no encontrado');
      return;
    }
    currentExam = { id: examId, ...eSnap.data() };

    // 1) Casos clínicos del examen
    const casosSnap = await getDocs(
      query(
        collection(db,'casosClinicos'),
        where('examId','==', examId),
        orderBy('orden')
      )
    );
    const casos = [];
    casosSnap.forEach(c => {
      casos.push({ id: c.id, ...c.data() });
    });

    // 2) Preguntas del examen, agrupadas por casoId
    const pregSnap = await getDocs(
      query(
        collection(db,'preguntas'),
        where('examId','==', examId),
        orderBy('orden')
      )
    );
    const preguntasByCaso = {};
    pregSnap.forEach(p => {
      const data = p.data();
      const casoId = data.casoId || 'sinCaso';
      if (!preguntasByCaso[casoId]) preguntasByCaso[casoId] = [];
      preguntasByCaso[casoId].push({ id: p.id, ...data });
    });

    renderExamScreen(currentExam, casos, preguntasByCaso);

  } catch(e){
    console.error('openExam', e);
    alert('Error al abrir examen');
  }
}

// ---------------------- RENDER PANTALLA DE EXAMEN (A.1) ----------------------
function renderExamScreen(exam, casos, preguntasByCaso){
  hide(loginScreen);
  hide(studentScreen);
  hide(resultScreen);
  show(examScreen);

  examTitle.textContent = exam.title || 'Examen';

  examForm.innerHTML = '';

  // cálculo de preguntas totales para fallback de tiempo
  let totalPreguntas = 0;
  Object.values(preguntasByCaso).forEach(arr => totalPreguntas += arr.length);

  // temporizador
  let totalSeconds;
  if (exam.duration && typeof exam.duration === 'number' && !isNaN(exam.duration)) {
    totalSeconds = exam.duration * 60; // minutos a segundos
  } else {
    totalSeconds = Math.max(60, (totalPreguntas || 1) * 75);
  }
  startExamTimer(totalSeconds);

  // Render según formato A.1: Caso, luego sus preguntas
  let questionIndex = 1;

  casos.forEach((caso, idxCaso) => {
    // Bloque del caso clínico
    const casoBlock = document.createElement('div');
    casoBlock.className = 'questionBlock card';
    casoBlock.innerHTML = `
      <div class="questionTitle">Caso clínico ${idxCaso + 1}</div>
      <div class="caseText">
        <strong>${escapeHtml(caso.titulo || '')}</strong><br>
        ${escapeHtml(caso.texto || '')}
      </div>
    `;
    examForm.appendChild(casoBlock);

    const preguntasDelCaso = preguntasByCaso[caso.id] || [];
    preguntasDelCaso.forEach(q => {
      const qBlock = document.createElement('div');
      qBlock.className = 'questionBlock card';
      qBlock.dataset.qid = q.id;

      qBlock.innerHTML = `
        <div class="questionTitle">Pregunta ${questionIndex}</div>
        <div style="margin-top:8px"><strong>${escapeHtml(q.pregunta || '')}</strong></div>
      `;

      const optsDiv = document.createElement('div');
      optsDiv.className = 'options';

      (q.opciones || []).forEach((opt, i) => {
        const optionId = `opt_${q.id}_${i}`;
        const label = document.createElement('label');
        label.innerHTML = `
          <input type="radio" name="${q.id}" value="${i}" id="${optionId}" />
          ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}
        `;
        optsDiv.appendChild(label);
      });

      qBlock.appendChild(optsDiv);
      examForm.appendChild(qBlock);

      questionIndex++;
    });
  });

  // SI quedaran preguntas sin casoId, no las renderizamos por simplicidad.

  // Controles admin dentro del examen (desactivado el editor avanzado por ahora)
  hide(editExamButtons);

  // Finalizar examen
  btnFinishExam.onclick = async () => {
    if (!confirm('¿Deseas finalizar el examen? Esto contará como un intento.')) return;
    await finalizeExamAndGrade(exam.id);
  };
}

// ---------------------- EXAM TIMER ----------------------
function startExamTimer(totalSeconds){
  clearInterval(examTimerInterval);
  examRemainingSeconds = totalSeconds;

  function tick(){
    if (examRemainingSeconds <= 0) {
      clearInterval(examTimerInterval);
      examTimer.textContent = '00:00';
      alert('Tiempo agotado. Se finalizará el examen automáticamente.');
      btnFinishExam.click();
      return;
    }
    const mm = Math.floor(examRemainingSeconds / 60).toString().padStart(2,'0');
    const ss = (examRemainingSeconds % 60).toString().padStart(2,'0');
    examTimer.textContent = `${mm}:${ss}`;
    examRemainingSeconds--;
  }
  tick();
  examTimerInterval = setInterval(tick, 1000);
}

// ---------------------- FINALIZAR Y CALIFICAR ----------------------
async function finalizeExamAndGrade(examId){
  try {
    if (!currentUser) {
      alert('Debes estar autenticado para guardar el intento.');
      return;
    }

    // Respuestas del usuario
    const answers = {};
    const inputs = examForm.querySelectorAll('input[type=radio]:checked');
    inputs.forEach(inp => {
      answers[inp.name] = Number(inp.value);
    });

    // Obtener todas las preguntas del examen desde Firestore
    const qSnap = await getDocs(
      query(collection(db,'preguntas'), where('examId','==', examId))
    );
    const preguntas = [];
    qSnap.forEach(q => preguntas.push({ id: q.id, ...q.data() }));

    let correct = 0;
    preguntas.forEach(q => {
      const sel = answers[q.id];
      if (typeof sel === 'number' && sel === (q.correcta || 0)) correct++;
    });

    const percent = preguntas.length
      ? Math.round((correct / preguntas.length) * 100)
      : 0;

    // Registrar intento
    const attDocId = `${currentUser.uid}_${examId}`;
    const attRef = doc(db,'attempts', attDocId);
    const attSnap = await getDoc(attRef);
    let used = 0;
    if (attSnap.exists()) {
      used = (attSnap.data().used || 0) + 1;
    } else {
      used = 1;
    }
    await setDoc(attRef, {
      used,
      last: new Date().toISOString()
    });

    renderResultScreen(preguntas, answers, percent);
    await renderExamsForSection(currentSectionId);
    clearInterval(examTimerInterval);

  } catch(e){
    console.error('finalizeExamAndGrade', e);
    alert('Error finalizando examen');
  }
}

function renderResultScreen(preguntas, answers, percent){
  hide(examScreen);
  hide(loginScreen);
  hide(studentScreen);
  show(resultScreen);

  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  preguntas.forEach((q, idx) => {
    const userSel   = answers[q.id];
    const correctIx = q.correcta || 0;

    const w = document.createElement('div');
    w.className = (userSel === correctIx) ? 'result-correct card' : 'result-wrong card';
    w.style.marginBottom = '10px';

    w.innerHTML = `
      <div style="font-weight:700">Pregunta ${idx + 1}</div>
      <div style="margin-top:8px">${escapeHtml(q.pregunta || '')}</div>
    `;

    const opts = document.createElement('div');
    (q.opciones || []).forEach((opt, i) => {
      const divOpt = document.createElement('div');
      let mark = '';
      if (i === correctIx) mark = ' (Correcta)';
      if (i === userSel && i !== correctIx) mark = ' (Tu elección)';
      divOpt.textContent = `${String.fromCharCode(65 + i)}. ${opt}${mark}`;
      opts.appendChild(divOpt);
    });

    const just = document.createElement('div');
    just.className = 'small muted';
    just.style.marginTop = '8px';
    just.textContent = q.justificacion || '';

    w.appendChild(opts);
    w.appendChild(just);
    resultScreen.appendChild(w);
  });
}

// ---------------------- AUTH ----------------------
btnLogin && (btnLogin.onclick = async () => {
  const email = (inputEmail.value || '').trim();
  const pass  = (inputPassword.value || '').trim();
  if (!email || !pass) {
    loginMessage.textContent = 'Ingrese credenciales';
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginMessage.textContent = '';
  } catch(e){
    console.error('login', e);
    loginMessage.textContent = 'Credenciales inválidas';
  }
});

btnCancel && (btnCancel.onclick = () => {
  inputEmail.value = '';
  inputPassword.value = '';
  loginMessage.textContent = '';
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const uSnap = await getDoc(doc(db,'users', user.uid));
      let role = 'user';
      let estado = 'habilitado';
      let expiracion = null;

      if (uSnap.exists()) {
        const d = uSnap.data();
        role       = d.role || role;
        estado     = d.estado || estado;
        expiracion = d.expiracion || null;
      }

      currentUser = {
        uid: user.uid,
        email: user.email,
        role,
        estado,
        expiracion
      };

      // Validar expiración, si existe
      if (currentUser.expiracion) {
        try {
          const now = new Date();
          const exp = new Date(currentUser.expiracion);
          if (now > exp) {
            await updateDoc(doc(db,'users', user.uid), { estado:'inhabilitado' });
            alert('Acceso expirado');
            await signOut(auth);
            return;
          }
        } catch(e){ console.warn('exp parse', e); }
      }

      if (currentUser.role === 'admin' || currentUser.uid === ADMIN_UID) {
        currentUser.role = 'admin';
        showAdminUI();
      } else {
        currentUser.role = 'user';
        showStudentUI();
      }

    } catch(e){
      console.error('onAuthStateChanged', e);
    }

  } else {
    // usuario no autenticado
    currentUser = null;
    currentSectionId = null;
    currentExam = null;

    hide(adminSidebar);
    hide(editButtons);
    hide(editExamButtons);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    show(loginScreen);

    userInfo.textContent = '';
    authButtons.innerHTML = '';

    await loadSections();
  }
});

async function doLogout(){
  try {
    await signOut(auth);
    location.reload();
  } catch(e){
    console.error('logout', e);
  }
}

// ---------------------- UI: STUDENT / ADMIN ----------------------
async function showStudentUI(){
  hide(loginScreen);
  hide(adminSidebar);
  show(studentScreen);

  userInfo.textContent = currentUser.email || '';
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  document.getElementById('btnLogoutTop').onclick = doLogout;

  await loadSections();
}

async function showAdminUI(){
  hide(loginScreen);
  show(studentScreen);
  show(adminSidebar);

  userInfo.textContent = `${currentUser.email} (Admin)`;
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  document.getElementById('btnLogoutTop').onclick = doLogout;

  await loadSections();
}

// ---------------------- ADMIN: SECCIONES / EXÁMENES / USERS / LINKS ----------------------

// Nueva sección
adminAddSection && (adminAddSection.onclick = async () => {
  const nombre = prompt('Nombre de la nueva sección:');
  if (!nombre) return;

  try {
    await addDoc(collection(db,'sections'), {
      name: nombre,
      order: Date.now(),
      createdAt: new Date().toISOString()
    });
    alert('Sección creada');
    await loadSections();
  } catch(e){
    console.error('adminAddSection', e);
    alert('Error creando sección');
  }
});

// Nuevo examen
adminAddExam && (adminAddExam.onclick = async () => {
  if (!currentSectionId) {
    alert('Selecciona una sección antes de crear un examen.');
    return;
  }

  const title = prompt('Título del examen (ej: Simulacro 1):');
  if (!title) return;

  const description = prompt('Descripción (ej: 30 reactivos, Gastro):', '');
  const durationStr = prompt('Duración en minutos (ej: 45):', '45');
  const durationNum = durationStr ? Number(durationStr) : 0;

  try {
    await addDoc(collection(db,'exams'), {
      sectionId: currentSectionId,
      title,
      description: description || '',
      duration: isNaN(durationNum) ? 0 : durationNum,
      createdAt: new Date().toISOString()
    });
    alert('Examen creado');
    await renderExamsForSection(currentSectionId);
  } catch(e){
    console.error('adminAddExam', e);
    alert('Error creando examen');
  }
});

// Editor de preguntas (desactivado: se edita en Firestore)
adminEditQuestions && (adminEditQuestions.onclick = () => {
  alert('Por ahora, edita casos clínicos y preguntas directamente en Firestore (casosClinicos y preguntas).');
});

// Admin: ver usuarios
adminUsers && (adminUsers.onclick = async () => {
  adminSidebar.querySelectorAll('.editor-area').forEach(n => n.remove());
  const area = document.createElement('div');
  area.className = 'editor-area';
  adminSidebar.appendChild(area);

  area.innerHTML = '<h4>Usuarios</h4><div id="usersList">Cargando...</div>';
  const usersList = document.getElementById('usersList');

  try {
    const uSnap = await getDocs(collection(db,'users'));
    usersList.innerHTML = '';
    uSnap.forEach(u => {
      const d = u.data();
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '8px';
      card.innerHTML = `
        <div>
          <strong>${escapeHtml(u.id)}</strong>
          <div class="small muted">
            ${escapeHtml(d.name || d.usuario || '')} - ${escapeHtml(d.role || 'user')}
          </div>
        </div>
        <div style="margin-top:6px;">
          <button class="btn u_edit" data-uid="${u.id}">Editar</button>
          <button class="btn u_del" data-uid="${u.id}">Eliminar</button>
        </div>
      `;
      usersList.appendChild(card);
    });

    // editar usuario
    usersList.querySelectorAll('.u_edit').forEach(b => {
      b.onclick = async () => {
        const uid = b.getAttribute('data-uid');
        const docRef = doc(db,'users', uid);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};

        const nombre = prompt('Nombre visible', data.name || data.usuario || '');
        if (!nombre) return;
        const role   = prompt('Rol (user/admin)', data.role || 'user');
        const estado = prompt('Estado (habilitado/inhabilitado)', data.estado || 'habilitado');
        const expir  = prompt('Fecha expiración (YYYY-MM-DD, opcional)', data.expiracion || '');

        await setDoc(docRef, {
          name: nombre,
          role,
          estado,
          expiracion: expir
        }, { merge:true });

        alert('Usuario actualizado');
        adminUsers.onclick();
      };
    });

    // eliminar usuario (solo doc de users, NO cuenta de Auth)
    usersList.querySelectorAll('.u_del').forEach(b => {
      b.onclick = async () => {
        const uid = b.getAttribute('data-uid');
        if (!confirm('Eliminar registro de usuario en Firestore? (no elimina la cuenta de autenticación)')) return;
        await deleteDoc(doc(db,'users', uid));
        alert('Eliminado');
        adminUsers.onclick();
      };
    });

  } catch(e){
    console.error('adminUsers', e);
    usersList.innerHTML = '<div class="muted">Error cargando usuarios</div>';
  }
});

// Admin: links sociales
adminLinks && (adminLinks.onclick = async () => {
  adminSidebar.querySelectorAll('.editor-area').forEach(n => n.remove());
  const area = document.createElement('div');
  area.className = 'editor-area';
  adminSidebar.appendChild(area);

  area.innerHTML = `
    <h4>Links Sociales</h4>
    <label>Instagram</label><input id="ln_ig" />
    <label>WhatsApp</label><input id="ln_wa" />
    <label>Telegram</label><input id="ln_tg" />
    <label>TikTok</label><input id="ln_tt" />
    <div style="margin-top:8px;">
      <button id="ln_save" class="btn primary">Guardar links (UI)</button>
    </div>
    <div class="small muted" style="margin-top:6px">
      Estos links se guardan solo en la UI. Si quieres, luego los persistimos en Firestore.
    </div>
  `;

  setTimeout(() => {
    $('ln_ig').value = linkInstagram ? (linkInstagram.href || '') : '';
    $('ln_wa').value = linkWhatsApp ? (linkWhatsApp.href || '') : '';
    $('ln_tg').value = linkTelegram ? (linkTelegram.href || '') : '';
    $('ln_tt').value = linkTikTok ? (linkTikTok.href || '') : '';

    $('ln_save').onclick = () => {
      const ig = $('ln_ig').value.trim();
      const wa = $('ln_wa').value.trim();
      const tg = $('ln_tg').value.trim();
      const tt = $('ln_tt').value.trim();

      if (ig && linkInstagram) linkInstagram.href = ig;
      if (wa && linkWhatsApp)  linkWhatsApp.href = wa;
      if (tg && linkTelegram)  linkTelegram.href = tg;
      if (tt && linkTikTok)    linkTikTok.href = tt;

      alert('Links actualizados en la UI.');
    };
  }, 50);
});

// Admin Logout
adminLogout && (adminLogout.onclick = doLogout);

// ---------------------- MODO EDICIÓN DE EXÁMENES (TÍTULOS / ELIMINAR) ----------------------
btnEdit && (btnEdit.onclick = () => enterEditModeForExams());
btnSave && (btnSave.onclick = () => saveExamsDraft());

function enterEditModeForExams(){
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Solo administradores pueden editar exámenes.');
    return;
  }

  const cards = examsList.querySelectorAll('.examBox');
  cards.forEach(card => {
    const eid     = card.dataset.eid;
    const titleEl = card.querySelector('[data-title]');
    if (!titleEl) return;
    const currentTitle = titleEl.textContent;

    // input para título
    const input = document.createElement('input');
    input.className = 'exam-title-input';
    input.value     = currentTitle;
    input.dataset.eid = eid;

    // checkbox eliminar
    const delChk = document.createElement('label');
    delChk.style.display = 'block';
    delChk.style.marginTop = '6px';
    delChk.innerHTML = `<input type="checkbox" data-del="${eid}" /> Eliminar examen`;

    titleEl.parentNode.replaceChild(input, titleEl);
    const info = card.querySelector('.small');
    if (info) info.parentNode.appendChild(delChk);
  });

  // fila para agregar examen nuevo en draft (no se crea hasta guardar)
  const addRow = document.createElement('div');
  addRow.className = 'card';
  addRow.id = 'addExamRow';
  addRow.style.marginTop = '10px';
  addRow.innerHTML = `
    <h4>Agregar examen nuevo (draft)</h4>
    <input id="newExamName" placeholder="Título del examen" />
    <input id="newExamDesc" placeholder="Descripción (ej: 30 reactivos, Tema)" style="margin-top:6px;" />
    <input id="newExamDur"  placeholder="Duración en minutos (ej: 45)" style="margin-top:6px;" />
    <div style="margin-top:8px;">
      <button id="addExamTemp" class="btn primary">Agregar (en draft)</button>
    </div>
  `;
  examsList.parentNode.insertBefore(addRow, examsList.nextSibling);

  $('addExamTemp').onclick = () => {
    const name = $('newExamName').value.trim();
    const desc = $('newExamDesc').value.trim();
    const durStr = $('newExamDur').value.trim();
    const durNum = durStr ? Number(durStr) : 0;

    if (!name) {
      alert('Título requerido');
      return;
    }

    const tempId = qid();
    draft.newExams.push({
      tempId,
      title: name,
      description: desc,
      duration: isNaN(durNum) ? 0 : durNum,
      sectionId: currentSectionId
    });

    const preview = document.createElement('div');
    preview.className = 'examBox';
    preview.dataset.tempid = tempId;
    preview.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(name)}</div>
        <div class="small muted">Nuevo (draft)</div>
      </div>
      <div><button class="btn" disabled>---</button></div>
    `;
    examsList.appendChild(preview);

    $('newExamName').value = '';
    $('newExamDesc').value = '';
    $('newExamDur').value  = '';
  };

  show(btnSave);
  hide(btnEdit);
}

async function saveExamsDraft(){
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Solo administradores');
    return;
  }

  try {
    // títulos editados + marcados para borrar
    const inputs = examsList.querySelectorAll('input.exam-title-input');
    for (const inp of inputs) {
      const eid      = inp.dataset.eid;
      const newTitle = inp.value.trim();
      if (!eid) continue;
      if (!draft.exams[eid]) {
        draft.exams[eid] = { title: newTitle, deleted:false };
      } else {
        draft.exams[eid].title = newTitle;
      }
    }

    const dels = examsList.querySelectorAll('input[type=checkbox][data-del]');
    for (const d of dels) {
      const eid = d.getAttribute('data-del');
      if (d.checked) {
        if (!draft.exams[eid]) draft.exams[eid] = { title:'', deleted:true };
        else draft.exams[eid].deleted = true;
      }
    }

    // aplicar borrados (soft delete: se marca deleted:true)
    for (const [eid, obj] of Object.entries(draft.exams)) {
      if (obj.deleted) {
        try {
          await updateDoc(doc(db,'exams', eid), { deleted:true });
        } catch(err){
          console.warn('failed mark deleted', eid, err);
        }
      }
    }

    // aplicar cambios de título
    for (const [eid, obj] of Object.entries(draft.exams)) {
      if (obj.deleted) continue;
      if (obj.title !== undefined) {
        try {
          await updateDoc(doc(db,'exams', eid), { title: obj.title });
        } catch(err){
          console.warn('saveExam title update failed', eid, err);
        }
      }
    }

    // crear exámenes nuevos
    for (const nx of draft.newExams) {
      try {
        await addDoc(collection(db,'exams'), {
          sectionId: nx.sectionId,
          title: nx.title,
          description: nx.description || '',
          duration: nx.duration || 0,
          createdAt: new Date().toISOString()
        });
      } catch(err){
        console.warn('create new exam failed', nx, err);
      }
    }

    draft.exams = {};
    draft.newExams = [];

    alert('Cambios en exámenes guardados');

    hide(btnSave);
    show(btnEdit);
    const addRow = $('addExamRow');
    if (addRow) addRow.remove();

    await renderExamsForSection(currentSectionId);

  } catch(e){
    console.error('saveExamsDraft', e);
    alert('Error guardando cambios');
  }
}

// ---------------------- INIT ----------------------
async function init(){
  await loadSections();

  // Estado inicial de botones
  hide(editButtons);
  hide(editExamButtons);
  hide(btnSave);
  hide(btnSaveExam);
}
init().catch(e => console.error(e));

/* FIN DEL ARCHIVO */
