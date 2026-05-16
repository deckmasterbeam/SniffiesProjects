import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb } from "./_shared.js";

interface SaveNumberBody {
  phone?: unknown;
}

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res, "POST, OPTIONS", true);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!requireClientAuth(req, res)) return;

  const body = (req.body ?? {}) as SaveNumberBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    json(res, 400, { error: "invalid_phone", detail: "Use E.164, e.g. +15551234567" });
    return;
  }

  const sql = requireDb(res);
  if (!sql) return;

  try {
    await sql`
      INSERT INTO phone_registrations (phone)
      VALUES (${phone})
      ON CONFLICT (phone) DO NOTHING
    `;
    const rows = await sql`SELECT guid FROM phone_registrations WHERE phone = ${phone}`;
    const guid = (rows[0] as { guid: string }).guid;
    json(res, 200, { ok: true, guid });
  } catch (err) {
    console.error("[save-number] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
