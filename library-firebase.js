/*******************************************************
 * library-firebase.js
 * Inicializa un 2º proyecto Firebase (Resúmenes / GPC)
 * SIN afectar el Firebase principal de Simulacros.
 *******************************************************/

import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Config del proyecto de la página de Resúmenes/GPC (pagina-buena)
 * (tomado de tu app.js de esa web).
 */
const LIBRARY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjOqAQUDeKi_bucZ8PzunNQsx1UlomuEw",
  authDomain: "pagina-buena.firebaseapp.com",
  projectId: "pagina-buena",
  storageBucket: "pagina-buena.firebasestorage.app",
  messagingSenderId: "810208199031",
  appId: "1:810208199031:web:707a76b931ee7d2f002172",
};

/**
 * Nombre del segundo app (para no colisionar con el principal).
 */
const LIBRARY_APP_NAME = "libraryApp";

/**
 * Inicializa (o reutiliza) el segundo app.
 * Importante: NO toca el app principal de Simulacros.
 */
const libraryApp = getApps().some(a => a.name === LIBRARY_APP_NAME)
  ? getApp(LIBRARY_APP_NAME)
  : initializeApp(LIBRARY_FIREBASE_CONFIG, LIBRARY_APP_NAME);

/**
 * Auth/DB del proyecto de Resúmenes/GPC
 * - libraryDb: lectura/escritura de Firestore (temas, changes, social_links)
 * - libraryAuth: login admin del proyecto "pagina-buena" (si lo usas después)
 */
const libraryAuth = getAuth(libraryApp);
const libraryDb = getFirestore(libraryApp);

export {
  LIBRARY_FIREBASE_CONFIG,
  LIBRARY_APP_NAME,
  libraryApp,
  libraryAuth,
  libraryDb
};
