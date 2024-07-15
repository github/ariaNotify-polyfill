// @ts-check

let intervalId;

const items = Array.from(document.querySelectorAll(".item"));
items.forEach((item, index) => {
  item.classList.add(`item-${index + 1}`);
  item.style.viewTransitionName = `item-${index + 1}`;
});

const columns = Array.from(document.querySelectorAll(".column"));

async function moveItem() {
  const item = items[Math.floor(Math.random() * items.length)];
  item.style.viewTransitionName = "item-active";

  const destinationColumn = columns[Math.floor(Math.random() * columns.length)];

  if (!document.startViewTransition) {
    destinationColumn.querySelector(".items")?.appendChild(item);
    return;
  }
  const transition = document.startViewTransition(() =>
    destinationColumn.querySelector(".items")?.appendChild(item)
  );

  await transition.finished;
  item.style.viewTransitionName = "none";
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
