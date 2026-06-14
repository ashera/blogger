import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/email";
import { PLANS, PLAN_KEYS, planKey, type PlanKey } from "@/lib/plans";
import { getPlanUsage } from "@/lib/plan";
import { ButtonLink, Icon } from "../_components/ui";

export const dynamic = "force-dynamic";

const RECOMMENDED: PlanKey = "starter";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();
  const title = "Pricing — BlogSeeder";
  const description =
    "Simple plans for AI-written, SEO-focused blog posts in your brand's voice. Start free, upgrade as you publish more.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/pricing` },
    openGraph: { type: "website", url: `${baseUrl}/pricing`, title, description, siteName: "BlogSeeder" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PricingPage() {
  const user = await getCurrentUser();
  const current: PlanKey | null = user ? planKey(user.plan) : null;
  const usage = user ? await getPlanUsage(user.id, user.plan) : null;

  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--s-6)", textAlign: "center" }}>
          <p className="eyebrow" style={{ margin: 0, color: "var(--ink-3)" }}>
            Pricing
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--t-h1)",
              color: "var(--ink-1)",
              margin: "var(--s-2) 0 var(--s-3)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Pay for the posts you publish
          </h1>
          <p
            style={{
              color: "var(--ink-2)",
              fontSize: "var(--t-body-l)",
              margin: "0 auto",
              maxWidth: 620,
              lineHeight: 1.55,
            }}
          >
            Every plan trains a blogging agent, researches live search results,
            and writes complete posts in your voice. Pick a plan by how many
            posts you want each month — upgrade or downgrade anytime.
          </p>
        </header>

        {usage && current && (
          <p
            style={{
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: "var(--t-body-s)",
              margin: "0 0 var(--s-5)",
            }}
          >
            You&rsquo;re on the <strong>{PLANS[current].name}</strong> plan —{" "}
            {usage.used} of {usage.limit} posts used this month.
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--s-4)",
            alignItems: "stretch",
          }}
        >
          {PLAN_KEYS.map((key) => {
            const plan = PLANS[key];
            const isCurrent = current === key;
            const isRecommended = key === RECOMMENDED;
            return (
              <section
                key={key}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--surface)",
                  border: isRecommended
                    ? "2px solid var(--volt-500, var(--ink-1))"
                    : "1px solid var(--hairline)",
                  borderRadius: 16,
                  padding: "var(--s-5)",
                }}
              >
                {isRecommended && (
                  <span
                    style={{
                      position: "absolute",
                      top: -11,
                      left: "var(--s-5)",
                      background: "var(--volt-500, var(--ink-1))",
                      color: "white",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    Most popular
                  </span>
                )}

                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--t-h3)",
                    color: "var(--ink-1)",
                    margin: 0,
                  }}
                >
                  {plan.name}
                </h2>
                <p
                  style={{
                    margin: "var(--s-2) 0 0",
                    color: "var(--ink-1)",
                    fontWeight: 700,
                    fontSize: "var(--t-h2)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {plan.priceLabel}
                </p>
                <p
                  style={{
                    margin: "var(--s-2) 0 var(--s-4)",
                    color: "var(--ink-2)",
                    fontSize: "var(--t-body-s)",
                    lineHeight: 1.5,
                    minHeight: "2.6em",
                  }}
                >
                  {plan.blurb}
                </p>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 var(--s-5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    flex: 1,
                  }}
                >
                  {plan.highlights.map((h) => (
                    <li
                      key={h}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        color: "var(--ink-2)",
                        fontSize: "var(--t-body-s)",
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: "var(--ok-600, var(--ink-1))", flexShrink: 0 }}>
                        <Icon name="check" size="sm" />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <span
                    style={{
                      textAlign: "center",
                      padding: "10px 14px",
                      borderRadius: 999,
                      border: "1px solid var(--hairline)",
                      color: "var(--ink-3)",
                      fontWeight: 600,
                      fontSize: "var(--t-body-s)",
                    }}
                  >
                    Your current plan
                  </span>
                ) : user ? (
                  <ButtonLink
                    href="/pricing#change-plan"
                    variant={isRecommended ? "dark" : "ghost"}
                    block
                  >
                    {key === "free" ? "Downgrade" : "Upgrade"}
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    href="/register"
                    variant={isRecommended ? "dark" : "ghost"}
                    block
                  >
                    {key === "free" ? "Start free" : "Get started"}
                  </ButtonLink>
                )}
              </section>
            );
          })}
        </div>

        <section
          id="change-plan"
          style={{
            marginTop: "var(--s-7)",
            background: "var(--surface-2, var(--surface))",
            border: "1px solid var(--hairline)",
            borderRadius: 12,
            padding: "var(--s-4) var(--s-5)",
            color: "var(--ink-2)",
            fontSize: "var(--t-body-s)",
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--ink-1)" }}>
              Self-serve checkout is coming soon.
            </strong>{" "}
            We&rsquo;re wiring up card payments. In the meantime, plan changes
            are handled for you — get in touch and we&rsquo;ll switch you over.
            Your monthly post allowance resets on the 1st.
          </p>
        </section>
      </main>
    </div>
  );
}
