import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb } from "./_shared.js";

const CLIENT_TYPES = ["chrome-client", "bookmarklet"] as const;
type ClientType = (typeof CLIENT_TYPES)[number];

const isClientType = (value: string): value is ClientType =>
  (CLIENT_TYPES as readonly string[]).includes(value);

interface LogInitBody {
  userId?: unknown;
  clientType?: unknown;
  version?: unknown;
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

  if (!requireClientAuth(req, res)) {
    return;
  }

  const body = (req.body ?? {}) as LogInitBody;
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const clientType = typeof body.clientType === "string" ? body.clientType : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";

  if (!userId || !version) {
    json(res, 400, { error: "userId_and_version_required" });
    return;
  }

  if (!isClientType(clientType)) {
    json(res, 400, { error: "invalid_client_type" });
    return;
  }

  const sql = requireDb(res);
  if (!sql) {
    return;
  }

  try {
    await sql`
      INSERT INTO client_init_log (user_id, client_type, version)
      VALUES (${userId}, ${clientType}, ${version})
    `;
    json(res, 200, { ok: true });
  } catch (err) {
    console.error("[logInit] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
