"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { loadAgent, updateAgent } from "@/lib/agents";
import { AGENT_AVATAR_COUNT } from "@/lib/agent";
import type { BrandProfile } from "@/lib/brand-score";
import {
  BRAND_SECTIONS,
  GENERATED_SECTIONS,
  type BrandSectionKey,
} from "@/lib/brand-sections";
import { loadBrandReferenceText } from "@/lib/brand-references";
import { callClaude } from "@/lib/anthropic";
import { enforceRateLimit } from "@/lib/rate-limit";

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
  agentName: 80,
  bio: 240,
};

function clamp(v: string | null, max: number): string | null {
  if (v == null) return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function clampAvatar(index: number | null): number | null {
  if (index == null || !Number.isFinite(index)) return null;
  const i = Math.floor(index);
  return i >= 0 && i < AGENT_AVATAR_COUNT ? i : null;
}

/**
 * Save the whole agent profile (the wizard holds every field in state, so each
 * autosave writes them all). Scoped to the agent's owner. Returns ok/err
 * rather than redirecting so the client can keep driving the wizard.
 */
export async function saveAgentDraft(
  agentId: string,
  values: BrandProfile,
  avatarIndex: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You need to be signed in." };

  const owned = await loadAgent(agentId, me.id);
  if (!owned) return { ok: false, error: "Agent not found." };

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
    agentName: clamp(values.agentName, LIMITS.agentName),
    bio: clamp(values.bio, LIMITS.bio),
  };

  try {
    await updateAgent(agentId, me.id, next, clampAvatar(avatarIndex));
  } catch {
    return { ok: false, error: "Couldn't save just now — please try again." };
  }
  revalidatePath("/app/agents");
  revalidatePath(`/app/agents/${agentId}`);
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
    properties: {
      ...Object.fromEntries(
        GENERATED_SECTIONS.map((k) => [
          k,
          { type: "string", description: BRAND_SECTIONS[k].writeGuidance },
        ]),
      ),
      agentName: {
        type: "string",
        description:
          "A short, human first name (optionally with surname) for the writing persona you invented in the voice section — this becomes the name of the user's blogging 'agent'. E.g. 'Sal', 'Marcus Webb', 'Priya'.",
      },
      bio: {
        type: "string",
        description:
          "A clean one-line bio of this persona in UNDER 20 words. Plain prose — NO markdown, headings, or bullet points. Capture who they are and their writing vibe so a user instantly 'gets' them. E.g. 'Marcus Webb — a wry inner-city renter who writes punchy, opinionated guides for time-poor 20-somethings.'",
      },
    },
    required: [...GENERATED_SECTIONS, "agentName", "bio"],
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
}): Promise<
  | { ok: true; sections: GeneratedSections; agentName: string; bio: string }
  | { ok: false; error: string }
