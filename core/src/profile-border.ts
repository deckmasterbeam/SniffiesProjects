export interface ProfileBorderOpen {
  enabled: boolean;
  openInNewTab: boolean;
}

export const DEFAULT_PROFILE_BORDER_OPEN: ProfileBorderOpen = {
  enabled: false,
  openInNewTab: true,
};

const MARKER_CONTAINER_SELECTOR = '[data-testid="markerUserContainer"]';

export const installProfileBorderHook = (
  getSettings: () => ProfileBorderOpen,
): (() => void) => {
  const handler = (event: MouseEvent) => {
    const { enabled, openInNewTab } = getSettings();
    if (!enabled) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const container = target.closest<HTMLElement>(MARKER_CONTAINER_SELECTOR);
    if (!container || container.dataset.withinRadius !== "false" || !container.id) return;
    event.stopPropagation();
    event.preventDefault();
    const url = `https://sniffies.com/profile/${container.id}`;
    if (openInNewTab) {
      window.open(url, "_blank");
    } else {
      window.location.href = url;
    }
  };
  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
};
