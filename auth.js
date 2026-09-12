/**
 * Bomberos Nueva Imperial — control de acceso a Central.
 *
 * Un solo archivo protege TODAS las páginas de Central (central.html,
 * central2.html, gyras.html, usuarios.html, maquinista.html) más el login
 * en index.html. Se agrega la misma línea a cada página, en el <head>:
 *
 *     <script type="module" src="auth.js"></script>
 *
 * Cómo funciona:
 * - Si no hay sesión: en index.html se muestra un formulario de login encima
 *   de todo; en cualquier otra página, se redirige sola a index.html.
 * - Si hay sesión pero la cuenta no está en la colección "centralistas",
 *   se cierra la sesión y se trata igual que si no hubiera sesión. Esto es
 *   lo que impide que una cuenta de voluntario (número de registro) entre
 *   a Central, aunque comparta el mismo proyecto de Firebase.
 * - Si hay sesión y es centralista: se quita cualquier overlay y se agrega
 *   un botón flotante de "Cerrar sesión".
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-NIM0pbgU2w85mWFhqUEkbA3L0_NrimI",
  authDomain: "despachador-58fb8.firebaseapp.com",
  projectId: "despachador-58fb8",
  storageBucket: "despachador-58fb8.firebasestorage.app",
  messagingSenderId: "1024295745401",
  appId: "1:1024295745401:web:8d49683a86a8b1ff7aa1a8",
};

// Evita inicializar Firebase dos veces si la página ya lo hace en su propio <script>.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ES_LOGIN = /(^|\/)index\.html$/.test(location.pathname) || location.pathname.endsWith("/");

const ID_OVERLAY = "auth-overlay-login";
const ID_BOTON_SALIR = "auth-boton-salir";

function crearOverlayLogin(mensaje) {
  if (document.getElementById(ID_OVERLAY)) return; // ya está mostrado

  const overlay = document.createElement("div");
  overlay.id = ID_OVERLAY;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: #0A1931; display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  overlay.innerHTML = `
    <form id="auth-form-login" style="
      background: #15294B; padding: 32px 28px; border-radius: 14px;
      width: min(90vw, 340px); box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    ">
      <h1 style="color:#fff; font-size:1.15rem; margin:0 0 4px;">Bomberos Nueva Imperial</h1>
      <p style="color:#B9C3D3; font-size:0.85rem; margin:0 0 20px;">Acceso restringido — solo Central</p>

      <label style="color:#B9C3D3; font-size:0.8rem;">Correo</label>
      <input id="auth-email" type="email" required autocomplete="username"
        style="width:100%; box-sizing:border-box; padding:10px; margin:4px 0 14px; border-radius:8px; border:1px solid #2a3f66; background:#0A1931; color:#fff;">

      <label style="color:#B9C3D3; font-size:0.8rem;">Contraseña</label>
      <input id="auth-password" type="password" required autocomplete="current-password"
        style="width:100%; box-sizing:border-box; padding:10px; margin:4px 0 18px; border-radius:8px; border:1px solid #2a3f66; background:#0A1931; color:#fff;">

      <button type="submit" style="
        width:100%; padding:12px; border:none; border-radius:8px;
        background:#0A58CA; color:#fff; font-weight:bold; font-size:0.95rem; cursor:pointer;
      ">Ingresar</button>

      <div id="auth-error" style="color:#ff6b6b; font-size:0.8rem; margin-top:12px; min-height:1em;">${mensaje || ""}</div>
    </form>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  document.getElementById("auth-form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const errorBox = document.getElementById("auth-error");
    errorBox.textContent = "";
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged se encarga de verificar el rol y quitar el overlay.
    } catch (err) {
      errorBox.textContent = "Correo o contraseña incorrectos.";
    }
  });
}

function quitarOverlayLogin() {
  const overlay = document.getElementById(ID_OVERLAY);
  if (overlay) overlay.remove();
  document.body.style.overflow = "";
}

function agregarBotonSalir() {
  if (document.getElementById(ID_BOTON_SALIR)) return;
  const boton = document.createElement("button");
  boton.id = ID_BOTON_SALIR;
  boton.textContent = "Cerrar sesión";
  boton.style.cssText = `
    position: fixed; bottom: 14px; left: 14px; z-index: 99998;
    background: #15294B; color: #B9C3D3; border: 1px solid #2a3f66;
    padding: 8px 14px; border-radius: 8px; font-size: 0.8rem; cursor: pointer;
  `;
  boton.addEventListener("click", () => signOut(auth).then(() => location.reload()));
  document.body.appendChild(boton);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (ES_LOGIN) crearOverlayLogin();
    else location.href = "index.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "centralistas", user.uid));
    if (!snap.exists()) {
      await signOut(auth);
      if (ES_LOGIN) crearOverlayLogin("Esta cuenta no tiene acceso a Central.");
      else location.href = "index.html";
      return;
    }
  } catch (err) {
    console.error("Error verificando el rol de centralista:", err);
    // Si Firestore falla, no dejamos pasar por defecto: mejor negar acceso que dejarlo abierto.
    if (ES_LOGIN) crearOverlayLogin("No se pudo verificar el acceso. Intenta de nuevo.");
    else location.href = "index.html";
    return;
  }

  quitarOverlayLogin();
  agregarBotonSalir();
});
