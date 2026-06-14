"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { planKey } from "@/lib/plans";

const TITLES = new Set(["Mr", "Mrs", "Ms", "Mx", "Dr", "Prof"]);

function clean(formData: FormData, key: string, max: number): string | null {
  const v = String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
  return v.length > 0 ? v : null;
}

function getId(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  return raw;
}

export async function updateUserAsAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = getId(formData, "userId");
  if (!id) redirect("/admin/users");

  const titleRaw = clean(formData, "title", 16);
  const title = titleRaw && TITLES.has(titleRaw) ? titleRaw : null;
  const firstName = clean(formData, "first_name", 64);
  const surname = clean(formData, "surname", 64);

  await query(
    `UPDATE users
        SET title = $1,
            first_name = $2,
            surname = $3
      WHERE id = $4::bigint`,
    [title, firstName, surname, id],
  );

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?saved=1`);
}

/** Admin override of a user's subscription plan. (Until self-serve
 *  checkout exists, this is how plans get changed.) */
export async function setUserPlan(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = getId(formData, "userId");
  if (!id) redirect("/admin/users");

  const plan = planKey(String(formData.get("plan") ?? ""));

  await query(`UPDATE users SET plan = $1 WHERE id = $2::bigint`, [plan, id]);

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?saved=1`);
}

export async function toggleAdminRole(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = getId(formData, "userId");
  if (!id) redirect("/admin/users");

  // Don't let an admin demote themselves to avoid lockout.
  if (id === me.id) redirect(`/admin/users/${id}?error=self-demote`);

  await query(
    `UPDATE users SET is_admin = NOT is_admin WHERE id = $1::bigint`,
    [id],
  );

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?saved=1`);
}

export async function toggleUserSuspended(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = getId(formData, "userId");
  if (!id) redirect("/admin/users");

  // Don't let an admin suspend themselves.
  if (id === me.id) redirect(`/admin/users/${id}?error=self-suspend`);

  await query(
    `UPDATE users
        SET suspended_at = CASE
          WHEN suspended_at IS NULL THEN NOW()
          ELSE NULL
        END
      WHERE id = $1::bigint`,
    [id],
  );

  // Kill any active sessions on suspend.
  await query(
    `DELETE FROM sessions
      WHERE user_id = $1::bigint
        AND EXISTS (
          SELECT 1 FROM users WHERE id = $1::bigint AND suspended_at IS NOT NULL
        )`,
    [id],
  );

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?saved=1`);
}
