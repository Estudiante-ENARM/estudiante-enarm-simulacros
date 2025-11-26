/***********************************************
 * app.js
 * Login + Landing (index.html)
 ***********************************************/
import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const btnLogin = document.getElementById("btn-login");
const btnLoginCancel = document.getElementById("btn-login-cancel");
const loginError = document.getElementById("login-error");

const landingText = document.getElementById("landing-text");
const btnPriceMonth = document.getElementById("btn-price-month");
const btnPriceFull = document.getElementById("btn-price-full");

const socialIcons = document.querySelectorAll(".social-icon");

/***********************************************
 * CONFIG WHATSAPP / MENSAJES (DEFAULTS)
 ***********************************************/
const DEFAULT_PHONE = "525515656316"; // sin '+', formato para wa.me
let waPhone = DEFAULT_PHONE;

// Mensajes por defecto (se pueden sobreescribir desde Firestore)
let msgPlanMensual = "Me interesa adquirir el plan mensual";
let msgPlanEnarm = "Me interesa adquirir el plan ENARM 2026";

// Texto/label de los botones (se pueden sobreescribir)
let labelPlanMensual = "Plan mensual · $XXX MXN";
let labelPlanEnarm = "Plan ENARM 2026 · $XXX MXN";

/***********************************************
 * UTILIDADES
 ***********************************************/
function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function setLoading(button, isLoading, defaultText) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Cargando...";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || defaultText || "Entrar";
    button.disabled = false;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-DD
}

/***********************************************
 * AUTO-REDIRECCIÓN SI YA ESTÁ LOGUEADO
 ***********************************************/
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.email);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await signOut(auth);
      return;
    }

    const data = snap.data();
    const t = todayISO();

    // Vigencia
    if (data.expiryDate && data.expiryDate < t) {
      await setDoc(userRef, { status: "inactivo" }, { merge: true });
      await signOut(auth);
      return;
    }

    if (data.status && data.status !== "activo") {
      await signOut(auth);
      return;
    }

    redirectByRole(data.role);
  } catch (err) {
    console.error("Error en auto-redirect:", err);
  }
});

/***********************************************
 * LOGIN SUBMIT
 ***********************************************/
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hide(loginError);
    loginError.textContent = "";

    const email = (loginEmail.value || "").trim();
    const password = (loginPassword.value || "").trim();

    if (!email || !password) {
      loginError.textContent = "Ingresa tu correo y contraseña.";
      show(loginError);
      return;
    }

    setLoading(btnLogin, true, "Entrar");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      const userRef = doc(db, "users", user.email);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        loginError.textContent = "Tu usuario no está registrado en la plataforma.";
        show(loginError);
        await signOut(auth);
        return;
      }

      const data = snap.data();
      const t = todayISO();

      if (data.expiryDate && data.expiryDate < t) {
        await setDoc(userRef, { status: "inactivo" }, { merge: true });
        loginError.textContent = "Tu acceso ha vencido. Contacta al administrador.";
        show(loginError);
        await signOut(auth);
        return;
      }

      if (data.status && data.status !== "activo") {
        loginError.textContent = "Tu usuario está inactivo. Contacta al administrador.";
        show(loginError);
        await signOut(auth);
        return;
      }

      redirectByRole(data.role);
    } catch (err) {
      console.error(err);
      loginError.textContent = "No se pudo iniciar sesión. Verifica tus datos.";
      show(loginError);
    } finally {
      setLoading(btnLogin, false, "Entrar");
    }
  });
}

/***********************************************
 * BOTÓN CANCELAR LOGIN
 ***********************************************/
if (btnLoginCancel) {
  btnLoginCancel.addEventListener("click", () => {
    loginForm.reset();
    hide(loginError);
    loginError.textContent = "";
  });
}

/***********************************************
 * REDIRECCIÓN SEGÚN ROL
 ***********************************************/
