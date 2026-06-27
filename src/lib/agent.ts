// The "blogging agent" persona. Each agent is a brand profile (voice, humour,
// stats, …) plus an identity: a name and a chosen avatar. A user keeps a
// stable of several. Pure module (no server deps) so client and server can
// both use it.

import type { BrandProfile } from "./brand-score";

export const AGENT_AVATAR_COUNT = 10;

/** A brand profile plus its agent identity (one row in brand_profiles). */
export type Agent = BrandProfile & {
  id: string;
  /** Chosen avatar (index into the bundled set); null → derive from id. */
  avatarIndex: number | null;
  /** The agent used when a seed doesn't name one. One per user. */
  isDefault: boolean;
};

/** Stable small hash of a string → non-negative int. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Auto-assigned avatar for an agent, derived deterministically from a stable
 * seed (the user id) so it never changes out from under the user.
 */
export function agentAvatarSrc(seed: string | null | undefined): string {
  const idx = hashString(seed && seed.length > 0 ? seed : "agent") % AGENT_AVATAR_COUNT;
  return `/avatars/agent-${idx}.jpg`;
}

/** Path to a specific avatar by index (0…AGENT_AVATAR_COUNT-1). */
export function avatarSrcByIndex(index: number): string {
  const i = ((index % AGENT_AVATAR_COUNT) + AGENT_AVATAR_COUNT) % AGENT_AVATAR_COUNT;
  return `/avatars/agent-${i}.jpg`;
}

/**
 * Avatar for an agent: the chosen index if set, otherwise a stable hash of
 * the agent id so each agent still gets a distinct, unchanging face.
 */
export function agentAvatar(
  avatarIndex: number | null | undefined,
  agentId: string | null | undefined,
): string {
  if (typeof avatarIndex === "number") return avatarSrcByIndex(avatarIndex);
  return agentAvatarSrc(agentId);
}

/** Display name for the agent — the trained name, or a friendly fallback. */
export function agentDisplayName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n.length > 0 ? n : "your agent";
}
