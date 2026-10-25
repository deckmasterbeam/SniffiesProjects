import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, requireFeatureFlag, requireDb } from "./_shared.js";

const esc = (v: unknown): string => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const pct = (n: number, d: number): string => (d ? `${((n / d) * 100).toFixed(1)}%` : "–");

type Row = Record<string, string | number>;

const table = (head: string[], rows: string[][]): string =>
  `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  if (req.method !== "GET") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  // Only the separately-deployed, Vercel-Authentication-protected project sets
  // this; the public API project leaves it unset so this 404s there.
  if (!requireFeatureFlag(res, "DASHBOARD_ENABLED")) {
    return;
  }

  const sql = requireDb(res);
  if (!sql) {
    return;
  }

  try {
    // "Active" = at least one client init ping in the window. Every query
    // reads client_init_log; the trailing counts are other tables' totals.
    const [[totals], byClient, byVersion, daily, [other]] = (await Promise.all([
      sql`
        WITH first_seen AS (
          SELECT user_id, MIN(occurred_at) AS first_at FROM client_init_log GROUP BY user_id
        )
        SELECT
          (SELECT COUNT(*) FROM client_init_log)::int AS inits,
          (SELECT COUNT(*) FROM first_seen)::int AS users,
          (SELECT COUNT(*) FROM first_seen WHERE first_at > NOW() - INTERVAL '1 day')::int AS new_1d,
          (SELECT COUNT(*) FROM first_seen WHERE first_at > NOW() - INTERVAL '7 days')::int AS new_7d,
          (SELECT COUNT(*) FROM first_seen WHERE first_at > NOW() - INTERVAL '30 days')::int AS new_30d,
          (SELECT COUNT(DISTINCT user_id) FROM client_init_log WHERE occurred_at > NOW() - INTERVAL '1 day')::int AS dau,
          (SELECT COUNT(DISTINCT user_id) FROM client_init_log WHERE occurred_at > NOW() - INTERVAL '7 days')::int AS wau,
          (SELECT COUNT(DISTINCT user_id) FROM client_init_log WHERE occurred_at > NOW() - INTERVAL '30 days')::int AS mau,
          (SELECT COUNT(DISTINCT user_id) FROM client_init_log
             WHERE occurred_at > NOW() - INTERVAL '14 days' AND occurred_at <= NOW() - INTERVAL '7 days')::int AS prev_wau,
          (SELECT COUNT(*) FROM (
             SELECT user_id FROM client_init_log
             WHERE occurred_at > NOW() - INTERVAL '14 days'
             GROUP BY user_id
             HAVING COUNT(*) FILTER (WHERE occurred_at <= NOW() - INTERVAL '7 days') > 0
                AND COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '7 days') > 0
           ) t)::int AS retained
      `,
      sql`
        SELECT client_type AS label,
               COUNT(DISTINCT user_id)::int AS users,
               COUNT(DISTINCT user_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '7 days')::int AS wau
        FROM client_init_log GROUP BY client_type ORDER BY users DESC
      `,
      sql`
        SELECT version AS label,
               COUNT(DISTINCT user_id)::int AS users,
               COUNT(DISTINCT user_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '7 days')::int AS wau
        FROM client_init_log GROUP BY version ORDER BY MAX(occurred_at) DESC LIMIT 10
      `,
      sql`
        WITH first_seen AS (
          SELECT user_id, MIN(occurred_at)::date AS d FROM client_init_log GROUP BY user_id
        ), days AS (
          SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day')::date AS d
        )
        SELECT days.d::text AS day,
               (SELECT COUNT(DISTINCT user_id) FROM client_init_log WHERE occurred_at::date = days.d)::int AS active,
               (SELECT COUNT(*) FROM first_seen WHERE first_seen.d = days.d)::int AS new_users
        FROM days ORDER BY days.d DESC
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM phone_registrations)::int AS phones,
          (SELECT COUNT(DISTINCT guid) FROM favorites)::int AS favoriters,
          (SELECT COUNT(*) FROM favorites)::int AS favorites,
          (SELECT COUNT(*) FROM pending_reports WHERE status = 'pending')::int AS pending_reports,
          (SELECT COUNT(*) FROM validated_reports)::int AS validated_reports,
          (SELECT COUNT(*) FROM notify_log WHERE sent_at > NOW() - INTERVAL '7 days')::int AS sms_7d
      `,
    ])) as unknown as [[Row], Row[], Row[], Row[], [Row]];

    const t = totals;
    const maxActive = Math.max(1, ...daily.map((d) => Number(d.active)));
    const stat = (label: string, value: string | number, sub = ""): string =>
      `<div class="stat"><b>${esc(value)}</b><span>${label}</span>${sub ? `<i>${sub}</i>` : ""}</div>`;
    const breakdown = (rows: Row[]): string =>
      table(
        ["", "Users", "Active 7d"],
        rows.map((r) => [esc(r.label), esc(r.users), esc(r.wau)]),
      );

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Usage dashboard</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}
body{max-width:900px;margin:0 auto;padding:16px}
h2{margin:28px 0 8px;font-size:1rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.stat{border:1px solid #8884;border-radius:8px;padding:10px 12px;display:flex;flex-direction:column}
.stat b{font-size:1.6rem}.stat i{font-size:.75rem;opacity:.6}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #8883}
.bar{display:inline-block;height:10px;background:#4a90d9;border-radius:2px;vertical-align:middle}
</style></head><body>
<h1>Usage dashboard</h1>
<h2>Users</h2>
<div class="grid">
${stat("Total unique users", t.users, `${esc(t.inits)} inits`)}
${stat("New (24h)", t.new_1d)}
${stat("New (7d)", t.new_7d, pct(Number(t.new_7d), Number(t.users)) + " of all")}
${stat("New (30d)", t.new_30d)}
</div>
<h2>Active users</h2>
<div class="grid">
${stat("DAU (24h)", t.dau)}
${stat("WAU (7d)", t.wau, `prev week ${esc(t.prev_wau)}`)}
${stat("MAU (30d)", t.mau)}
${stat("Stickiness DAU/MAU", pct(Number(t.dau), Number(t.mau)))}
${stat("Week-over-week retention", pct(Number(t.retained), Number(t.prev_wau)), "last week's users seen this week")}
</div>
<h2>Last 30 days (UTC)</h2>
${table(
  ["Day", "Active", "New", ""],
  daily.map((d) => [
    esc(d.day),
    esc(d.active),
    esc(d.new_users),
    `<span class="bar" style="width:${Math.round((Number(d.active) / maxActive) * 100)}%"></span>`,
  ]),
)}
<h2>By client</h2>
${breakdown(byClient)}
<h2>By version (10 most recent)</h2>
${breakdown(byVersion)}
<h2>Features</h2>
<div class="grid">
${stat("Registered phones", other.phones)}
${stat("Favorites", other.favorites, `${esc(other.favoriters)} users`)}
${stat("SMS sent (7d)", other.sms_7d)}
${stat("Pending reports", other.pending_reports)}
${stat("Validated bots", other.validated_reports)}
</div>
<p style="opacity:.5;font-size:.8rem">Generated ${new Date().toISOString()}</p>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(html);
  } catch (err) {
    console.error("[dashboard] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
