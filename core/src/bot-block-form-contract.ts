export interface BotBlockFormContract {
  /** Whether the bot-report/block feature is live. When false, the section renders disabled with a "Coming soon!" hint. */
  reportingEnabled: boolean;
  initialEnabled: boolean;
  /** Distinct accounts blocked in roughly the last 24 hours, for the stat line. 0 renders no stat. */
  initialCount: number;
  /** Initial open state of the collapsible section. */
  initialOpen: boolean;
  /** Called when the section is toggled open or closed. */
  onToggle: (open: boolean) => void;
  /** Called when the enable checkbox changes. May be async. */
  onToggleEnabled: (enabled: boolean) => void | Promise<void>;
}
