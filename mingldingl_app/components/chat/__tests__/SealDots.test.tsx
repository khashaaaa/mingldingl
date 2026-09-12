import { render } from '@testing-library/react-native';
import { SealDots, sealsBroken } from '../SealDots';

describe('SealDots', () => {
  it('maps the reveal level to broken seals: level 1 breaks none, level 4 breaks all', () => {
    expect(sealsBroken(undefined)).toBe(0);
    expect(sealsBroken(1)).toBe(0);
    expect(sealsBroken(2)).toBe(1);
    expect(sealsBroken(4)).toBe(3);
    expect(sealsBroken(9)).toBe(3);
  });
  it('draws three seals, the broken ones first, and says how many are broken', () => {
    const { getAllByTestId, getByLabelText } = render(<SealDots broken={2} />);
    expect(getAllByTestId('seal-dot-broken')).toHaveLength(2);
    expect(getAllByTestId('seal-dot-intact')).toHaveLength(1);
    expect(getByLabelText('Two of three seals broken')).toBeTruthy();
  });
});
