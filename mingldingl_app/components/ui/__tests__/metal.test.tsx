import fs from 'fs';
import path from 'path';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MetalPlate } from '../MetalPlate';
import { Strongbox } from '../Strongbox';
import { GameButton } from '../GameButton';
import { METAL_IMAGES, PLATE, grainFor } from '../metal';

const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });

describe('metal', () => {
  it('has every bake gen-metal.js writes on disk', () => {
    const dir = path.join(__dirname, '../../../assets/metal');
    const names = ['plate-worn', 'plate-fine', 'grain-0', 'grain-1', 'grain-2', 'strap',
      'box-body-wood', 'box-body-iron', 'box-body-detail', 'box-lid-wood', 'box-lid-iron', 'box-lid-detail', 'seal-body', 'seal-detail'];
    for (const n of names) expect(fs.existsSync(path.join(dir, `${n}.png`))).toBe(true);
  });

  it('picks the same grain for the same key, always in range', () => {
    expect(grainFor('Summon')).toBe(grainFor('Summon'));
    for (const k of ['a', 'Take bounty', 'Gold', '']) {
      expect(grainFor(k)).toBeGreaterThanOrEqual(0);
      expect(grainFor(k)).toBeLessThan(METAL_IMAGES.grain.length);
    }
  });

  describe('MetalPlate', () => {
    it('lays a nine-slice whose corners keep their size and whose middle stretches', () => {
      const { getByTestId, UNSAFE_getAllByType } = render(<MetalPlate />);
      fireEvent(getByTestId('metal-plate'), 'layout', layout(320, 100));
      const { Image } = require('react-native');
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs).toHaveLength(9);
      const sizes = imgs.map((i: { props: { style: object } }) => StyleSheet.flatten(i.props.style) as { width: number });
      // Top-left corner: the bake at its own size.
      expect(sizes[0]).toMatchObject({ width: PLATE.width, height: PLATE.height, left: 0, top: 0 });
      // Centre: stretched both ways so the bake's middle band fills the box's middle.
      const sx = (320 - 2 * PLATE.cap) / (PLATE.width - 2 * PLATE.cap);
      expect(sizes[4].width).toBeCloseTo(PLATE.width * sx);
    });

    it('presses a seal only when given a colour', () => {
      const { getByTestId, UNSAFE_getAllByType, rerender } = render(<MetalPlate />);
      fireEvent(getByTestId('metal-plate'), 'layout', layout(200, 80));
      const { Image } = require('react-native');
      expect(UNSAFE_getAllByType(Image)).toHaveLength(9);
      rerender(<MetalPlate seal="#a00" />);
      expect(UNSAFE_getAllByType(Image)).toHaveLength(11);
    });
  });

  it('riveted the forged button, never the ink one or cold metal', () => {
    expect(render(<GameButton onPress={jest.fn()}>Go</GameButton>).queryByTestId('metal-plate')).toBeTruthy();
    expect(render(<GameButton variant="ink" onPress={jest.fn()}>Go</GameButton>).queryByTestId('metal-plate')).toBeNull();
    expect(render(<GameButton disabled onPress={jest.fn()}>Go</GameButton>).queryByTestId('metal-plate')).toBeNull();
  });

  it('opens the strongbox', () => {
    const { getByTestId, rerender } = render(<Strongbox open={false} />);
    expect(getByTestId('strongbox-shut')).toBeTruthy();
    rerender(<Strongbox open />);
    expect(getByTestId('strongbox-open')).toBeTruthy();
  });
});
