import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, sessionCookieOptions, AUTH_COOKIE, type SessionUser } from "@/lib/auth";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { ROLES, type Role } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    const body = await req.json().catch(() => ({}));
    if (!token && body.idToken) {
      token = body.idToken;
    }

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing Firebase ID token" }, { status: 400 });
    }

    const decoded = await verifyFirebaseIdToken(token);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ ok: false, error: "Invalid or expired Firebase ID token" }, { status: 401 });
    }

    const email = decoded.email ? decoded.email.toLowerCase().trim() : `${decoded.uid}@firebase.cine360`;
    const name = body.name || decoded.name || email.split("@")[0] || "Cinema Fan";
    const phone = body.phone || null;
    const photoUrl = decoded.picture || null;

    // Find user by firebaseUid or email
    let user = await db.user.findFirst({
      where: {
        OR: [
          { firebaseUid: decoded.uid },
          { email: email },
        ],
      },
    });

    if (user) {
      // Update existing user with firebaseUid if not present
      if (!user.firebaseUid || user.firebaseUid !== decoded.uid) {
        user = await db.user.update({
          where: { id: user.id },
          data: {
            firebaseUid: decoded.uid,
            name: user.name || name,
            photoUrl: photoUrl || user.photoUrl,
            phone: phone || user.phone,
          },
        });
      }
    } else {
      // Create new user linked to Firebase UID
      user = await db.user.create({
        data: {
          firebaseUid: decoded.uid,
          email,
          name,
          phone,
          photoUrl,
          role: ROLES.CUSTOMER,
          status: "ACTIVE",
        },
      });
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    };

    const sessionJwt = await signToken(sessionUser);
    const res = NextResponse.json({ ok: true, user: sessionUser });
    res.cookies.set(AUTH_COOKIE, sessionJwt, sessionCookieOptions());
    return res;
  } catch (error) {
    console.error("Firebase sync error:", error);
    return NextResponse.json({ ok: false, error: "Authentication sync failed" }, { status: 500 });
  }
}
