import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrandSectionKey } from "@/lib/brand-sections";

/**
 * Sample interview answers, pulled from the inherited reference files in
 * /references (the demo "frockd" brand). They prefill the AI-assist interview
 * so a new user has an editable starting point per question; the wizard shows
 * them in light grey to signal "example — rewrite for your brand". One entry
 * per interview question (empty string = no sample for that question).
 */
export type BrandSamples = Record<BrandSectionKey, string[]>;

// question index → which reference file + heading to lift the sample from.
// null = leave that question blank. Headings are matched by case-insensitive
// prefix of the markdown "## heading" text, so they survive small edits.
type Ref = { file: string; heading: string } | null;

const SAMPLE_MAP: Record<BrandSectionKey, Ref[]> = {
  audience: [null, null, null],
  voice: [
    { file: "voice", heading: "Who is writing" },
    { file: "voice", heading: "Sentence rhythm" },
    { file: "voice", heading: "One-line summary" },
  ],
  humour: [
    { file: "humour", heading: "The north-star" },
    { file: "humour", heading: "Frequency" },
    { file: "humour", heading: "Anti-patterns" },
  ],
  perspective: [
    { file: "opinions", heading: "On the industry" },
    { file: "opinions", heading: "On what buyers" },
  ],
  stats: [{ file: "stats", heading: "Australian wedding" }, null],
  stories: [{ file: "stories", heading: "Origin story" }, null],
  avoid: [
    { file: "voice", heading: "Words she never uses" },
    { file: "voice", heading: "Tells that it" },
  ],
};

const MAX_SAMPLE_CHARS = 700;

const fileCache = new Map<string, string>();

function readRef(file: string): string {
  if (fileCache.has(file)) return fileCache.get(file)!;
  let content = "";
  try {
    content = readFileSync(
      join(process.cwd(), "references", `${file}.md`),
      "utf8",
    );
  } catch {
    content = "";
  }
  fileCache.set(file, content);
  return content;
}

/** Extract the body under a "## heading" (until the next level-2 heading). */
function extractSection(md: string, headingPrefix: string): string {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const pfx = headingPrefix.toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{2,3}\s+(.*)$/);
    if (m && m[1].trim().toLowerCase().startsWith(pfx)) {
      start = i;
      break;
    }
  }
  if (start === -1) return "";
  const body: string[] = [];
  for (let j = start + 1; j < lines.length; j++) {
    if (/^#{2}\s/.test(lines[j])) break; // next level-2 heading
    body.push(lines[j]);
  }
  return clip(body.join("\n").trim());
}

function clip(s: string): string {
  if (s.length <= MAX_SAMPLE_CHARS) return s;
  const slice = s.slice(0, MAX_SAMPLE_CHARS);
  const lastBreak = slice.lastIndexOf("\n");
  return (lastBreak > MAX_SAMPLE_CHARS * 0.5
    ? slice.slice(0, lastBreak)
    : slice.replace(/\s+\S*$/, "")
  ).trim();
}

let cached: BrandSamples | null = null;

export function loadBrandSamples(): BrandSamples {
  if (cached) return cached;
  const out = {} as BrandSamples;
  for (const key of Object.keys(SAMPLE_MAP) as BrandSectionKey[]) {
    out[key] = SAMPLE_MAP[key].map((ref) =>
      ref ? extractSection(readRef(ref.file), ref.heading) : "",
    );
  }
  cached = out;
  return out;
}
