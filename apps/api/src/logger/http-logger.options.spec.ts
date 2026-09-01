import {
  createHttpLoggerOptions,
  isSensitiveHeader,
  sanitizeHeaders,
} from './http-logger.options';

describe('http logger options', () => {
  it('redacts sensitive request headers while keeping safe metadata', () => {
    const headers = sanitizeHeaders({
      authorization: 'Bearer token',
      cookie: 'session=value',
      'set-cookie': 'refresh=value',
      'x-refresh-token': 'refresh-token',
      'refresh-token': 'refresh-token',
      'x-api-key': 'api-key',
      'x-request-id': 'request-id',
    });

    expect(headers.authorization).toBe('[Redacted]');
    expect(headers.cookie).toBe('[Redacted]');
    expect(headers['set-cookie']).toBe('[Redacted]');
    expect(headers['x-refresh-token']).toBe('[Redacted]');
    expect(headers['refresh-token']).toBe('[Redacted]');
    expect(headers['x-api-key']).toBe('[Redacted]');
    expect(headers['x-request-id']).toBe('request-id');
  });

  it('detects refresh token and API key header variants', () => {
    expect(isSensitiveHeader('x-refresh-token')).toBe(true);
    expect(isSensitiveHeader('x-api-key')).toBe(true);
    expect(isSensitiveHeader('x-request-id')).toBe(false);
  });

  it('does not enable pretty transport outside development', () => {
    expect(createHttpLoggerOptions('test').transport).toBeUndefined();
    expect(createHttpLoggerOptions('production').transport).toBeUndefined();
    expect(createHttpLoggerOptions('development').transport).toBeDefined();
  });
});
