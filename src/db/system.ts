import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { _systemDb, withTenant, type Db } from "./client";
import { DEFAULT_CLAUSE_SELECTION } from "@/server/clauses";
import {
  contractClauses,
  intakeForms,
  memberships,
  packages,
  questions,
  stripeEvents,
  tenants,
  type Membership,
  type Tenant,
} from "./schema";

/**
 * The ONLY module allowed to use the owner-role connection. Every function here
 * is a cross-tenant lookup that happens *before* a tenant is known, or a system
 * write (webhook log, tenant creation). Keep this list short and boring.
 */

// Lazy so importing this module never opens a connection (build-time safe).
const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = _systemDb() as unknown as Record<PropertyKey, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return row ?? null;
}

export async function findTenantByCustomDomain(host: string): Promise<Tenant | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.customDomain, host)).limit(1);
  return row ?? null;
}

export async function findTenantByStripeAccount(accountId: string): Promise<Tenant | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.stripeAccountId, accountId)).limit(1);
  return row ?? null;
}

export async function findTenantByStripeCustomer(customerId: string): Promise<Tenant | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.stripeCustomerId, customerId)).limit(1);
  return row ?? null;
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const [row] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return !row;
}

export async function findMembershipsForUser(
  clerkUserId: string,
): Promise<Array<{ membership: Membership; tenant: Tenant }>> {
  const rows = await db
    .select({ membership: memberships, tenant: tenants })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.clerkUserId, clerkUserId))
    .orderBy(memberships.createdAt);
  return rows;
}

export async function assertMembership(clerkUserId: string, tenantId: string): Promise<Membership | null> {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.clerkUserId, clerkUserId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

/**
 * Create a studio with the defaults the design promises: four questions, two
 * packages, a full contract, 25% deposit. A photographer who changes nothing
 * still ends up with a publishable link.
 */
export async function createTenantWithDefaults(input: {
  clerkUserId: string;
  name: string;
  slug: string;
  tagline?: string | null;
}): Promise<Tenant> {
  const tenant = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.name, slug: input.slug, tagline: input.tagline ?? null })
      .returning();
    if (!tenant) throw new Error("tenant insert returned nothing");
    await tx.insert(memberships).values({ tenantId: tenant.id, clerkUserId: input.clerkUserId, role: "owner" });
    return tenant;
  });

  // Defaults are written through the tenant-scoped path on purpose: it proves
  // the RLS policies accept the new tenant before anyone relies on it.
  await withTenant(tenant.id, async (tx) => {
    const [form] = await tx.insert(intakeForms).values({ tenantId: tenant.id }).returning();
    if (!form) throw new Error("form insert returned nothing");

    await tx.insert(questions).values([
      { tenantId: tenant.id, formId: form.id, position: 1, kind: "contact", title: "Who are you?", subtitle: "Name · email · phone" },
      { tenantId: tenant.id, formId: form.id, position: 2, kind: "shoot", title: "What are we shooting?", subtitle: "Shoot type · package & price" },
      { tenantId: tenant.id, formId: form.id, position: 3, kind: "schedule", title: "When and where?", subtitle: "Date or a rough window · location" },
      { tenantId: tenant.id, formId: form.id, position: 4, kind: "notes", title: "Anything I should know?", subtitle: "Long answer · optional", required: false },
    ]);

    await tx.insert(packages).values([
      { tenantId: tenant.id, formId: form.id, position: 1, name: "Half day", description: "Four hours · 60 edited images", priceCents: 90000 },
      { tenantId: tenant.id, formId: form.id, position: 2, name: "Full day", description: "Eight hours · 150 edited images · second shooter", priceCents: 160000 },
    ]);

    await tx.insert(contractClauses).values(
      DEFAULT_CLAUSE_SELECTION.map((c, i) => ({
        tenantId: tenant.id,
        formId: form.id,
        clauseKey: c.key,
        position: i + 1,
        variantKey: c.variantKey,
        params: c.params,
      })),
    );
  });

  return tenant;
}

// ── Stripe webhook idempotency ──────────────────────────────────────────────
/** Returns false when the event was already recorded (duplicate delivery). */
export async function claimStripeEvent(evt: { id: string; type: string; account?: string | null }): Promise<boolean> {
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: evt.id, type: evt.type, account: evt.account ?? null })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  return inserted.length > 0;
}

export async function finishStripeEvent(id: string, tenantId: string | null, error?: string) {
  await db
    .update(stripeEvents)
    .set({ tenantId, processedAt: sql`now()`, error: error ?? null })
    .where(eq(stripeEvents.id, id));
}

/** Used by the Clerk `user.deleted` webhook. */
export async function deleteMembershipsForUser(clerkUserId: string) {
  await db.delete(memberships).where(eq(memberships.clerkUserId, clerkUserId));
}
