import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Importamos signInWithPopup para evitar los bloqueos de URLs de redirección
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ==========================================
// CONFIGURACIÓN DE TU INSTANCIA FIREBASE
// ==========================================
// ⚠️ REEMPLAZÁ ESTOS DATOS CON LOS DE TU PROYECTO REAL
const firebaseConfig = {
    apiKey: "AIzaSyCGIF5uPgFQiIXeeF9Stkgad38FvFq2zD8",
  authDomain: "proyectos-gabriel.firebaseapp.com",
  projectId: "proyectos-gabriel",
  storageBucket: "proyectos-gabriel.firebasestorage.app",
  messagingSenderId: "580302691165",
  appId: "1:580302691165:web:6ac6f32a658404d506a6b4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==========================================
// CONFIGURACIÓN DEL PROVEEDOR OAUTH (GOOGLE)
// ==========================================
const provider = new GoogleAuthProvider();

provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

window.usuarioActivo = null;
window.oauthAccessToken = null; 

// ==========================================
// ESCUCHADOR EN TIEMPO REAL DEL ESTADO AUTH
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.usuarioActivo = { 
            username: user.displayName || "Usuario Blade",
            email: user.email,
            photo: user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=Gabriel"
        };
        await levantarDashboard();
    } else {
        window.usuarioActivo = null;
        window.oauthAccessToken = null;
        if (document.getElementById('dashboard-view')) {
            document.getElementById('dashboard-view').style.display = 'none';
        }
        if (document.getElementById('login-view')) {
            document.getElementById('login-view').style.display = 'flex';
        }
    }
});

// ==========================================
// ACCESO CON POPUP (EVITA REDIRECT_URI_MISMATCH)
// ==========================================
window.procesarLoginGoogle = function() {
    if (typeof window.registrarActividad === "function") {
        window.registrarActividad("Abriendo ventana de autorización OAuth 2.0...");
    }
    
    signInWithPopup(auth, provider)
        .then((result) => {
            if (result) {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                window.oauthAccessToken = credential.accessToken;
                
                if (typeof window.registrarActividad === "function") {
                    window.registrarActividad("Token OAuth 2.0 capturado exitosamente.");
                }
                console.log("OAuth Access Token Activo:", window.oauthAccessToken);
            }
        })
        .catch((error) => {
            console.error("Error en el login por Popup:", error);
            if (typeof window.mostrarNotificacion === "function") {
                window.mostrarNotificacion("Error al iniciar sesión con la ventana flotante.", "error");
            }
        });
};

window.procesarLogout = function() {
    if (typeof window.registrarActividad === "function") {
        window.registrarActividad("Cerrando credenciales...");
    }
    signOut(auth).then(() => {
        if (typeof window.mostrarNotificacion === "function") {
            window.mostrarNotificacion("Sesión cerrada correctamente.", "success");
        }
    }).catch((error) => {
        console.error("Error al cerrar sesión:", error);
    });
};

// ==========================================
// INICIALIZACIÓN DEL ENTORNO PRINCIPAL
// ==========================================
async function levantarDashboard() {
    if (document.getElementById('login-view')) document.getElementById('login-view').style.display = 'none';
    if (document.getElementById('dashboard-view')) document.getElementById('dashboard-view').style.display = 'block';
    
    if (document.getElementById('nav-username')) document.getElementById('nav-username').innerText = window.usuarioActivo.username;
    if (document.getElementById('profile-user-title')) document.getElementById('profile-user-title').innerText = window.usuarioActivo.username;
    
    if(window.usuarioActivo.photo && document.getElementById('nav-avatar')) {
        document.getElementById('nav-avatar').src = window.usuarioActivo.photo;
    }

    if (typeof window.registrarActividad === "function") {
        window.registrarActividad(`Token asignado al nodo: ${window.usuarioActivo.email}`);
    }
    
    await window.recargarMuroManual();
    await cargarAnunciosFirebase();
}

