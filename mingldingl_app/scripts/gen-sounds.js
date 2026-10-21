// scripts/gen-sounds.js — generates the world layer's event sounds.
//
// Same doctrine as gen-ornaments.js: assets are rendered from description, not committed as
// opaque binaries nobody can adjust. Pure Node, no dependencies, no sample library, no licences.
//
// The first set was bare sines over one-pole noise, dry: it read as drum-machine samples. This set
// models the things themselves — struck objects as banks of decaying modes (each partial with its
// own decay, twins a hertz apart so metal beats), a plucked string with an inharmonic, darkening
// spectrum (the yatga), a skin drum on a membrane's Bessel ratios (the khengereg), a bell on a real
// bell's partials — and puts every one in a room (Freeverb), which is most of what separates a
// sound from a sample. Notes are on D major pentatonic, the scale of the steppe's long song.
//
// Mono 16-bit PCM at 32 kHz. Each sound runs until its reverb tail falls 60 dB under its peak, then
// fades over 30 ms; it opens on a 1 ms fade, so no clip starts or finishes on a click.
//
// Voiced for a phone speaker, which plays next to nothing below ~400 Hz: every low body (the door,
// the seal, the drum) carries upper modes and a little saturation, so the ear hears the fundamental
// the speaker cannot move (the "missing fundamental"). Loudness is set in that band (see LOUD).
//
// Rerun with: node scripts/gen-sounds.js   (writes assets/sounds/*.wav)

const fs = require('node:fs');
const path = require('node:path');

const RATE = 32000;
const TAU = 2 * Math.PI;
const LN1000 = Math.log(1000); // -60 dB

// ---------- primitives ----------

/** Deterministic on purpose — a generator that produced a different crack on every run would make
 *  the assets un-reviewable. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function white(seed) {
  const r = rng(seed);
  return () => r() * 2 - 1;
}

/** Amplitude after `t` seconds of a decay that reaches -60 dB at `t60`. */
const fall = (t, t60) => Math.exp((-LN1000 * t) / t60);
/** A struck attack: up to full in a few multiples of `a` seconds. */
const rise = (t, a) => 1 - Math.exp(-t / a);

/** RBJ biquad; `set` retunes it per sample for sweeps. */
function biquad(type, f, q = Math.SQRT1_2) {
  let b0, b1, b2, a1, a2;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const set = (freq, qq = q) => {
    const w = (TAU * Math.min(freq, RATE * 0.45)) / RATE;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * qq);
    const a0 = 1 + alpha;
    if (type === 'lp') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (type === 'hp') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha]; // band-pass, 0 dB peak
    [b0, b1, b2, a1, a2] = [b0 / a0, b1 / a0, b2 / a0, (-2 * cos) / a0, (1 - alpha) / a0];
  };
  set(f);
  const run = (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    return y;
  };
  run.set = set;
  return run;
}

/**
 * A struck object: `[freq, amp, t60]` partials, each decaying on its own clock. `bend(t)` scales
 * every frequency (a pitch that drops as the strike relaxes); phases accumulate so it stays smooth.
 */
function struck(partials, { attack = 0.001, bend = null, seed = 1 } = {}) {
  const r = rng(seed);
  const phase = partials.map(() => r() * TAU);
  return (t) => {
    const k = bend ? bend(t) : 1;
    let v = 0;
    for (let i = 0; i < partials.length; i++) {
      const [f, amp, t60] = partials[i];
      phase[i] += (TAU * f * k) / RATE;
      v += Math.sin(phase[i]) * amp * fall(t, t60);
    }
    return v * rise(t, attack);
  };
}

/** Metal: every partial doubled a little sharp, so the pair beats the way a real casting does. */
function metal(partials, beat = 1.2) {
  return partials.flatMap(([f, amp, t60], i) => [
    [f, amp, t60],
    [f + beat * (1 + i * 0.4), amp * 0.55, t60 * 0.9],
  ]);
}

/**
 * A plucked string (the yatga): harmonics a touch stretched (stiff string), weighted by where it is
 * plucked, the high ones dying first so the note darkens as it rings; a breath of pick noise.
 */
