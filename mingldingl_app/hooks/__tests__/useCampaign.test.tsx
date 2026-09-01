import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { useCampaign } from '../useCampaign';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    matches: {
      campaign: jest.fn(),
      claimCampaignRoom: jest.fn(),
    },
  },
}));

const mockedCampaign = apiClient.matches.campaign as jest.Mock;
const mockedClaim = apiClient.matches.claimCampaignRoom as jest.Mock;

function wrapperFor() {
  const qc = createAppQueryClient({ queries: { retry: false }, mutations: { retry: false } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

const serverResponse = {
  rooms: [
    { roomId: 'gate', cleared: true, claimed: false, bonusScore: 5 },
    { roomId: 'echoes', cleared: false, claimed: false, bonusScore: 5 },
  ],
  clearedCount: 1,
  bossCleared: false,
};

describe('useCampaign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and parses the campaign for the match', async () => {
    mockedCampaign.mockResolvedValue(serverResponse);
    const { wrapper } = wrapperFor();

    const { result } = renderHook(() => useCampaign('m1'), { wrapper });

    await waitFor(() => expect(result.current.campaign).not.toBeNull());
    expect(mockedCampaign).toHaveBeenCalledWith('m1');
    expect(result.current.campaign!.rooms).toHaveLength(2);
    expect(result.current.campaign!.rooms[0]).toEqual({
      roomId: 'gate', cleared: true, claimed: false, bonusScore: 5,
    });
    expect(result.current.campaign!.clearedCount).toBe(1);
    expect(result.current.unavailable).toBe(false);
  });

  it('reports unavailable on a 404 instead of an error', async () => {
    const err = Object.assign(new Error('not found'), {
      isAxiosError: true,
      response: { status: 404 },
    });
    mockedCampaign.mockRejectedValue(err);
    const { wrapper } = wrapperFor();

    const { result } = renderHook(() => useCampaign('m1'), { wrapper });

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('claims a room and refetches the campaign', async () => {
    mockedCampaign.mockResolvedValue(serverResponse);
    mockedClaim.mockResolvedValue({ awarded: 5, droppedItem: null });
    const { wrapper } = wrapperFor();

    const { result } = renderHook(() => useCampaign('m1'), { wrapper });
    await waitFor(() => expect(result.current.campaign).not.toBeNull());

    act(() => result.current.claimRoom('gate'));

    await waitFor(() => expect(mockedClaim).toHaveBeenCalledWith('m1', 'gate'));
    // The claim invalidates the campaign query, so the server state is refetched.
    await waitFor(() => expect(mockedCampaign.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
