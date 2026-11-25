import { allowedGenders, GENDERS, type Gender, type ProfileFilters } from "../profile-filter.js";
import { stripTestIds, type MountedRow, type Row } from "./row.js";
import { PROFILE_TYPE_FILTER_LABEL_SELECTOR } from "../sniffies-selectors.js";
import { STRINGS } from "../strings.js";

// ── Gender: a switch row like "Profile Type", with one on/off button per gender ──

export const GENDER_ROW_ID = "snp-gender-filter";

const GENDER_LABELS: Record<Gender, string> = {
  man: STRINGS.filterMenu.man,
  woman: STRINGS.filterMenu.woman,
  nonbinary: STRINGS.filterMenu.nonbinary,
  undefined: STRINGS.filterMenu.notSpecified,
};

const buildGenderRow = (
  anchor: Element,
  filters: ProfileFilters,
  changed: () => void,
): MountedRow | null => {
  // Cloning Sniffies "Profile Type" row carries its (Angular-scoped) styling along.
  const root = anchor.cloneNode(true) as HTMLElement;
  const header = root.querySelector(".list-item-level-2");
  const label = root.querySelector("label");
  const title = root.querySelector("p");
  const toggle = root.querySelector<HTMLInputElement>('.trailing input[type="checkbox"]');
  const optionsContainer = root.querySelector(".options-container");
  if (!label || !title || !toggle || !optionsContainer) {
    return null;
  }
  root.classList.remove("last");
  stripTestIds(root);

  toggle.id = `${GENDER_ROW_ID}-enabled`;
  toggle.disabled = false;
  label.htmlFor = toggle.id;
  label.querySelector("i")?.classList.replace("fa-user", "fa-venus-mars");
  title.textContent = ` ${STRINGS.filterMenu.gender}`;
  toggle.addEventListener("change", () => {
    filters.gender.enabled = toggle.checked;
    changed();
  });

  const body = document.createElement("div");
  body.className = "snp-filter-body";
  const buttons = GENDERS.map((gender) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "snp-gender-option";
    button.dataset.gender = gender;
    button.textContent = GENDER_LABELS[gender];
    button.addEventListener("click", () => {
      const { genders } = filters.gender;
      if (!genders.includes(gender)) {
        filters.gender.genders = GENDERS.filter((g) => g === gender || genders.includes(g));
      } else if (genders.length > 1) {
        // At least one gender has to stay selected.
        filters.gender.genders = genders.filter((g) => g !== gender);
      } else {
        return;
      }
      changed();
    });
    body.appendChild(button);
    return button;
  });
  optionsContainer.replaceChildren(body);

  return {
    root,
    placeApply: (apply) => body.appendChild(apply),
    sync: () => {
      const { enabled, genders } = filters.gender;
      toggle.checked = enabled;
      header?.classList.toggle("active", enabled);
      body.classList.toggle("snp-filter-off", !enabled);
      for (const button of buttons) {
        const on = genders.includes(button.dataset.gender as Gender);
        button.classList.toggle("active", on);
        button.setAttribute("aria-pressed", String(on));
      }
    },
  };
};

export const profileTypeRow = (): Element | null =>
  document.querySelector(PROFILE_TYPE_FILTER_LABEL_SELECTOR)?.closest("filter-type-component") ??
  null;

export const GENDER_ROW: Row = {
  id: GENDER_ROW_ID,
  anchor: profileTypeRow,
  key: (f) => allowedGenders(f.gender).join(),
  build: buildGenderRow,
};
