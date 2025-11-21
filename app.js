/* app.js
  Vanilla JS front-end with Firebase hooks (Auth + Firestore + Storage).
  Uses Firebase compat SDK (loaded in index.html).
*/

/* ---------- FIREBASE CONFIG: reemplaza si es necesario ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.appspot.com", // opcional ajustar
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};
/* ------------------------------------------------------------------ */

try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.warn('Firebase initializeApp warning (probablemente ya inicializado):', e);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ---------- Globals and DOM ---------- */
const state = {
  mode: 'guest', // guest | user | admin
  uid: null,
  currentExam: null,
  examTimerInterval: null,
  examRemainingSec: 0,
  examAnswers: {},
  config: null
};

/* DOM references (ensure elements exist) */
const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const toggleThemeBtn = document.getElementById('toggleTheme');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const inputUser = document.getElementById('inputUser');
const inputPass = document.getElementById('inputPass');
const modalLogin = document.getElementById('modalLogin');
const modalCancel = document.getElementById('modalCancel');
const btnUsuario = document.getElementById('btnUsuario');
const btnAdmin = document.getElementById('btnAdmin');
const loginButtons = document.getElementById('loginButtons');
const sectionsList = document.getElementById('sectionsList');
const homeScreen = document.getElementById('homeScreen');
const examsGrid = document.getElementById('examsGrid');
const examScreen = document.getElementById('examScreen');
const examTitle = document.getElementById('examTitle');
const examTimer = document.getElementById('examTimer');
const examContent = document.getElementById('examContent');
const btnFinish = document.getElementById('btnFinish');
const examBack = document.getElementById('examBack');
const resultsScreen = document.getElementById('resultsScreen');
const resultsContent = document.getElementById('resultsContent');
const resultsBack = document.getElementById('resultsBack');
const adminScreen = document.getElementById('adminScreen');
const adminMain = document.getElementById('adminMain');
const adminUsuarios = document.getElementById('adminUsuarios');
const adminIconos = document.getElementById('adminIconos');
const adminSecciones = document.getElementById('adminSecciones');
const sidebarCountdown = document.getElementById('sidebarCountdown');
const accesoCompleto = document.getElementById('accesoCompleto');
const sidebarIcons = document.getElementById('sidebarIcons');
const sectionsContainer = sectionsList;

/* ---------- UI helpers ---------- */
function showModal(title, mode){
  modalTitle.textContent = title;
  modal.classList.remove('hidden');
  modal.dataset.for = mode;
}
function hideModal(){ modal.classList.add('hidden'); inputUser.value=''; inputPass.value=''; }
function showScreen(el){
  [homeScreen, examScreen, resultsScreen, adminScreen].forEach(s=> s && s.classList.add('hidden'));
  el && el.classList.remove('hidden');
}
function setTheme(theme){
  document.body.classList.remove('light','dark');
  document.body.classList.add(theme);
  localStorage.setItem('theme', theme);
}
toggleThemeBtn && toggleThemeBtn.addEventListener('click', () => {
  const current = document.body.classList.contains('dark')? 'dark' : 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
});
hamburger && hamburger.addEventListener('click', ()=> sidebar && sidebar.classList.toggle('closed') );

/* ---------- Countdown to 23 Sep 2026 ---------- */
function updateCountdown(){
  const target = new Date('2026-09-23T00:00:00');
  const now = new Date();
  let diff = Math.max(0, Math.floor((target - now)/1000));
  const days = Math.floor(diff / 86400); diff %= 86400;
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const minutes = Math.floor(diff / 60);
  if(sidebarCountdown) sidebarCountdown.textContent = `${days}d ${hours}h ${minutes}m`;
}
setInterval(updateCountdown, 60*1000);
updateCountdown();

