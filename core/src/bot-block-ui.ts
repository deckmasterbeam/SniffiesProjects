import type { BotBlockFormContract } from "./contracts.js";
import RAW_CSS from "./bot-block.css";
import SWITCH_CSS from "./switch.css";
import RAW_BOT_BLOCK_HTML from "./bot-block.html";
import { STRINGS, render } from "./strings.js";

const BOT_BLOCK_HTML = render(RAW_BOT_BLOCK_HTML);
const BOT_BLOCK_CSS = SWITCH_CSS + RAW_CSS;

export { BOT_BLOCK_CSS, BOT_BLOCK_HTML };
export type { BotBlockFormContract };

export const wireBotBlockForm = (container: Element, options: BotBlockFormContract): void => {
  const el = <T extends Element>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const details = container.querySelector<HTMLDetailsElement>("#bot-block-details");
  const countEl = el<HTMLElement>("bot-block-count");
  const hintEl = el<HTMLElement>("bot-block-hint");
  const enabledCheckbox = el<HTMLInputElement>("bot-block-enabled");

  if (details) {
    details.open = options.initialOpen;
    details.addEventListener("toggle", () => options.onToggle(details.open));
  }

  enabledCheckbox.checked = options.userEnabledReporting;
  hintEl.textContent = STRINGS.botBlock.hint;
  countEl.textContent =
    options.initialCount > 0 ? STRINGS.botBlock.count(options.initialCount) : "";

  enabledCheckbox.addEventListener("change", () => {
    void options.onToggleEnabled(enabledCheckbox.checked);
  });
};
