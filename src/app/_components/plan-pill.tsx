import Link from "next/link";
import type { PlanUsage } from "@/lib/plan";
import { LocalTime } from "./local-time";

/** ok = plenty left · warn = ≥80% used · limit = nothing left. */
export type UsageLevel = "ok" | "warn" | "limit";

export function usageLevel(usage: PlanUsage): UsageLevel {
  if (usage.atLimit) return "limit";
  const pct = usage.used / Math.max(1, usage.limit);
  return pct >= 0.8 ? "warn" : "ok";
}

function usedPct(usage: PlanUsage): number {
  return Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));
}

function upgradeLabel(usage: PlanUsage): string {
  return usage.plan.key === "pro" ? "View plans" : "Upgrade plan";
}

/**
 * Glanceable plan + remaining-quota pill for the desktop menubar. Links to
 * /pricing. The meter and accent shift green → amber → red as the monthly
 * quota runs down; at the limit it reads "Upgrade". Hidden on mobile (the
 * fuller PlanSummary block carries the info inside the menu panel there).
 */
export function PlanPill({ usage }: { usage: PlanUsage }) {
  const level = usageLevel(usage);
  const pct = usedPct(usage);
  return (
    <Link
      href="/pricing"
      className={`plan-pill plan-pill--${level}`}
      title={`${usage.plan.name} plan — ${usage.used} of ${usage.limit} posts used this month`}
    >
      <span className="plan-pill__name">
        {usage.plan.pillLabel ?? usage.plan.name}
      </span>
      <span className="plan-pill__sep" aria-hidden>
        ·
      </span>
      {usage.atLimit ? (
        <span className="plan-pill__cta">Upgrade</span>
      ) : (
        <span className="plan-pill__count">
          {usage.used}/{usage.limit}
        </span>
      )}
      <span className="plan-pill__meter" aria-hidden>
        <span className="plan-pill__fill" style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

/**
 * Fuller plan/usage block shown at the top of the avatar dropdown (and inline
 * in the hamburger panel on mobile): plan name, meter, posts remaining, reset
 * date, and an upgrade link.
 */
export function PlanSummary({
  usage,
  resetIso,
}: {
  usage: PlanUsage;
  resetIso: string;
}) {
  const level = usageLevel(usage);
  const pct = usedPct(usage);
  return (
    <div className={`avatar-plan avatar-plan--${level}`}>
      <div className="avatar-plan__eyebrow">{usage.plan.name} plan</div>
      <div className="avatar-plan__meter" aria-hidden>
        <span className="avatar-plan__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="avatar-plan__line">
        <strong>
          {usage.remaining} of {usage.limit}
        </strong>{" "}
        {usage.remaining === 1 ? "post" : "posts"} left · resets{" "}
        <LocalTime iso={resetIso} options={{ month: "short", day: "numeric" }} />
      </div>
      <Link href="/pricing" className="avatar-plan__cta">
        {upgradeLabel(usage)} →
      </Link>
    </div>
  );
}
