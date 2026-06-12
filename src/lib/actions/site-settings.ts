"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  loadSiteSettings,
  setMaintenanceAt,
  updateSiteSettings,
} from "@/lib/site-settings";

const PAGE_PATH = "/admin/site-settings";

export async function saveSiteSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const current = await loadSiteSettings();
  const allowIndexing = formData.get("allow_indexing") === "on";
  await updateSiteSettings({
    allowIndexing,
    // maintenance_at is owned by updateMaintenanceMode — leave it
    // untouched here so saving the indexing form doesn't accidentally
    // cancel a scheduled window.
    maintenanceAt: current.maintenanceAt,
  });

  // The metadata layout function reads site_settings on every request,
  // and so does /robots.txt. Touch the root + robots so any cached
  // versions invalidate immediately.
  revalidatePath("/", "layout");
  revalidatePath("/robots.txt");

  redirect(`${PAGE_PATH}?saved=1`);
}

/** Schedule, activate, or cancel maintenance mode. Single action,
 *  three modes: 'now' flips the gate immediately, 'schedule' sets a
 *  countdown N minutes out, 'cancel' clears any active or pending
 *  window. */
export async function updateMaintenanceMode(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const mode = String(formData.get("mode") ?? "");

  let next: Date | null = null;
  if (mode === "now") {
    next = new Date();
  } else if (mode === "schedule") {
    const minutes = Number.parseInt(
      String(formData.get("minutes") ?? ""),
      10,
    );
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      redirect(`${PAGE_PATH}?maintenance=invalid`);
    }
    next = new Date(Date.now() + minutes * 60_000);
  } else if (mode === "cancel") {
    next = null;
  } else {
    redirect(`${PAGE_PATH}?maintenance=invalid`);
  }

  await setMaintenanceAt(next);

  revalidatePath("/", "layout");
  redirect(
    `${PAGE_PATH}?maintenance=${
      mode === "cancel" ? "cancelled" : mode === "now" ? "activated" : "scheduled"
    }`,
  );
}
