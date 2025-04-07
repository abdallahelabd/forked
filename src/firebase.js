// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsQCz6d18CZtZQKD1NH2rNzrjiiwqLThM",
  authDomain: "abdallah-bio.firebaseapp.com",
  projectId: "abdallah-bio",
  storageBucket: "abdallah-bio.firebasestorage.app",
  messagingSenderId: "598789674277",
  appId: "1:598789674277:web:18c136dd37f03b2f6a76cc",
  measurementId: "G-88CM5NQ696"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
