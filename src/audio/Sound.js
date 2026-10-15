// Small synthesized sound effects with the Web Audio API. Audio starts on the first
// tap (browsers require a gesture). Every sound is optional: the game is fully
// playable muted.

export class Sound {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.noise = null;
    this.loops = {};
  }

  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const compressor = this.context.createDynamicsCompressor();
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
      const length = this.context.sampleRate;
      this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.context.currentTime, 0.05);
  }

  get ready() {
    return Boolean(this.context) && this.context.state === "running";
  }

  tone({ type = "sine", from, to = from, duration, volume = 0.3, delay = 0, attack = 0.005, cutoff = 8000 }) {
    if (!this.ready) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 20), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  hiss({ duration, volume = 0.2, filter = "bandpass", from = 1000, to = from, q = 1, delay = 0 }) {
    if (!this.ready) return;
    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const shape = this.context.createBiquadFilter();
    shape.type = filter;
    shape.Q.value = q;
    shape.frequency.setValueAtTime(from, now);
    shape.frequency.exponentialRampToValueAtTime(to, now + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(shape);
    shape.connect(gain);
    gain.connect(this.master);
    source.onended = () => { source.disconnect(); shape.disconnect(); gain.disconnect(); };
    source.start(now, Math.random() * 0.5);
    source.stop(now + duration + 0.05);
  }

  // Held breath sounds: fire crackle-roar or water spray, faded in and out.
  setLoop(name, on) {
    if (!this.ready) return;
    let loop = this.loops[name];
    if (!loop) {
      const source = this.context.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const shape = this.context.createBiquadFilter();
      shape.type = name === "fire" ? "lowpass" : "highpass";
      shape.frequency.value = name === "fire" ? 700 : 2200;
      const gain = this.context.createGain();
      gain.gain.value = 0;
      source.connect(shape);
      shape.connect(gain);
      gain.connect(this.master);
      source.start();
      loop = { gain, shape };
      this.loops[name] = loop;
    }
    const now = this.context.currentTime;
    loop.gain.gain.setTargetAtTime(on ? (name === "fire" ? 0.5 : 0.22) : 0, now, on ? 0.04 : 0.12);
    if (on && name === "fire") loop.shape.frequency.setTargetAtTime(500 + Math.random() * 600, now, 0.05);
  }

  chomp() {
    this.tone({ type: "triangle", from: 720, to: 110, duration: 0.12, volume: 0.32 });
    this.tone({ from: 180, to: 80, duration: 0.09, volume: 0.22, delay: 0.035 });
    this.hiss({ duration: 0.055, volume: 0.16, from: 2300, to: 900, q: 0.7 });
  }

  gem() {
    const base = 1046.5;
    [1, 1.25, 1.5, 2].forEach((ratio, index) => {
      this.tone({ from: base * ratio, duration: 0.22, volume: 0.1 - index * 0.015, delay: index * 0.045 });
    });
  }

  whoosh() {
    this.netWhoosh();
  }

  caught() {
    this.tone({ type: "sine", from: 500, to: 120, duration: 0.5, volume: 0.35 });
    this.hiss({ duration: 0.2, volume: 0.2, from: 900, to: 300 });
  }

  wriggle() {
    this.tone({ type: "square", from: 300 + Math.random() * 200, to: 200, duration: 0.07, volume: 0.06 });
  }

  escape() {
    this.hiss({ duration: 0.25, volume: 0.35, from: 2000, to: 500 });
    [523, 659, 784, 1046].forEach((note, index) => this.tone({ type: "triangle", from: note, duration: 0.16, volume: 0.15, delay: index * 0.06 }));
  }

  hurt() {
    this.tone({ type: "sine", from: 180, to: 60, duration: 0.3, volume: 0.45 });
  }

  yowch() {
    this.tone({ from: 460, to: 1500, duration: 0.16, volume: 0.22, attack: 0.015 });
    this.tone({ from: 1500, to: 330, duration: 0.4, volume: 0.2, delay: 0.14, attack: 0.02 });
  }

  slip() {
    this.tone({ type: "sine", from: 1400, to: 300, duration: 0.6, volume: 0.22 });
  }

  boing() {
    [0, 0.1, 0.2].forEach((delay, index) => {
      this.tone({ from: 180 + index * 65, to: 520 - index * 70, duration: 0.14, volume: 0.26 / (index + 1), delay });
    });
  }

  twinkle() {
    [1318, 1568, 2093].forEach((note, index) => this.tone({ type: "sine", from: note, duration: 0.2, volume: 0.07, delay: index * 0.08 }));
  }

  // Roar gets deeper with size (1 = gecko).
  roar(size = 1) {
    if (!this.ready) return;
    const growth = Math.max(0.6, Math.min(5, size));
    if (growth <= 1) {
      this.tone({ type: "triangle", from: 650, to: 1100, duration: 0.14, volume: 0.2, attack: 0.02 });
      this.tone({ from: 1000, to: 410, duration: 0.24, volume: 0.22, delay: 0.12 });
      return;
    }
    const base = 220 / growth;
    const duration = 0.45 + growth * 0.14;
    // A round low voice, a filtered growl, and three little throat pulses.
    this.tone({ from: base * 1.8, to: base, duration, volume: 0.3, attack: 0.06 });
    this.tone({ type: "sawtooth", from: base * 3, to: base * 1.4, duration, volume: 0.12, attack: 0.05, cutoff: 700 });
    for (let i = 0; i < 3; i += 1) this.tone({ type: "triangle", from: base * 4, to: base * 2, duration: 0.18, volume: 0.08, delay: i * 0.14 });
    this.hiss({ duration, volume: 0.13, filter: "lowpass", from: 850, to: 180 });
  }

  netWhoosh() {
    this.hiss({ duration: 0.28, volume: 0.22, from: 500, to: 3200, q: 0.7 });
    this.hiss({ duration: 0.18, volume: 0.1, from: 3000, to: 700, delay: 0.13 });
  }

  crumble() {
    for (let i = 0; i < 5; i += 1) {
      this.hiss({ duration: 0.22, volume: 0.16 / (1 + i * 0.3), filter: "lowpass", from: 1600 - i * 220, to: 140, delay: i * 0.085 });
      this.tone({ type: "triangle", from: 160 - i * 18, to: 45, duration: 0.16, volume: 0.15, delay: i * 0.085 });
    }
  }

  robotStomp() {
    this.tone({ from: 135, to: 38, duration: 0.28, volume: 0.4 });
    this.tone({ type: "triangle", from: 330, to: 160, duration: 0.12, volume: 0.15, cutoff: 1400 });
    this.hiss({ duration: 0.16, volume: 0.18, filter: "lowpass", from: 1100, to: 220 });
  }

  robotPunch() {
    this.hiss({ duration: 0.12, volume: 0.18, from: 500, to: 2200 });
    this.tone({ from: 220, to: 55, duration: 0.2, volume: 0.35, delay: 0.08 });
    this.tone({ type: "triangle", from: 740, to: 280, duration: 0.11, volume: 0.12, delay: 0.08 });
  }

  evolve() {
    [392, 494, 587, 784, 988].forEach((note, index) => this.tone({ type: "triangle", from: note, duration: 0.5, volume: 0.12, delay: index * 0.12 }));
    this.hiss({ duration: 1.6, volume: 0.12, from: 300, to: 6000, q: 0.7 });
  }

  click() {
    this.tone({ type: "triangle", from: 900, to: 600, duration: 0.06, volume: 0.15 });
  }
}
