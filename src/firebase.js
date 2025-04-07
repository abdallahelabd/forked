// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCvJp9MjJ3CJGDcM1dj2U0LYBCtdc5BBmk",
  authDomain: "abdallahbio-18d4c.firebaseapp.com",
  databaseURL: "https://abdallahbio-18d4c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "abdallahbio-18d4c",
  storageBucket: "abdallahbio-18d4c.firebasestorage.app",
  messagingSenderId: "1059962976137",
  appId: "1:1059962976137:web:5e60b5af318796e4b35358",
  measurementId: "G-GYD479RY6M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
