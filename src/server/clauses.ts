/**
 * The clause library. Every clause has 2–4 vetted variants; the photographer
 * picks one and fills the blanks. Writing their own wording is allowed but is
 * flagged on the contract ("Your wording") so support knows what it's reading.
 *
 * Merge tags available in every template:
 *   {{studio}} {{client}} {{package}} {{date}} {{location}}
 *   {{total}} {{deposit}} {{balance}}
 * plus any clause param, e.g. {{days}}.
 */

export type ClauseKey = "deposit" | "refunds" | "weather" | "rescheduling" | "image_rights" | "delivery";

export const CLAUSE_KEYS: ClauseKey[] = ["deposit", "refunds", "weather", "rescheduling", "image_rights", "delivery"];

export interface ClauseParam {
  key: string;
  label: string;
  unit: string; // "days", "hours", "weeks", "%", "months"
  default: number;
  min: number;
  max: number;
}

export interface ClauseVariant {
  key: string;
  label: string; // "Rain or shine, one free move"
  text: string; // contract sentence(s) with merge tags
  params?: ClauseParam[];
}

export interface ClauseDef {
  key: ClauseKey;
  title: string; // "Weather"
  question: string; // "What happens if the weather turns?"
  optional: boolean; // may be left out of the contract
  omitLabel?: string;
  variants: ClauseVariant[];
}

export const CLAUSES: Record<ClauseKey, ClauseDef> = {
  deposit: {
    key: "deposit",
    title: "Deposit",
    question: "How does the deposit work?",
    optional: false,
    variants: [
      {
        key: "nonrefundable",
        label: "Non-refundable retainer, due on signing",
        text: "A retainer of {{deposit}} is due on signing and holds the date. The retainer is non-refundable. The remaining balance of {{balance}} is due on {{date}}.",
      },
      {
        key: "refundable_window",
        label: "Refundable until a cut-off",
        text: "A retainer of {{deposit}} is due on signing and holds the date. It is refundable in full if the booking is cancelled more than {{days}} days before {{date}}, and non-refundable after that. The remaining balance of {{balance}} is due on {{date}}.",
        params: [{ key: "days", label: "Cut-off", unit: "days", default: 60, min: 1, max: 365 }],
      },
    ],
  },
  refunds: {
    key: "refunds",
    title: "Refunds",
    question: "What if they cancel?",
    optional: false,
    variants: [
      {
        key: "none_within_window",
        label: "None within a window of the date",
        text: "Cancellation more than {{days}} days before {{date}} releases the client from the remaining balance. Cancellation within {{days}} days does not; the balance remains due.",
        params: [{ key: "days", label: "Window", unit: "days", default: 30, min: 1, max: 365 }],
      },
      {
        key: "sliding",
        label: "Sliding scale",
        text: "If the client cancels more than {{full_days}} days before {{date}}, no balance is owed. Between {{full_days}} and {{half_days}} days, half the balance is owed. Within {{half_days}} days, the full balance is owed.",
        params: [
          { key: "full_days", label: "No balance owed before", unit: "days", default: 60, min: 2, max: 365 },
          { key: "half_days", label: "Half owed before", unit: "days", default: 14, min: 1, max: 364 },
        ],
      },
      {
        key: "credit",
        label: "Credit, not cash",
        text: "If the client cancels, the retainer is held as a credit towards a new date within {{months}} months, after which it is forfeited.",
        params: [{ key: "months", label: "Credit valid for", unit: "months", default: 12, min: 1, max: 36 }],
      },
    ],
  },
  weather: {
    key: "weather",
    title: "Weather",
    question: "What happens if the weather turns?",
    optional: true,
    omitLabel: "Leave this clause out — I shoot indoors",
    variants: [
      {
        key: "rain_or_shine_one_move",
        label: "Rain or shine, one free move",
        text: "Shoots proceed rain or shine. Should conditions become unsafe, the photographer may reschedule once at no additional cost.",
      },
      {
        key: "strict",
        label: "Strictly rain or shine",
        text: "We shoot regardless of weather. No refund or reschedule is offered for conditions.",
      },
      {
        key: "either_party",
        label: "Either of us may move it",
        text: "Either party may reschedule for weather up to {{hours}} hours before the start time, at no cost.",
        params: [{ key: "hours", label: "Notice", unit: "hours", default: 24, min: 1, max: 168 }],
      },
    ],
  },
  rescheduling: {
    key: "rescheduling",
    title: "Rescheduling",
    question: "Can they move the date?",
    optional: true,
    omitLabel: "Leave this clause out",
    variants: [
      {
        key: "one_free_move",
        label: "One free move with notice",
        text: "The client may move the date once at no cost with at least {{days}} days' notice, subject to the photographer's availability. Further changes are treated as a cancellation and rebooking.",
        params: [{ key: "days", label: "Notice", unit: "days", default: 14, min: 1, max: 180 }],
      },
      {
        key: "fee",
        label: "Move for a fee",
        text: "The client may move the date with at least {{days}} days' notice for a rescheduling fee of {{fee_percent}}% of the package price, subject to availability.",
        params: [
          { key: "days", label: "Notice", unit: "days", default: 14, min: 1, max: 180 },
          { key: "fee_percent", label: "Fee", unit: "%", default: 10, min: 0, max: 100 },
        ],
      },
    ],
  },
  image_rights: {
    key: "image_rights",
    title: "Image rights",
    question: "Can you show the work?",
    optional: false,
    variants: [
      {
        key: "portfolio_social",
        label: "Portfolio and social use permitted",
        text: "{{studio}} retains copyright and may use images from the shoot for portfolio, website and social media. The client receives a personal-use licence to print and share the delivered images.",
      },
      {
        key: "portfolio_only",
        label: "Portfolio only, no social",
        text: "{{studio}} retains copyright and may use images from the shoot in its portfolio and website, but not on social media without the client's written consent. The client receives a personal-use licence to print and share the delivered images.",
      },
      {
        key: "private",
        label: "Private — no public use",
        text: "{{studio}} retains copyright but will not publish images from the shoot without the client's written consent. The client receives a personal-use licence to print and share the delivered images.",
      },
    ],
  },
  delivery: {
    key: "delivery",
    title: "Delivery",
    question: "When do they get the photos?",
    optional: false,
    variants: [
      {
        key: "weeks",
        label: "Edited gallery within a set number of weeks",
        text: "The edited gallery will be delivered within {{weeks}} weeks of {{date}}.",
        params: [{ key: "weeks", label: "Turnaround", unit: "weeks", default: 4, min: 1, max: 26 }],
      },
      {
        key: "best_effort",
        label: "Target with best effort",
        text: "The photographer aims to deliver the edited gallery within {{weeks}} weeks of {{date}}. This is a target, not a guarantee; the client will be told promptly if it slips.",
        params: [{ key: "weeks", label: "Target", unit: "weeks", default: 6, min: 1, max: 26 }],
      },
    ],
  },
};

