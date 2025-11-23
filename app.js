// app.js - Plataforma Estudiante ENARM
// Estructura compatible con Firestore:
// sections, exams, casosClinicos, preguntas, users
// preguntas: { examId, casoId, pregunta, opciones[], correcta, justificacion }
// casosClinicos: { examId, titulo, texto }

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

// Admin right sidebar
const adminSidebar       = $('adminSidebar');
const adminAddSection    = $('adminAddSection');
const adminAddExam       = $('adminAddExam');
const adminEditQuestions = $('adminEditQuestions');
const adminUsers         = $('adminUsers');
const adminLinks         = $('adminLinks');
const adminLogout        = $('adminLogout');

// Socials / countdown
const mainCountdownEl = $('mainCountdown');
const linkInstagram   = $('link-instagram');
const linkWhatsApp    = $('link-whatsapp');
const linkTelegram    = $('link-telegram');
const linkTikTok      = $('link-tiktok');

// ---------------------- ESTADO GLOBAL ----------------------
let currentUser       = null; // {uid, email, role, estado, expiracion}
let currentSectionId  = null;
let currentExam       = null; // { id, nombre, ... }
let examTimerInterval = null;
let examRemainingSeconds = 0;

// Draft state (para ediciones admin de exámenes/preguntas)
let draft = {
  exams: {},      // examId -> { nombre, deleted, new }
  questions: {},  // questionId -> { examId, ... }
  newExams: []    // { tempId, nombre, sectionId }
};

// ---------------------- UTILIDADES ----------------------
function show(el){ if(!el) return; el.classList.remove('hidden'); }
function hide(el){ if(!el) return; el.classList.add('hidden'); }
function escapeHtml(s){
  if(s===undefined||s===null) return '';
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
    const sSnap = await getDocs(query(collection(db,'sections'), orderBy('nombre'), limit(1)));
    if (sSnap.empty) {
      await addDoc(collection(db,'sections'), {
        nombre: 'Sección 1',
        createdAt: new Date().toISOString()
      });
    }
    const uSnap = await getDocs(query(collection(db,'users'), limit(1)));
    if (uSnap.empty) {
      await setDoc(doc(db,'users', ADMIN_UID), {
        usuario:'admin',
        role:'admin',
        estado:'habilitado',
        expiracion: ''
      });
    }
  } catch(e){ console.warn('ensureDefaults', e); }
}

