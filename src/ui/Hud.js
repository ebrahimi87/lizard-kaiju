// All DOM work lives here. The game passes plain values in; buttons call the handlers
// given to setHandlers. Nothing here changes game state directly.

const RING_LENGTH = 289; // circumference of the energy ring circles (r = 46)
const ESCAPE_RING_LENGTH = 276;

function byId(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor() {
    this.el = {
      loading: byId("loading"),
      loadingFill: byId("loading-fill"),
      title: byId("title"),
      hud: byId("hud"),
      pause: byId("pause"),
      captured: byId("captured"),
      hearts: byId("hearts"),
      growthFill: byId("growth-fill"),
      growthNext: byId("growth-next"),
      growthCurrent: byId("growth-current"),
      gems: byId("gems"),
      gemCount: byId("gem-count"),
      fire: byId("fire-button"),
      water: byId("water-button"),
      mega: byId("mega-button"),
      catcherArrow: byId("catcher-arrow"),
      arrowTip: document.querySelector("#catcher-arrow .edge-arrow-tip"),
      finger: byId("tutorial-finger"),
      target: byId("tutorial-target"),
      escape: byId("escape"),
      escapeRing: document.querySelector("#escape .escape-ring circle"),
      flash: byId("hit-flash"),
      lab: byId("lab"),
      book: byId("book"),
      titleGems: byId("title-gem-count"),
      endless: byId("endless-button"),
      victoryStars: byId("victory-stars"),
      cards: byId("cards"),
      cardRow: byId("card-row"),
      victory: byId("victory"),
      victoryGems: byId("victory-gems"),
      growth: document.querySelector(".growth"),
      growthTrack: document.querySelector(".growth-track"),
      flyers: byId("flyers"),
      soundIcon: document.querySelector("#sound-button use"),
    };
    this.controls = {
      joystickZone: byId("joystick-zone"),
      joystickBase: byId("joystick-base"),
      joystickKnob: byId("joystick-knob"),
      fire: this.el.fire,
      water: this.el.water,
      mega: this.el.mega,
    };
    this.fireRing = this.el.fire.querySelector(".energy-ring circle");
    this.waterRing = this.el.water.querySelector(".energy-ring circle");
    this.heartCount = -1;
    this.gemValue = -1;
  }

  setHandlers(handlers) {
    const bind = (id, handler) => byId(id).addEventListener("click", (event) => {
      event.stopPropagation();
      handler();
    });
    bind("play-button", handlers.play);
    bind("pause-button", handlers.pause);
    bind("resume-button", handlers.resume);
    bind("home-button", handlers.home);
    bind("retry-button", handlers.retry);
    bind("sound-button", handlers.sound);
    bind("again-button", handlers.again);
    bind("victory-home-button", handlers.home);
    bind("lab-button", handlers.lab);
    bind("book-button", handlers.book);
    bind("endless-button", handlers.endless);
  }

  setTitleInfo(gems, endlessUnlocked) {
    this.el.titleGems.textContent = String(gems);
    this.el.endless.hidden = !endlessUnlocked;
  }

  setLoading(fraction) {
    this.el.loadingFill.style.width = `${Math.round(fraction * 100)}%`;
  }

  // screen: "loading" | "title" | "playing" | "paused" | "captured" | "cards" | "victory" | "cinematic"
  showScreen(screen) {
    this.el.loading.hidden = screen !== "loading";
    this.el.title.hidden = screen !== "title";
    this.el.hud.hidden = !(screen === "playing" || screen === "paused" || screen === "captured");
    this.el.pause.hidden = screen !== "paused";
    this.el.captured.hidden = screen !== "captured";
    this.el.cards.hidden = screen !== "cards";
    this.el.victory.hidden = screen !== "victory";
    this.el.lab.hidden = screen !== "lab";
    this.el.book.hidden = screen !== "book";
  }

  // Three big picture cards; the first tap picks one. onPick(card) runs after the
  // chosen card's little celebration.
  showCards(cards, onPick) {
    this.el.cardRow.innerHTML = "";
    let picked = false;
    cards.forEach((card) => {
      const button = document.createElement("button");
      button.className = `power-card power-card--${card.color}`;
      button.setAttribute("aria-label", card.id);
      button.innerHTML = `<svg viewBox="0 0 80 80"><use href="#${card.icon}" ${card.icon === "i-heart" ? 'fill="#ff4f6d" stroke="#fff" stroke-width="5" x="8" y="10" width="64" height="58"' : ""} /></svg>`;
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        if (picked) return;
        picked = true;
        for (const other of this.el.cardRow.children) other.classList.add(other === button ? "is-picked" : "is-dropped");
        window.setTimeout(() => onPick(card), 750);
      });
      this.el.cardRow.append(button);
    });
    this.showScreen("cards");
  }

  setBoss(on) {
    this.el.growth.classList.toggle("is-boss", on);
    for (const divider of this.el.growthTrack.querySelectorAll(".boss-divider")) divider.remove();
    if (on) {
      for (const at of [33.33, 66.66]) {
        this.el.growthTrack.insertAdjacentHTML("beforeend", `<div class="boss-divider" style="left:${at}%"></div>`);
      }
      this.el.growthCurrent.innerHTML = '<svg class="is-color" viewBox="0 0 64 64"><use href="#i-robot" /></svg>';
      this.el.growthNext.innerHTML = '<svg class="is-color" viewBox="0 0 80 80"><use href="#i-trophy" /></svg>';
    }
  }

  // Trophy screen; the gem number counts up from the run start. stars: endless-mode
  // waves beaten (null in the story campaign).
  showVictory(fromGems, toGems, stars = null) {
    this.showScreen("victory");
    this.el.victoryStars.hidden = stars === null;
    if (stars !== null) {
      const shown = Math.min(stars, 10);
      this.el.victoryStars.innerHTML = Array.from({ length: shown }, () => '<svg viewBox="0 0 64 64"><use href="#i-star" /></svg>').join("") + (stars > 10 ? `<span>${stars}</span>` : "");
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1600);
      this.el.victoryGems.textContent = String(Math.round(fromGems + (toGems - fromGems) * t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  setHearts(count, max) {
    if (this.el.hearts.children.length !== max) {
      this.el.hearts.innerHTML = "";
      for (let i = 0; i < max; i += 1) {
        this.el.hearts.insertAdjacentHTML("beforeend", '<svg class="heart" viewBox="0 0 64 58"><use href="#i-heart" /></svg>');
      }
    }
    [...this.el.hearts.children].forEach((heart, index) => {
      const empty = index >= count;
      if (empty && !heart.classList.contains("is-empty") && this.heartCount > count) {
        heart.classList.remove("is-lost");
        void heart.getBoundingClientRect();
        heart.classList.add("is-lost");
      }
      heart.classList.toggle("is-empty", empty);
    });
    this.heartCount = count;
  }

  setGrowth(fraction) {
    this.el.growthFill.style.width = `${Math.min(100, Math.max(0, fraction * 100)).toFixed(1)}%`;
    this.el.growthNext.classList.toggle("is-ready", fraction >= 1);
  }

  // Form portraits are image URLs rendered from the 3D models at boot.
  setFormIcons(currentUrl, nextUrl) {
    const paint = (element, url) => {
      element.innerHTML = url ? `<img alt="" src="${url}">` : '<svg><use href="#i-lizard" /></svg>';
    };
    paint(this.el.growthCurrent, currentUrl);
    paint(this.el.growthNext, nextUrl);
  }

  setGems(count) {
    if (count === this.gemValue) return;
    this.el.gemCount.textContent = String(count);
    if (this.gemValue >= 0 && count > this.gemValue) {
      this.el.gems.classList.remove("is-bump");
      void this.el.gems.offsetWidth;
      this.el.gems.classList.add("is-bump");
    }
    this.gemValue = count;
  }

  // fire and water are 0..1 energy; ready = enough energy to start breathing.
  setEnergy(fire, water, fireReady, waterReady) {
    this.fireRing.style.strokeDashoffset = String(RING_LENGTH * (1 - fire));
    this.waterRing.style.strokeDashoffset = String(RING_LENGTH * (1 - water));
    this.el.fire.classList.toggle("is-disabled", !fireReady);
    this.el.water.classList.toggle("is-disabled", !waterReady);
  }

  setPowers({ water, mega }) {
    this.el.water.hidden = !water;
    this.el.mega.hidden = !mega;
  }

  hintButton(name, on) {
    this.el[name].classList.toggle("is-hint", on);
  }

  // Point the edge arrow at an off-screen catcher. x/y in CSS pixels, angle in radians.
  setCatcherArrow(visible, x, y, angle) {
    this.el.catcherArrow.hidden = !visible;
    if (!visible) return;
    this.el.catcherArrow.style.left = `${x}px`;
    this.el.catcherArrow.style.top = `${y}px`;
    this.el.arrowTip.style.transform = `translate(-50%, 0) rotate(${angle - Math.PI}rad) translateY(calc(var(--unit) * 6.6))`;
  }

  // mode: null | "drag" | "tap" (tap at x/y)
  setFinger(mode, x = 0, y = 0) {
    this.el.finger.hidden = !mode;
    if (!mode) return;
    this.el.finger.classList.toggle("is-tap", mode === "tap");
    if (mode === "tap") {
      this.el.finger.style.left = `${x}px`;
      this.el.finger.style.top = `${y}px`;
      this.el.finger.style.bottom = "auto";
    } else {
      this.el.finger.style.left = "";
      this.el.finger.style.top = "";
      this.el.finger.style.bottom = "";
    }
  }

  setTarget(visible, x = 0, y = 0) {
    this.el.target.hidden = !visible;
    if (!visible) return;
    this.el.target.style.left = `${x}px`;
    this.el.target.style.top = `${y}px`;
  }

  setEscape(visible, progress = 0) {
    this.el.escape.hidden = !visible;
    this.el.escapeRing.style.strokeDashoffset = String(ESCAPE_RING_LENGTH * (1 - progress));
  }

  flash() {
    this.el.flash.classList.remove("is-on");
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add("is-on");
  }

  setSound(on) {
    this.el.soundIcon.setAttribute("href", on ? "#i-sound" : "#i-mute");
  }

  // Gems fly from a screen point into the counter, then call onArrive for each.
  flyGems(x, y, count, onArrive) {
    const targetBox = this.el.gems.getBoundingClientRect();
    const tx = targetBox.left + targetBox.height * 0.6;
    const ty = targetBox.top + targetBox.height * 0.5;
    for (let i = 0; i < count; i += 1) {
      const flyer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      flyer.setAttribute("class", "flyer");
      flyer.setAttribute("viewBox", "0 0 64 56");
      flyer.innerHTML = '<use href="#i-gem" />';
      this.el.flyers.append(flyer);
      const spreadX = (Math.random() - 0.5) * 80;
      const spreadY = -30 - Math.random() * 60;
      const delay = i * 70;
      const animation = flyer.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(0.4)` },
          { transform: `translate(${x + spreadX}px, ${y + spreadY}px) scale(1.2)`, offset: 0.3 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.7)` },
        ],
        { duration: 750, delay, easing: "cubic-bezier(0.5, 0, 0.6, 1)", fill: "both" },
      );
      animation.onfinish = () => {
        flyer.remove();
        onArrive();
      };
    }
  }
}
