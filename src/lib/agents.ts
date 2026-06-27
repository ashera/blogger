import "server-only";
import { query, withTransaction } from "@/lib/db";
import type { Agent } from "@/lib/agent";
import type { BrandProfile } from "@/lib/brand-score";

/**
 * Agents = brand_profiles rows. A user keeps a stable of several, each with
 * its own voice/humour/stats/avatar. Seeds reference the agent that writes
 * them (blog_seeds.agent_id); generation loads that agent's profile.
 */

type Row = {
  id: string;
  brand_name: string | null;
  site_url: string | null;
  audience: string | null;
  voice: string | null;
  humour: string | null;
  perspective: string | null;
  stats: string | null;
  stories: string | null;
  avoid: string | null;
  agent_name: string | null;
  avatar_index: number | null;
  is_default: boolean;
  bio: string | null;
};

// Fully qualified (bp.*) so these columns stay unambiguous even when the
// query JOINs blog_seeds (which also has an `id`). Every query below aliases
// brand_profiles AS bp.
const SELECT_COLS = `bp.id::text AS id, bp.brand_name, bp.site_url, bp.audience,
  bp.voice, bp.humour, bp.perspective, bp.stats, bp.stories, bp.avoid,
  bp.agent_name, bp.avatar_index, bp.is_default, bp.bio`;

function toAgent(row: Row): Agent {
  return {
    id: row.id,
    brandName: row.brand_name,
    siteUrl: row.site_url,
    audience: row.audience,
    voice: row.voice,
    humour: row.humour,
    perspective: row.perspective,
    stats: row.stats,
    stories: row.stories,
    avoid: row.avoid,
    agentName: row.agent_name,
    avatarIndex: row.avatar_index,
    isDefault: row.is_default,
    bio: row.bio,
  };
}

/** All of a user's agents, default first then newest. */
export async function listAgents(userId: string): Promise<Agent[]> {
  try {
    const r = await query<Row>(
      `SELECT ${SELECT_COLS} FROM brand_profiles bp
        WHERE bp.user_id = $1::bigint
        ORDER BY bp.is_default DESC, bp.id ASC`,
      [userId],
    );
    return r.rows.map(toAgent);
  } catch {
    return [];
  }
}

/** One agent, scoped to its owner. Null if not found / not theirs. */
export async function loadAgent(
  agentId: string,
  userId: string,
): Promise<Agent | null> {
  if (!/^\d+$/.test(agentId)) return null;
  try {
    const r = await query<Row>(
      `SELECT ${SELECT_COLS} FROM brand_profiles bp
        WHERE bp.id = $1::bigint AND bp.user_id = $2::bigint LIMIT 1`,
      [agentId, userId],
    );
    return r.rows[0] ? toAgent(r.rows[0]) : null;
  } catch {
    return null;
  }
}

/** The user's default agent (or their first), or null if they have none. */
export async function getDefaultAgent(userId: string): Promise<Agent | null> {
  const all = await listAgents(userId);
  return all[0] ?? null;
}

export async function countAgents(userId: string): Promise<number> {
  try {
    const r = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM brand_profiles WHERE user_id = $1::bigint`,
      [userId],
    );
    return r.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * The agent that writes a given seed: the seed's chosen agent if still set,
 * else the user's default. Null only if the user has no agents at all.
 */
export async function loadSeedAgent(
  seedId: string,
  userId: string,
): Promise<Agent | null> {
  try {
    const r = await query<Row>(
      `SELECT ${SELECT_COLS} FROM brand_profiles bp
        JOIN blog_seeds s ON s.agent_id = bp.id
       WHERE s.id = $1::bigint AND s.user_id = $2::bigint
       LIMIT 1`,
      [seedId, userId],
    );
    if (r.rows[0]) return toAgent(r.rows[0]);
  } catch {
    /* fall through to default */
  }
  return getDefaultAgent(userId);
}

/**
 * Create a new agent for the user and return its id. The first agent a user
 * ever creates becomes their default.
 */
export async function createAgent(
  userId: string,
  init?: { agentName?: string | null; avatarIndex?: number | null },
): Promise<string> {
  return withTransaction(async (tx) => {
    const has = await tx.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM brand_profiles WHERE user_id = $1::bigint`,
      [userId],
    );
    const isFirst = (has.rows[0]?.n ?? 0) === 0;
    const r = await tx.query<{ id: string }>(
      `INSERT INTO brand_profiles
         (user_id, agent_name, avatar_index, is_default, created_at, updated_at)
       VALUES ($1::bigint, $2, $3, $4, NOW(), NOW())
       RETURNING id::text`,
      [userId, init?.agentName ?? null, init?.avatarIndex ?? null, isFirst],
    );
    return r.rows[0]!.id;
  });
}

