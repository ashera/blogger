// Configuration for the brand-profile wizard: per-section copy plus the
// guidance the AI uses when rewriting the reference ("frockd") sections to fit
// the user's brand. Pure data (no server-only) so both the client wizard and
// the server generate-action can import it.

import type { BrandProfile } from "@/lib/brand-score";

/** Brand-profile fields shown as their own wizard step. */
export type BrandSectionKey =
  | "audience"
  | "voice"
  | "humour"
  | "perspective"
  | "stats"
  | "stories"
  | "avoid";

/** Sections the AI generates from the user's brand/url/audience (audience is
 *  entered by hand, so it is not generated). */
export const GENERATED_SECTIONS: BrandSectionKey[] = [
  "voice",
  "humour",
  "perspective",
  "stats",
  "stories",
  "avoid",
];

export type BrandSection = {
  key: BrandSectionKey;
  /** Maps to the BrandProfile field and the DB column. */
  label: string;
  /** Short intro shown at the top of the step. */
  intro: string;
  placeholder: string;
  rows: number;
  maxLength: number;
  /** What the AI should produce for this section (instructions, not prose). */
  writeGuidance: string;
  /** Rough target length for the generated section. */
  lengthHint: string;
};

export const BRAND_SECTIONS: Record<BrandSectionKey, BrandSection> = {
  audience: {
    key: "audience",
    label: "Audience",
    intro:
      "Who you're writing for. The clearer this is, the better the AI can tailor every other section to your readers.",
    placeholder:
      "e.g. Home baristas who want café-quality coffee without pro gear.",
    rows: 4,
    maxLength: 600,
    writeGuidance:
      "A description of the blog's target audience: who they are, their level of knowledge, their goals, and the context they read in.",
    lengthHint: "Keep it to 2–4 sentences.",
  },
  voice: {
    key: "voice",
    label: "Voice & tone",
    intro:
      "How posts should sound — the single biggest driver of whether your blog reads like you or like generic AI.",
    placeholder:
      "e.g. Friendly and practical, lightly witty, never salesy. Short punchy sentences. Speaks to the reader as 'you'.",
    rows: 12,
    maxLength: 8000,
    writeGuidance:
      "A voice & tone guide for the writer: invent a fitting author persona for this brand, then describe sentence rhythm, vocabulary, formatting habits, and AI-tells to avoid. Write it as instructions to the writer, with a short sample line.",
    lengthHint: "Aim for 1–3 short paragraphs.",
  },
  humour: {
    key: "humour",
    label: "Humour & wit",
    intro:
      "How the writing makes the reader smile — kept separate from voice so it gets real weight in every post.",
    placeholder:
      "e.g. Dry and understated. Land the line and move on — never explain the joke. No puns.",
    rows: 8,
    maxLength: 8000,
    writeGuidance:
      "A guide to the kind of humour and wit the writer should use: how dry or playful, where it lands, how often, and what to avoid — matched to this brand and audience.",
    lengthHint: "1–2 short paragraphs.",
  },
  perspective: {
    key: "perspective",
    label: "Point of view",
    intro:
      "The opinions and stances your brand holds, so posts take a real position instead of hedging.",
    placeholder:
      "e.g. We believe freshness beats fancy gear. We're skeptical of single-use pods.",
    rows: 5,
    maxLength: 4000,
    writeGuidance:
      "A list of plausible editorial stances and opinions for this brand to hold and weave into posts naturally, as genuine positions rather than hedged neutrality.",
    lengthHint: "A few bullet points or short sentences.",
  },
  stats: {
    key: "stats",
    label: "Key facts & stats",
    intro:
      "Numbers and facts the writer may cite verbatim — it only ever uses figures you provide here.",
    placeholder:
      "e.g. Average wedding-guest dress: $220 retail. Resale recovers 40–60% in the first month.",
    rows: 6,
    maxLength: 6000,
    writeGuidance:
      "A short TEMPLATE of the KINDS of facts and figures this brand should cite, as clearly-labelled placeholders for the user to replace with real numbers. Do NOT invent specific statistics — show the shape (e.g. '[your average order value]'), not fabricated authoritative numbers.",
    lengthHint: "A tidy bulleted list of placeholders.",
  },
  stories: {
    key: "stories",
    label: "Stories & anecdotes",
    intro:
      "Real anecdotes the writer can adapt into posts for lived-in specifics instead of generic filler.",
    placeholder:
      "e.g. The 2024 wedding season where three friends each spent $1,200+ on dresses worn once.",
    rows: 8,
    maxLength: 8000,
    writeGuidance:
      "1–2 PROMPTS describing the kinds of real stories this brand could tell (origin moment, a customer example), as a scaffold for the user to fill in. Do NOT fabricate specific anecdotes as if they were real — frame them as prompts.",
    lengthHint: "One short prompt per story idea.",
  },
  avoid: {
    key: "avoid",
    label: "Things to avoid",
    intro: "Guardrails — words, claims, or styles posts should steer clear of.",
    placeholder:
      "e.g. No hype words ('game-changing'), no medical claims, no competitor bashing.",
    rows: 4,
    maxLength: 2000,
    writeGuidance:
      "A concise guardrail list of hype words, AI-tells, claims, and styles the writer must avoid, tuned to this brand.",
    lengthHint: "A short bulleted list.",
  },
};

/** The form field id / BrandProfile key each section maps to. */
export const SECTION_TO_FIELD: Record<BrandSectionKey, keyof BrandProfile> = {
  audience: "audience",
  voice: "voice",
  humour: "humour",
  perspective: "perspective",
  stats: "stats",
  stories: "stories",
  avoid: "avoid",
};
