import type { VercelRequest, VercelResponse } from "@vercel/node";

export function makeReq(
  opts: {
    method?: string;
    headers?: Record<string, string | undefined>;
    body?: unknown;
    query?: Record<string, string | string[]>;
  } = {},
): VercelRequest {
  return {
    method: opts.method ?? "POST",
    headers: { ...opts.headers },
    body: opts.body,
    query: opts.query ?? {},
  } as unknown as VercelRequest;
}

export function makeRes() {
  let _status = 0;
  let _body: Record<string, unknown> = {};
  const res = {
    status(s: number) {
      _status = s;
      return res as unknown as VercelResponse;
    },
    json(b: unknown) {
      _body = b as Record<string, unknown>;
    },
    setHeader() {},
    end() {},
    get _status() {
      return _status;
    },
    get _body() {
      return _body;
    },
  };
  return res;
}
