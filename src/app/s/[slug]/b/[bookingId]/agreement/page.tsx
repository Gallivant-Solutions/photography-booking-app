import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/print-button";
import { withTenant } from "@/db/client";
import { formatDateTime } from "@/lib/money";
import { getBookingForClient } from "@/server/intake";
import { getBooking } from "@/server/bookings";
import { getStudio, requireTenantBySlug } from "@/server/tenant";

/**
 * The signed agreement, printable. Reachable by the client (token cookie) or by
 * the studio's signed-in owner (?view=studio). A PDF renderer can replace the
 * body later; the text shown is the frozen snapshot, never a re-render.
 */
export default async function AgreementPage({ params, searchParams }: PageProps<"/s/[slug]/b/[bookingId]/agreement">) {
  const { slug, bookingId } = await params;
  const sp = await searchParams;
  const tenant = await requireTenantBySlug(slug);

  const booking = await withTenant(tenant.id, async (tx) => {
    if (sp.view === "studio") {
      const studio = await getStudio();
      if (!studio || studio.tenant.id !== tenant.id) return null;
      return (await getBooking(tx, bookingId))?.booking ?? null;
    }
    return getBookingForClient(tx, bookingId);
  });
  if (!booking || !booking.signedAt || !booking.contractSnapshot) notFound();

  return (
    <div className="mx-auto w-full max-w-[680px] flex-1 px-5 py-10 print:py-0">
      <article className="panel p-8 sm:p-12 print:shadow-none">
        <div className="kicker">{tenant.name}</div>
        <pre className="mt-4 whitespace-pre-wrap font-body text-[14.5px] leading-[1.7] text-neutral-800">{booking.contractSnapshot}</pre>
        <div className="mt-8 border-t border-divider pt-5">
          <div className="font-heading text-[22px] text-text">{booking.signerName}</div>
          <div className="mt-1 text-[13px] text-neutral-700">
            Signed {formatDateTime(booking.signedAt)}
            {booking.signerIp ? ` · ${booking.signerIp}` : ""}
          </div>
        </div>
        <div className="mt-6 print:hidden">
          <PrintButton />
        </div>
      </article>
    </div>
  );
}
