import { test, expect } from "@playwright/test";
import { SNIFFIES_ORIGIN, mockSniffiesPage, tapBookmarklet } from "../../fixtures/bookmarklet.js";

test("full pass produces no console or page errors", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  await mockSniffiesPage(context);
  // The fixture's marker avatars point at a host that doesn't resolve, which
  // would log a resource error that has nothing to do with the bookmarklet.
  await context.route("https://cdn.sniffies.test/**", (route) =>
    route.fulfill({ contentType: "image/jpeg", body: "" }),
  );
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await tapBookmarklet(page);

  await page.locator('[data-testid="markerUserContainer"][data-within-radius="true"]').click();
  await expect(page.locator('[data-testid="cruiserNameLabel"]')).toBeVisible();

  await page.locator("#snp-fab").click();
  await page.locator("#profile-border-details > summary").click();
  await page.locator("#profile-border-enabled").check();
  await page.locator("#profile-border-tab").selectOption("current-tab");
  await page.locator("#profile-border-save").click();
  await page.locator("#profile-border-enabled").uncheck();
  await page.locator("#snp-close").click();
  await tapBookmarklet(page);

  await page.locator('[data-testid="markerUserContainer"][data-within-radius="false"]').click();

  expect(errors).toEqual([]);
});
