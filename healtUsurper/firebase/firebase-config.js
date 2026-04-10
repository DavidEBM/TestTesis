import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
//claves configuradas para solo funcionar en https://davidebm.github.io/ 
const firebaseConfig = {
  apiKey: "AIzaSyDyWxP_pouI8on_bCUkI5mrIv6oBmUmdIs",
  authDomain: "testtesis-cc77e.firebaseapp.com",
  projectId: "testtesis-cc77e",
  storageBucket: "testtesis-cc77e.firebasestorage.app",
  messagingSenderId: "883703549641",
  appId: "1:883703549641:web:e980ce9c89a02588980718",
  measurementId: "G-6HDE9J84XP",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  addDoc,
  app,
  auth,
  browserLocalPersistence,
  collection,
  createUserWithEmailAndPassword,
  db,
  deleteDoc,
  doc,
  getDoc,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
  updateProfile,
};
