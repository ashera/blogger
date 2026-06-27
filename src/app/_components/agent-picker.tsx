import {
  agentAvatar,
  agentBio,
  summarizeText,
  type Agent,
} from "@/lib/agent";

/**
 * Rich agent selector: a radio-card per agent showing the avatar, name, default
 * badge, and a mini bio — a snippet of its voice and the audience it targets —
 * so a user connects with *who* they're picking, not just a name. Pure radios +
 * CSS (`:has`), so it works inside a server-action form with no client JS.
 * Submits `name` (default "agentId") as the chosen agent id.
 */
export function AgentPicker({
  agents,
  selectedId,
  name = "agentId",
}: {
  agents: Agent[];
  selectedId?: string;
  name?: string;
}) {
  return (
    <div className="agent-picker">
      {agents.map((a) => {
        const display = a.agentName?.trim() || "Untitled agent";
        const bio = agentBio(a.voice, a.bio);
        const audience = summarizeText(a.audience);
        return (
          <label key={a.id} className="agent-option">
            <input
              type="radio"
              name={name}
              value={a.id}
              defaultChecked={a.id === selectedId}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={agentAvatar(a.avatarIndex, a.id)}
              alt=""
              width={44}
              height={44}
              className="agent-option__avatar"
            />
            <span className="agent-option__body">
              <span className="agent-option__name">
                {display}
                {a.isDefault && (
                  <span className="agent-option__badge">Default</span>
                )}
              </span>
              {/* Collapsed: one-line teaser. */}
              <span className="agent-option__teaser">
                {bio || audience || "No bio yet"}
              </span>
              {/* Selected: full bio + audience. */}
              <span className="agent-option__detail">
                <span
                  className={`agent-option__meta${bio ? "" : " agent-option__meta--empty"}`}
                >
                  <span className="agent-option__meta-label">Bio</span>
                  <span className="agent-option__meta-value">
                    {bio || "No bio yet — retrain to add one"}
                  </span>
                </span>
                <span
                  className={`agent-option__meta${audience ? "" : " agent-option__meta--empty"}`}
                >
                  <span className="agent-option__meta-label">Audience</span>
                  <span className="agent-option__meta-value">
                    {audience || "No audience set yet"}
                  </span>
                </span>
              </span>
            </span>
            <span className="agent-option__check" aria-hidden />
          </label>
        );
      })}
    </div>
  );
}
