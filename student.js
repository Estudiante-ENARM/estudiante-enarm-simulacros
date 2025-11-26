// ============================================================
// student.js - Panel del Estudiante
// Plataforma ENARM
// ============================================================

import { auth, db } from "./firebase.js";

import {
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ============================================================
// VALIDACIÓN DE SESIÓN (solo estudiantes)
// ============================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "index.html";

    const docSnap = await getDoc(doc(db, "users", user.uid));

    if (!docSnap.exists() || docSnap.data().role !== "student") {
        alert("Acceso no autorizado.");
        return window.location.href = "index.html";
    }
});


// ============================================================
// ELEMENTOS DEL DOM
// ============================================================

const sectionsList = document.getElementById("sectionsList");
const studentContent = document.getElementById("studentContent");
const progressBtn = document.getElementById("progressBtn");
const logoutBtn = document.getElementById("logoutBtn");


// ============================================================
// 1. CARGAR SECCIONES
// ============================================================

async function loadSections() {
    sectionsList.innerHTML = "Cargando...";

    const snapshot = await getDocs(collection(db, "sections"));

    sectionsList.innerHTML = "";

    snapshot.forEach(sec => {
        const data = sec.data();

        const div = document.createElement("div");
        div.classList.add("sidebar-item");
        div.textContent = data.name;

        div.onclick = () => loadExams(sec.id, data.name);

        sectionsList.appendChild(div);
    });
}

loadSections();


// ============================================================
// 2. CARGAR EXÁMENES DE UNA SECCIÓN
// ============================================================

async function loadExams(sectionId, sectionName) {
    studentContent.innerHTML = `
        <h1 class="section-title">${sectionName}</h1>
        <div id="examCards">Cargando exámenes...</div>
    `;

    const examCards = document.getElementById("examCards");
    examCards.innerHTML = "";

    const examsSnap = await getDocs(collection(db, "sections", sectionId, "exams"));

    examsSnap.forEach(exam => {
        const data = exam.data();

        examCards.innerHTML += `
            <div class="exam-card" onclick="openExam('${sectionId}', '${exam.id}', '${data.name}')">
                <h3>${data.name}</h3>
                <p>Preguntas: ${data.questionCount}</p>
                <p>Tiempo estimado: ${(data.estimatedTimeSeconds / 60).toFixed(0)} min</p>
            </div>
        `;
    });
}

window.openExam = async function (sectionId, examId, examName) {
    loadExamView(sectionId, examId, examName);
};


// ============================================================
// 3. CARGAR EXAMEN COMPLETO (casos + preguntas)
// ============================================================

async function loadExamView(sectionId, examId, examName) {
    studentContent.innerHTML = `
        <h1 class="section-title">${examName}</h1>
        <div id="examContainer">Cargando examen completo...</div>
        <button id="finishExamBtn" class="btn btn-primary" style="margin-top:25px;">Finalizar examen</button>
    `;

    const examContainer = document.getElementById("examContainer");

    const casesSnap = await getDocs(
        query(
            collection(db, "sections", sectionId, "exams", examId, "cases"),
            orderBy("order")
        )
    );

    let casesData = [];

    for (let c of casesSnap.docs) {
        const caseId = c.id;
        const caseText = c.data().caseText;

        const questionsSnap = await getDocs(
            query(
                collection(db, "sections", sectionId, "exams", examId, "cases", caseId, "questions"),
                orderBy("order")
            )
        );

        let questions = [];

        questionsSnap.forEach(q => {
            questions.push({
                id: q.id,
                ...q.data()
            });
        });

        casesData.push({
            caseId,
            caseText,
            questions
        });
    }

    renderExam(casesData);

    document.getElementById("finishExamBtn").onclick = () => finalizeExam(sectionId, examId, examName, casesData);
}