function redirectByRole(roleRaw) {
  const r = (roleRaw || "").toString().trim().toLowerCase();

  if (r === "admin" || r === "administrador") {
    window.location.href = "admin.html";
    return;
  }

  // aceptamos varios textos para no depender de un solo valor
  if (r === "student" || r === "estudiante" || r === "usuario") {
    window.location.href = "student.html";
    return;
  }

  // Rol no reconocido
  loginError.textContent = "Tu usuario no tiene un rol válido asignado.";
  show(loginError);
}

/***********************************************
 * CARGAR SETTINGS: LANDING (TEXTO + PRECIOS + WHATSAPP)
 * Col: settings/landing
 * Campos sugeridos:
 *  - descriptionText: string
 *  - phoneNumber: string (ej. "5255...")
 *  - monthlyButtonText: string
 *  - fullButtonText: string
 *  - monthlyMessage: string
 *  - fullMessage: string
 ***********************************************/
async function loadLandingSettings() {
  try {
    const landingRef = doc(db, "settings", "landing");
    const snap = await getDoc(landingRef);

    if (snap.exists()) {
      const data = snap.data();

      if (typeof data.descriptionText === "string" && landingText) {
        landingText.textContent = data.descriptionText;
      }

      if (typeof data.phoneNumber === "string" && data.phoneNumber.trim()) {
        waPhone = data.phoneNumber.trim();
      }

      if (typeof data.monthlyButtonText === "string" && data.monthlyButtonText.trim()) {
        labelPlanMensual = data.monthlyButtonText.trim();
      }

      if (typeof data.fullButtonText === "string" && data.fullButtonText.trim()) {
        labelPlanEnarm = data.fullButtonText.trim();
      }

      if (typeof data.monthlyMessage === "string" && data.monthlyMessage.trim()) {
        msgPlanMensual = data.monthlyMessage.trim();
      }

      if (typeof data.fullMessage === "string" && data.fullMessage.trim()) {
        msgPlanEnarm = data.fullMessage.trim();
      }
    }
  } catch (err) {
    console.error("Error leyendo settings/landing:", err);
  }

  // Aplicar textos finales a los botones
  if (btnPriceMonth) {
    btnPriceMonth.textContent = labelPlanMensual;
  }
  if (btnPriceFull) {
    btnPriceFull.textContent = labelPlanEnarm;
  }
}

/***********************************************
 * CLICK EN BOTONES DE PRECIO → WHATSAPP
 ***********************************************/
if (btnPriceMonth) {
  btnPriceMonth.addEventListener("click", () => {
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msgPlanMensual)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });
}

if (btnPriceFull) {
  btnPriceFull.addEventListener("click", () => {
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msgPlanEnarm)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });
}

/***********************************************
 * SOCIAL LINKS (settings/socialLinks)
 * Campos sugeridos:
 *  - whatsapp: string (URL)
 *  - instagram: string
 *  - tiktok: string
 *  - telegram: string
 ***********************************************/
async function loadSocialLinks() {
  let links = {};
  try {
    const ref = doc(db, "settings", "socialLinks");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      links = snap.data();
    }
  } catch (err) {
    console.error("Error leyendo settings/socialLinks:", err);
  }

  socialIcons.forEach((icon) => {
    const network = icon.dataset.network;
    const url = links[network];

    if (url && typeof url === "string") {
      icon.dataset.url = url;
    } else {
      // Fallback especial para WhatsApp si no hay URL configurada
      if (network === "whatsapp") {
        icon.dataset.url = `https://wa.me/${waPhone}`;
      }
    }

    icon.addEventListener("click", () => {
      const u = icon.dataset.url;
      if (!u) {
        alert("Aún no se ha configurado el enlace para esta red social.");
        return;
      }
      window.open(u, "_blank", "noopener,noreferrer");
    });
  });
}

/***********************************************
 * INICIALIZAR LANDING
 ***********************************************/
(async function initLanding() {
  await loadLandingSettings();
  await loadSocialLinks();
})();
