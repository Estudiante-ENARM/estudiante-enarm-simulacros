/***********************************************
 * firebase-config.js
 * Configuración central de Firebase (Spark)
 * - Ajuste para compatibilidad móvil (iOS / redes restrictivas):
 *   fuerza long-polling y desactiva fetch streams cuando es posible.
 ***********************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/***********************************************
 * CONFIGURACIÓN DEL PROYECTO
 ***********************************************/
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

/***********************************************
 * INIT
 ***********************************************/
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firestore: fuerza long-polling (reduce errores tipo ERR_QUIC_PROTOCOL_ERROR / WebChannel 400 en móvil)
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} catch (e) {
  console.warn("[firebase-config] initializeFirestore fallback -> getFirestore()", e);
  db = getFirestore(app);
}

export { app, auth, db };