function renderExam(casesData) {
    const examContainer = document.getElementById("examContainer");
    examContainer.innerHTML = "";

    casesData.forEach((caso, i) => {
        examContainer.innerHTML += `
            <div class="question-block">
                <h3>Caso clínico</h3>
                <p>${caso.caseText}</p>
            </div>
        `;

        caso.questions.forEach((q, idx) => {
            examContainer.innerHTML += `
                <div class="question-block">
                    <h4>${q.questionText}</h4>

                    <div>
                        <label><input type="radio" name="${q.id}" value="A"> ${q.optionA}</label><br>
                        <label><input type="radio" name="${q.id}" value="B"> ${q.optionB}</label><br>
                        <label><input type="radio" name="${q.id}" value="C"> ${q.optionC}</label><br>
                        <label><input type="radio" name="${q.id}" value="D"> ${q.optionD}</label>
                    </div>
                </div>
            `;
        });
    });
}


// ============================================================
// 4. FINALIZAR EXAMEN – GUARDAR INTENTO
// ============================================================

async function finalizeExam(sectionId, examId, examName, casesData) {
    if (!confirm("¿Deseas finalizar el examen?")) return;

    let totalQuestions = 0;
    let totalCorrect = 0;

    // Tablas de rendimiento
    let specialtyStats = {};
    let questionTypeStats = {};
    let difficultyStats = {
        low: { correct: 0, total: 0, percentage: 0 },
        medium: { correct: 0, total: 0, percentage: 0 },
        high: { correct: 0, total: 0, percentage: 0 }
    };

    // Inicializar Tabla 2 dinámicamente
    function initSpecialty(s) {
        if (!specialtyStats[s]) {
            specialtyStats[s] = {
                correct: 0,
                total: 0,
                weightedScore: 0,
                percentage: 0
            };
        }

        if (!questionTypeStats[s]) {
            questionTypeStats[s] = {
                publicHealth: { correct: 0, total: 0 },
                emergency: { correct: 0, total: 0 },
                familyMedicine: { correct: 0, total: 0 }
            };
        }
    }

    let details = [];

    casesData.forEach((caso) => {
        caso.questions.forEach((q) => {
            totalQuestions++;

            const selectedInput = document.querySelector(`input[name='${q.id}']:checked`);
            const userAnswer = selectedInput ? selectedInput.value : null;

            const isCorrect = userAnswer === q.correctOption;

            if (isCorrect) totalCorrect++;

            const specialty = q.specialty;
            const subtype = q.subtype;
            const difficulty = q.difficulty;

            // Inicializar estructuras
            initSpecialty(specialty);

            // Tabla 1 → especialidades
            specialtyStats[specialty].total++;
            if (isCorrect) specialtyStats[specialty].correct++;

            // Tabla 2 → especialidades por subtipo
            questionTypeStats[specialty][subtype].total++;
            if (isCorrect) questionTypeStats[specialty][subtype].correct++;

            // Tabla 3 → dificultad
            difficultyStats[difficulty].total++;
            if (isCorrect) difficultyStats[difficulty].correct++;

            // Details
            details.push({
                questionText: q.questionText,
                userAnswer,
                correctOption: q.correctOption,
                isCorrect,
                specialty,
                subtype,
                difficulty,
                explanation: q.explanation,
                guideline: q.guideline
            });
        });
    });

    // Calcular porcentajes
    for (let s in specialtyStats) {
        const sp = specialtyStats[s];
        sp.percentage = ((sp.correct / sp.total) * 100).toFixed(1);
        sp.weightedScore = sp.correct; // puedes ajustar si deseas reglas especiales
    }

    for (let d in difficultyStats) {
        const df = difficultyStats[d];
        df.percentage = df.total > 0 ? ((df.correct / df.total) * 100).toFixed(1) : 0;
    }

    const globalScore = ((totalCorrect / totalQuestions) * 100).toFixed(1);

    const user = auth.currentUser;

    // Crear intento
    const attemptRef = await addDoc(collection(db, "attempts"), {
        userId: user.uid,
        sectionId,
        examId,
        date: new Date(),
        timestamp: Date.now(),
        globalScore,
        totalQuestions,
        totalCorrect,
        specialtyStats,
        questionTypeStats,
        difficultyStats
    });

    // Guardar details
    for (let det of details) {
        await addDoc(collection(db, "attempts", attemptRef.id, "details"), det);
    }

    // Actualizar último acceso
    await updateDoc(doc(db, "users", user.uid), {
        lastActivity: serverTimestamp(),
        totalExamsTaken: totalCorrect // puedes ajustar esta métrica
    });

    showResults(globalScore, specialtyStats, questionTypeStats, difficultyStats, details);
}


