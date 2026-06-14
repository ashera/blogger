// The "blogging agent" persona. Defining the brand profile trains this agent;
// it gets a face (auto-assigned avatar) and an editable name. Pure module
// (no server deps) so client and server can both use it.

export const AGENT_AVATAR_COUNT = 10;

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

/** Display name for the agent — the trained name, or a friendly fallback. */
export function agentDisplayName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n.length > 0 ? n : "your agent";
}
