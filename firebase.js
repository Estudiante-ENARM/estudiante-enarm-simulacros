// ============================================================
//  FIREBASE.JS — CONFIGURACIÓN OFICIAL
//  Compatible con:
//  - Auth (login + creación de usuarios desde app.js)
//  - Firestore (sections, exams, casosClinicos, preguntas,
//               users, config/icons, attempts)
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============================================================
// TU CONFIGURACIÓN EXACTA (NO MODIFICAR)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQ98U601Kt18",
  authDomain: "estudianteenarm.firebaseapp.com",
  projectId: "estudianteenarm",
  storageBucket: "estudianteenarm.appspot.com",
  messagingSenderId: "681807845034",
  appId: "1:681807845034:web:7b33f86e3c2a81918480db"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Servicios
const auth = getAuth(app);
const db = getFirestore(app);

// Exportar todo lo necesario a app.js
export {
  auth,
  db,

  // Auth
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,

  // Firestore
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
};
