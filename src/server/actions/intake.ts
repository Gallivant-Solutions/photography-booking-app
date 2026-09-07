"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTenant } from "@/db/client";
import { clientBase, paths } from "@/server/client-paths";
import { contractToText, renderContract } from "@/server/contracts";
import {
  answersComplete,
  createBooking,
  getBookingForClient,
  loadDefaultForm,
  saveStep,
  setBookingCookie,
  signBooking,
  type StepInput,
} from "@/server/intake";
import { requireTenantBySlug } from "@/server/tenant";
import { errorMessage, type ActionState } from "./errors";

/** "Start" on the welcome screen: create the booking, hand the client its cookie. */
export async function startBookingAction(slug: string) {
  const tenant = await requireTenantBySlug(slug);
  const base = await clientBase(slug);
  const { booking, token } = await withTenant(tenant.id, async (tx) => {
    const bundle = await loadDefaultForm(tx, tenant.id);
    if (!bundle) throw new Error("This studio hasn't set up a booking link yet");
    return createBooking(tx, tenant.id, bundle.form.id);
  });
  await setBookingCookie(booking.id, token);
  redirect(paths.question(base, booking.id, 1));
}

const contactSchema = z.object({
  clientName: z.string().trim().min(2, "Tell me your name").max(120),
  clientEmail: z.email("That email doesn't look right").max(200),
  clientPhone: z.string().trim().max(40).optional().or(z.literal("")),
});
const shootSchema = z.object({
  shootType: z.string().trim().min(1, "Pick a shoot type"),
  packageId: z.uuid("Choose a package"),
});
const scheduleSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dateFlexibility: z.enum(["fixed", "flexible", "month", "season"]),
  location: z.string().trim().max(200).optional().or(z.literal("")),
});
const notesSchema = z.object({ notes: z.string().trim().max(4000).optional().or(z.literal("")) });
const customSchema = z.object({ answer: z.string().trim().max(4000) });

export async function saveStepAction(
  args: { slug: string; bookingId: string; step: number },
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tenant = await requireTenantBySlug(args.slug);
  const base = await clientBase(args.slug);
  const raw = Object.fromEntries(formData.entries());

  let next: string | null = null;
  try {
    next = await withTenant(tenant.id, async (tx) => {
      const bundle = await loadDefaultForm(tx, tenant.id);
      const booking = await getBookingForClient(tx, args.bookingId);
      if (!bundle || !booking) throw new Error("This link has expired. Start again from the first screen.");
      const q = bundle.questions[args.step - 1];
      if (!q) throw new Error("Unknown step");

      let input: StepInput;
      switch (q.kind) {
        case "contact": {
          const d = contactSchema.parse(raw);
          input = { kind: "contact", clientName: d.clientName, clientEmail: d.clientEmail, clientPhone: d.clientPhone || null };
          break;
        }
        case "shoot": {
          const d = shootSchema.parse(raw);
          input = { kind: "shoot", shootType: d.shootType, packageId: d.packageId };
          break;
        }
        case "schedule": {
          const d = scheduleSchema.parse(raw);
          if (d.dateFlexibility === "fixed" && !d.eventDate) throw new Error("Pick a date, or tell me it's flexible");
          input = { kind: "schedule", eventDate: d.eventDate || null, dateFlexibility: d.dateFlexibility, location: d.location || null };
          break;
        }
        case "notes": {
          const d = notesSchema.parse(raw);
          input = { kind: "notes", notes: d.notes || null };
          break;
        }
        case "custom": {
          const d = customSchema.parse(raw);
          if (q.required && !d.answer) throw new Error("This one's required");
          input = { kind: "custom", questionId: q.id, answer: d.answer };
          break;
        }
      }
      const updated = await saveStep(tx, bundle, booking, args.step, input);
      const isLast = args.step >= bundle.questions.length;
      return isLast && answersComplete(bundle, updated)
        ? paths.sign(base, booking.id)
        : paths.question(base, booking.id, Math.min(args.step + 1, bundle.questions.length));
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(next);
}

const signSchema = z.object({
  signerName: z.string().trim().min(2, "Type your full name").max(120),
  agree: z.literal("on", { error: "Tick the box to agree" }),
});

export async function signAction(
  args: { slug: string; bookingId: string },
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tenant = await requireTenantBySlug(args.slug);
  const base = await clientBase(args.slug);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent");

  try {
    const parsed = signSchema.parse(Object.fromEntries(formData.entries()));
    await withTenant(tenant.id, async (tx) => {
      const bundle = await loadDefaultForm(tx, tenant.id);
      const booking = await getBookingForClient(tx, args.bookingId);
      if (!bundle || !booking) throw new Error("This link has expired. Start again from the first screen.");
      if (!answersComplete(bundle, booking)) throw new Error("A few answers are missing");
      // The client must sign with the name they gave, so the record matches.
      if (booking.clientName && normalize(parsed.signerName) !== normalize(booking.clientName)) {
        throw new Error(`Please sign as "${booking.clientName}", the name you gave earlier`);
      }
      const contract = renderContract(tenant, bundle.form, bundle.clauses, booking);
      await signBooking(tx, booking, { signerName: parsed.signerName, ip, userAgent: ua, contractText: contractToText(contract) });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(paths.deposit(base, args.bookingId));
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
