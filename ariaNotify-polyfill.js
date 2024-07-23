if (!("ariaNotify" in Element.prototype)) {
  class MessageEvent extends Event {
    constructor(type, { message, ...options }) {
      super(type, options);
      this.message = message;
    }
  }

  class MessageQueue {
    #element;
    #queue = [];
    #interval = 500;
    #intervalId = setInterval(() => this.#dequeue(), this.#interval);

    constructor(element) {
      this.#element = element;
    }

    #dequeue() {
      const { message } = this.#queue.shift() ?? {};
      if (message) {
        this.#element.dispatchEvent(
          new MessageEvent("new-message", { message })
        );
      }
    }

    enqueue({ element, message, priority, interrupt }) {
      if (interrupt === "all" || interrupt === "pending") {
        // Remove other messages with the same element, priority, and interrupt
        this.#queue = this.#queue.filter(
          (message) =>
            message.element !== element ||
            message.priority !== priority ||
            message.interrupt !== interrupt
        );
      }

      if (priority === "important") {
        // Insert after the last important message, or at the beginning
        const lastImportantMessage = this.#queue.findLastIndex(
          (message) => message.priority === "important"
        );
        this.#queue.splice(lastImportantMessage + 1, 0, {
          element,
          message,
          priority,
        });
      } else {
        // Insert at the end
        this.#queue.push({ element, message, priority });
      }
    }

    flushElement(element) {
      this.#queue = this.#queue.filter(
        (message) => message.element !== element
      );
    }
  }

  customElements.define(
    "live-region",
    class extends HTMLElement {
      #queue = new MessageQueue(this);

      #removedElementObserver = new MutationObserver((mutationList) => {
        for (const mutation of mutationList) {
          if (mutation.type === "childList") {
            for (const removedNode of mutation.removedNodes) {
              this.#queue.flushElement(removedNode);
            }
          }
        }
      });

      connectedCallback() {
        this.role = "status";
        this.ariaLive = "polite";
        this.style = "position: absolute; left: -9999px;";
        this.addEventListener("new-message", this);
        this.#removedElementObserver.observe(document.body, {
          childList: true,
          subtree: true,
          removedNodes: true,
        });
      }

      handleEvent(event) {
        if (event.type === "new-message") {
          this.textContent = event.message;
        }
      }

      notifyFromElement(element, message, { priority, interrupt } = {}) {
        this.#queue.enqueue({ element, message, priority, interrupt });
      }
    }
  );

  Element.prototype.ariaNotify = function (
    message,
    { priority = "none", interrupt = "none" } = {}
  ) {
    // Re-use 'live-region', if it already exists
    let liveRegion = document.querySelector("live-region");

    // Create 'live-region', if it doesn’t exist
    if (!liveRegion) {
      liveRegion = document.createElement("live-region");
      document.body.appendChild(liveRegion);
    }

    // Add message to 'live-region'’s queue
    liveRegion.notifyFromElement(this, message, { priority, interrupt });
  };
}
