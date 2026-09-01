import { AxiosError } from 'axios';
import { getApiErrorMessage, apiErrorCode, isApiError } from '../errors';
import { i18n } from '../../i18n';
import { translations } from '../../i18n';

function apiError(body: unknown, status = 400): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { status, data: body, statusText: '', headers: {}, config: {} as never };
  return err;
}

describe('getApiErrorMessage', () => {
  afterEach(() => { i18n.locale = 'en'; });

  it('localises from the engine error code', () => {
    const msg = getApiErrorMessage(
      apiError({ error: 'Match not found', code: 'match.not_found' }),
      'fallback',
    );
    expect(msg).toBe("That bond couldn't be found.");
  });

  it('localises into Mongolian when that is the active locale', () => {
    i18n.locale = 'mn';
    const msg = getApiErrorMessage(
      apiError({ error: 'Match not found', code: 'match.not_found' }),
      'fallback',
    );
    expect(msg).toBe('Тухайн холбоо олдсонгүй.');
  });

  // The whole point: the server's English must never reach the user.
  it('never returns the raw server message', () => {
    const msg = getApiErrorMessage(
      apiError({ error: 'Some brand new English sentence', code: 'not.mapped.yet' }),
      'localised fallback',
    );
    expect(msg).toBe('localised fallback');
  });

  it('falls back when the response carries no code at all', () => {
    const msg = getApiErrorMessage(apiError({ error: 'Legacy shape' }), 'localised fallback');
    expect(msg).toBe('localised fallback');
  });

  it('falls back for a non-axios failure', () => {
    expect(getApiErrorMessage(new Error('boom'), 'localised fallback')).toBe('localised fallback');
  });

  it('exposes the raw code for callers that branch on it', () => {
    expect(apiErrorCode(apiError({ code: 'rite.no_proposal' }))).toBe('rite.no_proposal');
    expect(isApiError(apiError({ code: 'rite.no_proposal' }), 'rite.no_proposal')).toBe(true);
    expect(isApiError(apiError({ code: 'rite.no_proposal' }), 'match.not_found')).toBe(false);
    expect(apiErrorCode(new Error('boom'))).toBeNull();
  });
});

describe('error copy', () => {
  const errKeys = (locale: 'en' | 'mn') =>
    Object.keys(translations[locale]).filter((k) => k.startsWith('err_'));

  it('has every error key in both locales', () => {
    expect(errKeys('mn').sort()).toEqual(errKeys('en').sort());
    expect(errKeys('en').length).toBeGreaterThan(70);
  });

  it('has no untranslated English left in the Mongolian error copy', () => {
    const mn = translations.mn as Record<string, string>;
    const latin = errKeys('mn').filter((k) => /[A-Za-z]/.test(mn[k]));
    expect(latin).toEqual([]);
  });
});
