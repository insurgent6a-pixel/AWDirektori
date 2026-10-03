// node make-audio.mjs: writes the video's sound into public/: music.wav, pop.wav and ding.wav.
// All of it is synthesised here, so no licence is involved. (click.wav and whoosh.wav are Remotion's free effects.)
// The music is 120 BPM in A minor: one beat is 15 frames at 30 fps, so scenes that are multiples of 30 frames land on the beat.
// Its shape follows the video: 0-6 s suspense, a riser, the drop at 6 s (first feature), a drum roll at 40 s, the last hit at 42 s (closing card).
// ponytail: a plain synth. To use a real track, save it as public/music.wav and keep the drop near 6 s and the hit near 42 s.
import fs from "node:fs";

const RATE = 44100;
const TAU = 2 * Math.PI;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const track = (seconds) => {
  const n = Math.ceil(RATE * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // shape(t, freq) is the sound of one note, t in seconds from its start. pan: -1 left, 1 right.
  const note = (start, length, freq, gain, shape, pan = 0) => {
    const from = Math.floor(start * RATE);
    for (let i = 0; i < length * RATE && from + i < n; i++) {
      const v = shape(i / RATE, freq) * gain;
      L[from + i] += v * (1 - pan * 0.6);
      R[from + i] += v * (1 + pan * 0.6);
    }
  };
  const save = (name, fadeOut = 0.02) => {
    const data = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const fade = Math.min(1, t / 0.005) * Math.min(1, (seconds - t) / fadeOut);
      data.writeInt16LE(Math.round(Math.tanh(L[i] * 1.3) * fade * 32000), i * 4);
      data.writeInt16LE(Math.round(Math.tanh(R[i] * 1.3) * fade * 32000), i * 4 + 2);
    }
    const head = Buffer.alloc(44);
    head.write("RIFF", 0);
    head.writeUInt32LE(36 + data.length, 4);
    head.write("WAVEfmt ", 8);
    head.writeUInt32LE(16, 16);
    head.writeUInt16LE(1, 20);
    head.writeUInt16LE(2, 22);
    head.writeUInt32LE(RATE, 24);
    head.writeUInt32LE(RATE * 4, 28);
    head.writeUInt16LE(4, 32);
    head.writeUInt16LE(16, 34);
    head.write("data", 36);
    head.writeUInt32LE(data.length, 40);
    fs.writeFileSync(new URL(`./public/${name}`, import.meta.url), Buffer.concat([head, data]));
    console.log(`public/${name}`);
  };
  return { note, save };
};

// ── Voices ──
const saw = (t, f) => Math.sin(TAU * f * t) + Math.sin(TAU * 2 * f * t) / 2 + Math.sin(TAU * 3 * f * t) / 3 + Math.sin(TAU * 4 * f * t) / 4;
const stab = (t, f) => saw(t, f) * Math.exp(-t * 16) * Math.min(1, t * 500); // short "staccato strings"
const bell = (t, f) => (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * 2.01 * f * t)) * Math.exp(-t * 4.5) * Math.min(1, t * 300);
const pad = (len) => (t, f) => (Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * f * 1.004 * t) + 0.3 * Math.sin(TAU * 2 * f * t)) * Math.min(1, t * 2.5) * Math.min(1, (len - t) * 2.5);
const bass = (t, f) => (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t)) * Math.exp(-t * 9) * Math.min(1, t * 300);
const kick = (t) => Math.sin(TAU * (45 * t + (90 / 30) * (1 - Math.exp(-30 * t)))) * Math.exp(-t * 8);
let last = 0;
const hiss = () => {
  const n = noise();
  const high = n - last; // crude high-pass
  last = n;
  return high;
};
const hat = (t) => hiss() * Math.exp(-t * 70);
const clap = (t) => (hiss() * 0.6 + noise() * 0.4) * (Math.exp(-t * 22) + 0.6 * Math.exp(-Math.abs(t - 0.012) * 300));
const riser = (len) => (t) => (hiss() * 0.5 + 0.35 * Math.sin(TAU * (180 * t + (700 / len) * t * t))) * (t / len) ** 2;
const impact = (t) => Math.sin(TAU * (30 * t + (40 / 6) * (1 - Math.exp(-6 * t)))) * Math.exp(-t * 2.2) + noise() * 0.35 * Math.exp(-t * 7);

