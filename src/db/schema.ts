import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Multi-tenant schema. Rules:
 *  1. Every tenant-owned table carries `tenant_id` and has RLS enabled with a
 *     policy that compares it to the transaction-local `app.tenant_id` setting.
 *  2. The app connects as a role that does NOT own the tables and has no
 *     BYPASSRLS, so the policy is a hard guard, not a convention.
 *  3. Application code only reaches tenant tables through `withTenant()` in
 *     src/db/client.ts, which sets `app.tenant_id` inside a transaction.
 *  4. `stripe_events` has RLS enabled and no policy: only the system role can
 *     touch it (webhook idempotency is cross-tenant by nature).
 */

// ── enums ────────────────────────────────────────────────────────────────────
export const planEnum = pgEnum("plan", ["free", "solo", "studio"]);
export const membershipRoleEnum = pgEnum("membership_role", ["owner", "member"]);
export const depositModeEnum = pgEnum("deposit_mode", ["percent", "flat"]);
export const questionKindEnum = pgEnum("question_kind", ["contact", "shoot", "schedule", "notes", "custom"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "in_progress", // client is mid-questionnaire
  "awaiting_signature", // answers done, agreement not signed
  "awaiting_deposit", // signed, card not yet charged
  "payment_failed", // signed, last charge attempt failed  → "Needs you"
  "confirmed", // deposit settled (only ever set by the Stripe webhook)
  "cancelled", // photographer cancelled / released the date
  "refunded", // fully refunded
]);
export const ledgerTypeEnum = pgEnum("ledger_type", ["charge", "refund", "payout", "adjustment"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
]);

// ── RLS helpers ──────────────────────────────────────────────────────────────
// nullif(...) so an unset/blank setting yields NULL (→ no rows) instead of a
// cast error, and so a stale value can never be mistaken for a tenant id.
const currentTenant = sql.raw(`nullif(current_setting('app.tenant_id', true), '')::uuid`);

function tenantIsolation(table: string) {
  return pgPolicy(`${table}_tenant_isolation`, {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`tenant_id = ${currentTenant}`,
    withCheck: sql`tenant_id = ${currentTenant}`,
  });
}

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ── tenants ──────────────────────────────────────────────────────────────────
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(), // {slug}.bookedin.co
    name: text("name").notNull(), // "Marin & Co"
    tagline: text("tagline"), // "Portrait & wedding · Bay Area"
    customDomain: text("custom_domain"),
    plan: planEnum("plan").notNull().default("free"),
    stripeAccountId: text("stripe_account_id"), // Connect account (deposits)
    stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
    stripeCustomerId: text("stripe_customer_id"), // platform customer (billing)
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("tenants_slug_idx").on(t.slug),
    uniqueIndex("tenants_custom_domain_idx").on(t.customDomain),
    uniqueIndex("tenants_stripe_account_idx").on(t.stripeAccountId),
    uniqueIndex("tenants_stripe_customer_idx").on(t.stripeCustomerId),
    pgPolicy("tenants_self", {
      as: "permissive",
      for: "all",
      to: "public",
      using: sql`id = ${currentTenant}`,
      withCheck: sql`id = ${currentTenant}`,
    }),
  ],
).enableRLS();

// ── memberships (Clerk user ↔ tenant) ────────────────────────────────────────
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: membershipRoleEnum("role").notNull().default("owner"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("memberships_tenant_user_idx").on(t.tenantId, t.clerkUserId),
    index("memberships_user_idx").on(t.clerkUserId),
    tenantIsolation("memberships"),
  ],
).enableRLS();

// ── intake forms ("the link") ────────────────────────────────────────────────
export const intakeForms = pgTable(
  "intake_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Booking link"),
    isDefault: boolean("is_default").notNull().default(true),
    welcomeHeading: text("welcome_heading").notNull().default("Let's get your shoot on the books"),
    welcomeBody: text("welcome_body")
      .notNull()
      .default("Four short questions, about three minutes. You'll sign the agreement and pay the deposit at the end."),
    shootTypes: jsonb("shoot_types").$type<string[]>().notNull().default(["Wedding", "Portrait", "Family", "Brand"]),
    depositMode: depositModeEnum("deposit_mode").notNull().default("percent"),
    /** percent (0–100) when mode=percent, cents when mode=flat */
    depositValue: integer("deposit_value").notNull().default(25),
    currency: text("currency").notNull().default("usd"),
    ...timestamps,
  },
  (t) => [index("intake_forms_tenant_idx").on(t.tenantId), tenantIsolation("intake_forms")],
).enableRLS();

