// app.js (módulo) - Plataforma Estudiante ENARM
// Requisitos: index.html debe cargar este archivo como <script type="module" src="app.js"></script>

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
  orderBy
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------------------- CONFIG FIREBASE (tuya) ----------------------
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
// UID admin que me compartiste — se usa en reglas y comprobaciones UI
const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2";

// ---------------------- UTIL DOM ----------------------
const $ = id => document.getElementById(id);

// Elementos esperados en index.html (asegúrate que existan)
const inputEmail = $('inputEmail');
const inputPassword = $('inputPassword');
const btnLogin = $('btnLogin');
const btnCancel = $('btnCancel');
const loginMessage = $('loginMessage');

const sectionsList = $('sectionsList');        // sidebar
const studentTitle = $('studentTitle');        // título sección (pantalla estudiante)
const examsList = $('examsList');              // lista de exámenes (pantalla estudiante)

const loginScreen = $('loginScreen');
const studentScreen = $('studentScreen');
const adminScreen = $('adminScreen');
const examScreen = $('examScreen');
const resultScreen = $('resultScreen');

const userInfo = $('userInfo');
const authButtons = $('authButtons');

const btnAddSection = $('btnAddSection');
const btnAddExam = $('btnAddExam');
const btnEditMode = $('btnEditMode');
const btnLinks = $('btnLinks');
const btnUsers = $('btnUsers');
const adminEditor = $('adminEditor');

const examTitle = $('examTitle');
const examTimer = $('examTimer');
const examForm = $('examForm');
const btnFinishExam = $('btnFinishExam');

const mainCountdownEl = $('mainCountdown');

const linkInstagram = $('link-instagram');
const linkWhatsApp = $('link-whatsapp');
const linkTelegram = $('link-telegram');
const linkTikTok = $('link-tiktok');

// Validaciones: si algún elemento no existe, creamos placeholders para evitar errores
function ensure(id) {
  if (!$(id)) {
    const dummy = document.createElement('div');
    dummy.id = id;
    dummy.className = 'hidden';
    document.body.appendChild(dummy);
  }
}
[
  'inputEmail','inputPassword','btnLogin','btnCancel','loginMessage',
  'sectionsList','studentTitle','examsList',
  'loginScreen','studentScreen','adminScreen','examScreen','resultScreen',
  'userInfo','authButtons','btnAddSection','btnAddExam','btnEditMode','btnLinks','btnUsers','adminEditor',
  'examTitle','examTimer','examForm','btnFinishExam','mainCountdown',
  'link-instagram','link-whatsapp','link-telegram','link-tiktok'
].forEach(ensure);

// Re-select in case created
// (reassign consts won't work; relying on globals above is fine — ensure created ids exist)

// ---------------------- ESTADO ----------------------
let currentUser = null;        // { uid, email, role, estado, expiracion }
let currentSectionId = null;
let currentExam = null;
let examTimerInterval = null;
let examRemainingSeconds = 0;

// ---------------------- UTILIDADES ----------------------
function show(el) { el && el.classList && el.classList.remove('hidden'); }
function hide(el) { el && el.classList && el.classList.add('hidden'); }
function qid(){ return 'id_' + Math.random().toString(36).slice(2,9); }

// ---------------------- COUNTDOWN PRINCIPAL (23 SEP 2026) ----------------------
function startMainCountdown(){
  try {
    const target = new Date('2026-09-23T00:00:00');
    const el = mainCountdownEl || document.createElement('div');
    function tick(){
      const now = new Date();
      let diff = Math.floor((target - now) / 1000);
      if (diff <= 0) { el.textContent = 'Evento iniciado'; return; }
      const days = Math.floor(diff / 86400); diff -= days * 86400;
      const hrs = Math.floor(diff / 3600); diff -= hrs * 3600;
      const mins = Math.floor(diff / 60); const secs = diff % 60;
      el.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }
    tick(); setInterval(tick, 1000);
  } catch(e){ console.warn('countdown err', e); }
}
startMainCountdown();

