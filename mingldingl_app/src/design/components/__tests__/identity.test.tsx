import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { setLocale } from '@/lib/i18n';
import { type } from '../../tokens';
import { AvatarFrame } from '../AvatarFrame';
import { asTier, GemBadge } from '../GemBadge';
import { NameTitle } from '../NameTitle';
import { PhotoTile } from '../PhotoTile';
import { drumDigits, PointsCounter } from '../PointsCounter';
import { RoomHeader } from '../RoomHeader';
import { StepLadder } from '../StepLadder';
import { TabBar } from '../TabBar';
import { XpBar } from '../XpBar';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
// expo-image is native; a host View keeps the props the component passed, which is what is under test.
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View testID="expo-image" {...props} /> };
});
const { feedback } = jest.requireMock('@/lib/feedback') as { feedback: jest.Mock };
beforeEach(() => feedback.mockClear());
afterEach(() => setLocale('en'));

const photo = { id: 'p1', url: 'https://engine/uploads/p1?sig=a', thumbHash: '1QcSHQRnh493V4dIh4eXh1h4kJUI' };
const images = () => screen.queryAllByTestId('expo-image');
const drums = () =>
  screen
    .getAllByTestId(/^drum-\d$/, { includeHiddenElements: true })
    .map((d) => d.props.testID.slice(-1))
    .join('');

