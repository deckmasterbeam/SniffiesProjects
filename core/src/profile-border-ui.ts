import PROFILE_BORDER_HTML from "./profile-border.html";
import PROFILE_BORDER_CSS from "./profile-border.css";
import type { ProfileBorderOpen } from "./profile-border.js";

export { PROFILE_BORDER_HTML, PROFILE_BORDER_CSS };

export interface ProfileBorderFormContract {
  initial: ProfileBorderOpen;
  onSave: (next: ProfileBorderOpen) => void | Promise<void>;
  initialOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export const wireProfileBorderForm = (
  container: Element,
  options: ProfileBorderFormContract,
): void => {
  const details = container.querySelector<HTMLDetailsElement>("#profile-border-details");
  const enabledCheckbox = container.querySelector<HTMLInputElement>("#profile-border-enabled")!;
  const fieldsDiv = container.querySelector<HTMLElement>("#profile-border-fields")!;
  const tabSelect = container.querySelector<HTMLSelectElement>("#profile-border-tab")!;

  if (details) {
    if (options.initialOpen !== undefined) {
      details.open = options.initialOpen;
    }
    if (options.onToggle) {
      const onToggle = options.onToggle;
      details.addEventListener("toggle", () => onToggle(details.open));
    }
  }

  const read = (): ProfileBorderOpen => ({
    enabled: enabledCheckbox.checked,
    openInNewTab: tabSelect.value === "new-tab",
  });

  enabledCheckbox.checked = options.initial.enabled;
  fieldsDiv.style.display = options.initial.enabled ? "" : "none";
  tabSelect.value = options.initial.openInNewTab ? "new-tab" : "current-tab";

  enabledCheckbox.addEventListener("change", () => {
    fieldsDiv.style.display = enabledCheckbox.checked ? "" : "none";
    void Promise.resolve(options.onSave(read()));
  });

  tabSelect.addEventListener("change", () => {
    void Promise.resolve(options.onSave(read()));
  });
};
