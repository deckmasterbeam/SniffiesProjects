import type { GeoOverride } from "./settings.js";

export interface GeoOverrideFormContract {
  initial: GeoOverride;
  /** Called when the user clicks Save. May be async. */
  onSave: (override: GeoOverride) => void | Promise<void>;
  /** Used by "Fill with current" — pass the pre-hook native method on pages where the hook is installed. */
  getNativePosition: (success: PositionCallback, error?: PositionErrorCallback | null) => void;
  /** Initial open state of the collapsible section. */
  initialOpen?: boolean;
  /** Called when the section is toggled open or closed. */
  onToggle?: (open: boolean) => void;
}
