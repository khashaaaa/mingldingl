import { YStack, Text } from 'tamagui';
import type { VideoToken } from '../../hooks/useVideoCall';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface Props {
  token: VideoToken;
  muted: boolean;
  cameraOff: boolean;
  onJoined: () => void;
  onError: (msg: string) => void;
}

export function AgoraVideoCall({ token }: Props) {
  return (
    <YStack flex={1} backgroundColor={COLORS.bg} alignItems="center" justifyContent="center" gap="$3">
      <Icon name="video" size={36} color={COLORS.textDim} />
      <Text color={COLORS.text} fontFamily={FONTS.body as any} textAlign="center" paddingHorizontal="$6">
        {i18n.t('video_web_unsupported', { channel: token.channelName })}
      </Text>
    </YStack>
  );
}
