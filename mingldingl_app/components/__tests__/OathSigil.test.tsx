import { render } from '@testing-library/react-native';
import OathSigil from '../OathSigil';

describe('OathSigil', () => {
  it('renders nothing when the user has not sworn', () => {
    const { toJSON } = render(<OathSigil oath={null} proven={false} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the sworn state for an unproven oath', () => {
    const { getByText } = render(<OathSigil oath="Bond" proven={false} />);
    expect(getByText('Sworn')).toBeTruthy();
  });

  it('shows the proven state once proven', () => {
    const { getByText } = render(<OathSigil oath="Bond" proven />);
    expect(getByText('Proven')).toBeTruthy();
  });

  it('renders the progress line for a Sworn user when progress is supplied', () => {
    const { getByText } = render(
      <OathSigil oath="Bond" proven={false} progress={{ held: 1, needed: 2 }} />,
    );
    expect(getByText('Held through 1 of 2 encounters')).toBeTruthy();
  });

  it('does not render the progress line once Proven, even if progress is supplied', () => {
    const { queryByText } = render(
      <OathSigil oath="Bond" proven progress={{ held: 2, needed: 2 }} />,
    );
    expect(queryByText(/Held through/)).toBeNull();
  });
});
