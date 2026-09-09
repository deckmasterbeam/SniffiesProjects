import { describe, it, expect } from "vitest";
import { getLocalSettings, recordBlockedBotEvent } from "./settings.js";

describe("recordBlockedBotEvent", () => {
  it("merges ids from overlapping concurrent calls instead of racing", async () => {
    // Two onFiltered events fire back-to-back (e.g. map-init and chat-init
    // XHRs resolving close together) before either's storage write lands.
    const first = recordBlockedBotEvent(["aaa111111111111111111111"]);
    const second = recordBlockedBotEvent(["bbb222222222222222222222"]);
    await Promise.all([first, second]);

    const { blockedBotEventsByDay } = await getLocalSettings();
    const todayKey = new Date().toISOString().slice(0, 10);
    expect(blockedBotEventsByDay[todayKey]).toEqual(
      expect.arrayContaining(["aaa111111111111111111111", "bbb222222222222222222222"]),
    );
    expect(blockedBotEventsByDay[todayKey]).toHaveLength(2);
  });

  it("resolves once its own write has landed", async () => {
    await recordBlockedBotEvent(["aaa111111111111111111111"]);
    const { blockedBotEventsByDay } = await getLocalSettings();
    const todayKey = new Date().toISOString().slice(0, 10);
    expect(blockedBotEventsByDay[todayKey]).toEqual(["aaa111111111111111111111"]);
  });
});
