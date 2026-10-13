import type { HidePhotosFormContract } from "./contracts.js";
import HIDE_PHOTOS_CSS from "./hide-photos.css";
import HIDE_PHOTOS_HTML from "./hide-photos.html";

export { HIDE_PHOTOS_CSS, HIDE_PHOTOS_HTML };
export type { HidePhotosFormContract };

export const wireHidePhotosForm = (container: Element, options: HidePhotosFormContract): void => {
  const details = container.querySelector<HTMLDetailsElement>("#hide-photos-details");
  if (details) {
    details.open = options.initialOpen;
    details.addEventListener("toggle", () => options.onToggle(details.open));
  }

  const enabledCheckbox = container.querySelector<HTMLInputElement>("#hide-photos-enabled")!;
  enabledCheckbox.checked = options.initialEnabled;
  enabledCheckbox.addEventListener("change", () => {
    void options.onToggleEnabled(enabledCheckbox.checked);
  });
};
