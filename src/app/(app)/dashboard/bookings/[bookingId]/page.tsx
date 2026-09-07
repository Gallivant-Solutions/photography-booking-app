import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Kicker, Panel, Progress } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { withTenant } from "@/db/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/money";
import { getBooking } from "@/server/bookings";
import { statusPresentation } from "@/server/ledger";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: PageProps<"/dashboard/bookings/[bookingId]">) {
  const studio = await requireStudio();
  const { bookingId } = await params;
  const found = await withTenant(studio.tenant.id, (tx) => getBooking(tx, bookingId));
  if (!found) notFound();
  const { booking: b, entries, money } = found;
  const st = statusPresentation(b.status, b);
  const refundable = money.collectedCents - money.refundedCents;
  const canCharge = b.status === "confirmed" && money.balanceCents > 0;

  return (
    <AppShell tenant={studio.tenant} active="bookings">
      <div className="mx-auto w-full max-w-[720px]">
        <Panel>
          <div className="flex flex-col gap-3.5 px-5 pt-6 sm:px-[30px]">
            <Link href="/dashboard" className="flex items-center gap-2 text-[13px] font-semibold text-neutral-700 hover:text-accent-700">
              <ArrowLeft size={15} strokeWidth={2.75} /> Bookings
            </Link>
            <div className="flex items-start justify-between gap-5">
              <div>
                <h1 className="font-heading text-[32px] leading-[1.06] text-text">{b.clientName ?? "Unnamed booking"}</h1>
                <div className="mt-1.5 text-[14.5px] text-neutral-700">
                  {[b.packageName ?? b.shootType, b.eventDate ? formatDate(b.eventDate, "full") : b.dateFlexibility ? `Date ${b.dateFlexibility}` : null, b.location]
                    .filter(Boolean)
                    .join(" · ") || "No details yet"}
                </div>
                {b.clientEmail ? (
                  <div className="mt-1 text-[13px] text-neutral-700">
                    <a href={`mailto:${b.clientEmail}`}>{b.clientEmail}</a>
                    {b.clientPhone ? ` · ${b.clientPhone}` : ""}
                  </div>
                ) : null}
              </div>
              <Tag tone={st.tone} className="flex-none px-4 py-[7px]">{st.label}</Tag>
            </div>
            {b.lastPaymentError && b.status === "payment_failed" ? (
              <div className="rounded-md border border-accent-300 bg-accent-100 px-4 py-3 text-[13.5px] text-accent-800">
                Last attempt: {b.lastPaymentError} The client can retry from their link; nothing to do on your side.
              </div>
            ) : null}
          </div>

          {/* Ledger */}
          <div className="inset mx-5 mt-5 p-6 sm:mx-[30px]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Kicker>Balance remaining</Kicker>
                <div className="mt-1.5 font-heading text-[40px] leading-[1.02] text-text sm:text-[46px]">{formatMoney(money.balanceCents, { cents: true })}</div>
                <div className="mt-1 text-[13px] text-neutral-700">
                  {money.balanceCents > 0 ? "Due on the shoot day · not yet invoiced" : b.packagePriceCents ? "Paid in full" : "No package chosen yet"}
                </div>
              </div>
              <dl className="flex min-w-[190px] flex-col gap-2 text-[14px] text-neutral-700">
                <Row k="Contract total" v={formatMoney(money.contractTotalCents, { cents: true })} />
                <Row k="Collected" v={formatMoney(money.collectedCents, { cents: true })} tone="sage" />
                <Row k="Refunded" v={formatMoney(money.refundedCents, { cents: true })} />
                <Row k="Stripe fees" v={formatMoney(money.feeCents, { cents: true })} />
              </dl>
            </div>
            <Progress value={money.collectedPct} tone="sage" className="mt-5 h-2" />
            <div className="mt-2 text-[12.5px] text-neutral-700">{money.collectedPct}% of the contract collected</div>
          </div>

          <div className="flex flex-wrap gap-2.5 px-5 pt-5 sm:px-[30px]">
            <Button className="flex-1" aria-disabled={!canCharge} disabled={!canCharge} title={canCharge ? undefined : "Available once the deposit has settled"}>
              Charge balance
            </Button>
            <Button variant="secondary" aria-disabled disabled title="Coming with Studio reminders">Request payment</Button>
            {refundable > 0 ? <Button href={`/dashboard/bookings/${b.id}/refund`} variant="secondary">Refund</Button> : null}
          </div>

          {/* Transactions */}
          <div className="px-5 pt-7 sm:px-[30px]">
            <Kicker className="mb-3">Transactions</Kicker>
            {entries.length === 0 ? (
              <p className="text-[14px] text-neutral-700">Nothing yet. The deposit appears here the moment Stripe confirms it.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th className="pl-1">Date</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th className="num">Amount</th>
                    <th className="num pr-1">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="pl-1">{formatDate(e.occurredAt)}</td>
                      <td className="font-semibold text-text">{labelFor(e.type)}</td>
                      <td className="text-neutral-700">{e.methodLabel ?? "—"}</td>
                      <td className="num">{e.type === "payout" ? "—" : formatMoney(e.amountCents, { cents: true })}</td>
                      <td className="num pr-1 font-semibold text-text">{formatMoney(e.netCents, { cents: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="pt-3 text-[12.5px] text-neutral-700">Every row links to its Stripe receipt.</div>
          </div>

          {/* Record */}
          <div className="px-5 pb-7 pt-6 sm:px-[30px]">
            <Kicker className="mb-3">Record</Kicker>
            <div className="flex flex-col gap-2.5">
              <RecordRow
                title="Questionnaire"
                sub={b.status === "in_progress" ? `Stopped at question ${b.currentStep}` : `Answered · ${formatDate(b.lastActivityAt)}`}
                action={<details className="text-[13px]"><summary className="cursor-pointer font-semibold text-accent-700">View</summary><Answers b={b} /></details>}
              />
              <RecordRow
                title="Signed agreement"
                sub={b.signedAt ? `${b.signerName} · ${formatDateTime(b.signedAt)}` : "Not signed yet"}
                action={
                  b.signedAt ? (
                    <Link href={`/s/${studio.tenant.slug}/b/${b.id}/agreement?view=studio`} className="text-[13px] font-semibold">PDF</Link>
                  ) : null
                }
              />
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "sage" }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className={`font-semibold ${tone === "sage" ? "text-accent-2-700" : "text-text"}`}>{v}</dd>
    </div>
  );
}

function RecordRow({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-300 px-[18px] py-[15px]">
      <div>
        <div className="text-[14.5px] font-semibold text-text">{title}</div>
        <div className="text-[12.5px] text-neutral-700">{sub}</div>
      </div>
      {action}
    </div>
  );
}

function Answers({ b }: { b: { clientName: string | null; clientEmail: string | null; clientPhone: string | null; shootType: string | null; packageName: string | null; eventDate: string | null; dateFlexibility: string | null; location: string | null; notes: string | null; answers: Record<string, unknown> } }) {
  const rows: Array<[string, string | null]> = [
    ["Name", b.clientName],
    ["Email", b.clientEmail],
    ["Phone", b.clientPhone],
    ["Shoot", [b.shootType, b.packageName].filter(Boolean).join(" · ") || null],
    ["Date", b.eventDate ? formatDate(b.eventDate, "full") : b.dateFlexibility],
    ["Location", b.location],
    ["Notes", b.notes],
    ...Object.entries(b.answers).map(([k, v]) => [k.slice(0, 8), String(v)] as [string, string]),
  ];
  return (
    <dl className="mt-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-700">{k}</dt>
          <dd className="whitespace-pre-wrap text-text">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function labelFor(t: "charge" | "refund" | "payout" | "adjustment") {
  return { charge: "Deposit", refund: "Refund", payout: "Payout", adjustment: "Adjustment" }[t];
}
