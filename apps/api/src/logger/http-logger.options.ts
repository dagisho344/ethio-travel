import { IncomingMessage, ServerResponse } from 'node:http';
import { Options } from 'pino-http';

const REDACTED = '[Redacted]';
const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /^api-key$/i,
  /^apikey$/i,
  /^x-refresh-token$/i,
  /^refresh-token$/i,
  /refresh.*token/i,
  /api.*key/i,
];

export type SafeHeaders = Record<string, string | string[] | undefined>;

type SerializableRequest = IncomingMessage & {
  id?: string | number;
  remoteAddress?: string;
  remotePort?: number;
};

export function sanitizeHeaders(headers: SafeHeaders = {}): SafeHeaders {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      isSensitiveHeader(key) ? REDACTED : value,
    ]),
  );
}

export function isSensitiveHeader(headerName: string): boolean {
  return SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(headerName));
}

export function createHttpLoggerOptions(nodeEnv: string | undefined): Options {
  return {
    level: nodeEnv === 'production' ? 'info' : 'debug',
    redact: {
      censor: REDACTED,
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.set-cookie',
        'req.headers.x-api-key',
        'req.headers.api-key',
        'req.headers.apikey',
        'req.headers.x-refresh-token',
        'req.headers.refresh-token',
        'req.raw.headers.authorization',
        'req.raw.headers.cookie',
        'req.raw.headers.set-cookie',
        'req.raw.headers.x-api-key',
        'req.raw.headers.api-key',
        'req.raw.headers.apikey',
        'req.raw.headers.x-refresh-token',
        'req.raw.headers.refresh-token',
        'res.headers.set-cookie',
      ],
    },
    serializers: {
      req(request: SerializableRequest) {
        return {
          id: request.id,
          method: request.method,
          remoteAddress: request.socket?.remoteAddress ?? request.remoteAddress,
          remotePort: request.socket?.remotePort ?? request.remotePort,
          url: request.url,
          headers: sanitizeHeaders(request.headers),
        };
      },
      res(response: ServerResponse) {
        return {
          statusCode: response.statusCode,
        };
      },
    },
    transport:
      nodeEnv === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              singleLine: true,
            },
          }
        : undefined,
  };
}
