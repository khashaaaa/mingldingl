import type { ImageSourcePropType } from 'react-native';

/**
 * The riveted metal baked by `scripts/gen-metal.js`, in points. Each bake is drawn at 3× these
 * sizes (the strongbox on a 144 grid, scaled 1.5×), so keep them in step with the script's own
 * constants. None of these images carries a colour: a plate's metal is the fill under it, and a
 * silhouette (`*-body`, `*-wood`, `*-iron`) is a white mask the caller tints.
 */
export const PLATE = { width: 160, height: 48, cap: 14 } as const;
export const GRAIN = { width: 440, height: 200 } as const;
export const STRAP = { width: 240, height: 18 } as const;
export const BOX = 72;
export const SEAL = 32;

export type PlateFinish = 'worn' | 'fine';

export const METAL_IMAGES = {
  plate: {
    worn: require('../../assets/metal/plate-worn.png'),
    fine: require('../../assets/metal/plate-fine.png'),
  } satisfies Record<PlateFinish, ImageSourcePropType>,
  grain: [
    require('../../assets/metal/grain-0.png'),
    require('../../assets/metal/grain-1.png'),
    require('../../assets/metal/grain-2.png'),
  ] as ImageSourcePropType[],
  strap: require('../../assets/metal/strap.png') as ImageSourcePropType,
  box: {
    body: {
      wood: require('../../assets/metal/box-body-wood.png') as ImageSourcePropType,
      iron: require('../../assets/metal/box-body-iron.png') as ImageSourcePropType,
      detail: require('../../assets/metal/box-body-detail.png') as ImageSourcePropType,
    },
    lid: {
      wood: require('../../assets/metal/box-lid-wood.png') as ImageSourcePropType,
      iron: require('../../assets/metal/box-lid-iron.png') as ImageSourcePropType,
      detail: require('../../assets/metal/box-lid-detail.png') as ImageSourcePropType,
    },
  },
  seal: {
    body: require('../../assets/metal/seal-body.png') as ImageSourcePropType,
    detail: require('../../assets/metal/seal-detail.png') as ImageSourcePropType,
  },
};

/** A stable grain for a given key, so the same plate shows the same scratches on every render. */
export function grainFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % METAL_IMAGES.grain.length;
}
