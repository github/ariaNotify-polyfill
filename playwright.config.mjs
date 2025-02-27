import { screenReaderConfig } from "@guidepup/playwright";
import { devices } from "@playwright/test";
import * as url from "node:url";

const config = {
  ...screenReaderConfig,
  reportSlowTests: null,
  timeout: 3 * 60 * 1000,
  retries: 0,
  projects: [
    {
      name: "Microsoft Edge",
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
      },
    },
  ],
  quiet: false,
};

export default config;
