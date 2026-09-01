import { Alert } from 'react-native';
import { createAppQueryClient } from '../queryClient';

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
  beforeEach(() => jest.clearAllMocks());

  it('tells the user when a read fails, so a failure is not mistaken for an empty screen', async () => {
    await failingQuery(client());

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a query that renders its own error state', async () => {
    await failingQuery(client(), { silentError: true });

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('surfaces the server message when the response carries one', async () => {
    const qc = client();
    await qc
      .fetchQuery({
        queryKey: ['boom'],
        queryFn: () =>
          Promise.reject(
            Object.assign(new Error('Request failed'), {
              isAxiosError: true,
              response: { data: { error: 'Daily match budget exhausted' } },
            }),
          ),
      })
      .catch(() => {});

    expect(mockAlert).toHaveBeenCalledWith(expect.any(String), 'Daily match budget exhausted');
  });

  it('speaks up once when a dropped connection fails many queries at once', async () => {
    const qc = client();

    await Promise.all(Array.from({ length: 5 }, () => failingQuery(qc)));

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });
});
