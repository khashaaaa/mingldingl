import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { NameAgeStep } from '../NameAgeStep';
import { PhotosStep } from '../PhotosStep';
import tamaguiConfig from '../../../tamagui.config';

jest.mock('../../PhotoGrid', () => ({ PhotoGrid: () => null }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function wrap(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">{ui}</TamaguiProvider>
    </SafeAreaProvider>,
  );
}

describe('NameAgeStep age validation', () => {
  function renderStep(onNext = jest.fn()) {
    const view = wrap(
      <NameAgeStep initialName="Bat" initialAge={0} initialGender="Male" onNext={onNext} />,
    );
    return { ...view, onNext };
  }

  it('refuses an age below the engine minimum and says why', () => {
    const { getByPlaceholderText, getByText, onNext } = renderStep();
    fireEvent.changeText(getByPlaceholderText(/age/i), '15');

    expect(getByText(/between 18 and 99/i)).toBeTruthy();
    fireEvent.press(getByText(/^NEXT$/i));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows no error for an in-range age', () => {
    const { getByPlaceholderText, queryByText } = renderStep();
    fireEvent.changeText(getByPlaceholderText(/age/i), '99');
    expect(queryByText(/between 18 and 99/i)).toBeNull();
  });

  it('accepts an in-range age and passes it on as a number', () => {
    const { getByPlaceholderText, getByText, onNext } = renderStep();
    fireEvent.changeText(getByPlaceholderText(/age/i), '27');
    fireEvent.press(getByText(/^NEXT$/i));
    expect(onNext).toHaveBeenCalledWith('Bat', 27, 'Male');
  });
});

describe('PhotosStep', () => {
  it('enables Next once three photos are present', () => {
    const onNext = jest.fn();
    const { getByText } = wrap(
      <PhotosStep photoUrls={['a', 'b', 'c']} onPhotosChange={jest.fn()}
        referralCode="" onReferralCodeChange={jest.fn()} onNext={onNext} onBack={jest.fn()} />,
    );
    fireEvent.press(getByText(/^NEXT$/i));
    expect(onNext).toHaveBeenCalled();
  });

  it('keeps Next disabled below the three-photo minimum', () => {
    const onNext = jest.fn();
    const { getByText } = wrap(
      <PhotosStep photoUrls={['a', 'b']} onPhotosChange={jest.fn()}
        referralCode="" onReferralCodeChange={jest.fn()} onNext={onNext} onBack={jest.fn()} />,
    );
    fireEvent.press(getByText(/^NEXT$/i));
    expect(onNext).not.toHaveBeenCalled();
  });
});
