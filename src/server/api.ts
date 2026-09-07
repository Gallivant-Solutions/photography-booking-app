import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * Small conventions for route handlers so every endpoint answers the same way:
 *   { ok: true, data }            2xx
 *   { ok: false, error, issues? } 4xx/5xx
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "Sign in required", "unauthorized");
export const forbidden = () => new ApiError(403, "Not allowed", "forbidden");
export const notFoundError = (what = "Resource") => new ApiError(404, `${what} not found`, "not_found");
export const badRequest = (msg: string) => new ApiError(400, msg, "bad_request");

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: "Invalid input", code: "invalid", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 422 },
    );
  }
  console.error("[api]", err);
  return NextResponse.json({ ok: false, error: "Something went wrong", code: "internal" }, { status: 500 });
}

/** Wrap a handler so thrown ApiError/ZodError become proper responses. */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return fail(e);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
  return schema.parse(body);
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
}
