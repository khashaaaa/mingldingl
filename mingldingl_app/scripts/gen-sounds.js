// scripts/gen-sounds.js — generates the world layer's six event sounds.
//
// Same doctrine as gen-ornaments.js: assets are rendered from description, not committed as
// opaque binaries nobody can adjust. Everything here is additive synthesis plus a one-pole
// lowpass over white noise — pure Node, no dependencies, no sample library, no licences.
//
// Mono 16-bit PCM at 22.05 kHz, which is plenty for a half-second thud and keeps every file
// under ~30 kB. Each sound ends on a forced 8 ms fade so no clip finishes on a click.
//
// Rerun with: node scripts/gen-sounds.js   (writes assets/sounds/*.wav)

const fs = require('fs');
const path = require('path');

const RATE = 22050;
const FADE_OUT_S = 0.008;

// ---------- primitives ----------

/** Exponential decay. `k` is how many e-folds have passed by the end of the sound. */
function decay(t, dur, k = 5) {
  return Math.exp((-k * t) / dur);
}

function sine(t, freq, phase = 0) {
  return Math.sin(2 * Math.PI * freq * t + phase);
}

/**
 * White noise through a one-pole lowpass. Deterministic on purpose — a generator that produced a
 * different crack on every run would make the assets un-reviewable.
 */
function noiseSource(seed, cutoffHz) {
  let s = seed >>> 0;
  let last = 0;
  const a = Math.exp((-2 * Math.PI * cutoffHz) / RATE);
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    const white = (s / 0xffffffff) * 2 - 1;
    last = white * (1 - a) + last * a;
    return last;
  };
}

function render(durationS, fn) {
  const n = Math.floor(durationS * RATE);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i);
  return out;
}

// ---------- the six ----------

/** Entering a delve: a door closing above you. Body, no sparkle. */
function door() {
  const dur = 0.5;
  const n = noiseSource(0x51ee7, 400);
  return render(dur, (t) => {
    const thud = sine(t, 62 - 18 * (t / dur)) * decay(t, dur, 6);
    const body = n() * decay(t, dur, 14) * 0.9;
    return thud * 0.8 + body * 0.5;
  });
}

/** Coming back up. Short, unremarkable, deliberately quieter than the descent. */
function rise() {
  const dur = 0.26;
  return render(dur, (t) => {
    const f = 210 + 240 * (t / dur);
    return (sine(t, f) * 0.6 + sine(t, f * 2) * 0.15) * decay(t, dur, 5);
  });
}

/** Tier-up: a struck anvil. Inharmonic partials are what stop it sounding like a piano. */
function anvil() {
  const dur = 0.85;
  const partials = [
    [524, 1.0, 4], [1243, 0.55, 6], [1867, 0.4, 8], [2490, 0.3, 11], [3610, 0.18, 15],
  ];
  const n = noiseSource(0xa27, 6000);
  return render(dur, (t) => {
    let v = 0;
    for (const [f, amp, k] of partials) v += sine(t, f) * amp * decay(t, dur, k);
    // The strike itself: a few milliseconds of bright noise on the attack.
    return v * 0.45 + n() * decay(t, dur, 90) * 0.5;
  });
}

/** The boss seal breaking: a crack with something heavy behind it. */
function seal() {
  const dur = 0.7;
  const crack = noiseSource(0xb0552, 9000);
  const rubble = noiseSource(0x5ea1, 900);
  return render(dur, (t) => {
    const snap = crack() * decay(t, dur, 120) * 1.1;
    const boom = sine(t, 88 - 30 * (t / dur)) * decay(t, dur, 7) * 0.8;
    const debris = rubble() * decay(t, dur, 9) * 0.35;
    return snap + boom + debris;
  });
}

/** An honour landing: two bell notes, a fifth apart, the second a beat late. */
function honour() {
  const dur = 0.9;
  const strike = (t, f, at) => {
    const dt = t - at;
    if (dt < 0) return 0;
    const d = dur - at;
    return (sine(dt, f) * 0.7 + sine(dt, f * 2.76) * 0.18) * decay(dt, d, 6);
  };
  return render(dur, (t) => strike(t, 659, 0) * 0.9 + strike(t, 988, 0.14) * 0.8);
}

/** A pledge kept: two soft taps, wood not metal. */
function pledge() {
  const dur = 0.42;
  const n = noiseSource(0x9e0d, 1600);
  const tap = (t, at) => {
    const dt = t - at;
    if (dt < 0) return 0;
    return (sine(dt, 300) * 0.5 + n() * 0.5) * decay(dt, 0.16, 16);
  };
  return render(dur, (t) => (tap(t, 0) + tap(t, 0.13) * 0.75) * 0.7);
}

// ---------- encode ----------

function normalise(samples, peak = 0.82) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const g = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

function fadeOut(samples) {
  const f = Math.floor(FADE_OUT_S * RATE);
  for (let i = 0; i < f; i++) {
    samples[samples.length - 1 - i] *= i / f;
  }
  return samples;
}

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);          // PCM chunk size
  buf.writeUInt16LE(1, 20);           // format: PCM
  buf.writeUInt16LE(1, 22);           // channels: mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);    // byte rate
  buf.writeUInt16LE(2, 32);           // block align
  buf.writeUInt16LE(16, 34);          // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2);
  }
  return buf;
}

const SOUNDS = { door, rise, anvil, seal, honour, pledge };

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, make] of Object.entries(SOUNDS)) {
  const wav = toWav(fadeOut(normalise(make())));
  const file = path.join(outDir, `${name}.wav`);
  fs.writeFileSync(file, wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} kB`);
}
