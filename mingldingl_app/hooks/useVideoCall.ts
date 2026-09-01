import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api/apiClient';
import { getApiErrorMessage } from '../lib/api/errors';
import { i18n } from '../lib/i18n';

export interface VideoToken {
  token: string;
  channelName: string;
  appId: string;
}

export function useVideoCall(matchId: string) {
  const [token, setToken] = useState<VideoToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    apiClient.video.token(matchId)
      .then((r) => {
        if (cancelled) return;
        setToken({ token: r.token ?? '', channelName: r.channelName ?? '', appId: r.appId ?? '' });
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(getApiErrorMessage(e, i18n.t('video_unavailable')));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [matchId]);

  return { token, loading, error, muted, setMuted, cameraOff, setCameraOff };
}
