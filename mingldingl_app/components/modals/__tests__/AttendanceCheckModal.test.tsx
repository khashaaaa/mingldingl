import { render, fireEvent } from '@testing-library/react-native';
import { AttendanceCheckModal } from '../AttendanceCheckModal';

describe('AttendanceCheckModal', () => {
  it('renders the question with the activity title interpolated', () => {
    const { getByText } = render(
      <AttendanceCheckModal
        visible
        activityTitle="Coffee Date"
        onYes={() => {}}
        onNo={() => {}}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    expect(getByText('Did you meet up for Coffee Date?')).toBeTruthy();
  });

  it('calls onYes when the yes button is pressed', () => {
    const onYes = jest.fn();
    const { getByText } = render(
      <AttendanceCheckModal
        visible
        activityTitle="Coffee Date"
        onYes={onYes}
        onNo={() => {}}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    fireEvent.press(getByText('YES, WE MET'));
    expect(onYes).toHaveBeenCalledTimes(1);
  });

  it('calls onNo when the no button is pressed', () => {
    const onNo = jest.fn();
    const { getByText } = render(
      <AttendanceCheckModal
        visible
        activityTitle="Coffee Date"
        onYes={() => {}}
        onNo={onNo}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    fireEvent.press(getByText("NO, WE DIDN'T"));
    expect(onNo).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <AttendanceCheckModal
        visible={false}
        activityTitle="Coffee Date"
        onYes={() => {}}
        onNo={() => {}}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    expect(queryByText('Did You Meet Up?')).toBeNull();
  });
});
