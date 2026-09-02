import { beforeEach, describe, expect, it, vi } from "vitest";
import BOT_BLOCK_HTML from "./bot-block.html";
import { wireBotBlockForm } from "./bot-block-ui.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const el = <T extends HTMLElement>(container: Element, id: string) =>
  container.querySelector<T>(`#${id}`)!;

const change = (el: HTMLElement) => el.dispatchEvent(new Event("change", { bubbles: true }));

// ── Setup ─────────────────────────────────────────────────────────────────────

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = BOT_BLOCK_HTML;
  document.body.appendChild(container);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("wireBotBlockForm", () => {
  describe("reportingEnabled: false", () => {
    it("disables the toggle and shows 'Coming soon!'", () => {
      wireBotBlockForm(container, {
        reportingEnabled: false,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(el<HTMLInputElement>(container, "bot-block-enabled").checked).toBe(false);
      expect(el<HTMLInputElement>(container, "bot-block-enabled").disabled).toBe(true);
      expect(el(container, "bot-block-hint").textContent).toBe("Coming soon!");
    });

    it("strikes through the enable label", () => {
      wireBotBlockForm(container, {
        reportingEnabled: false,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(el(container, "bot-block-enable-label").style.textDecoration).toBe("line-through");
    });
  });

  describe("initial values", () => {
    it("reflects the enabled flag", () => {
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(el<HTMLInputElement>(container, "bot-block-enabled").checked).toBe(true);
    });

    it("shows the blocked count when positive", () => {
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 3,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(el(container, "bot-block-count").textContent).toBe("3 bots blocked in the last 24 hours");
    });

    it("uses singular phrasing for a count of 1", () => {
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 1,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(el(container, "bot-block-count").textContent).toBe("1 bot blocked in the last 24 hours");
    });

    it("leaves the count empty when zero", () => {
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(el(container, "bot-block-count").textContent).toBe("");
    });
  });

  describe("enable toggle", () => {
    it("fires onToggleEnabled with the new checked state", () => {
      const onToggleEnabled = vi.fn();
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: false,
        onToggle: () => {},
        onToggleEnabled,
      });
      const checkbox = el<HTMLInputElement>(container, "bot-block-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(onToggleEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe("collapsible", () => {
    it("sets details.open from initialOpen", () => {
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: true,
        onToggle: () => {},
        onToggleEnabled: vi.fn(),
      });
      expect(container.querySelector<HTMLDetailsElement>("#bot-block-details")!.open).toBe(true);
    });

    it("fires onToggle when the section is toggled", () => {
      const onToggle = vi.fn();
      wireBotBlockForm(container, {
        reportingEnabled: true,
        initialEnabled: true,
        initialCount: 0,
        initialOpen: false,
        onToggle,
        onToggleEnabled: vi.fn(),
      });
      const details = container.querySelector<HTMLDetailsElement>("#bot-block-details")!;
      details.dispatchEvent(new Event("toggle"));
      expect(onToggle).toHaveBeenCalledWith(details.open);
    });
  });
});
