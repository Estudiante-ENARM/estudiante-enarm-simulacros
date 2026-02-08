/***********************************************
 * library-firebase.js
 * Segundo proyecto Firebase: "pagina-buena" (Resúmenes/GPC)
 * - Exporta libraryDb para leer la colección "temas"
 * - Ajuste para compatibilidad móvil: long-polling si aplica
 ***********************************************/
import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getFirestore,
  initializeFirestore,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Config del proyecto de Resúmenes (pagina-buena)
const libraryFirebaseConfig = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQsx1UlomuEw",
  authDomain: "pagina-buena.firebaseapp.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.firebasestorage.app",
  messagingSenderId: "810208199031",
  appId: "1:810208199031:web:707a76b931ee7d2f002172",
};

const LIBRARY_APP_NAME = "libraryApp";

// Evita re-inicializar si el módulo se carga más de una vez
const existing = getApps().find((a) => a.name === LIBRARY_APP_NAME);
const libraryApp = existing || initializeApp(libraryFirebaseConfig, LIBRARY_APP_NAME);

// Firestore del proyecto de Resúmenes
let libraryDb;
try {
  libraryDb = initializeFirestore(libraryApp, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} catch (e) {
  console.warn("[library-firebase] initializeFirestore fallback -> getFirestore()", e);
  libraryDb = getFirestore(libraryApp);
}

export { libraryDb, libraryApp };
