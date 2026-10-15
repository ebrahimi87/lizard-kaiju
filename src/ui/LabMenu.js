// The Lizard Lab shop grid (DOM). Four picture tabs: hats, skins, upgrades, buddies.
// Every card is a picture plus a gem price, a check (owned), or a lock. The game owns
// the rules; this file only draws cards and reports taps.
//
//   menu.open(tab, model)  model = { gems, items: [{ id, image | icon, cost, owned,
//                                     equipped, locked, level, maxLevel }] }
//   handlers: onTab(tab), onPick(tab, item), onForm(step), onBack()

function byId(id) {
  return document.getElementById(id);
}

export class LabMenu {
  constructor(handlers) {
    this.handlers = handlers;
    this.el = {
      root: byId("lab"),
      tabs: byId("lab-tabs"),
      grid: byId("lab-grid"),
      gems: byId("lab-gem-count"),
    };
    this.tab = "hats";
    for (const button of this.el.tabs.querySelectorAll("button")) {
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        handlers.onTab(button.dataset.tab);
      });
    }
    byId("lab-prev").addEventListener("pointerdown", () => handlers.onForm(-1));
    byId("lab-next").addEventListener("pointerdown", () => handlers.onForm(1));
    byId("lab-back").addEventListener("click", () => handlers.onBack());
  }

  open(tab, model) {
    this.tab = tab;
    for (const button of this.el.tabs.querySelectorAll("button")) button.classList.toggle("is-current", button.dataset.tab === tab);
    this.el.gems.textContent = String(model.gems);
    this.el.grid.innerHTML = "";
    for (const item of model.items) this.el.grid.append(this.card(item));
  }

  card(item) {
    const card = document.createElement("button");
    card.className = "shop-card";
    card.classList.toggle("is-equipped", Boolean(item.equipped));
    card.classList.toggle("is-locked", Boolean(item.locked));
    card.classList.toggle("is-owned", Boolean(item.owned));
    const picture = item.image
      ? `<img class="shop-picture" alt="" src="${item.image}">`
      : `<svg class="shop-picture shop-picture--icon" viewBox="0 0 80 80"><use href="#${item.icon}" ${item.icon === "i-heart" ? 'fill="#ff4f6d" stroke="#fff" stroke-width="5" x="8" y="10" width="64" height="58"' : ""} /></svg>`;
    let tag = "";
    if (item.locked) tag = '<svg class="shop-lock" viewBox="0 0 64 64"><use href="#i-lock" /></svg>';
    else if (item.maxLevel) {
      const dots = Array.from({ length: item.maxLevel }, (_, index) => `<i class="${index < item.level ? "is-on" : ""}"></i>`).join("");
      tag = `<div class="shop-dots">${dots}</div>`;
      if (item.level < item.maxLevel) tag += `<div class="shop-price"><svg viewBox="0 0 64 56"><use href="#i-gem" /></svg>${item.cost}</div>`;
    } else if (!item.owned) tag = `<div class="shop-price"><svg viewBox="0 0 64 56"><use href="#i-gem" /></svg>${item.cost}</div>`;
    else tag = '<svg class="shop-check" viewBox="0 0 64 64"><use href="#i-check" /></svg>';
    card.innerHTML = picture + tag;
    // "click" fires only for a real tap, not when the finger scrolls the grid.
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      this.handlers.onPick(this.tab, item, card);
    });
    return card;
  }

  // Feedback on a card: "bought" (sparkle pop) or "poor" (shake, price flashes).
  feedback(card, kind) {
    card.classList.remove("is-bought", "is-poor");
    void card.offsetWidth;
    card.classList.add(kind === "bought" ? "is-bought" : "is-poor");
  }
}