describe('RoomHeader', () => {
  test('the title is blackletter in English and Yeseva One in Mongolian', async () => {
    const { rerender } = await render(<RoomHeader title="The Hearth" />);
    expect(screen.getByRole('header', { name: 'The Hearth' })).toHaveStyle({
      fontFamily: type.titleRoom.fontFamily,
    });
    await act(() => setLocale('mn'));
    await rerender(<RoomHeader title="Голомт" />);
    expect(screen.getByRole('header', { name: 'Голомт' })).toHaveStyle({
      fontFamily: 'YesevaOne_400Regular',
    });
  });
  test('the way home and the action are buttons', async () => {
    const back = jest.fn();
    const more = jest.fn();
    await render(
      <RoomHeader
        title="The Hearth"
        onBack={back}
        action={{ glyph: 'more', label: 'More', onPress: more }}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    expect(back).toHaveBeenCalled();
    expect(more).toHaveBeenCalled();
  });
});

describe('TabBar', () => {
  const tabs = [
    { key: 'seek', label: 'Seek', glyph: 'fire' },
    { key: 'character', label: 'Character', glyph: 'person' },
  ] as const;
  test('marks the active tab and fires a tap', async () => {
    const onPress = jest.fn();
    await render(<TabBar tabs={tabs} active="character" onPress={onPress} />);
    expect(screen.getByRole('tab', { name: 'Character' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Seek' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(screen.getAllByTestId('ember-tick')).toHaveLength(1);
    const seek = screen.getByRole('tab', { name: 'Seek' });
    await fireEvent(seek, 'pressIn');
    await fireEvent.press(seek);
    expect(feedback).toHaveBeenCalledWith('press');
    expect(onPress).toHaveBeenCalledWith('seek');
  });
});

describe('PhotoTile', () => {
  test('caches by photo id, so a new signed URL for the same photo re-uses the cache', async () => {
    const { rerender } = await render(<PhotoTile state="filled" photo={photo} />);
    expect(images()[0]?.props.source).toMatchObject({ uri: photo.url, cacheKey: 'p1' });
    expect(images()[0]?.props.placeholder).toEqual({ thumbhash: photo.thumbHash });
    await rerender(<PhotoTile state="filled" photo={{ ...photo, url: 'https://engine/uploads/p1?sig=b' }} />);
    expect(images()[0]?.props.source.cacheKey).toBe('p1');
  });
  test('empty asks for a portrait, failed retries, uploading shows progress', async () => {
    const add = jest.fn();
    const retry = jest.fn();
    const { rerender } = await render(<PhotoTile state="empty" onPress={add} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a portrait' }));
    expect(add).toHaveBeenCalled();
    await rerender(<PhotoTile state="failed" onRetry={retry} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lost — tap' }));
    expect(retry).toHaveBeenCalled();
    await rerender(<PhotoTile state="uploading" progress={0.4} />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 40 });
    expect(screen.getByTestId('upload-progress')).toHaveStyle({ width: '40%' });
  });
  test('a portrait is named by its place, not just "Your portrait"', async () => {
    await render(<PhotoTile state="filled" photo={photo} label="Portrait 2 of 4" />);
    expect(screen.getByRole('imagebutton', { name: 'Portrait 2 of 4' })).toBeTruthy();
  });
  test('long-press picks the tile up to reorder', async () => {
    const lift = jest.fn();
    await render(<PhotoTile state="filled" photo={photo} onLongPress={lift} />);
    await fireEvent(screen.getByRole('imagebutton'), 'longPress');
    expect(lift).toHaveBeenCalled();
  });
});

describe('AvatarFrame', () => {
  test('sealed never renders a remote source — only the ThumbHash, under wax', async () => {
    await render(<AvatarFrame state="sealed" photo={photo} label="Saruul" />);
    for (const img of images()) expect(JSON.stringify(img.props)).not.toContain(photo.url);
    expect(images()[0]?.props.source).toEqual({ thumbhash: photo.thumbHash });
    expect(screen.getByTestId('avatar-seal')).toBeTruthy();
  });
  test('revealed shows the image, cached by id, with no seal', async () => {
    await render(<AvatarFrame state="revealed" photo={photo} label="Saruul" />);
    expect(images()[0]?.props.source).toMatchObject({ uri: photo.url, cacheKey: 'p1' });
    expect(screen.queryByTestId('avatar-seal')).toBeNull();
  });
});

describe('GemBadge', () => {
  test('names its tier; an unknown tier falls back to Garnet', async () => {
    await render(<GemBadge tier={asTier('Sapphire')} />);
    expect(screen.getByRole('image', { name: 'Sapphire' })).toBeTruthy();
    expect(asTier('Diamond')).toBe('Garnet');
  });
});

describe('PointsCounter', () => {
  test('shows 0 for 0, no leading zeros, and grows a digit as it climbs', async () => {
    const { rerender } = await render(<PointsCounter value={0} />);
    expect(drums()).toBe('0');
    await rerender(<PointsCounter value={10000} />);
    expect(drums()).toBe('10000');
    expect(drumDigits(205)).toEqual([2, 0, 5]);
  });
  test('a screen reader hears the number once, not every digit on every drum', async () => {
    await render(<PointsCounter value={1234} />);
    expect(screen.getByRole('text', { name: '1234 points' })).toBeTruthy();
    expect(screen.queryAllByText(/^\d$/)).toHaveLength(0);
  });
  test('ticks once per drum that turns, units first', async () => {
    jest.useFakeTimers();
    const { rerender } = await render(<PointsCounter value={98} />);
    await rerender(<PointsCounter value={103} />);
    await act(() => jest.advanceTimersByTime(0));
    expect(feedback).toHaveBeenCalledTimes(1);
    await act(() => jest.advanceTimersByTime(1000));
    expect(feedback).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});

describe('XpBar', () => {
  test('reads the next gem and how far the track is filled', async () => {
    await render(<XpBar points={880} progress={0.75} next={{ points: 120, tier: 'Ruby' }} />);
    expect(screen.getByText('120 to Ruby')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 75 });
  });
  test('an empty track has no fill', async () => {
    await render(<XpBar points={0} progress={0} next={{ points: 100, tier: 'Opal' }} />);
    expect(screen.queryByTestId('xp-fill')).toBeNull();
    expect(drums()).toBe('0');
  });
});

describe('NameTitle', () => {
  test('the name and its gold age read as one header line', async () => {
    await render(<NameTitle name="Мөнхболд" text="Мөнхболд, 31" />);
    expect(screen.getByRole('header', { name: 'Мөнхболд, 31' })).toBeTruthy();
    expect(screen.getByText(', 31')).toBeTruthy();
  });
});

describe('StepLadder', () => {
  test('lights the rungs climbed and counts the step', async () => {
    await render(<StepLadder step={3} total={6} />);
    expect(screen.getAllByTestId('rung')).toHaveLength(6);
    expect(screen.getByText('3 of 6')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 3, max: 6 });
  });
});