// ── music.wav ──
{
  const SECONDS = 47;
  const BEAT = 0.5;
  const BAR = 2;
  const { note, save } = track(SECONDS);
  // One bar each: A minor, F, C, G.
  const CHORDS = [
    [45, [57, 60, 64]],
    [41, [57, 60, 65]],
    [48, [55, 60, 64]],
    [43, [55, 59, 62]],
  ];
  const MELODY = [
    [76, null, 72, 74],
    [72, null, 69, 72],
    [76, null, 79, 76],
    [74, null, 71, 74],
  ];
  const DROP = 3; // bar 3 = 6 s
  const ROLL = 20; // bar 20 = 40 s
  const END = 21; // bar 21 = 42 s

  for (let bar = 0; bar < END; bar++) {
    const [root, tones] = CHORDS[bar % 4];
    const t0 = bar * BAR;
    const intro = bar < DROP;
    const roll = bar === ROLL;
    const high = bar >= 11 && !roll; // from 22 s everything is a step up
    if (intro) {
      // Suspense: a low drone and one ticking note that grows.
      note(t0, BAR, hz(33), 0.16, pad(BAR));
      note(t0, BAR, hz(40), 0.07, pad(BAR));
      for (let s = 0; s < 8; s++) note(t0 + s * 0.25, 0.2, hz(57), 0.035 + bar * 0.02 + (s % 4 === 0 ? 0.03 : 0), stab, s % 2 ? 0.4 : -0.4);
      if (bar > 0) for (const b of [0, 1.5]) note(t0 + b * BEAT, 0.4, 0, 0.45, kick); // a heartbeat
      continue;
    }
    for (const m of tones) note(t0, BAR, hz(m), 0.03, pad(BAR));
    // The driving pulse: 8th notes, 16ths once it is "high".
    const steps = high ? 16 : 8;
    for (let s = 0; s < steps; s++) {
      const m = tones[[0, 1, 2, 1][s % 4]] + (high && s % 8 >= 4 ? 12 : 0);
      note(t0 + s * (BAR / steps), 0.2, hz(m), (roll ? 0.03 : 0.055) * (s % (steps / 4) === 0 ? 1.4 : 1), stab, s % 2 ? 0.5 : -0.5);
    }
    for (let s = 0; s < 8; s++) note(t0 + s * 0.25, 0.24, hz(root - 12), s % 2 ? 0.2 : 0.11, bass); // quieter under the kick
    if (roll) {
      // The drums drop out; a snare roll and a riser build to the last hit.
      for (let s = 0; s < 24; s++) {
        const t = s < 8 ? s * 0.125 : 1 + (s - 8) * 0.0625;
        note(t0 + t, 0.1, 0, 0.05 + s * 0.012, clap);
      }
      note(t0, BAR, 0, 0.35, riser(BAR));
      continue;
    }
    for (let beat = 0; beat < 4; beat++) {
      const t = t0 + beat * BEAT;
      note(t, 0.4, 0, 0.6, kick);
      if (beat % 2) note(t, 0.25, 0, 0.16, clap);
      note(t + BEAT / 2, 0.06, 0, 0.07, hat);
      if (high) for (const off of [0.25, 0.75]) note(t + BEAT * off, 0.05, 0, 0.035, hat);
      const m = MELODY[bar % 4][beat];
      if (high && m) note(t, 1.2, hz(m), 0.1, bell, 0.2);
    }
  }
  note((DROP - 1) * BAR, BAR, 0, 0.3, riser(BAR));
  note(DROP * BAR, 3, 0, 0.7, impact);
  // The closing card: one hit, the home chord held, a last few bell notes.
  const end = END * BAR;
  note(end, 4, 0, 0.9, impact);
  for (const m of [45, 57, 60, 64, 69]) note(end, 5, hz(m), 0.045, pad(5));
  [69, 72, 76, 81].forEach((m, i) => note(end + i * 0.25, 2.5, hz(m), 0.11, bell, i % 2 ? 0.3 : -0.3));
  save("music.wav", 2.5);
}

// ── pop.wav: something small lands on screen ──
{
  const { note, save } = track(0.12);
  note(0, 0.12, 0, 0.6, (t) => Math.sin(TAU * (520 * t + (600 / 30) * (1 - Math.exp(-30 * t)))) * Math.exp(-t * 38));
  save("pop.wav");
}

// ── ding.wav: something worked ──
{
  const { note, save } = track(1.1);
  [88, 95, 100].forEach((m, i) => note(i * 0.07, 1, hz(m), 0.3, (t, f) => Math.sin(TAU * f * t) * Math.exp(-t * 6)));
  save("ding.wav", 0.2);
}
