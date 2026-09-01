// A day-bucketed log of which accounts the bot-block hook has actually
// filtered, used to report "N bots blocked in the last 24 hours" in the
// popup. This is a rough proxy for a true rolling 24h window, not an exact
// one: a day bucket uses the UTC calendar day (deterministic, no DST/locale
// edge cases), and "last 24 hours" is approximated as the union of today's
// and yesterday's buckets rather than a precise timestamp cutoff.

export interface BlockedBotDailyLog {
  [dateKey: string]: string[];
}

const dateKeyFor = (date: Date): string => date.toISOString().slice(0, 10);

const yesterdayOf = (date: Date): Date => new Date(date.getTime() - 24 * 60 * 60 * 1000);

/**
 * Merges newly-filtered ids into today's bucket and drops every bucket
 * except today and yesterday, so the log can't grow unbounded.
 */
export const recordBlockedBotIds = (
  log: BlockedBotDailyLog,
  ids: readonly string[],
  now: Date = new Date(),
): BlockedBotDailyLog => {
  if (ids.length === 0) {
    return log;
  }
  const todayKey = dateKeyFor(now);
  const yesterdayKey = dateKeyFor(yesterdayOf(now));
  const today = new Set([...(log[todayKey] ?? []), ...ids]);
  const next: BlockedBotDailyLog = { [todayKey]: [...today] };
  if (log[yesterdayKey]) {
    next[yesterdayKey] = log[yesterdayKey];
  }
  return next;
};

/** Distinct accounts filtered across today's and yesterday's buckets. */
export const countDistinctBlockedBotsLast24h = (
  log: BlockedBotDailyLog,
  now: Date = new Date(),
): number => {
  const todayKey = dateKeyFor(now);
  const yesterdayKey = dateKeyFor(yesterdayOf(now));
  const union = new Set([...(log[todayKey] ?? []), ...(log[yesterdayKey] ?? [])]);
  return union.size;
};
