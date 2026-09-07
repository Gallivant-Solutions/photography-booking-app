"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { isSlugAvailable } from "@/db/system";
import { isValidSlug } from "@/lib/tenant-host";
import { CLAUSES, isClauseKey } from "@/server/clauses";
import { loadDefaultForm } from "@/server/intake";
import * as setup from "@/server/setup";
import { createAccountOnboardingLink, createConnectAccount, fetchAccountStatus } from "@/server/stripe";
import { requireStudio, withStudio } from "@/server/tenant";
import { errorMessage, type ActionState } from "./errors";

async function defaultForm() {
  return withStudio(async (tx, studio) => {
    const bundle = await loadDefaultForm(tx, studio.tenant.id);
    if (!bundle) throw new Error("No booking link yet");
    return bundle.form;
  });
}

// ── 1 · Questions ────────────────────────────────────────────────────────────
const questionSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3).max(140),
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  required: z.string().optional(),
});

export async function saveQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const d = questionSchema.parse(Object.fromEntries(formData));
    const form = await defaultForm();
    await withStudio((tx, s) =>
      setup.upsertQuestion(tx, s.tenant.id, form.id, {
        id: d.id || undefined,
        title: d.title,
        subtitle: d.subtitle || null,
        required: d.required === "on",
      }),
    );
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/questions");
  return { ok: true };
}

export async function deleteQuestionAction(questionId: string) {
  const form = await defaultForm();
  await withStudio((tx) => setup.deleteQuestion(tx, form.id, questionId));
  revalidatePath("/setup/questions");
}

export async function moveQuestionAction(questionId: string, direction: "up" | "down") {
  const form = await defaultForm();
  await withStudio(async (tx, s) => {
    const bundle = await loadDefaultForm(tx, s.tenant.id);
    if (!bundle) return;
    const ids = bundle.questions.map((q) => q.id);
    const i = ids.indexOf(questionId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await setup.reorderQuestions(tx, form.id, ids);
  });
  revalidatePath("/setup/questions");
}

const packageSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(1_000_000),
});

export async function savePackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const d = packageSchema.parse(Object.fromEntries(formData));
    const form = await defaultForm();
    await withStudio((tx, s) =>
      setup.upsertPackage(tx, s.tenant.id, form.id, {
        id: d.id || undefined,
        name: d.name,
        description: d.description || null,
        priceCents: Math.round(d.price * 100),
      }),
    );
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/questions");
  return { ok: true };
}

export async function archivePackageAction(packageId: string) {
  const form = await defaultForm();
  await withStudio((tx) => setup.archivePackage(tx, form.id, packageId));
  revalidatePath("/setup/questions");
}

export async function saveShootTypesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const raw = String(formData.get("shootTypes") ?? "");
    const types = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 12);
    if (types.length === 0) throw new Error("Add at least one shoot type");
    const form = await defaultForm();
    await withStudio((tx) => setup.updateShootTypes(tx, form.id, types));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/questions");
  return { ok: true };
}

// ── 2 · Contract ─────────────────────────────────────────────────────────────
export async function saveClauseAction(clauseKey: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isClauseKey(clauseKey)) return { error: "Unknown clause" };
  try {
    const mode = String(formData.get("mode") ?? "variant");
    const form = await defaultForm();
    await withStudio(async (tx, s) => {
      if (mode === "omit") return setup.saveClause(tx, s.tenant.id, form.id, clauseKey, { mode: "omit" });
      if (mode === "custom") {
        return setup.saveClause(tx, s.tenant.id, form.id, clauseKey, {
          mode: "custom",
          customText: String(formData.get("customText") ?? ""),
        });
      }
      const variantKey = String(formData.get("variantKey") ?? "");
      if (variantKey === "__omit__") return setup.saveClause(tx, s.tenant.id, form.id, clauseKey, { mode: "omit" });
      const def = CLAUSES[clauseKey];
      const v = def.variants.find((x) => x.key === variantKey);
      if (!v) throw new Error("Pick a variant");
      const params: Record<string, number> = {};
      for (const p of v.params ?? []) {
        const n = Number(formData.get(`param.${v.key}.${p.key}`));
        params[p.key] = Number.isFinite(n) ? n : p.default;
      }
      return setup.saveClause(tx, s.tenant.id, form.id, clauseKey, { mode: "variant", variantKey, params });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/contract");
  redirect("/setup/contract");
}

// ── 3 · Deposit ──────────────────────────────────────────────────────────────
const depositSchema = z.object({
  depositMode: z.enum(["percent", "flat"]),
  percent: z.coerce.number().min(1).max(100).optional(),
  flat: z.coerce.number().min(1).max(100_000).optional(),
});

export async function saveDepositAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const d = depositSchema.parse(Object.fromEntries(formData));
    const form = await defaultForm();
    const depositValue = d.depositMode === "percent" ? (d.percent ?? 25) : Math.round((d.flat ?? 0) * 100);
    await withStudio((tx) => setup.updateDeposit(tx, form.id, { depositMode: d.depositMode, depositValue }));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/deposit");
  return { ok: true };
}

/** Create (or resume) Stripe Connect onboarding and send the photographer to it. */
export async function connectStripeAction() {
  const studio = await requireStudio();
  const user = await currentUser();
  let accountId = studio.tenant.stripeAccountId;
  if (!accountId) {
    accountId = await createConnectAccount(studio.tenant, user?.primaryEmailAddress?.emailAddress ?? null);
    await withStudio((tx, s) => setup.updateTenantProfile(tx, s.tenant.id, { stripeAccountId: accountId }));
  }
  const url = await createAccountOnboardingLink(accountId);
  redirect(url);
}

/** Called when Stripe sends the photographer back; also safe to call any time. */
export async function refreshStripeStatusAction() {
  const studio = await requireStudio();
  if (!studio.tenant.stripeAccountId) return;
  const s = await fetchAccountStatus(studio.tenant.stripeAccountId);
  await withStudio((tx, st) =>
    setup.updateTenantProfile(tx, st.tenant.id, {
      stripeChargesEnabled: s.chargesEnabled,
      stripePayoutsEnabled: s.payoutsEnabled,
    }),
  );
  revalidatePath("/setup/deposit");
}

// ── 4 · Link ─────────────────────────────────────────────────────────────────
const linkSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  welcomeHeading: z.string().trim().min(3).max(120),
  welcomeBody: z.string().trim().min(10).max(600),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function saveLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const d = linkSchema.parse(Object.fromEntries(formData));
    if (!isValidSlug(d.slug)) throw new Error("Subdomain: letters, numbers and dashes, 3–40 characters");
    const studio = await requireStudio();
    if (d.slug !== studio.tenant.slug && !(await isSlugAvailable(d.slug))) throw new Error("That subdomain is taken");
    const form = await defaultForm();
    await withStudio(async (tx, s) => {
      await setup.updateWelcome(tx, form.id, { welcomeHeading: d.welcomeHeading, welcomeBody: d.welcomeBody });
      await setup.updateTenantProfile(tx, s.tenant.id, { slug: d.slug, name: d.name, tagline: d.tagline || null });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/link");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function publishLinkAction(): Promise<ActionState> {
  try {
    const studio = await requireStudio();
    if (!studio.tenant.stripeChargesEnabled) {
      throw new Error("Connect Stripe first — the link takes a deposit, so it can't go live without somewhere for the money to land");
    }
    await withStudio((tx, s) => setup.updateTenantProfile(tx, s.tenant.id, { publishedAt: new Date() }));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/setup/link");
  revalidatePath("/dashboard");
  return { ok: true };
}
