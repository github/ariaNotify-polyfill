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

    /** @type {"important" | "none"} */
    priority = "none";

    /** @type {"all" | "pending" | "none"} */
    interrupt = "none";

    /** @type {boolean} */
    get #shouldFlushOthers() {
      return this.interrupt === "all" || this.interrupt === "pending";
    }

    /**
     * @param {object} message
     * @param {Element} message.element
     * @param {string} message.message
     * @param {"important" | "none"} message.priority
     * @param {"all" | "pending" | "none"} message.interrupt
     */
    constructor({ element, message, priority = "none", interrupt = "none" }) {
      this.element = element;
      this.message = message;
      this.priority = priority;
      this.interrupt = interrupt;
    }

    /**
     * Whether this message and the given message are equivalent.
     * @param {Message} message
     * @returns {boolean}
     */
    matches(message) {
      return (
        this.element === message.element &&
        this.priority === message.priority &&
        this.interrupt === message.interrupt
      );
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

      // Destroy 'live-region', if it exists and should be flushed
      if (this.#shouldFlushOthers && liveRegion) {
        liveRegion.remove();
        liveRegion = null;
      }

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
      const { priority, interrupt } = message;

      if (interrupt === "all" || interrupt === "pending") {
        // Remove other messages with the same element, priority, and interrupt
        this.#queue = this.#queue.filter(
          (message) => !message.matches(message)
        );
      }

      if (priority === "important") {
        // Insert after the last important message, or at the beginning
        // @ts-ignore: ts(2550)
        const lastImportantMessage = this.#queue.findLastIndex(
          (message) => message.priority === "important"
        );
        this.#queue.splice(lastImportantMessage + 1, 0, message);
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
      this.style.position = "absolute";
      this.style.left = "-9999px";
    }

    /**
     * @param {Symbol | null} key
     * @param {string} message
     */
    handleMessage(key = null, message = "") {
      if (passkey !== key) return;
      this.#shadowRoot.textContent = message;
    }
  }
  customElements.define(liveRegionCustomElementName, LiveRegionCustomElement);

  /**
   * @param {string} message
   * @param {object} options
   * @param {"important" | "none"} [options.priority]
   * @param {"all" | "pending" | "none" } [options.interrupt]
   */
  Element.prototype["ariaNotify"] = function (
    message,
    { priority = "none", interrupt = "none" } = {}
  ) {
    queue.enqueue(new Message({ element: this, message, priority, interrupt }));
  };
}
