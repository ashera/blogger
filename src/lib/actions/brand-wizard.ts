"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { updateBrandProfile } from "@/lib/brand-profile";
import type { BrandProfile } from "@/lib/brand-score";
import {
  BRAND_SECTIONS,
  GENERATED_SECTIONS,
  type BrandSectionKey,
} from "@/lib/brand-sections";
import { loadBrandReferenceText } from "@/lib/brand-references";
import { callClaude } from "@/lib/anthropic";

const LIMITS: Record<keyof BrandProfile, number> = {
  brandName: 120,
  siteUrl: 200,
  audience: 600,
  voice: 8000,
  humour: 8000,
  perspective: 4000,
  stats: 6000,
  stories: 8000,
  avoid: 2000,
};

function clamp(v: string | null, max: number): string | null {
  if (v == null) return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * Save the whole brand profile (the wizard holds every field in state, so each
 * autosave writes them all). Returns ok/err rather than redirecting so the
 * client can keep driving the wizard.
 */
export async function saveBrandDraft(
  values: BrandProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You need to be signed in." };

  const next: BrandProfile = {
    brandName: clamp(values.brandName, LIMITS.brandName),
    siteUrl: clamp(values.siteUrl, LIMITS.siteUrl),
    audience: clamp(values.audience, LIMITS.audience),
    voice: clamp(values.voice, LIMITS.voice),
    humour: clamp(values.humour, LIMITS.humour),
    perspective: clamp(values.perspective, LIMITS.perspective),
    stats: clamp(values.stats, LIMITS.stats),
    stories: clamp(values.stories, LIMITS.stories),
    avoid: clamp(values.avoid, LIMITS.avoid),
  };

  try {
    await updateBrandProfile(me.id, next);
  } catch {
    return { ok: false, error: "Couldn't save just now — please try again." };
  }
  revalidatePath("/app/brand");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

export type GeneratedSections = Record<
  Exclude<BrandSectionKey, "audience">,
  string
>;

const SUBMIT_TOOL = {
  name: "submit_brand_profile",
  description: "Submit the rewritten brand-profile sections.",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(
      GENERATED_SECTIONS.map((k) => [
        k,
        { type: "string", description: BRAND_SECTIONS[k].writeGuidance },
      ]),
    ),
    required: [...GENERATED_SECTIONS],
  },
} as const;

/**
 * Rewrite the demo "frockd" reference sections into the user's own brand,
 * driven by the brand name / site / audience they entered. One Claude call
 * returns all six sections via a forced tool. The user then edits the results.
 */
export async function generateBrandSections(args: {
  brandName: string;
  siteUrl: string;
  audience: string;
}): Promise<{ ok: true; sections: GeneratedSections } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You need to be signed in." };

  const brandName = args.brandName.trim();
  const audience = args.audience.trim();
  if (!brandName || !audience) {
    return {
      ok: false,
      error: "Add your brand name and audience first so the AI can tailor each section.",
    };
  }

  const refs = loadBrandReferenceText();

  const system = `You set up a BRAND PROFILE — a set of instructions given to an AI blog writer so it writes in a specific brand's voice.

You are given an EXAMPLE profile written for a demo brand ("frockd", an Australian pre-loved formal-dress marketplace, written as stylist "Lou"). Rewrite each section so it fits a DIFFERENT brand, described below. Keep the same KIND of content, structure, and level of specific, opinionated detail — but invent an appropriate author persona, vocabulary, stances, and examples for the NEW brand and its audience. Drop every frockd-specific detail (dresses, weddings, Lou, Australian resale) unless it genuinely applies.

Write each section as guidance/instructions to the writer, not as a blog post.

Two sections need care:
- KEY FACTS & STATS: do NOT invent specific statistics for the new brand. Produce a clearly-labelled template of the KINDS of figures they should add (e.g. "[your average project cost]"), so the user fills in real numbers.
- STORIES & ANECDOTES: do NOT fabricate specific anecdotes as if real. Write short PROMPTS for the kinds of true stories this brand could tell, for the user to complete.

Keep every section tight and skimmable — a few short paragraphs or a bullet list each, no padding or repetition.

Call submit_brand_profile exactly once with all sections. No free text.`;

  const sectionBlocks = GENERATED_SECTIONS.map((k) => {
    const s = BRAND_SECTIONS[k];
    return `### ${s.label} (field: ${k})
Goal: ${s.writeGuidance}
Target length: ${s.lengthHint}

EXAMPLE (frockd) — rewrite this for the new brand:
"""
${refs[k] ?? "(none)"}
"""`;
  }).join("\n\n");

  const user = `NEW BRAND
Name: ${brandName}
${args.siteUrl.trim() ? `Website: ${args.siteUrl.trim()}` : "Website: (none given)"}
Audience: ${audience}

Rewrite each section below for this brand and audience, then call submit_brand_profile.

${sectionBlocks}`;

  const result = await callClaude({
    system,
    messages: [{ role: "user", content: user }],
    tools: [SUBMIT_TOOL],
    toolChoice: { type: "tool", name: "submit_brand_profile" },
    maxTokens: 4500,
    logMeta: { context: "brand-profile-gen", userId: me.id },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "The AI couldn't generate the profile just now — please try again.",
    };
  }

  const call = result.toolUses.find((t) => t.name === "submit_brand_profile");
  const input = (call?.input ?? null) as Record<string, unknown> | null;
  if (!input) {
    return {
      ok: false,
      error:
        result.stopReason === "max_tokens"
          ? "The profile was too long to finish — please try again."
          : "The AI didn't return a profile — please try again.",
    };
  }

  const sections = {} as GeneratedSections;
  for (const k of GENERATED_SECTIONS) {
    const v = input[k];
    const text = typeof v === "string" ? v.trim().slice(0, LIMITS[k]) : "";
    sections[k as Exclude<BrandSectionKey, "audience">] = text;
  }
  return { ok: true, sections };
}
