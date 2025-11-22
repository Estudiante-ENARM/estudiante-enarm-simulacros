// app.js - Reescrito completo (editor integrado en main, admin right bar, draft mode)
// Requisitos: modular Firebase CDN (v9.x) - ya usado en tu proyecto.
// No borra datos; auto-reconstrucción solo crea defaults si faltan colecciones mínimas.

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

// ---------------------- CONFIG FIREBASE (mantén tus credenciales) ----------------------
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
const sectionsList = $('sectionsList');
const mainContent = $('mainContent'); // wrapper used in index, but we still use specific screens inside it
const loginScreen = $('loginScreen');
const studentScreen = $('studentScreen');
const examsList = $('examsList');
const editButtons = $('editButtons');
const btnEdit = $('btnEdit');
const btnSave = $('btnSave');

// Exam screen
const examScreen = $('examScreen');
const examTitle = $('examTitle');
const examTimer = $('examTimer');
const examForm = $('examForm');
const btnFinishExam = $('btnFinishExam');
const editExamButtons = $('editExamButtons');
const btnEditExam = $('btnEditExam');
const btnSaveExam = $('btnSaveExam');

// Results
const resultScreen = $('resultScreen');

// Top / auth
const inputEmail = $('inputEmail');
const inputPassword = $('inputPassword');
const btnLogin = $('btnLogin');
const btnCancel = $('btnCancel');
const loginMessage = $('loginMessage');
const userInfo = $('userInfo');
const authButtons = $('authButtons');

// Admin right sidebar (buttons)
const adminSidebar = $('adminSidebar');
const adminAddSection = $('adminAddSection');
const adminAddExam = $('adminAddExam');
const adminEditQuestions = $('adminEditQuestions');
const adminUsers = $('adminUsers');
const adminLinks = $('adminLinks');
const adminLogout = $('adminLogout');

// Socials / countdown
const mainCountdownEl = $('mainCountdown');
const linkInstagram = $('link-instagram');
const linkWhatsApp = $('link-whatsapp');
const linkTelegram = $('link-telegram');
const linkTikTok = $('link-tiktok');

// ensure placeholders exist (in case some IDs missing)
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
  'mainCountdown','link-instagram','link-whatsapp','link-telegram','link-tiktok'
].forEach(ensure);

// ---------------------- ESTADO GLOBAL ----------------------
let currentUser = null;      // {uid, email, role, estado, expiracion}
let currentSectionId = null;
let currentExam = null;      // { id, nombre, ... }
let examTimerInterval = null;
let examRemainingSeconds = 0;

// Draft state for admin edits (not persisted until Save)
let draft = {
  exams: {},      // examId -> { nombre, deleted:bool, new:bool }
  questions: {},  // questionId -> { examId, pregunta, opciones, correcta, justificacion, deleted, new }
  newExams: []    // temporary new exam objects { tempId, nombre }
};

// ---------------------- UTILIDADES ----------------------
function show(el){ if(!el) return; el.classList.remove('hidden'); }
function hide(el){ if(!el) return; el.classList.add('hidden'); }
function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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
      const hrs = Math.floor(diff/3600); diff -= hrs*3600;
      const mins = Math.floor(diff/60); const secs = diff%60;
      el.textContent = `${days}d ${hrs}h ${mins}m ${secs}s`;
    }
    tick(); setInterval(tick,1000);
  } catch(e){ console.warn(e); }
}
startMainCountdown();

// ---------------------- AUTO-RECONSTRUCT ----------------------
let _autoRan = false;
async function ensureDefaults(){
  if (!AUTO_RECONSTRUCT_ENABLED || _autoRan) return;
  _autoRan = true;
  try {
    const sSnap = await getDocs(query(collection(db,'sections'), orderBy('nombre'), limit(1)));
    if (sSnap.empty) {
      await addDoc(collection(db,'sections'), { nombre: 'Sección 1', createdAt: new Date().toISOString() });
    }
    const uSnap = await getDocs(query(collection(db,'users'), limit(1)));
    if (uSnap.empty) {
      await setDoc(doc(db,'users', ADMIN_UID), { usuario:'admin', role:'admin', estado:'habilitado', expiracion: '' });
    }
    // optionally ensure exams/others don't auto create content (we keep them untouched)
  } catch(e){ console.warn('ensureDefaults', e); }
}

// ---------------------- CARGA Y RENDER SECCIONES ----------------------
async function loadSections(){
  sectionsList.innerHTML = '';
  try {
    await ensureDefaults();
    const sSnap = await getDocs(query(collection(db,'sections'), orderBy('nombre')));
    if (sSnap.empty) {
      const docRef = await addDoc(collection(db,'sections'), { nombre:'Sección 1', createdAt: new Date().toISOString() });
      return loadSections();
    }
    sSnap.forEach(s => {
      const el = document.createElement('div');
      el.className = 'section-item';
      el.textContent = s.data().nombre || 'Sección';
      el.dataset.id = s.id;
      el.onclick = () => selectSection(s.id, s.data().nombre);
      sectionsList.appendChild(el);
    });
    // auto-select first if none
    if (!currentSectionId && sSnap.docs.length) selectSection(sSnap.docs[0].id, sSnap.docs[0].data().nombre);
  } catch(e){ console.error('loadSections', e); sectionsList.innerHTML = '<div class="muted">Error cargando secciones</div>'; }
}

