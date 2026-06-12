import "server-only";
import { query } from "@/lib/db";

export type SiteSettings = {
  /** Master switch for search-engine indexing. When false the site
   *  emits robots: noindex,nofollow on every page and Disallow:/ in
   *  /robots.txt. Default false so new deployments are blocked until
   *  an admin explicitly opens them up. */
  allowIndexing: boolean;
  /** When the site enters maintenance mode. ISO timestamp string, or
   *  null when nothing is scheduled. A future value means a countdown
   *  is showing on every page. A past value means maintenance is
   *  active — non-admin users see the maintenance page; admins keep
   *  working. */
  maintenanceAt: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  allowIndexing: false,
  maintenanceAt: null,
};

type Row = {
  allow_indexing: boolean;
  maintenance_at: string | null;
};

export async function loadSiteSettings(): Promise<SiteSettings> {
  try {
    const r = await query<Row>(
      `SELECT allow_indexing,
              maintenance_at::text AS maintenance_at
         FROM site_settings WHERE id = 1 LIMIT 1`,
    );
    const row = r.rows[0];
    if (!row) return DEFAULT_SITE_SETTINGS;
    return {
      allowIndexing: row.allow_indexing,
      maintenanceAt: row.maintenance_at,
    };
  } catch {
    // If the DB is unreachable, fall safe (block indexing) so we don't
    // accidentally let crawlers in during an outage / migration.
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function updateSiteSettings(next: SiteSettings): Promise<void> {
  await query(
    `INSERT INTO site_settings (id, allow_indexing, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET
       allow_indexing = EXCLUDED.allow_indexing,
       updated_at     = NOW()`,
    [next.allowIndexing],
  );
}

/** Set the maintenance window. Pass a Date to schedule (or activate
 *  immediately if the date is now or in the past), or null to clear
 *  any existing window. */
export async function setMaintenanceAt(at: Date | null): Promise<void> {
  await query(
    `INSERT INTO site_settings (id, maintenance_at, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET
         maintenance_at = EXCLUDED.maintenance_at,
         updated_at     = NOW()`,
    [at],
  );
}
