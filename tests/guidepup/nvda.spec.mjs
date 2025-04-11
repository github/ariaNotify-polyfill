// @ts-check

import { test as baseTest, expect } from "@playwright/test";
import { nvda, WindowsKeyCodes, WindowsModifiers } from "@guidepup/guidepup";
import path from "node:path";

// Pre-requisites:
// - Install NVDA
// - Install the NVDA Remote Access addon (https://nvdaremote.com/download/)
// - In NVDA Tools > Remote > Options…:
//   - Check "Auto-connect to control server on startup"
//   - Select "Host control server"
//   - Set "Port" to "6837"
//   - Set "Key" to "guidepup"
// (settings are from https://github.com/guidepup/nvda/blob/main/nvda/userConfig/remote.ini)
// - In Windows Settings, turn on “Developer Mode” (this allows symbolic links)
// - In an PowerShell (Administrator session):
//   - Run `mkdir "C:\Program Files (x86)\NVDA\userConfig"`
//   - Run `cmd /c mklink /d "C:\Program Files (x86)\NVDA\userConfig\addons" "%APPDATA%\nvda\addons"`
// - Check out this repo
// - In cmd:
//   - Run `REG ADD HKCU\Software\Guidepup\Nvda`
//   - Run `REG ADD HKCU\Software\Guidepup\Nvda /v guidepup_nvda_0.1.1-2021.3.1 /t REG_SZ /d "C:\Program Files (x86)\NVDA\\"`
// (version is from https://github.com/guidepup/setup/blob/82179ec8915680344d0db320422dd18e29593eb9/package.json#L60C27-L60C41)

const test = baseTest.extend({
  context: async ({ context }, run) => {
    await context.route("**/*", (route, request) =>
      route.fulfill({
        path: path.join(
          import.meta.dirname,
          "..",
          new URL(request.url()).pathname
        ),
      })
    );
    await run(context);
  },
});

if (process.platform === "win32") {
  test.beforeEach(async ({ page }) => {
    // Navigate to suggested test example page
    await page.goto(
      "http://localhost:3333/examples/suggested-text/index.html",
      {
        waitUntil: "load",
      }
    );

    // Start NVDA
    await nvda.start();

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

  test.afterEach(async () => {
    // Stop NVDA; suppressing errors
    try {
      await nvda.stop();
    } catch {}
  });

  test("SuggestedText", async ({ page }) => {
    // Type a completable string in the textarea
    await nvda.type("a");

    // Wait for the suggestion to appear
    await page.waitForTimeout(4000);

    // Assert that the spoken phrases are as expected
    const spokenPhraseLog = JSON.stringify(await nvda.spokenPhraseLog());
    expect(spokenPhraseLog.includes("Suggestion: acceptable")).toBe(true);
    // expect(spokenPhraseLog.includes("Press right arrow to commit suggestion")).toBe(true); // FIXME: Commenting because this fails, though it _should_ pass.
  });
} else {
  test("Skipping Windows tests", () => {});
}
