import { expect, test, type Page } from "@playwright/test";
import { SELECTOR_CONTRACT } from "../../site-contract.js";

// Drift canary: checks that the DOM shapes our extension code depends on
// still exist on real sniffies.com. This is NOT a behavior test — it never
// asserts what our code does, only that Sniffies hasn't quietly changed
// something out from under it (see e2e/README.md and PLAYWRIGHT_TESTING_TODO.md
// §0b for why this is a separate, non-gating suite).
//
// Requires a captured session — run `yarn auth:capture` first if
// `.auth/user.json` doesn't exist yet or has expired.
//
// FIRST-PASS CAVEAT: this flow (which URL the map lands on, how long markers
// take to render, whether a fresh session lands straight on the map) is
// written from reading the source, not verified against the live site — it
// will likely need adjustment after the first real run.

const contract = (selector: string) => {
  const entry = SELECTOR_CONTRACT.find((e) => e.selector === selector);
  if (!entry) {
    throw new Error(`"${selector}" is not in site-contract.ts — add it there first`);
  }
  return entry;
};

// When the browser doesn't share its location (as in this suite's), Sniffies opens a "Your location
// may be inaccurate" dialog whose overlay covers the whole map. It comes and goes while the page
// settles, even after a marker has been picked to click, so every attempt at the click starts by
// calling this rather than it being done once up front.
// Only that dialog is closed: any other one is something this test shouldn't be dismissing.
const dismissLocationAlert = async (page: Page): Promise<void> => {
  const close = page
    .getByRole("dialog")
    .filter({ hasText: "Your location may be inaccurate" })
    .locator('[data-testid="closeModalButton"]');
  if (await close.isVisible()) {
    // A click can lose a race with the dialog closing itself; the next attempt tries again.
    await close.click({ timeout: 2_000 }).catch(() => {});
  }
};

test.describe("live sniffies.com selector drift canary", () => {
  test("map shows at least one visitor marker", async ({ page }) => {
    const markerEntry = contract('[data-testid="markerUserContainer"]');

    await page.goto("https://sniffies.com/");

    const markers = page.locator(markerEntry.selector);
    // toBeAttached, not toBeVisible: markerUserContainer is a zero-size
    // positioning anchor (confirmed live — display:block, visibility:visible,
    // but a 0x0 bounding box on every marker) whose actual pixels come from
    // an absolutely-positioned child. Our own code only ever does
    // target.closest(MARKER_CONTAINER_SELECTOR) on a click and reads its data
    // attributes (core/src/profile-border-hook.ts) — it never needs this
    // element to have a layout box of its own, so toBeVisible()'s non-empty-
    // bounding-box requirement was asserting a property this element was
    // never meant to have.
    await expect(
      markers.first(),
      `${markerEntry.description} (${markerEntry.source}) — if this fails, ` +
        `either the selector drifted or there are genuinely no visitors nearby ` +
        `right now; try again before assuming drift`,
    ).toBeAttached({ timeout: 30_000 });
  });

  test("opening a profile panel exposes the expected controls", async ({ page }) => {
    const avatarEntry = contract('[data-testid="cv-marker-avatar-image"]');
    const screenEntry = contract("#app-screen");
    const nameLabelEntry = contract('[data-testid="cruiserNameLabel"]');
    const pinButtonEntry = contract('[data-testid="pinUserButton"]');

    await page.goto("https://sniffies.com/");

    const avatars = page.locator(avatarEntry.selector);
    const firstClickableIndex = () =>
      avatars.evaluateAll((els) =>
        els.findIndex((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !!hit && el.contains(hit);
        }),
      );
    // One retried step: the location dialog can open between picking a marker and clicking it, so a
    // short click timeout lets a blocked attempt fail fast, close the dialog and go again.
    await expect(async () => {
      await dismissLocationAlert(page);
      const index = await firstClickableIndex();
      expect(
        index,
        `${avatarEntry.description} (${avatarEntry.source}) — no marker avatar is on-screen and unobstructed`,
      ).toBeGreaterThanOrEqual(0);
      await avatars.nth(index).click({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const screen = page.locator(screenEntry.selector);
    await expect(screen, `${screenEntry.description} (${screenEntry.source})`).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      screen.locator(nameLabelEntry.selector),
      `${nameLabelEntry.description} (${nameLabelEntry.source})`,
    ).toBeVisible();
    await expect(
      screen.locator(pinButtonEntry.selector),
      `${pinButtonEntry.description} (${pinButtonEntry.source})`,
    ).toBeVisible();
  });
});
