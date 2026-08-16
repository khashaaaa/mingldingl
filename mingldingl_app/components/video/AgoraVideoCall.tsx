import { YStack, Text } from 'tamagui';
import type { VideoToken } from '../../hooks/useVideoCall';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';

interface Props {
  token: VideoToken;
  muted: boolean;
  cameraOff: boolean;
  onJoined: () => void;
  onError: (msg: string) => void;
}

// Web build: react-native-agora's native view can't be bundled for web at all
// (Metro fails on codegenNativeComponent), so this platform-specific file keeps
// react-native-agora out of the web bundle entirely. Real implementation is in
// AgoraVideoCall.native.tsx (ios/android).
export function AgoraVideoCall({ token }: Props) {
  return (
    <YStack flex={1} backgroundColor={COLORS.bg} alignItems="center" justifyContent="center" gap="$3">
      <Text fontSize={36}>📹</Text>
      <Text color={COLORS.text} fontFamily={FONTS.body as any} textAlign="center" paddingHorizontal="$6">
        {i18n.t('video_web_unsupported', { channel: token.channelName })}
      </Text>
    </YStack>
  );
}