function pluck(f, { amp = 1, t60 = 1.2, at = 0.18, seed = 7 } = {}) {
  const partials = [];
  for (let k = 1; k <= 12; k++) {
    const weight = Math.abs(Math.sin(Math.PI * k * at)) / k;
    if (weight < 0.01) continue;
    partials.push([f * k * Math.sqrt(1 + 0.0004 * k * k), weight, t60 / (1 + 0.55 * (k - 1))]);
  }
  const body = struck(partials, { attack: 0.0015, seed });
  const pick = white(seed + 1);
  const pickBand = biquad('bp', f * 4, 1.2);
  return (t) => (body(t) + pickBand(pick()) * fall(t, 0.025) * 0.5) * amp;
}

/** A sound starting `at` seconds in. */
const after = (at, voice) => (t) => (t < at ? 0 : voice(t - at));

/**
 * Freeverb, mono: eight damped combs in parallel into four allpasses. `room` is the comb feedback
 * (tail length), `damp` how fast the highs die in it, `size` scales the room. The wet signal is
 * banded to 250 Hz–7 kHz so the room never muddies the speaker band or hisses.
 */
function reverb(dry, { room = 0.8, damp = 0.3, wet = 0.25, size = 1, pre = 0.012 }) {
  const s = (d) => Math.max(1, Math.round(((d * RATE) / 44100) * size));
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({
    buf: new Float64Array(s(d)),
    i: 0,
    low: 0,
  }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float64Array(s(d)), i: 0 }));
  const preN = Math.round(pre * RATE);
  const lo = biquad('hp', 250);
  const hi = biquad('lp', 7000);
  const out = new Float64Array(dry.length);
  for (let n = 0; n < dry.length; n++) {
    const x = (n >= preN ? dry[n - preN] : 0) * 0.015;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.low = y * (1 - damp) + c.low * damp;
      c.buf[c.i] = x + c.low * room;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = acc + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      acc = b - acc;
    }
    out[n] = dry[n] + hi(lo(acc)) * wet * 3;
  }
  return out;
}

/** Renders `dur` seconds of the voice, then `tail` more of silence for the room to ring into. */
function render(dur, tail, fn) {
  const n = Math.floor((dur + tail) * RATE);
  const head = Math.floor(dur * RATE);
  const out = new Float64Array(n);
  for (let i = 0; i < head; i++) out[i] = fn(i / RATE);
  return out;
}

// ---------- the voices ----------
// Each returns [dry samples, room]. D major pentatonic: D5 587, E5 659, F#5 740, A5 880, B5 988.

const D5 = 587.33;
const FS5 = 739.99;
const A5 = 880;
const D6 = 1174.66;
const FS6 = 1479.98;
const A6 = 1760;

/**
 * A button pressed: a knucklebone (shagai) tapped on wood — a dry, hollow tick. Deliberately quiet
 * and nearly roomless: it fires on every press, so it must never draw attention to itself.
 */
function tick() {
  const n = white(0x71c4);
  const band = biquad('bp', 2700, 2.2);
  const bone = struck(
    [
      [1730, 0.6, 0.035],
      [2960, 0.4, 0.025],
      [4420, 0.22, 0.016],
    ],
    { attack: 0.0004, seed: 3 },
  );
  return [
    render(0.05, 0.08, (t) => band(n()) * fall(t, 0.012) * 1.6 + bone(t) * 0.5),
    { room: 0.5, damp: 0.6, wet: 0.06, size: 0.4 },
  ];
}

/** Going into a room: a heavy wooden door swung shut in a stone hall, its iron latch dropping. */
function door() {
  const wood = struck(
    [
      [78, 1, 0.26],
      [143, 0.8, 0.21],
      [231, 0.65, 0.17],
      [352, 0.55, 0.13],
      [517, 0.4, 0.09],
      [781, 0.22, 0.06],
      [1130, 0.12, 0.04],
    ],
    { attack: 0.003, bend: (t) => 1 + 0.12 * Math.exp(-t / 0.02), seed: 11 },
  );
  const n = white(0x51ee7);
  const knock = biquad('lp', 900);
  const latch = after(
    0.075,
    struck(
      metal([
        [2210, 0.35, 0.06],
        [3480, 0.22, 0.05],
        [5120, 0.12, 0.035],
      ]),
      { attack: 0.0003, seed: 12 },
    ),
  );
  return [
    render(0.6, 1.4, (t) => wood(t) * 0.8 + knock(n()) * fall(t, 0.06) * 0.9 + latch(t) * 0.5),
    { room: 0.86, damp: 0.35, wet: 0.3, pre: 0.02 },
  ];
}