// ==========================================
// INTEGRACIÓN FIRESTORE CLOUD
// ==========================================
window.recargarMuroManual = async function() {
    const contenedor = document.getElementById('community-wall-container');
    if (!contenedor) return;
    contenedor.innerHTML = `<div style="text-align:center; padding:20px; font-size:0.85rem; color:var(--text-muted);">Sincronizando Muro...</div>`;

    try {
        const q = query(collection(db, "posts"), orderBy("fecha", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        
        contenedor.innerHTML = "";
        
        if (querySnapshot.empty) {
            contenedor.innerHTML = `<div style="text-align:center; padding:30px; font-size:0.85rem; color:var(--text-muted);">No hay publicaciones activas.</div>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const nuevoPost = document.createElement('div');
            nuevoPost.className = 'post-node';
            
            const btnId = `wa-${doc.id}`;

            nuevoPost.innerHTML = `
                <div class="post-node-header">
                    <span class="post-node-author">👤 ${data.autor}</span>
                    <span class="post-node-tag">${data.tag ? data.tag : 'GENERAL'}</span>
                </div>
                <p></p>
                <div class="post-actions-footer">
                    <button class="btn-whatsapp-share" id="${btnId}">
                        💬 Mandar a WhatsApp
                    </button>
                </div>
            `;
            
            nuevoPost.querySelector('p').innerText = data.contenido;
            contenedor.appendChild(nuevoPost);

            const btnSms = document.getElementById(btnId);
            if(btnSms) {
                btnSms.addEventListener('click', () => {
                    window.compartirWhatsApp(data.contenido);
                });
            }
        });
        if (typeof window.registrarActividad === "function") window.registrarActividad("Muro descargado de Firebase.");
    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `<div class="post-node" style="border-left: 4px solid var(--orange-primary);"><p style="color:var(--orange-primary); font-size: 0.85rem;">Vista previa local activa. Añadí tus credenciales reales en 'firebaseConfig' para activar la sincronización cloud.</p></div>`;
    }
};

window.publicarNuevoPost = async function() {
    const textInput = document.getElementById('post-text-input');
    if (!textInput) return;
    const contenido = textInput.value.trim();
    const tagSelect = document.getElementById('post-tag-select');
    const tag = tagSelect ? tagSelect.value : "GENERAL";

    if (!contenido) {
        if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion("Por favor escribe un mensaje antes de publicar.", "error");
        return;
    }

    try {
        await addDoc(collection(db, "posts"), {
            autor: window.usuarioActivo ? window.usuarioActivo.username : "Invitado",
            contenido: contenido,
            tag: tag,
            fecha: Date.now()
        });

        textInput.value = "";
        if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion("¡Publicación enviada a Firestore Cloud!", "success");
        await window.recargarMuroManual();
    } catch (error) {
        const contenedor = document.getElementById('community-wall-container');
        if(contenedor && contenedor.innerHTML.includes("Vista previa")) contenedor.innerHTML = "";
        
        if (contenedor) {
            const idLocal = "local-" + Date.now();
            const nuevoPost = document.createElement('div');
            nuevoPost.className = 'post-node';
            nuevoPost.innerHTML = `
                <div class="post-node-header">
                    <span class="post-node-author">👤 ${window.usuarioActivo ? window.usuarioActivo.username : 'Invitado'} (Local)</span>
                    <span class="post-node-tag">${tag.toUpperCase()}</span>
                </div>
                <p></p>
                <div class="post-actions-footer">
                    <button class="btn-whatsapp-share" id="${idLocal}">
                        💬 Mandar a WhatsApp
                    </button>
                </div>
            `;
            
            nuevoPost.querySelector('p').innerText = contenido;
            contenedor.insertBefore(nuevoPost, contenedor.firstChild);
            
            const btnLocal = document.getElementById(idLocal);
            if(btnLocal) {
                btnLocal.addEventListener('click', () => {
                    window.compartirWhatsApp(contenido);
                });
            }
        }

        textInput.value = "";
        if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion("Publicado localmente (Modo offline activo).", "info");
    }
};

window.compartirWhatsApp = function(texto) {
    const mensajeFormateado = encodeURIComponent(`*🚨 [ProjectBlade Hub]* \n\n${texto}`);
    const urlWhatsApp = `https://api.whatsapp.com/send?text=${mensajeFormateado}`;
    window.open(urlWhatsApp, '_blank');
};

async function cargarAnunciosFirebase() {
    const container = document.getElementById('news-container');
    if (!container) return;
    try {
        const q = query(collection(db, "anuncios"), orderBy("fecha", "desc"), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            snap.forEach(doc => {
                container.innerHTML = `<div class="announcement-item"><strong>⚡ ${doc.data().titulo}:</strong> ${doc.data().contenido}</div>`;
            });
        } else {
            container.innerHTML = `<div class="announcement-item">No hay anuncios fijados globales.</div>`;
        }
    } catch(e) {
        if(window.usuarioActivo) {
            container.innerHTML = `<div class="announcement-item">🔥 ¡Bienvenido, ${window.usuarioActivo.username}! Flujo OAuth establecido correctamente.</div>`;
        }
    }
}

window.publicarAnuncioFirebase = async function() {
    const titleEl = document.getElementById('admin-news-title');
    const contentEl = document.getElementById('admin-news-content');
    if(!titleEl || !contentEl) return;
    
    const titulo = titleEl.value.trim();
    const contenido = contentEl.value.trim();

    if(!titulo || !contenido) {
        if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion("Complete todos los campos del formulario.", "error");
        return;
    }

    try {
        await addDoc(collection(db, "anuncios"), { titulo, contenido, fecha: Date.now() });
        window.cerrarModal('modal-anuncio');
        if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion("Anuncio anclado en la nube.", "success");
        await cargarAnunciosFirebase();
    } catch(e) {
        const container = document.getElementById('news-container');
        if(container) container.innerHTML = `<div class="announcement-item"><strong>📢 ${titulo}:</strong> ${contenido}</div>`;
        window.cerrarModal('modal-anuncio');
        if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion("Anuncio fijado de forma local.", "info");
    }
};

// ==========================================
// FUNCIONES GENERALES DEL DASHBOARD (INTERFAZ)
// ==========================================
window.limpiarMuroLocal = function() {
    const contenedor = document.getElementById('community-wall-container');
    if (contenedor) contenedor.innerHTML = `<div style="text-align:center; padding:20px; font-size:0.85rem; color:var(--text-muted);">Muro despejado en memoria local.</div>`;
};

window.cambiarPestana = function(idTab) {
    document.querySelectorAll('.app-tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${idTab}`);
    const targetBtn = document.getElementById(`btn-tab-${idTab}`);
    if (targetTab) targetTab.style.display = 'block';
    if (targetBtn) targetBtn.classList.add('active');
};

window.registrarActividad = function(mensaje) {
    const list = document.getElementById('activity-log-list');
    if(list) {
        const item = document.createElement('li');
        item.innerText = mensaje;
        list.appendChild(item);
    }
};

window.mostrarNotificacion = function(mensaje, tipo = "info") {
    const modalAlert = document.getElementById('modal-alert');
    const modalTitle = document.getElementById('modal-alert-title');
    const modalMessage = document.getElementById('modal-alert-message');
    const modalIcon = document.getElementById('modal-alert-icon');
    
    if (!modalAlert || !modalMessage) return;
    modalMessage.innerText = mensaje;
    
    if (tipo === "error") {
        if(modalIcon) modalIcon.innerText = "❌"; 
        if(modalTitle) modalTitle.innerText = "Error del Sistema";
    } else if (tipo === "success") {
        if(modalIcon) modalIcon.innerText = "💥"; 
        if(modalTitle) modalTitle.innerText = "Completado";
    } else {
        if(modalIcon) modalIcon.innerText = "🔥"; 
        if(modalTitle) modalTitle.innerText = "Aviso Blade";
    }
    modalAlert.style.display = 'flex';
};

window.mostrarModal = function(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
window.cerrarModal = function(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
