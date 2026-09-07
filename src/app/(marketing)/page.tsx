import { Blob } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";

const STEPS = [
  { n: 1, title: "They answer your questions", body: "Four by default — who, what, when, anything else. Edit them or don't." },
  { n: 2, title: "They sign your agreement", body: "We write it from your setup; you swap any clause. Typed name, timestamped PDF." },
  { n: 3, title: "They pay the deposit", body: "Card entered on your page. Money moves to your bank, not ours." },
  { n: 4, title: "The date is held", body: "Both of you get the PDF and the receipt. The balance is one tap when the day comes.", sage: true },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-14 pt-10 sm:px-12 sm:pb-16 sm:pt-14">
        <Blob className="bg-accent-200 opacity-50" style={{ top: -160, right: -140, width: 520, height: 520 }} />
        <div className="relative z-[1] flex max-w-[660px] flex-col gap-5">
          <span className="tag tag-accent-2 self-start px-4 py-[7px] text-[13px]">For photographers who don&apos;t want a CRM</span>
          <h1 className="font-heading text-[42px] leading-[1] tracking-[-1px] text-text sm:text-[66px]">
            One link. Questionnaire, contract, deposit — done.
          </h1>
          <p className="max-w-[560px] text-[17px] leading-[1.55] text-neutral-800 sm:text-[19px]">
            Send a client one link on your own domain. They answer your questions, sign your agreement, and pay the deposit in a
            single sitting. You get a signed PDF and a held date.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Button href="/sign-up" size="lg">Start free</Button>
            <Button href="/s/marin" variant="secondary" size="lg" className="shadow-none">See a live example</Button>
          </div>
          <p className="text-[14px] text-neutral-700">Set up in ten minutes · no card to start · cancel whenever</p>
        </div>
      </section>

      {/* Comparison pair */}
      <section className="grid gap-5 px-5 pb-14 sm:grid-cols-2 sm:gap-6 sm:px-12 sm:pb-16">
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-6 sm:p-7">
          <div className="kicker">What you do now</div>
          <p className="text-[18px] leading-[1.45] text-text sm:text-[19px]">
            A Jotform, a contract tool, a Calendly, a Stripe link, and four emails to tie them together.
          </p>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-bg px-3.5 py-[7px] text-[13px] text-neutral-800">$34/mo across four tools</span>
            <span className="rounded-full bg-bg px-3.5 py-[7px] text-[13px] text-neutral-800">Clients drop out between them</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-accent-2-800 p-6 sm:p-7">
          <div className="kicker text-accent-2-200">What you do instead</div>
          <p className="text-[18px] leading-[1.45] text-bg sm:text-[19px]">
            Send one link. They finish in one sitting, signed and paid, without leaving your domain.
          </p>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3.5 py-[7px] text-[13px] text-bg">From $12/mo</span>
            <span className="rounded-full bg-white/15 px-3.5 py-[7px] text-[13px] text-bg">One place to look</span>
          </div>
        </div>
      </section>

      {/* How a booking goes */}
      <section id="how" className="px-5 pb-14 sm:px-12 sm:pb-16">
        <h2 className="mb-8 font-heading text-[32px] leading-[1.05] text-text sm:text-[38px]">How a booking goes</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col gap-3">
              <span
                className={`inline-flex size-[52px] items-center justify-center rounded-full font-heading text-[22px] ${
                  s.sage ? "bg-accent-2-200 text-accent-2-800" : "bg-accent-200 text-accent-800"
                }`}
              >
                {s.n}
              </span>
              <div className="text-[18px] font-semibold text-text">{s.title}</div>
              <p className="text-[14.5px] leading-[1.55] text-neutral-800">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ledger + Not a CRM */}
      <section className="grid gap-6 px-5 pb-14 sm:px-12 sm:pb-16 lg:grid-cols-[1.2fr_1fr]">
        <div className="inset flex flex-col gap-4 p-7 sm:p-8">
          <h3 className="font-heading text-[26px] leading-[1.15] text-text">You always know what&apos;s owed</h3>
          <p className="text-[15.5px] leading-[1.6] text-neutral-800">
            Every booking carries its own ledger: what was charged, what was refunded, what&apos;s still outstanding, and when it lands in
            your account.
          </p>
          <div className="flex flex-col gap-2 rounded-md bg-bg p-5 text-[14px] text-neutral-800">
            <div className="flex justify-between"><span>Contract total</span><span className="font-semibold text-text">$1,600.00</span></div>
            <div className="flex justify-between"><span>Deposit collected</span><span className="font-semibold text-accent-2-700">$400.00</span></div>
            <div className="h-px bg-divider" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-text">Balance remaining</span>
              <span className="font-heading text-[22px] text-text">$1,200.00</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-accent-300 bg-accent-100 p-7 sm:p-8">
          <h3 className="font-heading text-[26px] leading-[1.15] text-text">Not a CRM</h3>
          <p className="text-[15.5px] leading-[1.6] text-accent-900">
            No pipelines, no lead stages, no lead scoring, no $36 a month for twenty features you will never open. This does the
            booking, and stops.
          </p>
          <div className="flex-1" />
          <ul className="flex flex-col gap-2 text-[14.5px] text-accent-900">
            <li>✓ Your own domain</li>
            <li>✓ Your contract wording</li>
            <li>✓ Your Stripe account</li>
          </ul>
        </div>
      </section>

      {/* Quote placeholder */}
      <section className="px-5 pb-14 sm:px-12 sm:pb-16">
        <figure className="flex flex-col gap-6 rounded-lg bg-surface p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-11">
          <div className="size-[78px] flex-none rounded-full bg-accent-300" aria-hidden />
          <div className="flex flex-col gap-3">
            <blockquote className="font-heading text-[22px] leading-[1.25] text-text sm:text-[27px]">
              “Placeholder — a real quote from a photographer belongs here, about what the four-tool stack was costing them.”
            </blockquote>
            <figcaption className="text-[14px] text-neutral-700">Name · wedding photographer, 40 shoots a year</figcaption>
          </div>
        </figure>
      </section>

      {/* Closing CTA */}
      <section className="flex flex-col items-start gap-5 px-5 pb-16 sm:px-12">
        <h2 className="max-w-[560px] font-heading text-[34px] leading-[1.03] text-text sm:text-[44px]">
          Your next enquiry could arrive already signed and paid.
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button href="/sign-up" size="lg">Start free</Button>
          <span className="text-[14.5px] text-neutral-700">From $12/mo after your first booking</span>
        </div>
      </section>
    </>
  );
}
