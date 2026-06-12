import { requireAdmin } from "@/lib/auth";
import { listErrorLog, countErrorLog } from "@/lib/error-log";
import { clearErrorLog, deleteErrorLogEntry } from "@/lib/actions/admin-errors";
import { Button } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Error Log — Admin" };

const LIMIT = 200;

const SOURCE_LABEL: Record<string, string> = {
  anthropic: "AI writer",
  pexels: "Images",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function ErrorLogPage() {
  await requireAdmin();
  const [rows, total] = await Promise.all([listErrorLog(LIMIT), countErrorLog()]);

  return (
    <div className="page page--pad">
      <header style={{ marginBottom: "var(--s-5)" }}>
        <h1>Error Log</h1>
        <p className="sub">
          Failures from external services (the AI writer and image search).
          Users never see these — they get a generic “contact support” message.
          Use this to diagnose what actually went wrong.
        </p>
      </header>

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
            ? "No errors logged"
            : `Showing ${rows.length} of ${total} error${total === 1 ? "" : "s"}`}
        </span>
        {total > 0 && (
          <form action={clearErrorLog}>
            <Button type="submit" variant="ghost" size="sm">
              Clear log
            </Button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="form-card">
          <p className="card-sub" style={{ margin: 0 }}>
            Nothing here yet. When an external API call fails, it&rsquo;ll be
            recorded here with the full detail.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {rows.map((e) => (
            <li
              key={e.id}
              style={{
                padding: "var(--s-3) var(--s-4)",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderLeft: "3px solid var(--danger-500)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "var(--s-3)",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 4,
                    }}
                  >
                    <span className="users-tag --susp">
                      {SOURCE_LABEL[e.source] ?? e.source}
                    </span>
                    {e.context && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--ink-3)",
                        }}
                      >
                        {e.context}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {fmtWhen(e.created_at)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--ink-1)",
                      fontSize: "var(--t-body-s)",
                      wordBreak: "break-word",
                    }}
                  >
                    {e.message}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                    {e.user_email
                      ? `User: ${e.user_email}`
                      : e.user_id
                        ? `User #${e.user_id}`
                        : "User: —"}
                    {e.seed_id ? ` · Seed #${e.seed_id}` : ""}
                  </div>
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
                <form action={deleteErrorLogEntry}>
                  <input type="hidden" name="id" value={e.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
