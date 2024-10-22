// @ts-check

import { test, expect } from "@playwright/test";
import { voiceOver } from "@guidepup/guidepup";

// Pre-requisites:
// - Run `defaults write com.apple.VoiceOver4/default SCREnableAppleScript 1`

if (process.platform === "darwin") {
  test.beforeAll(async () => {
    // Start VoiceOver
    await voiceOver.start();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to suggested text example page
    await page.goto("suggested-text/index.html", {
      waitUntil: "load",
    });

    // From https://github.com/guidepup/guidepup-playwright/blob/34c3973dd98e19c81f468352e13bac5b8434b28f/src/voiceOverTest.ts#L97-L110:

    // Ensure the document is ready and focused.
    await page.bringToFront();
    await page.locator("body").waitFor();
    await page.locator("body").focus();

    // Navigate to the beginning of the web content.
    await voiceOver.interact();
    await voiceOver.perform(voiceOver.keyboardCommands.jumpToLeftEdge);

    // Clear out logs.
    await voiceOver.clearItemTextLog();
    await voiceOver.clearSpokenPhraseLog();
  });

  test.afterAll(async () => {
    // Stop VoiceOver
    await voiceOver.stop();
  });

  test("SuggestedText", async ({ page }) => {
    // Type a completable string in the textarea
    await voiceOver.type("a");

    // Wait for the suggestion to appear
    await page.waitForTimeout(4000);

    // Assert that the spoken phrases are as expected
    const lastSpokenPhrase = await voiceOver.lastSpokenPhrase();
    expect(lastSpokenPhrase.startsWith("a")).toBe(true);
    expect(lastSpokenPhrase.includes("Suggestion: acceptable")).toBe(true);
    expect(
      lastSpokenPhrase.includes("Press right arrow to commit suggestion")
    ).toBe(true);
  });
} else {
  test("Skipping macOS tests", () => {});
}
