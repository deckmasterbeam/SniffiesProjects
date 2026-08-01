import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logInit } from "./log-init.js";

const OPTS = {
  serverBase: "https://server.example",
  clientSecret: "secret",
  userId: "694abfeb1cf11f4a71d32027",
  clientType: "chrome-client" as const,
  version: "0.1.0",
};

describe("logInit", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts userId, clientType, and version to /api/logInit", async () => {
    await logInit(OPTS);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server.example/api/logInit",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret",
        },
        body: JSON.stringify({
          userId: OPTS.userId,
          clientType: OPTS.clientType,
          version: OPTS.version,
        }),
      }),
    );
  });

  it("does not fetch when serverBase is empty", async () => {
    await logInit({ ...OPTS, serverBase: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch when userId is empty", async () => {
    await logInit({ ...OPTS, userId: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows fetch errors", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(logInit(OPTS)).resolves.toBeUndefined();
  });

  it("does not throw when the server rejects the ping", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(logInit(OPTS)).resolves.toBeUndefined();
  });

  it("strips a trailing slash from serverBase so the URL doesn't end up with a double slash", async () => {
    await logInit({ ...OPTS, serverBase: "https://server.example/" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server.example/api/logInit",
      expect.anything(),
    );
  });
});
