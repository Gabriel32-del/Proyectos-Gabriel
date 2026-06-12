// ==========================================
// IMPORTACIONES OFICIALES SDK FIREBASE MODULAR (ESM)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================
// 🛠️ TU CONFIGURACIÓN REAL DE FIREBASE
// ==========================================
// Reemplaza este objeto con tus datos reales de la consola web de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCGIF5uPgFQiIXeeF9Stkgad38FvFq2zD8",
  authDomain: "proyectos-gabriel.firebaseapp.com",
  projectId: "proyectos-gabriel",
  storageBucket: "proyectos-gabriel.firebasestorage.app",
  messagingSenderId: "580302691165",
  appId: "1:580302691165:web:6ac6f32a658404d506a6b4"
};

// Inicialización de los servicios core de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Email del administrador (Tú, Gabriel)
// Cambia esto por tu cuenta de Google real para que te reconozca como Admin único
const GOOGLE_ADMIN_EMAIL = "gabrielpugliesesantos@gmail.com"; 

// ==========================================
// OBSERVADOR DE SESIÓN CON GUARDADO AUTOMÁTICO DE USUARIOS
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        logTerminal(`Auth: Usuario detectado -> ${user.email}`);
        
        // 1. REGISTRO / ACTUALIZACIÓN AUTOMÁTICA EN FIRESTORE
        try {
            // Referencia al documento del usuario usando su UID único como ID
            const usuarioRef = doc(db, "usuarios", user.uid);
            
            // Payload con la metadata del usuario
            const datosUsuario = {
                uid: user.uid,
                nombre: user.displayName || "Usuario Anónimo",
                email: user.email,
                foto: user.photoURL || "",
                ultimaConexion: new Date().toLocaleString('es-ES'),
                // Si su correo coincide con el tuyo, se le asigna rol ADMIN, si no, USER
                rol: (user.email === GOOGLE_ADMIN_EMAIL || user.displayName?.toLowerCase().includes("gabriel")) ? "ADMIN" : "USER"
            };

            // setDoc con merge:true crea el documento si no existe, o lo actualiza si ya existe
            await setDoc(usuarioRef, datosUsuario, { merge: true });
            logTerminal(`Firestore: Perfil de ${datosUsuario.nombre} sincronizado en la colección 'usuarios'.`);
        } catch (error) {
            logTerminal(`Firestore User Sync Error: ${error.message}`, true);
        }

        // 2. CONTROL DE INTERFAZ (DASHBOARD)
        document.getElementById("display-name").innerText = user.displayName || "Usuario";
        document.getElementById("metric-user-id").innerText = user.uid;
        
        if (user.photoURL) {
            const photoImg = document.getElementById("user-photo");
            photoImg.src = user.photoURL;
            photoImg.style.display = "block";
            document.getElementById("user-avatar-fallback").style.display = "none";
        }

        // Validación visual de privilegios de Administrador
        if (user.email === GOOGLE_ADMIN_EMAIL || user.displayName?.toLowerCase().includes("gabriel")) {
            document.getElementById("admin-badge").style.display = "block";
            document.getElementById("admin-editor-box").style.display = "block";
            logTerminal("Seguridad: Interfaz de Administrador ROOT desbloqueada.");
        } else {
            document.getElementById("admin-badge").style.display = "none";
            document.getElementById("admin-editor-box").style.display = "none";
            logTerminal("Seguridad: Modo visual restringido (Usuario Estándar).");
        }

        document.getElementById("auth-screen").style.display = "none";
        document.getElementById("dashboard-screen").style.display = "flex";
        
        // Activar el muro de noticias en tiempo real
        escucharMuroNoticiasFirestore();

    } else {
        logTerminal("Auth: Esperando autenticación en el nodo cloud...");
        document.getElementById("dashboard-screen").style.display = "none";
        document.getElementById("auth-screen").style.display = "flex";
    }
});

// ==========================================
// CAPTURA DEL RESULTADO DE REDIRECT AL CARGAR LA PÁGINA
// ==========================================
getRedirectResult(auth)
    .then((result) => {
        if (result && result.user) {
            logTerminal(`Auth: Redirect completado. Bienvenido ${result.user.displayName}`);
        }
    })
    .catch((error) => {
        console.error(error);
        const errText = document.getElementById("auth-error-text");
        if (errText) {
            errText.innerText = `Error Auth: ${error.message}`;
            errText.style.display = "block";
        }
        logTerminal(`Error Auth Redirect [${error.code}]: ${error.message}`, true);
    });

// Redirige a Google para autenticar (sin popup)
function iniciarSesionGoogle() {
    const provider = new GoogleAuthProvider();
    logTerminal("Auth: Redirigiendo a la pasarela de autenticación de Google...");
    signInWithRedirect(auth, provider);
}

// Cierre de sesión seguro
function cerrarSesionEcosistema() {
    signOut(auth).then(() => {
        logTerminal("Auth: Sesión destruida en el nodo cloud.");
    });
}

// ==========================================
// MOTOR EN TIEMPO REAL (FIREBASE FIRESTORE)
// ==========================================

