import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handler, audit, parseBody, HttpError } from "@/lib/api";
import { requireOwner, assertAuditoriumAccess } from "@/lib/owner";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const GLB_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/owner/auditoriums/[id]/model — upload a GLB/glTF auditorium model.
 * Safe upload: extension whitelist, size cap, GLB magic-byte sniffing,
 * deterministic filename (no user-controlled path), served from /uploads/models.
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  await assertAuditoriumAccess(user, id);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError("Attach a .glb or .gltf file in the 'file' field", 422);
  if (!/\.(glb|gltf)$/i.test(file.name)) return fail("Only .glb / .gltf files are accepted", 415);
  if (file.size > GLB_MAX_BYTES) return fail("Model exceeds the 25 MB limit", 413);

  const buf = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".glb")) {
    const magic = buf.subarray(0, 4).toString("ascii");
    if (magic !== "glTF") return fail("File is not a valid GLB binary (magic bytes missing)", 415);
  } else {
    const head = buf.subarray(0, 512).toString("utf8");
    if (!head.includes("glTF") && !head.includes("asset")) {
      return fail("File does not look like a valid glTF document", 415);
    }
  }

  const dir = path.join(process.cwd(), "public", "uploads", "models");
  mkdirSync(dir, { recursive: true });
  const safeName = `${id}-v${Date.now()}.glb`;
  writeFileSync(path.join(dir, safeName), buf);

  const last = await db.auditoriumModel.findFirst({ where: { auditoriumId: id }, orderBy: { version: "desc" } });
  const model = await db.auditoriumModel.create({
    data: {
      auditoriumId: id,
      kind: "UPLOADED",
      fileUrl: `/uploads/models/${safeName}`,
      fileSize: file.size,
      nodeMap: "{}",
      status: "DRAFT",
      version: (last?.version || 0) + 1,
      notes: `Uploaded ${file.name}`,
    },
  });
  await audit({ actorId: user.id, actorEmail: user.email, action: "MODEL_UPLOADED", entity: "AuditoriumModel", entityId: model.id, meta: { auditoriumId: id, bytes: file.size } });
  return ok({ model }, { status: 201 });
});

const patchSchema = z.object({
  modelId: z.string().min(5),
  nodeMap: z.record(z.string(), z.string()).optional(), // rowLabel -> nodePrefix
  publish: z.boolean().optional(),
});

// PATCH /api/owner/auditoriums/[id]/model — save row→node mapping and/or publish
export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  await assertAuditoriumAccess(user, id);
  const body = await parseBody(req, patchSchema);

  const model = await db.auditoriumModel.findFirst({ where: { id: body.modelId, auditoriumId: id } });
  if (!model) throw new HttpError("Model not found for this auditorium", 404);

  if (body.nodeMap) {
    await db.auditoriumModel.update({ where: { id: model.id }, data: { nodeMap: JSON.stringify(body.nodeMap) } });
  }

  let published = false;
  if (body.publish) {
    const map = body.nodeMap ? body.nodeMap : JSON.parse(model.nodeMap);
    const physicalSeats = await db.seat.findMany({ where: { auditoriumId: id }, distinct: ["rowLabel"] });
    const rowLabels = physicalSeats.map((s) => s.rowLabel);
    const unmapped = rowLabels.filter((r) => !map[r]);
    if (unmapped.length > 0) {
      return fail(`Cannot publish: rows not mapped to model nodes: ${unmapped.join(", ")}`, 422);
    }
    if (model.kind === "PROCEDURAL") {
      await db.auditoriumModel.update({ where: { id: model.id }, data: { status: "PUBLISHED" } });
    } else {
      // unpublish previous, publish this
      await db.auditoriumModel.updateMany({ where: { auditoriumId: id, status: "PUBLISHED" }, data: { status: "DRAFT" } });
      await db.auditoriumModel.update({ where: { id: model.id }, data: { status: "PUBLISHED" } });
      await db.auditorium.update({ where: { id }, data: { geometrySource: "UPLOADED" } });
    }
    published = true;
    await audit({ actorId: user.id, actorEmail: user.email, action: "MODEL_PUBLISHED", entity: "AuditoriumModel", entityId: model.id, meta: { auditoriumId: id } });
  }

  return ok({ saved: true, published });
});