async function selectSection(id, nombre){
  currentSectionId = id;
  // mark active
  Array.from(sectionsList.children).forEach(ch => ch.classList.toggle('active', ch.dataset.id === id));
  // show studentScreen and render exams
  show(studentScreen);
  hide(loginScreen); hide(examScreen); hide(resultScreen);
  await renderExamsForSection(id);
}

// ---------------------- RENDER EXÁMENES (FULL WIDTH) ----------------------
async function renderExamsForSection(sectionId){
  examsList.innerHTML = '';
  if (!sectionId) { examsList.innerHTML = '<div class="muted">Selecciona una sección</div>'; return; }
  try {
    // Load exams for this section
    const q = query(collection(db,'exams'), where('sectionId','==', sectionId), orderBy('nombre'));
    const snap = await getDocs(q);
    if (snap.empty) { examsList.innerHTML = '<div class="muted">No hay exámenes en esta sección</div>'; return; }

    // clear draft slot for exams
    draft.exams = {};
    draft.newExams = [];

    snap.forEach(e => {
      const data = e.data();
      const examId = e.id;
      // register in draft so admin can edit locally
      draft.exams[examId] = { nombre: data.nombre || '', deleted: false, new: false };

      const card = document.createElement('div');
      card.className = 'examBox';
      card.dataset.eid = examId;

      const left = document.createElement('div');
      left.innerHTML = `<div style="font-weight:700" data-title>${escapeHtml(data.nombre || 'Examen')}</div>
                       <div class="small muted">Preguntas: ${data.questionCount || 0}</div>`;

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.flexDirection = 'column';
      right.style.alignItems = 'flex-end';
      right.style.gap = '8px';
      right.innerHTML = `<div class="examAttempts" id="attempt_${examId}">0/3</div>
                         <div><button class="btn viewExam" data-open="${examId}">Abrir</button></div>`;

      const openBtn = right.querySelector('button[data-open]');
      openBtn.onclick = () => openExam(examId);

      card.appendChild(left);
      card.appendChild(right);

      examsList.appendChild(card);
      updateAttemptsDisplay(examId);
    });

    // If current user admin -> show edit controls
    if (currentUser && currentUser.role === 'admin') {
      show(editButtons);
    } else {
      hide(editButtons);
    }

  } catch(e){ console.error('renderExamsForSection', e); examsList.innerHTML = '<div class="muted">Error cargando exámenes</div>'; }
}

// ---------------------- ATTEMPTS DISPLAY ----------------------
async function updateAttemptsDisplay(examId){
  try {
    const attId = `${currentUser ? currentUser.uid : 'anon'}_${examId}`;
    const aSnap = await getDoc(doc(db,'attempts', attId));
    const used = aSnap.exists() ? (aSnap.data().used || 0) : 0;
    const el = document.getElementById(`attempt_${examId}`);
    if (el) el.textContent = `${used}/3`;
  } catch(e) { console.warn(e); }
}

// ---------------------- ABRIR EXAMEN (MUESTRA PREGUNTAS) ----------------------
async function openExam(examId){
  try {
    // fetch exam
    const eSnap = await getDoc(doc(db,'exams',examId));
    if (!eSnap.exists()) return alert('Examen no encontrado');
    currentExam = { id: examId, ...eSnap.data() };

    // fetch questions
    const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId), orderBy('pregunta')));
    const questions = [];
    qSnap.forEach(q => questions.push({ id: q.id, ...q.data() }));

    // render
    renderExamScreen(currentExam, questions);

  } catch(e){ console.error('openExam', e); alert('Error al abrir examen'); }
}

