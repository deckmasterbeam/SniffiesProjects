import { test, expect, SNIFFIES_ORIGIN } from "../../fixtures/extension.js";
import { setExtensionStorage } from "../../fixtures/storage.js";


test("extension loads and injects on the fixture page", async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);

  await setExtensionStorage(context, { sniffiesUserId: "cccccccccccccccccccccccc" });

  const page = await context.newPage();
  await page.goto(`${SNIFFIES_ORIGIN}/`);

  // Within-radius marker
  await page
    .locator(
      '[data-testid="markerUserContainer"][data-within-radius="true"] [data-testid="cv-marker-avatar-image"]',
    )
    .click();

  const nameLabel = page.locator('[data-testid="cruiserNameLabel"]');
  await expect(nameLabel).toBeVisible({ timeout: 5_000 });

  // The report entry mounts inside the three-dot options menu, only exists once opened.
  await page.locator('[data-testid="threedotButton"]').click();
  const reportButton = page.locator(
    '[data-testid="profileOptionsContainer"] [data-sniffies-report-injection]',
  );
  await expect(reportButton).toHaveText("Sniffies Project: Report", { timeout: 5_000 });

  await reportButton.click();
  const modalStatus = page.locator("#snp-report-status");
  await page.locator("#snp-report-submit").click();
  await expect(modalStatus).toHaveText("Reported. Thanks.", { timeout: 5_000 });
});

test("marker outside the free radius redirects instead of opening a panel", async ({ context }) => {

  await setExtensionStorage(context, {
    profileBorderOpen: { enabled: true, openInNewTab: false },
  });

  const page = await context.newPage();
  await page.goto(`${SNIFFIES_ORIGIN}/`);

  await page.locator('[data-testid="markerUserContainer"][data-within-radius="false"]').click();

  await page.waitForURL(`${SNIFFIES_ORIGIN}/profile/bbbbbbbbbbbbbbbbbbbbbbbb`);
  // profile-border-hook's stopImmediatePropagation should prevented the normal click handler from ever running
  await expect(page.locator('[data-testid="cruiserNameLabel"]')).toHaveCount(0);
});
