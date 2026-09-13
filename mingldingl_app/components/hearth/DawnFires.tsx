import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Tap } from '../ui/Tap';
import { Glyph } from '../ui/Glyph';
import { PLACES } from '../ui/Places';
import { i18n } from '../../lib/i18n';
import { fireVerdict, type Fire, type FireState } from '../../lib/fire';
import {
  ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, SPACE, TEMPERATURE, tint,
} from '../../lib/theme';

/**
 * The fires as the hearth lists them: one hairline row per lit thread, one sentence each, the
 * judged ones at the top. Not a second Quest Log — the Log is where a thread is read, with its
 * portrait, its seals and its day count; this says what happened at this dawn and lets you into
 * the thread it happened in.
 *
 * The mark and its colour are `QuestTile`'s own choices (flame / ember / ice, bright gold / ember /
 * glacier), reached for here rather than re-picked, so a fire cannot be one temperature in the Log
 * and another on the hearth.
 */

const Ember = PLACES.ember;

/** The judged lead: a frozen fire is a verdict, embers are a warning, a burning fire is news that
 *  nothing is wrong. Lower sorts first. */
const ORDER: Record<FireState, number> = { frozen: 0, embers: 1, burning: 2, unlit: 3 };

export interface DawnFire {
  /** The match id, which is also the thread's route (`/chat/<id>`). */
  id: string;
  /** Whatever the thread is allowed to call them at this reveal level. */
  name: string;
  fire: Fire;
}

function markColor(state: FireState): string {
  switch (state) {
    case 'burning': return ACCENT.bright;
    case 'embers': return METAL.ember;
    case 'frozen': return TEMPERATURE.glacier;
    case 'unlit': return INK.dim;
  }
}

/** The whole row, as one sentence. It is also the row's accessibility label — a `Tap` groups every
 *  descendant under one label, so anything not in this string is not said at all. */
function sentence(name: string, fire: Fire): string {
  const turn = i18n.t(fire.myTurn ? 'your_turn' : 'their_turn');
  switch (fire.state) {
    case 'burning':
      return i18n.t('hearth_fire_burns', { name, turn });
    case 'embers':
      return i18n.t('hearth_fire_embers', { name, turn });
    case 'frozen':
      // A severed thread has nobody to judge (`fireVerdict` is null), so the sentence ends at the
      // freezing — trimmed rather than left with the placeholder's trailing space.
      return i18n.t('hearth_fire_froze', { name, verdict: fireVerdict(fire) ?? '' }).trim();
    case 'unlit':
      return '';
  }
}

export function DawnFires({ fires }: { fires: DawnFire[] }) {
  const router = useRouter();

  // Unlit is dropped here rather than by the screen: "which fires were judged" is this component's
  // own rule, and a thread with no letter in it was not judged — it was never lit.
  const lit = fires
    .filter((f) => f.fire.state !== 'unlit')
    .sort((a, b) => ORDER[a.fire.state] - ORDER[b.fire.state]);

  if (lit.length === 0) {
    return <Text style={styles.empty}>{i18n.t('hearth_no_fires')}</Text>;
  }

  return (
    <View>
      {lit.map(({ id, name, fire }) => {
        const color = markColor(fire.state);
        const line = sentence(name, fire);
        return (
          <Tap
            key={id}
            testID="dawn-fire-row"
            accessibilityRole="button"
            accessibilityLabel={line}
            onPress={() => router.push(`/chat/${id}`)}
          >
            <View style={[styles.row, fire.state === 'embers' && { borderBottomColor: tint(METAL.ember, 0.6) }]}>
              {fire.state === 'burning' && <Glyph name="flame" size={ICON_SIZES.md} color={color} />}
              {fire.state === 'embers' && <Ember size={ICON_SIZES.md} color={color} />}
              {fire.state === 'frozen' && <Glyph name="ice" size={ICON_SIZES.md} color={color} />}
              <Text style={[styles.line, fire.state === 'frozen' && styles.lineFrozen]}>{line}</Text>
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    // A hairline under the row is the mortar, not a card border — the same treatment the Hall of
    // Names' ranks take.
    borderBottomWidth: 1,
    borderBottomColor: LINE.hairline,
  },
  line: { flex: 1, fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.primary },
  lineFrozen: { color: INK.dim },
  // The app speaking, not a thread — italic, the same register as every other law in the app.
  empty: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    paddingVertical: SPACE.md,
  },
});
