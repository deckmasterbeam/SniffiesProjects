/**
 * Injects the FAB trigger button next to the Sniffies nav bar's Sitelinks
 * element. That element isn't present immediately on page load, so this
 * waits (observing the DOM) until it shows up rather than falling back to
 * some other mount point. Calls `onMounted` once the fab is actually in the
 * DOM.
 */
export const mountFab = (fab: HTMLButtonElement, onMounted: () => void): void => {
  const tryInsert = (): boolean => {
    const navTarget = document.querySelector<HTMLElement>('[title="Sitelinks"]');
    if (!navTarget?.parentElement) {
      return false;
    }
    navTarget.parentElement.insertBefore(fab, navTarget.nextSibling);
    return true;
  };

  if (tryInsert()) {
    onMounted();
    return;
  }

  const observer = new MutationObserver(() => {
    if (tryInsert()) {
      observer.disconnect();
      onMounted();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

/**
 * Returns true if the current page is a Sniffies domain.
 */
export const isSniffiesDomain = (): boolean =>
  location.hostname.endsWith("sniffies.com");
