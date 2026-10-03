import { StyleSheet, View } from 'react-native';
import { Glyph, type GlyphName } from './Glyph';
import { GLYPH_GROUNDS } from './glyphImages';
import { HEAT, ICON_SIZES, INK, METAL } from '../../lib/theme';

/**
 * The drawings the three states are made of: a place for an empty screen, an ember for a wrong
 * one. The forms are the board in `docs/design/sealed-fire/boards/States.dc.html`.
 *
 * An empty screen used to draw a stock icon of the *concept* — a crossed-out wifi bar, a circled
 * exclamation mark — which is a status light, not a scene. A place drawn as a place says the
 * same thing without a sentence: the gate is shut, the hearth is cold, the stage is bare. The
 * wrong state is the ember: warm, never the red of a dialog box, because nothing here has
 * crashed — a message did not reach the scribe.
 *
 * Drawn in `Glyph`'s own ink and baked with it (`scripts/gen-glyphs.js`), so a place standing
 * beside a glyph is plainly the same brush. Each place's ground is baked as a second layer and
 * tinted brass beneath it — what the thing stands on, not the thing.
 */

/** Every drawing in the set, so a test can walk all of them. */
export const PLACE_NAMES = [
  'gate', 'empty-stage', 'signpost', 'calendar-page', 'letter', 'empty-chair', 'moon', 'lantern',
  'door', 'ember',
] as const;

export type PlaceName = typeof PLACE_NAMES[number];

interface PlaceProps {
  size?: number;
  color?: string;
}

type PlaceDrawing = (props: PlaceProps) => React.JSX.Element;

/**
 * One place: its ink in the block's tone, standing on its ground in brass. Decorative by
 * construction — the block's title is what carries the meaning, and an unlabelled `Glyph` already
 * leaves the accessibility tree.
 */
function Place({ name, testID, size = ICON_SIZES.hero, color = INK.muted }: {
  name: GlyphName;
  testID: string;
} & PlaceProps) {
  const grounded = name in GLYPH_GROUNDS;
  return (
    <View testID={testID} style={{ width: size, height: size }}>
      {grounded && (
        <Glyph name={name} ground size={size} color={METAL.brassDeep} style={StyleSheet.absoluteFill} />
      )}
      <Glyph name={name} size={size} color={color} />
    </View>
  );
}

/** The glyph each place is drawn with: the place names stayed, the drawings moved into `Glyph`. */
const DRAWN: Record<PlaceName, GlyphName> = {
  gate: 'gate',
  'empty-stage': 'stage',
  signpost: 'signpost',
  'calendar-page': 'page',
  // Nothing said yet: the letter still folded, its seal unbroken.
  letter: 'letters',
  'empty-chair': 'chair',
  moon: 'night',
  // Nobody gathered: the lantern is lit and carried, and there is no one at the square.
  lantern: 'lantern',
  door: 'door',
  ember: 'ember',
};

const TEST_IDS: Record<PlaceName, string> = {
  gate: 'state-place-gate', 'empty-stage': 'state-place-empty-stage', signpost: 'state-place-signpost',
  'calendar-page': 'state-place-calendar-page', letter: 'state-place-letter',
  'empty-chair': 'state-place-empty-chair', moon: 'state-place-moon', lantern: 'state-place-lantern',
  door: 'state-place-door', ember: 'state-ember',
};

function drawing(place: PlaceName): PlaceDrawing {
  // The wrong state glows warm by default; every other place takes the block's quiet ink.
  const fallback = place === 'ember' ? HEAT.flame : INK.muted;
  return function Drawn({ size, color = fallback }: PlaceProps) {
    return <Place name={DRAWN[place]} testID={TEST_IDS[place]} size={size} color={color} />;
  };
}

export const PLACES = Object.fromEntries(PLACE_NAMES.map((p) => [p, drawing(p)])) as Record<PlaceName, PlaceDrawing>;
