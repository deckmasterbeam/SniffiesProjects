const PROPERTY = "maxSelections";
const UNLIMITED = 99;
// Position sets its own maxSelections (4), so the prototype fallback below never sees it.
const POSITION_KEY = "sexuality.attitude";

const owns = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

const isStatFilterOption = (target: unknown): boolean => {
  if (typeof target !== "object" || target === null || !owns(target, "key")) {
    return false;
  }
  const { name } = target as { name?: unknown };
  return owns(target, "name") && typeof name === "string" && name.startsWith("PROFILE.STATS.");
};

const isPickerModel = (value: unknown): value is { maxSelections: number } =>
  typeof value === "object" &&
  value !== null &&
  owns(value, PROPERTY) &&
  owns(value, "header") &&
  owns(value, "data");

const defineData = (target: object, key: string, value: unknown): void => {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

/**
 * Must run in the page's own JS world. `isEnabled` is read each time Sniffies builds a picker,
 * so it can change without a reload.
 *
 * @returns false if already installed.
 */
export const installSelectionLimitOverride = (isEnabled: () => boolean): boolean => {
  if (Object.getOwnPropertyDescriptor(Object.prototype, PROPERTY)) {
    return false;
  }

  // Sexuality / Body Type
  Object.defineProperty(Object.prototype, PROPERTY, {
    configurable: true,
    enumerable: false,
    get(this: unknown) {
      return isEnabled() && isStatFilterOption(this) ? UNLIMITED : undefined;
    },
    set(this: object, value: unknown) {
      defineData(this, PROPERTY, value);
    },
  });

  // Position
  const lift = (value: unknown): unknown => {
    if (isEnabled() && isPickerModel(value)) {
      value.maxSelections = UNLIMITED;
    }
    return value;
  };
  Object.defineProperty(Object.prototype, POSITION_KEY, {
    configurable: true,
    enumerable: false,
    get() {
      return undefined;
    },
    set(this: object, value: unknown) {
      if (!isPickerModel(value)) {
        defineData(this, POSITION_KEY, value);
        return;
      }
      let current = lift(value);
      Object.defineProperty(this, POSITION_KEY, {
        enumerable: true,
        configurable: true,
        get: () => current,
        set: (next: unknown) => {
          current = lift(next);
        },
      });
    },
  });
  return true;
};
