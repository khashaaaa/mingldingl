import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { Message } from '../../hooks/useChat';
import { COLORS, FONTS, RADIUS, tint } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';

interface Props {
  message: Message;
  myId: string | undefined;
  onRetry?: (messageId: string) => void;
}

export function MessageBubble({ message, myId, onRetry }: Props) {
  const isMine = (!!myId && message.senderId === myId) || message.senderId === 'me';
  const isFailed = message.status === 'failed';

  const bubble = (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, isFailed && styles.bubbleFailed]}>
      <Text style={[styles.text, isMine && styles.textMine]}>{message.content}</Text>
    </View>
  );

  return (
    <View style={[styles.wrap, isMine ? styles.alignEnd : styles.alignStart]}>
      {isFailed ? (
        <Pressable onPress={() => onRetry?.(message.id)} accessibilityLabel={i18n.t('message_tap_to_retry')}>
          {bubble}
          <View style={styles.retryRow}>
            <Icon name="alert-circle" size={13} color={COLORS.emberLight} />
            <Text style={styles.retryText}>{i18n.t('message_tap_to_retry')}</Text>
          </View>
        </Pressable>
      ) : bubble}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8, maxWidth: '75%' },
  alignEnd: { alignSelf: 'flex-end' },
  alignStart: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 16, padding: 12, maxWidth: '100%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: tint(COLORS.gold, 0.9), borderBottomRightRadius: RADIUS.sm },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: COLORS.panel, borderBottomLeftRadius: RADIUS.sm },
  bubbleFailed: { opacity: 0.55 },
  text: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.text },
  textMine: { color: COLORS.panelDeep },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-end' },
  retryText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.emberLight },
});
