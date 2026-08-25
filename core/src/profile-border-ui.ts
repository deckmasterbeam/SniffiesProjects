import PROFILE_BORDER_HTML from "./profile-border.html";
import PROFILE_BORDER_CSS from "./profile-border.css";
import type { ProfileBorderOpen } from "./settings.js";
import type { ProfileBorderFormContract } from "./profile-border-form-contract.js";

export { PROFILE_BORDER_HTML, PROFILE_BORDER_CSS };
export type { ProfileBorderFormContract };

const TAB_LABELS = {
  current: "Current tab",
  currentSaved: "Current tab (saved)",
  new: "New tab",
  newSaved: "New tab (saved)",
} as const;

export const wireProfileBorderForm = (
  container: Element,
  options: ProfileBorderFormContract,
): void => {
  const el = <T extends Element>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const details = container.querySelector<HTMLDetailsElement>("#profile-border-details");
  const enabledCheckbox = el<HTMLInputElement>("profile-border-enabled");
  const tabField = el<HTMLElement>("profile-border-tab-field");
  const tabSelect = el<HTMLSelectElement>("profile-border-tab");
  const optionCurrent = tabSelect.querySelector<HTMLOptionElement>('option[value="current-tab"]')!;
  const optionNew = tabSelect.querySelector<HTMLOptionElement>('option[value="new-tab"]')!;
  const saveBtn = el<HTMLButtonElement>("profile-border-save");

  // Wire collapsible
  if (details) {
    details.open = options.initialOpen;
    details.addEventListener("toggle", () => options.onToggle(details.open));
  }

  const applyLabels = (openInNewTab: boolean): void => {
    optionCurrent.text = openInNewTab ? TAB_LABELS.current : TAB_LABELS.currentSaved;
    optionNew.text = openInNewTab ? TAB_LABELS.newSaved : TAB_LABELS.new;
  };

  const readForm = (): ProfileBorderOpen => ({
    enabled: enabledCheckbox.checked,
    openInNewTab: tabSelect.value === "new-tab",
  });

  // Populate initial values
  const { initial } = options;
  let savedOpenInNewTab = initial.openInNewTab;

  enabledCheckbox.checked = initial.enabled;
  tabField.style.display = initial.enabled ? "" : "none";
  tabSelect.value = initial.openInNewTab ? "new-tab" : "current-tab";
  applyLabels(initial.openInNewTab);
  saveBtn.style.display = "none";

  enabledCheckbox.addEventListener("change", () => {
    tabField.style.display = enabledCheckbox.checked ? "" : "none";
    void options.onSave(readForm());
  });

  tabSelect.addEventListener("change", () => {
    const isChanged = (tabSelect.value === "new-tab") !== savedOpenInNewTab;
    saveBtn.style.display = isChanged ? "" : "none";
  });

  saveBtn.addEventListener("click", () => {
    const next = readForm();
    void Promise.resolve(options.onSave(next)).then(() => {
      applyLabels(next.openInNewTab);
      savedOpenInNewTab = next.openInNewTab;
      saveBtn.style.display = "none";
    });
  });
};
