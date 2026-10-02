import type { GeoOverride, ProfileBorderOpen } from "./settings.js";

// ---- UI forms ----

export interface CollapsibleSectionContract {
  initialOpen: boolean;
  onToggle: (open: boolean) => void;
}

export interface GeoOverrideFormContract extends CollapsibleSectionContract {
  initial: GeoOverride;
  onSave: (override: GeoOverride) => void | Promise<void>;
  onClear: (cleared: GeoOverride) => void | Promise<void>;
}

export interface ProfileBorderFormContract extends CollapsibleSectionContract {
  initial: ProfileBorderOpen;
  onSave: (next: ProfileBorderOpen) => void | Promise<void>;
}

export interface BotBlockFormContract extends CollapsibleSectionContract {
  reportingEnabled: boolean;
  userEnabledReporting: boolean;
  /** Distinct accounts blocked in roughly the last 24 hours, for the stat line. 0 renders no stat. */
  initialCount: number;
  onToggleEnabled: (enabled: boolean) => void | Promise<void>;
}

export interface ReportFormContract {
  onSubmit: (message: string) => void | Promise<void>;
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
