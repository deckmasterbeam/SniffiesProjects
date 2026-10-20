import type { ProfileFilters } from "./profile-filter.js";
import type { GeoOverride, PremiumFeatureFlags, ProfileBorderOpen } from "./settings.js";

// ---- UI forms ----

export interface CollapsibleSectionContract {
  initialOpen: boolean;
  onToggle: (open: boolean) => void;
}

export interface PremiumFeaturesFormContract extends CollapsibleSectionContract {
  initialEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void | Promise<void>;
  /** Each feature's own switch; only live while the master switch is on. */
  flags: PremiumFeatureFlags;
  onFlagChange: (key: keyof PremiumFeatureFlags, enabled: boolean) => void | Promise<void>;
  /** True when the account is known to have Sniffies Plus; null when unknown. */
  hasPlus: boolean | null;
  /** Omitted where location spoofing isn't supported (the bookmarklet). */
  geo?: {
    initial: GeoOverride;
    onClear: (cleared: GeoOverride) => void | Promise<void>;
  };
  border?: {
    initial: ProfileBorderOpen;
    onSave: (next: ProfileBorderOpen) => void | Promise<void>;
  };
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

export interface ProfileFiltersFormContract extends CollapsibleSectionContract {
  hint?: string;
  initialEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void | Promise<void>;
}

export interface ProfileFiltersMenuContract {
  initial: ProfileFilters;
  applied: ProfileFilters;
  onChange: (next: ProfileFilters) => void | Promise<void>;
  reloadPage?: () => void;
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
  /** Master "Premium features" switch, read live. Spoofing only happens while it is on. */
  isPremiumEnabled: () => boolean;
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
