import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RoundPrompt } from '../RoundPrompt';
import { VIDEO_CONTROLS_BOTTOM, VIDEO_CONTROLS_SIZE } from '../../video/VideoControls';

// The prompt is positioned off the safe-area bottom so it clears the call controls.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const renderPrompt = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

describe('RoundPrompt', () => {
  it('shows the eyebrow, the icebreaker text and the helper line before answering', () => {
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded={false} matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    // `CardEyebrow` uppercases its own text; matched case-insensitively for that reason.
    expect(getByText(/the question at the bell/i)).toBeTruthy();
    expect(getByText('Favorite trip?')).toBeTruthy();
    expect(getByText('Then the bell. Decide.')).toBeTruthy();
  });

  it('calls onRespond("Yes") when the Light It button is pressed', () => {
    const onRespond = jest.fn();
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded={false} matchId={null} isResponding={false} onRespond={onRespond} />,
    );
    fireEvent.press(getByText(/^Light it$/i));
    expect(onRespond).toHaveBeenCalledWith('Yes');
  });

  it('calls onRespond("No") when the Let pass button is pressed', () => {
    const onRespond = jest.fn();
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded={false} matchId={null} isResponding={false} onRespond={onRespond} />,
    );
    fireEvent.press(getByText(/^Let pass$/i));
    expect(onRespond).toHaveBeenCalledWith('No');
  });

  it('hides the Light It/Let pass buttons and shows a waiting message once responded', () => {
    const { queryByText, getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    expect(queryByText(/^Light it$/i)).toBeNull();
    expect(queryByText(/^Let pass$/i)).toBeNull();
    expect(getByText('Your answer is kept until the bell.')).toBeTruthy();
  });

  it('shows a match message instead of the waiting message once matched', () => {
    const { getByText, queryByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded matchId="m1" isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText('Lantern lit from both sides.')).toBeTruthy();
    // The round's own waiting line, matched exactly: it must not still be showing beside the
    // match text once a lantern has actually lit.
    expect(queryByText('Your answer is kept until the bell.')).toBeNull();
  });

  it('says where a mid-round match went, rather than stopping at the lit lantern alone', () => {
    // Deliberately not a link — tapping it would end the call and forfeit the remaining rounds —
    // so it has to name the place the match can actually be found instead.
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded matchId="m1" isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText('They will be waiting in your Quest Log when the square closes.')).toBeTruthy();
  });

  it('locks both answers while a response is in flight', () => {
    const onRespond = jest.fn();
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Q" hasResponded={false}
        matchId={null} isResponding onRespond={onRespond} />,
    );
    // `GameButton` uppercases a metal (forged) label, so "Light it" renders as "LIGHT IT" —
    // matched case-insensitively for that reason, same as the press tests above.
    fireEvent.press(getByText(/^Light it$/i));
    fireEvent.press(getByText(/^Let pass$/i));
    expect(onRespond).not.toHaveBeenCalled();
  });

  // The controls bar is laid out from the safe-area bottom; this card used to sit at a fixed 100,
  // which put the Yes/No row underneath the mic and hang-up buttons on any device with a
  // navigation bar.
  it('sits clear of the call controls above the safe-area bottom', () => {
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?"
        hasResponded={false} matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    const wrap = getByText('Favorite trip?').parent!.parent!;
    const bottom = StyleSheet.flatten(wrap.props.style).bottom;
    expect(bottom).toBeGreaterThanOrEqual(
      METRICS.insets.bottom + VIDEO_CONTROLS_BOTTOM + VIDEO_CONTROLS_SIZE,
    );
  });
});
