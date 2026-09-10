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
  it('shows the icebreaker text, round number, and countdown', () => {
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={2} secondsLeft={90}
        hasResponded={false} matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText('Favorite trip?')).toBeTruthy();
    expect(getByText(/2/)).toBeTruthy();
    expect(getByText(/1:30|90/)).toBeTruthy();
  });

  it('calls onRespond("Yes") when the Yes button is pressed', () => {
    const onRespond = jest.fn();
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded={false} matchId={null} isResponding={false} onRespond={onRespond} />,
    );
    fireEvent.press(getByText(/^Yes$/i));
    expect(onRespond).toHaveBeenCalledWith('Yes');
  });

  it('calls onRespond("No") when the No button is pressed', () => {
    const onRespond = jest.fn();
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded={false} matchId={null} isResponding={false} onRespond={onRespond} />,
    );
    fireEvent.press(getByText(/^No$/i));
    expect(onRespond).toHaveBeenCalledWith('No');
  });

  it('hides the Yes/No buttons and shows a waiting message once responded', () => {
    const { queryByText, getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    expect(queryByText(/^Yes$/i)).toBeNull();
    expect(queryByText(/^No$/i)).toBeNull();
    expect(getByText(/Waiting/i)).toBeTruthy();
  });

  it('shows a match message instead of the waiting message once matched', () => {
    const { getByText, queryByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded matchId="m1" isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText(/Match/i)).toBeTruthy();
    // The round's own waiting line, matched exactly: the match message carries the word "waiting"
    // too, in the sentence saying where the match went.
    expect(queryByText('Waiting for the round to end…')).toBeNull();
  });

  it('says where a mid-round match went, rather than stopping at "It\'s a Match!"', () => {
    // Deliberately not a link — tapping it would end the call and forfeit the remaining rounds —
    // so it has to name the place the match can actually be found instead.
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded matchId="m1" isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText('They will be waiting in your Quest Log when the square closes.')).toBeTruthy();
  });

  it('locks both answers while a response is in flight', () => {
    const onRespond = jest.fn();
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Q" roundNumber={1} secondsLeft={30} hasResponded={false}
        matchId={null} isResponding onRespond={onRespond} />,
    );
    fireEvent.press(getByText('Yes'));
    fireEvent.press(getByText('No'));
    expect(onRespond).not.toHaveBeenCalled();
  });

  // The controls bar is laid out from the safe-area bottom; this card used to sit at a fixed 100,
  // which put the Yes/No row underneath the mic and hang-up buttons on any device with a
  // navigation bar.
  it('sits clear of the call controls above the safe-area bottom', () => {
    const { getByText } = renderPrompt(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded={false} matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    const wrap = getByText('Favorite trip?').parent!.parent!;
    const bottom = StyleSheet.flatten(wrap.props.style).bottom;
    expect(bottom).toBeGreaterThanOrEqual(
      METRICS.insets.bottom + VIDEO_CONTROLS_BOTTOM + VIDEO_CONTROLS_SIZE,
    );
  });
});
