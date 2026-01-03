/***********************************************
 * INDEX.JS (FIXED)
 * - Compatible si index.js se carga SIN type="module"
 * - Mantiene: login, lectura settings, botones WhatsApp, redes sociales
 * - Mantiene: evitar auto-redirect cuando el usuario llega con "Atrás" (back/gesture)
 ***********************************************/

// Dependencias (se cargan por dynamic import para evitar SyntaxError por "import { }" en scripts no-módulo)
let auth, db;
let signInWithEmailAndPassword, onAuthStateChanged;
let doc, getDoc;

async function loadDeps() {
  if (auth && db && signInWithEmailAndPassword && onAuthStateChanged && doc && getDoc) return;

  const cfg = await import("./firebase-config.js");
  auth = cfg.auth;
  db = cfg.db;

  const authMod = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
  signInWithEmailAndPassword = authMod.signInWithEmailAndPassword;
  onAuthStateChanged = authMod.onAuthStateChanged;

  const fsMod = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
  doc = fsMod.doc;
  getDoc = fsMod.getDoc;
}

/***********************************************
 * CONST / DEFAULTS
 ***********************************************/
const DEFAULT_WHATSAPP_PHONE = "+525515656316";
const DEFAULT_MONTHLY_LABEL = "Plan mensual";
const DEFAULT_ENARM_LABEL = "Plan ENARM 2026";

const DEFAULT_MONTHLY_MESSAGE = "Me interesa adquirir el plan mensual";
const DEFAULT_ENARM_MESSAGE = "Me interesa adquirir el plan ENARM 2026";

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const cancelBtn = document.getElementById("login-btn-cancel");
const errorBox = document.getElementById("login-error");

const landingTextEl = document.getElementById("landing-text");
const btnPriceMonth = document.getElementById("btn-price-month");
const btnPriceFull = document.getElementById("btn-price-full");

const socialIcons = document.querySelectorAll(".social-icon");

/***********************************************
 * ESTADO
 ***********************************************/
let currentWhatsAppPhone = DEFAULT_WHATSAPP_PHONE;

/***********************************************
 * UTILIDADES
 ***********************************************/
function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

function buildWhatsAppUrl(phone, message) {
  const clean = normalizePhone(phone || DEFAULT_WHATSAPP_PHONE);
  const base = `https://wa.me/${clean}`;
  const text = encodeURIComponent(message || "");
  return `${base}?text=${text}`;
}

/***********************************************
 * NAVIGATION: Evitar loops al usar "Atrás"
 * - Si el usuario llega a index.html por back/gesture, NO redirigir automáticamente.
 ***********************************************/
function isBackForwardNavigation() {
  try {
    const navEntries = performance.getEntriesByType("navigation");
    if (navEntries && navEntries.length) {
      return navEntries[0].type === "back_forward";
    }
    // Fallback legacy
    return performance?.navigation?.type === 2;
  } catch {
    return false;
  }
}

/***********************************************
 * CARGAR LANDING (settings/landingPage)
 ***********************************************/
async function loadLandingSettings() {
  if (!landingTextEl || !btnPriceMonth || !btnPriceFull) return;

  let landingText = "Plataforma Estudiante ENARM: simulacros tipo ENARM, análisis de tu desempeño y más.";
  let monthlyLabel = DEFAULT_MONTHLY_LABEL;
  let enarmLabel = DEFAULT_ENARM_LABEL;
  let monthlyPrice = "";
  let enarmPrice = "";

  try {
    const snap = await getDoc(doc(db, "settings", "landingPage"));
    if (snap.exists()) {
      const data = snap.data();

      if (data.landingText) landingText = data.landingText;
      if (data.monthlyLabel) monthlyLabel = data.monthlyLabel;
      if (data.enarmLabel) enarmLabel = data.enarmLabel;

      if (typeof data.monthlyPrice === "number") {
        monthlyPrice = data.monthlyPrice;
      } else if (typeof data.monthlyPrice === "string") {
        monthlyPrice = data.monthlyPrice;
      }

      if (typeof data.enarmPrice === "number") {
        enarmPrice = data.enarmPrice;
      } else if (typeof data.enarmPrice === "string") {
        enarmPrice = data.enarmPrice;
      }

      if (data.whatsappPhone) {
        currentWhatsAppPhone = data.whatsappPhone;
      }
    }
  } catch (err) {
    console.error("Error leyendo settings/landingPage:", err);
  }

  landingTextEl.textContent = landingText;

  btnPriceMonth.textContent = monthlyPrice
    ? `${monthlyLabel} · $${monthlyPrice} MXN`
    : monthlyLabel;

  btnPriceFull.textContent = enarmPrice
    ? `${enarmLabel} · $${enarmPrice} MXN`
    : enarmLabel;
}

