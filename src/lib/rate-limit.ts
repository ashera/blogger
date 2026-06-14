import "server-only";
import { query } from "@/lib/db";

/**
 * Per-user rate limiting for metered external-API actions, so a user can't
 * trigger excessive (and costly) AI / image calls — deliberately or by
 * hammering buttons. Server-side, since client-side disabling is bypassable.
 *
 * Each action has a short burst window (per minute) and a daily cap. The
 * limiter fails OPEN (a limiter DB error never blocks legitimate work).
 */
export type RateAction = "cluster" | "serp" | "post" | "brand" | "image";

export type Limit = { perMinute: number; perDay: number };

export const RATE_ACTIONS: RateAction[] = [
  "cluster",
  "serp",
  "post",
  "brand",
  "image",
];

/** Human labels for the admin UI. */
export const RATE_ACTION_LABEL: Record<RateAction, string> = {
  cluster: "Keyword cluster",
  serp: "SERP analysis",
  post: "Post generation",
  brand: "Brand-profile generation",
  image: "Image search",
};

export const DEFAULT_LIMITS: Record<RateAction, Limit> = {
  cluster: { perMinute: 4, perDay: 60 },
  serp: { perMinute: 4, perDay: 60 },
  post: { perMinute: 3, perDay: 40 },
  brand: { perMinute: 3, perDay: 30 },
  image: { perMinute: 20, perDay: 400 },
};

/** Load the configured limits (admin overrides merged over the defaults). */
export async function loadRateLimits(): Promise<Record<RateAction, Limit>> {
  try {
    const r = await query<{ rate_limits: Partial<Record<RateAction, Limit>> | null }>(
      `SELECT rate_limits FROM blog_builder_settings WHERE id = 1 LIMIT 1`,
    );
    const stored = r.rows[0]?.rate_limits ?? null;
    if (!stored) return DEFAULT_LIMITS;
    const out = {} as Record<RateAction, Limit>;
    for (const a of RATE_ACTIONS) {
      const s = stored[a];
      out[a] = {
        perMinute:
          typeof s?.perMinute === "number" && s.perMinute > 0
            ? Math.floor(s.perMinute)
            : DEFAULT_LIMITS[a].perMinute,
        perDay:
          typeof s?.perDay === "number" && s.perDay > 0
            ? Math.floor(s.perDay)
            : DEFAULT_LIMITS[a].perDay,
      };
    }
    return out;
  } catch {
    return DEFAULT_LIMITS;
  }
}

/** Persist admin-edited limits (upserts the single settings row). */
export async function saveRateLimits(
  limits: Record<RateAction, Limit>,
): Promise<void> {
  await query(
    `INSERT INTO blog_builder_settings (id, rate_limits, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET rate_limits = EXCLUDED.rate_limits, updated_at = NOW()`,
    [JSON.stringify(limits)],
  );
}

export type RateResult = { ok: true } | { ok: false; message: string };

/**
 * Check the limit for (user, action) and, if under it, record the call.
 * Returns { ok: false, message } when the user should be turned away.
 */
export async function enforceRateLimit(
  userId: string,
  action: RateAction,
): Promise<RateResult> {
  const lim = (await loadRateLimits())[action];
  try {
    const r = await query<{ minute: string; day: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute')::text AS minute,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')::text AS day
       FROM rate_events
       WHERE user_id = $1::bigint AND action = $2`,
      [userId, action],
    );
    const minute = Number(r.rows[0]?.minute ?? "0");
    const day = Number(r.rows[0]?.day ?? "0");

    if (minute >= lim.perMinute) {
      return {
        ok: false,
        message:
          "You're doing that very quickly. Give it a minute, then try again.",
      };
    }
    if (day >= lim.perDay) {
      return {
        ok: false,
        message:
          "You've hit today's limit for this action. It resets in 24 hours.",
      };
    }

    await query(
      `INSERT INTO rate_events (user_id, action) VALUES ($1::bigint, $2)`,
      [userId, action],
    );
    // Best-effort prune so the table stays small.
    await query(
      `DELETE FROM rate_events
        WHERE user_id = $1::bigint AND action = $2
          AND created_at < NOW() - INTERVAL '2 days'`,
      [userId, action],
    );
    return { ok: true };
  } catch {
    return { ok: true }; // fail open
  }
}
