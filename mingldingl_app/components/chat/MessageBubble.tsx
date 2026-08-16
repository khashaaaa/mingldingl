import { Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import type { Message } from '../../hooks/useChat';
import { COLORS, FONTS } from '../../lib/theme';
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
    <YStack
      alignSelf={isMine ? 'flex-end' : 'flex-start'}
      backgroundColor={isMine ? 'rgba(217,127,31,0.9)' : COLORS.panel}
      borderRadius={16}
      borderBottomRightRadius={isMine ? 4 : 16}
      borderBottomLeftRadius={isMine ? 16 : 4}
      padding="$3"
      maxWidth="100%"
      opacity={isFailed ? 0.55 : 1}
    >
      <Text color={isMine ? COLORS.panelDeep : COLORS.text} fontSize={15} fontFamily={FONTS.body as any}>{message.content}</Text>
    </YStack>
  );

  return (
    <YStack alignSelf={isMine ? 'flex-end' : 'flex-start'} marginBottom="$2" maxWidth="75%">
      {isFailed ? (
        <Pressable onPress={() => onRetry?.(message.id)} accessibilityLabel={i18n.t('message_tap_to_retry')}>
          {bubble}
          <XStack alignItems="center" gap="$1" marginTop="$1" alignSelf="flex-end">
            <Icon name="alert-circle" size={13} color={COLORS.ember} />
            <Text color={COLORS.ember} fontSize={11} fontFamily={FONTS.body as any}>
              {i18n.t('message_tap_to_retry')}
            </Text>
          </XStack>
        </Pressable>
      ) : bubble}
    </YStack>
  );
}
