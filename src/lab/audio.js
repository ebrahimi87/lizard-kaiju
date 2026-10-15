import { Sound } from "../audio/Sound.js";
import { Music, MUSIC_THEMES } from "../audio/Music.js";

const sound = new Sound();
const music = new Music(sound);
document.getElementById("lab-canvas").hidden = true;
document.title = "Lizard Kaiju — Audio Lab";
const style = document.createElement("style");
style.textContent = `
  html, body { overflow: auto; background: #fff4d8; color: #342d46; font: 20px system-ui; }
  main { max-width: 960px; margin: auto; padding: 24px; }
  h1 { margin: 0 0 8px; } h2 { font-size: 24px; margin-bottom: 12px; }
  .buttons { display: flex; flex-wrap: wrap; gap: 12px; }
  button { font: inherit; min-height: 64px; min-width: 140px; padding: 12px 18px;
    border: 2px solid #342d46; border-radius: 18px; background: #fff; color: inherit; touch-action: manipulation; }
  button:active { background: #ffbd64; } input { width: 240px; height: 48px; vertical-align: middle; }
  #status { min-height: 30px; } p { line-height: 1.5; }
`;
document.head.append(style);
const main = document.createElement("main");
main.innerHTML = `<h1>🦎 Audio playground</h1>
  <p>Tap a tune. Try a roar over the music! Audio starts only after a tap.</p>
  <h2>🎵 Tunes</h2><div class="buttons" id="themes"></div>
  <p><label>Chase energy <input id="intensity" type="range" min="0" max="1" step="0.01" value="0"></label></p>
  <div class="buttons" id="controls"></div>
  <p id="status" role="status">Ready — tap to start</p>
  <h2>✨ Sound effects</h2><div class="buttons" id="effects"></div>`;
document.body.append(main);
const status = document.getElementById("status");
function button(group, label, action) {
  const element = document.createElement("button");
  element.textContent = label;
  element.addEventListener("click", () => {
    sound.unlock();
    // resume() can finish after the gesture handler; do not lose that first effect.
    if (sound.context) sound.context.resume().then(() => { action(); updateStatus(); });
  });
  document.getElementById(group).append(element);
}
function updateStatus() {
  status.textContent = `${sound.context?.state ?? "locked"} · ${music.themeId ?? "no music"} · ${music.scheduledNotes} scheduled voices${sound.muted ? " · muted" : ""}`;
}
for (const id of Object.keys(MUSIC_THEMES)) button("themes", `♫ ${id}`, () => music.play(id));
button("controls", "⏹ Stop music", () => music.stop());
button("controls", "🔈 Mute / unmute", () => sound.setMuted(!sound.muted));
button("controls", "⬇ Duck 2 seconds", () => music.duck(2));
document.getElementById("intensity").addEventListener("input", (event) => music.setIntensity(Number(event.target.value)));
for (const method of ["chomp", "gem", "whoosh", "netWhoosh", "caught", "wriggle", "escape", "hurt", "yowch", "slip", "boing", "twinkle", "evolve", "click", "crumble", "robotStomp", "robotPunch"]) {
  button("effects", method, () => { if (method === "evolve") music.duck(1.5); sound[method](); });
}
for (let size = 1; size <= 5; size += 1) button("effects", `🦎 Roar ${size}`, () => { music.duck(1); sound.roar(size); });
for (const name of ["fire", "water"]) {
  let on = false;
  button("effects", `${name} on / off`, () => { on = !on; sound.setLoop(name, on); });
}

// Real offline rendering for tests and human audition; no speakers or gesture required.
async function renderSample(id, seconds = 12, intensity = 0.5) {
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const context = new OfflineContext(1, Math.ceil((seconds + 0.6) * 22050), 22050);
  const master = context.createGain();
  master.gain.value = 0.8 * 0.19;
  master.connect(context.destination);
  const noise = context.createBuffer(1, 22050, 22050);
  const data = noise.getChannelData(0);
  let seed = 17;
  for (let i = 0; i < data.length; i += 1) {
    seed = (seed * 16807) % 2147483647;
    data[i] = seed / 1073741823.5 - 1;
  }
  const offlineMusic = new Music({ context, master, noise });
  offlineMusic.setIntensity(intensity);
  const track = { id, bus: master, step: 0 };
  const stepTime = 60 / MUSIC_THEMES[id].bpm / 2;
  for (let time = 0.03; time < seconds; time += stepTime) {
    offlineMusic.scheduleStep(track, time);
    track.step += 1;
  }
  const buffer = await context.startRendering();
  return { buffer, scheduledNotes: offlineMusic.scheduledNotes };
}

window.__LAB__ = { ready: true, sound, music, renderSample, themes: Object.keys(MUSIC_THEMES) };
