import { agentAvatar, type Agent } from "@/lib/agent";

/**
 * Rich agent selector: radio-card per agent showing the avatar, name, default
 * badge, and a summary of the audience it's trained for — so a user knows
 * *who* they're picking, not just a name. Pure radios + CSS (`:has`), so it
 * works inside a server-action form with no client JS. Submits `name`
 * (default "agentId") as the chosen agent id.
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
        const audience = a.audience?.trim();
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
              <span
                className={`agent-option__aud${audience ? "" : " agent-option__aud--empty"}`}
              >
                {audience ? (
                  <>
                    <span className="agent-option__aud-label">Audience:</span>{" "}
                    {audience}
                  </>
                ) : (
                  "No audience set yet"
                )}
              </span>
            </span>
            <span className="agent-option__check" aria-hidden />
          </label>
        );
      })}
    </div>
  );
}
