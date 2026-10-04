import { render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { GemTierBadge } from '../GemTierBadge';
import { GEM_IMAGES } from '../gemImages';

jest.mock('../../../lib/vfx', () => ({ motionAllowed: () => true, useVfxLevel: () => 'full' }));
jest.mock('../../vfx/TorchGlow', () => ({ TorchGlow: ({ children }: { children: React.ReactNode }) => children }));

const sources = (tree: ReturnType<typeof render>) =>
  tree.UNSAFE_queryAllByType(Image).map((i) => i.props.source);

describe('GemTierBadge', () => {
  it('shows the painted still in a row', () => {
    const tree = render(<GemTierBadge tier="Ruby" size={28} />);
    expect(Object.values(GEM_IMAGES.Ruby.still)).toContain(sources(tree)[0]);
  });

  it('sways a burning hero stone from its sheet instead', () => {
    const tree = render(<GemTierBadge tier="Emerald" size={44} glow />);
    const all = sources(tree);
    expect(all).toHaveLength(1);
    expect(Object.values(GEM_IMAGES.Emerald.sway)).toContain(all[0]);
  });

  it('sinks a dimmed stone under its own silhouette and never sways it', () => {
    const tree = render(<GemTierBadge tier="Sapphire" size={44} glow dim />);
    const images = tree.UNSAFE_queryAllByType(Image);
    expect(images).toHaveLength(2);
    expect(Object.values(GEM_IMAGES.Sapphire.still)).toContain(images[1].props.source);
  });

  it('falls back to the bottom stone for a tier it has never heard of', () => {
    const tree = render(<GemTierBadge tier="Kryptonite" size={20} />);
    expect(Object.values(GEM_IMAGES.Garnet.still)).toContain(sources(tree)[0]);
  });
});
