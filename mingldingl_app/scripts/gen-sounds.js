// scripts/gen-sounds.js — generates the world layer's event sounds.
//
// Same doctrine as gen-ornaments.js: assets are rendered from description, not committed as
// opaque binaries nobody can adjust. Everything here is additive synthesis plus a one-pole
// lowpass over white noise — pure Node, no dependencies, no sample library, no licences.
//
// Mono 16-bit PCM at 22.05 kHz, which is plenty for a half-second thud and keeps every file
// under ~30 kB. Each sound opens on a 2 ms fade and ends on an 8 ms one, so no clip starts or
// finishes on a click.
//
// Voiced for a phone speaker, which plays next to nothing below ~400 Hz: every low body (the
// door's thud, the seal's boom, the dying ember) carries upper harmonics, so the ear hears the
// fundamental the speaker cannot move (the "missing fundamental"). Measured on the first set,
// door/dying/seal/candle put 95-99% of their energy below 400 Hz and were near-silent on the A51.
//
// Rerun with: node scripts/gen-sounds.js   (writes assets/sounds/*.wav)

const fs = require('fs');
const path = require('path');

const RATE = 22050;
const FADE_OUT_S = 0.008;
const FADE_IN_S = 0.002;

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

/** A body at `f` plus harmonics 2..n at 1/k amplitude — what a speaker that cannot play `f` still
 *  lets you hear as `f`. */
function rich(t, f, n = 8, tilt = 1) {
  let v = 0;
  for (let k = 1; k <= n; k++) v += sine(t, f * k) / Math.pow(k, tilt);
  return v;
}

function render(durationS, fn) {
  const n = Math.floor(durationS * RATE);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i);
  return out;
}

// ---------- the voices ----------

/** Entering a delve: a door closing above you. Body, no sparkle. */
function door() {
  const dur = 0.5;
  const n = noiseSource(0x51ee7, 1400);
  return render(dur, (t) => {
    const thud = rich(t, 62 - 18 * (t / dur), 10, 0.8) * decay(t, dur, 6);
    // The wood of the door itself, so the thud has a surface a phone can sound.
    const panel = (sine(t, 196) * 0.6 + sine(t, 412) * 0.35) * decay(t, dur, 11);
    const body = n() * decay(t, dur, 14) * 0.9;
    return thud * 0.3 + panel * 1.0 + body * 0.6;
  });
}

