import { LOST_AFTER_MS, openCall } from '../rite';

const S = { Disconnected: 1, Connecting: 2, Connected: 3, Reconnecting: 4, Failed: 5 };
let handler: { onConnectionStateChanged: (c: unknown, s: number) => void };

jest.mock('react-native-agora', () => ({
  ChannelProfileType: { ChannelProfileCommunication: 0 },
  ClientRoleType: { ClientRoleBroadcaster: 1 },
  ConnectionStateType: {
    ConnectionStateDisconnected: 1,
    ConnectionStateConnecting: 2,
    ConnectionStateConnected: 3,
    ConnectionStateReconnecting: 4,
    ConnectionStateFailed: 5,
  },
  createAgoraRtcEngine: () => ({
    initialize: jest.fn(),
    registerEventHandler: (h: typeof handler) => {
      handler = h;
    },
    enableVideo: jest.fn(),
    enableLocalVideo: jest.fn(),
    startPreview: jest.fn(),
    stopPreview: jest.fn(),
    joinChannel: jest.fn(),
    leaveChannel: jest.fn(),
    release: jest.fn(),
  }),
}));

const ticket = { appId: 'a', channel: 'c', token: 't', uid: 1 };

describe('a call that drops', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function call() {
    const onLost = jest.fn();
    const handle = openCall(ticket, { onJoined: jest.fn(), onRemote: jest.fn(), onLost });
    return { onLost, handle };
  }

  test('is lost when it cannot come back in time (Agora never says "failed" for a dropped network)', () => {
    const { onLost } = call();
    handler.onConnectionStateChanged(null, S.Reconnecting);
    jest.advanceTimersByTime(LOST_AFTER_MS - 1);
    expect(onLost).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  test('is not lost when it comes back first', () => {
    const { onLost } = call();
    handler.onConnectionStateChanged(null, S.Reconnecting);
    jest.advanceTimersByTime(LOST_AFTER_MS / 2);
    handler.onConnectionStateChanged(null, S.Connected);
    jest.advanceTimersByTime(LOST_AFTER_MS);
    expect(onLost).not.toHaveBeenCalled();
  });

  test('is lost at once when the join is refused', () => {
    const { onLost } = call();
    handler.onConnectionStateChanged(null, S.Failed);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  test('leaving is never "lost"', () => {
    const { onLost, handle } = call();
    handler.onConnectionStateChanged(null, S.Reconnecting);
    handle.leave();
    handler.onConnectionStateChanged(null, S.Disconnected);
    jest.advanceTimersByTime(LOST_AFTER_MS * 2);
    expect(onLost).not.toHaveBeenCalled();
  });
});
