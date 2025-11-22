// app.js (versión optimizada y corregida)
// Mantiene todas las funciones originales adaptadas al nuevo index.html.
// Author: refactor para Estudiante ENARM
// Nota: requiere Firebase modular v9+ (CDN import in index.html already present in prior steps)

// ---------------------- IMPORTS FIREBASE ----------------------
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
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------------------- FIREBASE CONFIG (usa la tuya) ----------------------
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
const SECS_PER_Q = 75; // 1 min 15 sec = 75 seconds
const MAX_ATTEMPTS = 3;

// ---------------------- DOM HELPERS ----------------------
const $ = id => document.getElementById(id);
function show(el){ if(!el) return; el.classList.remove('hidden'); }
function hide(el){ if(!el) return; el.classList.add('hidden'); }
function el(tag='div', opts={}) { const d = document.createElement(tag); Object.assign(d, opts); return d; }
function textNode(t){ return document.createTextNode(t ?? ''); }
function nowISO(){ return new Date().toISOString(); }

// ---------------------- SELECTORES (según index.html final) ----------------------
const sectionsList = $('sectionsList');
const mainCountdownEl = $('mainCountdown');
const adminEditor = $('adminEditor');

const btnAddSection = $('btnAddSection');
const btnAddExam = $('btnAddExam');
const btnEditMode = $('btnEditMode');
const btnLinks = $('btnLinks');
const btnUsers = $('btnUsers');

const loginScreen = $('loginScreen');
const studentScreen = $('studentScreen');
const adminScreen = $('adminScreen');
const examScreen = $('examScreen');
const resultScreen = $('resultScreen');

const inputEmail = $('inputEmail');
const inputPassword = $('inputPassword');
const btnLogin = $('btnLogin');
const btnCancel = $('btnCancel');
const loginMessage = $('loginMessage');

const studentTitle = $('studentTitle');
const examsList = $('examsList');

const examTitle = $('examTitle');
const examTimer = $('examTimer');
const examForm = $('examForm');
const btnFinishExam = $('btnFinishExam');

// fallback creation to avoid exceptions if any id missing (safety)
[sectionsList, mainCountdownEl, adminEditor, btnAddSection, btnAddExam, btnEditMode, btnLinks, btnUsers,
 loginScreen, studentScreen, adminScreen, examScreen, resultScreen,
 inputEmail, inputPassword, btnLogin, btnCancel, loginMessage, studentTitle, examsList,
 examTitle, examTimer, examForm, btnFinishExam].forEach((node, idx) => {
  if (!node) {
    // create invisible placeholder to avoid null refs
    const id = ['sectionsList','mainCountdown','adminEditor','btnAddSection','btnAddExam','btnEditMode','btnLinks','btnUsers',
      'loginScreen','studentScreen','adminScreen','examScreen','resultScreen',
      'inputEmail','inputPassword','btnLogin','btnCancel','loginMessage','studentTitle','examsList',
      'examTitle','examTimer','examForm','btnFinishExam'][idx];
    if (!document.getElementById(id)) {
      const ph = document.createElement('div');
      ph.id = id;
      ph.className = 'hidden';
      document.body.appendChild(ph);
    }
  }
});

// ---------------------- ESTADO ----------------------
let currentUser = null; // { uid, email, role, estado, expiracion }
let currentSectionId = null;
let currentExam = null;
let examTimerInterval = null;
let examRemaining = 0;

// ---------------------- UTILIDADES FIRESTORE ----------------------
async function getCollectionDocs(colName, q = null) {
  try {
    const colRef = collection(db, colName);
    const snap = q ? await getDocs(q) : await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error('getCollectionDocs', colName, e); return []; }
}

