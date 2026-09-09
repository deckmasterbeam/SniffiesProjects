import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb } from "./_shared.js";

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res, "GET, OPTIONS", true);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!requireClientAuth(req, res)) {
    return;
  }

  const sql = requireDb(res);
  if (!sql) {
    return;
  }

  try {
    const rows = await sql`SELECT reported_user_id FROM validated_reports`;
    const userIds = (rows as { reported_user_id: string }[]).map((r) => r.reported_user_id);
    json(res, 200, { ok: true, userIds });
  } catch (err) {
    console.error("[blocked-bots] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
