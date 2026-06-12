import "server-only";
import { query } from "@/lib/db";

/**
 * System-wide caps on AI response length. (The old voice/humour/opinions/
 * stats/stories "reference budgets" were removed when the file-based
 * references were replaced by the per-user brand profile — generation now
 * draws its editorial inputs from brand_profiles, not from these settings.)
 */
export type BlogBuilderSettings = {
  /** max_tokens reservation on the post-generation call. */
  postMaxTokens: number;
  /** max_tokens reservation on the SERP analysis call. */
  serpMaxTokens: number;
  /** max_tokens reservation on the keyword-cluster generation call. */
  clusterMaxTokens: number;
};

export const DEFAULT_BLOG_BUILDER_SETTINGS: BlogBuilderSettings = {
  postMaxTokens: 3000,
  serpMaxTokens: 3500,
  clusterMaxTokens: 1500,
};

type Row = {
  post_max_tokens: number;
  serp_max_tokens: number;
  cluster_max_tokens: number;
};

export async function loadBlogBuilderSettings(): Promise<BlogBuilderSettings> {
  try {
    const r = await query<Row>(
      `SELECT post_max_tokens, serp_max_tokens, cluster_max_tokens
         FROM blog_builder_settings
        WHERE id = 1
        LIMIT 1`,
    );
    const row = r.rows[0];
    if (!row) return DEFAULT_BLOG_BUILDER_SETTINGS;
    return {
      postMaxTokens: row.post_max_tokens,
      serpMaxTokens: row.serp_max_tokens,
      clusterMaxTokens: row.cluster_max_tokens,
    };
  } catch {
    return DEFAULT_BLOG_BUILDER_SETTINGS;
  }
}

export async function updateBlogBuilderSettings(
  next: BlogBuilderSettings,
): Promise<void> {
  await query(
    `INSERT INTO blog_builder_settings (
        id, post_max_tokens, serp_max_tokens, cluster_max_tokens, updated_at
     ) VALUES (1, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       post_max_tokens    = EXCLUDED.post_max_tokens,
       serp_max_tokens    = EXCLUDED.serp_max_tokens,
       cluster_max_tokens = EXCLUDED.cluster_max_tokens,
       updated_at         = NOW()`,
    [next.postMaxTokens, next.serpMaxTokens, next.clusterMaxTokens],
  );
}
