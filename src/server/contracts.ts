import type { Booking, ContractClause, IntakeForm, Tenant } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/money";
import { CLAUSES, getVariant, isClauseKey, mergeTemplate, type ClauseKey } from "./clauses";

export interface RenderedClause {
  key: ClauseKey;
  title: string;
  text: string;
  isCustom: boolean;
}

export interface RenderedContract {
  title: string;
  intro: string;
  clauses: RenderedClause[];
  signatureLine: string;
}

type BookingForContract = Pick<
  Booking,
  "clientName" | "packageName" | "packagePriceCents" | "depositCents" | "eventDate" | "location" | "shootType" | "currency"
>;

/**
 * Produce the agreement text for a booking from the tenant's clause selections.
 * Called for the preview (setup), the client's sign screen, and again at the
 * moment of signing — the result of that last call is frozen on the booking.
 */
export function renderContract(
  tenant: Pick<Tenant, "name">,
  _form: Pick<IntakeForm, "currency">,
  clauses: ContractClause[],
  booking: BookingForContract,
): RenderedContract {
  const total = booking.packagePriceCents ?? 0;
  const deposit = booking.depositCents ?? 0;
  const values = {
    studio: tenant.name,
    client: booking.clientName ?? "the client",
    package: booking.packageName ?? "the package",
    date: booking.eventDate ? formatDate(booking.eventDate, "long") : "the agreed date",
    location: booking.location ?? "the agreed location",
    total: formatMoney(total),
    deposit: formatMoney(deposit),
    balance: formatMoney(Math.max(0, total - deposit)),
  };

  const shoot = booking.shootType ? `${booking.shootType.toLowerCase()} shoot` : "shoot";
  const pkg = booking.packageName ? ` (${booking.packageName.toLowerCase()})` : "";
  const intro = `This agreement is between ${values.studio} and ${values.client} for a ${shoot}${pkg} on ${values.date}${
    booking.location ? ` at ${booking.location}` : ""
  }. The total fee is ${values.total}.`;

  const rendered: RenderedClause[] = [];
  for (const c of [...clauses].sort((a, b) => a.position - b.position)) {
    if (c.omitted || !isClauseKey(c.clauseKey)) continue;
    const def = CLAUSES[c.clauseKey];
    if (c.customText) {
      rendered.push({ key: c.clauseKey, title: def.title, text: mergeTemplate(c.customText, values), isCustom: true });
      continue;
    }
    const v = getVariant(c.clauseKey, c.variantKey);
    if (!v) continue;
    const params: Record<string, string | number> = {};
    for (const p of v.params ?? []) params[p.key] = c.params[p.key] ?? p.default;
    rendered.push({
      key: c.clauseKey,
      title: def.title,
      text: mergeTemplate(v.text, { ...values, ...params }),
      isCustom: false,
    });
  }

  return {
    title: "Booking agreement",
    intro,
    clauses: rendered,
    signatureLine: `Signed by typing a full name below. A timestamped copy is sent to both ${values.studio} and ${values.client}.`,
  };
}

/** Plain-text form, frozen onto the booking at signature time. */
export function contractToText(c: RenderedContract): string {
  const parts = [c.title.toUpperCase(), "", c.intro, ""];
  for (const cl of c.clauses) {
    parts.push(`${cl.title.toUpperCase()}${cl.isCustom ? " (photographer's own wording)" : ""}`);
    parts.push(cl.text, "");
  }
  parts.push(c.signatureLine);
  return parts.join("\n");
}
