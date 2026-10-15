// Original eight-bar tunes. Numbers are scale degrees; -1 is a rest.
// One row is a bar of eighth notes. The last four bars answer the first four.
const TUNES = {
  title:   [[0,2,4,-1,4,5,4,2],[1,-1,3,2,1,-1,0,-1],[2,4,5,4,2,1,0,2],[1,2,1,-1,0,-1,-1,-1]],
  garden:  [[0,-1,2,4,4,2,5,4],[1,3,4,-1,3,1,2,-1],[2,-1,4,5,7,5,4,2],[1,2,3,1,0,-1,0,-1]],
  jungle:  [[4,2,-1,0,2,-1,4,5],[3,-1,1,3,4,3,1,-1],[5,4,2,-1,0,2,4,-1],[3,1,2,3,0,-1,0,-1]],
  swamp:   [[0,-1,4,2,-1,1,0,-1],[3,1,-1,4,3,-1,1,2],[2,-1,5,4,-1,2,0,2],[1,3,2,-1,0,-1,0,-1]],
  volcano: [[0,0,4,-1,5,4,2,-1],[3,3,5,4,3,-1,1,-1],[2,4,7,-1,6,5,4,2],[3,2,1,2,0,-1,0,-1]],
  city:    [[0,-1,0,4,7,-1,5,4],[3,-1,3,5,4,3,1,-1],[2,4,5,7,9,-1,7,4],[5,3,4,2,0,-1,0,-1]],
  boss:    [[0,4,0,4,5,4,2,4],[1,3,1,3,5,4,3,1],[2,4,7,4,5,7,9,7],[5,3,4,2,0,2,0,-1]],
  victory: [[0,-1,2,-1,4,4,5,6],[7,-1,7,6,7,-1,-1,-1],[5,-1,4,2,3,-1,2,1],[2,4,2,1,0,-1,-1,-1]],
};

// Distinct keys and colors, all major: excitement comes from rhythm, not menace.
export const MUSIC_THEMES = {
  title:   { root: 60, bpm: 112, wave: "triangle", cutoff: 2100, decay: 0.23, bass: "sine", chords: [0,3,4,0,5,3,4,0] },
  garden:  { root: 62, bpm: 120, wave: "triangle", cutoff: 3200, decay: 0.18, bass: "triangle", chords: [0,3,0,4,5,3,4,0] },
  jungle:  { root: 65, bpm: 126, wave: "sine", cutoff: 2400, decay: 0.12, bass: "triangle", chords: [0,3,5,4,0,3,4,0] },
  swamp:   { root: 58, bpm: 104, wave: "sine", cutoff: 1100, decay: 0.28, bass: "sine", chords: [0,4,3,0,5,3,4,0] },
  volcano: { root: 57, bpm: 132, wave: "sawtooth", cutoff: 1250, decay: 0.18, bass: "triangle", chords: [0,5,3,4,0,3,4,0] },
  city:    { root: 63, bpm: 124, wave: "sawtooth", cutoff: 1900, decay: 0.25, bass: "triangle", chords: [0,3,5,4,0,3,4,0] },
  boss:    { root: 64, bpm: 140, wave: "square", cutoff: 1700, decay: 0.13, bass: "triangle", chords: [0,3,5,4,0,3,4,0] },
  victory: { root: 67, bpm: 116, wave: "triangle", cutoff: 3000, decay: 0.32, bass: "sine", chords: [0,4,3,0,5,3,4,0] },
};
const SCALE = [0, 2, 4, 5, 7, 9, 11];
function pitch(root, degree) {
  const octave = Math.floor(degree / 7);
  return 440 * 2 ** ((root + SCALE[((degree % 7) + 7) % 7] + octave * 12 - 69) / 12);
}

export class Music {
  constructor(sound) {
    this.sound = sound;
    this.themeId = null;
    this.intensity = 0;
    this.tracks = [];
    this.timer = null;
    this.output = null;
    this.scheduledNotes = 0; // Useful in the audition lab and timing tests.
    this.tick = this.tick.bind(this);
  }

  play(themeId) {
    if (!MUSIC_THEMES[themeId]) throw new Error(`Unknown music theme: ${themeId}`);
    this.themeId = themeId;
    if (!this.timer) this.timer = setInterval(this.tick, 25);
    this.tick(); // Never creates or resumes the AudioContext; Sound.unlock owns that.
  }

  stop() {
    this.themeId = null;
    this.tick();
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  duck(seconds = 1) {
    if (!this.output) return;
    const now = this.sound.context.currentTime;
    const gain = this.output.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0.045, now + 0.035);
    gain.setValueAtTime(0.045, now + Math.max(0.04, seconds));
    gain.linearRampToValueAtTime(0.19, now + Math.max(0.04, seconds) + 0.4);
  }

