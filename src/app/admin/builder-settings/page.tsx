import { Fragment } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  loadBlogBuilderSettings,
  DEFAULT_BLOG_BUILDER_SETTINGS,
} from "@/lib/blog-builder-settings";
import {
  saveBlogBuilderSettings,
  resetBlogBuilderSettings,
} from "@/lib/actions/blog-builder-settings";
import {
  loadRateLimits,
  RATE_ACTIONS,
  RATE_ACTION_LABEL,
} from "@/lib/rate-limit";
import { Button, Field, Input } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function BlogBuilderBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; reset?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = await loadBlogBuilderSettings();
  const limits = await loadRateLimits();

  return (
    <div className="page admin-page" style={{ maxWidth: 880 }}>
      <Link href="/admin" className="back-link">
        ← Admin console
      </Link>

      <header className="admin-header">
        <p className="eyebrow">Admin · Generation limits</p>
        <h1>Generation limits</h1>
        <p className="sub">
          Cap how big each AI response can be. (Editorial inputs — voice,
          audience, point of view — come from each user&rsquo;s{" "}
          <Link href="/app/agents">brand profile</Link>, not from here.)
        </p>
      </header>

      {sp.saved && (
        <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
          Saved.
        </p>
      )}
      {sp.reset && (
        <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
          Reset to defaults.
        </p>
      )}

      <section className="form-card" style={{ marginBottom: "var(--s-7)" }}>
        <h2 className="card-heading">How these work</h2>
        <p>
          Each generation call consumes &ldquo;input tokens per minute&rdquo;
          (ITPM) from the Anthropic rate-limit pool. Anthropic counts both the
          prompt size <em>and</em> the maximum response length you ask for,{" "}
          <strong>up front</strong>, against that cap. Tier 1 allows{" "}
          <strong>10,000 ITPM</strong>; exceeding it in a 60-second window
          returns a <code>429 rate_limit_error</code>.
        </p>
        <p>
          Lowering the <code>max_tokens</code> caps below is the single biggest
          lever for staying under the limit — Anthropic reserves the full
          amount even when the model returns a shorter response. Roughly{" "}
          <strong>4 characters ≈ 1 token</strong>.
        </p>
      </section>

      <form action={saveBlogBuilderSettings}>
        <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
          <h2 className="card-heading">Output limits (max tokens)</h2>
          <p className="card-sub">
            Caps on each response length, in tokens.
          </p>

          <Field
            label="Post max tokens"
            htmlFor="postMaxTokens"
            help="3,000 fits ~1,800 words plus the JSON tool-call wrapping. Lower if you keep hitting 429; raise if posts come back truncated."
          >
            <Input
              id="postMaxTokens"
              name="postMaxTokens"
              type="number"
              min={500}
              max={8192}
              step={100}
              defaultValue={String(settings.postMaxTokens)}
              required
            />
          </Field>

          <Field
            label="SERP analysis max tokens"
            htmlFor="serpMaxTokens"
            help="Caps the SERP analysis JSON response. ~3,500 is normally enough for a 3-result analysis."
          >
            <Input
              id="serpMaxTokens"
              name="serpMaxTokens"
              type="number"
              min={500}
              max={8192}
              step={100}
              defaultValue={String(settings.serpMaxTokens)}
              required
            />
          </Field>

          <Field
            label="Cluster keywords max tokens"
            htmlFor="clusterMaxTokens"
            help="Caps the keyword-cluster generation response. 1,500 fits a typical 8–14 keyword cluster."
          >
            <Input
              id="clusterMaxTokens"
              name="clusterMaxTokens"
              type="number"
              min={500}
              max={4096}
              step={100}
              defaultValue={String(settings.clusterMaxTokens)}
              required
            />
          </Field>
        </section>

        <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
          <h2 className="card-heading">Rate limits (per user)</h2>
          <p className="card-sub">
            How many of each metered call a single user may make. Stops anyone
            running up excessive AI / image calls. A short burst cap (per
            minute) plus a daily cap.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 120px",
              gap: "var(--s-3)",
              alignItems: "center",
              marginTop: "var(--s-3)",
            }}
          >
            <span />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              Per minute
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              Per day
            </span>
            {RATE_ACTIONS.map((a) => (
              <Fragment key={a}>
                <label htmlFor={`rl_${a}_min`} style={{ fontWeight: 600, color: "var(--ink-1)" }}>
                  {RATE_ACTION_LABEL[a]}
                </label>
                <Input
                  id={`rl_${a}_min`}
                  name={`rl_${a}_min`}
                  type="number"
                  min={1}
                  max={240}
                  step={1}
                  defaultValue={String(limits[a].perMinute)}
                  required
                />
                <Input
                  id={`rl_${a}_day`}
                  name={`rl_${a}_day`}
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  defaultValue={String(limits[a].perDay)}
                  required
                />
              </Fragment>
            ))}
          </div>
        </section>

        <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
          <h2 className="card-heading">Tuning guide</h2>
          <ul style={{ paddingLeft: "1.2em", lineHeight: 1.6 }}>
            <li>
              <strong>Hitting 429 errors regularly?</strong> Lower &ldquo;Post
              max tokens&rdquo; first — each 1,000 tokens shaved buys real
              headroom.
            </li>
            <li>
              <strong>Posts coming back truncated?</strong> Raise &ldquo;Post
              max tokens&rdquo; — but watch your rate-limit headroom.
            </li>
            <li>
              <strong>Want to run two generations back-to-back?</strong> Each
              call (input + max_tokens) needs to fit under your tier&rsquo;s
              ITPM cap — with tier 1 (10k ITPM) that means staying under ~5k
              tokens per call.
            </li>
            <li>
              <strong>Posts feel generic / off-voice?</strong> That&rsquo;s the{" "}
              <Link href="/app/agents">brand profile</Link>, not these limits —
              flesh out the voice, audience, and point-of-view fields.
            </li>
          </ul>
        </section>

        <div
          style={{
            display: "flex",
            gap: "var(--s-3)",
            justifyContent: "flex-end",
          }}
        >
          <Button type="submit" variant="primary" iconRight="check">
            Save
          </Button>
        </div>
      </form>

      <form
        action={resetBlogBuilderSettings}
        style={{ marginTop: "var(--s-5)" }}
      >
        <p className="card-sub" style={{ marginBottom: "var(--s-2)" }}>
          Reset everything to: post max tokens{" "}
          {DEFAULT_BLOG_BUILDER_SETTINGS.postMaxTokens}, SERP max tokens{" "}
          {DEFAULT_BLOG_BUILDER_SETTINGS.serpMaxTokens}, cluster max tokens{" "}
          {DEFAULT_BLOG_BUILDER_SETTINGS.clusterMaxTokens}.
        </p>
        <Button type="submit" variant="ghost" size="sm">
          Reset to defaults
        </Button>
      </form>
    </div>
  );
}
