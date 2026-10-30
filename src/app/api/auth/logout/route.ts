import { ok, handler } from "@/lib/api";
import { AUTH_COOKIE } from "@/lib/auth";

export const POST = handler(async () => {
  const res = ok({ loggedOut: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
