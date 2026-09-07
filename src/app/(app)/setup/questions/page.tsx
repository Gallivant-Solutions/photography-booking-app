import type { Metadata } from "next";
import { PackagesEditor, QuestionsEditor, ShootTypesEditor } from "@/components/setup/questions-editor";
import { StepFooter, StepHeading } from "@/components/setup/step-footer";
import { withTenant } from "@/db/client";
import { loadDefaultForm } from "@/server/intake";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Setup · Questions" };

export default async function QuestionsPage() {
  const studio = await requireStudio();
  const bundle = await withTenant(studio.tenant.id, (tx) => loadDefaultForm(tx, studio.tenant.id));
  if (!bundle) return null;

  return (
    <>
      <StepHeading
        title="What do you need to ask?"
        body="These are the four questions most photographers ask. Reorder them, edit the wording, or leave them alone."
      />
      <QuestionsEditor questions={bundle.questions} />

      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="kicker mb-2">Packages · sets the deposit</div>
          <PackagesEditor packages={bundle.packages.filter((p) => p.active)} depositMode={bundle.form.depositMode} depositValue={bundle.form.depositValue} />
        </div>
        <div>
          <div className="kicker mb-2">Shoot types</div>
          <ShootTypesEditor shootTypes={bundle.form.shootTypes} />
        </div>
      </div>

      <StepFooter previewHref={`/s/${studio.tenant.slug}`} next={{ href: "/setup/contract", label: "Next · Contract" }} />
    </>
  );
}
