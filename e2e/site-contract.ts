// The e2e drift canary's view of "what do we depend on" — pairs each real
// selector (imported from core/src/sniffies-selectors.ts, the actual single
// source of truth used by client/, userscript/, and bookmarklet/) with a
// human-readable description and its source file.
//
// SELECTOR_METADATA is typed as Record<SniffiesSelectorName, ...>, so adding
// a new selector to SNIFFIES_SELECTORS in core without adding a matching
// entry here is a TypeScript error in THIS file ("Property '<name>' is
// missing") — the two can't silently fall out of sync.

import { SNIFFIES_SELECTORS, type SniffiesSelectorName } from "../core/src/sniffies-selectors.js";

interface SelectorMeta {
  description: string;
  source: string;
}

const SELECTOR_METADATA: Record<SniffiesSelectorName, SelectorMeta> = {
  MARKER_CONTAINER_SELECTOR: {
    description: "Marker container carrying data-within-radius, used by the profile-border redirect",
    source: "core/src/profile-border-hook.ts",
  },
  MARKER_AVATAR_SELECTOR: {
    description: "Map marker avatar image — click target that resolves a profile's user id",
    source: "client/src/content/sniffies-profile-id.ts",
  },
  APP_SCREEN_SELECTOR: {
    description: "Profile panel root, hosts the name label and pin button",
    source: "client/src/content/sniffies-profile-id.ts",
  },
  NAME_LABEL_SELECTOR: {
    description: "Cruiser name label inside the open profile panel",
    source: "client/src/content/sniffies-profile-id.ts",
  },
  PIN_BUTTON_SELECTOR: {
    description: "Pin-user button — the report button is anchored to its parent",
    source: "client/src/content/sniffies-profile-id.ts",
  },
  SITELINKS_NAV_SELECTOR: {
    description: "Sidebar nav link used as the FAB's mount anchor (userscript/bookmarklet only)",
    source: "userscript/src/userscript.ts, bookmarklet/src/mount-fab.ts",
  },
};

export interface SelectorContractEntry {
  description: string;
  selector: string;
  source: string;
}

export const SELECTOR_CONTRACT: SelectorContractEntry[] = (
  Object.keys(SNIFFIES_SELECTORS) as SniffiesSelectorName[]
).map((name) => ({
  selector: SNIFFIES_SELECTORS[name],
  ...SELECTOR_METADATA[name],
}));
