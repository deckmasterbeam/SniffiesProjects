import { createLogger } from "./log.js";

const log = createLogger("update-check");

export type ReleaseChannel = "chrome" | "userscript";

const RELEASES_API = "https://api.github.com/repos/deckmasterbeam/SniffiesProjects/releases";

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

/**
 * Fetches published GitHub releases and returns the newest version tagged
 * for `channel` (release tag `chrome-0.3` -> `"0.3"`), or null if none are
 * found or the request fails. Best-effort — never throws.
 */
export const fetchLatestVersion = async (channel: ReleaseChannel): Promise<string | null> => {
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
