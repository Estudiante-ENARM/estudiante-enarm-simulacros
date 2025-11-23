// app.js
// --------------------------------------------------
// Inicialización de Firebase (modular v9+)
// --------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Configuración proporcionada
const firebaseConfig = {
  apiKey: "AIzaSyDAGsmp2qwZ2VBBKIDpUF0NUElcCLsGanQ",
  authDomain: "simulacros-plataforma-enarm.firebaseapp.com",
  projectId: "simulacros-plataforma-enarm",
  storageBucket: "simulacros-plataforma-enarm.firebasestorage.app",
  messagingSenderId: "1012829203040",
  appId: "1:1012829203040:web:71de568ff8606a1c8d7105"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --------------------------------------------------
// Estado global simple
// --------------------------------------------------
let currentUser = null; // documento completo del usuario
let currentRole = null; // "admin" | "estudiante" | null

// Referencias DOM básicas
const loginForm = document.getElementById("login-form");
const loginErrorEl = document.getElementById("login-error");
const btnCancelar = document.getElementById("btn-cancelar");
const mainContent = document.querySelector(".main-content");

// Sidebar
const sectionsListEl = document.getElementById("sections-list");
const menuUsersEl = document.getElementById("menu-users");
const menuIconsEl = document.getElementById("menu-icons");

// Íconos sociales
const iconInstagram = document.getElementById("icon-instagram");
const iconWhatsapp = document.getElementById("icon-whatsapp");
const iconTiktok = document.getElementById("icon-tiktok");
const iconTelegram = document.getElementById("icon-telegram");

// --------------------------------------------------
// Utilidades
// --------------------------------------------------
function setLoginError(message) {
  loginErrorEl.textContent = message || "";
}

function formatDateFromTimestamp(ts) {
  if (!ts) return "";
  const date = ts.toDate();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInputToDate(dateStr) {
  if (!dateStr) return null;
  // Fin del día para que siga activo todo ese día
  return new Date(`${dateStr}T23:59:59`);
}

function clearSidebarActive() {
  const items = document.querySelectorAll(".sidebar-item");
  items.forEach(i => i.classList.remove("active"));
}

// --------------------------------------------------
// LOGIN
// --------------------------------------------------
async function handleLoginSubmit(event) {
  event.preventDefault();
  setLoginError("");

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!username || !password) {
    setLoginError("Ingresa usuario y contraseña.");
    return;
  }

  try {
    // Buscar usuario en Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setLoginError("Usuario o contraseña incorrectos.");
      return;
    }

    // Tomamos el primero encontrado
    const userDoc = snapshot.docs[0];
    const data = userDoc.data();

    // Validar contraseña
    if (data.password !== password) {
      setLoginError("Usuario o contraseña incorrectos.");
      return;
    }

    // Validar estado
    if (data.status !== "activo") {
      setLoginError("Tu acceso está inactivo. Contacta al administrador.");
      return;
    }

    // Validar fecha de expiración
    if (data.expirationDate) {
      const now = new Date();
      const exp = data.expirationDate.toDate();
      // Si hoy ya es posterior a la fecha de expiración, bloqueamos
      if (now > exp) {
        setLoginError("Tu acceso ha expirado. Contacta al administrador.");
        return;
      }
    }

    currentUser = { id: userDoc.id, ...data };
    currentRole = data.role || "estudiante";

    // Limpiar formulario
    loginForm.reset();

    // Cargar vistas según rol
    if (currentRole === "admin") {
      renderAdminShell();
    } else {
      renderStudentShell();
    }

    // Cargar secciones en sidebar (ambos roles)
    await loadSectionsSidebar();

  } catch (error) {
    console.error("Error en login:", error);
    setLoginError("Ocurrió un error al iniciar sesión. Intenta de nuevo.");
  }
}

// Botón cancelar
function handleCancelar() {
  loginForm.reset();
  setLoginError("");
}

