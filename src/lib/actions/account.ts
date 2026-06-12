"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { passwordMeetsRules } from "@/lib/password-rules";

const CONFIRM_PHRASE = "DELETE";

export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (confirm !== CONFIRM_PHRASE) {
    redirect("/profile?delete_error=phrase");
  }

  const r = await query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1::bigint LIMIT 1`,
    [user.id],
  );
  const row = r.rows[0];
  if (!row) {
    redirect("/login");
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    redirect("/profile?delete_error=password");
  }

  // Deleting the user cascades to sessions and any user-owned blog data.
  // blog_posts.author_id is ON DELETE SET NULL, so published posts persist
  // (anonymised) rather than vanishing from the public blog.
  await query(`DELETE FROM users WHERE id = $1::bigint`, [user.id]);

  await destroySession();
  revalidatePath("/", "layout");
  redirect("/?account_deleted=1");
}

export async function changePassword(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!passwordMeetsRules(next)) {
    redirect("/profile?password_error=weak");
  }
  if (next !== confirm) {
    redirect("/profile?password_error=mismatch");
  }
  if (next === current) {
    redirect("/profile?password_error=same");
  }

  const r = await query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1::bigint LIMIT 1`,
    [user.id],
  );
  const row = r.rows[0];
  if (!row) redirect("/login");

  const ok = await verifyPassword(current, row.password_hash);
  if (!ok) {
    redirect("/profile?password_error=current");
  }

  const passwordHash = await hashPassword(next);

  // Keep the current session alive so the user stays logged in, but
  // kill any other devices for safety — same shape as the admin
  // reset, just scoped around the current cookie.
  const jar = await cookies();
  const currentSessionId = jar.get("session")?.value ?? null;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2::bigint`,
      [passwordHash, user.id],
    );
    await client.query(
      `UPDATE password_reset_tokens
          SET used_at = NOW()
        WHERE user_id = $1::bigint AND used_at IS NULL`,
      [user.id],
    );
    if (currentSessionId) {
      await client.query(
        `DELETE FROM sessions
          WHERE user_id = $1::bigint AND id <> $2`,
        [user.id, currentSessionId],
      );
    } else {
      await client.query(
        `DELETE FROM sessions WHERE user_id = $1::bigint`,
        [user.id],
      );
    }
  });

  revalidatePath("/profile");
  redirect("/profile?password_changed=1");
}
