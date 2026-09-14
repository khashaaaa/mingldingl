import { View, StyleSheet } from 'react-native';
import type { VideoToken } from '../../hooks/useVideoCall';
import { i18n } from '../../lib/i18n';
import { StateBlock } from '../ui/StateBlock';

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
      <StateBlock icon="video" title={i18n.t('video_web_unsupported', { channel: token.channelName })} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: the world floor shows through a call that has not started.
  placeholder: { flex: 1, backgroundColor: 'transparent' },
});
