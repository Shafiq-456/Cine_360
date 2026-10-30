import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const patchSchema = z.object({
  commissionPercent: z.number().min(0).max(30),
});

// GET /api/admin/settings
export const GET = handler(async () => {
  await requireAuth(["ADMIN"]);
  const settings = await db.setting.findMany();
  return ok({ settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
});

// PATCH /api/admin/settings — platform commission
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAuth(["ADMIN"]);
  const body = await parseBody(req, patchSchema);
  await db.setting.upsert({
    where: { key: "platform.commissionPercent" },
    update: { value: String(body.commissionPercent) },
    create: { key: "platform.commissionPercent", value: String(body.commissionPercent) },
  });
  await audit({ actorId: admin.id, actorEmail: admin.email, action: "SETTINGS_UPDATED", entity: "Setting", entityId: "platform.commissionPercent", meta: body });
  return ok({ commissionPercent: body.commissionPercent });
});
