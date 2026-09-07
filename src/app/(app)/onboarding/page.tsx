import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { OnboardingForm } from "@/components/setup/onboarding-form";
import { getStudio } from "@/server/tenant";
import { publicEnv } from "@/env";

export const metadata: Metadata = { title: "Set up your studio" };

export default async function OnboardingPage() {
  const studio = await getStudio();
  if (studio) redirect("/dashboard");
  const user = await currentUser();
  const suggestedName = user?.fullName ? `${user.firstName ?? user.fullName} Photography` : "";

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div className="panel w-full max-w-[560px] p-7 sm:p-9">
        <div className="kicker">Welcome · one minute</div>
        <h1 className="mt-2 font-heading text-[30px] leading-[1.06] text-text">Name your studio</h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-neutral-700">
          We&apos;ll set up four questions, two packages, a full contract and a 25% deposit. Change any of it after, or don&apos;t.
        </p>
        <div className="mt-6">
          <OnboardingForm suggestedName={suggestedName} rootDomain={publicEnv.NEXT_PUBLIC_ROOT_DOMAIN} />
        </div>
      </div>
    </div>
  );
}
