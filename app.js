// ============================================================
// app.js - Lógica del Index (Login, Precios, WhatsApp, Info)
// ============================================================

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ============================================================
// ELEMENTOS DEL DOM
// ============================================================

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");

const infoBox = document.getElementById("infoBox");

const monthlyPlanBtn = document.getElementById("monthlyPlanBtn");
const fullAccessBtn = document.getElementById("fullAccessBtn");

// ============================================================
// CONFIGURACIÓN WHATSAPP
// ============================================================

const WHATSAPP_NUMBER = "+525515656316";

// ============================================================
// CARGAR TEXTO DE PANEL PRINCIPAL
// ============================================================

async function loadMainInfo() {
    try {
        const ref = doc(db, "config", "mainPanelText");
        const snap = await getDoc(ref);

        if (snap.exists()) {
            infoBox.textContent = snap.data().text || "Información no disponible.";
        } else {
            infoBox.textContent = "Información no disponible.";
        }

    } catch (error) {
        console.error("loadMainInfo ERROR:", error);
        infoBox.textContent = "Error al cargar información.";
    }
}

loadMainInfo();

// ============================================================
// CARGAR MENSAJES DE PRECIOS
// ============================================================

let monthlyPlanMessage = "Me interesa adquirir la plataforma en el plan mensual.";
let fullAccessMessage = "Me interesa adquirir el acceso hasta el próximo ENARM 2026.";

async function loadPricing() {
    try {
        const ref = doc(db, "config", "pricing");
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const data = snap.data();

            if (data.monthlyPlanMessage) monthlyPlanMessage = data.monthlyPlanMessage;
            if (data.fullAccessMessage) fullAccessMessage = data.fullAccessMessage;
        }

    } catch (error) {
        console.error("loadPricing ERROR:", error);
    }
}

loadPricing();

// ============================================================
// BOTONES WHATSAPP
// ============================================================

monthlyPlanBtn.addEventListener("click", () => {
    const msg = encodeURIComponent(monthlyPlanMessage);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
});

fullAccessBtn.addEventListener("click", () => {
    const msg = encodeURIComponent(fullAccessMessage);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
});

// ============================================================
// LOGIN
// ============================================================

loginBtn.addEventListener("click", async () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Ingresa tu correo y contraseña.");
        return;
    }

    try {
        // 1. Autenticar
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Leer documento del usuario
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            alert("Tu usuario no está configurado correctamente. Contacta al administrador.");
            return;
        }

        const data = snap.data();

        // 3. Revisar estado
        if (data.status !== "active") {
            alert("Tu cuenta está inactiva.");
            return;
        }

        // 4. Revisar vigencia
        const now = new Date();
        let expiry = null;

        if (data.expirationDate?.toDate) {
            expiry = data.expirationDate.toDate();
        } else {
            alert("Tu acceso ha vencido.");
            return;
        }

        if (expiry < now) {
            alert("Tu acceso ha vencido.");
            return;
        }

        // 5. Redirigir
        if (data.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "student.html";
        }

    } catch (error) {

        // ERRORES POR FALTA DE PERMISOS → SE VEAN CLAROS
        if (error.code === "permission-denied") {
            alert("Error de permisos. Revisa tus reglas de Firestore.");
            console.error("PERMISSION ERROR:", error);
            return;
        }

        console.error("Error al iniciar sesión:", error);
        alert("Correo o contraseña incorrectos.");
    }
});
