// Firebase Web SDK integration for CINE 360 Authentication.
// Connects to the shared Jedu-AI Firebase project via the CINE 360 Web Application.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";

const getEnv = (nextKey: string, viteKey: string): string => {
  if (typeof process !== "undefined" && process.env) {
    return process.env[nextKey] || process.env[viteKey] || "";
  }
  return "";
};

const firebaseConfig = {
  apiKey: getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "VITE_FIREBASE_MEASUREMENT_ID"),
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
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
      // Ensure persistent sessions across browser restarts & reloads
      setPersistence(auth, browserLocalPersistence).catch((e) => {
        console.warn("Could not set browserLocalPersistence:", e);
      });
    }
  } catch (err) {
    console.warn("Firebase initialization skipped or error:", err);
  }
}

export { auth, googleProvider, onAuthStateChanged, type FirebaseUser };

/**
 * Sign in with Google using popup, with automatic redirect fallback
 * if popups are blocked by Safari or strict browser policies.
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  }
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (error: any) {
    // If popup was blocked or closed by the user, attempt redirect fallback
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      console.info("Popup blocked or closed; initiating signInWithRedirect fallback…");
      await signInWithRedirect(auth, googleProvider);
      // Will redirect away from page
      throw new Error("Redirecting to Google Sign-In…");
    }
    throw error;
  }
}

/** Check redirect result after returning from signInWithRedirect */
export async function checkRedirectResult(): Promise<FirebaseUser | null> {
  if (!auth) return null;
  try {
    const res = await getRedirectResult(auth);
    return res ? res.user : null;
  } catch (err) {
    console.warn("checkRedirectResult error:", err);
    return null;
  }
}

/** Email & Password Login */
export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  }
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

/** Email & Password Registration */
export async function registerWithEmail(email: string, pass: string, displayName: string): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  }
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
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
export async function resetPassword(email: string): Promise<void> {
  if (!auth) {
    throw new Error("Firebase Authentication is not configured yet. Please configure your Firebase environment variables in .env.");
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/** Sign Out */
export async function logoutFirebase(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem("c360_fb_token");
    sessionStorage.removeItem("c360_fb_token");
  }
}
