import type { BrowserContext, Page } from "@playwright/test";
import { SNIFFIES_ORIGIN } from "./constants.js";

/**
 * Sniffies' API host has changed before (between two captures an hour apart), so tests can serve
 * the same paths from several of the hosts it has used. Same-origin needs no CORS handling; the
 * others are cross-origin from the fixture page and do.
 */
export const API_ORIGINS = {
  sameOrigin: SNIFFIES_ORIGIN,
  uswapi: "https://uswapi.sniffies.com",
  uswDotApi: "https://usw.api.sniffies.com",
} as const;

export type ApiResponses = Record<string, unknown>;

const CORS = {
  "access-control-allow-origin": SNIFFIES_ORIGIN,
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
};

/**
 * Answers Sniffies' API paths (matched by path only, as the app's code does) from `responses`, and
 * returns what each path was sent in its body. Register after a fixture's own catch-all route:
 * Playwright tries the most recently added route first.
 */
export const mockApi = async (
  context: BrowserContext,
  responses: ApiResponses,
  origins: readonly string[] = [SNIFFIES_ORIGIN],
): Promise<Record<string, string[]>> => {
  const posted: Record<string, string[]> = {};
  for (const origin of origins) {
    const crossOrigin = origin !== SNIFFIES_ORIGIN;
    await context.route(`${origin}/api/**`, (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      const path = new URL(request.url()).pathname;
      (posted[path] ??= []).push(request.postData() ?? "");
      return route.fulfill({ json: responses[path] ?? {}, headers: crossOrigin ? CORS : {} });
    });
  }
  return posted;
};

/** Makes the request the way Sniffies' own code does: an XHR from the page. */
export const sendXhr = (
  page: Page,
  method: "GET" | "POST",
  url: string,
  body?: unknown,
): Promise<string> =>
  page.evaluate(
    ([verb, target, payload]) =>
      new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(verb!, target!);
        if (payload !== undefined) {
          xhr.setRequestHeader("content-type", "application/json");
        }
        xhr.onload = () => resolve(xhr.responseText);
        xhr.onerror = () => reject(new Error(`request to ${target} failed`));
        xhr.send(payload);
      }),
    [method, url, body === undefined ? undefined : JSON.stringify(body)] as const,
  );