/** Back home: air drawn upward and two light plucks, a fifth apart. Lighter than the descent. */
function roomRise() {
  const n = white(0x2153);
  const sweep = biquad('bp', 400, 1.4);
  const lo = after(0.1, pluck(D5, { amp: 0.35, t60: 0.8, seed: 21 }));
  const hi = after(0.19, pluck(A5, { amp: 0.4, t60: 0.9, seed: 23 }));
  return [
    render(0.45, 0.9, (t) => {
      sweep.set(400 * (2600 / 400) ** Math.min(1, t / 0.3));
      return sweep(n()) * rise(t, 0.06) * fall(t, 0.4) * 1.3 + lo(t) + hi(t);
    }),
    { room: 0.8, damp: 0.3, wet: 0.24 },
  ];
}

/** A seal stamped or broken: wax giving under a heavy press, a crack of stone, the hall answering. */
function seal() {
  const thunk = struck(
    [
      [110, 1, 0.28],
      [205, 0.65, 0.22],
      [330, 0.5, 0.17],
      [482, 0.35, 0.12],
      [700, 0.22, 0.08],
      [980, 0.12, 0.05],
    ],
    { attack: 0.002, bend: (t) => 1 + 0.5 * Math.exp(-t / 0.015), seed: 31 },
  );
  const wax = white(0xb0552);
  const waxBand = biquad('lp', 700);
  const crackNoise = white(0x5ea1);
  const crackBand = biquad('bp', 3200, 1);
  const stone = struck(
    [
      [640, 0.3, 0.3],
      [1012, 0.18, 0.24],
      [1530, 0.1, 0.18],
    ],
    { seed: 33 },
  );
  return [
    render(0.7, 1.2, (t) => {
      const crack = crackBand(crackNoise()) * (fall(t, 0.03) + (t > 0.035 ? fall(t - 0.035, 0.03) * 0.5 : 0));
      return thunk(t) * 0.8 + waxBand(wax()) * rise(t, 0.004) * fall(t, 0.12) * 0.6 + crack * 0.9 + stone(t);
    }),
    { room: 0.84, damp: 0.35, wet: 0.28 },
  ];
}

/**
 * A penalty: the hold taking its due. Two hits of a shaman's drum, the second lower and softer —
 * doom, dum — a skin on a membrane's Bessel ratios, its pitch sagging as the strike relaxes.
 */
function due() {
  const drum = (f0, amp, seed) => {
    const ratios = [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16, 3.5];
    const amps = [1, 0.7, 0.55, 0.45, 0.4, 0.3, 0.25, 0.2];
    const t60s = [0.45, 0.3, 0.25, 0.22, 0.18, 0.15, 0.13, 0.1];
    const skin = struck(
      ratios.map((r, i) => [f0 * r, amps[i], t60s[i]]),
      { attack: 0.0015, bend: (t) => 1 + 0.25 * Math.exp(-t / 0.03), seed },
    );
    const n = white(seed + 1);
    const slap = biquad('bp', 1100, 0.8);
    return (t) => (skin(t) + slap(n()) * fall(t, 0.05) * 0.7) * amp;
  };
  const first = drum(124, 1, 41);
  const second = after(0.17, drum(98, 0.6, 43));
  return [render(0.75, 1.2, (t) => first(t) + second(t)), { room: 0.85, damp: 0.45, wet: 0.26 }];
}

/** A candle lit: the scratch of a strike, the flame catching with a soft whoomf, a warm glow. */
function candle() {
  const scratchN = white(0x9c31a);
  const scratchBand = biquad('hp', 2500);
  const grain = rng(0x9c31b);
  const breathN = white(0x9c31c);
  const breath = biquad('lp', 300);
  const glow = after(
    0.04,
    struck(
      [
        [294, 0.2, 0.3],
        [588, 0.12, 0.25],
        [882, 0.06, 0.2],
      ],
      { attack: 0.04, seed: 51 },
    ),
  );
  let rough = 0;
  return [
    render(0.4, 0.6, (t) => {
      if (Math.floor(t * RATE) % 64 === 0) rough = 0.3 + grain() * 0.7;
      const scratch = t < 0.045 ? scratchBand(scratchN()) * rough * rise(t, 0.003) * fall(t, 0.045) : 0;
      breath.set(300 + 1500 * Math.min(1, t / 0.12));
      const whoomf = t < 0.025 ? 0 : breath(breathN()) * rise(t - 0.025, 0.03) * fall(t - 0.025, 0.3);
      return scratch * 0.7 + whoomf * 1.4 + glow(t);
    }),
    { room: 0.72, damp: 0.4, wet: 0.14, size: 0.7 },
  ];
}

