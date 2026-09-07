import "./load-env";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { DEFAULT_CLAUSE_SELECTION } from "../server/clauses";

/**
 * `npm run db:seed -- --user user_xxx`
 *
 * Seeds the "Marin & Co" demo studio from the design, with the five bookings
 * on the dashboard mock. Pass your Clerk user id to become its owner; without
 * it the studio exists (so marin.localhost:3000 works) but nobody can sign in
 * to its dashboard.
 *
 * Runs as the owner role and sets app.tenant_id per statement batch so the
 * tenant-scoped inserts still pass RLS checks if the role isn't the owner.
 */
async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_ADMIN_URL (or DATABASE_URL)");
  const userArg = process.argv.indexOf("--user");
  const clerkUserId = userArg >= 0 ? process.argv[userArg + 1] : process.env.SEED_CLERK_USER_ID;

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle({ client, schema, casing: "snake_case" });

  await db.transaction(async (tx) => {
    // wipe a previous demo run
    const [existing] = await tx.select().from(schema.tenants).where(eq(schema.tenants.slug, "marin")).limit(1);
    if (existing) {
      await tx.execute(sql`select set_config('app.tenant_id', ${existing.id}, true)`);
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, existing.id));
    }

    const [tenant] = await tx
      .insert(schema.tenants)
      .values({
        slug: "marin",
        name: "Marin & Co",
        tagline: "Portrait & wedding · Bay Area",
        plan: "studio",
        publishedAt: new Date(),
      })
      .returning();
    if (!tenant) throw new Error("no tenant");
    await tx.execute(sql`select set_config('app.tenant_id', ${tenant.id}, true)`);

    if (clerkUserId) {
      await tx.insert(schema.memberships).values({ tenantId: tenant.id, clerkUserId, role: "owner" });
    }

    const [form] = await tx.insert(schema.intakeForms).values({ tenantId: tenant.id }).returning();
    if (!form) throw new Error("no form");

    await tx.insert(schema.questions).values([
      { tenantId: tenant.id, formId: form.id, position: 1, kind: "contact", title: "Who are you?", subtitle: "Name · email · phone" },
      { tenantId: tenant.id, formId: form.id, position: 2, kind: "shoot", title: "What are we shooting?", subtitle: "Shoot type · package & price" },
      { tenantId: tenant.id, formId: form.id, position: 3, kind: "schedule", title: "When and where?", subtitle: "Date or a rough window · location" },
      { tenantId: tenant.id, formId: form.id, position: 4, kind: "notes", title: "Anything I should know?", subtitle: "Long answer · optional", required: false },
    ]);

    const pk = await tx
      .insert(schema.packages)
      .values([
        { tenantId: tenant.id, formId: form.id, position: 1, name: "Half day", description: "Four hours · 60 edited images", priceCents: 90000 },
        { tenantId: tenant.id, formId: form.id, position: 2, name: "Full day", description: "Eight hours · 150 edited images · second shooter", priceCents: 160000 },
      ])
      .returning();
    const half = pk[0]!;
    const full = pk[1]!;

    await tx.insert(schema.contractClauses).values(
      DEFAULT_CLAUSE_SELECTION.map((c, i) => ({
        tenantId: tenant.id,
        formId: form.id,
        clauseKey: c.key,
        position: i + 1,
        variantKey: c.variantKey,
        params: c.params,
      })),
    );

    const daysAgo = (n: number, h = 14) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      d.setHours(h, 2, 0, 0);
      return d;
    };
    const dateStr = (m: number, d: number) => {
      const y = new Date().getFullYear() + (m < new Date().getMonth() + 1 ? 1 : 0);
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    };

    const base = { tenantId: tenant.id, formId: form.id, accessTokenHash: "seed", currency: "usd" as const };

    const [jordan] = await tx
      .insert(schema.bookings)
      .values({
        ...base,
        status: "confirmed",
        currentStep: 5,
        clientName: "Jordan Lee",
        clientEmail: "jordan@example.com",
        clientPhone: "+1 415 555 0142",
        shootType: "Wedding",
        packageId: full.id,
        packageName: full.name,
        packagePriceCents: full.priceCents,
        depositCents: 40000,
        eventDate: dateStr(11, 14),
        dateFlexibility: "fixed",
        location: "Point Reyes",
        notes: "Must-have: the cliff at golden hour. My grandmother uses a wheelchair.",
        signerName: "Jordan Lee",
        signedAt: daysAgo(3),
        signerIp: "24.19.0.1",
        contractSnapshot: "BOOKING AGREEMENT\n\n(seeded snapshot — sign a real booking to see the generated text)",
        stripePaymentIntentId: "pi_seed_jordan",
        lastActivityAt: daysAgo(3),
      })
      .returning();

    await tx.insert(schema.ledgerEntries).values([
      { tenantId: tenant.id, bookingId: jordan!.id, type: "charge", amountCents: 40000, feeCents: 1190, netCents: 38810, currency: "usd", stripeObjectId: "ch_seed_jordan", methodLabel: "Visa ••4242", occurredAt: daysAgo(3) },
      { tenantId: tenant.id, bookingId: jordan!.id, type: "payout", amountCents: 0, feeCents: 0, netCents: 38810, currency: "usd", stripeObjectId: "po_seed_1", methodLabel: "Bank ••4471", occurredAt: daysAgo(2, 9) },
    ]);

    await tx.insert(schema.bookings).values({
      ...base,
      status: "payment_failed",
      currentStep: 5,
      clientName: "Priya Nandakumar",
      clientEmail: "priya@example.com",
      shootType: "Portrait",
      packageId: half.id,
      packageName: half.name,
      packagePriceCents: 65000,
      depositCents: 16250,
      eventDate: dateStr(12, 2),
      dateFlexibility: "fixed",
      location: "Studio",
      signerName: "Priya Nandakumar",
      signedAt: daysAgo(0, 12),
      lastPaymentError: "Your card was declined.",
      stripePaymentIntentId: "pi_seed_priya",
      lastActivityAt: daysAgo(0, 12),
    });

    const [alvarez] = await tx
      .insert(schema.bookings)
      .values({
        ...base,
        status: "confirmed",
        currentStep: 5,
        clientName: "The Alvarez family",
        clientEmail: "alvarez@example.com",
        shootType: "Wedding",
        packageId: full.id,
        packageName: "Wedding · full day",
        packagePriceCents: 320000,
        depositCents: 80000,
        eventDate: dateStr(5, 9),
        dateFlexibility: "fixed",
        location: "Sonoma",
        signerName: "Elena Alvarez",
        signedAt: daysAgo(20),
        stripePaymentIntentId: "pi_seed_alvarez",
        lastActivityAt: daysAgo(20),
      })
      .returning();
    await tx.insert(schema.ledgerEntries).values({
      tenantId: tenant.id, bookingId: alvarez!.id, type: "charge", amountCents: 80000, feeCents: 2350, netCents: 77650, currency: "usd", stripeObjectId: "ch_seed_alvarez", methodLabel: "Mastercard ••8210", occurredAt: daysAgo(20),
    });

    await tx.insert(schema.bookings).values({
      ...base,
      status: "in_progress",
      currentStep: 2,
      clientName: "Sam Kettleborough",
      clientEmail: "sam@example.com",
      shootType: "Brand",
      lastActivityAt: daysAgo(3, 10),
    });

    const [okafor] = await tx
      .insert(schema.bookings)
      .values({
        ...base,
        status: "refunded",
        currentStep: 5,
        clientName: "Michelle Okafor",
        clientEmail: "michelle@example.com",
        shootType: "Family",
        packageId: half.id,
        packageName: half.name,
        packagePriceCents: 90000,
        depositCents: 22500,
        eventDate: dateStr(9, 21),
        dateFlexibility: "fixed",
        location: "Golden Gate Park",
        signerName: "Michelle Okafor",
        signedAt: daysAgo(40),
        cancelledAt: daysAgo(18),
        stripePaymentIntentId: "pi_seed_okafor",
        lastActivityAt: daysAgo(18),
      })
      .returning();
    await tx.insert(schema.ledgerEntries).values([
      { tenantId: tenant.id, bookingId: okafor!.id, type: "charge", amountCents: 22500, feeCents: 680, netCents: 21820, currency: "usd", stripeObjectId: "ch_seed_okafor", methodLabel: "Visa ••1881", occurredAt: daysAgo(40) },
      { tenantId: tenant.id, bookingId: okafor!.id, type: "refund", amountCents: -22500, feeCents: 0, netCents: -22500, currency: "usd", stripeObjectId: "re_seed_okafor", methodLabel: "Visa ••1881", note: "Cancelled at the client's request", occurredAt: daysAgo(18) },
    ]);
  });

  await client.end();
  console.log(`seeded tenant "marin"${clerkUserId ? ` owned by ${clerkUserId}` : " (no owner — pass --user <clerk user id>)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
