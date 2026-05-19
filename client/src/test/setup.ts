import { beforeEach, vi } from "vitest";

let localStore: Record<string, unknown> = {};

beforeEach(() => {
  localStore = {};
  vi.clearAllMocks();
});

(globalThis as unknown as Record<string, unknown>).chrome = {
  storage: {
    local: {
      get: vi.fn(async (defaults: Record<string, unknown> | null) => ({
        ...(defaults ?? {}),
        ...localStore,
      })),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(localStore, data);
      }),
      clear: vi.fn(async () => {
        localStore = {};
      }),
      onChanged: { addListener: vi.fn() },
    },
    sync: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
    },
  },
  tabs: { create: vi.fn(async () => {}) },
  runtime: { getURL: vi.fn((p: string) => p) },
};