/** Save the editorial content + avatar of an agent (scoped to its owner). */
export async function updateAgent(
  agentId: string,
  userId: string,
  profile: BrandProfile,
  avatarIndex: number | null,
): Promise<void> {
  await query(
    `UPDATE brand_profiles SET
        brand_name   = $3,
        site_url     = $4,
        audience     = $5,
        voice        = $6,
        humour       = $7,
        perspective  = $8,
        stats        = $9,
        stories      = $10,
        avoid        = $11,
        agent_name   = $12,
        avatar_index = $13,
        bio          = $14,
        updated_at   = NOW()
      WHERE id = $1::bigint AND user_id = $2::bigint`,
    [
      agentId,
      userId,
      profile.brandName,
      profile.siteUrl,
      profile.audience,
      profile.voice,
      profile.humour,
      profile.perspective,
      profile.stats,
      profile.stories,
      profile.avoid,
      profile.agentName,
      avatarIndex,
      profile.bio,
    ],
  );
}

/** Make one agent the user's default, clearing the flag on the rest. */
export async function setDefaultAgent(
  agentId: string,
  userId: string,
): Promise<void> {
  await withTransaction(async (tx) => {
    const owned = await tx.query<{ id: string }>(
      `SELECT id::text FROM brand_profiles
        WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
      [agentId, userId],
    );
    if (!owned.rows[0]) return;
    await tx.query(
      `UPDATE brand_profiles SET is_default = (id = $1::bigint), updated_at = NOW()
        WHERE user_id = $2::bigint`,
      [agentId, userId],
    );
  });
}

/**
 * Delete an agent. Seeds that used it fall back to the default (FK ON DELETE
 * SET NULL). If the deleted agent was the default, promote another. Refuses
 * to delete the user's last agent.
 */
export async function deleteAgent(
  agentId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  return withTransaction(async (tx) => {
    const all = await tx.query<{ id: string; is_default: boolean }>(
      `SELECT id::text, is_default FROM brand_profiles
        WHERE user_id = $1::bigint ORDER BY id ASC`,
      [userId],
    );
    if (all.rows.length <= 1) {
      return { ok: false, error: "You need at least one agent." };
    }
    const target = all.rows.find((a) => a.id === agentId);
    if (!target) return { ok: false, error: "Agent not found." };

    await tx.query(
      `DELETE FROM brand_profiles WHERE id = $1::bigint AND user_id = $2::bigint`,
      [agentId, userId],
    );

    if (target.is_default) {
      const next = all.rows.find((a) => a.id !== agentId);
      if (next) {
        await tx.query(
          `UPDATE brand_profiles SET is_default = TRUE, updated_at = NOW()
            WHERE id = $1::bigint`,
          [next.id],
        );
      }
    }
    return { ok: true };
  });
}

/** Reassign a seed to one of the user's agents (validates ownership). */
export async function setSeedAgent(
  seedId: string,
  userId: string,
  agentId: string,
): Promise<boolean> {
  const r = await query(
    `UPDATE blog_seeds s SET agent_id = $3::bigint, updated_at = NOW()
      WHERE s.id = $1::bigint AND s.user_id = $2::bigint
        AND EXISTS (
          SELECT 1 FROM brand_profiles bp
           WHERE bp.id = $3::bigint AND bp.user_id = $2::bigint
        )`,
    [seedId, userId, agentId],
  );
  return (r.rowCount ?? 0) > 0;
}
