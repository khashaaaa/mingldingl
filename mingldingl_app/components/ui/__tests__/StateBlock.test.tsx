import { render } from '@testing-library/react-native';
import { StateBlock } from '../StateBlock';
import { PLACES, PLACE_NAMES } from '../Places';
import { ACCENT, HEAT, ICON_SIZES, INK, STATUS } from '../../../lib/theme';

/**
 * The three states are drawings now, so the tests look at what was drawn rather than at a
 * snapshot: which mark the block puts on the screen, and in what pigment. A snapshot would
 * happily record the day the ember stopped being drawn at all.
 */
interface TreeNode {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown;
}

/** Every drawn mark in a rendered tree — the cuts themselves, never the wrapper. */
function marks(node: unknown): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap(marks);
  if (!node || typeof node !== 'object') return [];
  const el = node as TreeNode;
  const here = /path|rect|circle|line|polygon|polyline/i.test(el.type ?? '') ? [el] : [];
  return [...here, ...marks(el.children)];
}

/** What each mark was painted in. */
function paints(tree: unknown): unknown[] {
  return marks(tree).map((mark) => mark.props?.stroke ?? mark.props?.fill);
}

/** react-native-svg packs a colour into an ARGB int before it reaches the native view. */
function packed(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}

/** A drawing carries no meaning a screen reader needs — the title does — so it is hidden. */
const HIDDEN = { includeHiddenElements: true };

describe('StateBlock — waiting, empty, wrong', () => {
  it('draws the ember for a failure, warm rather than red', () => {
    const { getByTestId, toJSON } = render(
      <StateBlock tone="danger" icon="alert-circle-outline" title="The scribe never answered" />,
    );

    expect(getByTestId('state-ember', HIDDEN)).toBeTruthy();
    expect(paints(toJSON())).toContainEqual(packed(HEAT.flame));
    expect(paints(toJSON())).not.toContainEqual(packed(STATUS.danger));
  });

  it('draws the ember in the warning pigment when the tone is a warning', () => {
    const { getByTestId, toJSON } = render(
      <StateBlock tone="warning" icon="alert-circle-outline" title="Nearly out of time" />,
    );

    expect(getByTestId('state-ember', HIDDEN)).toBeTruthy();
    expect(paints(toJSON())).toContainEqual(packed(STATUS.warning));
  });

  // The tone is the state; the icon only names the place. A failure to reach the network is a
  // wrong, not an empty shelf, and it must read as one whichever stock name the screen passes.
  it('lets the tone pick the family, not the icon name', () => {
    const { getByTestId, queryByTestId } = render(
      <StateBlock tone="danger" icon="calendar" title="Nothing came back" />,
    );

    expect(getByTestId('state-ember', HIDDEN)).toBeTruthy();
    expect(queryByTestId('state-place-calendar-page', HIDDEN)).toBeNull();
  });

  // The ember is the wrong state's drawing, but it is not always a wrong: a screen that names it
  // under the default tone is asking for the mark, not for the heat, and a quiet block must not
  // light up orange because of which icon name it happened to pass.
  it('burns the ember in the tone it was given, not always in flame', () => {
    const quiet = render(<StateBlock icon="alert-circle-outline" title="Nothing here yet" />);
    expect(quiet.getByTestId('state-ember', HIDDEN)).toBeTruthy();
    expect(paints(quiet.toJSON())).toContainEqual(packed(INK.muted));
    expect(paints(quiet.toJSON())).not.toContainEqual(packed(HEAT.flame));

    const good = render(<StateBlock tone="good" icon="alert-circle-outline" title="Done" />);
    expect(paints(good.toJSON())).toContainEqual(packed(ACCENT.base));
  });

  it.each([
    ['door-closed-lock', 'gate'],
    ['video', 'empty-stage'],
    ['help-circle-outline', 'signpost'],
    ['map-marker-off', 'signpost'],
    ['calendar', 'calendar-page'],
    ['message-text-outline', 'letter'],
    ['skull-outline', 'empty-chair'],
    ['weather-night', 'moon'],
    ['party-popper', 'lantern'],
    ['bank', 'door'],
  ] as const)('draws %s as the place it stood for, in the tone pigment', (icon, place) => {
    const { getByTestId, queryByTestId, toJSON } = render(
      <StateBlock icon={icon} title="Quiet here" />,
    );

    expect(getByTestId(`state-place-${place}`, HIDDEN)).toBeTruthy();
    expect(queryByTestId('state-ember', HIDDEN)).toBeNull();
    expect(paints(toJSON())).toContainEqual(packed(INK.muted));
  });

  it('keeps an empty place quiet and a finished one gold', () => {
    const quiet = render(<StateBlock icon="door-closed-lock" title="Shut" />);
    expect(paints(quiet.toJSON())).toContainEqual(packed(INK.muted));

    const good = render(<StateBlock tone="good" icon="help-circle-outline" title="Asked" />);
    expect(paints(good.toJSON())).toContainEqual(packed(ACCENT.base));
  });

  // Every name the 27 call sites pass now has a drawing, but the prop still takes the whole stock
  // library: a name arriving from a screen written tomorrow has to render something.
  it('falls back to the stock icon for a name with no drawing', async () => {
    const { findByText, queryByTestId } = render(
      <StateBlock icon="telescope" title="The square stands quiet" />,
    );

    expect(await findByText('The square stands quiet')).toBeTruthy();
    expect(queryByTestId('state-ember', HIDDEN)).toBeNull();
    expect(PLACE_NAMES.every((name) => queryByTestId(`state-place-${name}`, HIDDEN) === null)).toBe(true);
  });

  it('draws no mark at all when the screen asked for none', () => {
    const { toJSON, queryByTestId } = render(<StateBlock tone="danger" title="Bare" />);

    expect(queryByTestId('state-ember', HIDDEN)).toBeNull();
    expect(marks(toJSON())).toEqual([]);
  });
});

describe('the drawn places', () => {
  it('cuts at least one mark for every place in the set', () => {
    const empty = PLACE_NAMES.filter((name) => {
      const Place = PLACES[name];
      return marks(render(<Place />).toJSON()).length === 0;
    });

    expect(empty).toEqual([]);
  });

  it('takes the size and colour it is given', () => {
    const Gate = PLACES.gate;
    const { getByTestId, toJSON } = render(<Gate size={ICON_SIZES.splash} color={INK.dim} />);

    expect(getByTestId('state-place-gate', HIDDEN).props).toEqual(expect.objectContaining({
      width: ICON_SIZES.splash,
      height: ICON_SIZES.splash,
    }));
    expect(paints(toJSON())).toContainEqual(packed(INK.dim));
  });
});
