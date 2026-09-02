import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./shared/env.js", () => ({
  SERVER_BASE: "https://server.example",
  CLIENT_SECRET: "test-secret",
  VERSION: "1.2.3",
  REPORTING_ENABLED: false,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

type WindowWithFlag = typeof window & { __sniffiesInjected?: boolean };

const loadModule = async () => {
  vi.resetModules();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  // Skip the module's own auto hook-install/mount so tests can call mountUI directly.
  (window as WindowWithFlag).__sniffiesInjected = true;
  return import("./userscript.js");
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("userscript — version badge", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    (window as WindowWithFlag).__sniffiesInjected = false;
  });

  it("renders the package version in the panel header", async () => {
    const { mountUI } = await loadModule();
    mountUI(null);
    const versionEl = document.querySelector("#snp-panel #snp-version");
    expect(versionEl?.textContent).toBe("v1.2.3");
  });

  it("renders the version badge next to the title, before the close button", async () => {
    const { mountUI } = await loadModule();
    mountUI(null);
    const title = document.querySelector("#snp-panel .snp-title")!;
    const versionEl = title.querySelector("#snp-version")!;
    const closeBtn = document.querySelector("#snp-panel #snp-close")!;
    expect(title.contains(versionEl)).toBe(true);
    expect(versionEl.compareDocumentPosition(closeBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
