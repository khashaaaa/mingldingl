import { render } from '@testing-library/react-native';
import { CandleRow } from '../CandleRow';

describe('CandleRow', () => {
  it('lights the first three of five and leaves the rest spent', () => {
    const { getAllByTestId, getByLabelText } = render(<CandleRow remaining={3} budget={5} />);
    expect(getAllByTestId('candle-lit')).toHaveLength(3);
    expect(getAllByTestId('candle-spent')).toHaveLength(2);
    expect(getByLabelText('3 of 5 candles left')).toBeTruthy();
  });

  it('lights none once the budget is spent', () => {
    const { queryAllByTestId, getAllByTestId, getByLabelText } = render(
      <CandleRow remaining={0} budget={5} />,
    );
    expect(queryAllByTestId('candle-lit')).toHaveLength(0);
    expect(getAllByTestId('candle-spent')).toHaveLength(5);
    expect(getByLabelText('0 of 5 candles left')).toBeTruthy();
  });

  it('is one accessible node — the label carries every fact, the stubs are decorative', () => {
    const { getByTestId } = render(<CandleRow remaining={3} budget={5} />);
    const row = getByTestId('candle-row');
    expect(row.props.accessible).toBe(true);
    expect(row.props.accessibilityLabel).toBe('3 of 5 candles left');
  });

  it('caps the drawn stubs at 16 and folds the rest into a +N', () => {
    const { getAllByTestId, getByText } = render(<CandleRow remaining={5} budget={20} />);
    expect(getAllByTestId('candle-lit').length + getAllByTestId('candle-spent').length).toBe(16);
    expect(getByText('+4')).toBeTruthy();
  });
});
