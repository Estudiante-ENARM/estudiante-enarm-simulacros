// ============================================================
// admin.js - Panel del Administrador
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
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ============================================================
// ELEMENTOS DEL DOM
// ============================================================

const adminContent = document.getElementById("adminContent");

const navSections = document.getElementById("nav-sections");
const navExams = document.getElementById("nav-exams");
const navCases = document.getElementById("nav-cases");
const navQuestions = document.getElementById("nav-questions");
const navUsers = document.getElementById("nav-users");
const navLogout = document.getElementById("nav-logout");


// ============================================================
// VALIDACIÓN DE SESIÓN (Solo admin)
// ============================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) return (window.location.href = "index.html");

    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
        alert("Acceso no autorizado");
        return window.location.href = "index.html";
    }

    const userData = userSnap.data();

    if (userData.role !== "admin") {
        alert("Acceso no autorizado");
        return window.location.href = "index.html";
    }
});


// ============================================================
// 1. GESTIÓN DE SECCIONES
// ============================================================

navSections.addEventListener("click", loadSections);

async function loadSections() {
    adminContent.innerHTML = `
        <h1 class="section-title">Secciones</h1>
        <div class="card">
            <h3>Nueva sección</h3>
            <input id="newSectionName" class="input" placeholder="Nombre de la sección">
            <button id="addSectionBtn" class="btn btn-primary">Agregar sección</button>
        </div>

        <h3 style="margin-top:30px;">Listado de secciones</h3>
        <div id="sectionsList">Cargando...</div>
    `;

    document.getElementById("addSectionBtn").onclick = addSection;

    const list = document.getElementById("sectionsList");
    list.innerHTML = "Cargando...";

    try {
        const snapshot = await getDocs(collection(db, "sections"));
        list.innerHTML = "";

        snapshot.forEach(sec => {
            list.innerHTML += `
                <div class="card">
                    <strong>${sec.data().name}</strong>
                    <button onclick="deleteSection('${sec.id}')" class="btn btn-danger" style="margin-top:10px;">
                        Eliminar
                    </button>
                </div>
            `;
        });
    } catch (err) {
        console.error(err);
        list.innerHTML = "Error al cargar.";
    }
}

async function addSection() {
    const name = document.getElementById("newSectionName").value.trim();
    if (!name) return alert("Escribe un nombre.");

    try {
        await addDoc(collection(db, "sections"), {
            name,
            createdAt: serverTimestamp()
        });
        loadSections();
    } catch (err) {
        console.error(err);
        alert("Error al agregar sección.");
    }
}

window.deleteSection = async function (id) {
    if (!confirm("¿Eliminar sección?")) return;
    await deleteDoc(doc(db, "sections", id));
    loadSections();
};


// ============================================================
// 2. GESTIÓN DE EXÁMENES
// ============================================================

navExams.addEventListener("click", loadExamsUI);

async function loadExamsUI() {
    adminContent.innerHTML = `
        <h1 class="section-title">Exámenes</h1>

        <div class="card">
            <h3>Nuevo examen</h3>

            <select id="examSectionSelect" class="input">
                <option value="">Selecciona sección...</option>
            </select>

            <input id="examName" class="input" placeholder="Nombre del examen">

            <button id="addExamBtn" class="btn btn-primary">Agregar examen</button>
        </div>

        <h3 style="margin-top:30px;">Exámenes existentes</h3>
        <div id="examList">Cargando...</div>
    `;

    loadSectionsInSelect("examSectionSelect");

    document.getElementById("addExamBtn").onclick = addExam;

    loadExamList();
}

async function loadSectionsInSelect(selectId) {
    const select = document.getElementById(selectId);

    select.innerHTML = `<option value="">Selecciona sección...</option>`;
    const snapshot = await getDocs(collection(db, "sections"));

    snapshot.forEach(sec => {
        select.innerHTML += `<option value="${sec.id}">${sec.data().name}</option>`;
    });
}

