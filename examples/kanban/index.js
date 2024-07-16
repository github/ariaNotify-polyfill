let intervalId;

const users = ["John", "Jane", "Alice", "Bob", "Charlie", "David", "Eve"];

class MoveEvent extends Event {
  constructor(type, { user }) {
    super(type, { bubbles: true });
    this.user = user;
  }
}

const items = Array.from(document.querySelectorAll(".item"));
items.forEach((item, index) => {
  item.classList.add(`item-${index + 1}`);
  item.style.viewTransitionName = `item-${index + 1}`;
});

const columns = Array.from(document.querySelectorAll(".column"));

async function moveItem() {
  const user = users[Math.floor(Math.random() * users.length)];
  const item = items[Math.floor(Math.random() * items.length)];
  const destinationColumn = columns[Math.floor(Math.random() * columns.length)];

  if (item.closest(".column") === destinationColumn) {
    moveItem();
    return;
  }

  if (document.startViewTransition) {
    item.style.viewTransitionName = "item-active";
    const transition = document.startViewTransition(() =>
      destinationColumn.querySelector(".items")?.appendChild(item)
    );
    await transition.finished;
    item.style.viewTransitionName = "none";
  } else {
    destinationColumn.querySelector(".items")?.appendChild(item);
  }

  item.dispatchEvent(new MoveEvent("MoveCard", { user }));
}

document.querySelector(".move-items")?.addEventListener("click", (event) => {
  if (event.target?.getAttribute("aria-pressed") === "true") {
    clearInterval(intervalId);
    event.target?.setAttribute("aria-pressed", "false");
  } else {
    intervalId = setInterval(moveItem, 2000);
    event.target?.setAttribute("aria-pressed", "true");
  }
});
