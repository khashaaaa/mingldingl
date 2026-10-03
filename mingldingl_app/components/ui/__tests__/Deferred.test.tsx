import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Deferred } from '../Deferred';

describe('Deferred', () => {
  it('shows its children (tests have no frames to wait for, so it mounts at once)', () => {
    const { getByText } = render(<Deferred stage={3}><Text>below the fold</Text></Deferred>);
    expect(getByText('below the fold')).toBeTruthy();
  });
});
