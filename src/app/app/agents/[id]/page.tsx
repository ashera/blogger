import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadAgent } from "@/lib/agents";
import { BrandWizard } from "../../brand/brand-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Train agent" };

export default async function AgentWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser("/app/agents");
  const { id } = await params;
  const agent = await loadAgent(id, me.id);
  if (!agent) notFound();

  return (
    <BrandWizard
      agentId={agent.id}
      initial={agent}
      avatarIndex={agent.avatarIndex}
    />
  );
}
