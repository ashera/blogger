// Configuration for the brand-profile wizard: per-section copy, the interview
// questions the "help me write this" panel asks, and the guidance the AI uses
// to turn the user's answers into the section. Pure data (no server-only) so
// both the client wizard and the server write-action can import it.

import type { BrandProfile } from "@/lib/brand-score";

/** Brand-profile fields that get the interview + AI-write treatment. */
export type BrandSectionKey =
  | "audience"
  | "voice"
  | "humour"
  | "perspective"
  | "stats"
  | "stories"
  | "avoid";

export type BrandSection = {
  key: BrandSectionKey;
  /** Maps to the BrandProfile field and the DB column. */
  label: string;
  /** Short intro shown at the top of the step. */
  intro: string;
  placeholder: string;
  rows: number;
  maxLength: number;
  /** Interview questions the AI-assist panel asks before writing. */
  questions: string[];
  /** What the AI should produce, in its own words (instructions, not prose). */
  writeGuidance: string;
  /** Rough target length for the written section. */
  lengthHint: string;
};

export const BRAND_SECTIONS: Record<BrandSectionKey, BrandSection> = {
  audience: {
    key: "audience",
    label: "Audience",
    intro:
      "Who you're writing for. The clearer this is, the better every post pitches to the right reader.",
    placeholder:
      "e.g. Home baristas who want café-quality coffee without pro gear.",
    rows: 4,
    maxLength: 600,
    questions: [
      "Who is your ideal reader? Describe them in a sentence — role, life stage, what they care about.",
      "What do they already know, and what are they trying to achieve?",
      "Where are they reading, and what would make a post genuinely useful to them?",
    ],
    writeGuidance:
      "A description of the blog's target audience: who they are, their level of knowledge, their goals, and the context they read in. This guides how posts pitch depth and framing.",
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
    questions: [
      "Who's the imaginary person writing your posts? Describe their personality.",
      "How should sentences feel — short and punchy, flowing, formal, casual? Any formatting or rhythm habits?",
      "Paste a sentence or two written in exactly the tone you want.",
    ],
    writeGuidance:
      "A voice & tone guide for the writer: the persona, sentence rhythm, vocabulary, formatting habits, and any AI-tells to avoid. Write it as instructions to the writer, and include a short sample line if helpful.",
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
    questions: [
      "How funny should posts be — bone dry, lightly witty, playful, or basically straight?",
      "Where should humour land (intros, asides, examples) and where should it never go?",
      "Any jokes, puns, or clichés to avoid entirely?",
    ],
    writeGuidance:
      "A guide to the kind of humour and wit the writer should use: how dry or playful, where it lands, how often, and what to avoid. If the user wants no humour, say so plainly.",
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
    questions: [
      "What does your brand believe that others in your space don't?",
      "What common advice or assumptions in your niche do you push back on?",
    ],
    writeGuidance:
      "A list of editorial stances and opinions the writer should hold and weave into posts naturally, as genuine positions rather than hedged neutrality.",
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
    questions: [
      "List the specific numbers, prices, or facts you want cited — one per line.",
      "Are there figures the writer should never use or guess at?",
    ],
    writeGuidance:
      "A clear list of concrete facts, numbers, and prices the writer may cite verbatim. Only use the figures the user provided — never invent or round numbers.",
    lengthHint: "A tidy bulleted list of the facts given.",
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
    questions: [
      "Share 1–3 real stories, customer examples, or origin moments.",
      "What's the point or lesson each one illustrates?",
    ],
    writeGuidance:
      "A small set of real stories/anecdotes the writer can adapt, each with the point it illustrates. Keep the user's facts intact — don't fabricate details.",
    lengthHint: "One short paragraph per story.",
  },
  avoid: {
    key: "avoid",
    label: "Things to avoid",
    intro: "Guardrails — words, claims, or styles posts should steer clear of.",
    placeholder:
      "e.g. No hype words ('game-changing'), no medical claims, no competitor bashing.",
    rows: 4,
    maxLength: 2000,
    questions: [
      "What words, phrases, or hype should posts never use?",
      "Any claims, topics, or competitor mentions to steer clear of?",
    ],
    writeGuidance:
      "A concise guardrail list of words, phrases, claims, topics, and styles the writer must avoid.",
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
