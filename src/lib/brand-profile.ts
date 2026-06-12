import "server-only";
import { query } from "@/lib/db";

/**
 * Per-user editorial identity. Drives the AI generation prompts — replaces
 * the old file-based voice/humour/opinions/stats/stories references with
 * something each user owns and can edit. All fields optional; the prompt
 * composer skips any that are blank.
 */
export type BrandProfile = {
  brandName: string | null;
  siteUrl: string | null;
  audience: string | null;
  voice: string | null;
  humour: string | null;
  perspective: string | null;
  stats: string | null;
  stories: string | null;
  avoid: string | null;
};

export const EMPTY_BRAND_PROFILE: BrandProfile = {
  brandName: null,
  siteUrl: null,
  audience: null,
  voice: null,
  humour: null,
  perspective: null,
  stats: null,
  stories: null,
  avoid: null,
};

type Row = {
  brand_name: string | null;
  site_url: string | null;
  audience: string | null;
  voice: string | null;
  humour: string | null;
  perspective: string | null;
  stats: string | null;
  stories: string | null;
  avoid: string | null;
};

export async function loadBrandProfile(userId: string): Promise<BrandProfile> {
  try {
    const r = await query<Row>(
      `SELECT brand_name, site_url, audience, voice, humour, perspective,
              stats, stories, avoid
         FROM brand_profiles WHERE user_id = $1::bigint LIMIT 1`,
      [userId],
    );
    const row = r.rows[0];
    if (!row) return EMPTY_BRAND_PROFILE;
    return {
      brandName: row.brand_name,
      siteUrl: row.site_url,
      audience: row.audience,
      voice: row.voice,
      humour: row.humour,
      perspective: row.perspective,
      stats: row.stats,
      stories: row.stories,
      avoid: row.avoid,
    };
  } catch {
    return EMPTY_BRAND_PROFILE;
  }
}

export async function updateBrandProfile(
  userId: string,
  next: BrandProfile,
): Promise<void> {
  await query(
    `INSERT INTO brand_profiles
       (user_id, brand_name, site_url, audience, voice, humour, perspective,
        stats, stories, avoid, updated_at)
     VALUES ($1::bigint, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       brand_name  = EXCLUDED.brand_name,
       site_url    = EXCLUDED.site_url,
       audience    = EXCLUDED.audience,
       voice       = EXCLUDED.voice,
       humour      = EXCLUDED.humour,
       perspective = EXCLUDED.perspective,
       stats       = EXCLUDED.stats,
       stories     = EXCLUDED.stories,
       avoid       = EXCLUDED.avoid,
       updated_at  = NOW()`,
    [
      userId,
      next.brandName,
      next.siteUrl,
      next.audience,
      next.voice,
      next.humour,
      next.perspective,
      next.stats,
      next.stories,
      next.avoid,
    ],
  );
}

/** True when the profile has enough signal to meaningfully shape output. */
export function brandProfileIsConfigured(p: BrandProfile): boolean {
  return Boolean(p.brandName || p.audience || p.voice);
}

// ---------------------------------------------------------------------------
// Brand-profile completeness — single source of truth, shared by the
// dashboard's detailed breakdown and the home-page hero meter so the two can
// never disagree. Weighted by each field's impact on generation; a field that
// is present but shorter than its recommended length earns half credit.
// ---------------------------------------------------------------------------

export type FieldStatus = "good" | "brief" | "missing";

export type FieldAssessment = {
  key: keyof BrandProfile;
  label: string;
  status: FieldStatus;
  weight: number;
  impact: string; // shown when not "good"
};

const BRAND_FIELDS: Array<{
  key: keyof BrandProfile;
  label: string;
  recommend: number;
  weight: number;
  missingImpact: string;
  briefImpact: string;
}> = [
  {
    key: "voice",
    label: "Voice & tone",
    recommend: 160,
    weight: 3,
    missingImpact:
      "Posts fall back to generic AI prose — this is the single biggest driver of how your blog reads.",
    briefImpact:
      "Too thin to imitate. Add detail and a sample sentence or two so posts sound distinctly like you.",
  },
  {
    key: "humour",
    label: "Humour & wit",
    recommend: 120,
    weight: 2,
    missingImpact:
      "Posts won't carry a distinct sense of humour — fine if you want straight prose, but wit is a big part of a memorable voice.",
    briefImpact:
      "Add detail on the kind of humour and where it lands so it reads deliberate, not random.",
  },
  {
    key: "audience",
    label: "Audience",
    recommend: 50,
    weight: 3,
    missingImpact:
      "The writer pitches at a generic reader instead of your actual audience — depth and framing will be off.",
    briefImpact:
      "Spell out who they are, their level and goals so posts pitch at the right depth.",
  },
  {
    key: "perspective",
    label: "Point of view",
    recommend: 50,
    weight: 2,
    missingImpact:
      "Posts stay neutral and hedged, with no editorial stance of their own.",
    briefImpact:
      "Add a few opinions the writer should hold so posts take a real position.",
  },
  {
    key: "avoid",
    label: "Things to avoid",
    recommend: 25,
    weight: 2,
    missingImpact:
      "No guardrails — the writer may use hype words, off-brand claims, or styles you'd never publish.",
    briefImpact: "List more words, claims, or styles to steer clear of.",
  },
  {
    key: "brandName",
    label: "Brand / blog name",
    recommend: 2,
    weight: 1,
    missingImpact: "The prompt has no brand name to anchor the writing to.",
    briefImpact: "",
  },
];

export function assessBrand(p: BrandProfile): {
  fields: FieldAssessment[];
  percent: number;
  verdict: string;
} {
  let credit = 0;
  let total = 0;
  const fields: FieldAssessment[] = BRAND_FIELDS.map((f) => {
    total += f.weight;
    const raw = (p[f.key] ?? "").trim();
    let status: FieldStatus;
    if (raw.length === 0) status = "missing";
    else if (raw.length < f.recommend) status = "brief";
    else status = "good";
    credit +=
      status === "good" ? f.weight : status === "brief" ? f.weight / 2 : 0;
    const impact =
      status === "missing"
        ? f.missingImpact
        : status === "brief"
          ? f.briefImpact
          : "";
    return { key: f.key, label: f.label, status, weight: f.weight, impact };
  });
  const percent = Math.round((credit / total) * 100);
  const verdict =
    percent >= 100
      ? "Fully configured — generated posts will lean hard on your brand."
      : percent >= 70
        ? "Solid. Closing the gaps below will sharpen the output further."
        : percent >= 40
          ? "Partly set up. The gaps below noticeably affect how posts read."
          : "Barely configured — posts will read generic until you fill the high-impact fields below.";
  return { fields, percent, verdict };
}

/** Convenience: just the completeness percent (0–100). */
export function brandProfileCompleteness(p: BrandProfile): number {
  return assessBrand(p).percent;
}
