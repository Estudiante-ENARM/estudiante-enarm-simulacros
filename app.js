/* app.js (module)
   - Inicializa Firebase
   - Maneja Auth, UI, Admin, Exams
   - Inyecta Analytics/Meta Pixel tras aceptar cookies
*/

/* ------------------ ANALYTICS SNIPPET (desde tu archivo) ------------------ */
/* Este bloque se inyectará solamente si el usuario ACEPTA cookies. */
const ANALYTICS_SNIPPET = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-B43LFZV7MR"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-B43LFZV7MR');
</script>

<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1146031771035535');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=1146031771035535&ev=PageView&noscript=1"
/></noscript>
`;

/* ------------------ FIREBASE (modular) ------------------ */
/* Uses your provided firebase config */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

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
const storage = getStorage(app);

/* ------------------ App UI & Logic ------------------ */
const AppUI = {
  selectedMode: 'user', // default
  currentSection: null,
  init() {
    this.bind();
    this.initAuthListener();
    this.initCountdown();
    this.checkCookieBanner();
    this.setupMobileBehavior();
  },
  bind() {
    document.getElementById('btn-login').addEventListener('click', ()=> this.login());
    document.getElementById('btn-register').addEventListener('click', ()=> this.register());
    document.getElementById('btn-user-mode').addEventListener('click', ()=> this.selectMode('user'));
    document.getElementById('btn-admin-mode').addEventListener('click', ()=> this.selectMode('admin'));
    document.getElementById('mobile-menu-btn').addEventListener('click', ()=> document.getElementById('sidebar').classList.toggle('open-mobile'));
    document.getElementById('btn-return').addEventListener('click', ()=> this.goBackToSection());
    document.getElementById('cookie-accept').addEventListener('click', ()=> this.acceptCookies());
    document.getElementById('cookie-decline').addEventListener('click', ()=> this.declineCookies());
    document.getElementById('admin-btn').addEventListener('click', ()=> Admin.openAdminModal());
    document.getElementById('close-admin-modal').addEventListener('click', ()=> Admin.closeAdminModal());
    document.getElementById('access-full-btn').addEventListener('click', ()=> this.handleAccessFull());
  },

  /* ------------------ AUTH ------------------ */
  async login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await this.postAuthInit(cred.user);
    } catch(err) {
      alert('Error de login: ' + err.message);
    }
  },

  async register() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      // create user doc
      await setDoc(doc(db,'users', cred.user.uid), { email: email, role: 'user', createdAt: new Date()});
      await this.postAuthInit(cred.user);
    } catch(err) {
      alert('Error de registro: ' + err.message);
    }
  },

  async postAuthInit(user) {
    const udoc = await getDoc(doc(db,'users', user.uid));
    const role = udoc.exists() ? udoc.data().role : 'user';
    if(role === 'admin') {
      document.getElementById('admin-btn').classList.remove('hidden');
    } else {
      document.getElementById('admin-btn').classList.add('hidden');
    }
    this.renderSectionsUI();
    document.getElementById('login-panel').classList.add('hidden');
    document.getElementById('exam-list').classList.remove('hidden');
  },

  initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      if(user) {
        await this.postAuthInit(user);
      } else {
        document.getElementById('login-panel').classList.remove('hidden');
        document.getElementById('exam-list').classList.add('hidden');
        document.getElementById('admin-btn').classList.add('hidden');
      }
    });
  },

  selectMode(mode) {
    this.selectedMode = mode;
    // Visual feedback
    document.querySelectorAll('#main-nav .menu-item').forEach(el=> el.classList.remove('active'));
    if(mode === 'user') document.getElementById('btn-user-mode').classList.add('active');
    else document.getElementById('btn-admin-mode').classList.add('active');
    document.getElementById('login-panel').scrollIntoView({behavior:'smooth'});
  },

  renderSectionsUI() {
    const container = document.getElementById('sections-container');
    container.innerHTML = '';
    // Ideally fetch sections from Firestore; for now, use default sections:
    const sections = [
      {id:'s1', title:'Examen Semanal'},
      {id:'s2', title:'MIEN examen'},
      {id:'s3', title:'Especialidad'},
      {id:'s4', title:'Examen Mega'}
    ];
    sections.forEach(s=>{
      const btn = document.createElement('button');
      btn.className = 'menu-item';
      btn.textContent = s.title;
      btn.addEventListener('click', ()=> this.openSection(s));
      container.appendChild(btn);
    });
    container.classList.remove('hidden');
  },

  openSection(section) {
    document.getElementById('exam-list').classList.remove('hidden');
    document.getElementById('exam-viewer').classList.add('hidden');
    const list = document.getElementById('exam-list');
    list.innerHTML = '';
    // In production: query exams by sectionId from Firestore
    for(let i=1;i<=4;i++){
      const card = document.createElement('div');
      card.className = 'exam-card';
      card.innerHTML = `<div><strong>${section.title} - Semana ${i}</strong><div class="meta">Duración: 60 min</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="attempt-badge" id="attempt_${section.id}_${i}">0 de 3</div>
          <button class="link-btn" data-section="${section.id}" data-exam="exam_${i}">Abrir</button>
        </div>`;
      const openBtn = card.querySelector('button.link-btn');
      openBtn.addEventListener('click', ()=> this.openExam(section.id, `exam_${i}`));
      list.appendChild(card);
    }
    this.currentSection = section;
  },

  async openExam(sectionId, examId) {
    // show exam viewer and render sample questions (replace with Firestore fetch)
    document.getElementById('exam-list').classList.add('hidden');
    document.getElementById('exam-viewer').classList.remove('hidden');
    document.getElementById('exam-title').textContent = `Examen: ${examId}`;
    document.getElementById('attempts-counter').textContent = '0 de 3';
    const qcont = document.getElementById('questions-container');
    qcont.innerHTML = '';
    // placeholder questions
    for(let q=1;q<=10;q++){
      const qbox = document.createElement('div');
      qbox.className = 'topic';
      qbox.innerHTML = `<div><strong>Pregunta ${q}:</strong> Enunciado de ejemplo</div>
        <div style="margin-top:8px;">
          <label><input type="radio" name="q${q}" value="a"> Opción A</label><br>
          <label><input type="radio" name="q${q}" value="b"> Opción B</label><br>
          <label><input type="radio" name="q${q}" value="c"> Opción C</label><br>
          <label><input type="radio" name="q${q}" value="d"> Opción D</label>
        </div>`;
      qcont.appendChild(qbox);
    }

    // bind finish
    document.getElementById('btn-finish').onclick = ()=> this.finishExam(sectionId, examId);
  },

  goBackToSection() {
    document.getElementById('exam-viewer').classList.add('hidden');
    document.getElementById('exam-list').classList.remove('hidden');
  },

  async finishExam(sectionId, examId) {
    // compute score (placeholder)
    // In production: compare answers with correctOptionId from questions collection
    const total = 10;
    const score = Math.floor(Math.random()* (total+1));
    alert(`Examen terminado. Tu puntuación: ${score}/${total}`);
    // record attempt using Exams.recordAttempt (placeholder)
    if(auth.currentUser) {
      try {
        await Exams.recordAttempt(auth.currentUser.uid, examId, score, []);
        alert('Intento registrado.');
      } catch(e) {
        console.warn('No se pudo registrar intento: ', e);
      }
    }
    this.goBackToSection();
  },

  handleAccessFull() {
    // open link configured in Firestore settings or prompt if not set
    (async () => {
      try {
        const docRef = doc(db,'settings','global');
        const snap = await getDoc(docRef);
        const url = snap.exists() && snap.data().fullAccessUrl ? snap.data().fullAccessUrl : '#';
        if(url === '#') {
          alert('El enlace "Acceso Completo" no está configurado. Accede en modo admin para configurarlo.');
        } else {
          window.open(url,'_blank');
        }
      } catch(e) {
        console.warn(e);
        alert('Error al abrir enlace.');
      }
    })();
  },

  /* ------------------ COUNTDOWN ------------------ */
  initCountdown() {
    const el = document.getElementById('countdown');
    const defaultDate = new Date('2026-09-23T09:00:00-06:00');
    const maybe = window.__APP_CONFIG && window.__APP_CONFIG.countdownDate ? new Date(window.__APP_CONFIG.countdownDate) : defaultDate;
    const target = maybe;
    const tick = () => {
      const now = new Date();
      const diff = target - now;
      if(diff <= 0) {
        el.textContent = 'Examen ARP 2026 — ¡Hoy!';
        return;
      }
      const days = Math.floor(diff / (1000*60*60*24));
      const hours = Math.floor((diff / (1000*60*60)) % 24);
      const mins = Math.floor((diff / (1000*60)) % 60);
      el.textContent = `${days}d ${hours}h ${mins}m hasta 23 Sep 2026`;
    };
    tick();
    setInterval(tick, 60*1000);
  },

  /* ------------------ COOKIES / ANALYTICS ------------------ */
  checkCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    const accepted = localStorage.getItem('cookies_accepted');
    if(accepted === '1') {
      banner.classList.add('hidden');
      this.injectAnalytics();
    } else if(accepted === '0') {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  },

  acceptCookies() {
    localStorage.setItem('cookies_accepted','1');
    document.getElementById('cookie-banner').classList.add('hidden');
    this.injectAnalytics();
  },

  declineCookies() {
    localStorage.setItem('cookies_accepted','0');
    document.getElementById('cookie-banner').classList.add('hidden');
  },

  injectAnalytics() {
    // Inject the saved snippet into head (GTAG + FB Pixel).
    const wrapper = document.createElement('div');
    wrapper.innerHTML = ANALYTICS_SNIPPET;
    // move children script nodes to head safely
    Array.from(wrapper.children).forEach(node => {
      if(node.tagName && node.tagName.toLowerCase() === 'script') {
        const s = document.createElement('script');
        if(node.src) s.src = node.src;
        if(node.async) s.async = true;
        if(node.textContent) s.textContent = node.textContent;
        document.head.appendChild(s);
      } else {
        document.head.appendChild(node);
      }
    });
    // for noscript image fallback, append to body
    const noscript = wrapper.querySelector('noscript');
    if(noscript) document.body.appendChild(noscript);
  },

  /* ------------------ MOBILE UX ------------------ */
  setupMobileBehavior() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    menuBtn.addEventListener('click', ()=> {
      sidebar.classList.toggle('open-mobile');
      overlay.classList.toggle('hidden');
    });
    overlay.addEventListener('click', ()=> {
      sidebar.classList.remove('open-mobile');
      overlay.classList.add('hidden');
    });
  }

}; // AppUI end

/* ------------------ Exams module ------------------ */
const Exams = {
  async recordAttempt(userId, examId, score, answers) {
    try {
      await addDoc(collection(db,'attempts'), {
        userId, examId, score, answers, startedAt: new Date(), finishedAt: new Date()
      });
      const uref = doc(db,'users',userId);
      const udoc = await getDoc(uref);
      const data = udoc.exists() ? udoc.data() : {};
      const attempts = data.attempts || {};
      attempts[examId] = (attempts[examId] || 0) + 1;
      await updateDoc(uref, { attempts });
      return true;
    } catch(e) {
      console.error('recordAttempt error', e);
      throw e;
    }
  }
};

/* ------------------ Admin module ------------------ */
const Admin = {
  async openAdminModal() {
    document.getElementById('admin-modal').classList.remove('hidden');
    document.getElementById('admin-content').innerHTML = `
      <h3>Panel Admin</h3>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <button id="create-exam-btn" class="link-btn">Crear examen</button>
        <button id="edit-links-btn" class="edit-btn">Editar enlaces</button>
        <button id="seed-demo-btn" class="edit-btn">Cargar demo</button>
      </div>
      <div id="admin-area"></div>
    `;
    document.getElementById('create-exam-btn').addEventListener('click', ()=> this.showCreateExam());
    document.getElementById('edit-links-btn').addEventListener('click', ()=> this.showEditLinks());
    document.getElementById('seed-demo-btn').addEventListener('click', ()=> this.seedDemo());
  },

  closeAdminModal() {
    document.getElementById('admin-modal').classList.add('hidden');
  },

  showCreateExam() {
    const area = document.getElementById('admin-area');
    area.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <input id="new-exam-title" placeholder="Título del examen" />
        <select id="new-exam-section">
          <option value="s1">Examen Semanal</option>
          <option value="s2">MIEN examen</option>
          <option value="s3">Especialidad</option>
          <option value="s4">Examen Mega</option>
        </select>
        <button id="save-new-exam" class="link-btn">Guardar examen</button>
      </div>
    `;
    document.getElementById('save-new-exam').addEventListener('click', async ()=>{
      const title = document.getElementById('new-exam-title').value;
      const section = document.getElementById('new-exam-section').value;
      try {
        await addDoc(collection(db,'exams'), { title, sectionId: section, createdAt: new Date(), published: false, attemptsAllowed: 3 });
        alert('Examen creado (published=false por defecto).');
      } catch(e) {
        console.warn(e);
        alert('Error al crear examen.');
      }
    });
  },

  showEditLinks() {
    const area = document.getElementById('admin-area');
    area.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <label>Acceso Completo (WhatsApp)</label>
        <input id="setting-full-access" placeholder="https://wa.me/..." />
        <label>Instagram</label><input id="link-ig" placeholder="https://instagram.com/..." />
        <label>WhatsApp</label><input id="link-wa" placeholder="https://wa.me/..." />
        <label>TikTok</label><input id="link-tt" placeholder="https://tiktok.com/@..." />
        <label>Telegram</label><input id="link-tg" placeholder="https://t.me/..." />
        <button id="save-links" class="link-btn">Guardar</button>
      </div>
    `;
    document.getElementById('save-links').addEventListener('click', async ()=>{
      const full = document.getElementById('setting-full-access').value;
      const ig = document.getElementById('link-ig').value;
      const wa = document.getElementById('link-wa').value;
      const tt = document.getElementById('link-tt').value;
      const tg = document.getElementById('link-tg').value;
      try {
        await setDoc(doc(db,'settings','global'), { fullAccessUrl: full, socialLinks: { ig, wa, tt, tg } }, { merge:true });
        alert('Enlaces guardados.');
      } catch(e) {
        console.warn(e);
        alert('No se pudieron guardar los enlaces.');
      }
    });
  },

  async seedDemo() {
    if(!confirm('Cargar demo en Firestore? Esto añadirá documentos de ejemplo.')) return;
    try {
      // create sections
      await setDoc(doc(db,'sections','s1'), { title:'Examen Semanal', order:1 });
      await setDoc(doc(db,'sections','s2'), { title:'MIEN examen', order:2 });
      await setDoc(doc(db,'sections','s3'), { title:'Especialidad', order:3 });
      await setDoc(doc(db,'sections','s4'), { title:'Examen Mega', order:4 });
      // create a sample exam
      const examRef = await addDoc(collection(db,'exams'), { title:'Semana 1 - Demo', sectionId:'s1', durationMinutes:60, attemptsAllowed:3, published:true, createdAt:new Date() });
      alert('Demo creada. Revisa Firestore.');
    } catch(e) {
      console.warn(e);
      alert('Error creando demo.');
    }
  }
};

/* ------------------ Start the app ------------------ */
document.addEventListener('DOMContentLoaded', () => {
  AppUI.init();
});
