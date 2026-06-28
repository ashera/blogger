"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { AgentPicker } from "./agent-picker";
import { agentAvatar, agentBio, summarizeText, type Agent } from "@/lib/agent";

/**
 * Author selector: shows the current agent as a card, with a button that opens
 * a centered "Agent Picker" modal to switch to another. Two modes:
 *  - field mode (default): renders a hidden input so the SURROUNDING form
 *    submits the chosen agent id (e.g. the New Seed form).
 *  - submit mode: pass `action` (+ optional `hidden` fields, e.g. seedId) and
 *    confirming in the modal submits that server action (e.g. reassign a seed).
 */
export function AuthorSelect({
  agents,
  initialSelectedId,
  fieldName = "agentId",
  action,
  hidden,
  changeLabel = "Change author",
  showCurrent = true,
}: {
  agents: Agent[];
  initialSelectedId: string;
  fieldName?: string;
  action?: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  changeLabel?: string;
  showCurrent?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [temp, setTemp] = useState(initialSelectedId);
  const [open, setOpen] = useState(false);
  const current = agents.find((a) => a.id === selectedId) ?? agents[0] ?? null;

  function openModal() {
    setTemp(selectedId);
    setOpen(true);
  }
  function confirmField() {
    setSelectedId(temp);
    setOpen(false);
  }

  return (
    <div>
      {showCurrent && current && <CurrentAuthorCard agent={current} />}
      <button
        type="button"
        className="btn --ghost --sm"
        onClick={openModal}
        style={showCurrent ? { marginTop: "var(--s-3)" } : undefined}
      >
        {changeLabel}
      </button>

      {/* field mode: the surrounding form submits this id */}
      {!action && <input type="hidden" name={fieldName} value={selectedId} />}

      <Modal open={open} onClose={() => setOpen(false)} maxWidth={560}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            letterSpacing: "-0.01em",
            color: "var(--ink-1)",
            margin: "0 0 var(--s-2)",
          }}
        >
          Choose an agent
        </h2>
        <p
          style={{
            color: "var(--ink-3)",
            fontSize: 13.5,
            lineHeight: 1.5,
            margin: "0 0 var(--s-4)",
          }}
        >
          Pick the agent that writes this {action ? "seed" : "post"}.
        </p>

        {/* Radio change bubbles up here so we can track the choice. */}
        <div
          onChange={(e) => {
            const t = e.target as HTMLInputElement;
            if (t.type === "radio") setTemp(t.value);
          }}
        >
          <AgentPicker agents={agents} selectedId={temp} name="__author_pick" />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: "var(--s-5)",
          }}
        >
          <button
            type="button"
            className="btn --ghost"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          {action ? (
            <form action={action}>
              {hidden &&
                Object.entries(hidden).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
              <input type="hidden" name="agentId" value={temp} />
              <button type="submit" className="btn --primary">
                Use this agent
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="btn --primary"
              onClick={confirmField}
            >
              Use this agent
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}

function CurrentAuthorCard({ agent }: { agent: Agent }) {
  const name = agent.agentName?.trim() || "Untitled agent";
  const bio = agentBio(agent.voice, agent.bio);
  const audience = summarizeText(agent.audience, 140);
  return (
    <div className="author-current">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="author-current__avatar"
        src={agentAvatar(agent.avatarIndex, agent.id)}
        alt=""
        width={48}
        height={48}
      />
      <div style={{ minWidth: 0 }}>
        <div className="author-current__name">
          {name}
          {agent.isDefault && (
            <span className="agent-option__badge">Default</span>
          )}
        </div>
        {bio && <div className="author-current__bio">{bio}</div>}
        {audience && (
          <div className="author-current__aud">
            <span className="agent-option__meta-label">Audience</span> {audience}
          </div>
        )}
      </div>
    </div>
  );
}
