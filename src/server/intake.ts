import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type { TenantTx } from "@/db/client";
import {
  bookings,
  contractClauses,
  intakeForms,
  ledgerEntries,
  packages,
  questions,
  type Booking,
  type ContractClause,
  type IntakeForm,
  type Package,
  type Question,
} from "@/db/schema";
import { serverEnv } from "@/env";
import { computeDepositCents } from "@/lib/money";

/**
 * The client side of the flow. All functions take a tenant-scoped transaction;
 * none of them can see another tenant's rows even if handed a foreign id.
 */

export interface FormBundle {
  form: IntakeForm;
  questions: Question[];
  packages: Package[];
  clauses: ContractClause[];
}

export async function loadDefaultForm(tx: TenantTx, tenantId: string): Promise<FormBundle | null> {
  const [form] = await tx
    .select()
    .from(intakeForms)
    .where(and(eq(intakeForms.tenantId, tenantId), eq(intakeForms.isDefault, true)))
    .limit(1);
  if (!form) return null;
  return loadFormBundle(tx, form);
}

export async function loadFormBundle(tx: TenantTx, form: IntakeForm): Promise<FormBundle> {
  const [qs, pk, cl] = await Promise.all([
    tx.select().from(questions).where(eq(questions.formId, form.id)).orderBy(asc(questions.position)),
    tx.select().from(packages).where(eq(packages.formId, form.id)).orderBy(asc(packages.position)),
    tx.select().from(contractClauses).where(eq(contractClauses.formId, form.id)).orderBy(asc(contractClauses.position)),
  ]);
  return { form, questions: qs, packages: pk, clauses: cl };
}

// ── client access tokens ────────────────────────────────────────────────────
// A booking is reachable by whoever holds its token cookie. The token is random,
// only its HMAC is stored, and the cookie is host-scoped so it never crosses
// tenant subdomains.

function hashToken(token: string): string {
  return createHmac("sha256", serverEnv().INTAKE_TOKEN_SECRET).update(token).digest("hex");
}

export function cookieNameFor(bookingId: string) {
  return `bk_${bookingId.replace(/-/g, "")}`;
}

export async function setBookingCookie(bookingId: string, token: string) {
  const jar = await cookies();
  jar.set(cookieNameFor(bookingId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function createBooking(tx: TenantTx, tenantId: string, formId: string): Promise<{ booking: Booking; token: string }> {
  const token = randomBytes(24).toString("base64url");
  const [booking] = await tx
    .insert(bookings)
    .values({ tenantId, formId, accessTokenHash: hashToken(token) })
    .returning();
  if (!booking) throw new Error("booking insert returned nothing");
  return { booking, token };
}

/** Booking for the current client request, or null if the cookie is missing/wrong. */
export async function getBookingForClient(tx: TenantTx, bookingId: string): Promise<Booking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const jar = await cookies();
  const token = jar.get(cookieNameFor(bookingId))?.value;
  if (!token) return null;
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return null;
  const a = Buffer.from(booking.accessTokenHash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return booking;
}

// ── step saves ──────────────────────────────────────────────────────────────
export type StepInput =
  | { kind: "contact"; clientName: string; clientEmail: string; clientPhone: string | null }
  | { kind: "shoot"; shootType: string; packageId: string }
  | { kind: "schedule"; eventDate: string | null; dateFlexibility: string; location: string | null }
  | { kind: "notes"; notes: string | null }
  | { kind: "custom"; questionId: string; answer: string };

export async function saveStep(
  tx: TenantTx,
  bundle: FormBundle,
  booking: Booking,
  stepIndex: number, // 1-based position of the question just answered
  input: StepInput,
): Promise<Booking> {
  if (booking.signedAt) throw new Error("Answers are locked once the agreement is signed");
  const patch: Partial<typeof bookings.$inferInsert> = {};

  switch (input.kind) {
    case "contact":
      patch.clientName = input.clientName;
      patch.clientEmail = input.clientEmail;
      patch.clientPhone = input.clientPhone;
      break;
    case "shoot": {
      const pkg = bundle.packages.find((p) => p.id === input.packageId && p.active);
      if (!pkg) throw new Error("Choose a package");
      if (!bundle.form.shootTypes.includes(input.shootType)) throw new Error("Choose a shoot type");
      patch.shootType = input.shootType;
      patch.packageId = pkg.id;
      patch.packageName = pkg.name;
      patch.packagePriceCents = pkg.priceCents;
      patch.depositCents = computeDepositCents(pkg.priceCents, bundle.form.depositMode, bundle.form.depositValue);
      patch.currency = bundle.form.currency;
      break;
    }
    case "schedule":
      patch.eventDate = input.eventDate;
      patch.dateFlexibility = input.dateFlexibility;
      patch.location = input.location;
      break;
    case "notes":
      patch.notes = input.notes;
      break;
    case "custom":
      patch.answers = { ...booking.answers, [input.questionId]: input.answer };
      break;
  }

  const lastStep = bundle.questions.length;
  const nextStep = Math.min(stepIndex + 1, lastStep + 1);
  const done = stepIndex >= lastStep;
  patch.currentStep = nextStep;
  if (done && booking.status === "in_progress") patch.status = "awaiting_signature";
  patch.lastActivityAt = new Date();
  patch.updatedAt = new Date();

  const [updated] = await tx.update(bookings).set(patch).where(eq(bookings.id, booking.id)).returning();
  if (!updated) throw new Error("booking update returned nothing");
  return updated;
}

export function answersComplete(bundle: FormBundle, b: Booking): boolean {
  for (const q of bundle.questions) {
    if (!q.required) continue;
    switch (q.kind) {
      case "contact":
        if (!b.clientName || !b.clientEmail) return false;
        break;
      case "shoot":
        if (!b.packageId || !b.shootType) return false;
        break;
      case "schedule":
        if (!b.dateFlexibility) return false;
        break;
      case "notes":
        break;
      case "custom":
        if (!b.answers[q.id]) return false;
        break;
    }
  }
  return true;
}

export async function signBooking(
  tx: TenantTx,
  booking: Booking,
  input: { signerName: string; ip: string | null; userAgent: string | null; contractText: string },
): Promise<Booking> {
  if (booking.signedAt) return booking;
  const [updated] = await tx
    .update(bookings)
    .set({
      signerName: input.signerName,
      signedAt: new Date(),
      signerIp: input.ip,
      signerUserAgent: input.userAgent,
      contractSnapshot: input.contractText,
      status: "awaiting_deposit",
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id))
    .returning();
  if (!updated) throw new Error("booking update returned nothing");
  return updated;
}

export async function attachPaymentIntent(tx: TenantTx, bookingId: string, paymentIntentId: string) {
  await tx
    .update(bookings)
    .set({ stripePaymentIntentId: paymentIntentId, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

export async function ledgerForBooking(tx: TenantTx, bookingId: string) {
  return tx.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, bookingId)).orderBy(asc(ledgerEntries.occurredAt));
}
