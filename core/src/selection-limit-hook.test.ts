import { afterEach, describe, expect, it } from "vitest";
import { installSelectionLimitOverride } from "./selection-limit-hook.js";

type WithLimit = { maxSelections?: number };

// How Sniffies' bundle reads the cap when it builds a stat's picker.
const sniffiesReadsCap = (option: object): number => {
  const e = option as WithLimit;
  return e.maxSelections ? e.maxSelections : 3;
};

const spectrum = () => ({ name: "PROFILE.STATS.SEXUALITY.SPECTRUM", key: "sexuality.spectrum" });

describe("installSelectionLimitOverride", () => {
  afterEach(() => {
    delete (Object.prototype as WithLimit).maxSelections;
    delete (Object.prototype as Record<string, unknown>)["sexuality.attitude"];
  });

  it("without it, Sniffies caps an option that sets no limit at 3", () => {
    expect(sniffiesReadsCap(spectrum())).toBe(3);
  });

  it("lifts the cap on stat filter options that don't set their own", () => {
    installSelectionLimitOverride(() => true);
    expect(sniffiesReadsCap(spectrum())).toBe(99);
    expect(sniffiesReadsCap({ name: "PROFILE.STATS.STATS.BODY_TYPE", key: "stats.body" })).toBe(99);
  });

  it("leaves an option's own limit alone (Position sets 4)", () => {
    installSelectionLimitOverride(() => true);
    const position = {
      name: "PROFILE.STATS.SEXUALITY.POSITION",
      key: "sexuality.attitude",
      maxSelections: 4,
    };
    expect(sniffiesReadsCap(position)).toBe(4);
  });

  it("answers nothing for any other object", () => {
    installSelectionLimitOverride(() => true);
    // Sniffies' profile editor reads maxSelections off mappings shaped like this one, where a
    // missing value means "single choice" — that must stay missing.
    const profileMapping = { options: [], defaultValue: "bi", unsetValue: null };
    for (const other of [{}, [], profileMapping, { name: "x", key: "y" }, { key: "stats.body" }]) {
      expect((other as WithLimit).maxSelections).toBeUndefined();
    }
    expect((Object.create(spectrum()) as WithLimit).maxSelections).toBeUndefined();
  });

  it("follows isEnabled live", () => {
    let enabled = false;
    installSelectionLimitOverride(() => enabled);
    expect(sniffiesReadsCap(spectrum())).toBe(3);
    enabled = true;
    expect(sniffiesReadsCap(spectrum())).toBe(99);
  });

  it("stays invisible to enumeration, copies and JSON", () => {
    installSelectionLimitOverride(() => true);
    const option = spectrum();
    expect(Object.keys(option)).toEqual(["name", "key"]);
    expect({ ...option }).toEqual({
      name: "PROFILE.STATS.SEXUALITY.SPECTRUM",
      key: "sexuality.spectrum",
    });
    expect(JSON.stringify(option)).not.toContain("maxSelections");
    const seen: string[] = [];
    for (const key in option) {
      seen.push(key);
    }
    expect(seen).toEqual(["name", "key"]);
  });

  it("still lets any object be given its own maxSelections", () => {
    installSelectionLimitOverride(() => true);
    const model: WithLimit = {};
    model.maxSelections = 6;
    expect(model.maxSelections).toBe(6);
    expect(Object.keys(model)).toEqual(["maxSelections"]);
    expect(({} as WithLimit).maxSelections).toBeUndefined();
  });

  describe("Position, which sets its own limit of 4", () => {
    const position = {
      name: "PROFILE.STATS.SEXUALITY.POSITION",
      key: "sexuality.attitude",
      maxSelections: 4,
    };
    type Models = Record<
      string,
      { value: unknown; data: unknown[]; header: string; maxSelections: number }
    >;
    const buildModels = (models: Models): void => {
      for (const e of [position, spectrum()] as (WithLimit & { key: string; name: string })[]) {
        models[e.key] = {
          value: null,
          data: [],
          header: e.name,
          maxSelections: e.maxSelections ? e.maxSelections : 3,
        };
      }
    };

    it("without the override, stays at 4", () => {
      const models: Models = {};
      buildModels(models);
      expect(models["sexuality.attitude"]!.maxSelections).toBe(4);
    });

    it("is lifted when the component builds its pickers, and again on every rebuild", () => {
      installSelectionLimitOverride(() => true);
      const models: Models = {};
      buildModels(models);
      expect(models["sexuality.attitude"]!.maxSelections).toBe(99);
      expect(models["sexuality.spectrum"]!.maxSelections).toBe(99);
      buildModels(models);
      expect(models["sexuality.attitude"]!.maxSelections).toBe(99);

      const editField = models["sexuality.attitude"]!;
      editField.value = ["top"];
      expect(models["sexuality.attitude"]!.value).toEqual(["top"]);
      expect(Object.keys(models)).toEqual(["sexuality.attitude", "sexuality.spectrum"]);
      expect(JSON.parse(JSON.stringify(models))["sexuality.attitude"].maxSelections).toBe(99);
    });

    it("follows isEnabled live across rebuilds", () => {
      let enabled = false;
      installSelectionLimitOverride(() => enabled);
      const models: Models = {};
      buildModels(models);
      expect(models["sexuality.attitude"]!.maxSelections).toBe(4);
      enabled = true;
      buildModels(models);
      expect(models["sexuality.attitude"]!.maxSelections).toBe(99);
    });

    it("leaves every other value stored under that key exactly as normal", () => {
      installSelectionLimitOverride(() => true);

      const values: Record<string, unknown> = {};
      values["sexuality.attitude"] = ["top", "vers"];
      values["sexuality.attitude"] = ["bottom"];
      expect(values).toEqual({ "sexuality.attitude": ["bottom"] });
      expect(Object.getOwnPropertyDescriptor(values, "sexuality.attitude")).toMatchObject({
        value: ["bottom"],
        writable: true,
        enumerable: true,
      });
      expect({ ...values }).toEqual({ "sexuality.attitude": ["bottom"] });
      expect(({} as Record<string, unknown>)["sexuality.attitude"]).toBeUndefined();
      expect(Object.keys({})).toEqual([]);
    });
  });

  it("returns false if already installed", () => {
    expect(installSelectionLimitOverride(() => true)).toBe(true);
    expect(installSelectionLimitOverride(() => true)).toBe(false);
  });
});
