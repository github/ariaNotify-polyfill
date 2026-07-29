// @ts-check

const domAPIsAreAvailable =
  typeof globalThis.Element !== "undefined" &&
  typeof globalThis.Document !== "undefined";
const shouldBypassNativeAriaNotify =
  /** @type {typeof globalThis & {__bypassNativeAriaNotify?: boolean}} */ (
    globalThis
  ).__bypassNativeAriaNotify === true;

if (
  domAPIsAreAvailable &&
  (shouldBypassNativeAriaNotify ||
    !("ariaNotify" in Element.prototype) ||
    !("ariaNotify" in Document.prototype))
) {
  /** @type {string} */
  let uniqueId = `${Date.now()}`;
  try {
    uniqueId = crypto.randomUUID();
  } catch { }

  /**
   * A unique symbol to prevent unauthorized access to the 'live-region' element.
   *  @type {Symbol}
   */
  const passkey = Symbol();

  /** @type {string} */
  const politeLiveRegionCustomElementName = `polite-live-region-${uniqueId}`;

  /** @type {string} */
  const assertiveLiveRegionCustomElementName = `assertive-live-region-${uniqueId}`;

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  class Message {
    /** @type {Element} */
    element;

    /** @type {string} */
    message;

    /** @type {"high" | "normal"} */
    priority = "normal";

    /**
     * @param {object} message
     * @param {Element} message.element
     * @param {string} message.message
     * @param {"high" | "normal"} message.priority
     */
    constructor({ element, message, priority = "normal" }) {
      this.element = element;
      this.message = message;
      this.priority = priority;
    }

    /**
     * Whether this message can be announced.
     * @returns {boolean}
     */
    #canAnnounce() {
      return (
        this.element.isConnected &&
        // Elements within inert containers should not be announced.
        !this.element.closest("[inert]") &&
        // If there is a modal element on the page, everything outside of it is implicitly inert.
        // This can be checked by seeing if the element is within the modal, if the modal is present.
        (this.element.ownerDocument
          .querySelector(CSS.supports("selector(:modal)") ? ":modal" : "dialog[open]")
          ?.contains(this.element) ??
          true)
      );
    }

    /** @returns {Promise<void>} */
    async announce() {
      // Skip an unannounceable message.
      if (!this.#canAnnounce()) {
        return;
      }

      // Get root element
      let root = /** @type {Element | ShadowRoot | Document} */ (
        this.element.closest("dialog") || this.element.closest("[role='dialog']") || this.element.getRootNode()
      );
      if (!root || root instanceof Document) root = document.body;

      const liveRegionCustomElementName =
        this.priority === "high"
          ? assertiveLiveRegionCustomElementName
          : politeLiveRegionCustomElementName;
      let liveRegion = /** @type {LiveRegionCustomElement | null} */ (
        root.querySelector(liveRegionCustomElementName)
      );

      if (!liveRegion) {
        liveRegion = /** @type {LiveRegionCustomElement} */ (
          document.createElement(liveRegionCustomElementName)
        );
        root.append(liveRegion);
      }

      await sleep(250);
      liveRegion.handleMessage(passkey, this.message);
    }
  }

  const queue = new (class MessageQueue {
    /** @type {Message[]} */
    #queue = [];

    /** @type {Message | undefined | null} */
    #currentMessage;

    /**
     * Add the given message to the queue.
     * @param {Message} message
     * @returns {void}
     */
    enqueue(message) {
      const { priority } = message;

      if (priority === "high") {
        // Insert after the last high-priority message, or at the beginning
        // @ts-ignore: ts(2550)
        const lastHighPriorityMessage = this.#queue.findLastIndex(
          (message) => message.priority === "high"
        );
        this.#queue.splice(lastHighPriorityMessage + 1, 0, message);
      } else {
        // Insert at the end
        this.#queue.push(message);
      }

      if (!this.#currentMessage) {
        this.#processNext();
      }
    }

    async #processNext() {
      this.#currentMessage = this.#queue.shift();
      if (!this.#currentMessage) return;
      await this.#currentMessage.announce();
      this.#processNext();
    }
  })();

  class LiveRegionCustomElement extends HTMLElement {
    connectedCallback() {
      this.ariaAtomic = "true";
      this.style.marginLeft = "-1px";
      this.style.marginTop = "-1px";
      this.style.position = "absolute";
      this.style.width = "1px";
      this.style.height = "1px";
      this.style.overflow = "hidden";
      this.style.clipPath = "rect(0 0 0 0)";
      this.style.overflowWrap = "normal";
    }

    /**
     * @param {Symbol | null} key
     * @param {string} message
     */
    handleMessage(key = null, message = "") {
      if (passkey !== key) return;
      // The message is written to the element's light DOM (rather than a shadow
      // root) because screen readers such as NVDA and VoiceOver do not reliably
      // announce aria-live updates that occur inside shadow DOM.
      //
      // This is a hack due to the way the aria live API works. A screen reader
      // will not read a live region again if the text is the same. Adding a
      // space character tells the browser that the live region has updated,
      // which will cause it to read again, but with no audible difference.
      if (this.textContent == message) message += "\u00A0";
      this.textContent = message;
    }
  }

  class PoliteLiveRegionCustomElement extends LiveRegionCustomElement {
    connectedCallback() {
      this.ariaLive = "polite";
      super.connectedCallback();
    }
  }

  class AssertiveLiveRegionCustomElement extends LiveRegionCustomElement {
    connectedCallback() {
      this.ariaLive = "assertive";
      super.connectedCallback();
    }
  }

  customElements.define(
    politeLiveRegionCustomElementName,
    PoliteLiveRegionCustomElement
  );
  customElements.define(
    assertiveLiveRegionCustomElementName,
    AssertiveLiveRegionCustomElement
  );

  /**
   * Eagerly inserts the polite and assertive live regions into the document body
   * so that assistive technologies (e.g. VoiceOver, NVDA) register them in the
   * accessibility tree before any message is announced. Screen readers routinely
   * fail to announce updates to a live region that is created and populated at
   * nearly the same time, so the regions must already exist when their text
   * content changes. `announce()` reuses these pre-created regions when the
   * message targets the document body.
   * @returns {void}
   */
  function ensureBodyLiveRegions() {
    if (!document.body) return;
    for (const name of [
      politeLiveRegionCustomElementName,
      assertiveLiveRegionCustomElementName,
    ]) {
      if (!document.body.querySelector(name)) {
        document.body.append(document.createElement(name));
      }
    }
  }

  if (document.body) {
    ensureBodyLiveRegions();
  } else {
    document.addEventListener("DOMContentLoaded", ensureBodyLiveRegions, {
      once: true,
    });
  }

  /**
   * Installs an `ariaNotify` implementation, taking precedence over a native
   * implementation when present. Falls back to assignment if
   * `Object.defineProperty` throws (e.g. when a native `ariaNotify` property is
   * not configurable), ensuring the polyfill is used instead of the browser's
   * native `ariaNotify`.
   * @param {typeof Element.prototype | typeof Document.prototype} prototype
   * @param {(message: string, options?: { priority?: "high" | "normal" }) => void} value
   */
  const installAriaNotify = (prototype, value) => {
    try {
      Object.defineProperty(prototype, "ariaNotify", {
        configurable: true,
        writable: true,
        value,
      });
    } catch {
      // @ts-ignore - assignment is a fallback when the property cannot be redefined.
      prototype.ariaNotify = value;
    }
  };

  /**
   * @param {string} message
   * @param {object} options
   * @param {"high" | "normal"} [options.priority]
   */
  const elementAriaNotify = function (
    message,
    { priority = "normal" } = {}
  ) {
    queue.enqueue(new Message({ element: this, message, priority }));
  };

  if (shouldBypassNativeAriaNotify || !("ariaNotify" in Element.prototype)) {
    installAriaNotify(Element.prototype, elementAriaNotify);
  }

  /**
   * @param {string} message
   * @param {object} options
   * @param {"high" | "normal"} [options.priority]
   */
  const documentAriaNotify = function (
    message,
    { priority = "normal" } = {}
  ) {
    queue.enqueue(new Message({ element: this.documentElement, message, priority }));
  };

  if (shouldBypassNativeAriaNotify || !("ariaNotify" in Document.prototype)) {
    installAriaNotify(Document.prototype, documentAriaNotify);
  }
}