/** Frost creeping over a dying ember: a hiss falling away, the last pops, ice ringing thin. */
function dying() {
  const hissN = white(0x6f2c1);
  const hiss = biquad('bp', 4000, 0.9);
  const pops = rng(0x6f2c2);
  const popRing = biquad('bp', 1800, 5);
  const ice = struck(
    [
      [2093, 0.12, 0.8],
      [2095.4, 0.08, 0.75],
      [2637, 0.08, 0.6],
    ],
    { attack: 0.03, bend: (t) => 1 - 0.25 * Math.min(1, t / 0.8), seed: 61 },
  );
  const ember = struck(
    [
      [180, 0.3, 0.4],
      [360, 0.22, 0.3],
      [540, 0.12, 0.25],
      [720, 0.06, 0.2],
    ],
    { attack: 0.005, bend: (t) => 1 - 0.1 * t, seed: 62 },
  );
  return [
    render(0.9, 1.6, (t) => {
      hiss.set(4000 - 3100 * Math.min(1, t / 0.7));
      const pop = pops() < 0.004 * fall(t, 0.5) ? (pops() * 2 - 1) * 6 : 0;
      return (
        hiss(hissN()) * rise(t, 0.02) * fall(t, 0.7) * 0.5 + popRing(pop) * 0.8 + ice(t) + ember(t) * 0.7
      );
    }),
    { room: 0.88, damp: 0.2, wet: 0.36 },
  ];
}

/** An honour landing: the yatga run up the pentatonic, D–F♯–A–D, with a glint over the top. */
function honour() {
  const notes = [
    [D5, 0, 0.8],
    [FS5, 0.07, 0.7],
    [A5, 0.14, 0.7],
    [D6, 0.21, 0.9],
  ].map(([f, at, amp], i) => after(at, pluck(f, { amp, t60: 1.1, seed: 71 + i * 2 })));
  const glint = after(0.21, struck(metal([[D6 * 2, 0.1, 0.9]]), { seed: 79 }));
  return [
    render(0.7, 1.6, (t) => notes.reduce((v, n) => v + n(t), 0) + glint(t)),
    { room: 0.84, damp: 0.25, wet: 0.3 },
  ];
}

/** A chest opened, a tier won: a forged strike on the anvil, then the yatga swept bright above it. */
function anvil() {
  const strike = struck(
    metal([
      [612, 1, 0.9],
      [1431, 0.6, 0.7],
      [2216, 0.45, 0.5],
      [2950, 0.3, 0.4],
      [3830, 0.2, 0.3],
      [4870, 0.12, 0.2],
    ]),
    { attack: 0.0008, seed: 81 },
  );
  const hammer = struck(
    [
      [180, 0.4, 0.08],
      [320, 0.3, 0.06],
    ],
    { seed: 82 },
  );
  const n = white(0xa27);
  const clang = biquad('bp', 5000, 0.7);
  const sweep = [D5, A5, D6, FS6, A6].map((f, i) =>
    after(0.09 + i * 0.03, pluck(f, { amp: 0.3, t60: 1.2, seed: 83 + i * 2 })),
  );
  return [
    render(
      1.0,
      1.8,
      (t) =>
        strike(t) * 0.6 + hammer(t) + clang(n()) * fall(t, 0.02) * 0.8 + sweep.reduce((v, p) => v + p(t), 0),
    ),
    { room: 0.86, damp: 0.3, wet: 0.28 },
  ];
}

/**
 * The Square's bell: one strike of a temple bell — hum, prime, minor tierce, quint, nominal and the
 * upper partials, each a beating pair, the low ones outliving the high. The hour, not a melody.
 */
