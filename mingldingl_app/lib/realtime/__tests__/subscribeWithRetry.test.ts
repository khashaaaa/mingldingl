import { supabase } from '../../supabase';
import {
  subscribeWithRetry,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from '../subscribeWithRetry';

jest.mock('../../supabase', () => ({
  supabase: {
    removeChannel: jest.fn(),
  },
}));

const mockRemoveChannel = supabase.removeChannel as jest.Mock;

type StatusCallback = (status: string) => void;

interface FakeChannel {
  subscribe: jest.Mock;
  fire: (status: string) => void;
}

function makeFakeChannel(): FakeChannel {
  let callback: StatusCallback = () => {};
  const channel: Partial<FakeChannel> = {
    subscribe: jest.fn((cb: StatusCallback) => {
      callback = cb;
      return channel;
    }),
  };
  channel.fire = (status: string) => callback(status);
  return channel as FakeChannel;
}

describe('subscribeWithRetry', () => {
  let channels: FakeChannel[];
  let createChannel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    channels = [];
    createChannel = jest.fn(() => {
      const ch = makeFakeChannel();
      channels.push(ch);
      return ch;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates and subscribes a channel immediately', () => {
    subscribeWithRetry(createChannel as never);
    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(channels[0].subscribe).toHaveBeenCalledTimes(1);
  });

  it('on CHANNEL_ERROR, removes the channel and resubscribes a fresh one after the initial delay', () => {
    subscribeWithRetry(createChannel as never);
    channels[0].fire('CHANNEL_ERROR');

    expect(mockRemoveChannel).toHaveBeenCalledWith(channels[0]);
    expect(createChannel).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS - 1);
    expect(createChannel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(createChannel).toHaveBeenCalledTimes(2);
    expect(channels[1].subscribe).toHaveBeenCalledTimes(1);
  });

  it('on TIMED_OUT, also retries', () => {
    subscribeWithRetry(createChannel as never);
    channels[0].fire('TIMED_OUT');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(createChannel).toHaveBeenCalledTimes(2);
  });

  it('does not retry on CLOSED', () => {
    subscribeWithRetry(createChannel as never);
    channels[0].fire('CLOSED');
    jest.advanceTimersByTime(MAX_RETRY_DELAY_MS * 2);
    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it('doubles the delay on consecutive failures and caps it at the max', () => {
    subscribeWithRetry(createChannel as never);

    let expected = INITIAL_RETRY_DELAY_MS;
    for (let attempt = 1; attempt <= 8; attempt++) {
      channels[channels.length - 1].fire('CHANNEL_ERROR');
      jest.advanceTimersByTime(expected - 1);
      expect(createChannel).toHaveBeenCalledTimes(attempt);
      jest.advanceTimersByTime(1);
      expect(createChannel).toHaveBeenCalledTimes(attempt + 1);
      expected = Math.min(expected * 2, MAX_RETRY_DELAY_MS);
    }

    expect(expected).toBe(MAX_RETRY_DELAY_MS);
  });

  it('invokes onReconnected on a successful resubscribe after a failure, but not on the initial subscribe', () => {
    const onReconnected = jest.fn();
    subscribeWithRetry(createChannel as never, onReconnected);

    channels[0].fire('SUBSCRIBED');
    expect(onReconnected).not.toHaveBeenCalled();

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    channels[1].fire('SUBSCRIBED');
    expect(onReconnected).toHaveBeenCalledTimes(1);

    channels[1].fire('SUBSCRIBED');
    expect(onReconnected).toHaveBeenCalledTimes(1);
  });

  it('resets the backoff after a successful resubscribe', () => {
    subscribeWithRetry(createChannel as never);

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    channels[1].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS * 2);
    expect(createChannel).toHaveBeenCalledTimes(3);

    channels[2].fire('SUBSCRIBED');
    channels[2].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(createChannel).toHaveBeenCalledTimes(4);
  });

  it('cleanup removes the live channel and cancels any pending retry', () => {
    const cleanup = subscribeWithRetry(createChannel as never);
    cleanup();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channels[0]);

    const cleanup2Channels: FakeChannel[] = [];
    const create2 = jest.fn(() => {
      const ch = makeFakeChannel();
      cleanup2Channels.push(ch);
      return ch;
    });
    const cleanup2 = subscribeWithRetry(create2 as never);
    cleanup2Channels[0].fire('CHANNEL_ERROR');
    cleanup2();
    jest.advanceTimersByTime(MAX_RETRY_DELAY_MS * 2);
    expect(create2).toHaveBeenCalledTimes(1);
  });

  it('ignores late status callbacks from a channel that was already replaced', () => {
    const onReconnected = jest.fn();
    subscribeWithRetry(createChannel as never, onReconnected);

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(INITIAL_RETRY_DELAY_MS);
    expect(createChannel).toHaveBeenCalledTimes(2);

    channels[0].fire('CHANNEL_ERROR');
    jest.advanceTimersByTime(MAX_RETRY_DELAY_MS * 2);
    expect(createChannel).toHaveBeenCalledTimes(2);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
