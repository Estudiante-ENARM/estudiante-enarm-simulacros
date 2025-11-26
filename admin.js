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
    serverTimestamp
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

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().role !== "admin") {
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
        <div id="sectionsList"></div>
    `;

    document.getElementById("addSectionBtn").onclick = addSection;

    const sectionsList = document.getElementById("sectionsList");
    sectionsList.innerHTML = "Cargando...";

    const snapshot = await getDocs(collection(db, "sections"));

    sectionsList.innerHTML = "";

    snapshot.forEach((sec) => {
        const data = sec.data();

        sectionsList.innerHTML += `
            <div class="card">
                <strong>${data.name}</strong>
                <div style="margin-top:10px;">
                    <button onclick="deleteSection('${sec.id}')" class="btn btn-danger">Eliminar</button>
                </div>
            </div>
        `;
    });
}

async function addSection() {
    const name = document.getElementById("newSectionName").value.trim();
    if (!name) return alert("Escribe un nombre");

    await addDoc(collection(db, "sections"), {
        name,
        createdAt: serverTimestamp()
    });

    loadSections();
}

window.deleteSection = async function (id) {
    if (!confirm("¿Seguro que deseas eliminar esta sección?")) return;

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
            <h3>Nueva examen</h3>
            
            <select id="examSectionSelect" class="input">
                <option value="">Selecciona sección...</option>
            </select>

            <input id="examName" class="input" placeholder="Nombre del examen">

            <button id="addExamBtn" class="btn btn-primary">Agregar examen</button>
        </div>

        <h3 style="margin-top:30px;">Exámenes existentes</h3>
        <div id="examList"></div>
    `;

    loadSectionsInSelect("examSectionSelect");
    document.getElementById("addExamBtn").onclick = addExam;

    loadExamList();
}

async function loadSectionsInSelect(selectId) {
    const select = document.getElementById(selectId);
    const snapshot = await getDocs(collection(db, "sections"));

    snapshot.forEach(sec => {
        select.innerHTML += `<option value="${sec.id}">${sec.data().name}</option>`;
    });
}