async function addExam() {
    const sectionId = document.getElementById("examSectionSelect").value;
    const name = document.getElementById("examName").value.trim();

    if (!sectionId || !name) return alert("Completa los campos.");

    try {
        await addDoc(collection(db, "sections", sectionId, "exams"), {
            name,
            questionCount: 0,
            estimatedTimeSeconds: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        loadExamList();
    } catch (err) {
        console.error(err);
        alert("Error al crear examen.");
    }
}

async function loadExamList() {
    const examList = document.getElementById("examList");
    examList.innerHTML = "Cargando...";

    const sectionsSnap = await getDocs(collection(db, "sections"));
    examList.innerHTML = "";

    for (let sec of sectionsSnap.docs) {
        const secData = sec.data();
        const examsSnap = await getDocs(collection(db, "sections", sec.id, "exams"));

        examsSnap.forEach(exam => {
            const data = exam.data();

            examList.innerHTML += `
                <div class="card">
                    <strong>${data.name}</strong>
                    <p>Sección: ${secData.name}</p>

                    <button onclick="deleteExam('${sec.id}', '${exam.id}')"
                        class="btn btn-danger" style="margin-top:10px;">
                        Eliminar
                    </button>
                </div>
            `;
        });
    }
}

window.deleteExam = async function (sectionId, examId) {
    if (!confirm("¿Eliminar examen?")) return;
    await deleteDoc(doc(db, "sections", sectionId, "exams", examId));
    loadExamList();
};


// ============================================================
// 3. GESTIÓN DE CASOS CLÍNICOS
// ============================================================

navCases.addEventListener("click", loadCasesUI);

async function loadCasesUI() {
    adminContent.innerHTML = `
        <h1 class="section-title">Casos clínicos</h1>

        <div class="card">
            <h3>Nuevo caso clínico</h3>

            <select id="caseSectionSelect" class="input">
                <option value="">Selecciona sección...</option>
            </select>

            <select id="caseExamSelect" class="input">
                <option value="">Selecciona examen...</option>
            </select>

            <textarea id="caseText" class="input" placeholder="Texto del caso clínico"></textarea>
            <button id="addCaseBtn" class="btn btn-primary">Agregar caso</button>
        </div>

        <h3 style="margin-top:30px;">Casos existentes</h3>
        <div id="caseList"></div>
    `;

    loadSectionsInSelect("caseSectionSelect");

    document.getElementById("caseSectionSelect").addEventListener("change", () => {
        loadExamsInSelect("caseExamSelect", document.getElementById("caseSectionSelect").value);
    });

    document.getElementById("addCaseBtn").onclick = addCase;
}

async function loadExamsInSelect(selectId, sectionId) {
    const select = document.getElementById(selectId);

    select.innerHTML = `<option value="">Selecciona examen...</option>`;

    const snap = await getDocs(collection(db, "sections", sectionId, "exams"));
    snap.forEach(ex => {
        select.innerHTML += `<option value="${ex.id}">${ex.data().name}</option>`;
    });
}

async function addCase() {
    const secId = document.getElementById("caseSectionSelect").value;
    const examId = document.getElementById("caseExamSelect").value;
    const caseText = document.getElementById("caseText").value.trim();

    if (!secId || !examId || !caseText) return alert("Completa todos los campos.");

    const ref = collection(db, "sections", secId, "exams", examId, "cases");

    const snap = await getDocs(ref);
    const order = snap.size;

    await addDoc(ref, {
        caseText,
        order
    });

    alert("Caso agregado.");
}


// ============================================================
// 4. GESTIÓN DE PREGUNTAS
// ============================================================

navQuestions.addEventListener("click", loadQuestionsUI);

async function loadQuestionsUI() {
    adminContent.innerHTML = `
        <h1 class="section-title">Preguntas</h1>

        <div class="card">
            <h3>Nueva pregunta</h3>

            <select id="qSectionSelect" class="input">
                <option value="">Sección...</option>
            </select>

            <select id="qExamSelect" class="input">
                <option value="">Examen...</option>
            </select>

            <select id="qCaseSelect" class="input">
                <option value="">Caso...</option>
            </select>

            <textarea id="questionText" class="input" placeholder="Pregunta"></textarea>
            <input id="optionA" class="input" placeholder="Opción A">
            <input id="optionB" class="input" placeholder="Opción B">
            <input id="optionC" class="input" placeholder="Opción C">
            <input id="optionD" class="input" placeholder="Opción D">

            <input id="correctOption" class="input" placeholder="Correcta (A/B/C/D)">
            <input id="specialty" class="input" placeholder="Especialidad">
            <input id="subtype" class="input" placeholder="Subtipo">
            <input id="difficulty" class="input" placeholder="low / medium / high">

            <textarea id="explanation" class="input" placeholder="Justificación"></textarea>
            <input id="guideline" class="input" placeholder="GPC">

            <button id="addQuestionBtn" class="btn btn-primary">Agregar pregunta</button>
        </div>

        <h3 style="margin-top:30px;">Preguntas del caso</h3>
        <div id="questionList"></div>
    `;

    loadSectionsInSelect("qSectionSelect");

    document.getElementById("qSectionSelect").addEventListener("change", () => {
        loadExamsInSelect("qExamSelect", document.getElementById("qSectionSelect").value);
    });

    document.getElementById("qExamSelect").addEventListener("change", () => {
        loadCasesInSelect("qCaseSelect");
    });

    document.getElementById("addQuestionBtn").onclick = addQuestion;

    document.getElementById("qCaseSelect").addEventListener("change", loadQuestionList);
}

async function loadCasesInSelect(caseSelectId) {
    const secId = document.getElementById("qSectionSelect").value;
    const examId = document.getElementById("qExamSelect").value;

    const select = document.getElementById("qCaseSelect");
    select.innerHTML = `<option value="">Caso...</option>`;

    const snap = await getDocs(collection(db, "sections", secId, "exams", examId, "cases"));

    snap.forEach(c => {
        const txt = c.data().caseText.substring(0, 40);
        select.innerHTML += `<option value="${c.id}">${txt}...</option>`;
    });
}

async function addQuestion() {
    const secId = document.getElementById("qSectionSelect").value;
    const examId = document.getElementById("qExamSelect").value;
    const caseId = document.getElementById("qCaseSelect").value;

    if (!secId || !examId || !caseId) return alert("Selecciona sección, examen y caso.");

    const qText = document.getElementById("questionText").value.trim();
    const A = document.getElementById("optionA").value.trim();
    const B = document.getElementById("optionB").value.trim();
    const C = document.getElementById("optionC").value.trim();
    const D = document.getElementById("optionD").value.trim();

    const correct = document.getElementById("correctOption").value.trim().toUpperCase();
    const specialty = document.getElementById("specialty").value.trim();
    const subtype = document.getElementById("subtype").value.trim();
    const difficulty = document.getElementById("difficulty").value.trim();
    const explanation = document.getElementById("explanation").value.trim();
    const guideline = document.getElementById("guideline").value.trim();

    if (!qText || !A || !B || !C || !D ||
        !correct || !specialty || !subtype || !difficulty)
        return alert("Completa todos los campos.");

    const qRef = collection(db, "sections", secId, "exams", examId, "cases", caseId, "questions");

    const snap = await getDocs(qRef);
    const order = snap.size;

    await addDoc(qRef, {
        questionText: qText,
        optionA: A,
        optionB: B,
        optionC: C,
        optionD: D,
        correctOption: correct,
        specialty,
        subtype,
        difficulty,
        explanation,
        guideline,
        order
    });

    alert("Pregunta agregada.");
    loadQuestionList();
}

async function loadQuestionList() {
    const secId = document.getElementById("qSectionSelect").value;
    const examId = document.getElementById("qExamSelect").value;
    const caseId = document.getElementById("qCaseSelect").value;

    const list = document.getElementById("questionList");
    list.innerHTML = "Cargando...";

    const qSnap = await getDocs(
        query(
            collection(db, "sections", secId, "exams", examId, "cases", caseId, "questions"),
            orderBy("order")
        )
    );

    list.innerHTML = "";

    qSnap.forEach(q => {
        list.innerHTML += `
            <div class="card">
                <strong>${q.data().questionText}</strong>
                <p><strong>Correcta:</strong> ${q.data().correctOption}</p>

                <button onclick="deleteQuestion('${secId}', '${examId}', '${caseId}', '${q.id}')"
                        class="btn btn-danger" style="margin-top:10px;">
                    Eliminar
                </button>
            </div>
        `;
    });
}

window.deleteQuestion = async function (secId, examId, caseId, qId) {
    if (!confirm("¿Eliminar pregunta?")) return;
    await deleteDoc(doc(db, "sections", secId, "exams", examId, "cases", caseId, "questions", qId));
    loadQuestionList();
};


// ============================================================
// 5. GESTIÓN DE USUARIOS
// ============================================================

navUsers.addEventListener("click", loadUsersUI);

async function loadUsersUI() {
    adminContent.innerHTML = `
        <h1 class="section-title">Usuarios</h1>

        <div class="card">
            <h3>Agregar usuario</h3>

            <input id="userName" class="input" placeholder="Nombre">
            <input id="userEmail" class="input" placeholder="Correo">
            <input id="userPassword" class="input" placeholder="Contraseña">

            <select id="userStatus" class="input">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
            </select>

            <select id="userRole" class="input">
                <option value="student">Student</option>
                <option value="admin">Admin</option>
            </select>

            <input id="userExpiry" type="date" class="input">

            <button id="createUserBtn" class="btn btn-primary">
                Crear usuario
            </button>
        </div>

        <h3 style="margin-top:30px;">Listado de usuarios</h3>
        <div id="usersList">Cargando...</div>
    `;

    document.getElementById("createUserBtn").onclick = createUser;
    loadUsersList();
}

async function createUser() {
    const name = document.getElementById("userName").value.trim();
    const email = document.getElementById("userEmail").value.trim();
    const password = document.getElementById("userPassword").value.trim();
    const status = document.getElementById("userStatus").value;
    const role = document.getElementById("userRole").value;
    const expiry = document.getElementById("userExpiry").value;

    if (!name || !email || !password || !expiry)
        return alert("Completa todos los campos.");

    const expiryDate = new Date(expiry);

    const userDocRef = doc(collection(db, "users"));
    const userId = userDocRef.id;

    await setDoc(doc(db, "users", userId), {
        name,
        email,
        storedPassword: password,
        role,
        status,
        expirationDate: Timestamp.fromDate(expiryDate),
        totalExamsTaken: 0,
        lastActivity: serverTimestamp(),
        createdAt: serverTimestamp()
    });

    alert("Usuario creado (recuerda crearlo también en Authentication).");

    loadUsersList();
}

async function loadUsersList() {
    const usersList = document.getElementById("usersList");
    usersList.innerHTML = "Cargando...";

    const snapshot = await getDocs(collection(db, "users"));

    usersList.innerHTML = "";

    snapshot.forEach(u => {
        const d = u.data();

        usersList.innerHTML += `
            <div class="card">
                <strong>${d.name}</strong>
                <p>${d.email}</p>
                <p>Role: ${d.role}</p>
                <p>Status: ${d.status}</p>
                <p>Vence: ${d.expirationDate?.toDate().toLocaleDateString()}</p>
                <p>Total exámenes: ${d.totalExamsTaken}</p>

                <button onclick="deleteUser('${u.id}')" class="btn btn-danger" style="margin-top:10px;">
                    Eliminar
                </button>

                <button onclick="viewUserProgress('${u.id}')" class="btn btn-secondary" style="margin-top:10px;">
                    Ver progreso
                </button>
            </div>
        `;
    });
}

window.deleteUser = async function (userId) {
    if (!confirm("¿Eliminar usuario?")) return;
    await deleteDoc(doc(db, "users", userId));
    loadUsersList();
};

window.viewUserProgress = async function (userId) {
    adminContent.innerHTML = `
        <h1 class="section-title">Progreso del usuario</h1>
        <div id="progressData">Cargando...</div>
    `;

    const attemptsSnap = await getDocs(
        query(collection(db, "attempts"), where("userId", "==", userId))
    );

    let html = "";

    attemptsSnap.forEach(a => {
        const data = a.data();

        html += `
            <div class="card">
                <p><strong>Examen ID:</strong> ${data.examId}</p>
                <p><strong>Fecha:</strong> ${data.date.toDate().toLocaleString()}</p>
                <p><strong>Calificación:</strong> ${data.globalScore}%</p>
            </div>
        `;
    });

    document.getElementById("progressData").innerHTML = html || "No hay intentos.";
};


// ============================================================
// LOGOUT
// ============================================================

navLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});
