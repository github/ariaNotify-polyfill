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

  class Message {
    /** @type {Element} */
    element;

    /** @type {string} */
    message;

    /** @type {"important" | "none"} */
    priority = "none";

    /** @type {"all" | "pending" | "none"} */
    interrupt = "none";

    /**
     * Translation from ARIA Notify’s `interrupt` to `aria-live` values
     * @type {"assertive" | "polite" }
     */
    get #destination() {
      return this.interrupt === "all" || this.interrupt === "pending"
        ? "assertive"
        : "polite";
    }

    /** @type {() => void} */
    #cancel = () => {};

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

    /**
     * A promise that resolves after an estimated time for the message to be read.
     * @returns {Promise<void>}
     */
    #estimatedTimer() {
      // Assumptions:
      // - Average speech rate is around 4 words per second.
      // - Average braille reading speed is around 2 words per second.
      // Therefore we estimate a time of 500ms per word.
      const ms = (this.message.split(/\s/g).length || 1) * 500;
      return /** @type {Promise<void>} */ (
        new Promise((resolve) => {
          let timer = setTimeout(resolve, ms);
          this.#cancel = () => {
            resolve();
            clearTimeout(timer);
          };
        })
      );
    }

    /** @returns {void} */
    cancel() {
      this.#cancel();
    }

    /**
     * Send a 'new-message…' event with this message’s message.
     * @returns {Promise<void>}
     */
    async announce() {
      // Skip an unannounceable message.
      if (!this.#canAnnounce()) {
        return;
      }
      const { element, message } = this;
      let root = /** @type {Element} */ (
        element.closest("dialog") || element.getRootNode()
      );
      if (!root || root instanceof Document) root = document.body;

      // Re-use 'live-region', if it already exists
      /** @type {LiveRegionCustomElement | null} */
      let liveRegion = root.querySelector(liveRegionCustomElementName);

      // Create 'live-region', if it doesn’t exist
      if (!liveRegion) {
        liveRegion = /** @type {LiveRegionCustomElement} */ (
          document.createElement(liveRegionCustomElementName)
        );
        root.append(liveRegion);
      }

      liveRegion.handleMessage(passkey, message, this.#destination);
      await this.#estimatedTimer();
      liveRegion.handleMessage(passkey, "", this.#destination);
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

      if (interrupt === "all" && this.#currentMessage?.matches(message)) {
        // Immediately flush the current message
        this.#currentMessage.cancel();
      }

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

    /** @type {HTMLDivElement | null} */
    get #polite() {
      return this.#shadowRoot.querySelector("[aria-live='polite']");
    }

    /** @type {HTMLDivElement | null} */
    get #assertive() {
      return this.#shadowRoot.querySelector("[aria-live='assertive']");
    }

    connectedCallback() {
      const polite = document.createElement("div");
      polite.ariaLive = "polite";
      polite.ariaAtomic = "true";
      polite.style.position = "absolute";
      polite.style.left = "-9999px";
      const assertive = document.createElement("div");
      assertive.ariaLive = "assertive";
      assertive.ariaAtomic = "true";
      assertive.style.position = "absolute";
      assertive.style.left = "-9999px";
      this.#shadowRoot.append(polite, assertive);
    }

    /**
     * @param {Symbol | null} key
     * @param {string} message
     * @param {"polite" | "assertive"} destination
     * @returns
     */
    handleMessage(key = null, message = "", destination) {
      if (passkey !== key) return;
      if (destination === "assertive" && this.#assertive) {
        this.#assertive.textContent = message;
      } else if (destination === "polite" && this.#polite) {
        this.#polite.textContent = message;
      }
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
