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
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_AUTH_DOMAIN.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    messagingSenderId: "XXXXXXXXXXXX",
    appId: "1:XXXXXXXXXXXX:web:XXXXXXXXXXXXXX"
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
