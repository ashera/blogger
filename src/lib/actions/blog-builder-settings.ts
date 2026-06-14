"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  DEFAULT_BLOG_BUILDER_SETTINGS,
  updateBlogBuilderSettings,
  type BlogBuilderSettings,
} from "@/lib/blog-builder-settings";
import {
  RATE_ACTIONS,
  DEFAULT_LIMITS,
  saveRateLimits,
  type Limit,
  type RateAction,
} from "@/lib/rate-limit";

const PAGE_PATH = "/admin/builder-settings";

function parseIntField(
  formData: FormData,
  key: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

export async function saveBlogBuilderSettings(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const next: BlogBuilderSettings = {
    postMaxTokens: parseIntField(
      formData,
      "postMaxTokens",
      500,
      8192,
      DEFAULT_BLOG_BUILDER_SETTINGS.postMaxTokens,
    ),
    serpMaxTokens: parseIntField(
      formData,
      "serpMaxTokens",
      500,
      8192,
      DEFAULT_BLOG_BUILDER_SETTINGS.serpMaxTokens,
    ),
    clusterMaxTokens: parseIntField(
      formData,
      "clusterMaxTokens",
      500,
      4096,
      DEFAULT_BLOG_BUILDER_SETTINGS.clusterMaxTokens,
    ),
  };

  await updateBlogBuilderSettings(next);

  const limits = {} as Record<RateAction, Limit>;
  for (const a of RATE_ACTIONS) {
    limits[a] = {
      perMinute: parseIntField(
        formData,
        `rl_${a}_min`,
        1,
        240,
        DEFAULT_LIMITS[a].perMinute,
      ),
      perDay: parseIntField(
        formData,
        `rl_${a}_day`,
        1,
        100000,
        DEFAULT_LIMITS[a].perDay,
      ),
    };
  }
  await saveRateLimits(limits);

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?saved=1`);
}

export async function resetBlogBuilderSettings(): Promise<void> {
  await requireAdmin();
  await updateBlogBuilderSettings(DEFAULT_BLOG_BUILDER_SETTINGS);
  await saveRateLimits(DEFAULT_LIMITS);
  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?reset=1`);
}
