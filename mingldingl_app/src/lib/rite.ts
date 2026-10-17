import { PermissionsAndroid, Platform } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  ConnectionStateType,
  createAgoraRtcEngine,
  type IRtcEngine,
} from 'react-native-agora';
import type { CallTicket } from './api/generated/model';

/** What a call tells the screen: me in, them in or out, and the way lost. */
export type CallEvents = {
  onJoined: () => void;
  onRemote: (uid: number | null) => void;
  onLost: () => void;
};

export type CallHandle = { mute: (on: boolean) => void; camera: (on: boolean) => void; leave: () => void };

/** Camera and microphone, asked for at the moment the Rite begins. */
export async function askForCallDevices(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

let engine: IRtcEngine | null = null;

/**
 * How long a dropped call may try to come back before the screen says it is lost. Agora keeps
 * reconnecting after the network goes (it reports "failed" only for a refused join), so waiting
 * for "failed" left a frozen face on screen for good.
 */
export const LOST_AFTER_MS = 8000;

/**
 * Steps into the Rite's Agora channel with the engine's ticket — the one place the app touches
 * Agora. Nothing is recorded; leaving releases the camera and microphone at once.
 */
export function openCall(
  ticket: Pick<CallTicket, 'appId' | 'channel' | 'token' | 'uid'>,
  events: CallEvents,
  opts: { camera?: boolean } = {},
): CallHandle {
  engine?.release();
  const e = createAgoraRtcEngine();
  engine = e;
  let left = false;
  let lostTimer: ReturnType<typeof setTimeout> | null = null;
  const clearLost = () => {
    if (lostTimer) clearTimeout(lostTimer);
    lostTimer = null;
  };
  e.initialize({ appId: ticket.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
  e.registerEventHandler({
    onJoinChannelSuccess: () => events.onJoined(),
    onUserJoined: (_c, uid) => events.onRemote(uid),
    onUserOffline: () => events.onRemote(null),
    onConnectionStateChanged: (_c, state) => {
      if (left) return; // leaving reports "disconnected" too
      if (state === ConnectionStateType.ConnectionStateConnected) clearLost();
      else if (state === ConnectionStateType.ConnectionStateFailed) {
        clearLost();
        events.onLost();
      } else if (
        (state === ConnectionStateType.ConnectionStateReconnecting ||
          state === ConnectionStateType.ConnectionStateDisconnected) &&
        !lostTimer
      )
        lostTimer = setTimeout(() => {
          lostTimer = null;
          events.onLost();
        }, LOST_AFTER_MS);
    },
  });
  e.enableVideo();
  // The masked round: voices only until the bell (the camera stays dark).
  if (opts.camera === false) e.enableLocalVideo(false);
  e.startPreview();
  e.joinChannel(ticket.token, ticket.channel, ticket.uid, {
    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    publishMicrophoneTrack: true,
    publishCameraTrack: opts.camera !== false,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
  });
  return {
    mute: (on) => e.muteLocalAudioStream(on),
    camera: (on) => e.enableLocalVideo(on),
    leave: () => {
      left = true;
      clearLost();
      if (engine !== e) return;
      e.leaveChannel();
      e.stopPreview();
      e.release();
      engine = null;
    },
  };
}
