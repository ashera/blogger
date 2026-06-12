import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * An EXAMPLE brand profile, read from the old reference markdown files
 * (references/*.md). Offered in the brand form purely as a scaffold so users
 * can see the depth that produces good posts — it is a demo brand (a
 * dress-resale shop), NOT the user's, and the UI makes that loud. The .md
 * files stay the single source of truth; we read + clip them at runtime.
 */
export type BrandExample = {
  brandName: string;
  siteUrl: string;
  audience: string;
  voice: string;
  humour: string;
  perspective: string;
  stats: string;
  stories: string;
  avoid: string;
};

// Clip caps mirror the brand-form field maxLengths so what loads == what saves.
const CAPS = {
  voice: 8000,
  humour: 8000,
  perspective: 4000,
  stats: 6000,
  stories: 8000,
} as const;

function clip(body: string, cap: number): string {
  const t = body.trim();
  if (t.length <= cap) return t;
  const slice = t.slice(0, cap);
  const nl = slice.lastIndexOf("\n");
  return (nl > cap * 0.6 ? slice.slice(0, nl) : slice).trimEnd();
}

async function read(file: string): Promise<string> {
  return readFile(path.join(process.cwd(), "references", file), "utf8");
}

export async function loadBrandExample(): Promise<BrandExample | null> {
  try {
    const [voice, humour, opinions, stats, stories] = await Promise.all([
      read("voice.md"),
      read("humour.md"),
      read("opinions.md"),
      read("stats.md"),
      read("stories.md"),
    ]);
    return {
      brandName: "Frockd (example — replace this)",
      siteUrl: "",
      audience:
        "Wedding guests, bridesmaids, and mothers-of-the-bride who need a great dress for one event without paying full retail — plus sellers offloading worn-once gowns. Mostly women 25–55 in Australia, comfortable shopping online, sceptical of fashion hype.",
      voice: clip(voice, CAPS.voice),
      humour: clip(humour, CAPS.humour),
      perspective: clip(opinions, CAPS.perspective),
      stats: clip(stats, CAPS.stats),
      stories: clip(stories, CAPS.stories),
      avoid:
        "Hype words (curated, stunning, game-changing, effortless, elevated). Exclamation marks and emojis. 'Contact us' / 'reach out'. Vague condition descriptions. Medical or body-shaming claims. Competitor bashing.",
    };
  } catch {
    // references/ not present (e.g. some production bundles) — no example.
    return null;
  }
}
