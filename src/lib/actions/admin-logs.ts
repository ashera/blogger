"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

const LOGS = "/admin/logs";

/** Clear logs — all, or just one level when `level` is provided. */
export async function clearLogs(formData: FormData): Promise<void> {
  await requireAdmin();
  const level = String(formData.get("level") ?? "");
  if (level === "error" || level === "warn" || level === "info") {
    await query(`DELETE FROM error_log WHERE level = $1`, [level]);
  } else {
    await query(`DELETE FROM error_log`);
  }
  revalidatePath(LOGS);
  redirect(LOGS);
}

export async function deleteLogEntry(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (/^\d+$/.test(id)) {
    await query(`DELETE FROM error_log WHERE id = $1::bigint`, [id]);
  }
  revalidatePath(LOGS);
  redirect(LOGS);
}
