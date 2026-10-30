import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/audit-logs?entity=&take=
export const GET = handler(async (req: NextRequest) => {
  await requireAuth(["ADMIN"]);
  const entity = req.nextUrl.searchParams.get("entity") || undefined;
  const take = Math.min(Number(req.nextUrl.searchParams.get("take") || 80), 200);
  const logs = await db.auditLog.findMany({
    where: entity ? { entity } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  return ok({ logs });
});
