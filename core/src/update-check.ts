import { createLogger } from "./log.js";

const log = createLogger("update-check");

export type ReleaseChannel = "chrome" | "userscript";

const RELEASES_API = "https://api.github.com/repos/deckmasterbeam/SniffiesProjects/releases";

const CACHE_KEY_PREFIX = "snp-latest-version-";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface GitHubRelease {
  tag_name: string;
}

const parseVersion = (version: string): number[] => version.split(".").map((n) => Number(n) || 0);

/** True if `b` is a newer version than `a` (numeric, dot-separated comparison). */
export const isNewerVersion = (a: string, b: string): boolean => {
  const partsA = parseVersion(a);
  const partsB = parseVersion(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const x = partsA[i] ?? 0;
    const y = partsB[i] ?? 0;
    if (y !== x) return y > x;
  }
  return false;
};

const readCache = (channel: ReleaseChannel): string | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + channel);
    const cached = raw ? (JSON.parse(raw) as { version: string; at: number }) : null;
    return cached && Date.now() - cached.at < CACHE_TTL_MS ? cached.version : null;
  } catch {
    return null;
  }
};

const writeCache = (channel: ReleaseChannel, version: string): void => {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + channel, JSON.stringify({ version, at: Date.now() }));
  } catch {
    // Storage unavailable — just skip caching.
  }
};

/**
 * Fetches published GitHub releases and returns the newest version tagged. A found version is cached for 24h
 */
export const fetchLatestVersion = async (channel: ReleaseChannel): Promise<string | null> => {
  const cachedVersion = readCache(channel);
  if (cachedVersion !== null) {
    return cachedVersion;
  }
  const prefix = `${channel}-`;
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      log.error("releases fetch rejected", res.status);
      return null;
    }
    const releases = (await res.json()) as GitHubRelease[];
    let latest: string | null = null;
    for (const release of releases) {
      if (!release.tag_name?.startsWith(prefix)) continue;
      const version = release.tag_name.slice(prefix.length);
      if (latest === null || isNewerVersion(latest, version)) {
        latest = version;
      }
    }
    if (latest !== null) {
      writeCache(channel, latest);
    }
    return latest;
  } catch (err) {
    // Best-effort — network/CSP failures are not actionable here.
    log.error("releases fetch failed", err);
    return null;
  }
};

/** True if a newer `channel` release than `currentVersion` is published on GitHub. */
export const isUpdateAvailable = async (
  channel: ReleaseChannel,
  currentVersion: string,
): Promise<boolean> => {
  const latest = await fetchLatestVersion(channel);
  return latest !== null && isNewerVersion(currentVersion, latest);
};
