export interface BlockedBotDailyLog {
  [dateKey: string]: string[];
}

const dateKeyFor = (date: Date): string => date.toISOString().slice(0, 10);

const yesterdayOf = (date: Date): Date => new Date(date.getTime() - 24 * 60 * 60 * 1000);

export const recordBlockedBotIds = (
  log: BlockedBotDailyLog,
  ids: string[],
  now: Date = new Date(),
): BlockedBotDailyLog => {
  if (ids.length === 0) {
    return log;
  }
  const todayKey = dateKeyFor(now);
  const yesterdayKey = dateKeyFor(yesterdayOf(now));
  const today = new Set([...(log[todayKey] ?? []), ...ids]);
  const record: BlockedBotDailyLog = { [todayKey]: [...today] };
  if (log[yesterdayKey]) {
    record[yesterdayKey] = log[yesterdayKey];
  }
  return record;
};

export const countDistinctBlockedBotsLast24h = (
  log: BlockedBotDailyLog,
  now: Date = new Date(),
): number => {
  const todayKey = dateKeyFor(now);
  const yesterdayKey = dateKeyFor(yesterdayOf(now));
  const union = new Set([...(log[todayKey] ?? []), ...(log[yesterdayKey] ?? [])]);
  return union.size;
};