// ---------------------- COUNTDOWN PRINCIPAL ----------------------
function startMainCountdown(targetDateStr='2026-09-23T00:00:00') {
  const target = new Date(targetDateStr);
  if (!mainCountdownEl) return;
  function tick() {
    const now = new Date();
    let diff = Math.floor((target - now)/1000);
    if (diff <= 0) { mainCountdownEl.textContent = 'Evento iniciado'; clearInterval(timer); return; }
    const d = Math.floor(diff/86400); diff -= d*86400;
    const h = Math.floor(diff/3600); diff -= h*3600;
    const m = Math.floor(diff/60); const s = diff%60;
    mainCountdownEl.textContent = `${d}d ${h}h ${m}m ${s}s`;
  }
  tick();
  const timer = setInterval(tick, 1000);
}
startMainCountdown();

// ---------------------- SECCIONES & EXÁMENES ----------------------
async function loadSectionsUI(){
  sectionsList.innerHTML = '';
  // fetch sections ordered by 'nombre'
  try {
    const q = query(collection(db,'sections'), orderBy('nombre'));
    const docs = await getCollectionDocs('sections', q);
    if (!docs.length) {
      // create default section if none exist
      await addDoc(collection(db,'sections'), { nombre: 'Sección 1', createdAt: nowISO() });
      return loadSectionsUI();
    }
    docs.forEach(s => {
      const btn = el('button', { className: 'section-item btn full' });
      btn.textContent = s.nombre || 'Sección';
      btn.dataset.id = s.id;
      btn.onclick = () => selectSection(s.id, s.nombre);
      sectionsList.appendChild(btn);
    });
  } catch(e){ console.error('loadSectionsUI', e); }
}

async function selectSection(sectionId, nombre){
  currentSectionId = sectionId;
  if (studentTitle) studentTitle.textContent = nombre || 'Sección';
  // highlight selection
  Array.from(sectionsList.children).forEach(ch => ch.classList.toggle('active', ch.dataset.id === sectionId));
  await loadExamsForSection(sectionId);
}

async function loadExamsForSection(sectionId) {
  examsList.innerHTML = '';
  if (!sectionId) return;
  try {
    const q = query(collection(db,'exams'), where('sectionId','==', sectionId), orderBy('nombre'));
    const docs = await getCollectionDocs('exams', q);
    if (!docs.length) {
      examsList.innerHTML = '<div class="muted">No hay exámenes en esta sección</div>';
      return;
    }
    docs.forEach(e => {
      const card = el('div', { className: 'examBox card' });
      const left = el('div'); left.innerHTML = `<div style="font-weight:700">${escapeHtml(e.nombre)}</div><div class="small muted">Preguntas: ${e.questionCount || 0}</div>`;
      const right = el('div'); right.style.textAlign = 'right';
      const attemptsBadge = el('div', { className: 'examAttempts', id:`attempt_${e.id}` });
      attemptsBadge.textContent = `0/${MAX_ATTEMPTS}`;
      const btnOpen = el('button', { className: 'btn', type:'button' }); btnOpen.textContent = 'Abrir';
      btnOpen.onclick = () => openExam(e.id);
      const btnEdit = el('button', { className: 'btn', type:'button', style:'margin-left:8px;' }); btnEdit.textContent='Editar';
      btnEdit.onclick = () => openExamEditor(e.id);
      right.appendChild(attemptsBadge); right.appendChild(btnOpen); right.appendChild(btnEdit);
      card.appendChild(left); card.appendChild(right);
      examsList.appendChild(card);
      updateAttemptsDisplay(e.id);
    });
  } catch(e) { console.error('loadExamsForSection', e); }
}

// ---------------------- INTENTOS ----------------------
async function updateAttemptsDisplay(examId){
  try {
    if (!currentUser) return;
    const attId = `${currentUser.uid}_${examId}`;
    const docRef = doc(db,'attempts',attId);
    const snap = await getDoc(docRef);
    const used = snap.exists() ? snap.data().used || 0 : 0;
    const elBadge = document.getElementById(`attempt_${examId}`);
    if (elBadge) elBadge.textContent = `${used}/${MAX_ATTEMPTS}`;
  } catch(e){ console.error('updateAttemptsDisplay', e); }
}

