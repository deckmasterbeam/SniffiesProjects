import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export const json = (res: VercelResponse, status: number, body: Record<string, unknown>): void => {
  res.status(status).json(body);
};

const isAllowedOrigin = (origin: string | undefined): boolean => {
  const allow = process.env.ALLOWED_ORIGINS?.trim();
  if (!allow) return true;
  if (!origin) return false;
  return allow
    .split(",")
    .map((s) => s.trim())
    .includes(origin);
};

export const applyCors = (
  req: VercelRequest,
  res: VercelResponse,
  methods = "POST, OPTIONS",
  openCors = false,
): void => {
  if (openCors) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
};

// Used by client-facing endpoints. CLIENT_SECRET is baked into the extension
// dist, so it prevents casual scraping but is not truly private.
export const requireClientAuth = (req: VercelRequest, res: VercelResponse): boolean => {
  const secret = process.env.CLIENT_SECRET;
  if (!secret) {
    json(res, 500, { error: "server_misconfigured", detail: "CLIENT_SECRET not set" });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    json(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
};

// Used by watcher-facing endpoints. WATCHER_SECRET is never distributed and
// must be kept private — only the sideloaded watcher build contains it.
export const requireWatcherAuth = (req: VercelRequest, res: VercelResponse): boolean => {
  const secret = process.env.WATCHER_SECRET;
  if (!secret) {
    json(res, 500, { error: "server_misconfigured", detail: "WATCHER_SECRET not set" });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    json(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
};

export const requireDb = (res: VercelResponse): NeonQueryFunction<false, false> | null => {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    json(res, 500, { error: "server_misconfigured", detail: "POSTGRES_URL not set" });
    return null;
  }
  return neon(postgresUrl);
};
