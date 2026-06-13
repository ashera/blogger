import "server-only";
import { query } from "@/lib/db";

// General application log. Levels: error | warn | info.
//  - error: an external-API call (or other operation) failed.
//  - warn:  something recoverable worth flagging.
//  - info:  an outbound external-API call was made (request/response summary).
export type LogLevel = "error" | "warn" | "info";

// Known sources we log from. Free-form in the DB, but these are the ones we
// emit; the admin filter offers them as options.
export type LogSource = "anthropic" | "pexels" | "resend" | "system";

export type WriteLogOpts = {
  level: LogLevel;
  source: LogSource | string;
  /** Short machine-ish label, e.g. "post-generation", "image-search". */
  context: string;
  message: string;
  detail?: string | null;
  userId?: string | null;
  seedId?: string | null;
  /** Wall-clock duration of the call, ms (for API info/error entries). */
  durationMs?: number | null;
};

/**
 * Write a log entry. Best-effort: never throws (a logging failure must not
 * break the request). Users never see any of this.
 */
export async function writeLog(opts: WriteLogOpts): Promise<void> {
  try {
    await query(
      `INSERT INTO error_log
         (user_id, source, context, message, detail, seed_id, level, duration_ms)
       VALUES ($1::bigint, $2, $3, $4, $5, $6::bigint, $7, $8)`,
      [
        opts.userId ?? null,
        opts.source,
        opts.context,
        (opts.message ?? "").slice(0, 4000),
        opts.detail ? opts.detail.slice(0, 8000) : null,
        opts.seedId ?? null,
        opts.level,
        opts.durationMs ?? null,
      ],
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[log] insert failed", e);
  }
}

export type LogExternalErrorOpts = {
  userId?: string | null;
  source: LogSource | string;
  context: string;
  message: string;
  detail?: string | null;
  seedId?: string | null;
  durationMs?: number | null;
};

/** Record an external-API failure (level=error). Back-compat wrapper. */
export async function logExternalError(opts: LogExternalErrorOpts): Promise<void> {
  await writeLog({ ...opts, level: "error" });
}

/** Record a successful outbound external-API call (level=info). */
export async function logApiInfo(opts: Omit<WriteLogOpts, "level">): Promise<void> {
  await writeLog({ ...opts, level: "info" });
}

/** Record a recoverable warning (level=warn). */
export async function logWarning(opts: Omit<WriteLogOpts, "level">): Promise<void> {
  await writeLog({ ...opts, level: "warn" });
}

export type LogRow = {
  id: string;
  level: string;
  user_id: string | null;
  user_email: string | null;
  source: string;
  context: string | null;
  message: string;
  detail: string | null;
  seed_id: string | null;
  duration_ms: number | null;
  created_at: string;
};

export type LogFilter = {
  level?: LogLevel | null;
  source?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

function buildWhere(f: LogFilter): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.level) {
    params.push(f.level);
    where.push(`e.level = $${params.length}`);
  }
  if (f.source) {
    params.push(f.source);
    where.push(`e.source = $${params.length}`);
  }
  if (f.q && f.q.trim()) {
    params.push(`%${f.q.trim()}%`);
    const i = params.length;
    where.push(
      `(e.message ILIKE $${i} OR e.context ILIKE $${i} OR e.detail ILIKE $${i} OR e.source ILIKE $${i})`,
    );
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

/** Filtered, paginated log entries, newest first. */
export async function listLogs(f: LogFilter = {}): Promise<LogRow[]> {
  const { sql, params } = buildWhere(f);
  const limit = Math.min(Math.max(f.limit ?? 200, 1), 1000);
  const offset = Math.max(f.offset ?? 0, 0);
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const r = await query<LogRow>(
    `SELECT e.id::text,
            e.level,
            e.user_id::text,
            u.email AS user_email,
            e.source,
            e.context,
            e.message,
            e.detail,
            e.seed_id::text,
            e.duration_ms,
            e.created_at::text
       FROM error_log e
  LEFT JOIN users u ON u.id = e.user_id
       ${sql}
      ORDER BY e.created_at DESC
      LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );
  return r.rows;
}

/** Count of rows matching the filter (for the "showing N of M" header). */
export async function countLogs(f: LogFilter = {}): Promise<number> {
  const { sql, params } = buildWhere(f);
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM error_log e ${sql}`,
    params,
  );
  return Number(r.rows[0]?.n ?? "0");
}

/** Per-level totals for the filter chips. */
export async function countByLevel(): Promise<Record<string, number>> {
  try {
    const r = await query<{ level: string; n: string }>(
      `SELECT level, COUNT(*)::text AS n FROM error_log GROUP BY level`,
    );
    const out: Record<string, number> = {};
    for (const row of r.rows) out[row.level] = Number(row.n);
    return out;
  } catch {
    return {};
  }
}
