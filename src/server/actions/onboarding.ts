"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createTenantWithDefaults, findMembershipsForUser, isSlugAvailable } from "@/db/system";
import { isValidSlug } from "@/lib/tenant-host";
import { slugify } from "@/lib/utils";
import { errorMessage, type ActionState } from "./errors";

const schema = z.object({
  name: z.string().trim().min(2, "What's the studio called?").max(80),
  slug: z.string().trim().toLowerCase().min(3, "Pick a subdomain").max(40),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function createStudioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  try {
    const existing = await findMembershipsForUser(userId);
    if (existing.length > 0) redirect("/dashboard");

    const d = schema.parse(Object.fromEntries(formData));
    const slug = slugify(d.slug || d.name);
    if (!isValidSlug(slug)) throw new Error("Subdomain: letters, numbers and dashes, 3–40 characters");
    if (!(await isSlugAvailable(slug))) throw new Error("That subdomain is taken");

    await createTenantWithDefaults({ clerkUserId: userId, name: d.name, slug, tagline: d.tagline || null });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: errorMessage(e) };
  }
  redirect("/setup/questions");
}

function isRedirectError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
