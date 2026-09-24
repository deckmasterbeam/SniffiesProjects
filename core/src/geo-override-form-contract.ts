import type { GeoOverride } from "./settings.js";

export interface GeoOverrideFormContract {
  initial: GeoOverride;
  /** Called when the user toggles spoofing on/off via the checkbox. */
  onSave: (override: GeoOverride) => void | Promise<void>;
  /**
   * Called when the user clicks "Clear location" to discard the captured
   * coords/label. `enabled` is preserved as-is — clearing the location
   * doesn't turn spoofing off, it just leaves it armed and waiting for a new
   * pick (same as the initial "enabled but nothing captured yet" state).
   */
  onClear: (cleared: GeoOverride) => void | Promise<void>;
  /** Initial open state of the collapsible section. */
  initialOpen: boolean;
  /** Called when the section is toggled open or closed. */
  onToggle: (open: boolean) => void;
}
