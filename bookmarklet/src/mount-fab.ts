/**
 * Injects the FAB trigger button into the page.
 * Prefers to insert it next to the Sniffies nav bar's Sitelinks element.
 * Falls back to appending to document.body if the nav is not found.
 */
export const mountFab = (fab: HTMLButtonElement): void => {
  const navTarget = document.querySelector<HTMLElement>('[title="Sitelinks"]');
  if (navTarget?.parentElement) {
    navTarget.parentElement.insertBefore(fab, navTarget.nextSibling);
  } else {
    document.body.appendChild(fab);
  }
};

/**
 * Returns true if the current page is a Sniffies domain.
 */
export const isSniffiesDomain = (): boolean =>
  location.hostname.endsWith("sniffies.com");
