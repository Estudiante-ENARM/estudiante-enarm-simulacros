// ============================================================
// progressChart.js - Gráfica del Progreso del Alumno
// Plataforma ENARM
// ============================================================

import { auth, db } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ============================================================
// FUNCIÓN PRINCIPAL USADA EN student.js
// ============================================================

export async function renderUserProgressChart() {

    const user = auth.currentUser;
    if (!user) return;

    // Contenedor del canvas
    const ctx = document.getElementById("progressChart").getContext("2d");

    // Obtener todos los intentos ordenados cronológicamente
    const attemptsRef = collection(db, "attempts");

    const attemptsSnap = await getDocs(
        query(
            attemptsRef,
            where("userId", "==", user.uid),
            orderBy("timestamp", "asc")
        )
    );

    let labels = [];
    let scores = [];

    attemptsSnap.forEach(doc => {
        const data = doc.data();

        const dateObj = new Date(data.timestamp);
        const formatted = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString();

        labels.push(formatted);
        scores.push(Number(data.globalScore));
    });

    if (labels.length === 0) {
        ctx.font = "16px Inter";
        ctx.fillText("Aún no has realizado ningún examen.", 20, 40);
        return;
    }

    // Destruir gráfica previa si existe
    if (window.progressChartInstance) {
        window.progressChartInstance.destroy();
    }

    // Crear nueva gráfica
    window.progressChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Calificación (%)",
                data: scores,
                fill: false,
                borderColor: "#0066ff",
                borderWidth: 3,
                tension: 0.25,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Calificación (%)"
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: "Fecha"
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

}
