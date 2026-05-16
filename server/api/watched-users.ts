import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireWatcherAuth, requireDb } from "./_shared.js";

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!requireWatcherAuth(req, res)) return;

  const sql = requireDb(res);
  if (!sql) return;

  try {
    const rows = await sql`SELECT DISTINCT user_id FROM favorites`;
    const userIds = (rows as { user_id: string }[]).map((r) => r.user_id);
    json(res, 200, { ok: true, userIds });
  } catch (err) {
    console.error("[watched-users] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
