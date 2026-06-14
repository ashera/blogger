import "server-only";
import { query } from "@/lib/db";
import { PLANS, planKey, type Plan, type PlanKey } from "@/lib/plans";

export type { PlanKey, Plan };
export { PLANS, planKey };

/**
 * Posts a user has generated in the current calendar month. This is the
 * durable billing meter: each *successful* post generation is a row in
 * blog_generation_attempts (status='success'). Unlike rate_events (which is
 * pruned after a couple of days for burst-limiting), attempts persist, so
 * counting them gives an accurate monthly total that resets on the 1st.
 */
export async function monthlyPostsUsed(userId: string): Promise<number> {
  try {
    const r = await query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM blog_generation_attempts a
         JOIN blog_instances i ON i.id = a.instance_id
         JOIN blog_seeds s     ON s.id = i.seed_id
        WHERE s.user_id = $1::bigint
          AND a.status = 'success'
          AND a.created_at >= date_trunc('month', NOW())`,
      [userId],
    );
    return r.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export type PlanUsage = {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  /** True once the user has used their whole monthly allowance. */
  atLimit: boolean;
};

/**
 * Build the plan + monthly-usage snapshot for a user. Pass the user's stored
 * plan string (from `user.plan`) to avoid an extra lookup.
 */
export async function getPlanUsage(
  userId: string,
  storedPlan: string | null | undefined,
): Promise<PlanUsage> {
  const plan = PLANS[planKey(storedPlan)];
  const used = await monthlyPostsUsed(userId);
  const limit = plan.monthlyPosts;
  const remaining = Math.max(0, limit - used);
  return { plan, used, limit, remaining, atLimit: used >= limit };
}