  tick() {
    if (!this.sound.ready) {
      if (!this.themeId && !this.tracks.length) this.clearTimer();
      return;
    }
    const context = this.sound.context;
    const now = context.currentTime;
    if (!this.output) {
      this.output = context.createGain();
      this.output.gain.value = 0.19;
      this.output.connect(this.sound.master); // Muting Sound also mutes music.
    }
    const current = this.tracks.find((track) => !track.retireAt);
    if ((current?.id ?? null) !== this.themeId) {
      if (current) {
        current.bus.gain.cancelScheduledValues(now);
        current.bus.gain.setValueAtTime(current.bus.gain.value, now);
        current.bus.gain.linearRampToValueAtTime(0, now + 1);
        current.retireAt = now + 1.1;
      }
      if (this.themeId) {
        const bus = context.createGain();
        bus.gain.setValueAtTime(0, now);
        bus.gain.linearRampToValueAtTime(1, now + 1);
        bus.connect(this.output);
        this.tracks.push({ id: this.themeId, bus, step: 0, next: now + 0.03, retireAt: 0 });
      }
    }
    this.tracks = this.tracks.filter((track) => {
      if (track.retireAt && now >= track.retireAt) {
        track.bus.disconnect();
        return false;
      }
      const stepTime = 60 / MUSIC_THEMES[track.id].bpm / 2;
      // After a background-tab pause, skip missed notes rather than burst them.
      if (track.next < now) {
        const missed = Math.ceil((now - track.next) / stepTime);
        track.step += missed;
        track.next += missed * stepTime;
      }
      const horizon = track.retireAt ? Math.min(now + 0.12, track.retireAt - 0.1) : now + 0.12;
      while (track.next < horizon) {
        this.scheduleStep(track, track.next);
        track.next += stepTime;
        track.step += 1;
      }
      return true;
    });
    if (!this.themeId && !this.tracks.length) this.clearTimer();
  }

  clearTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }

  scheduleStep(track, time) {
    const theme = MUSIC_THEMES[track.id];
    const bar = Math.floor(track.step / 8) % 8;
    const beat = track.step % 8;
    const chord = theme.chords[bar];
    const answer = bar >= 4;
    let degree = TUNES[track.id][bar % 4][beat];
    // Answer phrase: higher opening, then a clear tonic ending in bar eight.
    if (answer && degree >= 0 && beat < 4) degree += 2;
    if (bar === 7 && beat >= 4) degree = beat === 4 ? 0 : -1;
    const gentleVictory = track.id === "victory" && track.step >= 32;
    if (gentleVictory && beat % 2) degree = -1;
    const volume = gentleVictory ? 0.085 : 0.16;
    if (degree >= 0) {
      this.voice(track, pitch(theme.root + 12, degree), time, theme.decay, volume, theme.wave, theme.cutoff);
      if (track.id === "jungle") this.voice(track, pitch(theme.root + 24, degree), time, 0.055, 0.045, "sine", 4000);
    }
    if (beat === 0 || beat === 4) {
      this.voice(track, pitch(theme.root - 12, chord), time, 0.25, 0.2, theme.bass, 650);
    }
    // Offbeat two-note chord stabs keep the arrangement light and leave room for effects.
    if (beat === 2 || beat === 6) {
      for (const offset of [0, 2]) this.voice(track, pitch(theme.root, chord + offset), time, 0.13, 0.06, "triangle", 1500);
    }
    const drive = (track.id === "boss" ? 0.45 : 0.08) + this.intensity * 0.55;
    if (beat === 0 || beat === 4) this.voice(track, 95, time, 0.12, drive * 0.22, "sine", 220, 42);
    if ((beat % 2 === 1 && this.intensity > 0.3) || beat === 2 || beat === 6) {
      this.drum(track, time, drive * 0.12, beat % 2 ? 6500 : 1900);
    }
    if (this.intensity > 0.65 && beat % 2 === 1) {
      this.voice(track, pitch(theme.root + 12, chord + (beat === 3 ? 4 : 2)), time, 0.07, 0.045 * this.intensity, "sine", 3000);
    }
  }

  voice(track, frequency, time, duration, volume, type, cutoff, endFrequency = frequency) {
    const context = this.sound.context;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(track.bus);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    this.scheduledNotes += 1;
  }

  drum(track, time, volume, frequency) {
    const context = this.sound.context;
    const source = context.createBufferSource();
    source.buffer = this.sound.noise;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = frequency;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(volume, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(track.bus);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(time);
    source.stop(time + 0.06);
    this.scheduledNotes += 1;
  }
}
