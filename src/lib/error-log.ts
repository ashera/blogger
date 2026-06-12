import "server-only";
import { query } from "@/lib/db";

// Known external sources we log failures from.
export type ErrorSource = "anthropic" | "pexels";

export type LogExternalErrorOpts = {
  userId?: string | null;
  source: ErrorSource;
  // A short machine-ish label for where it happened, e.g. "cluster-expand",
  // "serp-analysis", "post-generation", "image-search".
  context: string;
  message: string;
  detail?: string | null;
  seedId?: string | null;
};

/**
 * Record an external-API failure for admins to review. Best-effort: never
 * throws (a logging failure must not break the user's request). Users never
 * see any of this — they get a generic "contact support" message.
 */
export async function logExternalError(
  opts: LogExternalErrorOpts,
): Promise<void> {
  try {
    await query(
      `INSERT INTO error_log (user_id, source, context, message, detail, seed_id)
       VALUES ($1::bigint, $2, $3, $4, $5, $6::bigint)`,
      [
        opts.userId ?? null,
        opts.source,
        opts.context,
        (opts.message ?? "").slice(0, 4000),
        opts.detail ? opts.detail.slice(0, 8000) : null,
        opts.seedId ?? null,
      ],
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[error-log] insert failed", e);
  }
}

export type ErrorLogRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  source: string;
  context: string | null;
  message: string;
  detail: string | null;
  seed_id: string | null;
  created_at: string;
};

/** Most recent error-log entries, newest first. */
export async function listErrorLog(limit = 200): Promise<ErrorLogRow[]> {
  const r = await query<ErrorLogRow>(
    `SELECT e.id::text,
            e.user_id::text,
            u.email AS user_email,
            e.source,
            e.context,
            e.message,
            e.detail,
            e.seed_id::text,
            e.created_at::text
       FROM error_log e
  LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows;
}

/** Total rows in the log (for the "showing N of M" header). */
export async function countErrorLog(): Promise<number> {
  const r = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM error_log`);
  return Number(r.rows[0]?.n ?? "0");
}
