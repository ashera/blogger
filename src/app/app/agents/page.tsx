import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAgents } from "@/lib/agents";
import { assessBrand } from "@/lib/brand-score";
import { agentAvatar } from "@/lib/agent";
import {
  createAgentAction,
  deleteAgentAction,
  setDefaultAgentAction,
} from "@/lib/actions/agents";
import { Button, ButtonLink } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My agents" };

const ERRORS: Record<string, string> = {
  "last-agent": "You can't delete your only agent — create another first.",
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireUser("/app/agents");
  const { error } = await searchParams;
  const errorMessage = error ? ERRORS[error] ?? "Something went wrong." : null;
  const agents = await listAgents(me.id);

  return (
    <div className="page admin-page" style={{ maxWidth: 880 }}>
      <header className="admin-header">
        <p className="eyebrow">Your stable</p>
        <h1>My agents</h1>
        <p className="sub">
          Each agent is a distinct writing persona — its own voice, humour,
          point of view, facts, and avatar. Train several and pick which one
          writes each seed.
        </p>
      </header>

      {errorMessage && (
        <div className="form-error" style={{ marginBottom: "var(--s-5)" }}>
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      <form action={createAgentAction} style={{ marginBottom: "var(--s-5)" }}>
        <Button type="submit" variant="primary" icon="plus">
          New agent
        </Button>
      </form>

      {agents.length === 0 ? (
        <div className="empty-state">
          <h3>No agents yet</h3>
          <p style={{ margin: 0 }}>
            Create your first agent and train its voice to start generating
            posts.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "var(--s-3)",
          }}
        >
          {agents.map((a) => {
            const score = assessBrand(a);
            const name = a.agentName?.trim() || "Untitled agent";
            return (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-3)",
                  padding: "var(--s-4)",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-3)",
                    minWidth: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agentAvatar(a.avatarIndex, a.id)}
                    alt=""
                    width={48}
                    height={48}
                    style={{ borderRadius: 12, display: "block", flex: "none" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 16,
                          color: "var(--ink-1)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {name}
                      </strong>
                      {a.isDefault && (
                        <span
                          style={{
                            flex: "none",
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--volt-700)",
                            border: "1px solid var(--volt-300)",
                            borderRadius: 999,
                            padding: "1px 6px",
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                      {a.brandName?.trim() || "No brand set"}
                    </div>
                  </div>
                </div>

                {/* training meter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--ink-3)",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Trained
                    </span>
                    <strong style={{ color: "var(--ink-1)" }}>
                      {score.percent}%
                    </strong>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: "var(--surface-sunken)",
                      border: "1px solid var(--hairline)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${score.percent}%`,
                        height: "100%",
                        background:
                          score.percent >= 70
                            ? "var(--volt-300)"
                            : score.percent >= 40
                              ? "var(--warn-500)"
                              : "var(--danger-500)",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: "auto",
                  }}
                >
                  <ButtonLink
                    href={`/app/seeds?agent=${a.id}`}
                    variant="primary"
                    size="sm"
                    icon="plus"
                    title={`Start a new blog seed written by ${name}`}
                  >
                    New seed
                  </ButtonLink>
                  <ButtonLink
                    href={`/app/agents/${a.id}`}
                    variant="ghost"
                    size="sm"
                  >
                    Train
                  </ButtonLink>
                  {!a.isDefault && (
                    <form action={setDefaultAgentAction}>
                      <input type="hidden" name="agentId" value={a.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Make default
                      </Button>
                    </form>
                  )}
                  {agents.length > 1 && (
                    <form action={deleteAgentAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="agentId" value={a.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        title="Delete this agent. Seeds using it fall back to your default agent."
                      >
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
