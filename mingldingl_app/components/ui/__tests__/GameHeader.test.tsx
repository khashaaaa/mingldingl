import { render, fireEvent } from '@testing-library/react-native';
import { GameHeader } from '../GameHeader';

const mockGo = jest.fn();
let mockScore: object | undefined = { totalScore: 880, gemTier: 'Sapphire', currentStreak: 0 };
jest.mock('../../../hooks/useGoTo', () => ({ useGoTo: () => mockGo }));
jest.mock('../../../hooks/useScoreDetail', () => ({
  useScoreDetail: () => ({ data: mockScore }),
}));
jest.mock('expo-router', () => require('../../../lib/testing/expoRouterMock').expoRouterMock());

describe('GameHeader points badge', () => {
  beforeEach(() => mockGo.mockClear());

  it('opens The Ascent when tapped', () => {
    const { getByTestId } = render(<GameHeader title="Seek" />);
    fireEvent.press(getByTestId('score-hud-link'));
    expect(mockGo).toHaveBeenCalledWith('/progression');
  });

  it('is read aloud as a link with the score in it', () => {
    const link = render(<GameHeader title="Seek" />).getByTestId('score-hud-link');
    expect(link.props.accessibilityRole).toBe('button');
    expect(link.props.accessibilityLabel).toContain('880');
  });

  it('is absent until the score has loaded', () => {
    mockScore = undefined;
    expect(render(<GameHeader title="Seek" />).queryByTestId('score-hud-link')).toBeNull();
  });
});
