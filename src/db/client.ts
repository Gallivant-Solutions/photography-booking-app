import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/env";
import * as schema from "./schema";

/**
 * Two connections, two trust levels:
 *
 *  - app    → DATABASE_URL, the RLS-bound role. Never exported. Tenant
 *             tables are only reachable through `withTenant()`.
 *  - system → DATABASE_ADMIN_URL (owner role). Exported from ./system.ts
 *             behind a short list of named cross-tenant operations.
 *
 * Both are created lazily on first use so `next build` (and any code path
 * that never touches the database) works without DATABASE_URL set.
 */

export type Db = PostgresJsDatabase<typeof schema>;
export type TenantTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const g = globalThis as unknown as { __appDb?: Db; __systemDb?: Db };

function connect(url: string) {
  return postgres(url, {
    max: 5,
    // Transaction-mode poolers (pgbouncer / Neon pooled / Supabase pooler) don't
    // support named prepared statements.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

function appDb(): Db {
  if (!g.__appDb) g.__appDb = drizzle({ client: connect(serverEnv().DATABASE_URL), schema, casing: "snake_case" });
  return g.__appDb;
}

/** Internal: the owner-role connection. Only ./system.ts calls this. */
export function _systemDb(): Db {
  if (!g.__systemDb) {
    const env = serverEnv();
    if (!env.DATABASE_ADMIN_URL && env.NODE_ENV === "production") {
      console.warn(
        "[db] DATABASE_ADMIN_URL is not set; system queries are using DATABASE_URL. " +
          "If that role owns the tables, RLS is NOT being enforced for app queries. Run `npm run db:rls-check`.",
      );
    }
    g.__systemDb = drizzle({ client: connect(env.DATABASE_ADMIN_URL ?? env.DATABASE_URL), schema, casing: "snake_case" });
  }
  return g.__systemDb;
}

/**
 * Run `fn` inside a transaction scoped to one tenant. `set_config(..., true)`
 * is transaction-local, so the value can't leak to another request that
 * reuses the pooled connection. Every tenant-table query goes through here.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error("withTenant: invalid tenant id");
  return appDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
