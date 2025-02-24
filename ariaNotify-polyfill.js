// @ts-check

if (!("ariaNotify" in Element.prototype)) {
  /** @type {string} */
  let uniqueId = `${Date.now()}`;
  try {
    uniqueId = crypto.randomUUID();
  } catch {}

  /**
   * A unique symbol to prevent unauthorized access to the 'live-region' element.
   *  @type {Symbol}
   */
  const passkey = Symbol();

  /** @type {string} */
  const liveRegionCustomElementName = `live-region-${uniqueId}`;

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
          .querySelector(":modal")
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
      let root = /** @type {Element} */ (
        this.element.closest("dialog") || this.element.getRootNode()
      );
      if (!root || root instanceof Document) root = document.body;

      // Get 'live-region', if it already exists
      /** @type {LiveRegionCustomElement | null} */
      let liveRegion = root.querySelector(liveRegionCustomElementName);

      // Create (or recreate) 'live-region', if it doesn’t exist
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
    #shadowRoot = this.attachShadow({ mode: "closed" });

    connectedCallback() {
      this.ariaLive = "polite";
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
      // This is a hack due to the way the aria live API works. A screen reader
      // will not read a live region again if the text is the same. Adding a
      // space character tells the browser that the live region has updated,
      // which will cause it to read again, but with no audible difference.
      if (this.#shadowRoot.textContent == message) message += "\u00A0";
      this.#shadowRoot.textContent = message;
    }
  }
  customElements.define(liveRegionCustomElementName, LiveRegionCustomElement);

  /**
   * @param {string} message
   * @param {object} options
   * @param {"high" | "normal"} [options.priority]
   */
  Element.prototype["ariaNotify"] = function (
    message,
    { priority = "normal" } = {}
  ) {
    queue.enqueue(new Message({ element: this, message, priority }));
  };
}
