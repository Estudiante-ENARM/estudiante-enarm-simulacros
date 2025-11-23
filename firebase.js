// firebase.js — versión limpia y funcional

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- CONFIGURACIÓN OBLIGATORIA (TU PROYECTO) ----------
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

// ---------- INICIALIZACIÓN CORRECTA ----------
const app = initializeApp(firebaseConfig);

// Exportación correcta para módulos ES6
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
