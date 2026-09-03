import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import type { VideoToken } from '../../hooks/useVideoCall';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, SPACE, RADIUS } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface Props {
  token: VideoToken;
  muted: boolean;
  cameraOff: boolean;
  onJoined: () => void;
  onError: (msg: string) => void;
}

const IS_DEV_BUILD = Constants.appOwnership !== 'expo';

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

function AgoraVideoCallImpl({ token, muted, cameraOff, onJoined, onError }: Props) {
  const {
    createAgoraRtcEngine,
    ChannelProfileType,
    ClientRoleType,
    RtcSurfaceView,
  } = require('react-native-agora');

  const engineRef = useRef<ReturnType<typeof createAgoraRtcEngine> | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [localReady, setLocalReady] = useState(false);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const cameraOffRef = useRef(cameraOff);
  cameraOffRef.current = cameraOff;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = await requestAndroidPermissions();
      if (!ok) { onError(i18n.t('permission_denied')); return; }
      if (cancelled) return;

      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      engine.initialize({
        appId: token.appId,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      engine.registerEventHandler({
        onJoinChannelSuccess: () => { setLocalReady(true); onJoined(); },
        onUserJoined: (_connection: unknown, uid: number) => setRemoteUid(uid),
        onUserOffline: () => setRemoteUid(null),
        onError: (_code: unknown, msg: string) => onError(msg || i18n.t('video_error')),
      });

      engine.enableVideo();
      engine.enableAudio();
      engine.startPreview();

      const result = engine.joinChannel(token.token, token.channelName, 0, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        publishMicrophoneTrack: true,
        publishCameraTrack: true,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });

      engine.muteLocalAudioStream(mutedRef.current);
      engine.muteLocalVideoStream(cameraOffRef.current);
      if (result !== 0) onError(`Failed to join channel (code ${result})`);
    })();

    return () => {
      cancelled = true;
      const engine = engineRef.current;
      if (engine) {
        engine.leaveChannel();
        engine.unregisterEventHandler?.();
        engine.release();
        engineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.channelName]);

  useEffect(() => {
    engineRef.current?.muteLocalAudioStream(muted);
  }, [muted]);

  useEffect(() => {
    engineRef.current?.muteLocalVideoStream(cameraOff);
  }, [cameraOff]);

  return (
    <View style={styles.root}>
      {remoteUid !== null ? (
        <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid }} />
      ) : (
        <View style={styles.waiting}>
          <Text style={styles.waitingText}>{i18n.t('waiting_join')}</Text>
        </View>
      )}
      {localReady && !cameraOff && (
        <View style={styles.localPreview}>
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0 }} />
        </View>
      )}
    </View>
  );
}

export function AgoraVideoCall(props: Props) {
  if (!IS_DEV_BUILD) {
    return (
      <View style={styles.placeholder}>
        <Icon name="video" size={36} color={COLORS.textDim} />
        <Text style={styles.placeholderText}>
          {i18n.t('video_dev_build_required')}
        </Text>
      </View>
    );
  }
  return <AgoraVideoCallImpl {...props} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waitingText: { color: COLORS.textDim, fontFamily: FONTS.body },
  localPreview: {
    position: 'absolute', top: SPACE.lg, right: SPACE.lg,
    width: 100, height: 140, borderRadius: RADIUS.lg, overflow: 'hidden',
  },
  placeholder: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  placeholderText: { color: COLORS.text, fontFamily: FONTS.body, textAlign: 'center', paddingHorizontal: SPACE.huge },
});