> {
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

  const rl = await enforceRateLimit(me.id, "brand");
  if (!rl.ok) return { ok: false, error: rl.message };

  const refs = loadBrandReferenceText();

  const system = `You set up a BRAND PROFILE — a set of instructions given to an AI blog writer so it writes in a specific brand's voice.

You are given an EXAMPLE profile written for a demo brand ("frockd", an Australian pre-loved formal-dress marketplace, written as stylist "Lou"). Rewrite each section so it fits a DIFFERENT brand, described below. Keep the same KIND of content, structure, and level of specific, opinionated detail — but invent an appropriate author persona, vocabulary, stances, and examples for the NEW brand and its audience. Drop every frockd-specific detail (dresses, weddings, Lou, Australian resale) unless it genuinely applies.

Write each section as guidance/instructions to the writer, not as a blog post.

Two sections need care:
- KEY FACTS & STATS: do NOT invent specific statistics for the new brand. Produce a clearly-labelled template of the KINDS of figures they should add (e.g. "[your average project cost]"), so the user fills in real numbers.
- STORIES & ANECDOTES: do NOT fabricate specific anecdotes as if real. Write short PROMPTS for the kinds of true stories this brand could tell, for the user to complete.

Keep every section tight and skimmable — a few short paragraphs or a bullet list each, no padding or repetition.

Also write a "bio": a clean one-line description of the writing persona in UNDER 20 words, plain prose with NO markdown — who they are and their vibe — so a user instantly connects with them.

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
  const agentName =
    typeof input.agentName === "string"
      ? input.agentName.trim().slice(0, LIMITS.agentName)
      : "";
  const bio =
    typeof input.bio === "string"
      ? input.bio.replace(/\s+/g, " ").trim().slice(0, LIMITS.bio)
      : "";
  return { ok: true, sections, agentName, bio };
}

const VOICE_TOOL = {
  name: "submit_voice",
  description: "Submit the rewritten Voice & tone section and a persona bio.",
  input_schema: {
    type: "object",
    properties: {
      voice: { type: "string", description: BRAND_SECTIONS.voice.writeGuidance },
      bio: {
        type: "string",
        description:
          "A clean one-line bio of this persona in UNDER 20 words. Plain prose — NO markdown, headings, or bullets. Capture who they are and their writing vibe.",
      },
    },
    required: ["voice", "bio"],
  },
} as const;

/**
 * Targeted regeneration of ONLY the Voice & tone section and the persona bio
 * (a cheaper, focused call than re-drafting the whole profile). Keeps the
 * existing agent name/persona if one is set.
 */
export async function regenerateVoiceAndBio(args: {
  brandName: string;
  siteUrl: string;
  audience: string;
  agentName: string;
}): Promise<
  | { ok: true; voice: string; bio: string }
  | { ok: false; error: string }
> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You need to be signed in." };

  const brandName = args.brandName.trim();
  const audience = args.audience.trim();
  if (!brandName || !audience) {
    return {
      ok: false,
      error: "Add your brand name and audience first so the AI can tailor the voice.",
    };
  }

  const rl = await enforceRateLimit(me.id, "brand");
  if (!rl.ok) return { ok: false, error: rl.message };

  const refs = loadBrandReferenceText();
  const persona = args.agentName.trim();

  const system = `You write the VOICE & TONE section of a brand profile — instructions to an AI blog writer on how to sound.

You are given an EXAMPLE (the demo brand "frockd", an Australian pre-loved formal-dress marketplace, written as stylist "Lou"). Rewrite it for a DIFFERENT brand, described below${persona ? `, written as the persona "${persona}"` : ", inventing an appropriate author persona"}. Keep the same KIND of specific, opinionated detail and structure; drop every frockd-specific detail unless it genuinely applies. Write it as guidance to the writer, not as a blog post — tight and skimmable.

Also write a "bio": a clean one-line description of this persona in UNDER 20 words, plain prose with NO markdown.

Call submit_voice exactly once. No free text.`;

  const user = `NEW BRAND
Name: ${brandName}
${args.siteUrl.trim() ? `Website: ${args.siteUrl.trim()}` : "Website: (none given)"}
Audience: ${audience}
${persona ? `Persona name: ${persona}` : ""}

EXAMPLE Voice & tone (frockd) — rewrite for the new brand:
"""
${refs.voice ?? "(none)"}
"""`;

  const result = await callClaude({
    system,
    messages: [{ role: "user", content: user }],
    tools: [VOICE_TOOL],
    toolChoice: { type: "tool", name: "submit_voice" },
    maxTokens: 2500,
    logMeta: { context: "brand-voice-regen", userId: me.id },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "The AI couldn't refresh the voice just now — please try again.",
    };
  }

  const call = result.toolUses.find((t) => t.name === "submit_voice");
  const input = (call?.input ?? null) as Record<string, unknown> | null;
  if (!input) {
    return {
      ok: false,
      error:
        result.stopReason === "max_tokens"
          ? "The voice was too long to finish — please try again."
          : "The AI didn't return a voice — please try again.",
    };
  }

  const voice =
    typeof input.voice === "string" ? input.voice.trim().slice(0, LIMITS.voice) : "";
  const bio =
    typeof input.bio === "string"
      ? input.bio.replace(/\s+/g, " ").trim().slice(0, LIMITS.bio)
      : "";
  return { ok: true, voice, bio };
}