// ---------------------- CARGA DE SECCIONES ----------------------
async function loadSections(){
  sectionsList.innerHTML = '';
  try {
    const col = collection(db, 'sections');
    const snap = await getDocs(query(col, orderBy('nombre')));
    if (snap.empty) {
      // si no hay secciones, creamos una por defecto
      await addDoc(collection(db,'sections'), { nombre: 'Sección 1', createdAt: new Date().toISOString() });
      return loadSections();
    }
    snap.forEach(snapDoc => {
      const data = snapDoc.data();
      const el = document.createElement('div');
      el.className = 'section-item';
      el.textContent = data.nombre || 'Sin nombre';
      el.dataset.id = snapDoc.id;
      el.onclick = () => selectSection(snapDoc.id, data.nombre);
      if (currentSectionId === snapDoc.id) el.classList.add('active');
      sectionsList.appendChild(el);
    });
  } catch (e) { console.error('loadSections', e); }
}

// Selección de sección (muestra exámenes)
async function selectSection(id, nombre){
  currentSectionId = id;
  if (studentTitle) studentTitle.textContent = nombre || 'Sección';
  // marcar activa en UI
  Array.from(sectionsList.children).forEach(ch => {
    ch.classList.toggle('active', ch.dataset.id === id);
  });
  await loadExamsForSection(id);
}

// ---------------------- CARGA EXÁMENES POR SECCIÓN ----------------------
async function loadExamsForSection(sectionId){
  examsList.innerHTML = '';
  try {
    const q = query(collection(db, 'exams'), where('sectionId', '==', sectionId), orderBy('nombre'));
    const snap = await getDocs(q);
    if (snap.empty) {
      examsList.innerHTML = '<div class="muted">No hay exámenes en esta sección</div>';
      return;
    }
    snap.forEach(eDoc => {
      const data = eDoc.data();
      const examId = eDoc.id;
      const card = document.createElement('div');
      card.className = 'examBox';
      card.innerHTML = `
        <div>
          <div style="font-weight:700">${data.nombre || 'Examen'}</div>
          <div class="small muted">Preguntas: ${data.questionCount || 0}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div class="examAttempts" id="attempt_${examId}">0/3</div>
          <div><button class="btn" data-open="${examId}">Abrir</button></div>
        </div>
      `;
      const openBtn = card.querySelector('button[data-open]');
      openBtn.onclick = () => openExam(examId);
      examsList.appendChild(card);
      updateAttemptsDisplay(examId);
    });
  } catch (e) { console.error('loadExamsForSection', e); }
}

// ---------------------- INTENTOS (ATTEMPTS) ----------------------
async function updateAttemptsDisplay(examId){
  try {
    const attDocId = `${currentUser ? currentUser.uid : 'anon'}_${examId}`;
    const attRef = doc(db, 'attempts', attDocId);
    const snap = await getDoc(attRef);
    const used = snap.exists() ? (snap.data().used || 0) : 0;
    const el = document.getElementById(`attempt_${examId}`);
    if (el) el.textContent = `${used}/3`;
  } catch(e) { console.error('updateAttemptsDisplay', e); }
}

// ---------------------- ABRIR EXAMEN Y VALIDAR INTENTOS ----------------------
async function openExam(examId){
  try {
    if (!currentUser) return alert('Inicia sesión para abrir el examen');
    const attDocId = `${currentUser.uid}_${examId}`;
    const attRef = doc(db, 'attempts', attDocId);
    const attSnap = await getDoc(attRef);
    const used = attSnap.exists() ? (attSnap.data().used || 0) : 0;
    if (used >= 3 && currentUser.role !== 'admin') {
      return alert('Has agotado los 3 intentos para este examen.');
    }

    const eSnap = await getDoc(doc(db, 'exams', examId));
    if (!eSnap.exists()) return alert('Examen no encontrado');
    currentExam = { id: examId, ...eSnap.data() };

    // cargar preguntas
    const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId), orderBy('pregunta')));
    const questions = [];
    qSnap.forEach(q => questions.push({ id: q.id, ...q.data() }));

    if (questions.length === 0) return alert('Este examen no tiene preguntas.');

    // mostrar pantalla de examen
    renderExamScreen(currentExam, questions);
  } catch (e) { console.error('openExam', e); alert('Error al abrir examen'); }
}

