import { beforeEach, describe, expect, it, vi } from "vitest";
import PROFILE_BORDER_HTML from "./profile-border.html";
import { wireProfileBorderForm } from "./profile-border-ui.js";
import type { ProfileBorderOpen } from "./settings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISABLED: ProfileBorderOpen = { enabled: false, openInNewTab: true };
const ENABLED_NEW_TAB: ProfileBorderOpen = { enabled: true, openInNewTab: true };

const el = <T extends HTMLElement>(container: Element, id: string) =>
  container.querySelector<T>(`#${id}`)!;

const click = (el: HTMLElement) => el.dispatchEvent(new Event("click", { bubbles: true }));
const change = (el: HTMLElement) => el.dispatchEvent(new Event("change", { bubbles: true }));

// ── Setup ─────────────────────────────────────────────────────────────────────

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = PROFILE_BORDER_HTML;
  document.body.appendChild(container);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("wireProfileBorderForm", () => {
  describe("initial values", () => {
    it("hides the tab field when initially disabled", () => {
      wireProfileBorderForm(container, {
        initial: DISABLED,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el(container, "profile-border-tab-field").style.display).toBe("none");
    });

    it("shows the tab field when initially enabled", () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el(container, "profile-border-tab-field").style.display).toBe("");
    });

    it("hides the save button on init", () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el(container, "profile-border-save").style.display).toBe("none");
    });

    it("selects the saved tab target", () => {
      wireProfileBorderForm(container, {
        initial: { enabled: true, openInNewTab: false },
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el<HTMLSelectElement>(container, "profile-border-tab").value).toBe("current-tab");
    });
  });

  describe("enable toggle", () => {
    it("shows the tab field when enable is checked", () => {
      wireProfileBorderForm(container, {
        initial: DISABLED,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const checkbox = el<HTMLInputElement>(container, "profile-border-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(el(container, "profile-border-tab-field").style.display).toBe("");
    });

    it("hides the tab field when enable is unchecked", () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const checkbox = el<HTMLInputElement>(container, "profile-border-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(el(container, "profile-border-tab-field").style.display).toBe("none");
    });

    it("auto-saves immediately when toggled", () => {
      const onSave = vi.fn();
      wireProfileBorderForm(container, {
        initial: DISABLED,
        onSave,
        initialOpen: false,
        onToggle: () => {},
      });
      const checkbox = el<HTMLInputElement>(container, "profile-border-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(onSave).toHaveBeenCalledWith({ enabled: true, openInNewTab: true });
    });
  });

  describe("save button visibility", () => {
    it("shows the save button when the tab select changes from the saved value", () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const select = el<HTMLSelectElement>(container, "profile-border-tab");
      select.value = "current-tab";
      change(select);
      expect(el(container, "profile-border-save").style.display).toBe("");
    });

    it("hides the save button when the tab select is changed back to the saved value", () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const select = el<HTMLSelectElement>(container, "profile-border-tab");
      select.value = "current-tab";
      change(select);
      select.value = "new-tab";
      change(select);
      expect(el(container, "profile-border-save").style.display).toBe("none");
    });
  });

  describe("save", () => {
    it("calls onSave with form values on click", () => {
      const onSave = vi.fn();
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave,
        initialOpen: false,
        onToggle: () => {},
      });
      const select = el<HTMLSelectElement>(container, "profile-border-tab");
      select.value = "current-tab";
      change(select);
      click(el(container, "profile-border-save"));
      expect(onSave).toHaveBeenCalledWith({ enabled: true, openInNewTab: false });
    });

    it("hides the save button after save resolves", async () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const select = el<HTMLSelectElement>(container, "profile-border-tab");
      select.value = "current-tab";
      change(select);
      click(el(container, "profile-border-save"));
      await Promise.resolve();
      expect(el(container, "profile-border-save").style.display).toBe("none");
    });

    it("marks the saved tab option's label with (saved)", async () => {
      wireProfileBorderForm(container, {
        initial: ENABLED_NEW_TAB,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const select = el<HTMLSelectElement>(container, "profile-border-tab");
      select.value = "current-tab";
      change(select);
      click(el(container, "profile-border-save"));
      await Promise.resolve();
      const options = select.querySelectorAll("option");
      expect(options[0]?.text).toContain("(saved)");
      expect(options[1]?.text).not.toContain("(saved)");
    });
  });

  describe("collapsible", () => {
    it("sets details.open from initialOpen", () => {
      wireProfileBorderForm(container, {
        initial: DISABLED,
        onSave: vi.fn(),
        initialOpen: true,
        onToggle: () => {},
      });
      expect(container.querySelector<HTMLDetailsElement>("#profile-border-details")!.open).toBe(
        true,
      );
    });

    it("fires onToggle when the section is toggled", () => {
      const onToggle = vi.fn();
      wireProfileBorderForm(container, {
        initial: DISABLED,
        onSave: vi.fn(),
        initialOpen: false,
        onToggle,
      });
      const details = container.querySelector<HTMLDetailsElement>("#profile-border-details")!;
      details.dispatchEvent(new Event("toggle"));
      expect(onToggle).toHaveBeenCalledWith(details.open);
    });
  });
});
