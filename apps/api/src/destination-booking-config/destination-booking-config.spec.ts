import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateDestinationPaymentAccountDto,
  UpdateDestinationBookingConfigDto,
  UpdateDestinationPaymentAccountDto,
} from './dto/destination-booking-config.dto';

async function errors<T extends object>(type: new () => T, value: object) {
  return validate(plainToInstance(type, value), {
    forbidNonWhitelisted: true,
    whitelist: true,
  });
}

describe('Phase 17C-1 Destination configuration DTOs', () => {
  it('accepts only exact ETB decimal strings and the fixed price unit', async () => {
    expect(
      await errors(UpdateDestinationBookingConfigDto, {
        priceAmount: '125.25',
        currency: 'ETB',
        priceUnit: 'PER_BOOKING',
        bookingEnabled: false,
        requestDescription: null,
        bookingInstructions: null,
      }),
    ).toHaveLength(0);
    for (const priceAmount of [
      125.25,
      '125',
      '125.250',
      '-1.00',
      '10000000000.00',
    ]) {
      expect(
        await errors(UpdateDestinationBookingConfigDto, {
          bookingEnabled: false,
          priceAmount,
          requestDescription: null,
          bookingInstructions: null,
        }),
      ).not.toHaveLength(0);
    }
    expect(
      await errors(UpdateDestinationBookingConfigDto, { currency: 'USD' }),
    ).not.toHaveLength(0);
    expect(
      await errors(UpdateDestinationBookingConfigDto, {
        priceUnit: 'PER_PERSON',
      }),
    ).not.toHaveLength(0);
    expect(
      await errors(UpdateDestinationBookingConfigDto, { status: 'PUBLISHED' }),
    ).not.toHaveLength(0);
    expect(
      await errors(UpdateDestinationBookingConfigDto, {
        bookingEnabled: true,
        priceAmount: '125.00',
        requestDescription: 'x'.repeat(1001),
        bookingInstructions: null,
      }),
    ).not.toHaveLength(0);
    expect(
      await errors(UpdateDestinationBookingConfigDto, {
        bookingEnabled: false,
        priceAmount: null,
        requestDescription: null,
      }),
    ).not.toHaveLength(0);
  });

  it('bounds account input and rejects unknown provider fields', async () => {
    expect(
      await errors(CreateDestinationPaymentAccountDto, {
        provider: 'CBE',
        accountHolderName: 'Test Holder',
        accountIdentifier: 'CBE-12345',
      }),
    ).toHaveLength(0);
    expect(
      await errors(CreateDestinationPaymentAccountDto, {
        provider: 'STRIPE',
        accountHolderName: 'Test Holder',
        accountIdentifier: 'CBE-12345',
      }),
    ).not.toHaveLength(0);
    expect(
      await errors(CreateDestinationPaymentAccountDto, {
        provider: 'CBE',
        accountHolderName: 'Test Holder',
        accountIdentifier: '<script>alert(1)</script>',
      }),
    ).not.toHaveLength(0);
    expect(
      await errors(UpdateDestinationPaymentAccountDto, {
        destinationId: 'injected',
      }),
    ).not.toHaveLength(0);
  });
});
