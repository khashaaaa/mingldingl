import { View, Text, StyleSheet } from 'react-native';
import type { VideoToken } from '../../hooks/useVideoCall';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, ICON_SIZES, INK, SPACE } from '../../lib/theme';
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
    <View style={styles.placeholder}>
      <Icon name="video" size={ICON_SIZES.huge} color={INK.dim} />
      <Text style={styles.placeholderText}>
        {i18n.t('video_web_unsupported', { channel: token.channelName })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  placeholderText: { color: INK.primary, fontFamily: FONTS.body, textAlign: 'center', paddingHorizontal: SPACE.huge },
});
