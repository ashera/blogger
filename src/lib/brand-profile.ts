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
  agent_name: string | null;
  bio: string | null;
};

/**
 * The user's DEFAULT agent profile. Kept for surfaces that show a single
 * representative agent (home hero, etc.); per-context surfaces should load a
 * specific agent via "@/lib/agents". Returns EMPTY when the user has none.
 */
export async function loadBrandProfile(userId: string): Promise<BrandProfile> {
  try {
    const r = await query<Row>(
      `SELECT brand_name, site_url, audience, voice, humour, perspective,
              stats, stories, avoid, agent_name, bio
         FROM brand_profiles WHERE user_id = $1::bigint
        ORDER BY is_default DESC, id ASC LIMIT 1`,
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
      agentName: row.agent_name,
      bio: row.bio,
    };
  } catch {
    return EMPTY_BRAND_PROFILE;
  }
}

/** True when the profile has enough signal to meaningfully shape output. */
export function brandProfileIsConfigured(p: BrandProfile): boolean {
  return Boolean(p.brandName || p.audience || p.voice);
}
