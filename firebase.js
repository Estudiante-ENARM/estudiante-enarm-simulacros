/*******************************************************
 * firebase.js — Configuración Firebase v10
 * Plataforma ENARM — 2025-11-23
 *******************************************************/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/*******************************************************
 *  CONFIGURACIÓN REAL
 *******************************************************/
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

/*******************************************************
 *  INICIALIZAR FIREBASE
 *******************************************************/
const app = initializeApp(firebaseConfig);

/*******************************************************
 *  EXPORTAR AUTH & FIRESTORE
 *******************************************************/
export const auth = getAuth(app);
export const db   = getFirestore(app);

console.log("Firebase inicializado correctamente");
