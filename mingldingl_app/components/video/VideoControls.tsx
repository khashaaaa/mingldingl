import { XStack, Button } from 'tamagui';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/theme';

interface Props {
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
}

export function VideoControls({ muted, cameraOff, onToggleMute, onToggleCamera, onEnd }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <XStack position="absolute" bottom={24 + insets.bottom} left={0} right={0} justifyContent="center" gap="$4">
      <Button
        width={60} height={60} borderRadius={30} borderWidth={1}
        borderColor={muted ? COLORS.ember : COLORS.bronze}
        backgroundColor={muted ? COLORS.ember : COLORS.panelRaised}
        onPress={onToggleMute}
        accessibilityLabel={i18n.t(muted ? 'unmute' : 'mute')}
      >
        <Icon name={muted ? 'microphone-off' : 'microphone'} size={24} color={COLORS.text} />
      </Button>
      <Button
        width={60} height={60} borderRadius={30} borderWidth={1}
        borderColor={COLORS.ember} backgroundColor={COLORS.ember}
        onPress={onEnd}
        accessibilityLabel={i18n.t('end_call')}
      >
        <Icon name="phone-hangup" size={24} color={COLORS.text} />
      </Button>
      <Button
        width={60} height={60} borderRadius={30} borderWidth={1}
        borderColor={cameraOff ? COLORS.ember : COLORS.bronze}
        backgroundColor={cameraOff ? COLORS.ember : COLORS.panelRaised}
        onPress={onToggleCamera}
        accessibilityLabel={i18n.t(cameraOff ? 'camera_on' : 'camera_off')}
      >
        <Icon name={cameraOff ? 'video-off' : 'video'} size={24} color={COLORS.text} />
      </Button>
    </XStack>
  );
}