// ---------------------- RENDERIZAR PANTALLA DE EXAMEN ----------------------
function renderExamScreen(exam, questions){
  // ocultar pantallas y mostrar examen
  hide(loginScreen); hide(studentScreen); hide(adminScreen); hide(resultScreen);
  show(examScreen);

  examTitle.textContent = exam.nombre || 'Examen';
  examForm.innerHTML = '';

  // tiempo total: 75 segundos por pregunta
  const totalSeconds = questions.length * 75;
  startExamTimer(totalSeconds);

  // Render preguntas
  questions.forEach((q, idx) => {
    const qBlock = document.createElement('div');
    qBlock.className = 'questionBlock card';
    qBlock.innerHTML = `
      <div class="questionTitle">Pregunta ${idx + 1}</div>
      ${ q.casoClinico ? `<div class="caseText"><strong>Caso:</strong> ${escapeHtml(q.casoClinico)}</div>` : '' }
      <div style="margin-top:8px"><strong>${escapeHtml(q.pregunta)}</strong></div>
    `;
    const optsDiv = document.createElement('div');
    optsDiv.className = 'options';
    (q.opciones || []).forEach((opt, optIdx) => {
      const optionId = `opt_${q.id}_${optIdx}`;
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="${q.id}" value="${optIdx}" id="${optionId}" /> ${String.fromCharCode(65 + optIdx)}. ${escapeHtml(opt)}`;
      optsDiv.appendChild(label);
    });
    // store correct index and justification as data attributes (not visible to students)
    qBlock.appendChild(optsDiv);
    const justDiv = document.createElement('div');
    justDiv.className = 'justification hidden';
    justDiv.textContent = q.justificacion || '';
    qBlock.appendChild(justDiv);
    examForm.appendChild(qBlock);
  });

  // finish handler assigned below (to avoid duplicates)
  btnFinishExam.onclick = async () => {
    if (!confirm('¿Deseas finalizar el examen? Esto contará como un intento.')) return;
    await finalizeExamAndGrade(exam.id);
  };
}

// ---------------------- TEMPORIZADOR DEL EXAMEN ----------------------
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

// ---------------------- FINALIZAR EXAMEN, CALIFICAR Y MOSTRAR RESULTADOS ----------------------
async function finalizeExamAndGrade(examId){
  try {
    // recoger respuestas seleccionadas
    const answers = {}; // { questionId: selectedIndex }
    const inputs = examForm.querySelectorAll('input[type=radio]:checked');
    inputs.forEach(inp => {
      answers[inp.name] = Number(inp.value);
    });

    // recuperar preguntas para comparar (asegura veracidad)
    const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId)));
    const questions = [];
    qSnap.forEach(q => questions.push({ id: q.id, ...q.data() }));

    let correct = 0;
    questions.forEach(q => {
      const selected = answers[q.id];
      if (typeof selected === 'number' && selected === (q.correcta || 0)) correct++;
    });

    const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;

    // incrementar intento
    const attDocId = `${currentUser.uid}_${examId}`;
    const attRef = doc(db, 'attempts', attDocId);
    const attSnap = await getDoc(attRef);
    const used = attSnap.exists() ? (attSnap.data().used || 0) : 0;
    await setDoc(attRef, { used: used + 1, last: new Date().toISOString() });

    // Mostrar pantalla de resultados con detalle
    renderResultScreen(questions, answers, percent);

    // actualizar intentos en listado
    await loadExamsForSection(currentSectionId);

    // limpiar timer
    clearInterval(examTimerInterval);
  } catch (e) { console.error('finalizeExamAndGrade', e); alert('Error al finalizar examen'); }
}

function renderResultScreen(questions, answers, percent){
  hide(examScreen); hide(loginScreen); hide(studentScreen); hide(adminScreen);
  show(resultScreen);
  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  questions.forEach((q, idx) => {
    const userSel = answers[q.id];
    const correctIdx = q.correcta || 0;
    const wrapper = document.createElement('div');
    wrapper.className = (userSel === correctIdx) ? 'result-correct card' : 'result-wrong card';
    wrapper.style.marginBottom = '10px';
    wrapper.innerHTML = `<div style="font-weight:700">Pregunta ${idx+1}</div>
      <div style="margin-top:8px">${escapeHtml(q.pregunta)}</div>
    `;
    const opts = document.createElement('div');
    (q.opciones || []).forEach((opt, i) => {
      const optDiv = document.createElement('div');
      let mark = '';
      if (i === correctIdx) mark = ' (Correcta)';
      if (i === userSel && i !== correctIdx) mark = ' (Tu elección)';
      optDiv.textContent = `${String.fromCharCode(65 + i)}. ${opt}${mark}`;
      opts.appendChild(optDiv);
    });
    const just = document.createElement('div');
    just.className = 'small muted';
    just.style.marginTop = '8px';
    just.textContent = q.justificacion || '';
    wrapper.appendChild(opts);
    wrapper.appendChild(just);
    resultScreen.appendChild(wrapper);
  });
}

// ---------------------- AUTH (LOGIN / LOGOUT / ON STATE) ----------------------
btnLogin && (btnLogin.onclick = async () => {
  const email = (inputEmail && inputEmail.value || '').trim();
  const password = (inputPassword && inputPassword.value || '').trim();
  if (!email || !password) { if (loginMessage) loginMessage.textContent = 'Ingrese credenciales'; return; }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // después de iniciar sesión, onAuthStateChanged manejará el UI
    loginMessage && (loginMessage.textContent = '');
  } catch(e) {
    console.error('login err', e);
    loginMessage && (loginMessage.textContent = 'Credenciales inválidas');
  }
});

btnCancel && (btnCancel.onclick = () => {
  if (inputEmail) inputEmail.value = '';
  if (inputPassword) inputPassword.value = '';
  if (loginMessage) loginMessage.textContent = '';
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // obtener doc users para role y estado si existe
    try {
      const uDocRef = doc(db, 'users', user.uid);
      const uSnap = await getDoc(uDocRef);
      let role = 'estudiante', estado = 'habilitado', expiracion = null;
      if (uSnap.exists()) {
        const d = uSnap.data();
        role = d.role || role;
        estado = d.estado || estado;
        expiracion = d.expiracion || null;
      }
      currentUser = { uid: user.uid, email: user.email, role, estado, expiracion };

      // verificar expiración
      if (currentUser.expiracion) {
        const now = new Date();
        const exp = new Date(currentUser.expiracion);
        if (now > exp) {
          alert('Tu acceso ha expirado. Contacta al administrador.');
          await signOut(auth);
          return;
        }
      }

      // mostrar UI segun role
      if (currentUser.role === 'admin' || currentUser.uid === ADMIN_UID) {
        currentUser.role = 'admin';
        showAdminUI();
      } else {
        currentUser.role = 'estudiante';
        showStudentUI();
      }
    } catch (e) {
      console.error('onAuthStateChanged read user', e);
    }
  } else {
    // no user -> mostrar login
    currentUser = null;
    hide(adminScreen); hide(studentScreen); hide(examScreen); hide(resultScreen);
    show(loginScreen);
    userInfo && (userInfo.textContent = '');
    authButtons && (authButtons.innerHTML = '');
    // cargar secciones en la vista sin login
    await loadSections();
  }
});

// LOGOUT handler rendered in authButtons by showStudentUI / showAdminUI
async function doLogout(){
  try { await signOut(auth); location.reload(); } catch(e){ console.error('logout', e); }
}

// ---------------------- UI: ESTUDIANTE y ADMIN ----------------------
async function showStudentUI(){
  hide(loginScreen); hide(adminScreen); hide(resultScreen);
  show(studentScreen);
  userInfo && (userInfo.textContent = currentUser.email || '');
  authButtons && (authButtons.innerHTML = `<button id="btnLogout" class="btn">Salir</button>`);
  // attach logout
  const b = document.getElementById('btnLogout');
  if (b) b.onclick = doLogout;
  await loadSections();
  // seleccionar la primera sección por defecto
  const sSnap = await getDocs(collection(db,'sections'));
  if (sSnap.docs.length) selectSection(sSnap.docs[0].id, sSnap.docs[0].data().nombre);
}

async function showAdminUI(){
  hide(loginScreen); hide(studentScreen); hide(resultScreen);
  show(adminScreen);
  userInfo && (userInfo.textContent = `${currentUser.email} (Admin)`);
  authButtons && (authButtons.innerHTML = `<button id="btnLogout" class="btn">Salir</button>`);
  const b = document.getElementById('btnLogout');
  if (b) b.onclick = doLogout;
  await loadSections();
  // seleccionar primera sección por defecto
  const sSnap = await getDocs(collection(db,'sections'));
  if (sSnap.docs.length) selectSection(sSnap.docs[0].id, sSnap.docs[0].data().nombre);
}

// ---------------------- ADMIN: ACCIONES (CRUD) ----------------------

// Agregar sección
btnAddSection && (btnAddSection.onclick = async () => {
  const nombre = prompt('Nombre de la nueva sección:');
  if (!nombre) return;
  try {
    await addDoc(collection(db,'sections'), { nombre, createdAt: new Date().toISOString() });
    alert('Sección creada');
    await loadSections();
  } catch(e) { console.error('addSection', e); alert('Error creando sección'); }
});

// Agregar examen (dentro de sección seleccionada)
btnAddExam && (btnAddExam.onclick = async () => {
  if (!currentSectionId) return alert('Selecciona una sección antes');
  const nombre = prompt('Nombre del examen:');
  if (!nombre) return;
  try {
    const exRef = await addDoc(collection(db,'exams'), { nombre, sectionId: currentSectionId, questionCount: 0, createdAt: new Date().toISOString() });
    alert('Examen creado. Ahora agrega preguntas (Editar).');
    await loadExamsForSection(currentSectionId);
  } catch(e) { console.error('addExam', e); alert('Error creando examen'); }
});

// Edit mode: listar secciones y exámenes para editar
btnEditMode && (btnEditMode.onclick = async () => {
  adminEditor.innerHTML = '<h4>Editor</h4>';
  // secciones
  const sSnap = await getDocs(query(collection(db,'sections'), orderBy('nombre')));
  sSnap.forEach(s => {
    const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '8px';
    div.innerHTML = `<strong>${escapeHtml(s.data().nombre)}</strong> <button class="btn" data-sid="${s.id}">Editar</button>`;
    adminEditor.appendChild(div);
  });
  // exámenes
  const eSnap = await getDocs(query(collection(db,'exams'), orderBy('nombre')));
  eSnap.forEach(e => {
    const div = document.createElement('div'); div.className = 'card'; div.style.marginBottom = '8px';
    div.innerHTML = `<strong>${escapeHtml(e.data().nombre)}</strong> (sección: ${escapeHtml(e.data().sectionId || '')}) <button class="btn" data-eid="${e.id}">Editar examen</button>`;
    adminEditor.appendChild(div);
  });

  // handlers
  adminEditor.querySelectorAll('[data-sid]').forEach(btn => {
    btn.onclick = async () => {
      const sid = btn.getAttribute('data-sid');
      const newName = prompt('Nuevo nombre de la sección:');
      if (!newName) return;
      try { await updateDoc(doc(db,'sections',sid), { nombre: newName }); alert('Sección actualizada'); loadSections(); } catch(e){ console.error(e); alert('error'); }
    };
  });

  adminEditor.querySelectorAll('[data-eid]').forEach(btn => {
    btn.onclick = () => openExamEditor(btn.getAttribute('data-eid'));
  });
});

// Abrir editor de preguntas para un examen
async function openExamEditor(examId){
  adminEditor.innerHTML = '<h4>Editor de preguntas</h4>';
  const eSnap = await getDoc(doc(db,'exams',examId));
  if (!eSnap.exists()) return adminEditor.append('Examen no encontrado');
  adminEditor.innerHTML += `<div style="margin-bottom:8px"><strong>${escapeHtml(eSnap.data().nombre)}</strong></div>`;

  // listar preguntas
  const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId), orderBy('pregunta')));
  qSnap.forEach(q => {
    const d = document.createElement('div'); d.className = 'card'; d.style.marginBottom = '8px';
    d.innerHTML = `
      <div style="font-weight:700">${escapeHtml(q.data().pregunta)}</div>
      <div style="margin-top:8px">
        <button class="btn" data-qid="${q.id}">Editar</button>
        <button class="btn" data-del="${q.id}">Eliminar</button>
      </div>
    `;
    adminEditor.appendChild(d);
  });

  // botón agregar pregunta
  const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = 'Agregar pregunta';
  btn.onclick = () => showQuestionForm(examId);
  adminEditor.appendChild(btn);

  // handlers editar/eliminar
  adminEditor.querySelectorAll('[data-qid]').forEach(b => {
    b.onclick = async () => {
      const qid = b.getAttribute('data-qid');
      const qDoc = await getDoc(doc(db,'questions', qid));
      if (!qDoc.exists()) return alert('Pregunta no encontrada');
      const data = qDoc.data();
      const newPregunta = prompt('Editar pregunta:', data.pregunta || '');
      if (!newPregunta) return;
      await updateDoc(doc(db,'questions', qid), { pregunta: newPregunta });
      alert('Pregunta actualizada');
      openExamEditor(examId);
    };
  });

  adminEditor.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Eliminar pregunta?')) return;
      const qid = b.getAttribute('data-del');
      await deleteDoc(doc(db,'questions', qid));
      alert('Eliminada');
      openExamEditor(examId);
    };
  });
}

// Form para agregar una nueva pregunta
function showQuestionForm(examId){
  const form = document.createElement('div'); form.className = 'card'; form.style.marginTop = '8px';
  form.innerHTML = `
    <div><label>Caso clínico (opcional)</label><textarea id="q_caso" rows="3" style="width:100%"></textarea></div>
    <div style="margin-top:8px"><label>Pregunta</label><input id="q_preg" style="width:100%"/></div>
    <div style="margin-top:8px"><label>Opción A</label><input id="q_a" style="width:100%"/></div>
    <div style="margin-top:8px"><label>Opción B</label><input id="q_b" style="width:100%"/></div>
    <div style="margin-top:8px"><label>Opción C</label><input id="q_c" style="width:100%"/></div>
    <div style="margin-top:8px"><label>Opción D</label><input id="q_d" style="width:100%"/></div>
    <div style="margin-top:8px"><label>Índice correcto (0 = A, 1 = B, ...)</label><input id="q_index" style="width:100%"/></div>
    <div style="margin-top:8px"><label>Justificación</label><textarea id="q_just" rows="2" style="width:100%"></textarea></div>
    <div class="row" style="margin-top:10px"><button id="q_save" class="btn primary">Guardar</button></div>
  `;
  adminEditor.appendChild(form);
  document.getElementById('q_save').onclick = async () => {
    const caso = document.getElementById('q_caso').value.trim();
    const pregunta = document.getElementById('q_preg').value.trim();
    const a = document.getElementById('q_a').value.trim();
    const b = document.getElementById('q_b').value.trim();
    const c = document.getElementById('q_c').value.trim();
    const d = document.getElementById('q_d').value.trim();
    const idx = Number(document.getElementById('q_index').value || 0);
    const just = document.getElementById('q_just').value.trim();
    const opciones = [a,b,c,d].filter(x => x !== '');
    if (!pregunta || opciones.length === 0) return alert('Pregunta y al menos una opción son requeridos');
    try {
      await addDoc(collection(db,'questions'), {
        examId,
        casoClinico: caso,
        pregunta,
        opciones,
        correcta: idx,
        justificacion: just,
        createdAt: new Date().toISOString()
      });
      // actualizar conteo de preguntas en el examen
      const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId)));
      await updateDoc(doc(db,'exams', examId), { questionCount: qSnap.size });
      alert('Pregunta guardada');
      openExamEditor(examId);
    } catch (e) { console.error('save question', e); alert('Error al guardar pregunta'); }
  };
}

// ---------------------- LINKS (SOCIALES) ----------------------
btnLinks && (btnLinks.onclick = async () => {
  // Para persistir links en Firestore crear colección 'meta' o 'settings'. Por simplicidad actualizamos solo en UI.
  const ig = prompt('Link Instagram', linkInstagram ? linkInstagram.href : 'https://instagram.com');
  const wa = prompt('Link WhatsApp', linkWhatsApp ? linkWhatsApp.href : 'https://wa.me');
  const tg = prompt('Link Telegram', linkTelegram ? linkTelegram.href : 'https://t.me');
  const tt = prompt('Link TikTok', linkTikTok ? linkTikTok.href : 'https://tiktok.com');
  if (ig && linkInstagram) linkInstagram.href = ig;
  if (wa && linkWhatsApp) linkWhatsApp.href = wa;
  if (tg && linkTelegram) linkTelegram.href = tg;
  if (tt && linkTikTok) linkTikTok.href = tt;
  // Si quieres persistir estos links, crear doc en collection('settings','socials') y guardarlos allí.
  alert('Links actualizados en la UI. Para persistirlos en Firestore dime y lo agrego.');
});

// ---------------------- ADMIN: GESTION USUARIOS (colección users) ----------------------
btnUsers && (btnUsers.onclick = async () => {
  adminEditor.innerHTML = '<h4>Usuarios</h4>';
  const uSnap = await getDocs(collection(db,'users'));
  uSnap.forEach(u => {
    const d = document.createElement('div'); d.className = 'card'; d.style.marginBottom = '8px';
    const data = u.data();
    d.innerHTML = `<strong>${u.id}</strong> - ${escapeHtml(data.role || 'estudiante')} - ${escapeHtml(data.estado || 'habilitado')}
      <div style="margin-top:8px">
        <button class="btn" data-uid="${u.id}">Editar</button>
        <button class="btn" data-del="${u.id}">Eliminar</button>
      </div>
    `;
    adminEditor.appendChild(d);
  });

  adminEditor.querySelectorAll('[data-uid]').forEach(b => {
    b.onclick = async () => {
      const uid = b.getAttribute('data-uid');
      const dRef = doc(db,'users', uid);
      const dSnap = await getDoc(dRef);
      const data = dSnap.exists() ? dSnap.data() : {};
      const nuevoRole = prompt('Rol (estudiante/admin):', data.role || 'estudiante');
      const estado = prompt('Estado (habilitado/inhabilitado):', data.estado || 'habilitado');
      const expir = prompt('Fecha expiración (YYYY-MM-DD) (vacío = sin expiración):', data.expiracion || '');
      await setDoc(dRef, { ...data, role: nuevoRole, estado, expiracion: expir });
      alert('Usuario actualizado (nota: para crear cuenta Auth crea el usuario en Firebase Console).');
      btnUsers.click();
    };
  });

  adminEditor.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Eliminar registro de usuario? (esto NO elimina la cuenta de Auth)')) return;
      const uid = b.getAttribute('data-del');
      await deleteDoc(doc(db,'users', uid));
      alert('Eliminado');
      btnUsers.click();
    };
  });

  // botón crear usuario (registro en collection users; la creación en Auth debe hacerse desde console o Cloud Function)
  const addBtn = document.createElement('button'); addBtn.className='btn'; addBtn.textContent = 'Agregar nuevo (solo registro)';
  addBtn.onclick = async () => {
    const uid = prompt('UID (debe coincidir con Auth si luego crearás la cuenta) (ej. correo sin @):', '');
    const user = prompt('Nombre de usuario (visible):', '');
    const role = prompt('Rol (estudiante/admin):', 'estudiante');
    const estado = prompt('estado (habilitado/inhabilitado):', 'habilitado');
    const expir = prompt('Fecha expiración (YYYY-MM-DD) (vacío = sin expiración):', '');
    if (!uid || !user) return alert('UID y nombre requerido');
    await setDoc(doc(db,'users', uid), { usuario: user, role, estado, expiracion: expir });
    alert('Usuario agregado en colección users. Recuerda crear la cuenta en Firebase Auth si quieres que inicie sesión.');
    btnUsers.click();
  };
  adminEditor.appendChild(addBtn);
});

// ---------------------- UTILIDADES ADICIONALES ----------------------
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------- INICIALIZACION ----------------------
// cargar secciones initial
loadSections().catch(e=>console.error(e));

// Si quieres pre-cargar links sociales desde Firestore, lee collection('settings'). Not implemented por defecto.
