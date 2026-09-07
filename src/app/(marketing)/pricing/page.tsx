import type { Metadata } from "next";
import { Blob } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { PlanToggle } from "@/components/marketing/plan-toggle";

export const metadata: Metadata = { title: "Pricing" };

const SOLO = [
  "Questionnaire and e-sign",
  "Contract clause library",
  "Signed PDFs, stored and searchable",
  "Deposits by card, on your page",
  "Per-booking ledger and refunds",
  "yourname.bookedin.co",
];
const STUDIO = [
  "Everything in Solo",
  "Unlimited booking links — one per shoot type",
  "Your own domain",
  "Charge the balance from the card on file",
  "Payment reminders that stop when they pay",
  "Export the ledger for your accountant",
];

export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const sp = await searchParams;
  const interval = sp.interval === "yearly" ? "yearly" : "monthly";
  const price = (monthly: number) => (interval === "yearly" ? Math.round((monthly * 10) / 12) : monthly);

  return (
    <div className="px-5 pb-12 pt-8 sm:px-12 sm:pt-12">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[560px]">
          <h1 className="font-heading text-[38px] leading-[1.02] text-text sm:text-[48px]">Cheaper than the tools you&apos;re cancelling</h1>
          <p className="mt-3.5 text-[16px] leading-[1.55] text-neutral-800 sm:text-[17px]">
            Unlimited clients on both plans. No fee per booking, no cut of your deposits beyond Stripe&apos;s own.
          </p>
        </div>
        <PlanToggle interval={interval} />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1fr_.9fr]">
        {/* Solo */}
        <div className="inset flex flex-col gap-5 p-7 sm:p-8">
          <div>
            <div className="kicker">Solo</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-[58px] leading-none text-text">${price(12)}</span>
              <span className="text-[16px] text-neutral-800">/ month</span>
            </div>
            <p className="mt-2.5 text-[15.5px] leading-[1.55] text-neutral-800">One booking link, unlimited clients. Everything the flow needs.</p>
          </div>
          <div className="h-px bg-divider" />
          <ul className="flex flex-col gap-2.5 text-[14.5px] leading-[1.5] text-neutral-800">
            {SOLO.map((f) => (
              <li key={f} className="flex gap-2.5"><span className="font-bold text-accent-2-700">✓</span>{f}</li>
            ))}
          </ul>
          <div className="flex-1" />
          <Button href={`/api/billing/checkout?plan=solo&interval=${interval}`} variant="secondary" size="lg" className="shadow-none">
            Start free
          </Button>
        </div>

        {/* Studio */}
        <div className="relative flex flex-col gap-5 overflow-hidden rounded-lg border-2 border-accent bg-accent-100 p-7 shadow-md sm:p-8">
          <Blob className="bg-accent-200 opacity-70" style={{ top: -120, right: -100, width: 280, height: 280 }} />
          <div className="relative z-[1]">
            <div className="flex items-center justify-between gap-3">
              <div className="kicker text-accent-800">Studio</div>
              <span className="tag tag-solid text-[12px]">Most pick this</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-[58px] leading-none text-text">${price(19)}</span>
              <span className="text-[16px] text-accent-900">/ month</span>
            </div>
            <p className="mt-2.5 text-[15.5px] leading-[1.55] text-accent-900">Several links, your own domain, and the balance handled for you.</p>
          </div>
          <div className="relative z-[1] h-px bg-accent-300" />
          <ul className="relative z-[1] flex flex-col gap-2.5 text-[14.5px] leading-[1.5] text-accent-900">
            {STUDIO.map((f) => (
              <li key={f} className="flex gap-2.5"><span className="font-bold">✓</span>{f}</li>
            ))}
          </ul>
          <div className="flex-1" />
          <Button href={`/api/billing/checkout?plan=studio&interval=${interval}`} size="lg" className="relative z-[1]">
            Start free
          </Button>
        </div>

        {/* What you're replacing */}
        <div className="flex flex-col gap-4 rounded-lg bg-accent-2-800 p-7 sm:p-8">
          <h3 className="font-heading text-[24px] leading-[1.15] text-bg">What you&apos;re replacing</h3>
          <div className="flex flex-col gap-3 text-[14.5px] text-accent-2-200">
            <div className="flex justify-between"><span>Form tool</span><span>$29/mo</span></div>
            <div className="flex justify-between"><span>Contract &amp; e-sign</span><span>$15/mo</span></div>
            <div className="flex justify-between"><span>Scheduling</span><span>$10/mo</span></div>
            <div className="h-px bg-white/20" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-bg">Or a full CRM</span>
              <span className="font-heading text-[24px] text-bg">$36</span>
            </div>
          </div>
          <div className="h-px bg-white/20" />
          <p className="text-[14.5px] leading-[1.6] text-accent-2-200">Stripe&apos;s own processing fee applies to deposits either way. We don&apos;t add one.</p>
          <div className="flex-1" />
          <p className="text-[13.5px] leading-[1.55] text-accent-2-200">Questions about migrating? Reply to any email — a person answers.</p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 border-t border-divider pt-8 sm:grid-cols-3">
        <Faq q="Do you take a cut of my deposits?" a="No. Deposits go through your own Stripe account and pay out to your bank. You pay Stripe's fee, not ours." />
        <Faq q="Can I use my existing contract?" a="Yes — replace any clause with your own wording, or paste the whole thing. We flag what isn't ours." />
        <Faq q="What if I cancel?" a="Your signed PDFs and ledger export stay downloadable for a year. Nothing is held hostage." />
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <div className="text-[16px] font-semibold text-text">{q}</div>
      <p className="mt-1.5 text-[14.5px] leading-[1.6] text-neutral-800">{a}</p>
    </div>
  );
}
