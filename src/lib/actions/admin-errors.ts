"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

const ERRORS = "/admin/errors";

export async function clearErrorLog(): Promise<void> {
  await requireAdmin();
  await query(`DELETE FROM error_log`);
  revalidatePath(ERRORS);
  redirect(ERRORS);
}

export async function deleteErrorLogEntry(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (/^\d+$/.test(id)) {
    await query(`DELETE FROM error_log WHERE id = $1::bigint`, [id]);
  }
  revalidatePath(ERRORS);
  redirect(ERRORS);
}
