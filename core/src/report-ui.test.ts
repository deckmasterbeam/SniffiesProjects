import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import REPORT_MODAL_HTML from "./report-modal.html";
import { wireReportModal } from "./report-ui.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const el = <T extends HTMLElement>(container: Element, id: string) =>
  container.querySelector<T>(`#${id}`)!;

const click = (el: HTMLElement) => el.dispatchEvent(new Event("click", { bubbles: true }));

// ── Setup ─────────────────────────────────────────────────────────────────────

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = REPORT_MODAL_HTML;
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("wireReportModal", () => {
  it("is hidden until opened", () => {
    wireReportModal(container, { onSubmit: vi.fn() });
    expect(el(container, "snp-report-backdrop").style.display).toBe("none");
  });

  it("shows on open()", () => {
    const handle = wireReportModal(container, { onSubmit: vi.fn() });
    handle.open();
    expect(el(container, "snp-report-backdrop").style.display).toBe("flex");
  });

  it("hides on close()", () => {
    const handle = wireReportModal(container, { onSubmit: vi.fn() });
    handle.open();
    handle.close();
    expect(el(container, "snp-report-backdrop").style.display).toBe("none");
  });

  describe("cancel", () => {
    it("closes and calls onCancel when cancel is clicked", () => {
      const onCancel = vi.fn();
      const handle = wireReportModal(container, { onSubmit: vi.fn(), onCancel });
      handle.open();
      click(el(container, "snp-report-cancel"));
      expect(onCancel).toHaveBeenCalled();
      expect(el(container, "snp-report-backdrop").style.display).toBe("none");
    });

    it("closes and calls onCancel when the backdrop itself is clicked", () => {
      const onCancel = vi.fn();
      const handle = wireReportModal(container, { onSubmit: vi.fn(), onCancel });
      handle.open();
      el(container, "snp-report-backdrop").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(onCancel).toHaveBeenCalled();
    });

    it("does not close when clicking inside the modal body", () => {
      const onCancel = vi.fn();
      const handle = wireReportModal(container, { onSubmit: vi.fn(), onCancel });
      handle.open();
      click(container.querySelector<HTMLElement>(".snp-report-modal")!);
      expect(onCancel).not.toHaveBeenCalled();
      expect(el(container, "snp-report-backdrop").style.display).toBe("flex");
    });

    it("clears the message field on close", () => {
      const handle = wireReportModal(container, { onSubmit: vi.fn() });
      handle.open();
      el<HTMLTextAreaElement>(container, "snp-report-message").value = "spam bot";
      handle.close();
      expect(el<HTMLTextAreaElement>(container, "snp-report-message").value).toBe("");
    });
  });

  describe("submit", () => {
    it("calls onSubmit with the trimmed message", () => {
      const onSubmit = vi.fn();
      const handle = wireReportModal(container, { onSubmit });
      handle.open();
      el<HTMLTextAreaElement>(container, "snp-report-message").value = "  looks like a bot  ";
      click(el(container, "snp-report-submit"));
      expect(onSubmit).toHaveBeenCalledWith("looks like a bot");
    });

    it("disables the submit button while pending", () => {
      const onSubmit = vi.fn(() => new Promise<void>(() => {}));
      const handle = wireReportModal(container, { onSubmit });
      handle.open();
      click(el(container, "snp-report-submit"));
      expect(el<HTMLButtonElement>(container, "snp-report-submit").disabled).toBe(true);
    });

    it("shows a submitting status", () => {
      const onSubmit = vi.fn(() => new Promise<void>(() => {}));
      const handle = wireReportModal(container, { onSubmit });
      handle.open();
      click(el(container, "snp-report-submit"));
      expect(el(container, "snp-report-status").textContent).toBe("Submitting…");
    });

    it("shows a success status and closes after onSubmit resolves", async () => {
      vi.useFakeTimers();
      const onSubmit = vi.fn(() => Promise.resolve());
      const handle = wireReportModal(container, { onSubmit });
      handle.open();
      click(el(container, "snp-report-submit"));
      await vi.waitFor(() => {
        expect(el(container, "snp-report-status").textContent).toBe("Reported. Thanks.");
      });
      vi.advanceTimersByTime(1200);
      expect(el(container, "snp-report-backdrop").style.display).toBe("none");
      vi.useRealTimers();
    });

    it("shows an error status and re-enables submit when onSubmit rejects", async () => {
      const onSubmit = vi.fn(() => Promise.reject(new Error("network")));
      const handle = wireReportModal(container, { onSubmit });
      handle.open();
      click(el(container, "snp-report-submit"));
      await vi.waitFor(() => {
        expect(el(container, "snp-report-status").textContent).toBe(
          "Failed to submit report. Try again.",
        );
      });
      expect(el<HTMLButtonElement>(container, "snp-report-submit").disabled).toBe(false);
    });

    it("ignores a stale submit's success after the modal was reopened for a new target", async () => {
      let resolveFirst: () => void = () => {};
      const onSubmit = vi
        .fn()
        .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
        .mockImplementationOnce(() => new Promise<void>(() => {}));
      const handle = wireReportModal(container, { onSubmit });

      handle.open();
      click(el(container, "snp-report-submit"));

      handle.open();
      el<HTMLTextAreaElement>(container, "snp-report-message").value = "second profile's report";

      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();

      expect(el(container, "snp-report-status").textContent).not.toBe("Reported. Thanks.");
      expect(el<HTMLTextAreaElement>(container, "snp-report-message").value).toBe(
        "second profile's report",
      );
      expect(el(container, "snp-report-backdrop").style.display).toBe("flex");
    });

    it("ignores a stale submit's failure after the modal was reopened for a new target", async () => {
      let rejectFirst: () => void = () => {};
      const onSubmit = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((_, reject) => (rejectFirst = () => reject(new Error("network")))),
        )
        .mockImplementationOnce(() => new Promise<void>(() => {}));
      const handle = wireReportModal(container, { onSubmit });

      handle.open();
      click(el(container, "snp-report-submit"));

      handle.open();

      rejectFirst();
      await Promise.resolve();
      await Promise.resolve();

      expect(el(container, "snp-report-status").textContent).not.toBe(
        "Failed to submit report. Try again.",
      );
    });
  });
});
