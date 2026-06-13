import { requireUser } from "@/lib/auth";
import { loadBrandProfile } from "@/lib/brand-profile";
import { loadBrandSamples } from "@/lib/brand-samples";
import { BrandWizard } from "./brand-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand profile" };

export default async function BrandProfilePage() {
  const me = await requireUser("/app/brand");
  const profile = await loadBrandProfile(me.id);
  const samples = loadBrandSamples();
  return <BrandWizard initial={profile} samples={samples} />;
}
