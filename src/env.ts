import { z } from "zod";

/**
 * Environment contract. Server vars are validated lazily (first access) so
 * `next build` succeeds without secrets, but any request that needs one fails
 * loudly with the missing key named instead of a vague downstream error.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Postgres. DATABASE_URL must be a role WITHOUT bypassrls / table ownership so
  // row-level security is enforced. DATABASE_ADMIN_URL (owner role) is used only
  // by src/db/system.ts for the short list of cross-tenant lookups + migrations.
  DATABASE_URL: z.string().url(),
  DATABASE_ADMIN_URL: z.string().url().optional(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(), // platform (billing) endpoint
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(), // connected-account endpoint
  STRIPE_PRICE_SOLO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_SOLO_YEARLY: z.string().optional(),
  STRIPE_PRICE_STUDIO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STUDIO_YEARLY: z.string().optional(),

  // Secret used to derive per-booking client access tokens (HMAC).
  INTAKE_TOKEN_SECRET: z.string().min(16),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Root domain that tenant subdomains hang off, e.g. "bookedin.co".
  // Locally "localhost:3000" — Chrome resolves *.localhost to 127.0.0.1.
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("localhost:3000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
});

type ServerEnv = z.infer<typeof serverSchema>;
type PublicEnv = z.infer<typeof publicSchema>;

let serverCache: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (serverCache) return serverCache;
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment. Check: ${missing}`);
  }
  serverCache = parsed.data;
  return serverCache;
}

// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
// by their full name — no dynamic lookup.
export const publicEnv: PublicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "pk_test_placeholder",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder",
});
