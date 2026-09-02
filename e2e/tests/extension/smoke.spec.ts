import { test, expect, SNIFFIES_ORIGIN } from "../../fixtures/extension.js";
import { setExtensionStorage } from "../../fixtures/storage.js";

// First real test against the fixture harness (PLAYWRIGHT_TESTING_TODO.md
// §0). Exercises two of the trickiest, most bug-prone behaviors documented
// at length in TODO.md's bot-reporting section: the panel-switch retry logic
// in sniffies-profile-id.ts, and profile-border-hook's capture-phase redirect
// for markers outside the free radius — plus a full report-modal submit
// round trip through the mocked /api/report endpoint, proving the server
// stubbing (§0's other prerequisite) works end-to-end too.

test("extension loads and injects on the fixture page", async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);

  // The report button's click handler no-ops without a reporter id — real
  // Sniffies supplies it by connecting a WebSocket carrying ?userId=... (see
  // core/src/user-id-hook.ts), which this fixture never does. Seed it
  // directly instead, before the content script's init read picks it up.
  await setExtensionStorage(context, { sniffiesUserId: "cccccccccccccccccccccccc" });

  const page = await context.newPage();
  await page.goto(`${SNIFFIES_ORIGIN}/`);

  // Within-radius marker: clicking it should open the (fixture's fake) panel
  // and get the report-button injection once sniffies-profile-id.ts's retry
  // loop catches the panel's async render. Must click the avatar image
  // itself, not the outer container — the click handler in
  // sniffies-profile-id.ts does target.closest(MARKER_AVATAR_SELECTOR), which
  // only matches the image or its descendants, not an ancestor container.
  await page
    .locator(
      '[data-testid="markerUserContainer"][data-within-radius="true"] [data-testid="cv-marker-avatar-image"]',
    )
    .click();

  const nameLabel = page.locator('[data-testid="cruiserNameLabel"]');
  await expect(nameLabel).toBeVisible({ timeout: 5_000 });

  const reportButton = page.locator("[data-sniffies-report-injection]");
  await expect(reportButton).toBeVisible({ timeout: 5_000 });

  // Report flow: opens the modal, submits, and expects the mocked
  // /api/report call to succeed (server-mocks.ts stubs it { ok: true }).
  await reportButton.click();
  const modalStatus = page.locator("#snp-report-status");
  await page.locator("#snp-report-submit").click();
  await expect(modalStatus).toHaveText("Reported. Thanks.", { timeout: 5_000 });
});

test("marker outside the free radius redirects instead of opening a panel", async ({ context }) => {
  // profile-border-hook.ts's handler bails immediately unless
  // settings.enabled — and DEFAULT_PROFILE_BORDER_OPEN.enabled is false, so
  // this has to be turned on explicitly. openInNewTab: false keeps the
  // redirect in the same page/tab our test is already watching, rather than
  // opening a second one via window.open that this test doesn't track.
  await setExtensionStorage(context, {
    profileBorderOpen: { enabled: true, openInNewTab: false },
  });

  const page = await context.newPage();
  await page.goto(`${SNIFFIES_ORIGIN}/`);

  await page.locator('[data-testid="markerUserContainer"][data-within-radius="false"]').click();

  await page.waitForURL(`${SNIFFIES_ORIGIN}/profile/bbbbbbbbbbbbbbbbbbbbbbbb`);
  // profile-border-hook's stopImmediatePropagation should have prevented the
  // normal click handler from ever running — no panel, no report button.
  await expect(page.locator('[data-testid="cruiserNameLabel"]')).toHaveCount(0);
});
