import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installCitySearchStatusUI } from "./city-search-status-hook.js";

const buildCitiesInput = (): HTMLElement => {
  const root = document.createElement("cities-input");
  root.innerHTML = `
    <div class="cities-input-container">
      <form>
        <div class="dynamic-input">
          <input data-testid="citiesInput" />
        </div>
        <div class="results"></div>
      </form>
    </div>
  `;
  return root;
};

const DEFAULT_NOTE =
  'Location spoofing only picks up cities you search for here — moving the map before tapping "Travel here" won\'t be captured.';

describe("installCitySearchStatusUI", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = buildCitiesInput();
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it("shows the default search-only instructional note as soon as the search box is present", () => {
    installCitySearchStatusUI();
    const el = document.getElementById("snp-city-search-status");
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe(DEFAULT_NOTE);
    expect(root.contains(el)).toBe(true);
  });

  it("replaces the default note with the pending message", () => {
    const handle = installCitySearchStatusUI();
    handle.showPending("London, England");
    const el = document.getElementById("snp-city-search-status");
    expect(el!.textContent).toBe(
      'Captured "London, England" — pending until you click "Travel here".',
    );
  });

  it("updates the existing element instead of creating a second one on repeated calls", () => {
    const handle = installCitySearchStatusUI();
    handle.showPending("London, England");
    handle.showPending("Paris, France");
    expect(document.querySelectorAll("#snp-city-search-status")).toHaveLength(1);
    expect(document.getElementById("snp-city-search-status")!.textContent).toContain(
      "Paris, France",
    );
  });

  it("reverts to the default note on clear", () => {
    const handle = installCitySearchStatusUI();
    handle.showPending("London, England");
    handle.clear();
    expect(document.getElementById("snp-city-search-status")!.textContent).toBe(DEFAULT_NOTE);
  });

  it("does nothing when the search box isn't present", () => {
    document.body.removeChild(root);
    const handle = installCitySearchStatusUI();
    expect(document.getElementById("snp-city-search-status")).toBeNull();
    expect(() => handle.showPending("London, England")).not.toThrow();
    expect(document.getElementById("snp-city-search-status")).toBeNull();
    document.body.appendChild(root); // restore for afterEach
  });
});
