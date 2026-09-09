import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, applyCors, requireClientAuth, requireDb, requireFeatureFlag } from "./_shared.js";

const REPORT_TYPES = ["bot_suspected"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const isReportType = (value: string): value is ReportType =>
  (REPORT_TYPES as readonly string[]).includes(value);

const MESSAGE_MAX_LENGTH = 500;

// Mirrors core/src/settings.ts's SNIFFIES_USER_ID_REGEX (24-char hex Mongo
// ObjectId). Enforcing this server-side also rules out reporterUserId
// containing the "," delimiter or "%"/"_" LIKE wildcards, which the dedupe
// check below depends on.
const SNIFFIES_USER_ID_REGEX = /^[a-f0-9]{24}$/i;

interface ReportBody {
  reportType?: unknown;
  reportedUserId?: unknown;
  reporterUserId?: unknown;
  message?: unknown;
}

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  applyCors(req, res, "POST, OPTIONS", true);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!requireFeatureFlag(res, "REPORTING_ENABLED")) {
    return;
  }

  if (req.method !== "POST") {
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

  const body = (req.body ?? {}) as ReportBody;
  const reportType = typeof body.reportType === "string" ? body.reportType : "";
  const reportedUserId = typeof body.reportedUserId === "string" ? body.reportedUserId.trim() : "";
  const reporterUserId = typeof body.reporterUserId === "string" ? body.reporterUserId.trim() : "";
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, MESSAGE_MAX_LENGTH) : "";

  if (!isReportType(reportType)) {
    json(res, 400, { error: "invalid_report_type" });
    return;
  }

  if (!reportedUserId || !reporterUserId) {
    json(res, 400, { error: "reportedUserId_and_reporterUserId_required" });
    return;
  }

  if (!SNIFFIES_USER_ID_REGEX.test(reportedUserId) || !SNIFFIES_USER_ID_REGEX.test(reporterUserId)) {
    json(res, 400, { error: "invalid_user_id" });
    return;
  }

  try {
    const blocked = await sql`
      SELECT 1 FROM blocked_reporters WHERE sniffies_user_id = ${reporterUserId} LIMIT 1
    `;
    if (blocked.length > 0) {
      json(res, 200, { ok: true });
      return;
    }

    const messageJson = JSON.stringify([
      { reporterId: reporterUserId, message: message || null, reportedAt: new Date().toISOString() },
    ]);

    await sql`
      INSERT INTO pending_reports (report_type, reported_user_id, reporting_user_ids, messages, report_count)
      VALUES (${reportType}, ${reportedUserId}, ${reporterUserId}, ${messageJson}::jsonb, 1)
      ON CONFLICT (reported_user_id, report_type) DO UPDATE SET
        reporting_user_ids = CASE
          WHEN (',' || pending_reports.reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')
            THEN pending_reports.reporting_user_ids
          ELSE pending_reports.reporting_user_ids || ',' || EXCLUDED.reporting_user_ids
        END,
        messages = CASE
          WHEN (',' || pending_reports.reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')
            THEN pending_reports.messages
          ELSE pending_reports.messages || EXCLUDED.messages
        END,
        report_count = CASE
          WHEN (',' || pending_reports.reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')
            THEN pending_reports.report_count
          ELSE pending_reports.report_count + 1
        END,
        last_reported_at = NOW()
    `;
    json(res, 200, { ok: true });
  } catch (err) {
    console.error("[report] db error", err);
    json(res, 500, { error: "db_error" });
  }
};

export default handler;
