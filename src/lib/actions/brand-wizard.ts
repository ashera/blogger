"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { updateBrandProfile } from "@/lib/brand-profile";
import type { BrandProfile } from "@/lib/brand-score";
import {
  BRAND_SECTIONS,
  type BrandSectionKey,
} from "@/lib/brand-sections";
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
  // Refresh the surfaces that show completeness.
  revalidatePath("/app/brand");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

export type InterviewAnswer = { q: string; a: string };

/**
 * AI-write one brand-profile section from the user's interview answers, framed
 * by the brand name + audience (and the user's current draft, if any). Returns
 * the section text for the client to drop into the editable field.
 */
export async function writeBrandSection(args: {
  section: BrandSectionKey;
  answers: InterviewAnswer[];
  brandName: string | null;
  audience: string | null;
  current: string | null;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You need to be signed in." };

  const section = BRAND_SECTIONS[args.section];
  if (!section) return { ok: false, error: "Unknown section." };

  const answered = args.answers
    .map((x) => ({ q: x.q.trim(), a: x.a.trim() }))
    .filter((x) => x.a.length > 0);
  if (answered.length === 0) {
    return { ok: false, error: "Answer at least one question first." };
  }

  const system = `You help a user define their BRAND PROFILE — a set of instructions that will be given to an AI blog writer to make it write like them. You write ONE section at a time.

Write the section as clear, concrete guidance/instructions for the writer — NOT as a blog post and NOT in the first person of a marketer pitching. Be specific and usable. Use the user's own facts; never invent specifics they didn't give. If an answer is vague, make a reasonable, on-brand assumption rather than asking again.

Output ONLY the section content. No heading, no preamble, no surrounding quotes, no "Here is…".`;

  const ctx: string[] = [];
  if (args.brandName) ctx.push(`Brand: ${args.brandName}`);
  if (args.audience && args.section !== "audience") {
    ctx.push(`Audience: ${args.audience.slice(0, 400)}`);
  }
  const current = (args.current ?? "").trim();
  if (current.length > 0) {
    ctx.push(
      `Their current draft (improve/expand on it if useful):\n${current.slice(0, 1500)}`,
    );
  }

  const qa = answered.map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n\n");

  const user = `Section to write: ${section.label}
What this section is for: ${section.writeGuidance}
${ctx.length > 0 ? `\nContext:\n${ctx.join("\n")}\n` : ""}
The user answered these interview questions:

${qa}

Write the ${section.label} section now from their answers. ${section.lengthHint} Output only the section content.`;

  const result = await callClaude({
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 1000,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "The AI couldn't write that just now — please try again.",
    };
  }
  const text = result.text.trim().slice(0, section.maxLength);
  if (!text) {
    return { ok: false, error: "The AI returned nothing — please try again." };
  }
  return { ok: true, text };
}
