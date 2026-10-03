import { Image, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { TEMPERATURE } from '../../lib/theme';

/**
 * Frost, as an edge: a crust of rime along the boundary with icicles hanging off it, reused
 * wherever a screen needs to say silence rather than describe it — a thread gone quiet, the shut
 * gate, the offline strip, the hearth's window at the White Moon, a meeting not kept.
 *
 * It was three zigzag polylines in SVG, which read as curly lines rather than as ice. Now it is
 * inked with the glyphs' brush and baked (`scripts/gen-ice.js`): one tile for a top edge and one
 * transposed for a left edge, flipped for the other two, repeated along the edge at a size set by
 * `length`. Three tinted layers — the ice body translucent in `ice`, the brushed edges in
 * `glacier`, the shine in `rime` — so the frost stays in the temperature tokens.
 *
 * `pointerEvents="none"` and absolute positioning are left to the parent, the same contract
 * `TorchGlow` and `Places`' `Cut` follow: this component only answers "what does frost look like,"
 * never "where does it sit."
 */

export type FrostEdgeEdge = 'top' | 'bottom' | 'left' | 'right';

/** The reach for a rim along a row or banner — a top/bottom mount with content close beneath it
 *  (a header, a strip, a banner). The default 96 below is for a screen edge with room to spare
 *  underneath; at that depth a rim mount draws straight through whatever it sits above. */
export const FROST_RIM_REACH = 24;

interface Props {
  edge: FrostEdgeEdge;
  /** How far the crystal reaches in from the edge, in px. */
  length?: number;
  /** 0..1 scale on the whole drawing, for a caller that wants the frost to fade rather than snap. */
  opacity?: number;
}

/** Along-the-edge over into-the-screen, of one baked tile. */
const TILE_ASPECT = 3;

type Layer = 'fill' | 'ink' | 'shine';

const ALONG: Record<Layer, ImageSourcePropType> = {
  fill: require('../../assets/ice/rim-fill.png'),
  ink: require('../../assets/ice/rim-ink.png'),
  shine: require('../../assets/ice/rim-shine.png'),
};
const DOWN: Record<Layer, ImageSourcePropType> = {
  fill: require('../../assets/ice/rim-v-fill.png'),
  ink: require('../../assets/ice/rim-v-ink.png'),
  shine: require('../../assets/ice/rim-v-shine.png'),
};

/** How each layer is tinted and how strongly. The body is see-through: it is ice, not paint. */
export const FROST_LAYERS: readonly { layer: Layer; color: string; alpha: number }[] = [
  { layer: 'fill', color: TEMPERATURE.ice, alpha: 0.35 },
  { layer: 'ink', color: TEMPERATURE.glacier, alpha: 0.95 },
  { layer: 'shine', color: TEMPERATURE.rime, alpha: 0.9 },
];

const FLIP: Record<FrostEdgeEdge, object | null> = {
  top: null,
  bottom: { transform: [{ scaleY: -1 }] },
  left: null,
  right: { transform: [{ scaleX: -1 }] },
};

export function FrostEdge({ edge, length = 96, opacity = 1 }: Props) {
  const window = useWindowDimensions();
  const alongEdge = edge === 'top' || edge === 'bottom';
  const tile = length * TILE_ASPECT;
  // Enough tiles to cross the longest the edge can be; the box clips the spare.
  const count = Math.ceil((alongEdge ? window.width : window.height) / tile) + 1;
  const sources = alongEdge ? ALONG : DOWN;
  const tileStyle = alongEdge ? { width: tile, height: length } : { width: length, height: tile };

  return (
    <View
      testID={`frost-edge-${edge}`}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[alongEdge ? { width: '100%', height: length } : { width: length, height: '100%' }, styles.clip, FLIP[edge]]}
    >
      {FROST_LAYERS.map(({ layer, color, alpha }) => (
        <View key={layer} style={[StyleSheet.absoluteFill, alongEdge ? styles.row : styles.column]}>
          {Array.from({ length: count }, (_, i) => (
            <Image
              key={i}
              source={sources[layer]}
              resizeMode="stretch"
              style={[tileStyle, { tintColor: color, opacity: alpha * opacity }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
});
