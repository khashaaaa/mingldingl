import { View } from 'react-native';
import type { ArtName } from '../art/manifest';
import { Art } from './Art';

const FASTENERS = {
  rivet: 'rivet',
  screwA: 'screw_a',
  screwB: 'screw_b',
  screwC: 'screw_c',
  screwD: 'screw_d',
} as const satisfies Record<string, ArtName>;

/** Brass where two things join: a rivet or one of four screw turns (varied so no neighbours align). */
export function Fastener({ kind = 'rivet', size = 14 }: { kind?: keyof typeof FASTENERS; size?: number }) {
  return <Art name={FASTENERS[kind]} style={{ width: size, height: size }} />;
}

const CAPS = [
  ['corner_tl', { top: -2, left: -2 }],
  ['corner_tr', { top: -2, right: -2 }],
  ['corner_bl', { bottom: -2, left: -2 }],
  ['corner_br', { bottom: -2, right: -2 }],
] as const;

/** Four brass corners, each lit separately — on the Dialog and a selected Choice Card. */
export function CornerCaps() {
  return (
    <>
      {CAPS.map(([name, pos]) => (
        <View
          key={name}
          testID="corner-cap"
          pointerEvents="none"
          style={{ position: 'absolute', width: 24, height: 24, ...pos }}
        >
          <Art name={name} style={{ width: 24, height: 24 }} />
        </View>
      ))}
    </>
  );
}

export function DrawerPull() {
  return (
    <View
      testID="drawer-pull"
      pointerEvents="none"
      style={{ position: 'absolute', top: 7, alignSelf: 'center' }}
    >
      <Art name="drawer_pull" style={{ width: 48, height: 18 }} />
    </View>
  );
}
