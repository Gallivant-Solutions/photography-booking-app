import Link from "next/link";

/** Monthly / yearly switch — plain links so it works without JS and is shareable. */
export function PlanToggle({ interval }: { interval: "monthly" | "yearly" }) {
  return (
    <div className="seg self-start lg:self-end" role="tablist">
      <Link href="/pricing?interval=monthly" className="seg-opt whitespace-nowrap px-5" aria-current={interval === "monthly" ? "true" : undefined} role="tab">
        Monthly
      </Link>
      <Link href="/pricing?interval=yearly" className="seg-opt whitespace-nowrap px-5" aria-current={interval === "yearly" ? "true" : undefined} role="tab">
        Yearly · 2 months free
      </Link>
    </div>
  );
}
