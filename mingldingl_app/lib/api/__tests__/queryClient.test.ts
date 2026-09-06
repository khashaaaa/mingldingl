import { Alert } from 'react-native';
import { createAppQueryClient } from '../queryClient';
import { useAuthStore } from '../../../store/authStore';

// Spy rather than mock the module: react-native is pulled in transitively by i18n and the
// theme, and replacing it wholesale breaks those imports.
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

function client() {
  // Retries off so a rejection surfaces immediately.
  return createAppQueryClient({ queries: { retry: false }, mutations: { retry: false } });
}

async function failingQuery(qc: ReturnType<typeof client>, meta?: Record<string, unknown>) {
  await qc
    .fetchQuery({
      queryKey: ['boom', Math.random()],
      queryFn: () => Promise.reject(new Error('network down')),
      ...(meta ? { meta } : {}),
    })
    .catch(() => {});
}

describe('query error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: { access_token: 't' } as never });
  });

  // Signing out clears the token and the cache mid-flight, so whatever was in the air 401s. That
  // is teardown noise, not something the user needs an alert about — and every read this handler
  // can see is session-gated, so with no session there is no genuine failure left to report.
  it('stays quiet once the user is signed out', async () => {
    useAuthStore.setState({ session: null });

    await failingQuery(client());

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('tells the user when a read fails, so a failure is not mistaken for an empty screen', async () => {
    await failingQuery(client());

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a query that renders its own error state', async () => {
    await failingQuery(client(), { silentError: true });

    expect(mockAlert).not.toHaveBeenCalled();
  });

  // The server's English is for logs. The user gets copy localised from the error code.
  it('shows copy localised from the error code, not the server message', async () => {
    const qc = client();
    await qc
      .fetchQuery({
        queryKey: ['boom'],
        queryFn: () =>
          Promise.reject(
            Object.assign(new Error('Request failed'), {
              isAxiosError: true,
              response: {
                data: { error: 'Daily match budget exhausted', code: 'match.daily_budget_spent' },
              },
            }),
          ),
      })
      .catch(() => {});

    expect(mockAlert).toHaveBeenCalledWith(
      expect.any(String),
      'All summons spent — the realm rests until dawn.',
    );
  });

  it('speaks up once when a dropped connection fails many queries at once', async () => {
    const qc = client();

    await Promise.all(Array.from({ length: 5 }, () => failingQuery(qc)));

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });
});
