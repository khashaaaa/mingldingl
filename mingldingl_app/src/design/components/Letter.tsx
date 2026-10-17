import { StyleSheet, View } from 'react-native';
import { color, dimension } from '../tokens';
import { FillArt } from './Art';
import { Txt } from './Txt';

/**
 * One letter in a bond (Figma 31:97): yours on parchment at the right, theirs on the night panel at
 * the left. The time sits under the last letter of a run; a label (whose answer, 31:892) sits inside.
 */
export function Letter({
  text,
  mine,
  time,
  label,
  block,
}: {
  text: string;
  mine: boolean;
  time?: string;
  label?: string;
  /** Full width from the left (answers set side by side, 31:892), not a chat letter. */
  block?: boolean;
}) {
  return (
    <View style={[styles.wrap, block ? styles.block : mine ? styles.mine : styles.theirs]}>
      <View style={[styles.letter, mine ? styles.paper : styles.panel]}>
        {mine && <FillArt name="parchment" />}
        {label ? (
          <Txt variant="labelS" color={mine ? 'textOnParchment' : 'textMuted'}>
            {label.toUpperCase()}
          </Txt>
        ) : null}
        <Txt variant="bodyM" color={mine ? 'textOnParchment' : 'textPrimary'}>
          {text}
        </Txt>
      </View>
      {time ? (
        <Txt variant="labelS" color="textMuted" align={mine ? 'right' : 'left'}>
          {time}
        </Txt>
      ) : null}
    </View>
  );
}

/** A seal breaking in the letters: one italic gold line. */
export function SealLine({ text }: { text: string }) {
  return (
    <Txt variant="voiceM" color="textAccent" align="center" style={styles.seal}>
      {text}
    </Txt>
  );
}

/** "Yesterday", "Today", or a date between runs of letters. */
export function DayHeading({ text }: { text: string }) {
  return (
    <Txt variant="labelS" color="textMuted" align="center" style={styles.day}>
      {text.toUpperCase()}
    </Txt>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '80%', gap: dimension.space1 },
  mine: { alignSelf: 'flex-end' },
  block: { alignSelf: 'stretch', maxWidth: '100%', marginRight: dimension.space4 },
  theirs: { alignSelf: 'flex-start' },
  letter: {
    paddingHorizontal: dimension.space3,
    paddingVertical: 10,
    gap: dimension.space1,
    overflow: 'hidden',
  },
  paper: { borderRadius: dimension.radiusSm },
  panel: {
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    borderRadius: dimension.radiusSm,
  },
  seal: { paddingVertical: dimension.space2 },
  day: { paddingVertical: dimension.space3, letterSpacing: 1.5 },
});
