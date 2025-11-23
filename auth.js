// ===============================
// auth.js
// Manejador de Login, Roles, Estados y Expiración
// ===============================

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "./firebase.js";


// ============================================================
// 1. CONSTANTE PRINCIPAL
// ============================================================

export const ADMIN_UID = "2T2NYl0wkwTu1EH14K82b0IgPiy2"; // tu UID de administrador



// ============================================================
// 2. INICIALIZAR AUTH
// ============================================================

export const auth = getAuth();



// ============================================================
// 3. LOGIN DE ADMIN / USUARIO
// ============================================================

export async function login(email, password) {
  try {
    const credentials = await signInWithEmailAndPassword(auth, email, password);
    return credentials.user;
  } catch (err) {
    console.error("Error login:", err);
    throw new Error("Credenciales incorrectas");
  }
}



// ============================================================
// 4. OBSERVADOR DE SESIÓN
// ============================================================

export function observeAuthChanges(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    // cargar datos del usuario desde Firestore
    const uRef = doc(db, "users", user.uid);
    const snap = await getDoc(uRef);

    if (!snap.exists()) {
      console.warn("Usuario sin documento Firestore. Bloqueando.");
      await signOut(auth);
      callback(null);
      return;
    }

    const data = snap.data();

    const estado = data.estado ?? "habilitado";
    const expiracion = data.expiracion ?? null;

    // verificar expiración
    if (expiracion) {
      try {
        const fechaExp = new Date(expiracion);
        const hoy = new Date();

        if (hoy > fechaExp) {
          // caducado → bloquear acceso
          await setDoc(uRef, { estado: "inhabilitado" }, { merge: true });
          await signOut(auth);
          alert("Tu acceso ha expirado.");
          callback(null);
          return;
        }
      } catch (err) {
        console.error("Error analizando expiración:", err);
      }
    }

    // si está inhabilitado → bloquear
    if (estado !== "habilitado") {
      await signOut(auth);
      alert("Tu acceso está inhabilitado.");
      callback(null);
      return;
    }

    // determinar rol
    const isAdmin = user.uid === ADMIN_UID || data.role === "admin";

    const userData = {
      uid: user.uid,
      email: user.email,
      name: data.name ?? "",
      role: isAdmin ? "admin" : "user",
      estado: estado,
      expiracion: expiracion
    };

    callback(userData);
  });
}



// ============================================================
// 5. CREAR USUARIO DESDE PANEL ADMIN
// ============================================================

export async function createPlatformUser({ email, password, name, role, estado, expiracion }) {
  // crear usuario en Auth
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // crear documento en Firestore
  await setDoc(doc(db, "users", uid), {
    email,
    name,
    role,
    estado,
    expiracion,
    createdAt: serverTimestamp()
  });

  return uid;
}



// ============================================================
// 6. LOGOUT
// ============================================================

export async function logout() {
  await signOut(auth);
}



// ===============================
// FIN DE auth.js
// ===============================
