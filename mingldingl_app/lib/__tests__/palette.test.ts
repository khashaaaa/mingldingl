import fs from 'fs';
import path from 'path';
import {
  ACCENT, COLORS, GEM_COLORS, GEM_SHADES, INK, LINE, STATUS, STATUS_SOFT, SURFACE, TIER_PRESENCE,
} from '../theme';
import { TIER_ORDER } from '../tiers';

/**
 * The palette's guarantees, as arithmetic rather than as good intentions.
 *
 * Every value in `theme.ts` was at some point chosen by eye, and three of them were wrong in ways
 * nobody could see by looking: a tier ladder whose brightness contradicted its own rank, a border
 * under the contrast floor on all 36 of its uses, and a status family that did not exist. These
 * tests are what stop each from coming back.
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((v >> 16) & 0xff) +
    0.7152 * channel((v >> 8) & 0xff) +
    0.0722 * channel(v & 0xff)
  );
}

/** WCAG 2.1 contrast ratio. 4.5 is the floor for body text, 3.0 for a UI boundary. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Hue in degrees, for checking that two roles can be told apart by colour and not only by luck. */
function hue(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 0xff) / 255, g = ((v >> 8) & 0xff) / 255, b = (v & 0xff) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** HSL saturation. Garnet and Ruby are both red stones; saturation is what tells them apart. */
function saturation(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 0xff) / 255, g = ((v >> 8) & 0xff) / 255, b = (v & 0xff) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}

describe('gem tiers', () => {
  it('keeps every jewel readable — the old Sapphire and Garnet were not', () => {
    for (const [tier, jewel] of Object.entries(GEM_COLORS)) {
      expect({ tier, ratio: contrast(jewel, SURFACE.panel) })
        .toEqual({ tier, ratio: expect.any(Number) });
      expect(contrast(jewel, SURFACE.panel)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stops any one tier from outshining the ladder', () => {
    for (const jewel of Object.values(GEM_COLORS)) {
      expect(contrast(jewel, SURFACE.panel)).toBeLessThanOrEqual(8.1);
    }
  });

  it('keeps the six stones tellable apart — by hue, or where both are red, by saturation', () => {
    const names = Object.keys(GEM_COLORS) as (keyof typeof GEM_COLORS)[];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = GEM_COLORS[names[i]], b = GEM_COLORS[names[j]];
        const separated = hueGap(a, b) > 20 || Math.abs(saturation(a) - saturation(b)) > 0.4;
        expect({ pair: `${names[i]}/${names[j]}`, separated })
          .toEqual({ pair: `${names[i]}/${names[j]}`, separated: true });
      }
    }
  });

  it('gives every tier a shade darker than its own jewel', () => {
    for (const tier of TIER_ORDER) {
      expect(luminance(GEM_SHADES[tier])).toBeLessThan(luminance(GEM_COLORS[tier]));
    }
  });

  it('carries rank in presence, monotonically, since the jewel no longer does', () => {
    const ramp = TIER_ORDER.map((t) => TIER_PRESENCE[t]);
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].glow).toBeGreaterThan(ramp[i - 1].glow);
      expect(ramp[i].ring).toBeGreaterThanOrEqual(ramp[i - 1].ring);
    }
    expect(TIER_PRESENCE[TIER_ORDER[TIER_ORDER.length - 1]].glow)
      .toBeGreaterThan(TIER_PRESENCE[TIER_ORDER[0]].glow);
  });

  it('covers every tier in the ladder — a new tier cannot ship uncoloured', () => {
    for (const tier of TIER_ORDER) {
      expect(GEM_COLORS[tier]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(GEM_SHADES[tier]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(TIER_PRESENCE[tier]).toBeDefined();
    }
  });
});

describe('ink on surfaces', () => {
  it('reads as body text on every surface it can land on', () => {
    for (const surface of Object.values(SURFACE)) {
      expect(contrast(INK.primary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(INK.dim, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('flips to dark ink on an accent fill, where light ink would vanish', () => {
    expect(contrast(INK.onAccent, ACCENT.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK.primary, ACCENT.base)).toBeLessThan(4.5);
  });
});

describe('muted marks', () => {
  it('stays perceivable where bronze did not', () => {
    for (const surface of Object.values(SURFACE)) {
      expect(contrast(INK.muted, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('stays quieter than primary ink, which is the whole point of it', () => {
    expect(contrast(INK.muted, SURFACE.panel))
      .toBeLessThan(contrast(INK.primary, SURFACE.panel));
  });
});

describe('the pigment layer stays private', () => {
  /**
   * `COLORS.bronze` sat under the contrast floor on all 36 of its border uses and on twelve
   * empty-state icons. It has been replaced by `LINE.edge` and `INK.muted`. This test is what
   * stops the next person from reaching past the roles and picking the broken pigment again.
   */
  it('nothing outside the theme reaches for the retired bronze pigment', () => {
    const root = path.resolve(__dirname, '../..');
    const skip = new Set(['node_modules', '.expo', 'android', 'ios', 'dist', '.git']);
    const offenders: string[] = [];

    (function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(entry.name)) continue;
        const rel = path.relative(root, full);
        if (rel === path.join('lib', 'theme.ts') || rel.includes('__tests__')) continue;
        if (/\bCOLORS\.bronze\b/.test(fs.readFileSync(full, 'utf8'))) offenders.push(rel);
      }
    })(root);

    expect(offenders).toEqual([]);
  });
});

describe('lines', () => {
  it('clears the 3:1 a UI boundary needs — bronze at 2.60 did not', () => {
    expect(contrast(LINE.edge, SURFACE.panel)).toBeGreaterThanOrEqual(3);
    expect(contrast(COLORS.bronze, SURFACE.panel)).toBeLessThan(3);
  });

  it('climbs from decorative to selected', () => {
    expect(luminance(LINE.hairline)).toBeLessThan(luminance(LINE.edge));
    expect(luminance(LINE.edge)).toBeLessThan(luminance(LINE.strong));
  });
});

describe('status', () => {
  it('reads as body text on panel', () => {
    for (const colour of Object.values(STATUS)) {
      expect(contrast(colour, SURFACE.panel)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps danger, success and info clear of the accent and of each other', () => {
    const distinct = { success: STATUS.success, danger: STATUS.danger, info: STATUS.info };
    for (const colour of Object.values(distinct)) {
      expect(hueGap(colour, ACCENT.base)).toBeGreaterThan(25);
    }
    const vals = Object.values(distinct);
    for (let i = 0; i < vals.length; i++) {
      for (let j = i + 1; j < vals.length; j++) {
        expect(hueGap(vals[i], vals[j])).toBeGreaterThan(25);
      }
    }
  });

  it('documents the one collision instead of pretending it is solved', () => {
    // `warning` cannot separate from an orange accent by hue. It separates by lightness, which is
    // why it may only ever appear as a filled banner with an icon. If this ever passes on hue,
    // the accent moved off orange and the banner-only rule can be relaxed.
    expect(hueGap(STATUS.warning, ACCENT.base)).toBeLessThan(25);
    expect(contrast(STATUS.warning, ACCENT.base)).toBeGreaterThan(1.5);
  });

  it('shares its green with the Emerald tier on purpose', () => {
    expect(STATUS.success).toBe(GEM_COLORS.Emerald);
  });

  it('gives every status a soft fill', () => {
    for (const key of Object.keys(STATUS) as (keyof typeof STATUS)[]) {
      expect(STATUS_SOFT[key]).toMatch(/^rgba\(/);
    }
  });
});