// ---------------------- ABRIR EXAMEN (VALIDAR INTENTOS) ----------------------
async function openExam(examId){
  try {
    if (!currentUser) { alert('Debes iniciar sesión'); return; }
    // check attempts
    const attId = `${currentUser.uid}_${examId}`;
    const attRef = doc(db,'attempts', attId);
    const attSnap = await getDoc(attRef);
    const used = attSnap.exists() ? attSnap.data().used || 0 : 0;
    if (used >= MAX_ATTEMPTS && currentUser.role !== 'admin') {
      alert('Has agotado los intentos para este examen.');
      return;
    }
    // fetch exam
    const eSnap = await getDoc(doc(db,'exams', examId));
    if (!eSnap.exists()) { alert('Examen no encontrado'); return; }
    currentExam = { id: examId, ...eSnap.data() };
    // fetch questions for exam
    const q = query(collection(db,'questions'), where('examId','==', examId), orderBy('pregunta'));
    const qDocs = await getCollectionDocs('questions', q);
    if (!qDocs.length) { alert('No hay preguntas en este examen'); return; }
    renderExamScreen(currentExam, qDocs);
  } catch(e){ console.error('openExam', e); alert('Error al abrir examen'); }
}

// ---------------------- RENDER EXAM SCREEN ----------------------
function renderExamScreen(exam, questions){
  // hide other screens
  hide(loginScreen); hide(studentScreen); hide(adminEditor); hide(adminScreen); hide(resultScreen);
  show(examScreen);
  examTitle.textContent = exam.nombre || 'Examen';
  examForm.innerHTML = '';
  // timer
  const totalSec = questions.length * SECS_PER_Q;
  startExamTimer(totalSec);
  // render questions
  questions.forEach((q, idx) => {
    const qBlock = el('div', { className:'questionBlock card' });
    const qTitle = el('div', { className:'questionTitle' });
    qTitle.textContent = `Pregunta ${idx+1}`;
    qBlock.appendChild(qTitle);
    if (q.casoClinico) {
      const caseDiv = el('div', { className:'caseText' });
      caseDiv.innerHTML = `<strong>Caso:</strong> ${escapeHtml(q.casoClinico)}`;
      qBlock.appendChild(caseDiv);
    }
    const enun = el('div'); enun.innerHTML = `<strong>${escapeHtml(q.pregunta)}</strong>`;
    qBlock.appendChild(enun);
    const opts = el('div', { className:'options' });
    (q.opciones || []).forEach((opt, oi) => {
      const idOpt = `opt_${q.id}_${oi}`;
      const label = el('label');
      label.innerHTML = `<input type="radio" name="${q.id}" value="${oi}" id="${idOpt}"> ${String.fromCharCode(65+oi)}. ${escapeHtml(opt)}`;
      opts.appendChild(label);
    });
    qBlock.appendChild(opts);
    // justification hidden by default (will show in result)
    const just = el('div', { className:'justification hidden' });
    just.textContent = q.justificacion || '';
    qBlock.appendChild(just);
    examForm.appendChild(qBlock);
  });

  btnFinishExam.onclick = async () => {
    if (!confirm('Finalizar examen (contará como intento). ¿Continuar?')) return;
    await finalizeExamAndGrade(currentExam.id);
  };
}

// ---------------------- EXAM TIMER ----------------------
function startExamTimer(totalSeconds){
  clearInterval(examTimerInterval);
  examRemaining = totalSeconds;
  function tick(){
    if (!examTimer) return;
    if (examRemaining <= 0) {
      examTimer.textContent = '00:00';
      clearInterval(examTimerInterval);
      alert('Tiempo agotado. Se finalizará el examen.');
      btnFinishExam.click();
      return;
    }
    const mm = Math.floor(examRemaining/60).toString().padStart(2,'0');
    const ss = (examRemaining%60).toString().padStart(2,'0');
    examTimer.textContent = `${mm}:${ss}`;
    examRemaining--;
  }
  tick();
  examTimerInterval = setInterval(tick, 1000);
}