/* ---------- Load site config (icons, acceso link) ---------- */
async function loadConfig(){
  try{
    const doc = await db.collection('site').doc('config').get();
    if(doc.exists) state.config = doc.data();
    else {
      state.config = {
        icons: { instagram: '#', whatsapp: '#', tiktok: '#', telegram: '#' },
        accesoCompleto: '#'
      };
      await db.collection('site').doc('config').set(state.config);
    }
    sidebarIcons && sidebarIcons.querySelectorAll('.iconlink').forEach(a=>{
      const key = a.dataset.key;
      a.href = state.config.icons[key] || '#';
      a.target = '_blank';
    });
    if(accesoCompleto) accesoCompleto.href = state.config.accesoCompleto || '#';
  }catch(err){
    console.error('loadConfig error', err);
  }
}
loadConfig();

/* ---------- Auth (email/password) ---------- */
modalLogin && modalLogin.addEventListener('click', async ()=>{
  const mode = modal.dataset.for;
  const email = inputUser.value.trim();
  const pass = inputPass.value.trim();
  if(!email || !pass){ alert('Completa usuario y contraseña.'); return; }
  try{
    // ensure persistence (important for GitHub Pages)
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    const res = await auth.signInWithEmailAndPassword(email, pass);
    state.uid = res.user.uid;

    const udoc = await db.collection('users').doc(state.uid).get();
    const udata = udoc.exists ? udoc.data() : null;
    if(mode === 'admin' && (!udata || !udata.isAdmin)){
      alert('Cuenta no es admin.');
      await auth.signOut();
      state.uid = null;
      hideModal();
      return;
    }
    if(udata){
      if(udata.state === 'inhabilitado'){ alert('Usuario inhabilitado.'); await auth.signOut(); state.uid=null; hideModal(); return; }
      if(udata.expiresAt && udata.expiresAt.toDate && udata.expiresAt.toDate() < new Date()){
        alert('Usuario vencido.'); await auth.signOut(); state.uid=null; hideModal(); return;
      }
    }
    state.mode = (mode==='admin') ? 'admin' : 'user';
    hideModal();
    onLogin();
  }catch(err){
    console.error('Login error', err);
    alert('Error de login: '+ err.message);
  }
});
modalCancel && modalCancel.addEventListener('click', hideModal);

btnUsuario && btnUsuario.addEventListener('click', ()=> showModal('Acceso Usuario','user'));
btnAdmin && btnAdmin.addEventListener('click', ()=> showModal('Acceso Admin','admin'));

/* ---------- After login UI ---------- */
async function onLogin(){
  try{
    loginButtons && loginButtons.classList.add('hidden');
    sectionsList && sectionsList.classList.remove('hidden');

    const sectionsSnap = await db.collection('sections').orderBy('order').get();
    sectionsContainer.innerHTML = '';
    sectionsSnap.forEach(doc=>{
      const d = doc.data();
      const el = document.createElement('div');
      el.className = 'section-item';
      el.dataset.id = doc.id;
      el.textContent = d.name;
      el.addEventListener('click', ()=> loadSection(doc.id));
      sectionsContainer.appendChild(el);
    });

    if(state.mode === 'admin'){
      adminScreen && adminScreen.classList.remove('hidden');
      showScreen(adminScreen);
    } else {
      const firstSection = sectionsContainer.querySelector('.section-item');
      if(firstSection) firstSection.click();
      showScreen(homeScreen);
    }
    const lb = document.getElementById('loginButtons');
    if(lb) lb.style.display = 'none';
  }catch(err){
    console.error('onLogin error', err);
  }
}

