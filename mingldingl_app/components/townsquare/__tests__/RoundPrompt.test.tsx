import { render, fireEvent } from '@testing-library/react-native';
import { RoundPrompt } from '../RoundPrompt';

describe('RoundPrompt', () => {
  it('shows the icebreaker text, round number, and countdown', () => {
    const { getByText } = render(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={2} secondsLeft={90}
        hasResponded={false} matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText('Favorite trip?')).toBeTruthy();
    expect(getByText(/2/)).toBeTruthy();
    expect(getByText(/1:30|90/)).toBeTruthy();
  });

  it('calls onRespond("Yes") when the Yes button is pressed', () => {
    const onRespond = jest.fn();
    const { getByText } = render(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded={false} matchId={null} isResponding={false} onRespond={onRespond} />,
    );
    fireEvent.press(getByText(/^Yes$/i));
    expect(onRespond).toHaveBeenCalledWith('Yes');
  });

  it('calls onRespond("No") when the No button is pressed', () => {
    const onRespond = jest.fn();
    const { getByText } = render(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded={false} matchId={null} isResponding={false} onRespond={onRespond} />,
    );
    fireEvent.press(getByText(/^No$/i));
    expect(onRespond).toHaveBeenCalledWith('No');
  });

  it('hides the Yes/No buttons and shows a waiting message once responded', () => {
    const { queryByText, getByText } = render(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded matchId={null} isResponding={false} onRespond={jest.fn()} />,
    );
    expect(queryByText(/^Yes$/i)).toBeNull();
    expect(queryByText(/^No$/i)).toBeNull();
    expect(getByText(/Waiting/i)).toBeTruthy();
  });

  it('shows a match message instead of the waiting message once matched', () => {
    const { getByText, queryByText } = render(
      <RoundPrompt icebreakerText="Favorite trip?" roundNumber={1} secondsLeft={60}
        hasResponded matchId="m1" isResponding={false} onRespond={jest.fn()} />,
    );
    expect(getByText(/Match/i)).toBeTruthy();
    expect(queryByText(/Waiting/i)).toBeNull();
  });

  it('locks both answers while a response is in flight', () => {
    const onRespond = jest.fn();
    const { getByText } = render(
      <RoundPrompt icebreakerText="Q" roundNumber={1} secondsLeft={30} hasResponded={false}
        matchId={null} isResponding onRespond={onRespond} />,
    );
    fireEvent.press(getByText('Yes'));
    fireEvent.press(getByText('No'));
    expect(onRespond).not.toHaveBeenCalled();
  });
});