// ---------------------- FINALIZAR Y CALIFICAR ----------------------
async function finalizeExamAndGrade(examId) {
  try {
    // collect answers
    const answers = {};
    const checked = examForm.querySelectorAll('input[type=radio]:checked');
    checked.forEach(i => answers[i.name] = Number(i.value));
    // fetch questions truth source
    const qDocs = await getCollectionDocs('questions', query(collection(db,'questions'), where('examId','==', examId)));
    let correct = 0;
    qDocs.forEach(q => {
      const sel = answers[q.id];
      if (typeof sel === 'number' && sel === (q.correcta || 0)) correct++;
    });
    const percent = qDocs.length ? Math.round((correct / qDocs.length) * 100) : 0;
    // increment attempts
    if (currentUser) {
      const attId = `${currentUser.uid}_${examId}`;
      const attRef = doc(db,'attempts', attId);
      const attSnap = await getDoc(attRef);
      const used = attSnap.exists() ? attSnap.data().used || 0 : 0;
      await setDoc(attRef, { used: used + 1, last: nowISO() });
    }
    // render result
    renderResultScreen(qDocs, answers, percent);
    // update attempts badges
    await loadExamsForSection(currentSectionId);
    clearInterval(examTimerInterval);
  } catch(e){ console.error('finalizeExamAndGrade', e); alert('Error al finalizar'); }
}

function renderResultScreen(questions, answers, percent){
  hide(examScreen); hide(loginScreen); hide(studentScreen); hide(adminScreen);
  show(resultScreen);
  resultScreen.innerHTML = `<h3>Calificación: ${percent}%</h3>`;
  questions.forEach((q, idx) => {
    const userSel = answers[q.id];
    const correctIdx = q.correcta || 0;
    const wrapper = el('div', { className: (userSel === correctIdx ? 'result-correct card' : 'result-wrong card') });
    wrapper.style.marginBottom = '10px';
    wrapper.innerHTML = `<div style="font-weight:700">Pregunta ${idx+1}</div><div style="margin-top:8px">${escapeHtml(q.pregunta)}</div>`;
    const opts = el('div');
    (q.opciones || []).forEach((opt, i) => {
      const optDiv = el('div');
      let mark = '';
      if (i === correctIdx) mark = ' (Correcta)';
      if (i === userSel && i !== correctIdx) mark = ' (Tu elección)';
      optDiv.textContent = `${String.fromCharCode(65 + i)}. ${opt}${mark}`;
      opts.appendChild(optDiv);
    });
    const just = el('div', { className:'small muted', style:'margin-top:8px' });
    just.textContent = q.justificacion || '';
    wrapper.appendChild(opts);
    wrapper.appendChild(just);
    resultScreen.appendChild(wrapper);
  });
}

// ---------------------- AUTH ----------------------
btnLogin && (btnLogin.onclick = async () => {
  const email = inputEmail.value.trim();
  const pass = inputPassword.value.trim();
  if (!email || !pass) { loginMessage.textContent = 'Ingrese credenciales'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginMessage.textContent = '';
  } catch(e) {
    console.error('login', e);
    loginMessage.textContent = 'Credenciales inválidas';
  }
});
btnCancel && (btnCancel.onclick = () => { inputEmail.value=''; inputPassword.value=''; loginMessage.textContent=''; });

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    hide(adminScreen); hide(studentScreen); hide(examScreen); hide(resultScreen);
    show(loginScreen);
    await loadSectionsUI();
    return;
  }
  // read users collection to get role and expiration
  try {
    const uRef = doc(db,'users', user.uid);
    const uSnap = await getDoc(uRef);
    let role='estudiante', estado='habilitado', expir=null;
    if (uSnap.exists()) {
      const d = uSnap.data();
      role = d.role || role;
      estado = d.estado || estado;
      expir = d.expiracion || null;
    }
    currentUser = { uid: user.uid, email: user.email, role, estado, expiracion: expir };
    // check expiration
    if (currentUser.expiracion) {
      const now = new Date();
      const exp = new Date(currentUser.expiracion);
      if (now > exp) {
        alert('Tu acceso ha expirado. Contacta al administrador.');
        await signOut(auth);
        return;
      }
    }
    // show UI
    if (currentUser.role === 'admin' || currentUser.uid === ADMIN_UID) {
      currentUser.role = 'admin';
      showAdminUI();
    } else {
      currentUser.role = 'estudiante';
      showStudentUI();
    }
  } catch(e){ console.error('onAuthStateChanged', e); }
});

