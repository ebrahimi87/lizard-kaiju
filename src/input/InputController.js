// Turns touch, mouse, and keyboard into one snapshot per frame:
//   sample() → { x, y, fire, water, mega, taps, pause }
// x/y: movement in screen directions (right, up), length ≤ 1.
// taps: number of new presses anywhere since the last sample (used to wriggle free).
//
// The joystick owns the first pointer that lands in its zone; each hold button owns
// its own pointer, so moving and breathing fire work at the same time.

const MOVEMENT_KEYS = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
};
const BUTTON_KEYS = { KeyJ: "fire", KeyK: "water", Space: "mega" };
const JOYSTICK_TRAVEL = 0.32; // fraction of the base width the knob can travel

class HoldButton {
  constructor(element) {
    this.element = element;
    this.pointerId = null;
    this.onDown = (event) => {
      if (this.pointerId !== null || element.hidden || element.classList.contains("is-disabled")) return;
      event.preventDefault();
      this.pointerId = event.pointerId;
      element.classList.add("is-active");
      element.setPointerCapture(event.pointerId);
    };
    this.onUp = (event) => {
      if (event.pointerId === this.pointerId) this.release();
    };
    element.addEventListener("pointerdown", this.onDown);
    element.addEventListener("pointerup", this.onUp);
    element.addEventListener("pointercancel", this.onUp);
    element.addEventListener("lostpointercapture", this.onUp);
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  get held() {
    return this.pointerId !== null;
  }

  release() {
    if (this.pointerId !== null && this.element.hasPointerCapture(this.pointerId)) {
      this.element.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.element.classList.remove("is-active");
  }
}

export class InputController {
  // elements: { joystickZone, joystickBase, joystickKnob, fire, water, mega }
  constructor(elements) {
    this.zone = elements.joystickZone;
    this.base = elements.joystickBase;
    this.knob = elements.joystickKnob;
    this.buttons = {
      fire: new HoldButton(elements.fire),
      water: new HoldButton(elements.water),
      mega: new HoldButton(elements.mega),
    };
    this.keys = new Set();
    this.joystickPointer = null;
    this.originX = 0;
    this.originY = 0;
    this.stickX = 0;
    this.stickY = 0;
    this.taps = 0;
    this.pausePressed = false;
    this.usedJoystick = false;

    window.addEventListener("keydown", (event) => this.onKey(event, true));
    window.addEventListener("keyup", (event) => this.onKey(event, false));
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
    // Any press counts as a tap (wriggling out of the net works anywhere on screen).
    window.addEventListener("pointerdown", () => {
      this.taps += 1;
    });
    this.zone.addEventListener("pointerdown", (event) => this.onStickDown(event));
    this.zone.addEventListener("pointermove", (event) => this.onStickMove(event));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.zone.addEventListener(type, (event) => {
        if (event.pointerId === this.joystickPointer) this.releaseStick();
      });
    }
    this.zone.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  onKey(event, down) {
    if (event.code === "Escape" && down) {
      this.pausePressed = true;
      return;
    }
    if (!(event.code in MOVEMENT_KEYS) && !(event.code in BUTTON_KEYS)) return;
    event.preventDefault();
    if (down) {
      if (!event.repeat) this.taps += 1;
      this.keys.add(event.code);
    } else {
      this.keys.delete(event.code);
    }
  }

  onStickDown(event) {
    if (this.joystickPointer !== null) return;
    event.preventDefault();
    this.joystickPointer = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    const bounds = this.zone.getBoundingClientRect();
    this.base.style.left = `${event.clientX - bounds.left}px`;
    this.base.style.top = `${event.clientY - bounds.top}px`;
    this.zone.classList.add("is-active");
    this.zone.setPointerCapture(event.pointerId);
    this.usedJoystick = true;
  }

  onStickMove(event) {
    if (event.pointerId !== this.joystickPointer) return;
    event.preventDefault();
    const travel = this.base.getBoundingClientRect().width * JOYSTICK_TRAVEL;
    const dx = event.clientX - this.originX;
    const dy = event.clientY - this.originY;
    const distance = Math.hypot(dx, dy);
    const clamp = distance > travel ? travel / distance : 1;
    this.stickX = (dx * clamp) / travel;
    this.stickY = (-dy * clamp) / travel;
    this.knob.style.transform = `translate(calc(-50% + ${dx * clamp}px), calc(-50% + ${dy * clamp}px))`;
  }

  releaseStick() {
    if (this.joystickPointer !== null && this.zone.hasPointerCapture(this.joystickPointer)) {
      this.zone.releasePointerCapture(this.joystickPointer);
    }
    this.joystickPointer = null;
    this.stickX = 0;
    this.stickY = 0;
    this.knob.style.transform = "";
    this.zone.classList.remove("is-active");
  }

  sample() {
    let x = this.stickX;
    let y = this.stickY;
    for (const code of this.keys) {
      const direction = MOVEMENT_KEYS[code];
      if (direction) {
        x += direction[0];
        y += direction[1];
      }
    }
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    const keyHeld = (name) => Object.entries(BUTTON_KEYS).some(([code, button]) => button === name && this.keys.has(code));
    const snapshot = {
      x,
      y,
      fire: this.buttons.fire.held || keyHeld("fire"),
      water: this.buttons.water.held || keyHeld("water"),
      mega: this.buttons.mega.held || keyHeld("mega"),
      taps: this.taps,
      pause: this.pausePressed,
    };
    this.taps = 0;
    this.pausePressed = false;
    return snapshot;
  }

  clear() {
    this.keys.clear();
    this.releaseStick();
    for (const button of Object.values(this.buttons)) button.release();
  }
}