/* ---------- Load section -> list exams ---------- */
async function loadSection(sectionId){
  try{
    showScreen(homeScreen);
    const examsSnap = await db.collection('sections').doc(sectionId).collection('exams').orderBy('order').get();
    examsGrid.innerHTML = '';
    examsSnap.forEach(async doc=>{
      const ex = doc.data();
      const card = document.createElement('div'); card.className='exam-card';
      card.innerHTML = `<strong>${ex.title}</strong><div>${ex.description || ''}</div><div class="attempts" id="attempt-${doc.id}">Cargando intentos...</div>`;
      const btn = document.createElement('button'); btn.className='btn primary';
      btn.textContent = 'Iniciar examen';
      btn.addEventListener('click', ()=> startExam(sectionId, doc.id));
      card.appendChild(btn);
      examsGrid.appendChild(card);

      if(state.uid){
        const attDoc = await db.collection('attempts').doc(`${state.uid}_${doc.id}`).get();
        const att = attDoc.exists ? attDoc.data() : {count:0};
        const el = document.getElementById(`attempt-${doc.id}`);
        if(el) el.textContent = `Intentos ${att.count || 0}/3`;
        if(att.count >= 3) {
          btn.disabled = true;
          btn.textContent = 'Completado';
        }
      } else {
        const el = document.getElementById(`attempt-${doc.id}`);
        if(el) el.textContent = `Inicia sesión para ver intentos`;
      }
    });
  }catch(err){
    console.error('loadSection error', err);
  }
}

/* ---------- Start exam ---------- */
async function startExam(sectionId, examId){
  if(!state.uid){ alert('Necesitas iniciar sesión como usuario'); return; }
  const attRef = db.collection('attempts').doc(`${state.uid}_${examId}`);
  const attDoc = await attRef.get();
  const count = attDoc.exists ? (attDoc.data().count||0) : 0;
  if(count >= 3){ alert('Has completado los 3 intentos.'); return; }

  const examDoc = await db.collection('sections').doc(sectionId).collection('exams').doc(examId).get();
  if(!examDoc.exists) { alert('Examen no encontrado'); return; }
  const exam = examDoc.data();
  exam.id = examDoc.id;
  exam.sectionId = sectionId;
  state.currentExam = exam;
  state.examAnswers = {};

  examTitle.textContent = exam.title;
  examContent.innerHTML = '';
  let totalQuestions = 0;
  exam.questions.forEach((block, bi)=>{
    const blockEl = document.createElement('div'); blockEl.className='question-block';
    if(block.blockTitle) {
      const h = document.createElement('h4'); h.textContent = block.blockTitle; blockEl.appendChild(h);
    }
    block.questions.forEach((q, qi)=>{
      totalQuestions++;
      const qId = `b${bi}_q${qi}`;
      const qEl = document.createElement('div'); qEl.className='question';
      qEl.innerHTML = `<div><strong>Pregunta ${totalQuestions}:</strong> ${q.q}</div>`;
      const opts = document.createElement('div'); opts.className='options';
      q.options.forEach((opt, oi)=>{
        const o = document.createElement('div'); o.className='option';
        o.tabIndex = 0;
        o.textContent = opt;
        o.addEventListener('click', ()=>{
          state.examAnswers[qId] = oi;
          opts.querySelectorAll('.option').forEach((el, idx)=>el.classList.toggle('selected', idx===oi));
        });
        opts.appendChild(o);
      });
      qEl.appendChild(opts);
      blockEl.appendChild(qEl);
    });
    examContent.appendChild(blockEl);
  });

  state.examRemainingSec = totalQuestions * 75;
  updateExamTimerUI();
  clearInterval(state.examTimerInterval);
  state.examTimerInterval = setInterval(()=>{
    state.examRemainingSec--;
    if(state.examRemainingSec <= 0){
      clearInterval(state.examTimerInterval);
      finishExamAutomatically();
    } else updateExamTimerUI();
  },1000);
  showScreen(examScreen);
}