async function doLogout(){
  try { await signOut(auth); location.reload(); } catch(e){ console.error('logout', e); }
}

// ---------------------- UI: estudiante / admin ----------------------
async function showStudentUI(){
  hide(loginScreen); hide(adminEditor); hide(adminScreen); hide(resultScreen);
  show(studentScreen);
  // render auth buttons
  const authDiv = $('authButtons');
  if (authDiv) authDiv.innerHTML = `<button id="btnLogout" class="btn">Salir</button>`;
  const b = $('btnLogout'); if (b) b.onclick = doLogout;
  await loadSectionsUI();
  // select first section default
  const secs = await getCollectionDocs('sections', query(collection(db,'sections'), orderBy('nombre')));
  if (secs.length) selectSection(secs[0].id, secs[0].nombre);
}

async function showAdminUI(){
  hide(loginScreen); hide(studentScreen); hide(resultScreen);
  show(adminScreen); show(adminEditor);
  // auth buttons
  const authDiv = $('authButtons');
  if (authDiv) authDiv.innerHTML = `<button id="btnLogout" class="btn">Salir</button>`;
  const b = $('btnLogout'); if (b) b.onclick = doLogout;
  await loadSectionsUI();
  // select first section by default
  const secs = await getCollectionDocs('sections', query(collection(db,'sections'), orderBy('nombre')));
  if (secs.length) selectSection(secs[0].id, secs[0].nombre);
  // pre-load adminEditor with helpful info
  adminEditor.innerHTML = `<div class="card"><strong>Panel de administración</strong><p>Selecciona una sección o usa los botones del sidebar para crear/editar contenido.</p></div>`;
}

// ---------------------- ADMIN BUTTONS (sidebar) ----------------------
btnAddSection && (btnAddSection.onclick = async () => {
  const nombre = prompt('Nombre de la nueva sección:');
  if (!nombre) return;
  await addDoc(collection(db,'sections'), { nombre, createdAt: nowISO() });
  await loadSectionsUI();
});

btnAddExam && (btnAddExam.onclick = async () => {
  if (!currentSectionId) return alert('Selecciona una sección antes');
  const nombre = prompt('Nombre del examen:');
  if (!nombre) return;
  const exRef = await addDoc(collection(db,'exams'), { nombre, sectionId: currentSectionId, questionCount: 0, createdAt: nowISO() });
  alert('Examen creado. Abriendo editor...');
  openExamEditor(exRef.id);
  await loadExamsForSection(currentSectionId);
});

btnEditMode && (btnEditMode.onclick = async () => {
  // open editor listing sections and exams
  adminEditor.innerHTML = '<h4>Editor</h4>';
  // sections
  const secs = await getCollectionDocs('sections', query(collection(db,'sections'), orderBy('nombre')));
  secs.forEach(s => {
    const div = el('div', { className:'card' });
    div.innerHTML = `<strong>${escapeHtml(s.nombre)}</strong> <button class="btn small" data-sid="${s.id}">Editar</button>`;
    adminEditor.appendChild(div);
  });
  // exams
  const exs = await getCollectionDocs('exams', query(collection(db,'exams'), orderBy('nombre')));
  exs.forEach(e => {
    const div = el('div', { className:'card' });
    div.innerHTML = `<strong>${escapeHtml(e.nombre)}</strong> (sección: ${escapeHtml(e.sectionId || '')}) <button class="btn small" data-eid="${e.id}">Editar examen</button>`;
    adminEditor.appendChild(div);
  });
  // attach handlers
  adminEditor.querySelectorAll('[data-sid]').forEach(btn => btn.onclick = async () => {
    const sid = btn.getAttribute('data-sid');
    const newName = prompt('Nuevo nombre de la sección:');
    if (!newName) return;
    await updateDoc(doc(db,'sections',sid), { nombre: newName });
    await loadSectionsUI();
    btnEditMode.click();
  });
  adminEditor.querySelectorAll('[data-eid]').forEach(btn => btn.onclick = () => openExamEditor(btn.getAttribute('data-eid')));
});

