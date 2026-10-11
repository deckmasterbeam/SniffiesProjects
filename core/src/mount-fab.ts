import { ICON_HOLDER_RIGHT_BOTTOM_SELECTOR } from "./sniffies-selectors.js";

// class for buttons that show up on the map
const ICON_HOLDER_ROW_CLASS = "lower-map-icon";
// class for the fab button when mounted on the map
const FAB_DOCKED_CLASS = "snp-fab-docked";
const NGCONTENT_ATTR_PREFIX = "_ngcontent-";

const copyNgContentAttr = (target: Element, source: Element): void => {
  const attr = Array.from(source.attributes).find((a) => a.name.startsWith(NGCONTENT_ATTR_PREFIX));
  if (attr) {
    target.setAttribute(attr.name, attr.value);
  }
};

export const mountFab = (fab: HTMLButtonElement): void => {
  const tryInsertIntoIconHolder = (): boolean => {
    const iconHolder = document.querySelector<HTMLElement>(ICON_HOLDER_RIGHT_BOTTOM_SELECTOR);
    if (!iconHolder) {
      return false;
    }
    if (fab.parentElement !== iconHolder) {
      iconHolder.prepend(fab);
      fab.classList.add(ICON_HOLDER_ROW_CLASS, FAB_DOCKED_CLASS);
      copyNgContentAttr(fab, iconHolder);
    }
    return true;
  };

  // Fallback anchor, used until the icon row above first appears.
  if (!tryInsertIntoIconHolder()) {
    document.body.appendChild(fab);
  }

  const observer = new MutationObserver(() => {
    tryInsertIntoIconHolder();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
