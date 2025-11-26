// ============================================================
// Firebase Configuration - Plataforma ENARM
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ============================================================
// YOUR FIREBASE CONFIGURATION
// Reemplaza estos valores con los de tu proyecto.
// ============================================================

const firebaseConfig = {
apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

// ============================================================
// Initialize Firebase
// ============================================================

const app = initializeApp(firebaseConfig);

// ============================================================
// Initialize Auth & Firestore
// ============================================================

const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// EXPORTS (para usar en los demás módulos)
// ============================================================

export { app, auth, db };