// --------------------------------------------------
// SHELL / CONTENEDOR ADMIN Y ESTUDIANTE
// --------------------------------------------------
function renderAdminShell() {
  mainContent.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card" id="admin-main-card">
        <h1 class="login-title">Panel de administrador</h1>
        <p class="login-subtitle">
          Bienvenido, ${currentUser?.username || ""}. 
          Usa el menú lateral para gestionar secciones, exámenes, usuarios e íconos.
        </p>
        <div id="content-area">
          <p>Selecciona una sección, <strong>Usuarios</strong> o <strong>Íconos</strong> en la barra lateral.</p>
        </div>
      </div>
    </div>
  `;
}

function renderStudentShell() {
  mainContent.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card" id="student-main-card">
        <h1 class="login-title">Panel del estudiante</h1>
        <p class="login-subtitle">
          Bienvenido, ${currentUser?.username || ""}. 
          Selecciona una sección en la barra lateral para ver los exámenes disponibles.
        </p>
        <div id="content-area">
          <p>Selecciona una sección en la barra lateral para comenzar un simulacro.</p>
        </div>
      </div>
    </div>
  `;
}

// Obtiene el contenedor de contenido actual
function getContentArea() {
  return document.getElementById("content-area");
}

// --------------------------------------------------
// SECCIONES (SIDEBAR)
// --------------------------------------------------
async function loadSectionsSidebar() {
  if (!sectionsListEl) return;

  sectionsListEl.innerHTML = "<li class='sidebar-item'>Cargando secciones...</li>";

  try {
    const colRef = collection(db, "sections");
    const q = query(colRef, orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    sectionsListEl.innerHTML = "";

    if (snapshot.empty) {
      sectionsListEl.innerHTML = "<li class='sidebar-item'>Sin secciones</li>";
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement("li");
      li.className = "sidebar-item";
      li.textContent = data.name || "Sección sin nombre";
      li.dataset.sectionId = docSnap.id;
      li.addEventListener("click", () => handleSectionClick(docSnap.id, data.name));
      sectionsListEl.appendChild(li);
    });
  } catch (error) {
    console.error("Error cargando secciones:", error);
    sectionsListEl.innerHTML = "<li class='sidebar-item'>Error al cargar secciones</li>";
  }
}

async function handleSectionClick(sectionId, sectionName) {
  clearSidebarActive();
  // marcar este elemento como activo
  const allItems = document.querySelectorAll(".sidebar-item");
  allItems.forEach(item => {
    if (item.dataset.sectionId === sectionId) {
      item.classList.add("active");
    }
  });

  if (!currentRole) {
    // No hay sesión iniciada
    const contentArea = getContentArea();
    if (contentArea) {
      contentArea.innerHTML = "<p>Primero inicia sesión para ver los exámenes.</p>";
    }
    return;
  }

  await renderExamsForSection(sectionId, sectionName);
}

// --------------------------------------------------
// EXÁMENES POR SECCIÓN
// (Versión 1: solo listado básico)
// --------------------------------------------------
async function renderExamsForSection(sectionId, sectionName) {
  const contentArea = getContentArea();
  if (!contentArea) return;

  contentArea.innerHTML = `<p>Cargando exámenes de <strong>${sectionName}</strong>...</p>`;

  try {
    const examsRef = collection(db, "exams");
    const qExams = query(examsRef, where("sectionId", "==", sectionId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(qExams);

    if (snapshot.empty) {
      contentArea.innerHTML = `
        <h2>Exámenes de ${sectionName}</h2>
        <p>No hay exámenes registrados en esta sección.</p>
      `;
      return;
    }

    let html = `
      <h2>Exámenes de ${sectionName}</h2>
      <p>Selecciona un examen para comenzar (estudiante) o administrarlo (administrador).</p>
      <div class="exams-list">
    `;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const title = data.title || "Sin título";
      const questionCount = data.questionCount || 0;
      const timeLimit = data.timeLimit || 0;

      html += `
        <div class="exam-card">
          <h3>${title}</h3>
          <p>${questionCount} preguntas · ${timeLimit} min</p>
          <div class="exam-actions">
            <button class="btn btn-primary" data-exam-id="${docSnap.id}" data-action="start">
              ${currentRole === "admin" ? "Simular como estudiante" : "Iniciar"}
            </button>
            ${
              currentRole === "admin"
                ? `<button class="btn btn-secondary" data-exam-id="${docSnap.id}" data-action="admin">
                     Administrar
                   </button>`
                : ""
            }
          </div>
        </div>
      `;
    });

    html += "</div>";

    if (currentRole === "admin") {
      html += `
        <p style="margin-top:15px;font-size:13px;color:var(--text-secondary);">
          Nota: En la siguiente etapa agregaremos la interfaz completa para crear, editar y eliminar exámenes y preguntas.
        </p>
      `;
    }

    contentArea.innerHTML = html;

    // Listeners básicos (placeholder)
    const buttons = contentArea.querySelectorAll(".exam-actions button");
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const examId = btn.getAttribute("data-exam-id");
        const action = btn.getAttribute("data-action");

        if (action === "start") {
          alert("En la siguiente etapa implementaremos la realización del simulacro completo.\nExamen ID: " + examId);
        } else if (action === "admin" && currentRole === "admin") {
          alert("Aquí irá el panel para administrar preguntas y justificaciones del examen.\nExamen ID: " + examId);
        }
      });
    });

  } catch (error) {
    console.error("Error al cargar exámenes:", error);
    contentArea.innerHTML = "<p>Ocurrió un error al cargar los exámenes.</p>";
  }
}

