import { View, Text, StyleSheet } from 'react-native';
import type { VideoToken } from '../../hooks/useVideoCall';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, SPACE } from '../../lib/theme';
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
      <Icon name="video" size={36} color={COLORS.textDim} />
      <Text style={styles.placeholderText}>
        {i18n.t('video_web_unsupported', { channel: token.channelName })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  placeholderText: { color: COLORS.text, fontFamily: FONTS.body, textAlign: 'center', paddingHorizontal: SPACE.huge },
});