btnLinks && (btnLinks.onclick = async () => {
  const ig = prompt('Link Instagram (completo)', $('link-instagram')?.href || '');
  const wa = prompt('Link WhatsApp (completo)', $('link-whatsapp')?.href || '');
  const tg = prompt('Link Telegram (completo)', $('link-telegram')?.href || '');
  const tt = prompt('Link TikTok (completo)', $('link-tiktok')?.href || '');
  if (ig && $('link-instagram')) $('link-instagram').href = ig;
  if (wa && $('link-whatsapp')) $('link-whatsapp').href = wa;
  if (tg && $('link-telegram')) $('link-telegram').href = tg;
  if (tt && $('link-tiktok')) $('link-tiktok').href = tt;
  alert('Links actualizados en UI (no persistidos). Si deseas persistencia dime y lo guardo en Firestore.');
});

// ---------------------- ADMIN: USUARIOS (LISTAR / CREAR / EDITAR / ELIMINAR) ----------------------
btnUsers && (btnUsers.onclick = async () => {
  // Render full users management UI inside adminEditor
  adminEditor.innerHTML = '<h4>Gestión de usuarios</h4><div id="usersList"></div><hr/><div id="userForm"></div>';
  const usersList = document.getElementById('usersList');
  const userForm = document.getElementById('userForm');

  async function refreshUsers(){
    usersList.innerHTML = '';
    const uDocs = await getCollectionDocs('users', query(collection(db,'users'), orderBy('usuario')));
    if (!uDocs.length) usersList.innerHTML = '<div class="muted">No hay usuarios registrados</div>';
    uDocs.forEach(u => {
      const d = el('div', { className:'card' });
      d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${escapeHtml(u.id)}</strong><br/>
          <small>${escapeHtml(u.usuario || u.nombre || '')} - ${escapeHtml(u.role || 'estudiante')} - ${escapeHtml(u.estado || 'habilitado')}</small>
          <div style="font-size:12px;color:#666">Expira: ${escapeHtml(u.expiracion || '')}</div>
        </div>
        <div>
          <button class="btn edit-user" data-uid="${u.id}">Editar</button>
          <button class="btn del-user" data-uid="${u.id}">Eliminar</button>
        </div>
      </div>`;
      usersList.appendChild(d);
    });
    // attach handlers
    usersList.querySelectorAll('.edit-user').forEach(b => b.onclick = async () => {
      const uid = b.getAttribute('data-uid');
      const snap = await getDoc(doc(db,'users',uid));
      renderUserForm(uid, snap.exists() ? snap.data() : {});
    });
    usersList.querySelectorAll('.del-user').forEach(b => b.onclick = async () => {
      const uid = b.getAttribute('data-uid');
      if (!confirm('Eliminar usuario? Esto solo elimina registro en Firestore, no la cuenta Auth.')) return;
      await deleteDoc(doc(db,'users',uid));
      alert('Usuario eliminado');
      refreshUsers();
    });
  }

  function renderUserForm(uid='', data={}){
    userForm.innerHTML = `
      <h4>${uid ? 'Editar usuario' : 'Nuevo usuario'}</h4>
      <label>UID</label><input id="u_uid" value="${escapeHtml(uid)}" ${uid ? 'readonly' : ''}/>
      <label>Nombre visible</label><input id="u_nombre" value="${escapeHtml(data.usuario || data.nombre || '')}"/>
      <label>Contraseña (solo en Firestore)</label><input id="u_pass" value="${escapeHtml(data.pass || '')}"/>
      <label>Rol</label>
      <select id="u_role">
        <option value="estudiante" ${ (data.role === 'estudiante' || !data.role) ? 'selected':'' }>Estudiante</option>
        <option value="admin" ${ data.role === 'admin' ? 'selected':'' }>Admin</option>
      </select>
      <label>Estado</label>
      <select id="u_estado">
        <option value="habilitado" ${ (data.estado === 'habilitado' || !data.estado) ? 'selected' : '' }>Habilitado</option>
        <option value="inhabilitado" ${ data.estado === 'inhabilitado' ? 'selected':'' }>Inhabilitado</option>
      </select>
      <label>Fecha expiración</label><input id="u_exp" type="date" value="${escapeHtml(data.expiracion || '')}"/>
      <div style="margin-top:8px"><button id="saveUser" class="btn primary">${uid ? 'Actualizar' : 'Crear'}</button> <button id="cancelUser" class="btn">Cancelar</button></div>
    `;
    document.getElementById('cancelUser').onclick = () => { userForm.innerHTML = ''; };
    document.getElementById('saveUser').onclick = async () => {
      const fuid = document.getElementById('u_uid').value.trim();
      const fnombre = document.getElementById('u_nombre').value.trim();
      const fpass = document.getElementById('u_pass').value.trim();
      const frole = document.getElementById('u_role').value;
      const fest = document.getElementById('u_estado').value;
      const fexp = document.getElementById('u_exp').value;
      if (!fuid || !fnombre) return alert('UID y nombre requeridos');
      await setDoc(doc(db,'users',fuid), { usuario: fnombre, pass: fpass, role: frole, estado: fest, expiracion: fexp }, { merge:true });
      alert('Usuario guardado (no crea cuenta Auth).');
      userForm.innerHTML = '';
      await refreshUsers();
    };
  }

  // add new user button
  const addBtn = el('button', { className:'btn', type:'button' });
  addBtn.textContent = 'Agregar nuevo';
  addBtn.onclick = () => renderUserForm('', {});
  adminEditor.appendChild(addBtn);

  await refreshUsers();
});

// ---------------------- ADMIN: EDITOR DE EXAMENES & PREGUNTAS ----------------------
async function openExamEditor(examId){
  adminEditor.innerHTML = '<h4>Editor de examen</h4>';
  const eSnap = await getDoc(doc(db,'exams',examId));
  if (!eSnap.exists()) { adminEditor.appendChild(el('div', { innerHTML:'Examen no encontrado' })); return; }
  const examData = eSnap.data();
  adminEditor.appendChild(el('div', { innerHTML:`<strong>${escapeHtml(examData.nombre)}</strong>` }));

  // list questions
  const qDocs = await getCollectionDocs('questions', query(collection(db,'questions'), where('examId','==', examId), orderBy('pregunta')));
  if (!qDocs.length) adminEditor.appendChild(el('div', { innerHTML:'No hay preguntas' }));
  qDocs.forEach(q => {
    const card = el('div', { className:'card' });
    card.innerHTML = `<div style="font-weight:700">${escapeHtml(q.pregunta)}</div>
      <div style="margin-top:6px">
        <button class="btn edit-q" data-qid="${q.id}">Editar</button>
        <button class="btn del-q" data-qid="${q.id}">Eliminar</button>
      </div>`;
    adminEditor.appendChild(card);
  });

  // attach handlers after appended
  adminEditor.querySelectorAll('.edit-q').forEach(b => b.onclick = async () => {
    const qid = b.getAttribute('data-qid');
    const snap = await getDoc(doc(db,'questions', qid));
    const data = snap.exists() ? snap.data() : null;
    if (!data) return alert('Pregunta no encontrada');
    // show inline editor
    showQuestionFormInline(examId, data, qid);
  });

  adminEditor.querySelectorAll('.del-q').forEach(b => b.onclick = async () => {
    const qid = b.getAttribute('data-qid');
    if (!confirm('Eliminar pregunta?')) return;
    await deleteDoc(doc(db,'questions', qid));
    // update questionCount
    const qSnap = await getCollectionDocs('questions', query(collection(db,'questions'), where('examId','==', examId)));
    await updateDoc(doc(db,'exams',examId), { questionCount: qSnap.length });
    alert('Pregunta eliminada.');
    openExamEditor(examId);
  });

  // add question button
  const addBtn = el('button', { className:'btn primary', type:'button' });
  addBtn.textContent = 'Agregar pregunta';
  addBtn.onclick = () => showQuestionFormInline(examId);
  adminEditor.appendChild(addBtn);
}

// inline question form (for create or edit)
function showQuestionFormInline(examId, existing=null, qid=null) {
  // remove existing form if any
  const prev = adminEditor.querySelector('.question-form-inline');
  if (prev) prev.remove();

  const form = el('div', { className:'question-form-inline card' });
  form.innerHTML = `
    <label>Caso clínico (opcional)</label>
    <textarea id="f_caso" rows="3">${existing ? escapeHtml(existing.casoClinico || '') : ''}</textarea>
    <label>Pregunta</label><input id="f_preg" value="${existing ? escapeHtml(existing.pregunta || '') : ''}" />
    <label>Opción A</label><input id="f_a" value="${existing ? escapeHtml((existing.opciones||[])[0]||'') : ''}" />
    <label>Opción B</label><input id="f_b" value="${existing ? escapeHtml((existing.opciones||[])[1]||'') : ''}" />
    <label>Opción C</label><input id="f_c" value="${existing ? escapeHtml((existing.opciones||[])[2]||'') : ''}" />
    <label>Opción D</label><input id="f_d" value="${existing ? escapeHtml((existing.opciones||[])[3]||'') : ''}" />
    <label>Índice correcta (0=A,1=B...)</label><input id="f_idx" value="${existing ? (existing.correcta||0) : 0}" />
    <label>Justificación</label><textarea id="f_just">${existing ? escapeHtml(existing.justificacion||'') : ''}</textarea>
    <div style="margin-top:8px">
      <button id="f_save" class="btn primary">${existing ? 'Actualizar' : 'Crear'}</button>
      <button id="f_cancel" class="btn">Cancelar</button>
    </div>
  `;
  adminEditor.appendChild(form);

  document.getElementById('f_cancel').onclick = () => { form.remove(); };
  document.getElementById('f_save').onclick = async () => {
    const caso = document.getElementById('f_caso').value.trim();
    const preg = document.getElementById('f_preg').value.trim();
    const a = document.getElementById('f_a').value.trim();
    const b = document.getElementById('f_b').value.trim();
    const c = document.getElementById('f_c').value.trim();
    const d = document.getElementById('f_d').value.trim();
    const idx = Number(document.getElementById('f_idx').value || 0);
    const just = document.getElementById('f_just').value.trim();
    const opciones = [a,b,c,d].filter(x => x !== '');
    if (!preg || opciones.length === 0) return alert('Pregunta y al menos una opción son requeridos');
    try {
      if (qid) {
        // update existing
        await updateDoc(doc(db,'questions', qid), {
          casoClinico: caso,
          pregunta: preg,
          opciones,
          correcta: idx,
          justificacion: just,
          updatedAt: nowISO()
        });
        alert('Pregunta actualizada');
      } else {
        // add new
        const newQ = await addDoc(collection(db,'questions'), {
          examId,
          casoClinico: caso,
          pregunta: preg,
          opciones,
          correcta: idx,
          justificacion: just,
          createdAt: nowISO()
        });
        // update questionCount on exam
        const qSnap = await getCollectionDocs('questions', query(collection(db,'questions'), where('examId','==', examId)));
        await updateDoc(doc(db,'exams', examId), { questionCount: qSnap.length });
        alert('Pregunta creada');
      }
      form.remove();
      openExamEditor(examId);
    } catch(e){ console.error('save question inline', e); alert('Error al guardar pregunta'); }
  };
}

// ---------------------- UTILIDADES ----------------------
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------- INICIALIZACION ----------------------
(async function init(){
  await loadSectionsUI();
  // Attach event to sections if any already exist will be clickable
  // Note: auth state change will handle login view
  console.log('App initialized');
})();
