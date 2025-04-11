import { expect } from "@esm-bundle/chai";

export async function tests() {
  describe("ariaNotify polyfill", () => {
    it("<live-region> placement", () => {
      let count = 0;
      for (const container of document.querySelectorAll("[data-should-contain-live-region]")) {
        container.ariaNotify("Hello, world!");
        const liveRegion = Array.from(container.childNodes).find((node) => node.nodeType === Node.ELEMENT_NODE && node.tagName.match(/^live-region/i));
        expect(liveRegion).to.not.be.undefined;
        count++;
      }
      expect(count).to.be.above(0);
    });
  });
}