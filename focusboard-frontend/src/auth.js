
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from "firebase/auth";

import { auth, googleProvider } from "./firebase";

// Google Sign-In
export const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);

    const idToken = await result.user.getIdToken();

    return {
        user: result.user,
        idToken,
    };
};

// Google Sign-Out
export const signOutUser = async () => {
    await signOut(auth);
};

// Observe authentication state
export const observeAuthState = (callback) => {
    return onAuthStateChanged(auth, callback);
};
