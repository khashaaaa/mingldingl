import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import { useVideoCall } from '../useVideoCall';
import { apiClient } from '../../lib/api/apiClient';
import { i18n } from '../../lib/i18n';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    video: {
      token: jest.fn(),
    },
  },
}));

const mockApi = apiClient as unknown as {
  video: {
    token: jest.Mock;
  };
};

describe('useVideoCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('token fetch', () => {
    it('starts in a loading state with no token or error', async () => {
      let resolveToken: (v: any) => void = () => {};
      mockApi.video.token.mockReturnValue(new Promise((resolve) => { resolveToken = resolve; }));

      const { result } = renderHook(() => useVideoCall('m1'));

      expect(result.current.loading).toBe(true);
      expect(result.current.token).toBeNull();
      expect(result.current.error).toBeNull();

      await act(async () => {
        resolveToken({ token: 't', channelName: 'c', appId: 'a' });
        await Promise.resolve();
      });
    });

    it('sets token and clears loading on a successful fetch', async () => {
      mockApi.video.token.mockResolvedValue({ token: 'tok123', channelName: 'chan1', appId: 'app1' });

      const { result } = renderHook(() => useVideoCall('m1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.token).toEqual({ token: 'tok123', channelName: 'chan1', appId: 'app1' });
      expect(result.current.error).toBeNull();
      expect(mockApi.video.token).toHaveBeenCalledWith('m1');
    });

    it('defaults missing token fields to empty strings', async () => {
      mockApi.video.token.mockResolvedValue({});

      const { result } = renderHook(() => useVideoCall('m1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.token).toEqual({ token: '', channelName: '', appId: '' });
    });

    it('falls back to a translated message and clears loading, leaving token null, when the fetch rejects with a non-axios error', async () => {
      mockApi.video.token.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useVideoCall('m1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe(i18n.t('video_unavailable'));
      expect(result.current.token).toBeNull();
    });

    it("translates the engine's known error message when the fetch rejects with a structured axios error", async () => {
      const axiosErr = new AxiosError('Request failed with status code 403');
      axiosErr.response = {
        status: 403,
        data: { error: 'Video call not unlocked for this match' },
      } as AxiosError['response'];
      mockApi.video.token.mockRejectedValue(axiosErr);

      const { result } = renderHook(() => useVideoCall('m1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe(i18n.t('video_error_not_unlocked'));
      expect(result.current.token).toBeNull();
    });

    it("falls back to the engine's raw message when it doesn't match a known error", async () => {
      const axiosErr = new AxiosError('Request failed with status code 500');
      axiosErr.response = {
        status: 500,
        data: { error: 'Something the client has no translation for' },
      } as AxiosError['response'];
      mockApi.video.token.mockRejectedValue(axiosErr);

      const { result } = renderHook(() => useVideoCall('m1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('Something the client has no translation for');
      expect(result.current.token).toBeNull();
    });

    it('re-fetches when matchId changes', async () => {
      mockApi.video.token.mockResolvedValue({ token: 't1', channelName: 'c1', appId: 'a1' });

      const { result, rerender } = renderHook(({ matchId }) => useVideoCall(matchId), {
        initialProps: { matchId: 'm1' },
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockApi.video.token).toHaveBeenCalledWith('m1');

      mockApi.video.token.mockResolvedValue({ token: 't2', channelName: 'c2', appId: 'a2' });
      rerender({ matchId: 'm2' });

      await waitFor(() => expect(result.current.token?.token).toBe('t2'));
      expect(mockApi.video.token).toHaveBeenCalledWith('m2');
      expect(mockApi.video.token).toHaveBeenCalledTimes(2);
    });
  });

  describe('local mute / camera toggle state', () => {
    it('defaults muted and cameraOff to false and toggles independently', async () => {
      mockApi.video.token.mockResolvedValue({ token: 't', channelName: 'c', appId: 'a' });

      const { result } = renderHook(() => useVideoCall('m1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.muted).toBe(false);
      expect(result.current.cameraOff).toBe(false);

      act(() => {
        result.current.setMuted(true);
      });
      expect(result.current.muted).toBe(true);
      expect(result.current.cameraOff).toBe(false);

      act(() => {
        result.current.setCameraOff(true);
      });
      expect(result.current.muted).toBe(true);
      expect(result.current.cameraOff).toBe(true);

      act(() => {
        result.current.setMuted(false);
      });
      expect(result.current.muted).toBe(false);
      expect(result.current.cameraOff).toBe(true);
    });

    it('mute/camera state survives a token fetch failure', async () => {
      mockApi.video.token.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useVideoCall('m1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setMuted(true);
        result.current.setCameraOff(true);
      });

      expect(result.current.muted).toBe(true);
      expect(result.current.cameraOff).toBe(true);
      expect(result.current.error).toBe(i18n.t('video_unavailable'));
    });
  });
});
