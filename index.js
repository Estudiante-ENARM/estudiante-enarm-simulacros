/***********************************************
 * ÍNDICE.JS
 * - Iniciar sesión admin/estudiante
 * - Lectura de pantalla principal (Configuración)
 * - Botones de precios -> WhatsApp
 * - Iconos de redes sociales
 ***********************************************/
importar { auth, db } desde "./firebase-config.js";

importar {
  Iniciar sesión con correo electrónico y contraseña,
  enAuthStateChanged,
} de "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

importar {
  doc,
  obtenerDoc,
} de "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/***********************************************
 * CONST / VALORES PREDETERMINADOS
 ***********************************************/
constante DEFAULT_WHATSAPP_PHONE = "+525515656316";
const DEFAULT_MONTHLY_LABEL = "Plan mensual";
const DEFAULT_ENARM_LABEL = "Plan ENARM 2026";

const DEFAULT_MONTHLY_MESSAGE = "Me interesa adquirir el plan mensual";
const DEFAULT_ENARM_MESSAGE = "Me interesa adquirir el plan ENARM 2026";

/***********************************************
 * REFERENCIAS DOM
 ***********************************************/
const emailInput = document.getElementById("correo electrónico de inicio de sesión");
const passwordInput = document.getElementById("contraseña de inicio de sesión");
const loginBtn = document.getElementById("login-btn");
const cancelBtn = document.getElementById("cancelar-inicio-de-sesión-btn");
const errorBox = document.getElementById("error de inicio de sesión");

const landingTextEl = document.getElementById("texto-de-aterrizaje");
const btnPriceMonth = document.getElementById("btn-precio-mes");
const btnPriceFull = document.getElementById("btn-price-full");

const socialIcons = document.querySelectorAll(".icono-social");

/***********************************************
 * ESTADO
 ***********************************************/
deje que currentWhatsAppPhone = DEFAULT_WHATSAPP_PHONE;

/***********************************************
 * UTILIDADES
 ***********************************************/
función showError(msg) {
  si (!errorBox) retorna;
  errorBox.textContent = mensaje;
  errorBox.style.display = "bloque";
}

función clearError() {
  si (!errorBox) retorna;
  errorBox.textContent = "";
  errorBox.style.display = "ninguno";
}

función normalizePhone(teléfono) {
  si (!teléfono) devuelve "";
  devolver teléfono.replace(/[^\d]/g, "");
}

función buildWhatsAppUrl(teléfono, mensaje) {
  const clean = normalizePhone(teléfono || DEFAULT_WHATSAPP_PHONE);
  constante base = `https://wa.me/${clean}`;
  const text = encodeURIComponent(mensaje || "");
  devuelve `${base}?texto=${texto}`;
}

/***********************************************
 * CARGAR LANDING (configuración/landingPage)
 ***********************************************/
función asíncrona loadLandingSettings() {
  si (!landingTextEl || !btnPrecioMes || !btnPrecioCompleto) devolver;

  let landingText = "Plataforma Estudiante ENARM: simulacros tipo ENARM, análisis de tu desempeño y más.";
  deje que monthlyLabel = ETIQUETA_MENSUAL_PREDETERMINADA;
  deje que enarmLabel = DEFAULT_ENARM_LABEL;
  deje que precioMensual = "";
  deje que enarmPrice = "";

  intentar {
    const snap = await getDoc(doc(db, "configuraciones", "landingPage"));
    si (snap.exists()) {
      constante datos = snap.data();

      si (datos.landingText) landingText = datos.landingText;
      si (datos.etiquetaMensual) etiquetaMensual = datos.etiquetaMensual;
      si (datos.enarmLabel) enarmLabel = datos.enarmLabel;

      si (tipo de datos.preciomensual === "número") {
        precioMensual = datos.precioMensual;
      } de lo contrario si (tipo de datos.preciomensual === "cadena") {
        precioMensual = datos.precioMensual;
      }

      si (tipo de datos.enarmPrice === "número") {
        enarmPrice = datos.enarmPrice;
      } de lo contrario si (tipo de datos.enarmPrice === "cadena") {
        enarmPrice = datos.enarmPrice;
      }

      si (datos.whatsappPhone) {
        currentWhatsAppPhone = datos.whatsappPhone;
      }
    }
  } atrapar (err) {
    console.error("Error al leer settings/landingPage:", err);
  }

  landingTextEl.textContent = aterrizajeTexto;

  btnPriceMonth.textContent = Precio mensual
    ? `${etiquetamensual} · $${preciomensual} MXN`
    :etiqueta mensual;

  btnPriceFull.textContent = enarmPrice
    ? `${enarmLabel} · $${enarmPrice} MXN`
    :etiquetaEnarm;
}

/***********************************************
 * CARGAR LINKS DE REDES (configuraciones/socialLinks)
 ***********************************************/
