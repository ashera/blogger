"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateBrandProfile, type BrandProfile } from "@/lib/brand-profile";

const LIMITS = {
  brandName: 120,
  siteUrl: 200,
  audience: 600,
  voice: 8000,
  humour: 8000,
  perspective: 4000,
  stats: 6000,
  stories: 8000,
  avoid: 2000,
} as const;

function field(formData: FormData, key: string, max: number): string | null {
  const v = String(formData.get(key) ?? "").trim().slice(0, max);
  return v.length > 0 ? v : null;
}

export async function saveBrandProfile(formData: FormData): Promise<void> {
  const me = await requireUser("/app/brand");

  const next: BrandProfile = {
    brandName: field(formData, "brand_name", LIMITS.brandName),
    siteUrl: field(formData, "site_url", LIMITS.siteUrl),
    audience: field(formData, "audience", LIMITS.audience),
    voice: field(formData, "voice", LIMITS.voice),
    humour: field(formData, "humour", LIMITS.humour),
    perspective: field(formData, "perspective", LIMITS.perspective),
    stats: field(formData, "stats", LIMITS.stats),
    stories: field(formData, "stories", LIMITS.stories),
    avoid: field(formData, "avoid", LIMITS.avoid),
  };

  await updateBrandProfile(me.id, next);

  revalidatePath("/app/brand");
  redirect("/app/brand?saved=1");
}