export const DEFAULT_CLAUSE_SELECTION: Array<{ key: ClauseKey; variantKey: string; params: Record<string, number> }> = [
  { key: "deposit", variantKey: "nonrefundable", params: {} },
  { key: "refunds", variantKey: "none_within_window", params: { days: 30 } },
  { key: "weather", variantKey: "rain_or_shine_one_move", params: {} },
  { key: "rescheduling", variantKey: "one_free_move", params: { days: 14 } },
  { key: "image_rights", variantKey: "portfolio_social", params: {} },
  { key: "delivery", variantKey: "weeks", params: { weeks: 4 } },
];

export function getVariant(key: ClauseKey, variantKey: string | null): ClauseVariant | null {
  if (!variantKey) return null;
  return CLAUSES[key].variants.find((v) => v.key === variantKey) ?? null;
}

export function isClauseKey(x: string): x is ClauseKey {
  return (CLAUSE_KEYS as string[]).includes(x);
}

/** Replace {{tags}} with values; unknown tags are left visible so gaps are obvious. */
export function mergeTemplate(text: string, values: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, tag: string) => {
    const v = values[tag];
    return v === null || v === undefined || v === "" ? m : String(v);
  });
}

/**
 * Short, human summary of a clause as configured, e.g. "None within 30 days of
 * the date". Shown in the setup list and on the refund screen.
 */
export function summarizeClause(
  key: ClauseKey,
  variantKey: string | null,
  params: Record<string, number | string>,
  customText: string | null,
): string {
  if (customText) return customText.length > 90 ? `${customText.slice(0, 87)}…` : customText;
  const v = getVariant(key, variantKey);
  if (!v) return "Not set";
  const p = (k: string) => params[k] ?? v.params?.find((x) => x.key === k)?.default ?? "";
  switch (`${key}:${v.key}`) {
    case "deposit:nonrefundable":
      return "Non-refundable retainer, due on signing";
    case "deposit:refundable_window":
      return `Retainer refundable until ${p("days")} days before the date`;
    case "refunds:none_within_window":
      return `None within ${p("days")} days of the date`;
    case "refunds:sliding":
      return `Full before ${p("full_days")} days, half before ${p("half_days")}, none after`;
    case "refunds:credit":
      return `Credit towards a new date within ${p("months")} months`;
    case "weather:either_party":
      return `Either of us may move it, ${p("hours")}h notice`;
    case "rescheduling:one_free_move":
      return `One free move with ${p("days")} days' notice`;
    case "rescheduling:fee":
      return `Move with ${p("days")} days' notice for ${p("fee_percent")}%`;
    case "delivery:weeks":
      return `Edited gallery within ${p("weeks")} weeks`;
    case "delivery:best_effort":
      return `Aim for ${p("weeks")} weeks, best effort`;
    default:
      return v.label;
  }
}
