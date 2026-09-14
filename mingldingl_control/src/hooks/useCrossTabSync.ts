import { useEffect } from 'react';
import { TOKEN_KEY } from '@/lib/auth';
import { THEME_KEY, syncTheme } from '@/lib/theme';
import { clearSessionExpired, isSessionExpired, markSessionExpired } from '@/lib/session';
import { queryClient } from '@/lib/api/queryClient';

export function useCrossTabSync() {
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === TOKEN_KEY) {
        if (e.newValue === null) {
          if (window.location.pathname.startsWith('/login')) return;
          markSessionExpired();
        } else if (isSessionExpired()) {
          clearSessionExpired();
          queryClient.invalidateQueries();
        } else {
          window.location.reload();
        }
      } else if (e.key === THEME_KEY) {
        syncTheme(e.newValue === 'dark' ? 'dark' : 'light');
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