export type QuestionConfig = {
  /** free-text hint under the title */
  placeholder?: string;
  /** for custom questions */
  inputType?: "short" | "long" | "choice";
  choices?: string[];
};

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => intakeForms.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: questionKindEnum("kind").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    required: boolean("required").notNull().default(true),
    config: jsonb("config").$type<QuestionConfig>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index("questions_form_idx").on(t.formId, t.position), tenantIsolation("questions")],
).enableRLS();

export const packages = pgTable(
  "packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => intakeForms.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("packages_form_idx").on(t.formId, t.position), tenantIsolation("packages")],
).enableRLS();

// ── contract clauses (one row per clause key per form) ───────────────────────
export const contractClauses = pgTable(
  "contract_clauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => intakeForms.id, { onDelete: "cascade" }),
    clauseKey: text("clause_key").notNull(), // see src/server/clauses.ts
    position: integer("position").notNull(),
    /** vetted variant key, or null when the photographer wrote their own */
    variantKey: text("variant_key"),
    params: jsonb("params").$type<Record<string, number | string>>().notNull().default({}),
    customText: text("custom_text"),
    omitted: boolean("omitted").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("contract_clauses_form_key_idx").on(t.formId, t.clauseKey), tenantIsolation("contract_clauses")],
).enableRLS();

// ── bookings ─────────────────────────────────────────────────────────────────
export type BookingAnswers = Record<string, string | string[] | null>;

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => intakeForms.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").notNull().default("in_progress"),
    /** HMAC of the client's access token (cookie); never store the raw token */
    accessTokenHash: text("access_token_hash").notNull(),
    currentStep: integer("current_step").notNull().default(1),

    // step 1 · who
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    // step 2 · what — package is snapshotted so later price edits don't move a signed contract
    shootType: text("shoot_type"),
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
    packageName: text("package_name"),
    packagePriceCents: integer("package_price_cents"),
    depositCents: integer("deposit_cents"),
    currency: text("currency").notNull().default("usd"),
    // step 3 · when/where
    eventDate: date("event_date"),
    dateFlexibility: text("date_flexibility"), // "fixed" | "flexible" | "month" | "season"
    location: text("location"),
    // step 4 · notes + any custom questions
    notes: text("notes"),
    answers: jsonb("answers").$type<BookingAnswers>().notNull().default({}),

    // e-sign
    signerName: text("signer_name"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerIp: text("signer_ip"),
    signerUserAgent: text("signer_user_agent"),
    /** the exact agreement text the client signed, frozen at signature time */
    contractSnapshot: text("contract_snapshot"),

    // money
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCustomerId: text("stripe_customer_id"), // on the connected account
    lastPaymentError: text("last_payment_error"),
    refundOverrideNote: text("refund_override_note"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index("bookings_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("bookings_tenant_status_idx").on(t.tenantId, t.status),
    uniqueIndex("bookings_payment_intent_idx").on(t.stripePaymentIntentId),
    tenantIsolation("bookings"),
  ],
).enableRLS();

// ── ledger (the booking's spine; status is derived from it, never typed) ─────
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: ledgerTypeEnum("type").notNull(),
    /** signed: charges positive, refunds negative */
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").notNull().default(0),
    netCents: integer("net_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    /** Stripe charge / refund / payout id — unique so webhooks stay idempotent */
    stripeObjectId: text("stripe_object_id"),
    methodLabel: text("method_label"), // "Visa ••4242", "Bank ••4471"
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_booking_idx").on(t.bookingId, t.occurredAt),
    index("ledger_tenant_occurred_idx").on(t.tenantId, t.occurredAt),
    uniqueIndex("ledger_stripe_object_idx").on(t.stripeObjectId),
    tenantIsolation("ledger_entries"),
  ],
).enableRLS();

// ── platform billing (Solo / Studio) ─────────────────────────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripePriceId: text("stripe_price_id"),
    plan: planEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("subscriptions_tenant_idx").on(t.tenantId),
    uniqueIndex("subscriptions_stripe_idx").on(t.stripeSubscriptionId),
    tenantIsolation("subscriptions"),
  ],
).enableRLS();

// ── stripe event log (system only — no tenant policy on purpose) ─────────────
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(), // evt_…
  type: text("type").notNull(),
  account: text("account"), // connected account id, when applicable
  tenantId: uuid("tenant_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
}).enableRLS();

// ── row types ────────────────────────────────────────────────────────────────
export type Tenant = typeof tenants.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type IntakeForm = typeof intakeForms.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Package = typeof packages.$inferSelect;
export type ContractClause = typeof contractClauses.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type BookingStatus = Booking["status"];
