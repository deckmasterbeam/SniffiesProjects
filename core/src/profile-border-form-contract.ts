import type { ProfileBorderOpen } from "./settings.js";

export interface ProfileBorderFormContract {
  initial: ProfileBorderOpen;
  /** Called when the enable checkbox changes, and again when Save is clicked after changing the tab target. May be async. */
  onSave: (next: ProfileBorderOpen) => void | Promise<void>;
  /** Initial open state of the collapsible section. */
  initialOpen: boolean;
  /** Called when the section is toggled open or closed. */
  onToggle: (open: boolean) => void;
}
