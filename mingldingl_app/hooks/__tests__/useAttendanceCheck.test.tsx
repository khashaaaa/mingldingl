import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAttendanceCheck } from '../useAttendanceCheck';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    activities: {
      attendanceCheckStatus: jest.fn(),
      attendanceCheckSubmit: jest.fn(),
    },
  },
}));

const mockApi = apiClient as unknown as {
  activities: {
    attendanceCheckStatus: jest.Mock;
    attendanceCheckSubmit: jest.Mock;
  };
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAttendanceCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reflects due=false and null activityTitle when not due', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: false, activityTitle: null });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.due).toBe(false);
    expect(result.current.activityTitle).toBeNull();
  });

  it('reflects due=true with the activity title', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: true, activityTitle: 'Coffee Date' });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.due).toBe(true));
    expect(result.current.activityTitle).toBe('Coffee Date');
  });

  it('submit calls the API with the given answer', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: true, activityTitle: 'Coffee Date' });
    mockApi.activities.attendanceCheckSubmit.mockResolvedValue({ attended: true });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.due).toBe(true));

    await act(async () => {
      result.current.submit(true);
    });

    expect(mockApi.activities.attendanceCheckSubmit).toHaveBeenCalledWith('m1', { attended: true });
  });

  it('clears due locally on successful submit, without waiting for a refetch', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: true, activityTitle: 'Coffee Date' });
    mockApi.activities.attendanceCheckSubmit.mockResolvedValue({ attended: false });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.due).toBe(true));

    await act(async () => {
      result.current.submit(false);
    });

    await waitFor(() => expect(result.current.due).toBe(false));
    expect(result.current.activityTitle).toBeNull();
  });

  it('reports submitFailed so a lost answer is not mistaken for a recorded one', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: true, activityTitle: 'Coffee' });
    mockApi.activities.attendanceCheckSubmit.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(makeQueryClient()) });
    await waitFor(() => expect(result.current.due).toBe(true));

    await act(async () => { result.current.submit(true); });

    await waitFor(() => expect(result.current.submitFailed).toBe(true));
    // The prompt must stay outstanding — attendance feeds the no-show reputation penalty.
    expect(result.current.due).toBe(true);

    await act(async () => { result.current.clearSubmitFailed(); });
    await waitFor(() => expect(result.current.submitFailed).toBe(false));
  });
});
