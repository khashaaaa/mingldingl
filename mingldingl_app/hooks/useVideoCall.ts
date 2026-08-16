import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api/apiClient';
import { getApiErrorMessage } from '../lib/api/errors';
import { i18n } from '../lib/i18n';

export interface VideoToken {
  token: string;
  channelName: string;
  appId: string;
}

// Maps the engine's raw error strings (VideoController) to i18n keys, same
// pattern as ship/new.tsx's SHIP_ERROR_I18N_KEYS — getApiErrorMessage's
// fallback-to-raw-string behavior is fine for developer-facing errors, but
// this one is rendered directly to the user and was always showing in
// English regardless of app locale.
const VIDEO_ERROR_I18N_KEYS: Record<string, string> = {
  'Match not found': 'video_error_match_not_found',
  'Video call not unlocked for this match': 'video_error_not_unlocked',
  'You are not a participant in this match': 'video_error_not_participant',
  'Video call reward already claimed for this match': 'video_error_reward_claimed',
};

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
        const raw = getApiErrorMessage(e, '');
        const key = raw ? VIDEO_ERROR_I18N_KEYS[raw] : undefined;
        setError(key ? i18n.t(key) : raw || i18n.t('video_unavailable'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [matchId]);

  return { token, loading, error, muted, setMuted, cameraOff, setCameraOff };
}