function bell() {
  const prime = 392;
  const strike = struck(
    metal(
      [
        [0.5, 0.5, 3.0],
        [1, 1, 2.5],
        [1.183, 0.6, 2.0],
        [1.506, 0.35, 1.6],
        [2, 0.7, 1.4],
        [2.5, 0.3, 1.0],
        [2.66, 0.25, 0.9],
        [3.01, 0.2, 0.8],
        [4.15, 0.12, 0.5],
        [5.4, 0.08, 0.35],
      ].map(([r, a, t60]) => [prime * r, a, t60]),
      0.8,
    ),
    { attack: 0.001, seed: 91 },
  );
  const n = white(0xbe11);
  const tap = biquad('bp', 2000, 1);
  return [
    render(3.2, 1.5, (t) => strike(t) + tap(n()) * fall(t, 0.015) * 0.5),
    { room: 0.87, damp: 0.3, wet: 0.26 },
  ];
}

// ---------- encode ----------

/** Two passes of a 400 Hz highpass: what a phone speaker actually plays. */
function speakerBand(samples) {
  const a = biquad('hp', 400, Math.SQRT1_2);
  const b = biquad('hp', 400, Math.SQRT1_2);
  return samples.map((s) => b(a(s)));
}

/** Loudness as heard: the loudest 100 ms of the speaker band, RMS. */
function loudness(samples) {
  const heard = speakerBand(samples);
  const w = Math.floor(RATE * 0.1);
  let best = 0;
  for (let i = 0; i < Math.max(1, heard.length - w); i += Math.floor(w / 4)) {
    let sum = 0;
    const end = Math.min(heard.length, i + w);
    for (let j = i; j < end; j++) sum += heard[j] * heard[j];
    best = Math.max(best, Math.sqrt(sum / (end - i)));
  }
  return best;
}

/**
 * Gentle tanh saturation, level-matched: glues the strike to its room and adds the upper harmonics
 * that let a phone sound a low body at all.
 */
function saturate(samples, drive) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (!max) return samples;
  const k = Math.tanh(drive);
  return samples.map((s) => Math.tanh((drive * s) / max) / k);
}

/** Cut where the tail is 60 dB under the peak, then fade the last 30 ms; fade the first 1 ms. */
function trim(samples) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  let end = samples.length;
  while (end > 1 && Math.abs(samples[end - 1]) < max / 1000) end--;
  const out = samples.slice(0, end);
  const fin = Math.min(out.length, Math.floor(0.001 * RATE));
  for (let i = 0; i < fin; i++) out[i] *= i / fin;
  const fout = Math.min(out.length, Math.floor(0.03 * RATE));
  for (let i = 0; i < fout; i++) out[out.length - 1 - i] *= i / fout;
  return out;
}

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // format: PCM
  buf.writeUInt16LE(1, 22); // channels: mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2);
  }
  return buf;
}

/**
 * Speaker-band loudness per sound (see `loudness`), kept from the first set so the balance between
 * moments is unchanged: the tick that fires on every press sits ~15 dB under the bell.
 */
const LOUD = {
  tick: 0.03,
  door: 0.128,
  rise: 0.078,
  seal: 0.17,
  due: 0.114,
  candle: 0.072,
  dying: 0.09,
  honour: 0.157,
  anvil: 0.136,
  bell: 0.175,
};
const PEAK = 0.89;
/** The low bodies take more drive: those harmonics are all a phone speaker can play of them. */
const DRIVE = { door: 3, seal: 2.6, due: 3, candle: 1.2 };

const SOUNDS = { tick, door, rise: roomRise, seal, due, candle, dying, honour, anvil, bell };

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, make] of Object.entries(SOUNDS)) {
  const [dry, room] = make();
  const wet = trim(saturate(reverb(dry, room), DRIVE[name] ?? 0.8));
  let max = 0;
  for (const s of wet) max = Math.max(max, Math.abs(s));
  const g = Math.min(PEAK / max, LOUD[name] / loudness(wet));
  const wav = toWav(wet.map((s) => s * g));
  fs.writeFileSync(path.join(outDir, `${name}.wav`), wav);
  console.log(`${name}.wav  ${(wet.length / RATE).toFixed(2)} s  ${(wav.length / 1024).toFixed(1)} kB`);
}
