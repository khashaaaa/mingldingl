import { supabase } from '../../supabase';
import {
  subscribeToBroadcast,
  __resetRealtimeRegistryForTests,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from '../subscribeWithRetry';

jest.mock('../../supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

type StatusCallback = (status: string) => void;
type Handler = (msg: { payload: unknown }) => void;

interface FakeChannel {
  topic: string;
  on: jest.Mock;
  subscribe: jest.Mock;
  fire: (status: string) => void;
  emit: (event: string, payload: unknown) => void;
}

function makeFakeChannel(topic: string): FakeChannel {
  let status: StatusCallback = () => {};
  const handlers: Record<string, Handler[]> = {};
  const channel = {
    topic,
    on: jest.fn((_type: string, opts: { event: string }, handler: Handler) => {
      (handlers[opts.event] ??= []).push(handler);
      return channel;
    }),
    subscribe: jest.fn((cb: StatusCallback) => {
      status = cb;
      return channel;
    }),
    fire: (s: string) => status(s),
    emit: (event: string, payload: unknown) => (handlers[event] ?? []).forEach((h) => h({ payload })),
  } as FakeChannel;
  return channel;
}

describe('subscribeToBroadcast', () => {
  let channels: FakeChannel[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    __resetRealtimeRegistryForTests();
    channels = [];
    mockChannel.mockImplementation((topic: string) => {
      const ch = makeFakeChannel(topic);
      channels.push(ch);
      return ch;
    });
    mockRemoveChannel.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates, binds and subscribes a channel for the topic immediately', () => {
    const onEvent = jest.fn();
    subscribeToBroadcast('chat:m1', { INSERT: onEvent });

    expect(mockChannel).toHaveBeenCalledWith('chat:m1');
    expect(channels[0].subscribe).toHaveBeenCalledTimes(1);
    channels[0].emit('INSERT', { id: 'x' });
    expect(onEvent).toHaveBeenCalledWith({ payload: { id: 'x' } });
  });

  // Three Town Square hooks share `townsquare:{id}`. They used to share one channel by accident,
  // and the first to unmount removed it from under the other two.
  it('shares one channel between subscribers of a topic and fans events out to each', () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribeToBroadcast('townsquare:s1', { 'round-advanced': a });
    subscribeToBroadcast('townsquare:s1', { 'round-advanced': b, 'session-started': b });

    expect(mockChannel).toHaveBeenCalledTimes(1);
    channels[0].emit('round-advanced', {});
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    channels[0].emit('session-started', {});
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('keeps the channel while any subscriber remains, and removes it with the last', () => {
    const a = jest.fn();
    const b = jest.fn();
    const releaseA = subscribeToBroadcast('townsquare:s1', { 'round-advanced': a });
    const releaseB = subscribeToBroadcast('townsquare:s1', { 'round-advanced': b });

    releaseA();
    expect(mockRemoveChannel).not.toHaveBeenCalled();
    channels[0].emit('round-advanced', {});
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    releaseB();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channels[0]);
  });

  it('treats a second release of the same subscription as a no-op', () => {
    const release = subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    release();
    release();
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it('on CHANNEL_ERROR, removes the channel and resubscribes a fresh one after the initial delay', () => {
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    channels[0].fire('CHANNEL_ERROR');

    expect(mockRemoveChannel).toHaveBeenCalledWith(channels[0]);
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS - 1);
    expect(mockChannel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(mockChannel).toHaveBeenCalledTimes(2);
    expect(channels[1].subscribe).toHaveBeenCalledTimes(1);
  });

  it('on TIMED_OUT, also retries', () => {
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    channels[0].fire('TIMED_OUT');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });

  // Nothing rejoins a closed channel. Ignoring CLOSED left the subscription dead for good.
  it('retries an unexpected CLOSED too', () => {
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    channels[0].fire('CLOSED');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });

  it('the handlers keep working on the replacement channel', () => {
    const onEvent = jest.fn();
    subscribeToBroadcast('chat:m1', { INSERT: onEvent });
    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);

    channels[1].emit('INSERT', { id: 'y' });
    expect(onEvent).toHaveBeenCalledWith({ payload: { id: 'y' } });
  });

  // `supabase.channel(topic)` hands back a channel still listed as leaving, whose subscribe() is a
  // no-op. So nothing is re-created until the previous removal has actually settled.
  it('waits for the previous removal to settle before creating the replacement channel', async () => {
    let settle!: () => void;
    mockRemoveChannel.mockReturnValueOnce(new Promise<void>((resolve) => { settle = resolve; }));
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    await Promise.resolve();
    expect(mockChannel).toHaveBeenCalledTimes(1);

    settle();
    await jest.runAllTimersAsync();
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });

  it('a new subscriber to a topic still being removed gets a channel once the removal settles', async () => {
    let settle!: () => void;
    mockRemoveChannel.mockReturnValueOnce(new Promise<void>((resolve) => { settle = resolve; }));
    const release = subscribeToBroadcast('user:u1', { message: jest.fn() });
    release();

    subscribeToBroadcast('user:u1', { message: jest.fn() });
    expect(mockChannel).toHaveBeenCalledTimes(1);

    settle();
    await jest.runAllTimersAsync();
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });

  it('doubles the delay on consecutive failures and caps it at the max', () => {
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });

    let expected = INITIAL_RETRY_DELAY_MS;
    for (let attempt = 1; attempt <= 8; attempt++) {
      channels[channels.length - 1].fire('CHANNEL_ERROR');
      jest.advanceTimersByTime(expected - 1);
      expect(mockChannel).toHaveBeenCalledTimes(attempt);
      jest.advanceTimersByTime(1);
      expect(mockChannel).toHaveBeenCalledTimes(attempt + 1);
      expected = Math.min(expected * 2, MAX_RETRY_DELAY_MS);
    }
    expect(expected).toBe(MAX_RETRY_DELAY_MS);
  });

  it('invokes every subscriber\'s onReconnected after a resubscribe, but not on the initial subscribe', () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() }, a);
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() }, b);

    channels[0].fire('SUBSCRIBED');
    expect(a).not.toHaveBeenCalled();

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    channels[1].fire('SUBSCRIBED');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    channels[1].fire('SUBSCRIBED');
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('resets the backoff after a successful resubscribe', () => {
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    channels[1].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS * 2);
    expect(mockChannel).toHaveBeenCalledTimes(3);

    channels[2].fire('SUBSCRIBED');
    channels[2].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(mockChannel).toHaveBeenCalledTimes(4);
  });

  it('releasing the last subscriber cancels any pending retry', () => {
    const release = subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    channels[0].fire('CHANNEL_ERROR');
    release();
    jest.advanceTimersByTime(MAX_RETRY_DELAY_MS * 2);
    expect(mockChannel).toHaveBeenCalledTimes(1);
  });

  it('ignores late status callbacks from a channel that was already replaced', () => {
    subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(mockChannel).toHaveBeenCalledTimes(2);

    channels[0].fire('CLOSED');
    jest.advanceTimersByTime(MAX_RETRY_DELAY_MS * 2);
    expect(mockChannel).toHaveBeenCalledTimes(2);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it('ignores the CLOSED its own removal produces', () => {
    const release = subscribeToBroadcast('chat:m1', { INSERT: jest.fn() });
    release();
    channels[0].fire('CLOSED');
    jest.advanceTimersByTime(MAX_RETRY_DELAY_MS * 2);
    expect(mockChannel).toHaveBeenCalledTimes(1);
  });

  it('one subscriber throwing does not starve the others', () => {
    const b = jest.fn();
    subscribeToBroadcast('chat:m1', { INSERT: () => { throw new Error('boom'); } });
    subscribeToBroadcast('chat:m1', { INSERT: b });

    channels[0].emit('INSERT', {});
    expect(b).toHaveBeenCalledTimes(1);
  });
});
