import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCU9UNzo91gavbX5wGygU5nv3uzBwqkm2w",
    authDomain: "focusboard-pro.firebaseapp.com",
    projectId: "focusboard-pro",
    storageBucket: "focusboard-pro.firebasestorage.app",
    messagingSenderId: "733496075700",
    appId: "1:733496075700:web:0267e58bc515f36b8afee1",
    measurementId: "G-2JCG0P93X5"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore Database
export const db = getFirestore(app);
