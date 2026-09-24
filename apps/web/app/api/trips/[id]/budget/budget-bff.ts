import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { tripRouteResponse } from '../../bff';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expenseCategories = new Set([
  'ACCOMMODATION',
  'TRANSPORT',
  'FOOD',
  'ACTIVITIES',
  'OTHER',
]);

type BudgetBody = { amount: string; currency: string };
type ExpenseBody = { category?: string; amount?: string; note?: string | null };

function badRequest(message: string): NextResponse {
  return NextResponse.json({ message }, { status: 400 });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function jsonObject(
  request: NextRequest,
): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value: unknown = await request.json();
    return isObject(value) ? value : badRequest('JSON body must be an object.');
  } catch {
    return badRequest('Invalid JSON body.');
  }
}

function onlyKeys(
  input: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(input).every((key) => keys.includes(key));
}

export function validUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export async function budgetBody(
  request: NextRequest,
): Promise<BudgetBody | NextResponse> {
  const input = await jsonObject(request);
  if (input instanceof NextResponse) return input;
  if (!onlyKeys(input, ['amount', 'currency']))
    return badRequest('Unexpected budget field.');
  if (typeof input.amount !== 'string' || typeof input.currency !== 'string')
    return badRequest('Budget amount and currency must be strings.');
  return { amount: input.amount, currency: input.currency };
}

export async function expenseBody(
  request: NextRequest,
  options: { partial: boolean },
): Promise<ExpenseBody | NextResponse> {
  const input = await jsonObject(request);
  if (input instanceof NextResponse) return input;
  if (!onlyKeys(input, ['category', 'amount', 'note']))
    return badRequest('Unexpected planned expense field.');
  if (!options.partial && (!('category' in input) || !('amount' in input)))
    return badRequest('Planned expense category and amount are required.');
  if (options.partial && Object.keys(input).length === 0)
    return badRequest('Provide at least one planned expense field.');
  if (
    input.category !== undefined &&
    (typeof input.category !== 'string' ||
      !expenseCategories.has(input.category))
  )
    return badRequest('Invalid planned expense category.');
  if (input.amount !== undefined && typeof input.amount !== 'string')
    return badRequest('Planned expense amount must be a string.');
  if (
    input.note !== undefined &&
    input.note !== null &&
    typeof input.note !== 'string'
  )
    return badRequest('Planned expense note must be text or null.');
  return {
    category: typeof input.category === 'string' ? input.category : undefined,
    amount: typeof input.amount === 'string' ? input.amount : undefined,
    note:
      typeof input.note === 'string' || input.note === null
        ? input.note
        : undefined,
  };
}

export async function budgetRouteResponse(
  request: NextRequest,
  tripId: string,
  suffix = '',
  init: RequestInit = {},
  options: { status?: number; noContent?: boolean } = {},
): Promise<NextResponse> {
  if (!validUuid(tripId)) return badRequest('Invalid trip ID.');
  return tripRouteResponse(
    request,
    `/trips/${tripId}/budget${suffix}`,
    init,
    options,
  );
}
