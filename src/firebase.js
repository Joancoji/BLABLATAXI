 // src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBTj-6jAsBK1LbUCoBeH4xCI4oZ4IAf-uQ",
  authDomain: "blablataxi-2781a.firebaseapp.com",
  projectId: "blablataxi-2781a",
  storageBucket: "blablataxi-2781a.firebasestorage.app",
  messagingSenderId: "643500447957",
  appId: "1:643500447957:web:f0305bae2b21695e016a5c",
  measurementId: "G-10GCH0T819"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
