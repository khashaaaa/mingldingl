import { XStack, Button, Text } from 'tamagui';
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
      >
        <Text fontSize={22}>{muted ? '🔇' : '🎙️'}</Text>
      </Button>
      <Button
        width={60} height={60} borderRadius={30} borderWidth={1}
        borderColor={COLORS.ember} backgroundColor={COLORS.ember}
        onPress={onEnd}
      >
        <Text fontSize={22}>📵</Text>
      </Button>
      <Button
        width={60} height={60} borderRadius={30} borderWidth={1}
        borderColor={cameraOff ? COLORS.ember : COLORS.bronze}
        backgroundColor={cameraOff ? COLORS.ember : COLORS.panelRaised}
        onPress={onToggleCamera}
      >
        <Text fontSize={22}>{cameraOff ? '🚫' : '📷'}</Text>
      </Button>
    </XStack>
  );
}
