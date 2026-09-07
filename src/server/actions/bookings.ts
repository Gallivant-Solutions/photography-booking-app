"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBooking, recordLedgerEntry, setBookingStatus } from "@/server/bookings";
import { refundDeposit } from "@/server/stripe";
import { requireStudio, withStudio } from "@/server/tenant";
import { errorMessage, type ActionState } from "./errors";

const refundSchema = z.object({
  scope: z.enum(["full", "partial"]),
  amount: z.coerce.number().min(0).optional(),
  reason: z.string().trim().min(3, "Give a reason — it appears on their receipt").max(300),
});

/**
 * Refund through the photographer's connected account. The ledger entry is
 * written immediately (keyed on the refund id) so the screen is right at once;
 * the charge.refunded webhook is a no-op duplicate thanks to the unique index.
 */
export async function refundAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const d = refundSchema.parse(Object.fromEntries(formData));
    const studio = await requireStudio();

    await withStudio(async (tx) => {
      const found = await getBooking(tx, bookingId);
      if (!found) throw new Error("Booking not found");
      const { booking, money } = found;
      const refundable = money.collectedCents - money.refundedCents;
      if (refundable <= 0) throw new Error("Nothing left to refund");

      const amount = d.scope === "full" ? refundable : Math.round((d.amount ?? 0) * 100);
      if (amount <= 0 || amount > refundable) throw new Error(`Amount must be between $0.01 and $${(refundable / 100).toFixed(2)}`);

      const refund = await refundDeposit(studio.tenant, booking, amount, d.reason);
      await recordLedgerEntry(tx, {
        tenantId: studio.tenant.id,
        bookingId: booking.id,
        type: "refund",
        amountCents: -amount,
        netCents: -amount,
        currency: booking.currency,
        stripeObjectId: refund.id,
        methodLabel: "Original card",
        note: d.reason,
      });

      const fullyRefunded = amount >= refundable;
      await setBookingStatus(tx, booking.id, fullyRefunded ? "refunded" : booking.status, {
        cancelledAt: fullyRefunded ? new Date() : booking.cancelledAt,
        refundOverrideNote: d.reason,
      });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/bookings/${bookingId}`);
}

export async function cancelBookingAction(bookingId: string) {
  await withStudio(async (tx) => {
    const found = await getBooking(tx, bookingId);
    if (!found) throw new Error("Booking not found");
    await setBookingStatus(tx, bookingId, "cancelled", { cancelledAt: new Date() });
  });
  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard");
}
