import {
  auth,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
} from "./firebase/firebase-config.js";

const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authStatus = document.getElementById("authStatus");
const loginButton = document.getElementById("btnLogin");
const registerButton = document.getElementById("btnRegister");
const themeToggleButton = document.getElementById("themeToggleButton");

function setStatus(message, type = "info") {
  authStatus.textContent = message;
  authStatus.dataset.state = type;
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", normalizedTheme === "dark");
  themeToggleButton.textContent = normalizedTheme === "dark" ? "Modo claro" : "Modo oscuro";
  localStorage.setItem("foxcat-theme", normalizedTheme);
}

async function loginUser(event) {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = "Ingresando...";

  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    setStatus("Autenticacion correcta. Redirigiendo al dashboard...", "success");
    window.location.href = "./FirstView/dashboard.html";
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Iniciar sesion";
  }
}

async function registerUser() {
  registerButton.disabled = true;
  registerButton.textContent = "Creando...";

  try {
    await setPersistence(auth, browserLocalPersistence);
    await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    setStatus("Usuario creado correctamente. Puedes completar tu foto desde el dashboard.", "success");
    window.location.href = "./FirstView/dashboard.html";
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    registerButton.disabled = false;
    registerButton.textContent = "Crear usuario";
  }
}

authForm.addEventListener("submit", loginUser);
registerButton.addEventListener("click", registerUser);
themeToggleButton.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("dark-mode") ? "light" : "dark");
});

applyTheme(localStorage.getItem("foxcat-theme") || "light");

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./FirstView/dashboard.html";
  }
});
