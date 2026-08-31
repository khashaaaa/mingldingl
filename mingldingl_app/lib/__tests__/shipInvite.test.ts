import { shipInviteMessage, shipInviteUrl } from '../shipInvite';
import { API_BASE_URL } from '../api/api';
import { i18n } from '../i18n';

describe('shipInvite', () => {
  afterEach(() => { i18n.locale = 'en'; });

  it('builds the public landing URL from the API base URL with the code as a query param', () => {
    expect(shipInviteUrl('ABC 123')).toBe(`${API_BASE_URL}/public/ship?code=ABC%20123`);
  });

  it('includes both the raw code and the landing URL in the share message', () => {
    const message = shipInviteMessage('FOX392');
    expect(message).toContain('FOX392');
    expect(message).toContain(`${API_BASE_URL}/public/ship?code=FOX392`);
  });

  it('does the same in Mongolian', () => {
    i18n.locale = 'mn';
    const message = shipInviteMessage('FOX392');
    expect(message).toContain('кодыг');
    expect(message).toContain(`${API_BASE_URL}/public/ship?code=FOX392`);
  });
});
