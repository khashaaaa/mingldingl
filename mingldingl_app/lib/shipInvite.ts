import { API_BASE_URL } from './api/api';
import { i18n } from './i18n';

export function shipInviteUrl(code: string): string {
  return `${API_BASE_URL}/public/ship?code=${encodeURIComponent(code)}`;
}

export function shipInviteMessage(code: string): string {
  return String(i18n.t('ship_invite_message', { code, url: shipInviteUrl(code) }));
}
