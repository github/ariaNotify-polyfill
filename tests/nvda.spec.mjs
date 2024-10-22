// @ts-check

import { test, expect } from "@playwright/test";
import { nvda, WindowsKeyCodes, WindowsModifiers } from "@guidepup/guidepup";

// Pre-requisites:
// - Run `REG ADD HKCU\Software\Guidepup\Nvda`
// - Run `REG ADD HKCU\Software\Guidepup\Nvda /v guidepup_nvda_0.1.1-2021.3.1 /t REG_SZ /d "C:\Program Files (x86)\NVDA\\"`
// (version is from https://github.com/guidepup/setup/blob/82179ec8915680344d0db320422dd18e29593eb9/package.json#L60C27-L60C41)

if (process.platform === "win32") {
  test.beforeAll(async () => {
    // Start NVDA
    await nvda.start();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to suggested test example page
    await page.goto("suggested-text/index.html", {
      waitUntil: "load",
    });

    // Adapted from https://github.com/guidepup/guidepup-playwright/blob/34c3973dd98e19c81f468352e13bac5b8434b28f/src/nvdaTest.ts#L137-L167:

    // Make sure NVDA is not in focus mode.
    await nvda.perform(nvda.keyboardCommands.exitFocusMode);

    // Ensure the document is ready and focused.
    await page.bringToFront();
    await page.locator("body").waitFor();
    await page.locator("body").focus();

    // Navigate to the beginning of the web content.
    await nvda.perform(nvda.keyboardCommands.readNextFocusableItem);
    await nvda.perform(nvda.keyboardCommands.toggleBetweenBrowseAndFocusMode);
    await nvda.perform(nvda.keyboardCommands.toggleBetweenBrowseAndFocusMode);
    await nvda.perform(nvda.keyboardCommands.exitFocusMode);
    await nvda.perform({
      keyCode: [WindowsKeyCodes.Home],
      modifiers: [WindowsModifiers.Control],
    });

    // Clear out logs.
    await nvda.clearItemTextLog();
    await nvda.clearSpokenPhraseLog();
  });

  test.afterAll(async () => {
    // Stop NVDA
    await nvda.stop();
  });

  test("SuggestedText", async ({ page }) => {
    // Type a completable string in the textarea
    nvda.type("a");

    // Wait for the suggestion to appear
    await page.waitForTimeout(4000);

    // Assert that the spoken phrases are as expected
    const lastSpokenPhrase = await nvda.lastSpokenPhrase();
    expect(lastSpokenPhrase.startsWith("a")).toBe(true);
    expect(lastSpokenPhrase.includes("Suggestion: acceptable")).toBe(true);
    expect(
      lastSpokenPhrase.includes("Press right arrow to commit suggestion")
    ).toBe(true);
  });
} else {
  test("Skipping Windows tests", () => {});
}
