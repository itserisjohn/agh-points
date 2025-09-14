// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCqx67vvi34eXcizlT8mfZZQ-90eDM6n54",
  authDomain: "agh-points-system.firebaseapp.com",
  databaseURL:
    "https://agh-points-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agh-points-system",
  storageBucket: "agh-points-system.firebasestorage.app",
  messagingSenderId: "61682369797",
  appId: "1:61682369797:web:d56f211a56a4bd76f6e36c",
};

let app, database;
let isDemoMode = false;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  console.log("Connected to Firebase successfully!");
} catch (error) {
  console.error("Firebase connection error:", error);
  isDemoMode = true;
}

export { database, isDemoMode };
