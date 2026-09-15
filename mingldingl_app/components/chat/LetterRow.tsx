import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { Message } from '../../hooks/useChat';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, LINE, PRESS, SPACE, STATUS, SURFACE } from '../../lib/theme';
import { FieldError } from '../ui/StateBlock';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';

interface Props {
  message: Message;
  myId: string | undefined;
  /** The sigil letter for this sender — the ring beside the line, standing in for a portrait. */
  initial: string;
  onRetry?: (id: string) => void;
}

/**
 * One line of the ledger — the bubble's replacement (Sealed Fire move 2). A ledger has no bubbles
 * or fills: it is text standing directly on the world floor, told apart only by who is speaking.
 * Mine is set in the app's own voice, `FONTS.bodyItalic`; theirs is roman, the person's own hand.
 */
export function LetterRow({ message, myId, initial, onRetry }: Props) {
  const isMine = (!!myId && message.senderId === myId) || message.senderId === 'me';
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';

  const row = (
    <View
      testID="letter"
      style={[styles.row, isSending && styles.sending, isFailed && styles.failed]}
    >
      <View style={styles.ring}>
        <Text style={[styles.initial, { color: isMine ? ACCENT.base : INK.dim }]}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>{message.content}</Text>
        {isFailed && (
          <View style={styles.retryRow}>
            <Icon name="alert-circle" size={ICON_SIZES.sm} color={STATUS.danger} />
            <FieldError>{i18n.t('message_tap_to_retry')}</FieldError>
          </View>
        )}
      </View>
    </View>
  );

  // The whole failed letter is the retry target, not the small line under it: the line you are
  // trying to send again is the thing on screen, and a two-word strip is a hard thing to hit.
  // The label has to carry the letter's own words too — labelling the wrapper hides everything
  // inside it, so a screen reader heard only "tap to retry" and never which letter failed.
  return isFailed ? (
    <Pressable
      onPress={() => onRetry?.(message.id)}
      accessibilityRole="button"
      accessibilityLabel={`${message.content}. ${i18n.t('message_tap_to_retry')}`}
    >
      {row}
    </Pressable>
  ) : row;
}

const RING = 28;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginBottom: SPACE.md },
  sending: { opacity: 0.8 },
  failed: { opacity: PRESS.dimmed },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
    borderColor: LINE.edge,
    // Filled, so the thread behind the letters stops at the ring instead of running through the
    // sender's initial.
    backgroundColor: SURFACE.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm },
  body: { flex: 1 },
  text: { fontSize: FONT_SIZES.lg, lineHeight: LEADING.lg },
  textMine: { fontFamily: FONTS.bodyItalic, color: ACCENT.base },
  textTheirs: { fontFamily: FONTS.body, color: INK.primary },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
});
