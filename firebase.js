/*************************************************************
 * firebase.js — Configuración Firebase
 * Versión estable 2025-11-23
 *************************************************************/

// ==========================
// IMPORTS (modular v9)
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ==========================
// CONFIGURACIÓN DE TU PROYECTO
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQsx1UlomuEw",
  authDomain: "pagina-buena.firebaseapp.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.firebasestorage.app",
  messagingSenderId: "810208199031",
  appId: "1:810208199031:web:707a76b931ee7d2f002172"
};


// ==========================
// INICIALIZAR APP
// ==========================
const app = initializeApp(firebaseConfig);

// ==========================
// EXPORTAR INSTANCIAS
// ==========================
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
