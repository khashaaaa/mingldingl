import { scrubEvent, scrubText } from '../sentry';

test('phone numbers and tokens are scrubbed from text', () => {
  expect(scrubText('call 99112233 with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc')).toBe(
    'call [phone] with [token]',
  );
  expect(scrubText('123456789 is not a phone')).toBe('123456789 is not a phone');
});

test('request data, user and auth header are removed', () => {
  const e = scrubEvent({
    type: undefined,
    user: { id: 'x' },
    message: 'for 88001122',
    request: {
      data: { phone: '88001122' },
      query_string: 'p=1',
      headers: { Authorization: 'Bearer t', Accept: '*/*' },
    },
  });
  expect(e.user).toBeUndefined();
  expect(e.request?.data).toBeUndefined();
  expect(e.request?.headers).toEqual({ Accept: '*/*' });
  expect(e.message).toBe('for [phone]');
});
