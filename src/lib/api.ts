// API helpers: consistent JSON envelopes, error handling, zod parsing, audit logging.
import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { db } from "./db";
import { AuthError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Wraps a route handler with unified error handling. */
export function handler<A extends unknown[]>(
  fn: (req: NextRequest, ...args: A) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: A): Promise<NextResponse> => {
    try {
      return await fn(req, ...args);
    } catch (err: unknown) {
      if (err instanceof AuthError) return fail(err.message, err.status);
      if (err instanceof HttpError) return fail(err.message, err.status);
      const message = err instanceof Error ? err.message : "Unexpected server error";
      console.error("[api]", message);
      return fail("Something went wrong on our side. Please try again.", 500);
    }
  };
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError("Request body must be valid JSON", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path?.join(".") || "";
    throw new HttpError(first ? `${field ? field + ": " : ""}${first.message}` : "Invalid request body", 422);
  }
  return result.data;
}

export async function audit(params: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      actorEmail: params.actorEmail ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      meta: JSON.stringify(params.meta ?? {}),
    },
  });
}
