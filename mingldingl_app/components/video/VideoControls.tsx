import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACE, circle } from '../../lib/theme';

interface Props {
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
  endDisabled?: boolean;
}

export function VideoControls({ muted, cameraOff, onToggleMute, onToggleCamera, onEnd, endDisabled = false }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { bottom: 24 + insets.bottom }]}>
      <TouchableOpacity
        style={[styles.button, muted ? styles.buttonActive : styles.buttonIdle]}
        onPress={onToggleMute}
        accessibilityRole="button"
        accessibilityState={{ selected: muted }}
        accessibilityLabel={i18n.t(muted ? 'unmute' : 'mute')}
      >
        <Icon name={muted ? 'microphone-off' : 'microphone'} size={24} color={muted ? COLORS.panelDeep : COLORS.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonEnd, endDisabled && styles.buttonBusy]}
        onPress={onEnd}
        disabled={endDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: endDisabled }}
        accessibilityLabel={i18n.t('end_call')}
      >
        <Icon name="phone-hangup" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, cameraOff ? styles.buttonActive : styles.buttonIdle]}
        onPress={onToggleCamera}
        accessibilityRole="button"
        accessibilityState={{ selected: cameraOff }}
        accessibilityLabel={i18n.t(cameraOff ? 'camera_on' : 'camera_off')}
      >
        <Icon name={cameraOff ? 'video-off' : 'video'} size={24} color={cameraOff ? COLORS.panelDeep : COLORS.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: SPACE.xl },
  button: {
    ...circle(60),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIdle: { borderColor: COLORS.bronze, backgroundColor: COLORS.panelRaised },
  buttonActive: { borderColor: COLORS.goldBright, backgroundColor: COLORS.gold },
  buttonEnd: { borderColor: COLORS.emberDark, backgroundColor: COLORS.ember },
  buttonBusy: { opacity: 0.5 },
});
