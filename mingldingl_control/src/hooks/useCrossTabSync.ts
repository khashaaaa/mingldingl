import { useEffect } from 'react';
import { TOKEN_KEY } from '@/lib/auth';
import { THEME_KEY } from '@/lib/theme';

export function useCrossTabSync() {
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === TOKEN_KEY) {
        if (e.newValue === null) window.location.assign('/login');
        else window.location.reload();
      } else if (e.key === THEME_KEY) {
        document.documentElement.classList.toggle('dark', e.newValue === 'dark');
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
