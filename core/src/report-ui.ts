import RAW_REPORT_MODAL_HTML from "./report-modal.html";
import { STRINGS, render } from "./strings.js";
import REPORT_MODAL_CSS from "./report-modal.css";
import type { ReportFormContract } from "./contracts.js";

const REPORT_MODAL_HTML = render(RAW_REPORT_MODAL_HTML);

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

  backdrop.style.display = "none";

  const setStatus = (text: string, isError = false): void => {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
  };

  let generation = 0;

  const close = (): void => {
    backdrop.style.display = "none";
    messageField.value = "";
    setStatus("");
    submitBtn.disabled = false;
  };

  const open = (): void => {
    generation += 1;
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
    const submittedGeneration = generation;
    submitBtn.disabled = true;
    setStatus(STRINGS.report.submitting);
    Promise.resolve(options.onSubmit(messageField.value.trim()))
      .then(() => {
        if (generation !== submittedGeneration) {
          return;
        }
        setStatus(STRINGS.report.submitted);
        setTimeout(close, 1200);
      })
      .catch(() => {
        if (generation !== submittedGeneration) {
          return;
        }
        setStatus(STRINGS.report.failed, true);
        submitBtn.disabled = false;
      });
  });

  return { open, close };
};
