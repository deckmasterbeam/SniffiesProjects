import { describe, expect, it } from "vitest";
import { findSeenMessageId } from "./read-receipt-hook.js";

const ME = "me";
const THEM = "them";
// Newest first, as the API returns them.
const messages = [
  { _id: "6aeeecd7", author: ME },
  { _id: "6aeeea2e", author: THEM },
  { _id: "6aeee9ef", author: ME },
];

describe("findSeenMessageId", () => {
  it("returns my newest message at or before their last-read id", () => {
    expect(findSeenMessageId({ messages, lastReadMessageIds: { [THEM]: "6aeeecd7" } })).toBe(
      "6aeeecd7",
    );
    expect(findSeenMessageId({ messages, lastReadMessageIds: { [THEM]: "6aeeea2e" } })).toBe(
      "6aeee9ef",
    );
  });

  it("returns null when nothing of mine has been read, or there is no read state", () => {
    expect(findSeenMessageId({ messages, lastReadMessageIds: { [THEM]: "6aeee000" } })).toBeNull();
    expect(findSeenMessageId({ messages })).toBeNull();
  });
});
