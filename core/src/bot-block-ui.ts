import BOT_BLOCK_HTML from "./bot-block.html";
import BOT_BLOCK_CSS from "./bot-block.css";
import type { BotBlockFormContract } from "./bot-block-form-contract.js";

export { BOT_BLOCK_HTML, BOT_BLOCK_CSS };
export type { BotBlockFormContract };

export const wireBotBlockForm = (container: Element, options: BotBlockFormContract): void => {
  const el = <T extends Element>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const details = container.querySelector<HTMLDetailsElement>("#bot-block-details");
  const countEl = el<HTMLElement>("bot-block-count");
  const hintEl = el<HTMLElement>("bot-block-hint");
  const enabledCheckbox = el<HTMLInputElement>("bot-block-enabled");
  const enableLabel = el<HTMLElement>("bot-block-enable-label");

  if (details) {
    details.open = options.initialOpen;
    details.addEventListener("toggle", () => options.onToggle(details.open));
  }

  if (!options.reportingEnabled) {
    enabledCheckbox.checked = false;
    enabledCheckbox.disabled = true;
    hintEl.textContent = "Coming soon!";
    enableLabel.style.textDecoration = "line-through";
    return;
  }

  enabledCheckbox.checked = options.initialEnabled;
  hintEl.textContent =
    "Hide profiles that have been confirmed as bots from the map and live updates.";
  countEl.textContent =
    options.initialCount > 0
      ? `${options.initialCount} bot${options.initialCount === 1 ? "" : "s"} blocked in the last 24 hours`
      : "";

  enabledCheckbox.addEventListener("change", () => {
    void options.onToggleEnabled(enabledCheckbox.checked);
  });
};
