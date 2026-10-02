// Every type a consumer (Chrome client, userscript, bookmarklet) has to
// supply to core lives here: the shape of the boundary in one place, apart
// from the implementations behind it.

import type { GeoOverride, ProfileBorderOpen } from "./settings.js";

// ---- UI forms ----

/** Shared by every collapsible panel section. */
export interface CollapsibleSectionContract {
  /** Initial open state of the collapsible section. */
  initialOpen: boolean;
  /** Called when the section is toggled open or closed. */
  onToggle: (open: boolean) => void;
}

export interface GeoOverrideFormContract extends CollapsibleSectionContract {
  initial: GeoOverride;
  onSave: (override: GeoOverride) => void | Promise<void>;
  onClear: (cleared: GeoOverride) => void | Promise<void>;
}

export interface ProfileBorderFormContract extends CollapsibleSectionContract {
  initial: ProfileBorderOpen;
  /** Called when the enable checkbox changes, and again when Save is clicked after changing the tab target. May be async. */
  onSave: (next: ProfileBorderOpen) => void | Promise<void>;
}

export interface BotBlockFormContract extends CollapsibleSectionContract {
  reportingEnabled: boolean;
  userEnabledReporting: boolean;
  /** Distinct accounts blocked in roughly the last 24 hours, for the stat line. 0 renders no stat. */
  initialCount: number;
  /** Called when the enable checkbox changes. May be async. */
  onToggleEnabled: (enabled: boolean) => void | Promise<void>;
}

export interface ReportFormContract {
  /**
   * Called when the user confirms the report with an optional message. May be async — the modal
   * shows a submitting state until this resolves, then closes. Rejecting shows a generic failure
   * status and re-enables the submit button so the user can retry.
   */
  onSubmit: (message: string) => void | Promise<void>;
  /** Called when the user cancels or dismisses the modal without submitting. */
  onCancel?: () => void;
}

// ---- Hooks ----

export interface BotBlockState {
  blockedIds: ReadonlySet<string>;
  enabled: boolean;
}

export interface MarkerSelection {
  userId: string;
  profilePicUrl: string | null;
}

export interface ReportButtonInjectionOptions {
  serverBase: string;
  getAuthHeaders: () => Record<string, string>;
  reportingEnabled: boolean;
  getReporterUserId: () => string;
  onProfileResolved?: (screen: Element, userId: string) => void;
  onMarkerClick?: (marker: HTMLElement, selection: MarkerSelection | null) => void;
}

export interface LocationOverrideControllerOptions {
  initialOverride: GeoOverride;
  onOverrideChanged: (next: GeoOverride) => void;
  onPosition?: (coords: { latitude: number; longitude: number }) => void;
  reloadPage?: () => void;
}

export type ClientType = "chrome-client" | "userscript";

export interface LogInitOptions {
  serverBase: string;
  clientSecret: string;
  userId: string;
  clientType: ClientType;
  version: string;
}