// --------------------------------------------------
// ÍCONOS (ADMIN)
// --------------------------------------------------
async function loadSocialLinksForSidebar() {
  try {
    const iconsDocRef = doc(db, "icons", "socialLinks");
    const docSnap = await getDoc(iconsDocRef);

    if (!docSnap.exists()) {
      // Si no existe, dejamos los # por defecto
      return;
    }

    const data = docSnap.data();

    if (data.instagram) iconInstagram.href = data.instagram;
    if (data.whatsapp) iconWhatsapp.href = data.whatsapp;
    if (data.tiktok) iconTiktok.href = data.tiktok;
    if (data.telegram) iconTelegram.href = data.telegram;
  } catch (error) {
    console.error("Error cargando íconos:", error);
  }
}

async function renderIconsAdmin() {
  const contentArea = getContentArea();
  if (!contentArea) return;

  if (currentRole !== "admin") {
    contentArea.innerHTML = "<p>No tienes permisos para editar los íconos.</p>";
    return;
  }

  contentArea.innerHTML = "<p>Cargando configuración de íconos...</p>";

  try {
    const iconsDocRef = doc(db, "icons", "socialLinks");
    const docSnap = await getDoc(iconsDocRef);
    const data = docSnap.exists() ? docSnap.data() : {};

    const instagram = data.instagram || "";
    const whatsapp = data.whatsapp || "";
    const tiktok = data.tiktok || "";
    const telegram = data.telegram || "";

    contentArea.innerHTML = `
      <h2>Configuración de íconos</h2>
      <p>Estos enlaces se usan en los íconos de la barra lateral.</p>
      <form id="icons-form" style="margin-top:15px;">
        <div class="form-group">
          <label for="icon-instagram-input">Instagram (URL)</label>
          <input type="url" id="icon-instagram-input" value="${instagram}">
        </div>
        <div class="form-group">
          <label for="icon-whatsapp-input">WhatsApp (URL)</label>
          <input type="url" id="icon-whatsapp-input" value="${whatsapp}">
        </div>
        <div class="form-group">
          <label for="icon-tiktok-input">TikTok (URL)</label>
          <input type="url" id="icon-tiktok-input" value="${tiktok}">
        </div>
        <div class="form-group">
          <label for="icon-telegram-input">Telegram (URL)</label>
          <input type="url" id="icon-telegram-input" value="${telegram}">
        </div>
        <div class="login-actions">
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
        <div id="icons-msg" class="login-footer-text" style="text-align:left;"></div>
      </form>
    `;

    const form = document.getElementById("icons-form");
    const msgEl = document.getElementById("icons-msg");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msgEl.textContent = "Guardando...";

      try {
        await updateDoc(iconsDocRef, {
          instagram: document.getElementById("icon-instagram-input").value.trim(),
          whatsapp: document.getElementById("icon-whatsapp-input").value.trim(),
          tiktok: document.getElementById("icon-tiktok-input").value.trim(),
          telegram: document.getElementById("icon-telegram-input").value.trim(),
          updatedAt: serverTimestamp()
        }).catch(async (error) => {
          // Si el doc no existe aún, lo creamos con setDoc a través de update (lanzará error)
          if (error.code === "not-found") {
            await setDoc(iconsDocRef, {
              instagram: document.getElementById("icon-instagram-input").value.trim(),
              whatsapp: document.getElementById("icon-whatsapp-input").value.trim(),
              tiktok: document.getElementById("icon-tiktok-input").value.trim(),
              telegram: document.getElementById("icon-telegram-input").value.trim(),
              updatedAt: serverTimestamp()
            });
          } else {
            throw error;
          }
        });

        msgEl.textContent = "Íconos actualizados correctamente.";
        // Recargar íconos en la barra lateral
        await loadSocialLinksForSidebar();
      } catch (err) {
        console.error("Error guardando íconos:", err);
        msgEl.textContent = "Error al guardar la configuración de íconos.";
      }
    });

  } catch (error) {
    console.error("Error al renderizar íconos:", error);
    contentArea.innerHTML = "<p>Ocurrió un error al cargar la configuración de íconos.</p>";
  }
}

