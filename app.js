// ============================================================
// app.js - Lógica del Index (Login, Precios, WhatsApp, Info)
// ============================================================

import { auth, db } from "./firebase.js";
import {
    signInWithEmailAndPassword,
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

const WHATSAPP_NUMBER = "+525515656316";  // CONFIRMADO POR EL USUARIO


// ============================================================
// CARGAR TEXTO DE PANEL PRINCIPAL (config/mainPanelText)
// ============================================================

async function loadMainInfo() {
    try {
        const docRef = doc(db, "config", "mainPanelText");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            infoBox.textContent = docSnap.data().text || "Información no disponible.";
        } else {
            infoBox.textContent = "Información no disponible.";
        }

    } catch (error) {
        infoBox.textContent = "Error al cargar información.";
        console.error("Error en loadMainInfo:", error);
    }
}

loadMainInfo();


// ============================================================
// CARGAR PRECIOS Y MENSAJES (config/pricing)
// ============================================================

let monthlyPlanMessage = "Me interesa adquirir la plataforma en el plan mensual.";
let fullAccessMessage = "Me interesa adquirir el acceso hasta el próximo ENARM 2026.";

async function loadPricing() {
    try {
        const docRef = doc(db, "config", "pricing");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Cambiar mensajes si existen en Firestore
            if (data.monthlyPlanMessage) monthlyPlanMessage = data.monthlyPlanMessage;
            if (data.fullAccessMessage) fullAccessMessage = data.fullAccessMessage;

        } else {
            console.warn("No existe config/pricing en Firestore.");
        }
    } catch (error) {
        console.error("Error al cargar precios:", error);
    }
}

loadPricing();


// ============================================================
// BOTONES DE PRECIOS (redirigir a WhatsApp)
// ============================================================

monthlyPlanBtn.addEventListener("click", () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(monthlyPlanMessage)}`;
    window.open(url, "_blank");
});

fullAccessBtn.addEventListener("click", () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(fullAccessMessage)}`;
    window.open(url, "_blank");
});


// ============================================================
// LOGIN
// ============================================================

loginBtn.addEventListener("click", async () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Ingresa tu correo y contraseña");
        return;
    }

    try {
        // Iniciar sesión
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Obtener documento del usuario
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            alert("Tu usuario no está configurado correctamente. Contacta al administrador.");
            return;
        }

        const userData = userSnap.data();

        // Validar estado
        if (userData.status !== "active") {
            alert("Tu cuenta está inactiva.");
            return;
        }

        // Validar fecha de vencimiento
        const now = new Date();
        const expiry = userData.expirationDate?.toDate();

        if (!expiry || expiry < now) {
            alert("Tu acceso ha vencido.");
            return;
        }

        // Redireccionar según rol
        if (userData.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "student.html";
        }

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        alert("Correo o contraseña incorrectos.");
    }
});
