// Firebase config (from user)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// auth.js: handles login, register, session state, role check
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const AppUI = {
  init() {
    this.bind();
    this.initUIFromAuth();
    this.initCountdown();
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
  },
  async login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      this.postAuthInit(cred.user);
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
      this.postAuthInit(cred.user);
    } catch(err) {
      alert('Error de registro: ' + err.message);
    }
  },
  async postAuthInit(user) {
    // fetch user doc to check role
    const udoc = await getDoc(doc(db,'users', user.uid));
    const role = udoc.exists() ? udoc.data().role : 'user';
    if(role === 'admin') {
      document.getElementById('admin-btn').classList.remove('hidden');
    }
    // render sections for user mode by default
    this.renderSectionsUI();
    // hide login panel
    document.getElementById('login-panel').classList.add('hidden');
    document.getElementById('exam-list').classList.remove('hidden');
    // TODO: fetch exams list
  },
  initUIFromAuth() {
    onAuthStateChanged(auth, async (user) => {
      if(user) {
        this.postAuthInit(user);
      } else {
        // not logged in
        document.getElementById('login-panel').classList.remove('hidden');
      }
    });
  },
  selectMode(mode) {
    // store desired mode for next login behavior
    this.selectedMode = mode;
    document.getElementById('login-panel').scrollIntoView({behavior:'smooth'});
  },
  renderSectionsUI() {
    // fetch sections from Firestore (placeholder)
    const container = document.getElementById('sections-container');
    container.innerHTML = '';
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
    // show exams for that section
    document.getElementById('exam-list').classList.remove('hidden');
    document.getElementById('exam-viewer').classList.add('hidden');
    // populate with demo items (replace with Firestore query)
    const list = document.getElementById('exam-list');
    list.innerHTML = '';
    for(let i=1;i<=4;i++){
      const card = document.createElement('div');
      card.className = 'exam-card';
      card.innerHTML = `<div><strong>${section.title} - Semana ${i}</strong><div class="meta">Duración: 60 min</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="attempt-badge" id="attempt_${i}">0 de 3</div>
          <button class="link-btn" onclick="AppUI.openExam('${section.id}', 'exam_${i}')">Abrir</button>
        </div>`;
      list.appendChild(card);
    }
    // remember current section
    this.currentSection = section;
  },
  async openExam(sectionId, examId) {
    // load exam – placeholder; replace with Firestore fetch
    document.getElementById('exam-list').classList.add('hidden');
    document.getElementById('exam-viewer').classList.remove('hidden');
    document.getElementById('exam-title').textContent = `Examen: ${examId}`;
    document.getElementById('attempts-counter').textContent = '0 de 3';
    // load questions (dummy)
    const qcont = document.getElementById('questions-container');
    qcont.innerHTML = '';
    for(let q=1;q<=5;q++){
      const qbox = document.createElement('div');
      qbox.className = 'topic';
      qbox.innerHTML = `<div><strong>Pregunta ${q}:</strong> ¿Cuál es la respuesta correcta?</div>
        <div style="margin-top:8px;">
          <label><input type="radio" name="q${q}" value="a"> Opción A</label><br>
          <label><input type="radio" name="q${q}" value="b"> Opción B</label><br>
          <label><input type="radio" name="q${q}" value="c"> Opción C</label><br>
          <label><input type="radio" name="q${q}" value="d"> Opción D</label>
        </div>`;
      qcont.appendChild(qbox);
    }
  },
  goBackToSection() {
    document.getElementById('exam-viewer').classList.add('hidden');
    document.getElementById('exam-list').classList.remove('hidden');
  },
  initCountdown() {
    const el = document.getElementById('countdown');
    const target = new Date(window.__APP_CONFIG.countdownDate);
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
  acceptCookies() {
    localStorage.setItem('cookies_accepted','1');
    document.getElementById('cookie-banner').classList.add('hidden');
    // load GA + Pixel from file content (we provide a method to inline)
    // We'll fetch content from server if available or ask you to paste. For now, attempt to load /mnt/data/Google Analytics y pixel meta.txt via fetch.
    fetch('/mnt/data/Google Analytics y pixel meta.txt').then(r=>r.text()).then(code=>{
      const s = document.createElement('div');
      s.innerHTML = code;
      document.head.appendChild(s);
    }).catch(()=>console.warn('No se pudo cargar analytics desde ruta local.'));
  },
  declineCookies() {
    localStorage.setItem('cookies_accepted','0');
    document.getElementById('cookie-banner').classList.add('hidden');
  }
};

window.AppUI = AppUI;

// exams.js: logic for start/finish exam, scoring, attempts bookkeeping
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, setDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const Exams = {
  // placeholder functions — integrate Firestore queries here
  async recordAttempt(userId, examId, score, answers) {
    await addDoc(collection(db,'attempts'), {
      userId, examId, score, answers, startedAt: new Date(), finishedAt: new Date()
    });
    // increment user attempts count
    const uref = doc(db,'users',userId);
    const udoc = await getDoc(uref);
    const data = udoc.exists() ? udoc.data() : {};
    const attempts = data.attempts || {};
    attempts[examId] = (attempts[examId] || 0) + 1;
    await updateDoc(uref, { attempts });
  }
};

window.Exams = Exams;
export default Exams;
// admin.js: UI for admin to create exams, edit questions, edit links
import { db } from './firebase-config.js';
import { collection, addDoc, setDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const Admin = {
  openAdminModal() {
    document.getElementById('admin-modal').classList.remove('hidden');
    document.getElementById('admin-content').innerHTML = `
      <h3>Panel Admin</h3>
      <div style="display:flex; gap:8px;">
        <button id="create-exam-btn" class="link-btn">Crear examen</button>
        <button id="edit-links-btn" class="edit-btn">Editar enlaces</button>
      </div>
      <div id="admin-area" style="margin-top:12px;"></div>
    `;
    document.getElementById('create-exam-btn').addEventListener('click', ()=> this.showCreateExam());
    document.getElementById('edit-links-btn').addEventListener('click', ()=> this.showEditLinks());
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
        </select>
        <button id="save-new-exam" class="link-btn">Guardar examen</button>
      </div>
    `;
    document.getElementById('save-new-exam').addEventListener('click', async ()=>{
      const title = document.getElementById('new-exam-title').value;
      const section = document.getElementById('new-exam-section').value;
      // create doc in Firestore
      await addDoc(collection(db,'exams'), { title, sectionId: section, createdAt: new Date(), published: false, attemptsAllowed: 3 });
      alert('Examen creado (publicado = false por defecto).');
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
      // save to settings/global doc
      await setDoc(doc(db,'settings','global'), { fullAccessUrl: full, socialLinks: { ig, wa, tt, tg } }, { merge:true });
      alert('Enlaces guardados.');
    });
  }
};

document.getElementById('admin-btn').addEventListener('click', ()=> Admin.openAdminModal());
document.getElementById('close-admin-modal').addEventListener('click', ()=> Admin.closeAdminModal());

window.Admin = Admin;
export default Admin;