// Escucha reactiva usando onSnapshot (se actualiza solo sin refrescar la página)
function escucharMuroNoticiasFirestore() {
    logTerminal("Firestore: Conectando a la colección 'noticias'...");
    
    const coleccionRef = collection(db, "noticias");
    const consultaOrdenada = query(coleccionRef, orderBy("timestamp", "desc"));

    // El estado del indicador superior cambia a activo
    const statusText = document.getElementById("firebase-status-text");
    statusText.innerText = "Conectado a Firestore Live";
    document.getElementById("status-indicator-dot").style.background = "#34a853";

    onSnapshot(consultaOrdenada, (snapshot) => {
        const feedContenedor = document.getElementById("firestore-news-feed");
        if (!feedContenedor) return;
        
        feedContenedor.innerHTML = "";
        logTerminal(`Firestore: Snapshot recibido. Sincronizando ${snapshot.size} documento(s).`);

        if (snapshot.empty) {
            feedContenedor.innerHTML = `<div class="text-muted" style="text-align: center; padding: 2rem;">El muro está vacío. Lanza un comunicado, Gabriel.</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;

            // Verificar si el usuario logueado es admin para habilitar el botón de borrar
            const esAdmin = auth.currentUser?.email === GOOGLE_ADMIN_EMAIL || auth.currentUser?.displayName?.toLowerCase().includes("gabriel");
            const btnEliminarHtml = esAdmin ? `<button class="btn-delete-news" data-id="${docId}">🗑️ Borrar</button>` : '';

            const tarjetaHtml = `
                <div class="news-card" id="card-${docId}">
                    <div class="news-meta">
                        <span>Emitido: <strong>${data.fecha || 'Reciente'}</strong></span>
                        <span class="news-tag-badge">${data.tag || 'GENERAL'}</span>
                    </div>
                    <h3>${data.titulo}</h3>
                    <p class="text-muted" style="margin-top: 0.5rem;">${data.cuerpo}</p>
                    <div style="margin-top: 0.8rem; text-align: right;">
                        ${btnEliminarHtml}
                    </div>
                </div>
            `;
            feedContenedor.innerHTML += tarjetaHtml;
        });

        // Vincular eventos de borrado de forma dinámica debido al tipado module
        document.querySelectorAll(".btn-delete-news").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idDocumento = e.target.getAttribute("data-id");
                eliminarNoticiaFirestore(idDocumento);
            });
        });

    }, (error) => {
        logTerminal(`Firestore Error: No se pudo leer la colección. Verifique las reglas de seguridad. ${error.message}`, true);
        statusText.innerText = "Error de Permisos Cloud";
        document.getElementById("status-indicator-dot").style.background = "#ea4335";
    });
}

// Agregar documentos a Firestore
async function publicarNoticiaFirestore() {
    const titulo = document.getElementById("news-title").value.trim();
    const cuerpo = document.getElementById("news-body").value.trim();
    const tag = document.getElementById("news-tag").value.trim() || "GENERAL";

    if (!titulo || !cuerpo) {
        alert("Gabriel, completa el título y el cuerpo antes de lanzar.");
        return;
    }

    try {
        logTerminal("Firestore: Enviando payload de datos...");
        await addDoc(collection(db, "noticias"), {
            titulo: titulo,
            cuerpo: cuerpo,
            tag: tag.toUpperCase(),
            timestamp: Date.now(),
            fecha: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' })
        });

        // Limpiar inputs
        document.getElementById("news-title").value = "";
        document.getElementById("news-body").value = "";
        document.getElementById("news-tag").value = "";
        logTerminal("Firestore: Transacción completada y escrita con éxito.");

    } catch (error) {
        logTerminal(`Firestore Add Error: ${error.message}`, true);
        alert("Error al guardar. Revisa la terminal de eventos.");
    }
}

// Eliminar documentos de Firestore
async function eliminarNoticiaFirestore(id) {
    if (!confirm("¿Deseas remover este comunicado del servidor de forma permanente?")) return;
    try {
        logTerminal(`Firestore: Removiendo documento ID: ${id}`);
        await deleteDoc(doc(db, "noticias", id));
        logTerminal("Firestore: Documento purgado correctamente.");
    } catch (error) {
        logTerminal(`Firestore Delete Error: ${error.message}`, true);
    }
}

// ==========================================
// INTERFAZ DE USUARIO & NAVEGACIÓN
// ==========================================

function intercambiarSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

function cambiarVistaPestana(e) {
    const boton = e.currentTarget;
    const tabTarget = boton.getAttribute("data-tab");

    document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active"));

    document.getElementById(`view-${tabTarget}`).classList.add("active");
    boton.classList.add("active");

    if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.remove("open");
    }
    logTerminal(`UI: Cambiando enfoque a panel [${tabTarget.toUpperCase()}]`);
}

function logTerminal(mensaje, esError = false) {
    const terminal = document.getElementById("database-console-log");
    if (!terminal) return;
    const item = document.createElement("div");
    item.className = esError ? "log-line log-err" : "log-line";
    item.innerText = `[${new Date().toLocaleTimeString()}] ${mensaje}`;
    terminal.appendChild(item);
    terminal.scrollTop = terminal.scrollHeight;
}

// ==========================================
// ESCUCHADORES DE EVENTOS (EVENT LISTENERS)
// ==========================================
document.getElementById("btn-google-login").addEventListener("click", iniciarSesionGoogle);
document.getElementById("btn-logout").addEventListener("click", cerrarSesionEcosistema);
document.getElementById("btn-hamburger").addEventListener("click", intercambiarSidebar);
document.getElementById("btn-close-sidebar").addEventListener("click", intercambiarSidebar);
document.getElementById("btn-publish-news").addEventListener("click", publicarNoticiaFirestore);
document.getElementById("btn-clear-logs").addEventListener("click", () => {
    document.getElementById("database-console-log").innerHTML = "";
    logTerminal("Consola reiniciada por comando local.");
});

document.querySelectorAll(".menu-item").forEach(btn => {
    btn.addEventListener("click", cambiarVistaPestana);
});