function renderExamScreen(exam, questions){
  hide(loginScreen); hide(studentScreen); hide(resultScreen);
  show(examScreen);

  examTitle.textContent = exam.nombre || 'Examen';
  examForm.innerHTML = '';

  // timer: 75s per question or 60s minimum
  const totalSeconds = Math.max(60, (questions.length || 1) * 75);
  startExamTimer(totalSeconds);

  // Render each question (student view)
  questions.forEach((q, idx) => {
    const qBlock = document.createElement('div');
    qBlock.className = 'questionBlock card';
    qBlock.dataset.qid = q.id;

    const titleHtml = `<div class="questionTitle">Pregunta ${idx+1}</div>
      ${ q.casoClinico ? `<div class="caseText"><strong>Caso:</strong> ${escapeHtml(q.casoClinico)}</div>` : '' }
      <div style="margin-top:8px"><strong>${escapeHtml(q.pregunta)}</strong></div>`;

    qBlock.innerHTML = titleHtml;

    const optsDiv = document.createElement('div'); optsDiv.className = 'options';
    (q.opciones || []).forEach((opt, i) => {
      const optionId = `opt_${q.id}_${i}`;
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="${q.id}" value="${i}" id="${optionId}" /> ${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}`;
      optsDiv.appendChild(label);
    });
    qBlock.appendChild(optsDiv);

    // hidden justification
    const just = document.createElement('div');
    just.className = 'justification hidden';
    just.textContent = q.justificacion || '';
    qBlock.appendChild(just);

    examForm.appendChild(qBlock);
  });

  // admin edit controls per exam
  if (currentUser && currentUser.role === 'admin') show(editExamButtons);
  else hide(editExamButtons);

  // finish handler
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
  examTimerInterval = setInterval(tick,1000);
}

// ---------------------- FINALIZAR Y CALIFICAR ----------------------
async function finalizeExamAndGrade(examId){
  try {
    const answers = {};
    const inputs = examForm.querySelectorAll('input[type=radio]:checked');
    inputs.forEach(inp => { answers[inp.name] = Number(inp.value); });

    const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId)));
    const questions = [];
    qSnap.forEach(q => questions.push({ id:q.id, ...q.data() }));

    let correct = 0;
    questions.forEach(q => {
      const sel = answers[q.id];
      if (typeof sel === 'number' && sel === (q.correcta || 0)) correct++;
    });

    const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;

    // incrementar intento
    const attDocId = `${currentUser.uid}_${examId}`;
    await setDoc(doc(db,'attempts',attDocId), { used: ( (await getDoc(doc(db,'attempts',attDocId))).exists() ? (await getDoc(doc(db,'attempts',attDocId))).data().used + 1 : 1 ), last: new Date().toISOString() });

    renderResultScreen(questions, answers, percent);
    await renderExamsForSection(currentSectionId);
    clearInterval(examTimerInterval);
  } catch(e){ console.error('finalizeExamAndGrade', e); alert('Error finalizando examen'); }
}

function renderResultScreen(questions, answers, percent){
  hide(examScreen); hide(loginScreen); hide(studentScreen);
  show(resultScreen);
  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  questions.forEach((q, idx) => {
    const userSel = answers[q.id];
    const correctIdx = q.correcta || 0;
    const w = document.createElement('div');
    w.className = (userSel === correctIdx) ? 'result-correct card' : 'result-wrong card';
    w.style.marginBottom = '10px';
    w.innerHTML = `<div style="font-weight:700">Pregunta ${idx+1}</div>
      <div style="margin-top:8px">${escapeHtml(q.pregunta)}</div>`;

    const opts = document.createElement('div');
    (q.opciones || []).forEach((opt,i) => {
      const divOpt = document.createElement('div');
      let mark = '';
      if (i === correctIdx) mark = ' (Correcta)';
      if (i === userSel && i !== correctIdx) mark = ' (Tu elección)';
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
  const pass = (inputPassword.value || '').trim();
  if (!email || !pass) { loginMessage.textContent = 'Ingrese credenciales'; return; }
  try { await signInWithEmailAndPassword(auth, email, pass); loginMessage.textContent = ''; }
  catch(e) { console.error('login', e); loginMessage.textContent = 'Credenciales inválidas'; }
});
btnCancel && (btnCancel.onclick = ()=>{ inputEmail.value=''; inputPassword.value=''; loginMessage.textContent=''; });

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const uSnap = await getDoc(doc(db,'users', user.uid));
      let role = 'estudiante', estado='habilitado', expiracion=null;
      if (uSnap.exists()) { const d = uSnap.data(); role = d.role || role; estado = d.estado || estado; expiracion = d.expiracion || null; }
      currentUser = { uid:user.uid, email:user.email, role, estado, expiracion };

      // expiracion check
      if (currentUser.expiracion) {
        try {
          const now = new Date(); const exp = new Date(currentUser.expiracion);
          if (now > exp) { await updateDoc(doc(db,'users',user.uid), { estado:'inhabilitado' }); alert('Acceso expirado'); await signOut(auth); return; }
        } catch(e){ console.warn('exp parse', e); }
      }

      if (currentUser.role === 'admin' || currentUser.uid === ADMIN_UID) {
        currentUser.role = 'admin';
        showAdminUI();
      } else {
        currentUser.role = 'estudiante';
        showStudentUI();
      }
    } catch(e){ console.error('onAuthStateChanged', e); }
  } else {
    currentUser = null;
    hide(adminSidebar);
    hide(editButtons);
    hide(editExamButtons);
    hide(studentScreen); hide(examScreen); hide(resultScreen);
    show(loginScreen);
    userInfo.textContent = '';
    authButtons.innerHTML = '';
    await loadSections();
  }
});

async function doLogout(){
  try { await signOut(auth); location.reload(); } catch(e){ console.error('logout', e); }
}

// ---------------------- UI: STUDENT / ADMIN ----------------------
async function showStudentUI(){
  hide(loginScreen); hide(adminSidebar);
  show(studentScreen);
  userInfo.textContent = currentUser.email || '';
  authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
  document.getElementById('btnLogoutTop').onclick = doLogout;
  await loadSections();
  // default select first
  const sSnap = await getDocs(collection(db,'sections'));
  if (sSnap.docs.length) selectSection(sSnap.docs[0].id, sSnap.docs[0].data().nombre);
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

// ---------------------- ADMIN ACTIONS: SECCIONES / EXÁMENES / LINKS / USERS (editor full) ----------------------

// Add Section (admin right sidebar)
adminAddSection && (adminAddSection.onclick = async () => {
  const nombre = prompt('Nombre de la nueva sección:');
  if (!nombre) return;
  try { await addDoc(collection(db,'sections'), { nombre, createdAt: new Date().toISOString() }); alert('Sección creada'); await loadSections(); }
  catch(e){ console.error('adminAddSection', e); alert('Error creando sección'); }
});

// Add Exam within current section -> opens editor for that new exam
adminAddExam && (adminAddExam.onclick = async () => {
  if (!currentSectionId) return alert('Selecciona una sección antes');
  const nombre = prompt('Nombre del examen nuevo:');
  if (!nombre) return;
  try {
    const exRef = await addDoc(collection(db,'exams'), { nombre, sectionId: currentSectionId, questionCount: 0, createdAt: new Date().toISOString() });
    alert('Examen creado. Ahora abre el editor para agregar preguntas.');
    openExamEditor(exRef.id); // open as admin
    await renderExamsForSection(currentSectionId);
  } catch(e){ console.error('adminAddExam', e); alert('Error creando examen'); }
});

// Admin: open integrated editor for questions of a given exam (inside admin right bar area)
async function openExamEditor(examId){
  // We'll render a full editor inside a modal-like area in adminSidebar (reuse adminSidebar element)
  try {
    const eSnap = await getDoc(doc(db,'exams', examId));
    if (!eSnap.exists()) return alert('Examen no encontrado');
    const examData = eSnap.data();

    // build editor UI inside adminSidebar's bottom area
    let editorArea = adminSidebar.querySelector('.editor-area');
    if (!editorArea) {
      editorArea = document.createElement('div');
      editorArea.className = 'editor-area';
      adminSidebar.appendChild(editorArea);
    }
    editorArea.innerHTML = `<h4>Editor: ${escapeHtml(examData.nombre)}</h4>
      <div id="editorQuestionsList"></div>
      <hr/>
      <div id="editorAddQuestion" style="margin-top:8px;">
        <h5>Agregar nueva pregunta</h5>
        <label> Caso clínico (opcional)</label><textarea id="ed_q_caso" rows="3"></textarea>
        <label> Pregunta</label><input id="ed_q_preg" />
        <label> Opción A</label><input id="ed_q_a" />
        <label> Opción B</label><input id="ed_q_b" />
        <label> Opción C</label><input id="ed_q_c" />
        <label> Opción D</label><input id="ed_q_d" />
        <label> Índice correcto (0-3)</label><input id="ed_q_idx" type="number" min="0" max="3" />
        <label> Justificación</label><textarea id="ed_q_just" rows="2"></textarea>
        <div style="margin-top:8px;"><button id="ed_q_add" class="btn primary">Agregar pregunta</button></div>
      </div>
    `;

    const editorQuestionsList = document.getElementById('editorQuestionsList');
    editorQuestionsList.innerHTML = '<div class="small muted">Cargando preguntas...</div>';

    // load existing questions
    const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId), orderBy('pregunta')));
    editorQuestionsList.innerHTML = '';
    qSnap.forEach(q => {
      const d = q.data();
      const row = document.createElement('div');
      row.className = 'card';
      row.style.marginBottom = '8px';
      row.innerHTML = `<div style="font-weight:700">${escapeHtml(d.pregunta)}</div>
        <div class="small muted">ID: ${q.id}</div>
        <div style="margin-top:6px;">
          <button class="btn ed_edit" data-qid="${q.id}">Editar</button>
          <button class="btn ed_del" data-qid="${q.id}">Eliminar</button>
        </div>
      `;
      editorQuestionsList.appendChild(row);
    });

    // Attach handlers for add/edit/delete
    document.getElementById('ed_q_add').onclick = async () => {
      const caso = document.getElementById('ed_q_caso').value.trim();
      const pregunta = document.getElementById('ed_q_preg').value.trim();
      const a = document.getElementById('ed_q_a').value.trim();
      const b = document.getElementById('ed_q_b').value.trim();
      const c = document.getElementById('ed_q_c').value.trim();
      const d = document.getElementById('ed_q_d').value.trim();
      const idx = Number(document.getElementById('ed_q_idx').value || 0);
      const just = document.getElementById('ed_q_just').value.trim();
      const opciones = [a,b,c,d].filter(x=>x!=='');
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
        // update questionCount
        const newQSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId)));
        await updateDoc(doc(db,'exams', examId), { questionCount: newQSnap.size });
        alert('Pregunta agregada');
        openExamEditor(examId); // refresh
      } catch(e){ console.error('ed add', e); alert('Error agregando pregunta'); }
    };

    // edit and delete handlers (delegation)
    setTimeout(()=> {
      editorQuestionsList.querySelectorAll('.ed_edit').forEach(btn => {
        btn.onclick = async () => {
          const qid = btn.getAttribute('data-qid');
          const qDoc = await getDoc(doc(db,'questions', qid));
          if (!qDoc.exists()) return alert('Pregunta no encontrada');
          const data = qDoc.data();
          // open inline edit modal (simple prompts for fast UX)
          const newPregunta = prompt('Pregunta', data.pregunta || '');
          if (!newPregunta) return;
          const newJust = prompt('Justificación', data.justificacion || '');
          // For options, join into a single prompt separated by '||' to keep simple
          const newOpts = prompt('Opciones separadas por || (A||B||C||D)', (data.opciones || []).join('||'));
          const newCorrect = Number(prompt('Índice correcto (0-3)', data.correcta || 0) || 0);
          const optsArr = newOpts ? newOpts.split('||').map(s=>s.trim()).filter(Boolean) : (data.opciones || []);
          try {
            await updateDoc(doc(db,'questions', qid), {
              pregunta: newPregunta,
              justificacion: newJust,
              opciones: optsArr,
              correcta: newCorrect
            });
            alert('Pregunta actualizada');
            openExamEditor(examId);
          } catch(e){ console.error('ed edit', e); alert('Error actualizando pregunta'); }
        };
      });
      editorQuestionsList.querySelectorAll('.ed_del').forEach(btn => {
        btn.onclick = async () => {
          const qid = btn.getAttribute('data-qid');
          if (!confirm('Eliminar pregunta?')) return;
          try {
            await deleteDoc(doc(db,'questions', qid));
            // update questionCount
            const newQSnap = await getDocs(query(collection(db,'questions'), where('examId','==', examId)));
            await updateDoc(doc(db,'exams', examId), { questionCount: newQSnap.size });
            alert('Eliminada');
            openExamEditor(examId);
          } catch(e){ console.error('ed del', e); alert('Error eliminando pregunta'); }
        };
      });
    }, 50);

  } catch(e){ console.error('openExamEditor', e); alert('Error abriendo editor'); }
}

// Admin: view users
adminUsers && (adminUsers.onclick = async () => {
  adminSidebar.querySelectorAll('.editor-area').forEach(n => n.remove()); // clear old editor-area
  const area = document.createElement('div'); area.className = 'editor-area';
  adminSidebar.appendChild(area);
  area.innerHTML = '<h4>Usuarios</h4><div id="usersList">Cargando...</div>';
  const usersList = document.getElementById('usersList');
  try {
    const uSnap = await getDocs(collection(db,'users'));
    usersList.innerHTML = '';
    uSnap.forEach(u => {
      const d = u.data();
      const card = document.createElement('div'); card.className='card'; card.style.marginBottom='8px';
      card.innerHTML = `<div><strong>${escapeHtml(u.id)}</strong><div class="small muted">${escapeHtml(d.usuario||'')} - ${escapeHtml(d.role||'estudiante')}</div></div>
        <div style="margin-top:6px;"><button class="btn u_edit" data-uid="${u.id}">Editar</button> <button class="btn u_del" data-uid="${u.id}">Eliminar</button></div>`;
      usersList.appendChild(card);
    });
    // handlers (delegated)
    usersList.querySelectorAll('.u_edit').forEach(b=> {
      b.onclick = async ()=> {
        const uid = b.getAttribute('data-uid');
        const docRef = doc(db,'users', uid);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};
        // reuse simple prompts for editing
        const nombre = prompt('Nombre visible', data.usuario || '');
        if (!nombre) return;
        const role = prompt('Rol (estudiante/admin)', data.role || 'estudiante');
        const estado = prompt('Estado (habilitado/inhabilitado)', data.estado || 'habilitado');
        const expir = prompt('Fecha expiración (YYYY-MM-DD)', data.expiracion || '');
        await setDoc(doc(db,'users', uid), { usuario: nombre, role, estado, expiracion: expir }, { merge:true });
        alert('Usuario actualizado');
        adminUsers.onclick(); // refresh
      };
    });
    usersList.querySelectorAll('.u_del').forEach(b=> {
      b.onclick = async ()=> {
        const uid = b.getAttribute('data-uid');
        if (!confirm('Eliminar registro de usuario en Firestore? (no elimina cuenta Auth)')) return;
        await deleteDoc(doc(db,'users', uid));
        alert('Eliminado');
        adminUsers.onclick();
      };
    });
  } catch(e){ console.error('adminUsers', e); usersList.innerHTML = '<div class="muted">Error cargando usuarios</div>'; }
});

// Admin: Links manager (simple UI)
adminLinks && (adminLinks.onclick = async () => {
  adminSidebar.querySelectorAll('.editor-area').forEach(n => n.remove());
  const area = document.createElement('div'); area.className='editor-area';
  adminSidebar.appendChild(area);
  area.innerHTML = `<h4>Links Sociales</h4>
    <label>Instagram</label><input id="ln_ig" />
    <label>WhatsApp</label><input id="ln_wa" />
    <label>Telegram</label><input id="ln_tg" />
    <label>TikTok</label><input id="ln_tt" />
    <div style="margin-top:8px;"><button id="ln_save" class="btn primary">Guardar links (UI)</button></div>
    <div class="small muted" style="margin-top:6px">Actualmente estos links se guardan solo en la UI. Puedo persistirlos en Firestore si lo deseas.</div>
  `;
  // fill with existing hrefs if present
  setTimeout(()=> {
    document.getElementById('ln_ig').value = linkInstagram ? linkInstagram.href || '' : '';
    document.getElementById('ln_wa').value = linkWhatsApp ? linkWhatsApp.href || '' : '';
    document.getElementById('ln_tg').value = linkTelegram ? linkTelegram.href || '' : '';
    document.getElementById('ln_tt').value = linkTikTok ? linkTikTok.href || '' : '';
    document.getElementById('ln_save').onclick = ()=> {
      const ig = document.getElementById('ln_ig').value.trim();
      const wa = document.getElementById('ln_wa').value.trim();
      const tg = document.getElementById('ln_tg').value.trim();
      const tt = document.getElementById('ln_tt').value.trim();
      if (ig && linkInstagram) linkInstagram.href = ig;
      if (wa && linkWhatsApp) linkWhatsApp.href = wa;
      if (tg && linkTelegram) linkTelegram.href = tg;
      if (tt && linkTikTok) linkTikTok.href = tt;
      alert('Links actualizados en la UI. Si deseas, puedo persistirlos en Firestore.');
    };
  },50);
});

// Admin Logout (in right sidebar) - will call doLogout
adminLogout && (adminLogout.onclick = doLogout);

// ---------------------- EDIT MODE (SECCIONES -> EXÁMENES) - FULL EDITOR IN MAIN ----------------------
btnEdit && (btnEdit.onclick = ()=> enterEditModeForExams());
btnSave && (btnSave.onclick = ()=> saveExamsDraft());

function enterEditModeForExams(){
  if (!currentUser || currentUser.role !== 'admin') return alert('Solo administradores pueden editar');
  // transform exam boxes into editable forms (title inputs + delete checkbox)
  const cards = examsList.querySelectorAll('.examBox');
  cards.forEach(card => {
    const eid = card.dataset.eid;
    const titleEl = card.querySelector('[data-title]');
    const currentTitle = titleEl ? titleEl.textContent : '';
    // replace title with input
    const input = document.createElement('input');
    input.className = 'exam-title-input';
    input.value = currentTitle;
    input.dataset.eid = eid;
    // delete checkbox
    const delChk = document.createElement('label');
    delChk.style.display = 'block';
    delChk.style.marginTop = '6px';
    delChk.innerHTML = `<input type="checkbox" data-del="${eid}" /> Eliminar examen`;
    // append edit controls
    titleEl.parentNode.replaceChild(input, titleEl);
    const info = card.querySelector('.small');
    if (info) info.parentNode.appendChild(delChk);
  });

  // show controls to add a new exam inline
  const addRow = document.createElement('div'); addRow.className = 'card'; addRow.id = 'addExamRow';
  addRow.style.marginTop = '10px';
  addRow.innerHTML = `<h4>Agregar examen nuevo</h4>
    <input id="newExamName" placeholder="Nombre del examen" />
    <div style="margin-top:8px;"><button id="addExamTemp" class="btn primary">Agregar (en draft)</button></div>
  `;
  examsList.parentNode.insertBefore(addRow, examsList.nextSibling);

  // handlers
  document.getElementById('addExamTemp').onclick = () => {
    const name = document.getElementById('newExamName').value.trim();
    if (!name) return alert('Nombre requerido');
    const tempId = qid();
    draft.newExams.push({ tempId, nombre: name, sectionId: currentSectionId });
    // render a preview row for the new exam
    const preview = document.createElement('div'); preview.className = 'examBox'; preview.dataset.tempid = tempId;
    preview.innerHTML = `<div><div style="font-weight:700">${escapeHtml(name)}</div><div class="small muted">Nuevo (draft)</div></div>
      <div><button class="btn" onclick="(function(){})()">---</button></div>`;
    examsList.appendChild(preview);
    document.getElementById('newExamName').value = '';
  };

  // show save button, hide edit button
  show(btnSave); hide(btnEdit);
}

async function saveExamsDraft(){
  if (!currentUser || currentUser.role !== 'admin') return alert('Solo administradores');
  try {
    // 1) gather edited titles and deletes from inputs
    const inputs = examsList.querySelectorAll('input.exam-title-input');
    for (const inp of inputs) {
      const eid = inp.dataset.eid;
      const newTitle = inp.value.trim();
      if (!eid) continue;
      if (draft.exams[eid]) draft.exams[eid].nombre = newTitle;
      else draft.exams[eid] = { nombre: newTitle, deleted:false, new:false };
    }
    // gather deletes
    const dels = examsList.querySelectorAll('input[type=checkbox][data-del]');
    for (const d of dels) {
      const eid = d.getAttribute('data-del');
      if (d.checked) draft.exams[eid] = { ...(draft.exams[eid]||{}), deleted: true };
    }

    // 2) apply deletes first
    for (const [eid, eObj] of Object.entries(draft.exams)) {
      if (eObj.deleted) {
        // delete exam document but DO NOT delete questions automatically to avoid data loss.
        // Instead, set exam.deleted=true (soft delete) or remove sectionId to hide it. We'll mark as deleted flag.
        // To avoid breaking, we'll set a 'deleted' flag.
        try { await updateDoc(doc(db,'exams', eid), { deleted: true }); }
        catch(err){ console.warn('failed mark deleted', eid, err); }
      }
    }

    // 3) apply title updates
    for (const [eid, eObj] of Object.entries(draft.exams)) {
      if (eObj.deleted) continue;
      if (eObj.nombre !== undefined) {
        try { await updateDoc(doc(db,'exams', eid), { nombre: eObj.nombre }); }
        catch(err){ console.warn('saveExam title update failed', eid, err); }
      }
    }

    // 4) add new exams from draft.newExams
    for (const nx of draft.newExams) {
      try {
        await addDoc(collection(db,'exams'), { nombre: nx.nombre, sectionId: nx.sectionId, questionCount: 0, createdAt: new Date().toISOString() });
      } catch(err){ console.warn('create new exam failed', nx, err); }
    }

    // cleanup draft
    draft.exams = {};
    draft.newExams = [];
    alert('Cambios guardados');
    // restore UI
    hide(btnSave); show(btnEdit);
    const addRow = document.getElementById('addExamRow'); if (addRow) addRow.remove();
    // reload exams
    await renderExamsForSection(currentSectionId);

  } catch(e){ console.error('saveExamsDraft', e); alert('Error guardando cambios'); }
}

// ---------------------- EDIT MODE FOR QUESTIONS (within exam) ----------------------
btnEditExam && (btnEditExam.onclick = ()=> enterEditModeForQuestions());
btnSaveExam && (btnSaveExam.onclick = ()=> saveQuestionsDraft());

function enterEditModeForQuestions(){
  if (!currentUser || currentUser.role !== 'admin') return alert('Solo administradores');
  if (!currentExam) return alert('Abre un examen primero');

  // Build editable list inside examForm: for each question, create inputs for case, question, options, correct, just
  (async () => {
    try {
      // load questions fresh
      const qSnap = await getDocs(query(collection(db,'questions'), where('examId','==', currentExam.id), orderBy('pregunta')));
      // clear examForm and render editable cards
      examForm.innerHTML = '';
      draft.questions = {}; // reset temp
      for (const qDoc of qSnap.docs) {
        const d = qDoc.data();
        draft.questions[qDoc.id] = { ...d, deleted:false, new:false, examId: currentExam.id };

        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '10px';
        card.dataset.qid = qDoc.id;

        // build options inputs
        const opts = d.opciones || [];
        card.innerHTML = `
          <label> Caso clínico (opcional)</label>
          <textarea class="ed_case" rows="2">${escapeHtml(d.casoClinico || '')}</textarea>
          <label> Pregunta</label>
          <input class="ed_preg" value="${escapeHtml(d.pregunta || '')}" />
          <label> Opción A</label><input class="ed_opt0" value="${escapeHtml(opts[0]||'')}" />
          <label> Opción B</label><input class="ed_opt1" value="${escapeHtml(opts[1]||'')}" />
          <label> Opción C</label><input class="ed_opt2" value="${escapeHtml(opts[2]||'')}" />
          <label> Opción D</label><input class="ed_opt3" value="${escapeHtml(opts[3]||'')}" />
          <label> Índice correcto (0-3)</label><input class="ed_cor" type="number" min="0" max="3" value="${d.correcta||0}" />
          <label> Justificación</label><textarea class="ed_just" rows="2">${escapeHtml(d.justificacion||'')}</textarea>
          <div style="margin-top:8px;"><button class="btn q_delete" data-qid="${qDoc.id}">Eliminar</button></div>
        `;
        examForm.appendChild(card);
      }

      // Add UI to append new question
      const newCard = document.createElement('div');
      newCard.className = 'card';
      newCard.style.marginTop = '12px';
      newCard.innerHTML = `<h4>Agregar nueva pregunta</h4>
        <label> Caso clínico (opcional)</label><textarea id="new_q_caso" rows="2"></textarea>
        <label> Pregunta</label><input id="new_q_preg" />
        <label> Opción A</label><input id="new_q_a" />
        <label> Opción B</label><input id="new_q_b" />
        <label> Opción C</label><input id="new_q_c" />
        <label> Opción D</label><input id="new_q_d" />
        <label> Índice correcto (0-3)</label><input id="new_q_cor" type="number" min="0" max="3" />
        <label> Justificación</label><textarea id="new_q_just" rows="2"></textarea>
        <div style="margin-top:8px;"><button id="addNewQuestionBtn" class="btn primary">Agregar (draft)</button></div>
      `;
      examForm.appendChild(newCard);

      // attach delete handlers (mark for deletion)
      setTimeout(()=> {
        examForm.querySelectorAll('.q_delete').forEach(b => {
          b.onclick = ()=> {
            const qid = b.getAttribute('data-qid');
            if (!confirm('Eliminar pregunta?')) return;
            // mark deleted in draft and hide the card visually
            draft.questions[qid].deleted = true;
            const card = examForm.querySelector(`div[data-qid="${qid}"]`);
            if (card) card.style.opacity = '0.5';
          };
        });
      },50);

      // handler to add new question to draft
      document.getElementById('addNewQuestionBtn').onclick = ()=> {
        const caso = document.getElementById('new_q_caso').value.trim();
        const pregunta = document.getElementById('new_q_preg').value.trim();
        const a = document.getElementById('new_q_a').value.trim();
        const b = document.getElementById('new_q_b').value.trim();
        const c = document.getElementById('new_q_c').value.trim();
        const d = document.getElementById('new_q_d').value.trim();
        const cor = Number(document.getElementById('new_q_cor').value || 0);
        const just = document.getElementById('new_q_just').value.trim();
        const opciones = [a,b,c,d].filter(x=>x!=='');
        if (!pregunta || opciones.length === 0) return alert('Pregunta y al menos una opción son requeridos');
        const tempId = qid();
        draft.questions[tempId] = { examId: currentExam.id, casoClinico: caso, pregunta, opciones, correcta: cor, justificacion: just, new:true, deleted:false };
        // visually add a small preview in the form
        const preview = document.createElement('div'); preview.className='card'; preview.style.marginTop='8px';
        preview.innerHTML = `<div style="font-weight:700">${escapeHtml(pregunta)} <small class="muted"> (nuevo - draft)</small></div>`;
        examForm.appendChild(preview);
        // clear inputs
        document.getElementById('new_q_caso').value=''; document.getElementById('new_q_preg').value=''; document.getElementById('new_q_a').value='';
        document.getElementById('new_q_b').value=''; document.getElementById('new_q_c').value=''; document.getElementById('new_q_d').value='';
        document.getElementById('new_q_cor').value=''; document.getElementById('new_q_just').value='';
      };

      // show save/hide edit
      show(btnSaveExam); hide(btnEditExam);

    } catch(e){ console.error('enterEditModeForQuestions', e); alert('Error preparando editor'); }
  })();
}

async function saveQuestionsDraft(){
  if (!currentUser || currentUser.role !== 'admin') return alert('Solo administradores');
  if (!currentExam) return alert('Abre un examen primero');
  try {
    // 1) process changed existing questions: read inputs
    const editableCards = examForm.querySelectorAll('div.card[data-qid]');
    for (const card of editableCards) {
      const qidAttr = card.dataset.qid;
      if (!qidAttr || !draft.questions[qidAttr]) continue;
      if (draft.questions[qidAttr].deleted) {
        // delete doc
        try { await deleteDoc(doc(db,'questions', qidAttr)); }
        catch(err){ console.warn('delete q failed', qidAttr, err); }
        continue;
      }
      // read inputs (if present)
      const caso = card.querySelector('.ed_case') ? card.querySelector('.ed_case').value.trim() : draft.questions[qidAttr].casoClinico || '';
      const pregunta = card.querySelector('.ed_preg') ? card.querySelector('.ed_preg').value.trim() : draft.questions[qidAttr].pregunta || '';
      const opciones = [
        card.querySelector('.ed_opt0') ? card.querySelector('.ed_opt0').value.trim() : (draft.questions[qidAttr].opciones||[])[0]||'',
        card.querySelector('.ed_opt1') ? card.querySelector('.ed_opt1').value.trim() : (draft.questions[qidAttr].opciones||[])[1]||'',
        card.querySelector('.ed_opt2') ? card.querySelector('.ed_opt2').value.trim() : (draft.questions[qidAttr].opciones||[])[2]||'',
        card.querySelector('.ed_opt3') ? card.querySelector('.ed_opt3').value.trim() : (draft.questions[qidAttr].opciones||[])[3]||''
      ].filter(x=>x!=='');
      const correcta = card.querySelector('.ed_cor') ? Number(card.querySelector('.ed_cor').value||0) : (draft.questions[qidAttr].correcta||0);
      const just = card.querySelector('.ed_just') ? card.querySelector('.ed_just').value.trim() : (draft.questions[qidAttr].justificacion||'');

      await updateDoc(doc(db,'questions', qidAttr), {
        casoClinico: caso,
        pregunta,
        opciones,
        correcta,
        justificacion: just
      });
    }

    // 2) process new questions in draft.questions where new===true
    for (const [qid, qObj] of Object.entries(draft.questions)) {
      if (qObj.new && !qObj.deleted) {
        // create doc
        try {
          await addDoc(collection(db,'questions'), {
            examId: currentExam.id,
            casoClinico: qObj.casoClinico || '',
            pregunta: qObj.pregunta,
            opciones: qObj.opciones,
            correcta: qObj.correcta || 0,
            justificacion: qObj.justificacion || '',
            createdAt: new Date().toISOString()
          });
        } catch(err){ console.warn('create question failed', qObj, err); }
      }
    }

    // 3) recalc questionCount for the exam
    const newQSnap = await getDocs(query(collection(db,'questions'), where('examId','==', currentExam.id)));
    await updateDoc(doc(db,'exams', currentExam.id), { questionCount: newQSnap.size });

    alert('Cambios en preguntas guardados');
    hide(btnSaveExam); show(btnEditExam);
    // reload exam view with fresh data
    openExam(currentExam.id);

  } catch(e){ console.error('saveQuestionsDraft', e); alert('Error guardando preguntas'); }
}

// ---------------------- STARTUP & INITIAL LOAD ----------------------
async function init(){
  await loadSections();
  // attach simple admin button mappings for right-sidebar to old admin buttons fallback (in case anywhere used)
  // wire adminEditQuestions to openExamEditor on currentExam
  adminEditQuestions && (adminEditQuestions.onclick = ()=> {
    if (!currentExam) return alert('Abre un examen primero para editar sus preguntas');
    openExamEditor(currentExam.id);
  });

  // small guard: if admin sidebar is not present, skip
  // attach simple show/hide behavior for adminSidebar based on auth (handled in onAuthStateChanged)

  // ensure initial UI state
  hide(editButtons); hide(editExamButtons); hide(btnSave); hide(btnSaveExam);
}
init().catch(e=>console.error(e));

// ---------------------- UTIL: escapeHtml already defined above at top ----------------------
// (kept for clarity)

/* END OF FILE */
