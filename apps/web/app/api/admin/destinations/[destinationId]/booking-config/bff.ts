import type { NextRequest } from 'next/server';
import { BffAuthError } from '../../../../../../lib/auth/session';
import { adminError, adminJson, adminUuid } from '../../../bff';

const moneyPattern = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;
const identifierPattern = /^[+A-Za-z0-9][A-Za-z0-9 +-]{3,62}[A-Za-z0-9]$/;
const providers = new Set(['TELEBIRR', 'CBE']);
const maxJsonBodyBytes = 8 * 1024;

export function destinationConfigId(value: string) {
  return adminUuid(value, 'Destination');
}

export function destinationAccountId(value: string) {
  return adminUuid(value, 'Payment account');
}

async function limitedBodyText(request: NextRequest): Promise<string> {
  const declaredLength = request.headers?.get('content-length');
  if (
    declaredLength !== null &&
    declaredLength !== undefined &&
    Number(declaredLength) > maxJsonBodyBytes
  ) {
    throw new BffAuthError(413, 'The request body is too large.');
  }

  // Read at most the approved bound even when Content-Length is absent or false.
  if (!request.body) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxJsonBodyBytes)
      throw new BffAuthError(413, 'The request body is too large.');
    return text;
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxJsonBodyBytes) {
        await reader.cancel();
        throw new BffAuthError(413, 'The request body is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function inputObject(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = JSON.parse(await limitedBodyText(request));
  } catch (error) {
    if (error instanceof BffAuthError) throw error;
    throw new BffAuthError(400, 'A valid request body is required.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BffAuthError(400, 'A valid request body is required.');
  }
  return value as Record<string, unknown>;
}

function fields(
  input: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[] = [],
) {
  if (
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(input, key))
  ) {
    throw new BffAuthError(
      400,
      'The request contains missing or unsupported fields.',
    );
  }
}

function optionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > max)
    throw new BffAuthError(400, 'Invalid text field.');
  return value.trim() || null;
}

function requiredText(value: unknown, max: number): string {
  const result = optionalText(value, max);
  if (!result) throw new BffAuthError(400, 'A required field is missing.');
  return result;
}

export async function configBody(request: NextRequest): Promise<string> {
  const input = await inputObject(request);
  fields(
    input,
    [
      'bookingEnabled',
      'priceAmount',
      'requestDescription',
      'bookingInstructions',
      'currency',
      'priceUnit',
    ],
    [
      'bookingEnabled',
      'priceAmount',
      'requestDescription',
      'bookingInstructions',
    ],
  );
  // This BFF is a policy gate. The backend may support true, but this UI cannot submit it.
  if (input.bookingEnabled !== false)
    throw new BffAuthError(403, 'Booking activation is unavailable.');
  if (input.currency !== undefined && input.currency !== 'ETB')
    throw new BffAuthError(400, 'Only ETB is supported.');
  if (input.priceUnit !== undefined && input.priceUnit !== 'PER_BOOKING')
    throw new BffAuthError(400, 'Only PER_BOOKING is supported.');
  if (
    input.priceAmount !== null &&
    (typeof input.priceAmount !== 'string' ||
      !moneyPattern.test(input.priceAmount) ||
      /^0\.00$/.test(input.priceAmount))
  ) {
    throw new BffAuthError(
      400,
      'A positive ETB amount with two decimal places is required.',
    );
  }
  const requestDescription = optionalText(input.requestDescription, 1000);
  const bookingInstructions = optionalText(input.bookingInstructions, 1000);
  return JSON.stringify({
    bookingEnabled: false,
    priceAmount: input.priceAmount,
    requestDescription,
    bookingInstructions,
    currency: 'ETB',
    priceUnit: 'PER_BOOKING',
  });
}

function accountFields(input: Record<string, unknown>, patch: boolean) {
  const allowed = [
    'provider',
    'accountHolderName',
    'accountIdentifier',
    'instructions',
    'displayOrder',
    ...(patch ? ['isActive'] : []),
  ];
  fields(
    input,
    allowed,
    patch ? [] : ['provider', 'accountHolderName', 'accountIdentifier'],
  );
  if (patch && Object.keys(input).length === 0)
    throw new BffAuthError(400, 'At least one account field is required.');
  const body: Record<string, unknown> = {};
  if (Object.hasOwn(input, 'provider')) {
    if (typeof input.provider !== 'string' || !providers.has(input.provider))
      throw new BffAuthError(400, 'Invalid provider.');
    body.provider = input.provider;
  }
  if (Object.hasOwn(input, 'accountHolderName'))
    body.accountHolderName = requiredText(input.accountHolderName, 160);
  if (Object.hasOwn(input, 'accountIdentifier')) {
    const identifier = requiredText(input.accountIdentifier, 64);
    if (!identifierPattern.test(identifier))
      throw new BffAuthError(400, 'Invalid account identifier.');
    body.accountIdentifier = identifier;
  }
  if (Object.hasOwn(input, 'instructions'))
    body.instructions = optionalText(input.instructions, 1000);
  if (Object.hasOwn(input, 'displayOrder')) {
    if (
      !Number.isInteger(input.displayOrder) ||
      (input.displayOrder as number) < 0 ||
      (input.displayOrder as number) > 9999
    )
      throw new BffAuthError(400, 'Invalid display order.');
    body.displayOrder = input.displayOrder;
  }
  if (patch && Object.hasOwn(input, 'isActive')) {
    if (typeof input.isActive !== 'boolean')
      throw new BffAuthError(400, 'Invalid account status.');
    body.isActive = input.isActive;
  }
  return JSON.stringify(body);
}

export async function createAccountBody(request: NextRequest) {
  return accountFields(await inputObject(request), false);
}

export async function updateAccountBody(request: NextRequest) {
  return accountFields(await inputObject(request), true);
}

export async function emptyAccountAction(request: NextRequest) {
  const body = await limitedBodyText(request);
  if (body.trim())
    throw new BffAuthError(400, 'This action does not accept a body.');
}

export async function sensitiveAdminJson(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
) {
  const response = await adminJson(request, path, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export { adminError };
