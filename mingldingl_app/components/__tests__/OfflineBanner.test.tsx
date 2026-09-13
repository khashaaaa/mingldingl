import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '../OfflineBanner';

// FrostEdge hides itself from assistive tech, and RNTL's default queries skip hidden elements.
const HIDDEN = { includeHiddenElements: true };

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const renderBanner = () =>
  render(<SafeAreaProvider initialMetrics={METRICS}><OfflineBanner /></SafeAreaProvider>);

describe('OfflineBanner — the road out', () => {
  it('states the law and keeps the live region for a screen reader', () => {
    const { getByText, UNSAFE_root } = renderBanner();
    expect(getByText(
      'The road is out. What is here stays; nothing new arrives until it returns.',
    )).toBeTruthy();
    const banner = UNSAFE_root.findByProps({ accessibilityLiveRegion: 'polite' });
    expect(banner).toBeTruthy();
  });

  it('draws the frost edge along its lower boundary, hidden from a11y', () => {
    const { getByTestId } = renderBanner();
    const frost = getByTestId('frost-edge-bottom', HIDDEN);
    expect(frost.props.accessible).toBe(false);
  });
});
