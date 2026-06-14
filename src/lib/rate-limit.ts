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

type Limit = { perMinute: number; perDay: number };

const LIMITS: Record<RateAction, Limit> = {
  cluster: { perMinute: 4, perDay: 60 },
  serp: { perMinute: 4, perDay: 60 },
  post: { perMinute: 3, perDay: 40 },
  brand: { perMinute: 3, perDay: 30 },
  image: { perMinute: 20, perDay: 400 },
};

export type RateResult = { ok: true } | { ok: false; message: string };

/**
 * Check the limit for (user, action) and, if under it, record the call.
 * Returns { ok: false, message } when the user should be turned away.
 */
export async function enforceRateLimit(
  userId: string,
  action: RateAction,
): Promise<RateResult> {
  const lim = LIMITS[action];
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