/* ---------- Timer UI ---------- */
function formatTime(sec){
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = (sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}
function updateExamTimerUI(){ examTimer.textContent = formatTime(state.examRemainingSec); }

/* ---------- Finish exam ---------- */
btnFinish && btnFinish.addEventListener('click', finishExam);
examBack && examBack.addEventListener('click', ()=> {
  if(confirm('¿Salir del examen? Tu intento contará al dar "Terminar examen".')) {
    showScreen(homeScreen);
    clearInterval(state.examTimerInterval);
  }
});

async function finishExam(){
  clearInterval(state.examTimerInterval);
  const exam = state.currentExam;
  let total = 0, correct = 0;
  exam.questions.forEach(block=>{
    block.questions.forEach((q)=> total++ );
  });
  const results = [];
  exam.questions.forEach((block, bi)=>{
    block.questions.forEach((q, qi)=>{
      const qId = `b${bi}_q${qi}`;
      const sel = (state.examAnswers[qId] !== undefined) ? state.examAnswers[qId] : null;
      const isCorrect = sel === q.correctIndex;
      if(isCorrect) correct++;
      results.push({qText: q.q, options: q.options, sel, correctIndex: q.correctIndex, justification: q.justification || ''});
    });
  });
  const percent = Math.round((correct / total)*100);

  const attRef = db.collection('attempts').doc(`${state.uid}_${exam.id}`);
  const attDoc = await attRef.get();
  const prev = attDoc.exists ? attDoc.data() : {count:0, history:[]};
  const newCount = (prev.count||0)+1;
  await attRef.set({
    count: newCount,
    lastScore: percent,
    history: firebase.firestore.FieldValue.arrayUnion({
      date: firebase.firestore.Timestamp.now(),
      score: percent,
      correct, total
    })
  }, {merge:true});

  resultsContent.innerHTML = `<div><strong>Calificación:</strong> ${percent}% (${correct}/${total})</div>`;
  results.forEach((r, idx)=>{
    const block = document.createElement('div'); block.className='question-block';
    block.innerHTML = `<div><strong>Pregunta ${idx+1}:</strong> ${r.qText}</div>`;
    r.options.forEach((opt, oi)=>{
      const optEl = document.createElement('div');
      optEl.className = 'option';
      if(oi === r.correctIndex) optEl.classList.add('correct');
      if(r.sel !== null && oi === r.sel && oi !== r.correctIndex) optEl.classList.add('wrong');
      optEl.textContent = opt;
      block.appendChild(optEl);
    });
    const just = document.createElement('div'); just.style.marginTop='8px'; just.style.fontSize='13px';
    just.innerHTML = `<strong>Justificación:</strong><div>${r.justification}</div>`;
    block.appendChild(just);
    resultsContent.appendChild(block);
  });

  showScreen(resultsScreen);
}

async function finishExamAutomatically(){
  alert('Se acabó el tiempo. Se finalizará el examen.');
  await finishExam();
}

/* ---------- Results back button ---------- */
resultsBack && resultsBack.addEventListener('click', ()=> showScreen(homeScreen) );

/* ---------- Admin tools (simplified UI) ---------- */
adminUsuarios && adminUsuarios.addEventListener('click', async ()=>{
  adminMain.innerHTML = '';
  const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between';
  const input = document.createElement('input'); input.placeholder='Buscar por correo';
  const addBtn = document.createElement('button'); addBtn.className='btn primary'; addBtn.textContent='Agregar';
  header.appendChild(input); header.appendChild(addBtn);
  adminMain.appendChild(header);

  const list = document.createElement('div'); list.style.marginTop='12px';
  adminMain.appendChild(list);

  async function loadUsers(q=''){
    list.innerHTML = 'Cargando...';
    let snap = await db.collection('users').get();
    list.innerHTML = '';
    snap.forEach(doc=>{
      const u = doc.data();
      if(q && !(u.email || '').includes(q)) return;
      const el = document.createElement('div'); el.style.padding='8px'; el.style.borderBottom='1px solid rgba(0,0,0,0.04)';
      el.innerHTML = `<strong>${u.displayName||u.email}</strong><div>Estado: ${u.state||'habilitado'} | Vence: ${u.expiresAt? u.expiresAt.toDate(): '—'}</div>`;
      const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Editar';
      edit.addEventListener('click', ()=> editUser(doc.id, u));
      el.appendChild(edit);
      list.appendChild(el);
    });
  }
  loadUsers();

  input.addEventListener('input', ()=> loadUsers(input.value.trim()));

  addBtn.addEventListener('click', ()=> {
    const email = prompt('Email/nombre de usuario (se usará para login):');
    const pass = prompt('Contraseña:');
    if(!email || !pass) return alert('Datos incompletos');
    db.collection('users').add({email, displayName: email, state: 'habilitado', expiresAt: null, isAdmin: false}).then(()=> alert('Usuario agregado en Firestore. Crea también la cuenta en Firebase Auth (Console) con el mismo email/contraseña.'));
  });
});

adminIconos && adminIconos.addEventListener('click', async ()=>{
  adminMain.innerHTML = '<h3>Iconos y enlace Acceso completo</h3>';
  const confDoc = await db.collection('site').doc('config').get();
  const conf = confDoc.exists ? confDoc.data() : {icons:{},accesoCompleto:'#'};
  const container = document.createElement('div');
  container.innerHTML = `
    <div>
      Instagram: <input id="c_ig" value="${conf.icons.instagram||''}" style="width:70%"/>
    </div>
    <div>
      WhatsApp: <input id="c_wa" value="${conf.icons.whatsapp||''}" style="width:70%"/>
    </div>
    <div>
      TikTok: <input id="c_tt" value="${conf.icons.tiktok||''}" style="width:70%"/>
    </div>
    <div>
      Telegram: <input id="c_tg" value="${conf.icons.telegram||''}" style="width:70%"/>
    </div>
    <div>
      Acceso completo: <input id="c_acc" value="${conf.accesoCompleto||''}" style="width:70%"/>
    </div>
    <div style="margin-top:8px"><button id="saveIcons" class="btn primary">Guardar</button></div>
  `;
  adminMain.appendChild(container);
  container.querySelector('#saveIcons').addEventListener('click', async ()=>{
    const newConf = {
      icons:{
        instagram: container.querySelector('#c_ig').value.trim(),
        whatsapp: container.querySelector('#c_wa').value.trim(),
        tiktok: container.querySelector('#c_tt').value.trim(),
        telegram: container.querySelector('#c_tg').value.trim()
      },
      accesoCompleto: container.querySelector('#c_acc').value.trim()
    };
    await db.collection('site').doc('config').set(newConf);
    alert('Guardado. Actualiza la página para ver cambios.');
    loadConfig();
  });
});

adminSecciones && adminSecciones.addEventListener('click', async ()=>{
  adminMain.innerHTML = '<h3>Secciones</h3><div id="sectionsAdmin"></div><div style="margin-top:12px"><button id="addSection" class="btn primary">Agregar nueva sección</button></div>';
  const container = document.getElementById('sectionsAdmin');
  async function loadSections(){
    container.innerHTML = '';
    const snap = await db.collection('sections').orderBy('order').get();
    snap.forEach(doc=>{
      const d = doc.data();
      const el = document.createElement('div'); el.style.padding='8px'; el.style.borderBottom='1px solid rgba(0,0,0,0.04)';
      el.innerHTML = `<strong>${d.name}</strong> <button class="btn edit">Editar</button> <button class="btn del">Eliminar</button>`;
      el.querySelector('.edit').addEventListener('click', ()=> editSection(doc.id,d));
      el.querySelector('.del').addEventListener('click', async ()=> { if(confirm('Eliminar sección?')){ await db.collection('sections').doc(doc.id).delete(); loadSections(); }});
      container.appendChild(el);
    });
  }
  loadSections();
  document.getElementById('addSection').addEventListener('click', async ()=>{
    const name = prompt('Nombre de la sección:');
    if(!name) return;
    const order = prompt('Orden (número):', '100');
    await db.collection('sections').add({name, order: Number(order)});
    loadSections();
  });

  async function editSection(id,data){
    adminMain.innerHTML = `<h4>Sección: ${data.name}</h4><div id="examsAdmin"></div><div style="margin-top:8px"><button id="addExam" class="btn primary">Agregar examen</button><button id="backSections" class="btn">Atras</button></div>`;
    const examsAdmin = document.getElementById('examsAdmin');
    document.getElementById('backSections').addEventListener('click', ()=> adminSecciones.click());
    async function loadExams(){
      examsAdmin.innerHTML = '';
      const snap = await db.collection('sections').doc(id).collection('exams').orderBy('order').get();
      snap.forEach(doc=>{
        const ex = doc.data();
        const el = document.createElement('div'); el.style.padding='8px'; el.style.borderBottom='1px solid rgba(0,0,0,0.04)';
        el.innerHTML = `<strong>${ex.title}</strong> <button class="btn edit">Editar</button> <button class="btn del">Eliminar</button>`;
        el.querySelector('.edit').addEventListener('click', ()=> editExam(id, doc.id, ex));
        el.querySelector('.del').addEventListener('click', async ()=> { if(confirm('Eliminar examen?')){ await db.collection('sections').doc(id).collection('exams').doc(doc.id).delete(); loadExams();}});
        examsAdmin.appendChild(el);
      });
    }
    loadExams();
    document.getElementById('addExam').addEventListener('click', async ()=>{
      const newDoc = await db.collection('sections').doc(id).collection('exams').add({
        title: prompt('Título examen:','Examen semana X'),
        description: '',
        order: 100,
        questions: []
      });
      editExam(id, newDoc.id, {title:'Nuevo examen', questions:[]});
    });
  }

  async function editExam(sectionId, examId, examData){
    adminMain.innerHTML = `<h4>Editar examen: ${examData.title}</h4>
      <div>
        Título: <input id="e_title" value="${examData.title || ''}" style="width:80%"/>
      </div>
      <div>
        Descripción: <input id="e_desc" value="${examData.description||''}" style="width:80%"/>
      </div>
      <div style="margin-top:8px">Preguntas (JSON):<br/>
        <textarea id="e_qs" style="width:100%;height:220px;">${JSON.stringify(examData.questions || [], null, 2)}</textarea>
      </div>
      <div style="margin-top:8px"><button id="saveExam" class="btn primary">Guardar</button> <button id="cancelExam" class="btn">Cancelar</button></div>
    `;
    document.getElementById('cancelExam').addEventListener('click', ()=> adminSecciones.click());
    document.getElementById('saveExam').addEventListener('click', async ()=>{
      try{
        const newTitle = document.getElementById('e_title').value.trim();
        const newDesc = document.getElementById('e_desc').value.trim();
        const newQs = JSON.parse(document.getElementById('e_qs').value);
        if(!Array.isArray(newQs)) throw new Error('Formato de preguntas inválido, debe ser un array de bloques.');
        await db.collection('sections').doc(sectionId).collection('exams').doc(examId).set({
          title: newTitle, description: newDesc, questions: newQs
        }, {merge:true});
        alert('Examen guardado.');
        adminSecciones.click();
      }catch(err){
        alert('Error guardando examen: '+err.message);
      }
    });
  }
});

/* ---------- Init ---------- */
(function init(){
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  loginButtons && loginButtons.classList.remove('hidden');
  sectionsList && sectionsList.classList.add('hidden');

  // auth state listener
  auth.onAuthStateChanged(async user=>{
    if(user){
      state.uid = user.uid;
      try{
        const udoc = await db.collection('users').doc(user.uid).get();
        const udata = udoc.exists ? udoc.data() : null;
        if(udata && udata.isAdmin) state.mode = 'admin';
        else state.mode = 'user';
      }catch(err){ console.error('Error reading user doc', err); }
      onLogin();
    } else {
      state.uid = null;
      state.mode = 'guest';
      loginButtons && loginButtons.classList.remove('hidden');
      sectionsList && sectionsList.classList.add('hidden');
      showScreen(homeScreen);
    }
  });
})();