// --------------------------------------------------
// USUARIOS (ADMIN)
// --------------------------------------------------
async function renderUsersAdmin() {
  const contentArea = getContentArea();
  if (!contentArea) return;

  if (currentRole !== "admin") {
    contentArea.innerHTML = "<p>No tienes permisos para administrar usuarios.</p>";
    return;
  }

  contentArea.innerHTML = "<p>Cargando usuarios...</p>";

  try {
    const usersRef = collection(db, "users");
    const qUsers = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(qUsers);

    let rows = "";

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const username = data.username || "";
      const role = data.role || "";
      const status = data.status || "";
      const expDate = formatDateFromTimestamp(data.expirationDate);

      rows += `
        <tr data-user-id="${docSnap.id}">
          <td>${username}</td>
          <td>${role}</td>
          <td>${status}</td>
          <td>${expDate}</td>
          <td>
            <button class="btn btn-secondary btn-edit-user" data-user-id="${docSnap.id}">Editar</button>
            <button class="btn btn-secondary btn-delete-user" data-user-id="${docSnap.id}">Eliminar</button>
          </td>
        </tr>
      `;
    });

    contentArea.innerHTML = `
      <h2>Usuarios</h2>
      <p>Administra los usuarios que pueden acceder a la plataforma.</p>
      <div style="margin:15px 0;">
        <button class="btn btn-primary" id="btn-add-user">Agregar usuario</button>
      </div>
      <div class="users-table-wrapper" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="border-bottom:1px solid var(--sidebar-border);">
              <th style="text-align:left;padding:8px;">Usuario</th>
              <th style="text-align:left;padding:8px;">Rol</th>
              <th style="text-align:left;padding:8px;">Estado</th>
              <th style="text-align:left;padding:8px;">Fin de acceso</th>
              <th style="text-align:left;padding:8px;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows || "<tr><td colspan='5' style='padding:8px;'>No hay usuarios registrados.</td></tr>"}
          </tbody>
        </table>
      </div>
      <div id="users-msg" class="login-footer-text" style="text-align:left;margin-top:10px;"></div>

      <!-- Contenedor para formulario agregar/editar -->
      <div id="user-form-container" style="margin-top:20px;"></div>
    `;

    const msgEl = document.getElementById("users-msg");
    const addBtn = document.getElementById("btn-add-user");
    const tbody = contentArea.querySelector("tbody");

    addBtn.addEventListener("click", () => {
      renderUserForm(null);
    });

    tbody.querySelectorAll(".btn-edit-user").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-user-id");
        await renderUserForm(userId);
      });
    });

    tbody.querySelectorAll(".btn-delete-user").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-user-id");
        const confirmDelete = confirm("¿Seguro que deseas eliminar este usuario?");
        if (!confirmDelete) return;

        try {
          await deleteDoc(doc(db, "users", userId));
          msgEl.textContent = "Usuario eliminado correctamente.";
          await renderUsersAdmin(); // recargar lista
        } catch (err) {
          console.error("Error eliminando usuario:", err);
          msgEl.textContent = "Error al eliminar usuario.";
        }
      });
    });

  } catch (error) {
    console.error("Error renderizando usuarios:", error);
    contentArea.innerHTML = "<p>Ocurrió un error al cargar los usuarios.</p>";
  }
}

