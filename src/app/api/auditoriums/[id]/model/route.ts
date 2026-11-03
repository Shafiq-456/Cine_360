import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";

// GET /api/auditoriums/[id]/model — 3D model descriptor for the render engine.
// Returns the PUBLISHED uploaded model when present, otherwise the procedural
// demonstration geometry descriptor (clearly labelled as demo geometry).
export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auditorium = await db.auditorium.findUnique({
    where: { id },
    include: {
      models: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!auditorium) throw new HttpError("Auditorium not found", 404);

  const published = auditorium.models[0];
  if (published && published.kind === "UPLOADED" && published.fileUrl) {
    return ok({
      model: {
        kind: "UPLOADED" as const,
        fileUrl: published.fileUrl,
        fileSize: published.fileSize,
        version: published.version,
        nodeMap: JSON.parse(published.nodeMap || "{}"),
        notes: published.notes,
      },
      geometrySource: "UPLOADED",
    });
  }

  return ok({
    model: {
      kind: "PROCEDURAL" as const,
      // Demonstration geometry generated in-browser from layoutConfig —
      // not a scan of the physical hall.
      label: "Procedural demonstration geometry",
      layoutConfig: JSON.parse(auditorium.layoutConfig),
    },
    geometrySource: auditorium.geometrySource === "UPLOADED" ? "UPLOADED" : "PROCEDURAL",
  });
});
