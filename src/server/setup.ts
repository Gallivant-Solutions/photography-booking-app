import "server-only";
import { and, eq } from "drizzle-orm";
import type { TenantTx } from "@/db/client";
import { contractClauses, intakeForms, packages, questions, tenants, type Tenant } from "@/db/schema";
import { CLAUSES, type ClauseKey } from "./clauses";

/** Photographer-side writes for the setup flow. */

export async function updateWelcome(tx: TenantTx, formId: string, input: { welcomeHeading: string; welcomeBody: string }) {
  await tx.update(intakeForms).set({ ...input, updatedAt: new Date() }).where(eq(intakeForms.id, formId));
}

export async function updateDeposit(tx: TenantTx, formId: string, input: { depositMode: "percent" | "flat"; depositValue: number }) {
  await tx.update(intakeForms).set({ ...input, updatedAt: new Date() }).where(eq(intakeForms.id, formId));
}

export async function updateShootTypes(tx: TenantTx, formId: string, shootTypes: string[]) {
  await tx.update(intakeForms).set({ shootTypes, updatedAt: new Date() }).where(eq(intakeForms.id, formId));
}

export async function upsertQuestion(
  tx: TenantTx,
  tenantId: string,
  formId: string,
  input: { id?: string; title: string; subtitle: string | null; required: boolean; position?: number },
) {
  if (input.id) {
    await tx
      .update(questions)
      .set({ title: input.title, subtitle: input.subtitle, required: input.required, updatedAt: new Date() })
      .where(and(eq(questions.id, input.id), eq(questions.formId, formId)));
    return input.id;
  }
  const existing = await tx.select({ position: questions.position }).from(questions).where(eq(questions.formId, formId));
  const position = input.position ?? Math.max(0, ...existing.map((q) => q.position)) + 1;
  const [row] = await tx
    .insert(questions)
    .values({
      tenantId,
      formId,
      position,
      kind: "custom",
      title: input.title,
      subtitle: input.subtitle,
      required: input.required,
      config: { inputType: "long" },
    })
    .returning({ id: questions.id });
  return row!.id;
}

export async function deleteQuestion(tx: TenantTx, formId: string, questionId: string) {
  const [q] = await tx.select().from(questions).where(and(eq(questions.id, questionId), eq(questions.formId, formId))).limit(1);
  if (!q) return;
  if (q.kind !== "custom") throw new Error("The four built-in questions can be edited but not removed");
  await tx.delete(questions).where(eq(questions.id, questionId));
}

export async function reorderQuestions(tx: TenantTx, formId: string, orderedIds: string[]) {
  for (const [i, id] of orderedIds.entries()) {
    await tx
      .update(questions)
      .set({ position: i + 1 })
      .where(and(eq(questions.id, id), eq(questions.formId, formId)));
  }
}

export async function upsertPackage(
  tx: TenantTx,
  tenantId: string,
  formId: string,
  input: { id?: string; name: string; description: string | null; priceCents: number },
) {
  if (input.id) {
    await tx
      .update(packages)
      .set({ name: input.name, description: input.description, priceCents: input.priceCents, updatedAt: new Date() })
      .where(and(eq(packages.id, input.id), eq(packages.formId, formId)));
    return input.id;
  }
  const existing = await tx.select({ position: packages.position }).from(packages).where(eq(packages.formId, formId));
  const [row] = await tx
    .insert(packages)
    .values({ tenantId, formId, position: Math.max(0, ...existing.map((p) => p.position)) + 1, ...input })
    .returning({ id: packages.id });
  return row!.id;
}

export async function archivePackage(tx: TenantTx, formId: string, packageId: string) {
  await tx
    .update(packages)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(packages.id, packageId), eq(packages.formId, formId)));
}

export async function saveClause(
  tx: TenantTx,
  tenantId: string,
  formId: string,
  key: ClauseKey,
  input:
    | { mode: "variant"; variantKey: string; params: Record<string, number> }
    | { mode: "custom"; customText: string }
    | { mode: "omit" },
) {
  const def = CLAUSES[key];
  const [existing] = await tx
    .select()
    .from(contractClauses)
    .where(and(eq(contractClauses.formId, formId), eq(contractClauses.clauseKey, key)))
    .limit(1);

  let patch: Partial<typeof contractClauses.$inferInsert>;
  if (input.mode === "omit") {
    if (!def.optional) throw new Error(`${def.title} can't be left out of the contract`);
    patch = { omitted: true };
  } else if (input.mode === "custom") {
    const text = input.customText.trim();
    if (text.length < 20) throw new Error("Write at least a sentence");
    patch = { omitted: false, variantKey: null, customText: text, params: {} };
  } else {
    const v = def.variants.find((x) => x.key === input.variantKey);
    if (!v) throw new Error("Unknown variant");
    const params: Record<string, number> = {};
    for (const p of v.params ?? []) {
      const raw = input.params[p.key] ?? p.default;
      params[p.key] = Math.min(p.max, Math.max(p.min, Math.round(raw)));
    }
    patch = { omitted: false, variantKey: v.key, customText: null, params };
  }

  if (existing) {
    await tx
      .update(contractClauses)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(contractClauses.id, existing.id));
  } else {
    const all = await tx.select({ position: contractClauses.position }).from(contractClauses).where(eq(contractClauses.formId, formId));
    await tx.insert(contractClauses).values({
      tenantId,
      formId,
      clauseKey: key,
      position: Math.max(0, ...all.map((c) => c.position)) + 1,
      variantKey: null,
      ...patch,
    });
  }
}

export async function updateTenantProfile(
  tx: TenantTx,
  tenantId: string,
  input: Partial<Pick<Tenant, "name" | "tagline" | "slug" | "publishedAt" | "stripeAccountId" | "stripeChargesEnabled" | "stripePayoutsEnabled">>,
) {
  await tx.update(tenants).set({ ...input, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
}
