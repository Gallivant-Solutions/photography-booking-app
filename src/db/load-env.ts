import { config } from "dotenv";

/**
 * Standalone scripts (migrate, seed, rls-check, drizzle-kit) run outside
 * Next.js, so they have to load env files themselves. Same precedence as
 * Next: .env.local wins over .env; existing shell variables win over both.
 */
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
