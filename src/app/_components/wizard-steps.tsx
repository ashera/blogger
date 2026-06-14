import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadBrandProfile } from "@/lib/brand-profile";
import { agentAvatarSrc } from "@/lib/agent";

// Wizard step order mirrors STEP_ORDER in blog-builder.ts. "done" is the
// terminal state once at least one instance has been generated.
const STEP_ORDER = ["keywords", "cluster", "serp", "images", "generate", "done"];

export type WizardStepKey =
  | "keywords"
  | "cluster"
  | "serp"
  | "images"
  | "generate";

const STEPS: Array<{ key: WizardStepKey; label: string; sub: string }> = [
  { key: "keywords", label: "Keywords", sub: "Starter phrases" },
  { key: "cluster", label: "Cluster", sub: "Review the set" },
  { key: "serp", label: "Analysis", sub: "SERP research" },
  { key: "images", label: "Images", sub: "Pexels pool" },
  { key: "generate", label: "Generate", sub: "Blog instances" },
];

function stepHref(seedId: string, key: WizardStepKey): string {
  return `/app/seeds/${seedId}/${key}`;
}

/**
 * Wizard chrome shared by every step page: back link, seed title header, the
 * step indicator, and the page-specific children. `reached` is the seed's
 * persisted wizard_step (the furthest step unlocked); steps at or before it
 * are navigable, later ones are locked.
 */
export async function WizardShell({
  seedId,
  title,
  current,
  reached,
  children,
}: {
  seedId: string;
  title: string;
  current: WizardStepKey;
  reached: string;
  children: ReactNode;
}) {
  const reachedIdx = Math.max(0, STEP_ORDER.indexOf(reached));
  const currentNumber = STEPS.findIndex((s) => s.key === current) + 1;

  // Keep the blogging agent present through the whole seeding flow.
  const me = await getCurrentUser();
  const profile = me ? await loadBrandProfile(me.id) : null;
  const agentName = profile?.agentName?.trim();
  const agentTrained = Boolean(profile?.voice?.trim() || agentName);

  return (
    <div className="page admin-page" style={{ maxWidth: 880 }}>
      <Link href="/app/seeds" className="back-link">
        ← All seeds
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          margin: "var(--s-2) 0 var(--s-5)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={agentAvatarSrc(me?.id ?? null)}
          alt=""
          width={48}
          height={48}
          style={{ borderRadius: 12, display: "block", flex: "none" }}
          title={agentName ? `${agentName}, your blogging agent` : "Your blogging agent"}
        />
        <header className="admin-header" style={{ margin: 0 }}>
          <p className="eyebrow">
            Seed wizard · Step {currentNumber} of {STEPS.length} ·{" "}
            {agentName ? `with ${agentName}` : "with your agent"}
            {!agentTrained && (
              <>
                {" "}
                ·{" "}
                <Link href="/app/brand" style={{ color: "var(--volt-700)" }}>
                  train your agent
                </Link>
              </>
            )}
          </p>
          <h1>{title}</h1>
        </header>
      </div>

      <ol
        style={{
          listStyle: "none",
          display: "flex",
          gap: 8,
          padding: 0,
          margin: "0 0 var(--s-6)",
          flexWrap: "wrap",
        }}
      >
        {STEPS.map((step, i) => {
          const navigable = i <= reachedIdx;
          const isComplete = i < reachedIdx;
          const isCurrent = step.key === current;
          const circle = isComplete ? "✓" : String(i + 1);

          const inner = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 10,
                background: isCurrent
                  ? "var(--volt-50)"
                  : isComplete
                    ? "var(--surface)"
                    : "var(--surface-sunken)",
                border: `1px solid ${
                  isCurrent
                    ? "var(--volt-300)"
                    : isComplete
                      ? "var(--volt-300)"
                      : "var(--hairline)"
                }`,
                opacity: navigable ? 1 : 0.55,
                minWidth: 150,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: isComplete
                    ? "var(--ink-1)"
                    : isCurrent
                      ? "var(--volt-300)"
                      : "transparent",
                  color: isComplete
                    ? "var(--paper)"
                    : isCurrent
                      ? "var(--ink-1)"
                      : "var(--ink-3)",
                  border:
                    isComplete || isCurrent ? "0" : "1px solid var(--hairline)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {circle}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "var(--t-body-s)",
                    color: navigable ? "var(--ink-1)" : "var(--ink-3)",
                  }}
                >
                  {step.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {step.sub}
                </div>
              </div>
            </div>
          );

          return (
            <li key={step.key} style={{ flex: "1 1 150px" }}>
              {navigable && !isCurrent ? (
                <Link
                  href={stepHref(seedId, step.key)}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>

      {children}
    </div>
  );
}

/** Saved / error banner shared by the step pages. */
export function WizardNotice({
  saved,
  errorMessage,
  errorDetail,
}: {
  saved?: boolean;
  errorMessage?: string | null;
  errorDetail?: string | null;
}) {
  if (!saved && !errorMessage) return null;
  return (
    <>
      {saved && !errorMessage && (
        <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
          Saved.
        </p>
      )}
      {errorMessage && (
        <div className="form-error" style={{ marginBottom: "var(--s-5)" }}>
          <p style={{ margin: 0 }}>{errorMessage}</p>
          {errorDetail && (
            <details style={{ marginTop: 8 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Show error details
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-2)",
                  maxHeight: 280,
                  overflow: "auto",
                }}
              >
                {errorDetail}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );
}

// Generic, provider-agnostic failure message. Anything that goes wrong with an
// external service shows THIS — never the provider name or raw error text. The
// real detail is captured in the admin error log instead.
const SERVICE_ERROR =
  "Something went wrong on our end. Please try again — if it keeps happening, contact support for help.";

/** Shared error-code → message map for all wizard step pages. */
export const WIZARD_ERRORS: Record<string, string> = {
  // User-actionable validation (safe to be specific).
  "invalid-title": "A title is required.",
  "invalid-phrase": "Keyword must be 2–200 characters.",
  "empty-starters": "Enter at least one starter keyword.",
  "cant-remove-primary":
    "You can't drop the primary keyword. Regenerate the cluster from different starters to change it.",
  "missing-serp": "Run the SERP analysis before generating a post.",
  "missing-images": "Include at least one hero image before generating a post.",
  "no-pexels-results":
    "No more photos for this phrase. Try a related keyword.",
  // Generic external-service failures — never leak the provider.
  "service-error": SERVICE_ERROR,
  "no-pexels-key": SERVICE_ERROR,
  "pexels-error": SERVICE_ERROR,
  truncated:
    "That draft didn't generate cleanly this time. Please try again — if it keeps happening, contact support for help.",
};
