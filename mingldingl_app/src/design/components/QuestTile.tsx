import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import { boxShadow } from '../effects';
import type { GlyphName } from '../glyphs';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

export type QuestState = 'active' | 'claimable' | 'done';

/**
 * A quest (Figma "Quest Tile"): its glyph, name, a gold track and "2 of 3", the bounty at the end.
 * Claimable glows gold and claims on a tap; done (claimed) sits back at 60 %.
 */
export function QuestTile({
  glyph,
  title,
  progressText,
  progress,
  reward,
  state,
  onClaim,
}: {
  glyph: GlyphName;
  title: string;
  progressText: string;
  /** 0–1 along the track. */
  progress: number;
  reward: string;
  state: QuestState;
  onClaim?: () => void;
}) {
  const claimable = state === 'claimable';
  const body = (
    <>
      <Glyph name={glyph} size={28} tint={claimable ? 'accentGoldBright' : 'textSecondary'} />
      <View style={styles.text}>
        <Txt variant="displayS">{title}</Txt>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.max(0, Math.min(1, progress)) * 100}%` },
              state === 'done' && styles.fillDone,
            ]}
          />
        </View>
        <Txt variant="labelS" color={claimable ? 'textAccent' : 'textMuted'}>
          {progressText}
        </Txt>
      </View>
      <Txt variant="numberS" color={state === 'done' ? 'textMuted' : 'textAccent'}>
        {reward}
      </Txt>
    </>
  );
  const style = [styles.tile, claimable ? styles.claimable : styles.idle, state === 'done' && styles.done];
  return claimable && onClaim ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${progressText}. ${reward}`}
      onPressIn={() => feedback('press')}
      onPress={onClaim}
      style={style}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${title}. ${progressText}. ${reward}`} style={style}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: dimension.space4,
    paddingVertical: 14,
    borderRadius: dimension.radiusSm,
    borderWidth: dimension.strokeHairline,
    alignSelf: 'stretch',
  },
  idle: { backgroundColor: color.bgRaised, borderColor: color.borderHairline },
  claimable: {
    backgroundColor: color.bgPanel,
    borderColor: color.borderGold,
    boxShadow: boxShadow('glowGold'),
  },
  done: { opacity: 0.6 },
  text: { flex: 1, gap: 6 },
  track: { height: 4, backgroundColor: color.bgSunken, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: color.accentGold },
  fillDone: { backgroundColor: color.statusSuccess },
});
