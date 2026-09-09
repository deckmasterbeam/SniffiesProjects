import { test, expect } from "@playwright/test";
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

    const avatar = page.locator(avatarEntry.selector).first();
    await expect(avatar, `${avatarEntry.description} (${avatarEntry.source})`).toBeVisible({
      timeout: 30_000,
    });
    await avatar.click();

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