async function addExam() {
    const sectionId = document.getElementById("examSectionSelect").value;
    const examName = document.getElementById("examName").value.trim();

    if (!sectionId || !examName) return alert("Completa los campos");

    const examRef = collection(db, "sections", sectionId, "exams");

    await addDoc(examRef, {
        name: examName,
        questionCount: 0,
        estimatedTimeSeconds: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    loadExamList();
}

async function loadExamList() {
    const examList = document.getElementById("examList");
    examList.innerHTML = "Cargando...";

    const secSnap = await getDocs(collection(db, "sections"));
    examList.innerHTML = "";

    for (let sec of secSnap.docs) {
        const secData = sec.data();

        const examsSnap = await getDocs(collection(db, "sections", sec.id, "exams"));

        examsSnap.forEach(exam => {
            const data = exam.data();

            examList.innerHTML += `
                <div class="card">
                    <strong>${data.name}</strong>
                    <p>Sección: ${secData.name}</p>
                    <p>Preguntas: ${data.questionCount}</p>
                    <p>Tiempo estimado: ${data.estimatedTimeSeconds} seg</p>

                    <button onclick="deleteExam('${sec.id}', '${exam.id}')" 
                        class="btn btn-danger">Eliminar</button>
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
            <h3>Selecciona examen</h3>

            <select id="caseSectionSelect" class="input">
                <option value="">Selecciona sección...</option>
            </select>

            <select id="caseExamSelect" class="input">
                <option value="">Selecciona un examen...</option>
            </select>

            <textarea id="caseText" class="input" placeholder="Texto del caso clínico"></textarea>
            <button id="addCaseBtn" class="btn btn-primary">Agregar caso</button>
        </div>

        <h3 style="margin-top:30px;">Casos existentes</h3>
        <div id="caseList"></div>
    `;

    loadSectionsInSelect("caseSectionSelect");

    document.getElementById("caseSectionSelect").addEventListener("change", async () => {
        const secId = document.getElementById("caseSectionSelect").value;
        loadExamsInSelect("caseExamSelect", secId);
    });

    document.getElementById("addCaseBtn").onclick = addCase;
}

async function loadExamsInSelect(selectId, sectionId) {
    const select = document.getElementById(selectId);
    select.innerHTML = `<option value="">Selecciona examen...</option>`;

    const examsSnap = await getDocs(collection(db, "sections", sectionId, "exams"));

    examsSnap.forEach(exam => {
        select.innerHTML += `<option value="${exam.id}">${exam.data().name}</option>`;
    });
}

async function addCase() {
    const secId = document.getElementById("caseSectionSelect").value;
    const examId = document.getElementById("caseExamSelect").value;
    const caseText = document.getElementById("caseText").value.trim();

    if (!secId || !examId || !caseText) return alert("Completa todos los campos");

    const caseRef = collection(db, "sections", secId, "exams", examId, "cases");

    const snapshot = await getDocs(caseRef);
    const order = snapshot.size;

    await addDoc(caseRef, {
        caseText,
        order
    });

    alert("Caso agregado");
}


// ============================================================
// 4. GESTIÓN DE PREGUNTAS
// ============================================================

navQuestions.addEventListener("click", loadQuestionsUI);

async function loadQuestionsUI() {
    adminContent.innerHTML = `
        <h1 class="section-title">Preguntas</h1>

        <div class="card">
            <h3>Selecciona un caso</h3>

            <select id="qSectionSelect" class="input">
                <option value="">Sección...</option>
            </select>

            <select id="qExamSelect" class="input">
                <option value="">Examen...</option>
            </select>

            <select id="qCaseSelect" class="input">
                <option value="">Caso clínico...</option>
            </select>

            <h3 style="margin-top:20px;">Nueva pregunta</h3>

            <textarea id="questionText" class="input" placeholder="Pregunta"></textarea>
            <input id="optionA" class="input" placeholder="Opción A">
            <input id="optionB" class="input" placeholder="Opción B">
            <input id="optionC" class="input" placeholder="Opción C">
            <input id="optionD" class="input" placeholder="Opción D">

            <input id="correctOption" class="input" placeholder="Correcta (A/B/C/D)">
            <input id="specialty" class="input" placeholder="Especialidad (internalMedicine...)">
            <input id="subtype" class="input" placeholder="Subtipo (Public Health...)">
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

    const casesSnap = await getDocs(collection(db,
        "sections", secId, "exams", examId, "cases"));

    casesSnap.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.data().caseText.substring(0, 40)}...</option>`;
    });
}

async function addQuestion() {
    const secId = document.getElementById("qSectionSelect").value;
    const examId = document.getElementById("qExamSelect").value;
    const caseId = document.getElementById("qCaseSelect").value;

    if (!secId || !examId || !caseId) return alert("Selecciona sección, examen y caso");

    const questionText = document.getElementById("questionText").value.trim();
    const optionA = document.getElementById("optionA").value.trim();
    const optionB = document.getElementById("optionB").value.trim();
    const optionC = document.getElementById("optionC").value.trim();
    const optionD = document.getElementById("optionD").value.trim();

    const correctOption = document.getElementById("correctOption").value.trim().toUpperCase();
    const specialty = document.getElementById("specialty").value.trim();
    const subtype = document.getElementById("subtype").value.trim();
    const difficulty = document.getElementById("difficulty").value.trim();

    const explanation = document.getElementById("explanation").value.trim();
    const guideline = document.getElementById("guideline").value.trim();

    if (!questionText || !optionA || !optionB || !optionC || !optionD ||
        !correctOption || !specialty || !subtype || !difficulty)
        return alert("Completa todos los campos");

    const qRef = collection(db,
        "sections", secId, "exams", examId, "cases", caseId, "questions");

    // Obtener orden (número de preguntas actuales)
    const snapshot = await getDocs(qRef);
    const order = snapshot.size;

    await addDoc(qRef, {
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        specialty,
        subtype,
        difficulty,
        explanation,
        guideline,
        order
    });

    alert("Pregunta agregada");
    loadQuestionList();
}

async function loadQuestionList() {
    const secId = document.getElementById("qSectionSelect").value;
    const examId = document.getElementById("qExamSelect").value;
    const caseId = document.getElementById("qCaseSelect").value;

    const list = document.getElementById("questionList");

    list.innerHTML = "Cargando...";

    const qRef = collection(db,
        "sections", secId, "exams", examId, "cases", caseId, "questions");

    const qSnap = await getDocs(query(qRef, orderBy("order")));

    list.innerHTML = "";

    qSnap.forEach(q => {
        const data = q.data();

        list.innerHTML += `
            <div class="card">
                <strong>${data.questionText}</strong>
                <p><strong>Correcta:</strong> ${data.correctOption}</p>
                <p><strong>Especialidad:</strong> ${data.specialty}</p>
                <p><strong>Dificultad:</strong> ${data.difficulty}</p>

                <button onclick="deleteQuestion('${secId}', '${examId}', '${caseId}', '${q.id}')"
                        class="btn btn-danger" style="margin-top:10px;">Eliminar</button>
            </div>
        `;
    });
}

window.deleteQuestion = async function (secId, examId, caseId, qId) {
    if (!confirm("¿Eliminar pregunta?")) return;

    await deleteDoc(doc(db,
        "sections", secId, "exams", examId, "cases", caseId, "questions", qId));

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
        <div id="usersList"></div>
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
        return alert("Completa todos los campos");

    const expiryDate = new Date(expiry);

    const userDocRef = doc(collection(db, "users"));
    const userId = userDocRef.id;

    await setDoc(doc(db, "users", userId), {
        name,
        email,
        storedPassword: password,
        role,
        status,
        expirationDate: expiryDate,
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
        const data = u.data();

        usersList.innerHTML += `
            <div class="card">
                <strong>${data.name}</strong>
                <p>${data.email}</p>
                <p>Role: ${data.role}</p>
                <p>Status: ${data.status}</p>
                <p>Vence: ${data.expirationDate?.toDate().toLocaleDateString()}</p>
                <p>Total exámenes: ${data.totalExamsTaken}</p>

                <button onclick="deleteUser('${u.id}')" class="btn btn-danger"
                    style="margin-top:10px;">Eliminar</button>

                <button onclick="viewUserProgress('${u.id}')" class="btn btn-secondary"
                    style="margin-top:10px;">Ver progreso</button>
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

    const attemptsSnap = await getDocs(query(
        collection(db, "attempts"),
        where("userId", "==", userId),
        orderBy("timestamp", "asc")
    ));

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
