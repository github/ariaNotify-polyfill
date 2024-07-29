// @ts-check

if (!("ariaNotify" in Element.prototype)) {
  /** @type {string} */
  let uniqueId = `${Date.now()}`;
  try {
    uniqueId = crypto.randomUUID();
  } catch {}

  /** @type {string} */
  const liveRegionCustomElementName = `live-region-${uniqueId}`;

  class MessageEvent extends Event {
    /**
     * @param {string} type
     * @param {object} options
     * @param {string} options.message
     */
    constructor(type, { message, ...options }) {
      super(type, options);
      this.message = message;
    }
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

    /**
     * @param {object} message
     * @param {Element} message.element
     * @param {string} message.message
     * @param {"important" | "none"} message.priority
     * @param {"all" | "pending" | "none"} message.interrupt
     */
    constructor({ element, message, priority, interrupt }) {
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
     * Send a 'new-message…' event with this message’s message.
     * @returns {void}
     */
    announce() {
      this.element.dispatchEvent(
        new MessageEvent(`new-message-${uniqueId}`, {
          message: this.message ?? "",
        })
      );
    }

    /**
     * Send a 'new-message…' event with an empty message.
     * @returns {void}
     */
    destroy() {
      this.element.dispatchEvent(
        new MessageEvent(`new-message-${uniqueId}`, {
          message: "",
        })
      );
    }
  }

  class MessageQueue {
    /** @type {Message[]} */
    #queue = [];

    /** @type {Message | undefined | null} */
    #currentMessage;

    /** @type {number} */
    #interval = 500; // TODO: Vary based on message length.

    /** @type {number} */
    #intervalId = setInterval(() => this.#dequeue(), this.#interval);

    /**
     * Destroy the current message, then announce the next message.
     * @returns {void}
     */
    #dequeue() {
      this.#currentMessage?.destroy();
      this.#currentMessage = this.#queue.shift();
      this.#currentMessage?.announce();
    }

    /**
     * Add the given message to the queue.
     * @param {Message} message
     * @returns {void}
     */
    enqueue(message) {
      const { priority, interrupt } = message;

      if (interrupt === "all" && this.#currentMessage?.matches(message)) {
        // Immediately flush the current message
        this.#currentMessage?.destroy();
        this.#currentMessage = null;
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
    }

    /**
     * Remove messages associated with the given element from the queue.
     * @param {Node} element
     */
    flushElement(element) {
      this.#queue = this.#queue.filter(
        (message) => message.element !== element
      );
    }
  }

  customElements.define(
    liveRegionCustomElementName,
    class LiveRegionCustomElement extends HTMLElement {
      /** @type {MessageQueue} */
      #queue = new MessageQueue();

      /** @type {MutationObserver} */
      #removedElementObserver = new MutationObserver((mutationList) => {
        for (const mutation of mutationList) {
          if (mutation.type === "childList") {
            for (const removedNode of mutation.removedNodes) {
              // Remove messages associated with the removed element from the queue.
              this.#queue.flushElement(removedNode);
            }
          }
        }
      });

      connectedCallback() {
        this.role = "status";
        this.ariaLive = "polite";
        this.style.position = "absolute";
        this.style.left = "-9999px";
        this.addEventListener(`new-message-${uniqueId}`, this);
        this.#removedElementObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }

      handleEvent(event) {
        if (event.type === `new-message-${uniqueId}`) {
          this.textContent = event.message;
        }
      }

      /**
       * @param {Element} element
       * @param {string} message
       * @param {object} options
       * @param {"important" | "none"} options.priority
       * @param {"all" | "pending" | "none"} options.interrupt
       */
      notifyFromElement(element, message, { priority, interrupt }) {
        this.#queue.enqueue(
          new Message({
            element,
            message,
            // Ensure values are valid
            priority: priority === "important" ? "important" : "none",
            interrupt:
              interrupt === "all" || interrupt === "pending"
                ? interrupt
                : "none",
          })
        );
      }
    }
  );

  // @ts-ignore: ts(2339)
  Element.prototype.ariaNotify = function (
    message,
    { priority = "none", interrupt = "none" } = {}
  ) {
    // Re-use 'live-region', if it already exists
    let liveRegion = document.querySelector(liveRegionCustomElementName);

    // Create 'live-region', if it doesn’t exist
    if (!liveRegion) {
      liveRegion = document.createElement(liveRegionCustomElementName);
      document.body.appendChild(liveRegion);
    }

    // Add message to 'live-region'’s queue
    // @ts-ignore: ts(2339)
    liveRegion.notifyFromElement(this, message, { priority, interrupt });
  };
}
