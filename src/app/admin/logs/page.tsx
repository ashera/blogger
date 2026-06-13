import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  listLogs,
  countLogs,
  countByLevel,
  type LogLevel,
} from "@/lib/error-log";
import { clearLogs, deleteLogEntry } from "@/lib/actions/admin-logs";
import { Button } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log Management — Admin" };

const LIMIT = 200;

const LEVEL_META: Record<LogLevel, { label: string; bg: string; fg: string; bar: string }> = {
  error: { label: "Error", bg: "var(--danger-100)", fg: "var(--danger-700)", bar: "var(--danger-500)" },
  warn: { label: "Warning", bg: "var(--warn-100)", fg: "var(--warn-700)", bar: "var(--warn-500)" },
  info: { label: "Info", bg: "var(--volt-100)", fg: "var(--volt-800)", bar: "var(--volt-400)" },
};

const SOURCE_LABEL: Record<string, string> = {
  anthropic: "AI (Anthropic)",
  pexels: "Images (Pexels)",
  resend: "Email (Resend)",
  system: "System",
};

const SOURCES = ["anthropic", "pexels", "resend", "system"];

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function asLevel(v: string | undefined): LogLevel | undefined {
  return v === "error" || v === "warn" || v === "info" ? v : undefined;
}

export default async function LogManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; source?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const level = asLevel(sp.level);
  const source = SOURCES.includes(sp.source ?? "") ? sp.source! : undefined;
  const q = (sp.q ?? "").trim() || undefined;

  const filter = { level, source, q, limit: LIMIT };
  const [rows, total, byLevel] = await Promise.all([
    listLogs(filter),
    countLogs(filter),
    countByLevel(),
  ]);

  const filtering = Boolean(level || source || q);

  return (
    <div className="page page--pad">
      <header style={{ marginBottom: "var(--s-4)" }}>
        <h1>Log Management</h1>
        <p className="sub">
          Application log across all levels. <strong>Info</strong> entries
          record every outbound external-API call (AI, images, email);{" "}
          <strong>Errors</strong> are failures users never see. Filter and search
          below.
        </p>
      </header>

      {/* level summary */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "var(--s-4)" }}>
        {(["error", "warn", "info"] as LogLevel[]).map((lv) => (
          <span
            key={lv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              background: LEVEL_META[lv].bg,
              color: LEVEL_META[lv].fg,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {LEVEL_META[lv].label}
            <strong>{byLevel[lv] ?? 0}</strong>
          </span>
        ))}
      </div>

      {/* filters (GET form — no JS needed) */}
      <form
        method="get"
        className="form-card"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: "var(--s-4)",
        }}
      >
        <label className="form-field" style={{ margin: 0 }}>
          <span className="field-label">Level</span>
          <select name="level" defaultValue={level ?? ""} className="input">
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label className="form-field" style={{ margin: 0 }}>
          <span className="field-label">Source</span>
          <select name="source" defaultValue={source ?? ""} className="input">
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field" style={{ margin: 0, flex: "1 1 240px" }}>
          <span className="field-label">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="message, context, detail…"
            className="input"
          />
        </label>
        <Button type="submit" variant="primary">
          Apply
        </Button>
        {filtering && (
          <Link href="/admin/logs" className="btn --ghost">
            Reset
          </Link>
        )}
      </form>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          marginBottom: "var(--s-4)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          {total === 0
            ? "No matching entries"
            : `Showing ${rows.length} of ${total}${filtering ? " (filtered)" : ""}`}
        </span>
        {total > 0 && (
          <form action={clearLogs}>
            {level && <input type="hidden" name="level" value={level} />}
            <Button type="submit" variant="ghost" size="sm">
              {level ? `Clear ${LEVEL_META[level].label} entries` : "Clear all logs"}
            </Button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="form-card">
          <p className="card-sub" style={{ margin: 0 }}>
            {filtering
              ? "No entries match these filters."
              : "Nothing logged yet."}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((e) => {
            const lv = (asLevel(e.level) ?? "info") as LogLevel;
            const meta = LEVEL_META[lv];
            return (
              <li
                key={e.id}
                style={{
                  padding: "var(--s-3) var(--s-4)",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderLeft: `3px solid ${meta.bar}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span
                        style={{
                          padding: "1px 8px",
                          borderRadius: 999,
                          background: meta.bg,
                          color: meta.fg,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {meta.label}
                      </span>
                      <span className="users-tag --admin">
                        {SOURCE_LABEL[e.source] ?? e.source}
                      </span>
                      {e.context && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
                          {e.context}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {fmtWhen(e.created_at)}
                      </span>
                      {e.duration_ms != null && (
                        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
                          {e.duration_ms} ms
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--ink-1)", fontSize: "var(--t-body-s)", wordBreak: "break-word" }}>
                      {e.message}
                    </div>
                    {(e.user_email || e.user_id || e.seed_id) && (
                      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                        {e.user_email
                          ? `User: ${e.user_email}`
                          : e.user_id
                            ? `User #${e.user_id}`
                            : ""}
                        {e.seed_id ? ` · Seed #${e.seed_id}` : ""}
                      </div>
                    )}
                    {e.detail && (
                      <details style={{ marginTop: 8 }}>
                        <summary
                          style={{
                            cursor: "pointer",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--ink-3)",
                          }}
                        >
                          Detail
                        </summary>
                        <pre
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--hairline)",
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontFamily: "var(--font-mono)",
                            color: "var(--ink-2)",
                            maxHeight: 320,
                            overflow: "auto",
                          }}
                        >
                          {e.detail}
                        </pre>
                      </details>
                    )}
                  </div>
                  <form action={deleteLogEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
