import "../src/db/load-env";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

/**
 * `npm run db:rls-check`
 *
 * Proves, against the real database, that the role behind DATABASE_URL cannot
 * read across tenants. Creates two throwaway tenants with the admin connection,
 * then as the app role:
 *   1. with app.tenant_id = A  → sees A's booking, not B's
 *   2. with no app.tenant_id   → sees nothing
 *   3. with app.tenant_id = A  → cannot insert a row for B (WITH CHECK)
 * Fails loudly if the app role is a superuser, has BYPASSRLS, or owns the tables.
 */
async function main() {
  const appUrl = process.env.DATABASE_URL;
  const adminUrl = process.env.DATABASE_ADMIN_URL ?? appUrl;
  if (!appUrl) throw new Error("DATABASE_URL is required");

  const admin = drizzle({ client: postgres(adminUrl!, { max: 1, prepare: false }), schema, casing: "snake_case" });
  const app = drizzle({ client: postgres(appUrl, { max: 1, prepare: false }), schema, casing: "snake_case" });

  const failures: string[] = [];
  const note = (ok: boolean, msg: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
    if (!ok) failures.push(msg);
  };

  // role facts
  const roleRows = await app.execute<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    sql`select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
  );
  const role = roleRows[0]!;
  note(!role.rolsuper, `app role "${role.rolname}" is not a superuser`);
  note(!role.rolbypassrls, `app role "${role.rolname}" does not have BYPASSRLS`);
  const ownerRows = await app.execute<{ owner: string }>(
    sql`select pg_get_userbyid(relowner) as owner from pg_class where relname = 'bookings'`,
  );
  note(ownerRows[0]?.owner !== role.rolname, `app role does not own the tables (owner: ${ownerRows[0]?.owner})`);

  // fixtures (admin)
  const stamp = Date.now().toString(36);
  const [a] = await admin.insert(schema.tenants).values({ slug: `rls-a-${stamp}`, name: "RLS A" }).returning();
  const [b] = await admin.insert(schema.tenants).values({ slug: `rls-b-${stamp}`, name: "RLS B" }).returning();
  const mk = async (t: schema.Tenant) =>
    admin.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${t.id}, true)`);
      const [form] = await tx.insert(schema.intakeForms).values({ tenantId: t.id }).returning();
      await tx.insert(schema.bookings).values({ tenantId: t.id, formId: form!.id, accessTokenHash: "x", clientName: t.name });
      return form!.id;
    });
  const formA = await mk(a!);
  const formB = await mk(b!);

  try {
    // 1. scoped read
    const scoped = await app.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${a!.id}, true)`);
      return tx.select({ name: schema.bookings.clientName }).from(schema.bookings);
    });
    note(scoped.length === 1 && scoped[0]!.name === "RLS A", `tenant A sees only its own booking (saw ${scoped.length})`);

    // 2. unscoped read
    const unscoped = await app.select({ id: schema.bookings.id }).from(schema.bookings);
    note(unscoped.length === 0, `no tenant set → zero rows (saw ${unscoped.length})`);

    // 3. cross-tenant write
    let blocked = false;
    try {
      await app.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${a!.id}, true)`);
        await tx.insert(schema.bookings).values({ tenantId: b!.id, formId: formB, accessTokenHash: "x" });
      });
    } catch {
      blocked = true;
    }
    note(blocked, "tenant A cannot insert a row for tenant B");

    // 4. tenants table itself
    const tenantsSeen = await app.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${a!.id}, true)`);
      return tx.select({ id: schema.tenants.id }).from(schema.tenants);
    });
    note(tenantsSeen.length === 1 && tenantsSeen[0]!.id === a!.id, "tenant A sees only its own tenant row");

    // 5. stripe_events is off-limits to the app role
    let eventsBlocked = false;
    try {
      await app.select().from(schema.stripeEvents).limit(1);
    } catch {
      eventsBlocked = true;
    }
    note(eventsBlocked, "app role cannot read stripe_events");
    void formA;
  } finally {
    await admin.delete(schema.tenants).where(eq(schema.tenants.id, a!.id));
    await admin.delete(schema.tenants).where(eq(schema.tenants.id, b!.id));
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed. RLS is NOT enforced for DATABASE_URL.`);
    process.exit(1);
  }
  console.log("\nAll RLS checks passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
