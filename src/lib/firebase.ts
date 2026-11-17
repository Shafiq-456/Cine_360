// Firebase Web SDK integration for CINE 360 Authentication.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

if (typeof window !== "undefined") {
  try {
    if (isFirebaseConfigured()) {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
    }
  } catch (err) {
    console.warn("Firebase initialization skipped or error:", err);
  }
}

export { auth, googleProvider, onAuthStateChanged, type FirebaseUser };

/** Sign in with Google Popup */
export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

/** Email & Password Login */
export async function loginWithEmail(email: string, pass: string) {
  if (!auth) throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

/** Email & Password Registration */
export async function registerWithEmail(email: string, pass: string, displayName: string) {
  if (!auth) throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // Non-blocking
  }
  return cred.user;
}

/** Send Password Reset Email */
export async function resetPassword(email: string) {
  if (!auth) throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  await sendPasswordResetEmail(auth, email);
}

/** Sign Out */
export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}
