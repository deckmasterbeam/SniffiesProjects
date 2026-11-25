export type Units = "imperial" | "metric";

const isUnits = (value: unknown): value is Units => value === "imperial" || value === "metric";

const IMPERIAL_COUNTRIES = ["US", "LR", "MM"];

const UNITS_KEY = "snp-preferred-units";

export const unitsFromAccount = (payload: unknown): Units | null => {
  const user = (
    payload as {
      user?: {
        private?: { options?: { units?: unknown } };
        data?: { profile?: { countryCode?: unknown } };
      };
    } | null
  )?.user;
  const setting = user?.private?.options?.units;
  if (isUnits(setting)) {
    return setting;
  }
  const country = user?.data?.profile?.countryCode;
  return typeof country === "string" ? unitsForCountry(country) : null;
};

const unitsForCountry = (country: string): Units =>
  IMPERIAL_COUNTRIES.includes(country.toUpperCase()) ? "imperial" : "metric";

/** Remembers the account's units, shared by the page hook and the menu UI. */
export const saveUnits = (units: Units): void => {
  try {
    localStorage.setItem(UNITS_KEY, units);
  } catch {
    // Storage can be blocked; the menu then falls back to the browser's region.
  }
};

export const preferredUnits = (): Units => {
  try {
    const saved = localStorage.getItem(UNITS_KEY);
    if (isUnits(saved)) {
      return saved;
    }
  } catch {
    // Fall through to the browser's region.
  }
  const region = typeof navigator === "undefined" ? "" : (navigator.language.split("-")[1] ?? "");
  return unitsForCountry(region);
};
