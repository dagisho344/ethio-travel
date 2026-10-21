import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DestinationBookingConfigService } from './destination-booking-config.service';
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

describe('Destination booking activation policy', () => {
  it('rejects service-level activation before any config write or successful audit', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: '33333333-3333-4333-8333-333333333333',
          status: PublicationStatus.DRAFT,
        },
      ]),
      destinationBookingConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const audit = { record: jest.fn() };
    const service = new DestinationBookingConfigService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );

    await expect(
      service.updateConfig(
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        {
          bookingEnabled: true,
          priceAmount: '125.00',
          requestDescription: 'Request a guided visit only.',
          bookingInstructions: null,
        },
        {},
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'DESTINATION_BOOKING_ACTIVATION_PAUSED' },
    });
    expect(tx.destinationBookingConfig.findUnique).not.toHaveBeenCalled();
    expect(tx.destinationBookingConfig.upsert).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
