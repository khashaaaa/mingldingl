import { ApiError } from '@/lib/api/client';
import { CUT_AFTER_MS, isRoadCut, roadDown, roadUp } from '@/lib/live/road';
import { flushOutbox, resetOutbox, sendLetter } from '../outbox';

jest.mock('@/lib/api/generated/engine', () => ({ writeLetter: jest.fn() }));
jest.mock('@/lib/toast', () => ({ toast: jest.fn() }));
jest.mock('@/lib/query', () => ({ queryClient: { refetchQueries: jest.fn(async () => {}) } }));

const { writeLetter } = jest.requireMock('@/lib/api/generated/engine') as { writeLetter: jest.Mock };
const { toast } = jest.requireMock('@/lib/toast') as { toast: jest.Mock };

const offline = () => new ApiError('network', 0, 'network', 'offline');
const sent = () => writeLetter.mock.calls.map(([bond, { text }]) => `${bond}:${text}`);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  roadUp();
  resetOutbox();
  writeLetter.mockResolvedValue({});
});
afterEach(() => jest.useRealTimers());

test('the road is cut only after the connection has stayed down', () => {
  roadDown();
  jest.advanceTimersByTime(CUT_AFTER_MS - 1);
  expect(isRoadCut()).toBe(false);
  roadUp();
  jest.advanceTimersByTime(CUT_AFTER_MS);
  expect(isRoadCut()).toBe(false);

  roadDown();
  jest.advanceTimersByTime(CUT_AFTER_MS);
  expect(isRoadCut()).toBe(true);
});

test('with the road open a letter goes straight out', async () => {
  expect(await sendLetter('b1', 'Hello')).toBe(true);
  expect(sent()).toEqual(['b1:Hello']);
});

test('letters written on a cut road wait, then go in order when it opens', async () => {
  roadDown();
  jest.advanceTimersByTime(CUT_AFTER_MS);
  await sendLetter('b1', 'one');
  await sendLetter('b2', 'two');
  await sendLetter('b1', 'three');
  expect(writeLetter).not.toHaveBeenCalled();

  roadUp();
  await jest.runAllTimersAsync();
  expect(sent()).toEqual(['b1:one', 'b2:two', 'b1:three']);
});

test('a send that fails on the network is held and retried; later letters queue behind it', async () => {
  writeLetter.mockRejectedValueOnce(offline());
  expect(await sendLetter('b1', 'first')).toBe(true);
  await sendLetter('b1', 'second');
  expect(sent()).toEqual(['b1:first']);

  await jest.advanceTimersByTimeAsync(5_000);
  expect(sent()).toEqual(['b1:first', 'b1:first', 'b1:second']);
});

test('a letter the engine refuses is dropped with its reason and the rest still go', async () => {
  roadDown();
  jest.advanceTimersByTime(CUT_AFTER_MS);
  await sendLetter('b1', 'too late');
  await sendLetter('b2', 'fine');
  writeLetter.mockRejectedValueOnce(new ApiError('rule', 409, 'bond.closed', 'This bond is closed'));
  roadUp();
  await flushOutbox();
  expect(toast).toHaveBeenCalledWith('error', 'The letters are closed.');
  expect(sent()).toEqual(['b1:too late', 'b2:fine']);
});

test('a refusal while sending directly is the caller’s to show', async () => {
  writeLetter.mockRejectedValueOnce(new ApiError('rule', 409, 'bond.closed', 'closed'));
  await expect(sendLetter('b1', 'x')).rejects.toBeInstanceOf(ApiError);
});
