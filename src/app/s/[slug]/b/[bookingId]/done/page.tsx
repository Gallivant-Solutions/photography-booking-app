import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check } from "lucide-react";
import { PhoneShell } from "@/components/intake/phone-shell";
import { Blob } from "@/components/ui/bits";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { formatDate, formatMoney } from "@/lib/money";
import { tenantHostLabel } from "@/lib/tenant-host";
import { clientBase, paths } from "@/server/client-paths";
import { getBookingForClient, ledgerForBooking } from "@/server/intake";
import { requireTenantBySlug } from "@/server/tenant";
import { chargeBreakdown, stripe } from "@/server/stripe";
import { findBookingByPaymentIntent, recordLedgerEntry, setBookingStatus } from "@/server/bookings";

/**
 * Landing after Stripe's redirect. The webhook is the source of truth, but it
 * can arrive a beat later than the client — so if Stripe says the intent
 * already succeeded we record it here too (same idempotent write).
 */
export default async function DonePage({ params, searchParams }: PageProps<"/s/[slug]/b/[bookingId]/done">) {
  const { slug, bookingId } = await params;
  const sp = await searchParams;
  const tenant = await requireTenantBySlug(slug);
  const base = await clientBase(slug);

  const result = await withTenant(tenant.id, async (tx) => {
    const booking = await getBookingForClient(tx, bookingId);
    if (!booking) return null;
    if (booking.status !== "confirmed" && booking.stripePaymentIntentId && tenant.stripeAccountId) {
      const pi = await stripe().paymentIntents.retrieve(booking.stripePaymentIntentId, {}, { stripeAccount: tenant.stripeAccountId });
      if (pi.status === "succeeded") {
        const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
        const b = chargeId ? await chargeBreakdown(chargeId, tenant.stripeAccountId) : null;
        const fresh = await findBookingByPaymentIntent(tx, pi.id);
        if (fresh) {
          await recordLedgerEntry(tx, {
            tenantId: tenant.id, bookingId: fresh.id, type: "charge", amountCents: pi.amount_received, feeCents: b?.fee ?? 0,
            netCents: b?.net ?? pi.amount_received, currency: pi.currency, stripeObjectId: chargeId ?? pi.id, methodLabel: b?.methodLabel ?? "Card", note: "Deposit",
          });
          await setBookingStatus(tx, fresh.id, "confirmed", { lastPaymentError: null });
          booking.status = "confirmed";
        }
      } else if (pi.status === "processing") {
        booking.status = "awaiting_deposit";
      }
    }
    const entries = await ledgerForBooking(tx, booking.id);
    return { booking, entries };
  });
  if (!result) notFound();
  const { booking, entries } = result;
  if (booking.status !== "confirmed") {
    if (sp.redirect_status === "processing") {
      // bank debits etc. — show a softer confirmation
    } else if (!booking.signedAt) redirect(paths.sign(base, booking.id));
    else if (booking.status !== "awaiting_deposit") redirect(paths.deposit(base, booking.id));
  }

  const host = tenantHostLabel(tenant.slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  const total = booking.packagePriceCents ?? 0;
  const paid = entries.filter((e) => e.type === "charge").reduce((s, e) => s + e.amountCents, 0);
  const processing = booking.status !== "confirmed";

  return (
    <PhoneShell host={host} dark>
      <Blob className="bg-accent-2-700 opacity-60" style={{ bottom: -130, left: -80, width: 340, height: 340 }} />
      <div className="relative flex flex-1 flex-col gap-5">
        <div className="flex-1" />
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-accent-2-200 text-accent-2-900"><Check size={30} strokeWidth={2.75} /></span>
        <h1 className="font-heading text-[40px] leading-[1.04] text-bg sm:text-[42px]">{processing ? "Almost there" : "Your date is held"}</h1>
        <p className="text-[16.5px] leading-[1.55] text-accent-2-200">
          {processing
            ? "Your payment is processing. We'll confirm by email the moment it clears — usually within a few minutes."
            : `${booking.eventDate ? formatDate(booking.eventDate, "full") : "Your shoot"} with ${tenant.name}${booking.location ? `, at ${booking.location}` : ""}. Everything below is already in your inbox.`}
        </p>
        <div className="flex flex-col rounded-lg bg-white/10 px-1 py-1.5">
          <Row label="Signed agreement"><Link href={paths.agreement(base, booking.id)} className="text-accent-2-200 hover:text-bg">View ↗</Link></Row>
          <div className="mx-[18px] h-px bg-white/15" />
          <Row label="Deposit paid">{formatMoney(paid || booking.depositCents || 0)}{processing ? " · processing" : " · receipt by email"}</Row>
          <div className="mx-[18px] h-px bg-white/15" />
          <Row label={`Balance due ${booking.eventDate ? formatDate(booking.eventDate) : "on the day"}`}>{formatMoney(Math.max(0, total - (paid || booking.depositCents || 0)))}</Row>
        </div>
        <div className="flex-1" />
        <div className="flex flex-col gap-2.5">
          <a href={icsHref(tenant.name, booking.eventDate, booking.location)} download={`${tenant.name}.ics`} className="btn btn-inverse btn-lg btn-block shadow-none">Add to calendar</a>
          <div className="text-center text-[12.5px] text-accent-2-200">Questions? Just reply to the email.</div>
        </div>
      </div>
    </PhoneShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-[18px] py-3 text-[14.5px] text-bg">
      <span>{label}</span>
      <span className="text-[12.5px] text-accent-2-200">{children}</span>
    </div>
  );
}

function icsHref(studio: string, date: string | null, location: string | null): string {
  if (!date) return "#";
  const d = date.replace(/-/g, "");
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const d2 = next.toISOString().slice(0, 10).replace(/-/g, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bookedin//EN", "BEGIN:VEVENT", `SUMMARY:Shoot with ${studio}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`, location ? `LOCATION:${location}` : "", "END:VEVENT", "END:VCALENDAR"]
    .filter(Boolean)
    .join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