// ---------------------- CARGA Y RENDER SECCIONES ----------------------
async function loadSections(){
  if (sectionsList) sectionsList.innerHTML = '';
  try {
    await ensureDefaults();
    const sSnap = await getDocs(query(collection(db,'sections'), orderBy('nombre')));
    if (sSnap.empty) {
      await addDoc(collection(db,'sections'), {
        nombre:'Sección 1',
        createdAt: new Date().toISOString()
      });
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
    if (!currentSectionId && sSnap.docs.length) {
      selectSection(sSnap.docs[0].id, sSnap.docs[0].data().nombre);
    }
  } catch(e){
    console.error('loadSections', e);
    if (sectionsList) sectionsList.innerHTML = '<div class="muted">Error cargando secciones</div>';
  }
}

async function selectSection(id, nombre){
  currentSectionId = id;
  if (sectionsList) {
    Array.from(sectionsList.children).forEach(ch =>
      ch.classList.toggle('active', ch.dataset.id === id)
    );
  }
  show(studentScreen);
  hide(loginScreen);
  hide(examScreen);
  hide(resultScreen);
  await renderExamsForSection(id);
}

// ---------------------- RENDER EXÁMENES ----------------------
async function renderExamsForSection(sectionId){
  if (!examsList) return;
  examsList.innerHTML = '';
  if (!sectionId) {
    examsList.innerHTML = '<div class="muted">Selecciona una sección</div>';
    return;
  }
  try {
    const qEx = query(
      collection(db,'exams'),
      where('sectionId','==', sectionId),
      orderBy('nombre')
    );
    const snap = await getDocs(qEx);
    if (snap.empty) {
      examsList.innerHTML = '<div class="muted">No hay exámenes en esta sección</div>';
      return;
    }

    draft.exams = {};
    draft.newExams = [];

    snap.forEach(eDoc => {
      const data = eDoc.data();
      const examId = eDoc.id;

      draft.exams[examId] = {
        nombre: data.nombre || '',
        deleted: false,
        new: false
      };

      const card = document.createElement('div');
      card.className = 'examBox';
      card.dataset.eid = examId;

      const left = document.createElement('div');
      left.innerHTML = `
        <div class="title" data-title>${escapeHtml(data.nombre || 'Examen')}</div>
        <div class="meta small">Preguntas: ${data.questionCount || 0}</div>
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
    const attId = `${currentUser ? currentUser.uid : 'anon'}_${examId}`;
    const ref = doc(db,'attempts', attId);
    const aSnap = await getDoc(ref);
    const used = aSnap.exists() ? (aSnap.data().used || 0) : 0;
    const el = document.getElementById(`attempt_${examId}`);
    if (el) el.textContent = `${used}/3`;
  } catch(e){ console.warn(e); }
}

// ---------------------- ABRIR EXAMEN (usa casosClinicos + preguntas) ----------------------
async function openExam(examId){
  try {
    const eSnap = await getDoc(doc(db,'exams', examId));
    if (!eSnap.exists()) {
      alert('Examen no encontrado');
      return;
    }
    currentExam = { id: examId, ...eSnap.data() };

    // Cargar casos clínicos del examen
    const casosSnap = await getDocs(
      query(collection(db,'casosClinicos'), where('examId','==', examId))
    );
    const casosMap = {};
    casosSnap.forEach(c => {
      casosMap[c.id] = { id: c.id, ...c.data() };
    });

    // Cargar preguntas del examen (cada una con examId y casoId)
    const pregSnap = await getDocs(
      query(collection(db,'preguntas'), where('examId','==', examId))
    );
    const preguntas = [];
    pregSnap.forEach(p => preguntas.push({ id: p.id, ...p.data() }));

    // Ordenar por casoId y luego por pregunta (para agrupar visualmente)
    preguntas.sort((a,b) => {
      const ca = a.casoId || '';
      const cb = b.casoId || '';
      if (ca < cb) return -1;
      if (ca > cb) return 1;
      const pa = a.pregunta || '';
      const pb = b.pregunta || '';
      return pa.localeCompare(pb);
    });

    renderExamScreen(currentExam, preguntas, casosMap);

  } catch(e){
    console.error('openExam', e);
    alert('Error al abrir examen');
  }
}

function renderExamScreen(exam, preguntas, casosMap){
  hide(loginScreen);
  hide(studentScreen);
  hide(resultScreen);
  show(examScreen);

  examTitle.textContent = exam.nombre || 'Examen';
  examForm.innerHTML = '';

  const totalSeconds = Math.max(60, (preguntas.length || 1) * 75);
  startExamTimer(totalSeconds);

  let lastCasoId = null;
  let numero = 1;

  preguntas.forEach(p => {
    const casoId = p.casoId || null;
    const caso   = casoId ? casosMap[casoId] : null;

    // Si cambia de caso, mostramos el bloque del caso clínico una sola vez
    if (caso && casoId !== lastCasoId) {
      lastCasoId = casoId;
      const caseBlock = document.createElement('div');
      caseBlock.className = 'caseText';
      const titulo = caso.titulo ? `<strong>${escapeHtml(caso.titulo)}</strong><br>` : '';
      const texto  = caso.texto  ? escapeHtml(caso.texto) : '';
      caseBlock.innerHTML = titulo + texto;
      examForm.appendChild(caseBlock);
    }

    // Bloque de pregunta
    const qBlock = document.createElement('div');
    qBlock.className = 'questionBlock card';
    qBlock.dataset.qid = p.id;

    const headerHtml = `
      <div class="questionTitle">Pregunta ${numero++}</div>
      <div style="margin-top:8px"><strong>${escapeHtml(p.pregunta || '')}</strong></div>
    `;
    qBlock.innerHTML = headerHtml;

    const optsDiv = document.createElement('div');
    optsDiv.className = 'options';

    (p.opciones || []).forEach((opt, i) => {
      const optionId = `opt_${p.id}_${i}`;
      const label = document.createElement('label');
      // NOTA: usamos <span> para poder aplicar negritas al checked en CSS si quieres
      label.innerHTML = `
        <input type="radio" name="${p.id}" value="${i}" id="${optionId}" />
        <span>${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}</span>
      `;
      optsDiv.appendChild(label);
    });

    qBlock.appendChild(optsDiv);

    const just = document.createElement('div');
    just.className = 'justification hidden';
    just.textContent = p.justificacion || '';
    qBlock.appendChild(just);

    examForm.appendChild(qBlock);
  });

  // Admin: por ahora la edición de preguntas se hace con el botón
  // "Editar preguntas del examen" en la barra derecha.
  hide(editExamButtons);

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
    inputs.forEach(inp => {
      answers[inp.name] = Number(inp.value);
    });

    const qSnap = await getDocs(
      query(collection(db,'preguntas'), where('examId','==', examId))
    );
    const questions = [];
    qSnap.forEach(q => questions.push({ id: q.id, ...q.data() }));

    let correct = 0;
    questions.forEach(q => {
      const sel = answers[q.id];
      if (typeof sel === 'number' && sel === (q.correcta || 0)) correct++;
    });

    const percent = questions.length
      ? Math.round((correct / questions.length) * 100)
      : 0;

    // Registrar intento
    if (currentUser) {
      const attDocId = `${currentUser.uid}_${examId}`;
      const attRef   = doc(db,'attempts', attDocId);
      const prev     = await getDoc(attRef);
      const used     = prev.exists() ? (prev.data().used || 0) + 1 : 1;
      await setDoc(attRef, {
        used,
        last: new Date().toISOString()
      });
    }

    renderResultScreen(questions, answers, percent);
    await renderExamsForSection(currentSectionId);
    clearInterval(examTimerInterval);

  } catch(e){
    console.error('finalizeExamAndGrade', e);
    alert('Error finalizando examen');
  }
}

function renderResultScreen(questions, answers, percent){
  hide(examScreen);
  hide(loginScreen);
  hide(studentScreen);
  show(resultScreen);

  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;

  questions.forEach((q, idx) => {
    const userSel   = answers[q.id];
    const correctIdx= q.correcta || 0;

    const w = document.createElement('div');
    w.className = (userSel === correctIdx)
      ? 'result-correct card'
      : 'result-wrong card';
    w.style.marginBottom = '10px';

    w.innerHTML = `
      <div style="font-weight:700">Pregunta ${idx+1}</div>
      <div style="margin-top:8px">${escapeHtml(q.pregunta || '')}</div>
    `;

    const opts = document.createElement('div');
    (q.opciones || []).forEach((opt, i) => {
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
if (btnLogin) {
  btnLogin.onclick = async () => {
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
  };
}
if (btnCancel) {
  btnCancel.onclick = () => {
    inputEmail.value = '';
    inputPassword.value = '';
    loginMessage.textContent = '';
  };
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const uSnap = await getDoc(doc(db,'users', user.uid));
      let role = 'estudiante';
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

      // Expiración
      if (currentUser.expiracion) {
        try {
          const now = new Date();
          const exp = new Date(currentUser.expiracion);
          if (now > exp) {
            await updateDoc(doc(db,'users', user.uid), {
              estado:'inhabilitado'
            });
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
        currentUser.role = 'estudiante';
        showStudentUI();
      }

    } catch(e){
      console.error('onAuthStateChanged', e);
    }
  } else {
    currentUser = null;
    hide(adminSidebar);
    hide(editButtons);
    hide(editExamButtons);
    hide(studentScreen);
    hide(examScreen);
    hide(resultScreen);
    show(loginScreen);
    if (userInfo) userInfo.textContent = '';
    if (authButtons) authButtons.innerHTML = '';
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

  if (userInfo)    userInfo.textContent = currentUser.email || '';
  if (authButtons) {
    authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
    const btnTop = document.getElementById('btnLogoutTop');
    if (btnTop) btnTop.onclick = doLogout;
  }

  await loadSections();
}

async function showAdminUI(){
  hide(loginScreen);
  show(studentScreen);
  show(adminSidebar);

  if (userInfo) userInfo.textContent = `${currentUser.email} (Admin)`;
  if (authButtons) {
    authButtons.innerHTML = `<button id="btnLogoutTop" class="btn">Salir</button>`;
    const btnTop = document.getElementById('btnLogoutTop');
    if (btnTop) btnTop.onclick = doLogout;
  }

  await loadSections();
}

// ---------------------- ADMIN: SECCIONES / EXÁMENES / LINKS / USERS ----------------------
if (adminAddSection) {
  adminAddSection.onclick = async () => {
    const nombre = prompt('Nombre de la nueva sección:');
    if (!nombre) return;
    try {
      await addDoc(collection(db,'sections'), {
        nombre,
        createdAt: new Date().toISOString()
      });
      alert('Sección creada');
      await loadSections();
    } catch(e){
      console.error('adminAddSection', e);
      alert('Error creando sección');
    }
  };
}

if (adminAddExam) {
  adminAddExam.onclick = async () => {
    if (!currentSectionId) {
      alert('Selecciona una sección antes');
      return;
    }
    const nombre = prompt('Nombre del examen nuevo:');
    if (!nombre) return;
    try {
      const exRef = await addDoc(collection(db,'exams'), {
        nombre,
        sectionId: currentSectionId,
        questionCount: 0,
        createdAt: new Date().toISOString()
      });
      alert('Examen creado. Ahora puedes agregar preguntas.');
      await renderExamsForSection(currentSectionId);
      openExamEditor(exRef.id);
    } catch(e){
      console.error('adminAddExam', e);
      alert('Error creando examen');
    }
  };
}

// Editor de preguntas (admin) en la barra derecha
async function openExamEditor(examId){
  try {
    const eSnap = await getDoc(doc(db,'exams', examId));
    if (!eSnap.exists()) {
      alert('Examen no encontrado');
      return;
    }
    const examData = eSnap.data();

    let editorArea = adminSidebar.querySelector('.editor-area');
    if (!editorArea) {
      editorArea = document.createElement('div');
      editorArea.className = 'editor-area';
      adminSidebar.appendChild(editorArea);
    }

    editorArea.innerHTML = `
      <h4>Editor: ${escapeHtml(examData.nombre)}</h4>
      <div id="editorQuestionsList">Cargando preguntas...</div>
      <hr/>
      <div id="editorAddQuestion" style="margin-top:8px;">
        <h5>Agregar nueva pregunta</h5>
        <label>ID de caso clínico (casoId, opcional)</label>
        <input id="ed_q_casoId" />
        <label>Pregunta</label>
        <input id="ed_q_preg" />
        <label>Opción A</label><input id="ed_q_a" />
        <label>Opción B</label><input id="ed_q_b" />
        <label>Opción C</label><input id="ed_q_c" />
        <label>Opción D</label><input id="ed_q_d" />
        <label>Índice correcto (0-3)</label><input id="ed_q_idx" type="number" min="0" max="3" />
        <label>Justificación</label><textarea id="ed_q_just" rows="2"></textarea>
        <div style="margin-top:8px;">
          <button id="ed_q_add" class="btn primary">Agregar pregunta</button>
        </div>
      </div>
    `;

    const editorQuestionsList = document.getElementById('editorQuestionsList');

    // Cargar preguntas actuales
    const qSnap = await getDocs(
      query(collection(db,'preguntas'), where('examId','==', examId), orderBy('pregunta'))
    );
    editorQuestionsList.innerHTML = '';

    qSnap.forEach(q => {
      const d = q.data();
      const row = document.createElement('div');
      row.className = 'card';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <div style="font-weight:700">${escapeHtml(d.pregunta || '')}</div>
        <div class="small muted">ID: ${q.id} | casoId: ${escapeHtml(d.casoId || 'sin caso')}</div>
        <div style="margin-top:6px;">
          <button class="btn ed_edit" data-qid="${q.id}">Editar</button>
          <button class="btn ed_del" data-qid="${q.id}">Eliminar</button>
        </div>
      `;
      editorQuestionsList.appendChild(row);
    });

    // Agregar nueva pregunta
    document.getElementById('ed_q_add').onclick = async () => {
      const casoId = document.getElementById('ed_q_casoId').value.trim();
      const pregunta = document.getElementById('ed_q_preg').value.trim();
      const a = document.getElementById('ed_q_a').value.trim();
      const b = document.getElementById('ed_q_b').value.trim();
      const c = document.getElementById('ed_q_c').value.trim();
      const d = document.getElementById('ed_q_d').value.trim();
      const idx = Number(document.getElementById('ed_q_idx').value || 0);
      const just = document.getElementById('ed_q_just').value.trim();
      const opciones = [a,b,c,d].filter(x => x !== '');

      if (!pregunta || opciones.length === 0) {
        alert('Pregunta y al menos una opción son requeridos');
        return;
      }

      try {
        await addDoc(collection(db,'preguntas'), {
          examId,
          casoId: casoId || null,
          pregunta,
          opciones,
          correcta: idx,
          justificacion: just,
          createdAt: new Date().toISOString()
        });

        // Actualizar questionCount
        const newQSnap = await getDocs(
          query(collection(db,'preguntas'), where('examId','==', examId))
        );
        await updateDoc(doc(db,'exams', examId), { questionCount: newQSnap.size });

        alert('Pregunta agregada');
        openExamEditor(examId); // refrescar editor
      } catch(e){
        console.error('ed add', e);
        alert('Error agregando pregunta');
      }
    };

    // Editar / Eliminar
    setTimeout(() => {
      editorQuestionsList.querySelectorAll('.ed_edit').forEach(btn => {
        btn.onclick = async () => {
          const qid = btn.getAttribute('data-qid');
          const qDoc = await getDoc(doc(db,'preguntas', qid));
          if (!qDoc.exists()) {
            alert('Pregunta no encontrada');
            return;
          }
          const data = qDoc.data();
          const newCasoId   = prompt('ID de caso clínico (casoId, opcional)', data.casoId || '');
          const newPregunta = prompt('Pregunta', data.pregunta || '');
          if (!newPregunta) return;
          const newJust     = prompt('Justificación', data.justificacion || '');
          const newOptsStr  = prompt(
            'Opciones separadas por || (A||B||C||D)',
            (data.opciones || []).join('||')
          );
          const newCorrect  = Number(
            prompt('Índice correcto (0-3)', data.correcta || 0) || 0
          );
          const optsArr = newOptsStr
            ? newOptsStr.split('||').map(s => s.trim()).filter(Boolean)
            : (data.opciones || []);

          try {
            await updateDoc(doc(db,'preguntas', qid), {
              casoId: newCasoId || null,
              pregunta: newPregunta,
              justificacion: newJust,
              opciones: optsArr,
              correcta: newCorrect
            });
            alert('Pregunta actualizada');
            openExamEditor(examId);
          } catch(e){
            console.error('ed edit', e);
            alert('Error actualizando pregunta');
          }
        };
      });

      editorQuestionsList.querySelectorAll('.ed_del').forEach(btn => {
        btn.onclick = async () => {
          const qid = btn.getAttribute('data-qid');
          if (!confirm('¿Eliminar pregunta?')) return;
          try {
            await deleteDoc(doc(db,'preguntas', qid));
            const newQSnap = await getDocs(
              query(collection(db,'preguntas'), where('examId','==', examId))
            );
            await updateDoc(doc(db,'exams', examId), { questionCount: newQSnap.size });
            alert('Pregunta eliminada');
            openExamEditor(examId);
          } catch(e){
            console.error('ed del', e);
            alert('Error eliminando pregunta');
          }
        };
      });
    }, 50);

  } catch(e){
    console.error('openExamEditor', e);
    alert('Error abriendo editor');
  }
}

// Botón "Editar preguntas del examen" (admin)
if (adminEditQuestions) {
  adminEditQuestions.onclick = () => {
    if (!currentExam) {
      alert('Abre un examen primero para editar sus preguntas');
      return;
    }
    openExamEditor(currentExam.id);
  };
}

// Admin: usuarios
if (adminUsers) {
  adminUsers.onclick = async () => {
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
              ${escapeHtml(d.usuario || '')} - ${escapeHtml(d.role || 'estudiante')}
            </div>
          </div>
          <div style="margin-top:6px;">
            <button class="btn u_edit" data-uid="${u.id}">Editar</button>
            <button class="btn u_del" data-uid="${u.id}">Eliminar</button>
          </div>
        `;
        usersList.appendChild(card);
      });

      usersList.querySelectorAll('.u_edit').forEach(b => {
        b.onclick = async () => {
          const uid = b.getAttribute('data-uid');
          const docRef = doc(db,'users', uid);
          const snap   = await getDoc(docRef);
          const data   = snap.exists() ? snap.data() : {};
          const nombre = prompt('Nombre visible', data.usuario || '');
          if (!nombre) return;
          const role   = prompt('Rol (estudiante/admin)', data.role || 'estudiante');
          const estado = prompt('Estado (habilitado/inhabilitado)', data.estado || 'habilitado');
          const expir  = prompt('Fecha expiración (YYYY-MM-DD)', data.expiracion || '');
          await setDoc(docRef, {
            usuario: nombre,
            role,
            estado,
            expiracion: expir
          }, { merge:true });
          alert('Usuario actualizado');
          adminUsers.onclick();
        };
      });

      usersList.querySelectorAll('.u_del').forEach(b => {
        b.onclick = async () => {
          const uid = b.getAttribute('data-uid');
          if (!confirm('Eliminar registro de usuario en Firestore? (no elimina cuenta Auth)')) return;
          await deleteDoc(doc(db,'users', uid));
          alert('Eliminado');
          adminUsers.onclick();
        };
      });

    } catch(e){
      console.error('adminUsers', e);
      usersList.innerHTML = '<div class="muted">Error cargando usuarios</div>';
    }
  };
}

// Admin: links redes (solo UI)
if (adminLinks) {
  adminLinks.onclick = () => {
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
        Estos links solo se guardan en la UI. Si quieres, luego los persistimos en Firestore.
      </div>
    `;

    setTimeout(() => {
      document.getElementById('ln_ig').value = linkInstagram ? (linkInstagram.href || '') : '';
      document.getElementById('ln_wa').value = linkWhatsApp ? (linkWhatsApp.href || '') : '';
      document.getElementById('ln_tg').value = linkTelegram ? (linkTelegram.href || '') : '';
      document.getElementById('ln_tt').value = linkTikTok ? (linkTikTok.href || '') : '';

      document.getElementById('ln_save').onclick = () => {
        const ig = document.getElementById('ln_ig').value.trim();
        const wa = document.getElementById('ln_wa').value.trim();
        const tg = document.getElementById('ln_tg').value.trim();
        const tt = document.getElementById('ln_tt').value.trim();
        if (ig && linkInstagram) linkInstagram.href = ig;
        if (wa && linkWhatsApp)  linkWhatsApp.href  = wa;
        if (tg && linkTelegram)  linkTelegram.href  = tg;
        if (tt && linkTikTok)    linkTikTok.href    = tt;
        alert('Links actualizados en la interfaz.');
      };
    }, 50);
  };
}

// Admin Logout (barra derecha)
if (adminLogout) {
  adminLogout.onclick = doLogout;
}

// ---------------------- EDIT MODE EXÁMENES (renombrar / borrar / crear) ----------------------
if (btnEdit)  btnEdit.onclick  = () => enterEditModeForExams();
if (btnSave)  btnSave.onclick  = () => saveExamsDraft();

function enterEditModeForExams(){
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Solo administradores pueden editar');
    return;
  }
  const cards = examsList.querySelectorAll('.examBox');
  cards.forEach(card => {
    const eid = card.dataset.eid;
    const titleEl = card.querySelector('[data-title]');
    if (!titleEl) return;
    const currentTitle = titleEl.textContent || '';
    const input = document.createElement('input');
    input.className = 'exam-title-input';
    input.value = currentTitle;
    input.dataset.eid = eid;

    const delChk = document.createElement('label');
    delChk.style.display = 'block';
    delChk.style.marginTop = '6px';
    delChk.innerHTML = `<input type="checkbox" data-del="${eid}" /> Eliminar examen`;

    titleEl.parentNode.replaceChild(input, titleEl);
    const info = card.querySelector('.small');
    if (info) info.parentNode.appendChild(delChk);
  });

  const addRow = document.createElement('div');
  addRow.className = 'card';
  addRow.id = 'addExamRow';
  addRow.style.marginTop = '10px';
  addRow.innerHTML = `
    <h4>Agregar examen nuevo</h4>
    <input id="newExamName" placeholder="Nombre del examen" />
    <div style="margin-top:8px;">
      <button id="addExamTemp" class="btn primary">Agregar (en borrador)</button>
    </div>
  `;
  examsList.parentNode.insertBefore(addRow, examsList.nextSibling);

  document.getElementById('addExamTemp').onclick = () => {
    const name = document.getElementById('newExamName').value.trim();
    if (!name) {
      alert('Nombre requerido');
      return;
    }
    const tempId = qid();
    draft.newExams.push({ tempId, nombre: name, sectionId: currentSectionId });

    const preview = document.createElement('div');
    preview.className = 'examBox';
    preview.dataset.tempid = tempId;
    preview.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(name)}</div>
        <div class="small muted">Nuevo (borrador)</div>
      </div>
      <div><button class="btn">---</button></div>
    `;
    examsList.appendChild(preview);
    document.getElementById('newExamName').value = '';
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
    const inputs = examsList.querySelectorAll('input.exam-title-input');
    inputs.forEach(inp => {
      const eid = inp.dataset.eid;
      const newTitle = inp.value.trim();
      if (!eid) return;
      if (draft.exams[eid]) draft.exams[eid].nombre = newTitle;
      else draft.exams[eid] = { nombre: newTitle, deleted:false, new:false };
    });

    const dels = examsList.querySelectorAll('input[type=checkbox][data-del]');
    dels.forEach(d => {
      const eid = d.getAttribute('data-del');
      if (d.checked) {
        draft.exams[eid] = { ...(draft.exams[eid] || {}), deleted:true };
      }
    });

    // Marcar eliminados (soft delete)
    for (const [eid, eObj] of Object.entries(draft.exams)) {
      if (eObj.deleted) {
        try {
          await updateDoc(doc(db,'exams', eid), { deleted:true });
        } catch(err){
          console.warn('failed mark deleted', eid, err);
        }
      }
    }

    // Actualizar títulos
    for (const [eid, eObj] of Object.entries(draft.exams)) {
      if (eObj.deleted) continue;
      if (eObj.nombre !== undefined) {
        try {
          await updateDoc(doc(db,'exams', eid), { nombre: eObj.nombre });
        } catch(err){
          console.warn('saveExam title update failed', eid, err);
        }
      }
    }

    // Crear exámenes nuevos
    for (const nx of draft.newExams) {
      try {
        await addDoc(collection(db,'exams'), {
          nombre: nx.nombre,
          sectionId: nx.sectionId,
          questionCount: 0,
          createdAt: new Date().toISOString()
        });
      } catch(err){
        console.warn('create new exam failed', nx, err);
      }
    }

    draft.exams = {};
    draft.newExams = [];

    alert('Cambios guardados');

    hide(btnSave);
    show(btnEdit);
    const addRow = document.getElementById('addExamRow');
    if (addRow) addRow.remove();

    await renderExamsForSection(currentSectionId);

  } catch(e){
    console.error('saveExamsDraft', e);
    alert('Error guardando cambios');
  }
}

// ---------------------- INIT ----------------------
async function init(){
  hide(editButtons);
  hide(editExamButtons);
  hide(btnSave);
  hide(btnSaveExam);
  await loadSections();
}
init().catch(e => console.error(e));