// Formulario agregar / editar usuario
async function renderUserForm(userId) {
  const container = document.getElementById("user-form-container");
  if (!container) return;

  let isEdit = !!userId;
  let formTitle = isEdit ? "Editar usuario" : "Agregar usuario";
  let initialData = {
    username: "",
    password: "",
    role: "estudiante",
    status: "activo",
    expirationDate: ""
  };

  if (isEdit) {
    try {
      const docRef = doc(db, "users", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        initialData.username = data.username || "";
        initialData.password = data.password || "";
        initialData.role = data.role || "estudiante";
        initialData.status = data.status || "activo";
        initialData.expirationDate = formatDateFromTimestamp(data.expirationDate);
      }
    } catch (error) {
      console.error("Error obteniendo usuario:", error);
    }
  }

  container.innerHTML = `
    <h3 style="margin-top:15px;">${formTitle}</h3>
    <form id="user-form" style="margin-top:10px;">
      <div class="form-group">
        <label for="user-username">Usuario</label>
        <input type="text" id="user-username" value="${initialData.username}" required>
      </div>
      <div class="form-group">
        <label for="user-password">Contraseña</label>
        <input type="text" id="user-password" value="${initialData.password}" required>
      </div>
      <div class="form-group">
        <label for="user-role">Rol</label>
        <select id="user-role">
          <option value="admin" ${initialData.role === "admin" ? "selected" : ""}>Administrador</option>
          <option value="estudiante" ${initialData.role === "estudiante" ? "selected" : ""}>Estudiante</option>
        </select>
      </div>
      <div class="form-group">
        <label for="user-status">Estado</label>
        <select id="user-status">
          <option value="activo" ${initialData.status === "activo" ? "selected" : ""}>Activo</option>
          <option value="inactivo" ${initialData.status === "inactivo" ? "selected" : ""}>Inactivo</option>
        </select>
      </div>
      <div class="form-group">
        <label for="user-expiration">Fecha fin de acceso</label>
        <input type="date" id="user-expiration" value="${initialData.expirationDate}">
      </div>
      <div class="login-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? "Guardar cambios" : "Crear usuario"}</button>
        <button type="button" class="btn btn-secondary" id="btn-cancel-user-form">Cancelar</button>
      </div>
      <div id="user-form-msg" class="login-footer-text" style="text-align:left;margin-top:5px;"></div>
    </form>
  `;

  const form = document.getElementById("user-form");
  const msgEl = document.getElementById("user-form-msg");
  const btnCancelForm = document.getElementById("btn-cancel-user-form");

  btnCancelForm.addEventListener("click", () => {
    container.innerHTML = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = isEdit ? "Guardando cambios..." : "Creando usuario...";

    const username = document.getElementById("user-username").value.trim();
    const password = document.getElementById("user-password").value.trim();
    const role = document.getElementById("user-role").value;
    const status = document.getElementById("user-status").value;
    const expirationStr = document.getElementById("user-expiration").value;
    const expirationDate = expirationStr ? parseDateInputToDate(expirationStr) : null;

    if (!username || !password) {
      msgEl.textContent = "Usuario y contraseña son obligatorios.";
      return;
    }

    const payload = {
      username,
      password,
      role,
      status,
      expirationDate: expirationDate ? { seconds: Math.floor(expirationDate.getTime()/1000), nanoseconds: 0 } : null,
      updatedAt: serverTimestamp()
    };

    try {
      if (isEdit) {
        const docRef = doc(db, "users", userId);
        await updateDoc(docRef, payload);
        msgEl.textContent = "Usuario actualizado correctamente.";
      } else {
        await addDoc(collection(db, "users"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        msgEl.textContent = "Usuario creado correctamente.";
      }

      // Recargar tabla de usuarios
      await renderUsersAdmin();
    } catch (error) {
      console.error("Error guardando usuario:", error);
      msgEl.textContent = "Error al guardar el usuario.";
    }
  });
}

// --------------------------------------------------
// EVENTOS DE LA BARRA LATERAL (Usuarios / Íconos)
// --------------------------------------------------
if (menuUsersEl) {
  menuUsersEl.addEventListener("click", async () => {
    clearSidebarActive();
    menuUsersEl.classList.add("active");
    await renderUsersAdmin();
  });
}

if (menuIconsEl) {
  menuIconsEl.addEventListener("click", async () => {
    clearSidebarActive();
    menuIconsEl.classList.add("active");
    await renderIconsAdmin();
  });
}

// --------------------------------------------------
// INIT
// --------------------------------------------------
function init() {
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }
  if (btnCancelar) {
    btnCancelar.addEventListener("click", handleCancelar);
  }

  // Cargar íconos para la barra lateral al inicio
  loadSocialLinksForSidebar();
}

document.addEventListener("DOMContentLoaded", init);
