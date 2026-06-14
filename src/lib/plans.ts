/**
 * Subscription plans. Pure data — safe to import from client or server.
 *
 * The value metric is **posts generated per calendar month**, because a
 * generated post is the thing that actually costs us money (the chain of
 * Anthropic calls behind it). Each tier raises that monthly quota and
 * unlocks features. Plan enforcement lives in src/lib/plan.ts (server).
 *
 * NOTE: prices/quotas here are the launch defaults — tune freely. There is
 * no payment processing yet; a user's plan is set by an admin (Stripe wiring
 * comes later).
 */
export type PlanKey = "free" | "starter" | "pro";

export type Plan = {
  key: PlanKey;
  name: string;
  /** Short label for the menubar quota pill. Falls back to `name`. */
  pillLabel?: string;
  /** Display price, e.g. "$0" or "$15/mo". */
  priceLabel: string;
  /** One-line positioning. */
  blurb: string;
  /** Posts a user may generate per calendar month. */
  monthlyPosts: number;
  /** Feature flags gated by plan. */
  features: {
    copyToSite: boolean;
    scheduling: boolean;
  };
  /** Bullets shown on the pricing page. */
  highlights: string[];
};

export const PLAN_KEYS: PlanKey[] = ["free", "starter", "pro"];

export const DEFAULT_PLAN: PlanKey = "free";

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    pillLabel: "Free Tier",
    priceLabel: "$0",
    blurb: "Try your blogging agent and publish a few posts.",
    monthlyPosts: 3,
    features: { copyToSite: false, scheduling: false },
    highlights: [
      "3 posts per month",
      "Train one blogging agent",
      "Publish to your BlogSeeder blog",
      "Keyword clusters & SERP research",
    ],
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceLabel: "$15/mo",
    blurb: "For a steady publishing cadence on your own site.",
    monthlyPosts: 20,
    features: { copyToSite: true, scheduling: true },
    highlights: [
      "20 posts per month",
      "Copy posts to your own website",
      "Schedule publishing",
      "Everything in Free",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceLabel: "$39/mo",
    blurb: "For content-led growth and higher volume.",
    monthlyPosts: 75,
    features: { copyToSite: true, scheduling: true },
    highlights: [
      "75 posts per month",
      "Priority generation",
      "Copy & schedule to your site",
      "Everything in Starter",
    ],
  },
};

/** Coerce any stored string into a known plan key, defaulting to free. */
export function planKey(value: string | null | undefined): PlanKey {
  return value === "starter" || value === "pro" ? value : DEFAULT_PLAN;
}

export function planFor(value: string | null | undefined): Plan {
  return PLANS[planKey(value)];
}
