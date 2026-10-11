import { describe, expect, it, vi } from "vitest";
import { hideOnePhoto, type ThreadSnapshot } from "./sent-photos.js";

const ME = "me";
const THEM = "them";

const makeThread = (): ThreadSnapshot => ({
  apiOrigin: "https://usw.api.sniffies.com",
  conversationId: "c1",
  partialUserIds: [THEM],
  messages: [
    { _id: "m1", author: ME, file: "a.jpeg" },
    { _id: "m2", author: THEM, file: "b.jpeg" },
  ],
});

const okFetch = () =>
  vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, status: 200 }) as Response,
  );

describe("hideOnePhoto", () => {
  it("posts one photo-visibility request for the photo", async () => {
    const fetch = okFetch();

    const error = await hideOnePhoto(makeThread(), ME, "m1", fetch);

    expect(error).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://usw.api.sniffies.com/api/messages/photo-visibility");
    expect(init?.credentials).toBe("include");
    expect(JSON.parse(init?.body as string)).toEqual({
      conversationId: "c1",
      conversationLocation: null,
      userIdFrom: ME,
      userIdTo: THEM,
      messageId: "m1",
      isHidden: true,
      file: null,
    });
  });

  it("marks the message hidden in the remembered thread", async () => {
    const thread = makeThread();
    await hideOnePhoto(thread, ME, "m1", okFetch());
    expect(thread.messages[0]!.isHidden).toBe(true);
  });

  it("falls back to the thread's profile card when only you have posted", async () => {
    const fetch = okFetch();
    const thread = makeThread();
    thread.messages = thread.messages.filter((m) => m.author === ME);

    await hideOnePhoto(thread, ME, "m1", fetch);

    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string).userIdTo).toBe(THEM);
  });

  it("reports an error instead of guessing the recipient", async () => {
    const fetch = okFetch();
    const thread = makeThread();
    thread.messages = thread.messages.filter((m) => m.author === ME);
    thread.partialUserIds = [];

    expect(await hideOnePhoto(thread, ME, "m1", fetch)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a non-2xx response and leaves the message visible", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const thread = makeThread();

    expect(await hideOnePhoto(thread, ME, "m1", fetch)).toContain("429");
    expect(thread.messages[0]!.isHidden).toBeUndefined();
  });

  it("reports a network failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await hideOnePhoto(makeThread(), ME, "m1", fetch)).toBeTruthy();
  });
});
