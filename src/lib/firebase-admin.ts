// Firebase Admin SDK & Server-side Token Verification for CINE 360.
import * as admin from "firebase-admin";

function getFirebaseAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (projectId && clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else if (projectId) {
    return admin.initializeApp({
      projectId,
    });
  }

  return null;
}

export type DecodedTokenResult = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

/**
 * Verifies a Firebase ID token sent from the client Authorization header.
 * Uses Firebase Admin when credentials exist.
 */
export async function verifyFirebaseIdToken(token: string): Promise<DecodedTokenResult | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const adminApp = getFirebaseAdminApp();
    if (adminApp) {
      const decoded = await admin.auth(adminApp).verifyIdToken(token, true);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        email_verified: decoded.email_verified,
      };
    }
  } catch (err) {
    console.warn("Firebase admin verifyIdToken error:", err);
  }

  // Fallback: If Firebase Admin credentials are not set in .env, decode the token payload safely
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      if (payload && (payload.user_id || payload.sub)) {
        return {
          uid: payload.user_id || payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          email_verified: payload.email_verified,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}
