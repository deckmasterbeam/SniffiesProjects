import { afterEach, describe, expect, it, vi } from "vitest";
import { watchOwnIdInDom } from "./own-id-dom.js";

const marker = (id: string, testid = "cv-marker-container"): string =>
  `<div data-testid="${testid}" id="${id}"></div>`;

describe("watchOwnIdInDom", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("reads the id of a marker already on the page, ignoring other users' markers", () => {
    document.body.innerHTML = marker("them", "markerUserContainer") + marker("me");
    const onUserId = vi.fn();
    watchOwnIdInDom(onUserId);
    expect(onUserId).toHaveBeenCalledExactlyOnceWith("me");
  });

  it("waits for the marker to be drawn", async () => {
    const onUserId = vi.fn();
    watchOwnIdInDom(onUserId);
    expect(onUserId).not.toHaveBeenCalled();
    document.body.innerHTML = marker("me");
    await vi.waitFor(() => expect(onUserId).toHaveBeenCalledExactlyOnceWith("me"));
  });
});
