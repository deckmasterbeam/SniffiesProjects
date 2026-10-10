import type { ProfileFiltersFormContract } from "./contracts.js";
import PROFILE_FILTERS_CSS from "./profile-filters.css";
import PROFILE_FILTERS_HTML from "./profile-filters.html";

export { PROFILE_FILTERS_CSS, PROFILE_FILTERS_HTML };
export type { ProfileFiltersFormContract };

export const wireProfileFiltersForm = (
  container: Element,
  options: ProfileFiltersFormContract,
): void => {
  const details = container.querySelector<HTMLDetailsElement>("#profile-filters-details");
  const enabledCheckbox = container.querySelector<HTMLInputElement>("#profile-filters-enabled")!;

  if (details) {
    details.open = options.initialOpen;
    details.addEventListener("toggle", () => options.onToggle(details.open));
  }

  if (options.hint) {
    container.querySelector("#profile-filters-hint")!.textContent = options.hint;
  }

  enabledCheckbox.checked = options.initialEnabled;
  enabledCheckbox.addEventListener("change", () => {
    void options.onToggleEnabled(enabledCheckbox.checked);
  });
};
