import { ok, handler } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const GET = handler(async () => {
  const session = await getSession();
  return ok({ user: session });
});
