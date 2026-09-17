export interface BotBlockFormContract {
  reportingEnabled: boolean;
  userEnabledReporting: boolean;
  /** Distinct accounts blocked in roughly the last 24 hours, for the stat line. 0 renders no stat. */
  initialCount: number;
  /** Initial open state of the collapsible section. */
  initialOpen: boolean;
  /** Called when the section is toggled open or closed. */
  onToggle: (open: boolean) => void;
  /** Called when the enable checkbox changes. May be async. */
  onToggleEnabled: (enabled: boolean) => void | Promise<void>;
}