// ============================================================
// 5. MOSTRAR RESULTADOS
// ============================================================

function showResults(globalScore, specialtyStats, questionTypeStats, difficultyStats, details) {
    studentContent.innerHTML = `
        <h1 class="section-title">Resultados</h1>

        <div class="card">
            <h2>Calificación: ${globalScore}%</h2>
        </div>

        <div class="card">
            <h3>Tabla 1: Especialidades</h3>
            ${renderTable1(specialtyStats)}
        </div>

        <div class="card">
            <h3>Tabla 2: Subtipos por especialidad</h3>
            ${renderTable2(questionTypeStats)}
        </div>

        <div class="card">
            <h3>Tabla 3: Dificultad</h3>
            ${renderTable3(difficultyStats)}
        </div>

        <div class="card">
            <h3>Justificaciones</h3>
            ${renderJustifications(details)}
        </div>
    `;
}

function renderTable1(stats) {
    let html = `
    <table class="table">
        <thead>
            <tr>
                <th>Especialidad</th>
                <th>Aciertos</th>
                <th>Total</th>
                <th>Ponderado</th>
                <th>%</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (let sp in stats) {
        const d = stats[sp];
        html += `
            <tr>
                <td>${sp}</td>
                <td>${d.correct}</td>
                <td>${d.total}</td>
                <td>${d.weightedScore}</td>
                <td>${d.percentage}%</td>
            </tr>
        `;
    }

    html += "</tbody></table>";
    return html;
}

function renderTable2(stats) {
    let html = `
    <table class="table">
        <thead>
            <tr>
                <th>Especialidad</th>
                <th>Salud pública</th>
                <th>Urgencias</th>
                <th>Medicina familiar</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (let sp in stats) {
        const st = stats[sp];
        html += `
            <tr>
                <td>${sp}</td>
                <td>${st.publicHealth.correct}/${st.publicHealth.total}</td>
                <td>${st.emergency.correct}/${st.emergency.total}</td>
                <td>${st.familyMedicine.correct}/${st.familyMedicine.total}</td>
            </tr>
        `;
    }

    html += "</tbody></table>";
    return html;
}

function renderTable3(stats) {
    return `
    <table class="table">
        <thead>
            <tr>
                <th>Dificultad</th>
                <th>Aciertos</th>
                <th>Total</th>
                <th>%</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Baja</td>
                <td>${stats.low.correct}</td>
                <td>${stats.low.total}</td>
                <td>${stats.low.percentage}%</td>
            </tr>
            <tr>
                <td>Media</td>
                <td>${stats.medium.correct}</td>
                <td>${stats.medium.total}</td>
                <td>${stats.medium.percentage}%</td>
            </tr>
            <tr>
                <td>Alta</td>
                <td>${stats.high.correct}</td>
                <td>${stats.high.total}</td>
                <td>${stats.high.percentage}%</td>
            </tr>
        </tbody>
    </table>
    `;
}

function renderJustifications(details) {
    let html = "";

    details.forEach(d => {
        html += `
            <div class="card">
                <h4>${d.questionText}</h4>

                <p><strong>Tu respuesta:</strong> ${d.userAnswer || "Sin responder"}</p>
                <p><strong>Correcta:</strong> ${d.correctOption}</p>

                <p><strong>Especialidad:</strong> ${d.specialty}</p>
                <p><strong>Subtipo:</strong> ${d.subtype}</p>
                <p><strong>Dificultad:</strong> ${d.difficulty}</p>

                <p><strong>Justificación:</strong> ${d.explanation}</p>
                <p><strong>GPC:</strong> ${d.guideline}</p>
            </div>
        `;
    });

    return html;
}


// ============================================================
// 6. PROGRESO DEL ALUMNO
// ============================================================

progressBtn.addEventListener("click", loadProgress);

async function loadProgress() {
    studentContent.innerHTML = `
        <h1 class="section-title">Mi progreso</h1>
        <div id="chartContainer" class="chart-container">
            <canvas id="progressChart"></canvas>
        </div>
    `;

    renderUserProgressChart();
}


// ============================================================
// 7. LOGOUT
// ============================================================

logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});