/***********************************************
 * CARGAR LINKS DE REDES (settings/socialLinks)
 ***********************************************/
async function loadSocialLinks() {
  try {
    const snap = await getDoc(doc(db, "settings", "socialLinks"));
    if (!snap.exists()) return;

    const data = snap.data();

    socialIcons.forEach((icon) => {
      const net = icon.dataset.network;
      if (net && data[net]) {
        icon.dataset.url = data[net];
      } else {
        delete icon.dataset.url;
      }
    });
  } catch (err) {
    console.error("Error leyendo settings/socialLinks:", err);
  }

  socialIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const url = icon.dataset.url;
      if (!url) {
        alert("El enlace de esta red social aún no se ha configurado.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

/***********************************************
 * LOGIN
 ***********************************************/
async function handleLogin() {
  clearError();

  const email = (emailInput?.value || "").trim();
  const password = passwordInput?.value || "";

  if (!email || !password) {
    showError("Ingresa tu correo y contraseña.");
    return;
  }

  // Si el usuario está usando "Atrás" en este momento, evita que el login lo redirija instantáneamente
  const skipAutoRedirect = isBackForwardNavigation();

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const userDocRef = doc(db, "users", user.email);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      showError("Tu usuario no está configurado en la plataforma. Contacta al administrador.");
      return;
    }

    const profile = userSnap.data();
    const today = new Date().toISOString().slice(0, 10);

    if (profile.expiryDate && profile.expiryDate < today) {
      showError("Tu acceso ha vencido. Contacta al administrador.");
      return;
    }

    if (profile.status && profile.status !== "activo") {
      showError("Tu usuario está inactivo. Contacta al administrador.");
      return;
    }

    const role = profile.role;

    if (role === "admin") {
      if (!skipAutoRedirect) window.location.href = "admin.html";
    } else {
      if (!skipAutoRedirect) window.location.href = "student.html";
    }
  } catch (err) {
    console.error("Error en login:", err);
    let msg = "No se pudo iniciar sesión. Verifica tus datos.";
    if (err.code === "auth/user-not-found") msg = "Usuario no encontrado.";
    if (err.code === "auth/wrong-password") msg = "Contraseña incorrecta.";
    if (err.code === "auth/operation-not-allowed") msg = "Proveedor Email/Password no habilitado en este proyecto.";
    showError(msg);
  }
}

/***********************************************
 * AUTO-REDIRECCIÓN SI YA ESTÁ LOGUEADO
 ***********************************************/
function setupAutoRedirect() {
  onAuthStateChanged(auth, async (user) => {
    const skipAutoRedirect = isBackForwardNavigation();
    if (!user) return;

    try {
      const snap = await getDoc(doc(db, "users", user.email));
      if (!snap.exists()) return;

      const profile = snap.data();
      const today = new Date().toISOString().slice(0, 10);

      if (profile.expiryDate && profile.expiryDate < today) return;
      if (profile.status && profile.status !== "activo") return;

      const role = profile.role;
      if (role === "admin") {
        if (!skipAutoRedirect) window.location.href = "admin.html";
      } else {
        if (!skipAutoRedirect) window.location.href = "student.html";
      }
    } catch (err) {
      console.error("Error en auto-redirect:", err);
    }
  });
}

/***********************************************
 * EVENTOS DE BOTONES
 ***********************************************/
function setupEvents() {
  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (emailInput) emailInput.value = "";
      if (passwordInput) passwordInput.value = "";
      clearError();
    });
  }

  if (btnPriceMonth) {
    btnPriceMonth.addEventListener("click", () => {
      const url = buildWhatsAppUrl(currentWhatsAppPhone, DEFAULT_MONTHLY_MESSAGE);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  if (btnPriceFull) {
    btnPriceFull.addEventListener("click", () => {
      const url = buildWhatsAppUrl(currentWhatsAppPhone, DEFAULT_ENARM_MESSAGE);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }
}

/***********************************************
 * INIT
 ***********************************************/
(async function init() {
  try {
    await loadDeps();
    setupEvents();
    setupAutoRedirect();
    await loadLandingSettings();
    await loadSocialLinks();
  } catch (err) {
    console.error("Error inicializando index.js:", err);
  }
})();
