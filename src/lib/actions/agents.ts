"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createAgent,
  deleteAgent,
  setDefaultAgent,
  setSeedAgent,
} from "@/lib/agents";

const AGENTS = "/app/agents";

function seedId(formData: FormData): string | null {
  const raw = String(formData.get("seedId") ?? "").trim();
  return /^\d+$/.test(raw) ? raw : null;
}
function agentId(formData: FormData): string | null {
  const raw = String(formData.get("agentId") ?? "").trim();
  return /^\d+$/.test(raw) ? raw : null;
}

/** Create a fresh agent and open its training wizard. */
export async function createAgentAction(): Promise<void> {
  const me = await requireUser(AGENTS);
  const id = await createAgent(me.id);
  revalidatePath(AGENTS);
  redirect(`${AGENTS}/${id}`);
}

export async function deleteAgentAction(formData: FormData): Promise<void> {
  const me = await requireUser(AGENTS);
  const id = agentId(formData);
  if (!id) redirect(AGENTS);
  const res = await deleteAgent(id, me.id);
  revalidatePath(AGENTS);
  revalidatePath("/app");
  redirect(res.ok ? AGENTS : `${AGENTS}?error=last-agent`);
}

export async function setDefaultAgentAction(formData: FormData): Promise<void> {
  const me = await requireUser(AGENTS);
  const id = agentId(formData);
  if (!id) redirect(AGENTS);
  await setDefaultAgent(id, me.id);
  revalidatePath(AGENTS);
  revalidatePath("/app");
  revalidatePath("/");
  redirect(AGENTS);
}

/** Reassign a seed to a different agent (from the seed page picker). */
export async function setSeedAgentAction(formData: FormData): Promise<void> {
  const me = await requireUser("/app/seeds");
  const sid = seedId(formData);
  const aid = agentId(formData);
  if (!sid || !aid) redirect("/app/seeds");
  await setSeedAgent(sid, me.id, aid);
  revalidatePath(`/app/seeds/${sid}`);
  redirect(`/app/seeds/${sid}`);
}