/** Coming back up. Short, unremarkable, deliberately quieter than the descent. */
function rise() {
  const dur = 0.26;
  return render(dur, (t) => {
    const f = 210 + 240 * (t / dur);
    return (sine(t, f) * 0.6 + sine(t, f * 2) * 0.3 + sine(t, f * 3) * 0.15) * decay(t, dur, 5);
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
  const rubble = noiseSource(0x5ea1, 2200);
  return render(dur, (t) => {
    const snap = crack() * decay(t, dur, 120) * 1.1;
    const boom = rich(t, 88 - 30 * (t / dur), 9, 0.9) * decay(t, dur, 7) * 0.45;
    // The stone giving way: a dull 330/520 Hz ring under the rubble, so the weight is audible.
    const stone = (sine(t, 330) * 0.5 + sine(t, 520) * 0.3) * decay(t, dur, 8);
    const debris = rubble() * decay(t, dur, 9) * 0.6;
    return snap * 0.8 + boom + stone + debris;
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
  const n = noiseSource(0x9e0d, 3200);
  const tap = (t, at) => {
    const dt = t - at;
    if (dt < 0) return 0;
    // 300 Hz is the block; the 2.3x partial is the knock of it, the part a phone actually plays.
    return (sine(dt, 300) * 0.4 + sine(dt, 690) * 0.3 + n() * 0.5) * decay(dt, 0.16, 16);
  };
  return render(dur, (t) => (tap(t, 0) + tap(t, 0.13) * 0.75) * 0.7);
}

/**
 * A button pressed: a dry metallic click. ~40 ms of a high sine with a fast decay plus a tiny
 * bright-noise transient. Deliberately quiet (peak 0.5) — it fires on every press, so it must
 * never draw attention to itself.
 */
function tick() {
  const dur = 0.04;
  const n = noiseSource(0x71c4, 7000);
  return render(dur, (t) => {
    const ping = sine(t, 2400) * decay(t, dur, 9);
    const transient = n() * decay(t, dur, 60) * 0.6;
    return ping * 0.7 + transient;
  });
}

/**
 * A horn call: fundamental near 220 Hz with three harmonics, a slight upward bend through the
 * first 80 ms as the note finds its pitch, gentle vibrato, and a decaying tail.
 */
function horn() {
  const dur = 0.7;
  const BEND_S = 0.08;
  return render(dur, (t) => {
    const bend = t < BEND_S ? 1 - 0.04 * (1 - t / BEND_S) : 1;
    const vibrato = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t);
    const f = 220 * bend * vibrato;
    const attack = Math.min(1, t / 0.02);
    const tail = t < 0.25 ? 1 : decay(t - 0.25, dur - 0.25, 4);
    const v = sine(t, f) * 1.0 + sine(t, f * 2) * 0.55 + sine(t, f * 3) * 0.4 + sine(t, f * 4) * 0.25
      + sine(t, f * 5) * 0.12;
    return v * attack * tail;
  });
}

/**
 * A fire dying (Sealed Fire W3, move 7): a low crackle collapsing into itself. A 90 Hz sine —
 * the fire's own body — under a lowpass-filtered crackle, both fading at the same rate so
 * neither outlasts the other and reads as one thing going out rather than two.
 */
function dying() {
  const dur = 0.6;
  const crackle = noiseSource(0x6f2c1, 1600);
  return render(dur, (t) => {
    const ember = rich(t, 90, 8, 1.1) * decay(t, dur, 7);
    const crack = crackle() * decay(t, dur, 7);
    return ember * 0.4 + crack * 0.9;
  });
}

/**
 * A candle lit (Sealed Fire W4, Task 4): a soft "whoomf" as the flame catches — a low sine (the
 * wick taking) under lowpass-filtered noise (the breath of air it catches from), both fading out
 * within a third of a second. Quiet on purpose: this fires once per summons sent, same reasoning
 * as `tick`.
 */
function candle() {
  const dur = 0.35;
  const breath = noiseSource(0x9c31a, 2400);
  return render(dur, (t) => {
    const wick = rich(t, 220, 5, 1.2) * decay(t, dur, 6);
    return wick * 0.45 + breath() * decay(t, dur, 9) * 0.9;
  });
}

/**
 * The Square's bell (Sealed Fire W4, Task 4): one fundamental and two overtones struck together
 * and left to decay at the same rate, so it reads as a single strike rather than a chime — the
 * hour, not a melody.
 */
function bell() {
  const dur = 1.4;
  const partials = [[520, 1.0], [1040, 0.5], [1560, 0.25]];
  return render(dur, (t) => {
    let v = 0;
    for (const [f, amp] of partials) v += sine(t, f) * amp * decay(t, dur, 3);
    return v;
  });
}

/**
 * A match made: a hearth catching. A breath of air drawn in, then two warm notes a fourth apart
 * swelling up out of it — the one sound in the set that grows rather than decays at the start,
 * because it is the one moment that is the beginning of something rather than the end of it.
 */
function kindle() {
  const dur = 1.1;
  const air = noiseSource(0x4ea27, 2800);
  const SWELL_S = 0.18;
  const note = (t, f, at) => {
    const dt = t - at;
    if (dt < 0) return 0;
    const swell = Math.min(1, dt / SWELL_S);
    return (sine(dt, f) * 0.7 + sine(dt, f * 2) * 0.3 + sine(dt, f * 3) * 0.12)
      * swell * decay(dt, dur - at, 4);
  };
  return render(dur, (t) => {
    const breath = air() * Math.min(1, t / 0.12) * decay(t, dur, 9);
    return breath * 0.7 + note(t, 392, 0.06) * 0.8 + note(t, 523, 0.2) * 0.75;
  });
}

/**
 * A penalty: the hold taking its due. One dull, falling knock — a pitch that sags as it dies and a
 * second partial a few hertz off it, so the two beat against each other and the note sounds
 * cracked. No ring, no tail: a loss is felt and over, never dwelt on.
 */
function due() {
  const dur = 0.5;
  const n = noiseSource(0xd0e, 1800);
  return render(dur, (t) => {
    const f = 330 - 90 * (t / dur);
    const body = (sine(t, f) * 0.6 + sine(t, f * 1.02) * 0.5 + sine(t, f * 2.01) * 0.25) * decay(t, dur, 7);
    return body + n() * decay(t, dur, 40) * 0.5;
  });
}

// ---------- encode ----------

/**
 * Scaled to a loudness, capped by a peak. Peak alone left the set 12 dB apart (the horn, a held
 * note, at -10.5 dBFS RMS against the pledge's two taps at -22.7), so whichever fired loudest was
 * an accident of its shape rather than a choice.
 */
function normalise(samples, peak = 0.82, rms = RMS_TARGET) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  // Loudness is judged on what a phone speaker actually plays, not on the whole signal — a door
  // that is all sub-bass measures loud and is heard as nothing.
  const heard = highpass(highpass(samples, SPEAKER_HZ), SPEAKER_HZ);
  let sum = 0;
  for (const s of heard) sum += s * s;
  const g = Math.min(peak / max, rms / Math.sqrt(sum / samples.length));
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

/** tanh saturation, level-matched at full scale. Tames the low voices' opening spike, which
 *  otherwise sets the peak cap long before the band a phone plays gets loud, and the harmonics it
 *  adds are exactly the ones that let a phone speaker sound a thud at all. */
function saturate(samples, drive) {
  if (!drive) return samples;
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const k = Math.tanh(drive);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh((drive * samples[i]) / max) / k;
  return samples;
}

/** One-pole highpass, returned as a new array. */
function highpass(samples, hz) {
  const a = Math.exp((-2 * Math.PI * hz) / RATE);
  const out = new Float64Array(samples.length);
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    low = samples[i] * (1 - a) + low * a;
    out[i] = samples[i] - low;
  }
  return out;
}

function fadeIn(samples) {
  const f = Math.floor(FADE_IN_S * RATE);
  for (let i = 0; i < f; i++) samples[i] *= i / f;
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

// The tick is the one sound that fires on every press, so it is held well below the others; the
// dying crackle is quiet for the same reason the brief gives it — amplitude 0.5, not the ~0.82
// peak everything else normalises to.
// Peaks only cap; loudness is `RMS` below, which is what keeps the tick and the candle quiet.
const PEAKS = { tick: 0.5, dying: 0.7, candle: 0.7, bell: 0.7 };
/** Where a phone speaker starts to play anything, and below which the rendered sub-bass is cut. */
const SPEAKER_HZ = 400;
const SUB_HZ = 110;
/** Speaker-band loudness: -22 dBFS RMS for a moment; the frequent and the quiet ones 6 dB under. */
const RMS_TARGET = 0.08;
const RMS = { tick: 0.04, candle: 0.04, dying: 0.04, rise: 0.057 };

const DRIVE = { door: 3, seal: 2.5, dying: 2.5, candle: 2, pledge: 2, due: 1.5 };

const SOUNDS = { door, rise, anvil, seal, honour, pledge, tick, horn, dying, candle, bell, kindle, due };

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, make] of Object.entries(SOUNDS)) {
  // The sub-bass a speaker cannot move only spends headroom the audible band then cannot use.
  const wav = toWav(fadeOut(fadeIn(normalise(saturate(highpass(highpass(make(), SUB_HZ), SUB_HZ), DRIVE[name]), PEAKS[name], RMS[name]))));
  const file = path.join(outDir, `${name}.wav`);
  fs.writeFileSync(file, wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} kB`);
}