función asíncrona loadSocialLinks() {
  intentar {
    const snap = await getDoc(doc(db, "configuraciones", "socialLinks"));
    si (!snap.existe()) {
      // No pasa nada, solo quedarán sin enlace
      devolver;
    }

    constante datos = snap.data();

    socialIcons.forEach((icono) => {
      const net = icono.conjunto de datos.red;
      si (net && datos[net]) {
        icon.dataset.url = datos[net];
      } demás {
        eliminar icon.dataset.url;
      }
    });
  } atrapar (err) {
    console.error("Error al leer settings/socialLinks:", err);
  }

  socialIcons.forEach((icono) => {
    icon.addEventListener("clic", () => {
      const url = icono.conjunto de datos.url;
      si (!url) {
        alert("El enlace de esta red social aún no se ha configurado.");
        devolver;
      }
      ventana.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

/***********************************************
 * ACCESO
 ***********************************************/
función asíncrona handleLogin() {
  borrarError();

  constante correo electrónico = (emailInput?.valor || "").trim();
  const contraseña = contraseñaInput?.valor || "";

  si (!correo electrónico || !contraseña) {
    showError("Ingresa tu correo y contraseña.");
    devolver;
  }

  intentar {
    const cred = await signInWithEmailAndPassword(auth, correo electrónico, contraseña);
    const usuario = cred.usuario;

    const userDocRef = doc(db, "usuarios", usuario.email);
    constante userSnap = await getDoc(userDocRef);

    si (!userSnap.exists()) {
      showError("Tu usuario no está configurado en la plataforma. Contacta al administrador.");
      devolver;
    }

    constante perfil = userSnap.data();
    const hoy = nueva Fecha().toISOString().slice(0, 10);

    si (perfil.fechadevencimiento && perfil.fechadevencimiento < hoy) {
      showError("Tu acceso ha vencido. Contacta al administrador.");
      devolver;
    }

    si (perfil.estado && perfil.estado !== "activo") {
      showError("Tu usuario está inactivo. Contacta al administrador.");
      devolver;
    }

    const rol = perfil.role;

    si (rol === "admin") {
      si (!skipAutoRedirect) ventana.ubicación.href = "admin.html";
    } demás {
      // Cualquier otro rol válido entra como estudiante
      si (!skipAutoRedirect) ventana.ubicación.href = "estudiante.html";
    }
  } atrapar (err) {
    console.error("Error al iniciar sesión:", err);
    let msg = "No se pudo iniciar sesión. Verifica tus datos.";
    if (err.code === "auth/user-not-found") msg ​​= "Usuario no encontrado.";
    if (err.code === "auth/wrong-password") msg ​​= "Contraseña incorrecta.";
    mostrarError(msg);
  }
}

/***********************************************
 * AUTO-REDIRECCIÓN SI YA ESTÁ LOGUEADO
 ***********************************************/


/***********************************************
 * NAVEGACIÓN: Evitar bucles al usar "Atrás"
 * - Si el usuario llega a index.html por back/gesture, NO redirigir automáticamente.
 ***********************************************/
función esBackForwardNavigation() {
  intentar {
    const navEntries = performance.getEntriesByType("navegación");
    si (navEntries && navEntries.length) {
      devolver navEntries[0].type === "atrás_adelante";
    }
    // Legado de reserva
    rendimiento de retorno?.navegación?.tipo === 2;
  } atrapar {
    devuelve falso;
  }
}

función setupAutoRedirect() {

  onAuthStateChanged(auth, async (usuario) => {
    // Si el usuario llegó aquí por "Atrás" (back/gesture), evita la redirección automática,
    // pero deja que la UI se actualice normalmente.
    const skipAutoRedirect = isBackForwardNavigation();

    si (!usuario) retorna;

    intentar {
      const snap = await getDoc(doc(db, "usuarios", usuario.email));
      si (!snap.exists()) retorna;

      constante perfil = snap.data();
      const hoy = nueva Fecha().toISOString().slice(0, 10);

      si (perfil.fechadevencimiento && perfil.fechadevencimiento < hoy) devolver;
      si (perfil.estado && perfil.estado !== "activo") return;

      const rol = perfil.role;
      si (rol === "admin") {
        si (!skipAutoRedirect) ventana.ubicación.href = "admin.html";
      } demás {
        si (!skipAutoRedirect) ventana.ubicación.href = "estudiante.html";
      }
    } atrapar (err) {
      console.error("Error en la redirección automática:", err);
    }
  });
}

/***********************************************
 * EVENTOS DE BOTONES
 ***********************************************/
función setupEvents() {
  si (loginBtn) {
    loginBtn.addEventListener("clic", (e) => {
      e.preventDefault();
      manejarInicioDeSesión();
    });
  }

  si (cancelarBtn) {
    cancelBtn.addEventListener("clic", (e) => {
      e.preventDefault();
      si (emailInput) emailInput.value = "";
      si (entradaDeContraseña) entradaDeContraseña.valor = "";
      borrarError();
    });
  }

  si (btnPrecioMes) {
    btnPriceMonth.addEventListener("clic", () => {
      const url = buildWhatsAppUrl(currentWhatsAppPhone, MENSAJE_MENSUAL_PREDETERMINADO);
      ventana.open(url, "_blank", "noopener,noreferrer");
    });
  }

  si (btnPrecioCompleto) {
    btnPriceFull.addEventListener("clic", () => {
      constante url = buildWhatsAppUrl(currentWhatsAppPhone, MENSAJE_ENMARCADO_PREDETERMINADO);
      ventana.open(url, "_blank", "noopener,noreferrer");
    });
  }
}

/***********************************************
 * INICIO
 ***********************************************/
(función asíncrona init() {
  eventos de configuración();
  configuraciónAutoRedirect();
  esperar loadLandingSettings();
  esperar loadSocialLinks();
})();
