import { ZodError } from "zod";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Check the form";
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
