import type { Page } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SNIFFIES_ORIGIN } from "./constants.js";
import { mockSniffiesPage, seedLocalStorage } from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKMARKLET_CODE = readFileSync(
  path.resolve(__dirname, "../../bookmarklet/dist/inject.js"),
  "utf-8",
);

export { SNIFFIES_ORIGIN, mockSniffiesPage, seedLocalStorage as seedBookmarkletStorage };

/** Runs the built bookmarklet/dist/inject.js the same way tapping the bookmark does */
export const tapBookmarklet = (page: Page) => page.addScriptTag({ content: BOOKMARKLET_CODE });

const ICON_HOLDER = '[data-testid="iconHolderRightBottom"]';

/** Removes the map's icon row, as if Sniffies hasn't rendered it yet. */
export const removeIconHolder = (page: Page) =>
  page.evaluate((selector) => document.querySelector(selector)?.remove(), ICON_HOLDER);

/** Puts the map's icon row back, as if Sniffies has now rendered it. */
export const addIconHolder = (page: Page) =>
  page.evaluate(() => {
    const holder = document.createElement("div");
    holder.dataset.testid = "iconHolderRightBottom";
    document.body.appendChild(holder);
  });
