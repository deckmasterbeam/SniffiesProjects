export const STRINGS = {
  updateBanner: {
    message:
      'This extension is out of date. go to <a href="https://www.joshbarnett.dev/projects/sniffies-project/install/" target="_blank" rel="noopener noreferrer">https://www.joshbarnett.dev/projects/sniffies-project/install/</a> to update.',
    dismiss: "Dismiss for 24 hours",
  },
  report: {
    title: "Report profile",
    hint: "Flag this profile as a suspected bot account for manual review.",
    messageLabel: "Message (optional)",
    messagePlaceholder: "Any information that would help in reviewing this report",
    cancel: "Cancel",
    submit: "Report bot",
    submitting: "Submitting...",
    submitted: "Reported. Thank you!",
    failed: "Failed to submit report. Please try again.",
    menuButton: "Sniffies Project: Report",
    menuButtonTitle: "Report as suspected bot",
  },
  botBlock: {
    label: "Block Bot Accounts",
    hint: "Hide bot profiles from the map.",
    count: (n: number): string => `${n} bot${n === 1 ? "" : "s"} blocked in the last 24 hours`,
  },
  profileFilters: {
    label: "Expanded Filters",
    hint: "Add Gender, Height, and Weight filters. Enable choosing any number of options in the Sexuality, Body Type, and Position filters.",
  },
  premium: {
    label: "Premium Features",
    plusNotice: "You have Sniffies Plus, so you don't need these features.",
    hint: "Unlocks features that Sniffies normally paywalls: location spoofing, no boundary restrictions, and hiding/unhiding sent photos.",
    location: {
      label: "Location Spoofing",
      hint: 'Use the Sniffies "Travel Mode" to select a location to travel to. In that mode, search for any location, then click "Travel here". Only searching by name is supported for the override, manually dragging the map is not supported.',
      clear: "Clear location",
      saved: (location: string): string => `Saved: ${location}`,
    },
    boundary: {
      label: "No Boundary Restrictions",
      hint: "Ignore the boundary restrictions that Sniffies normally enforces.",
      hintNoTabChoice: "Click on profiles even if they would be outside the boundary.",
      openIn: "Open in",
      currentTab: "Current tab",
      currentTabSaved: "Current tab (saved)",
      newTab: "New tab",
      newTabSaved: "New tab (saved)",
      save: "Save",
    },
    photos: {
      label: "Hide Sent Photos",
      hint: "Enables Sniffies 'Hide Photo' action on photos you've sent.",
    },
  },
  citySearch: {
    note: 'Location spoofing only picks up on locations you search for. Moving the map before tapping "Travel here" won\'t be captured.',
    pending: (description: string): string =>
      `Captured "${description}". Location change pending until you click "Travel here".`,
  },
  hidePhotoMenu: {
    hideAll: "Hide All My Photos",
    unhideAll: "Unhide All My Photos",
  },
  readReceipt: {
    seen: "Seen",
  },
  filterMenu: {
    gender: "Gender",
    male: "Male",
    female: "Female",
    nonbinary: "Nonbinary",
    notSpecified: "Not specified",
    onlineAfter: "Online After",
    rolling: "Rolling",
    static: "Static",
    height: "Height",
    weight: "Weight",
    select: "Select",
    reloadToApply: "Reload to apply",
    cruisersOnlineAfter: (time: string): string => `Cruisers online after ${time}`,
  },
  range: {
    makeASelection: (title: string): string => `${title}: Make a Selection`,
    min: "Min",
    max: "Max",
    unit: "Unit",
    to: "to",
    cancel: "Cancel",
    done: "Done",
    selectAValue: "Select a value:",
    includeUnlisted: (title: string): string => ` Include profiles with no ${title} listed`,
    upTo: (value: string): string => `Up to ${value}`,
  },
};

const lookup = (path: string): string => {
  let node: unknown = STRINGS;
  for (const key of path.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[key];
  }
  if (typeof node !== "string") {
    throw new Error(`Unknown string key: ${path}`);
  }
  return node;
};

/** Replaces each `{{path.to.key}}` in an HTML template with its entry in `STRINGS`. */
export const render = (html: string): string =>
  html.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => lookup(path));
