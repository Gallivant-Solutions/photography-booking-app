import "./src/db/load-env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  casing: "snake_case",
  dbCredentials: {
    // Migrations run as the owner role.
    url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "postgres://localhost:5432/bookedin",
  },
  strict: true,
  verbose: true,
});
