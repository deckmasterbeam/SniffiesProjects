import REPORT_MODAL_HTML from "./report-modal.html";
import REPORT_MODAL_CSS from "./report-modal.css";
import type { ReportFormContract } from "./report-form-contract.js";

export { REPORT_MODAL_HTML, REPORT_MODAL_CSS };
export type { ReportFormContract };

export interface ReportModalHandle {
  open: () => void;
  close: () => void;
}

export const wireReportModal = (
  container: Element,
  options: ReportFormContract,
): ReportModalHandle => {
  const el = <T extends Element>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const backdrop = el<HTMLElement>("snp-report-backdrop");
  const messageField = el<HTMLTextAreaElement>("snp-report-message");
  const statusEl = el<HTMLElement>("snp-report-status");
  const cancelBtn = el<HTMLButtonElement>("snp-report-cancel");
  const submitBtn = el<HTMLButtonElement>("snp-report-submit");

  // The stylesheet defaults #snp-report-backdrop to display:none, but that
  // stylesheet isn't guaranteed to be loaded wherever this container lives
  // (e.g. tests render REPORT_MODAL_HTML without REPORT_MODAL_CSS), so set
  // the inline state explicitly rather than relying on CSS for the initial
  // hidden state.
  backdrop.style.display = "none";

  const setStatus = (text: string): void => {
    statusEl.textContent = text;
  };

  const close = (): void => {
    backdrop.style.display = "none";
    messageField.value = "";
    setStatus("");
    submitBtn.disabled = false;
  };

  const open = (): void => {
    backdrop.style.display = "flex";
    setStatus("");
    submitBtn.disabled = false;
    messageField.focus();
  };

  cancelBtn.addEventListener("click", () => {
    options.onCancel?.();
    close();
  });

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      options.onCancel?.();
      close();
    }
  });

  submitBtn.addEventListener("click", () => {
    submitBtn.disabled = true;
    setStatus("Submitting…");
    Promise.resolve(options.onSubmit(messageField.value.trim()))
      .then(() => {
        setStatus("Reported. Thanks.");
        setTimeout(close, 1200);
      })
      .catch(() => {
        setStatus("Failed to submit report. Try again.");
        submitBtn.disabled = false;
      });
  });

  return { open, close };
};
