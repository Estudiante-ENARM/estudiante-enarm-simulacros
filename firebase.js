// ============================================================
// Firebase Configuration - Plataforma ENARM
// FULLY COMPATIBLE WITH GITHUB PAGES
// ============================================================

// IMPORTAR TODO DESDE CDN COMO ES MODULE
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ============================================================
// CONFIGURACIÓN REAL DEL PROYECTO
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  
  // CORREGIDO:
  storageBucket: "simulacros-plataforma-enarm.appspot.com",
  
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

// ============================================================
// Inicialización Firebase
// ============================================================

const app = initializeApp(firebaseConfig);

// AUTH
const auth = getAuth(app);

// FIRESTORE
const db = getFirestore(app);

// ============================================================
// Exportación para usar en app.js, admin.js, student.js, etc.
// ============================================================

export { app, auth, db };
