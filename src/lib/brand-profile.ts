import "server-only";
import { query } from "@/lib/db";
import { EMPTY_BRAND_PROFILE, type BrandProfile } from "@/lib/brand-score";

// Re-export the shape + scoring so existing imports from "@/lib/brand-profile"
// keep working. The scoring itself lives in the server-free brand-score module
// so the client wizard can compute a live score with the same logic.
export {
  EMPTY_BRAND_PROFILE,
  assessBrand,
  brandProfileCompleteness,
} from "@/lib/brand-score";
export type {
  BrandProfile,
  FieldStatus,
  FieldAssessment,
} from "@/lib/brand-score";

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
