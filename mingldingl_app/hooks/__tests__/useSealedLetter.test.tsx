import { act, renderHook } from '@testing-library/react-native';
import { useSealedLetter } from '../useSealedLetter';
import type { Message } from '../useChat';

const ME = 'u-me';
const THEM = 'u-them';

function msg(id: string, senderId: string, status: Message['status'] = 'sent'): Message {
  return { id, matchId: 'm1', senderId, content: 'Сайн уу', createdAt: '2026-09-10T10:00:00Z', status };
}

type Props = { matchId?: string; messages: Message[]; myId?: string | null; hasMore?: boolean };

function run(initial: Props) {
  // `myId` is merged rather than defaulted in the destructure, so an explicit `undefined` survives.
  const hook = renderHook(
    ({ matchId = 'm1', messages, myId, hasMore = false }: Props) =>
      useSealedLetter(matchId, messages, myId, hasMore),
    { initialProps: { myId: ME, ...initial } },
  );
  return { ...hook, rerender: (next: Props) => hook.rerender({ myId: ME, ...next }) };
}

describe('useSealedLetter', () => {
  it('seals a lone incoming message on a fully loaded thread', () => {
    const { result } = run({ messages: [msg('a', THEM)] });
    expect(result.current.sealedMessageId).toBe('a');
  });

  it('never seals your own first word', () => {
    expect(run({ messages: [msg('a', ME)] }).result.current.sealedMessageId).toBeNull();
    // An optimistic row still in flight carries `'me'` as its sender.
    expect(run({ messages: [msg('a', 'me', 'sending')] }).result.current.sealedMessageId).toBeNull();
  });

  it('waits for your own id rather than treating unknown as theirs', () => {
    expect(run({ messages: [msg('a', THEM)], myId: undefined }).result.current.sealedMessageId).toBeNull();
    expect(run({ messages: [msg('a', THEM)], myId: null }).result.current.sealedMessageId).toBeNull();
  });

  it('is not a first word while older pages may still exist', () => {
    const { result } = run({ messages: [msg('a', THEM)], hasMore: true });
    expect(result.current.sealedMessageId).toBeNull();
  });

  it('does not seal an empty thread or a conversation of two', () => {
    expect(run({ messages: [] }).result.current.sealedMessageId).toBeNull();
    expect(run({ messages: [msg('a', THEM), msg('b', ME)] }).result.current.sealedMessageId).toBeNull();
    expect(run({ messages: [msg('a', THEM), msg('b', THEM)] }).result.current.sealedMessageId).toBeNull();
  });

  it('clears after unseal and stays open on rerender with the same message', () => {
    const { result, rerender } = run({ messages: [msg('a', THEM)] });
    expect(result.current.sealedMessageId).toBe('a');

    act(() => result.current.unseal());
    expect(result.current.sealedMessageId).toBeNull();

    // A refetch hands back a fresh array holding the same row; the wax stays broken.
    rerender({ messages: [msg('a', THEM)] });
    expect(result.current.sealedMessageId).toBeNull();
  });

  it('seals the moment the first word lands while you are watching', () => {
    const { result, rerender } = run({ messages: [] });
    expect(result.current.sealedMessageId).toBeNull();
    rerender({ messages: [msg('a', THEM)] });
    expect(result.current.sealedMessageId).toBe('a');
  });

  it('remembers the break per match, not across matches', () => {
    const { result, rerender } = run({ matchId: 'm1', messages: [msg('a', THEM)] });
    act(() => result.current.unseal());
    expect(result.current.sealedMessageId).toBeNull();

    rerender({ matchId: 'm2', messages: [msg('z', THEM)] });
    expect(result.current.sealedMessageId).toBe('z');

    rerender({ matchId: 'm1', messages: [msg('a', THEM)] });
    expect(result.current.sealedMessageId).toBeNull();
  });
});
