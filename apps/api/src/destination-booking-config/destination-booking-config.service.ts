import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DestinationPaymentProvider,
  DestinationPriceUnit,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNT_IDENTIFIER_PATTERN,
  CreateDestinationPaymentAccountDto,
  DestinationPaymentAccountQueryDto,
  ETB_AMOUNT_PATTERN,
  UpdateDestinationBookingConfigDto,
  UpdateDestinationPaymentAccountDto,
} from './dto/destination-booking-config.dto';

const accountSelect = {
  id: true,
  destinationId: true,
  provider: true,
  accountHolderName: true,
  accountIdentifier: true,
  instructions: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DestinationPaymentAccountSelect;

@Injectable()
export class DestinationBookingConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getConfig(destinationId: string) {
    await this.requireDestination(destinationId);
    const config = await this.prisma.destinationBookingConfig.findUnique({
      where: { destinationId },
    });
    return this.toConfig(destinationId, config);
  }

  async updateConfig(
    destinationId: string,
    actorUserId: string,
    dto: UpdateDestinationBookingConfigDto,
    context: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMutableDestination(tx, destinationId);
      const current = await tx.destinationBookingConfig.findUnique({
        where: { destinationId },
      });
      const priceAmount = this.price(dto.priceAmount);
      const requestDescription = this.optionalText(
        dto.requestDescription,
        1000,
      );
      const bookingInstructions = this.optionalText(
        dto.bookingInstructions,
        1000,
      );
      if (dto.currency && dto.currency !== 'ETB') {
        throw new BadRequestException('Only ETB is supported.');
      }
      if (dto.priceUnit && dto.priceUnit !== DestinationPriceUnit.PER_BOOKING) {
        throw new BadRequestException('Only PER_BOOKING pricing is supported.');
      }
      if (dto.bookingEnabled === true) {
        if (!priceAmount || priceAmount.lte(0)) {
          throw new ConflictException('A positive price is required.');
        }
        if (!requestDescription || requestDescription.length < 10) {
          throw new ConflictException(
            'A request description of at least 10 characters is required.',
          );
        }
        const activeAccounts = await tx.destinationPaymentAccount.count({
          where: { destinationId, isActive: true },
        });
        if (!activeAccounts) {
          throw new ConflictException('An active payment account is required.');
        }
      }
      const config = await tx.destinationBookingConfig.upsert({
        where: { destinationId },
        create: {
          destinationId,
          bookingEnabled: dto.bookingEnabled,
          priceAmount,
          currency: 'ETB',
          priceUnit: DestinationPriceUnit.PER_BOOKING,
          requestDescription,
          bookingInstructions,
        },
        update: {
          bookingEnabled: dto.bookingEnabled,
          priceAmount,
          currency: 'ETB',
          priceUnit: DestinationPriceUnit.PER_BOOKING,
          requestDescription,
          bookingInstructions,
        },
      });
      const action = !current
        ? AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_CREATED
        : !current.bookingEnabled && dto.bookingEnabled
          ? AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_ENABLED
          : current.bookingEnabled && !dto.bookingEnabled
            ? AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_DISABLED
            : AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_UPDATED;
      await this.audit.record(tx, {
        ...context,
        action,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: {
          destinationId,
          configId: config.id,
          bookingEnabled: config.bookingEnabled,
        },
      });
      return this.toConfig(destinationId, config);
    });
  }

  async listAccounts(
    destinationId: string,
    query: DestinationPaymentAccountQueryDto,
  ) {
    await this.requireDestination(destinationId);
    const where = { destinationId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.destinationPaymentAccount.findMany({
        where,
        select: accountSelect,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.destinationPaymentAccount.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async createAccount(
    destinationId: string,
    actorUserId: string,
    dto: CreateDestinationPaymentAccountDto,
    context: AuditContext,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockMutableDestination(tx, destinationId);
        const accountHolderName = this.requiredText(dto.accountHolderName, 160);
        const provider = this.provider(dto.provider);
        const accountIdentifier = this.identifier(
          dto.accountIdentifier,
          provider,
        );
        const account = await tx.destinationPaymentAccount.create({
          data: {
            destinationId,
            provider,
            accountHolderName,
            accountIdentifier,
            normalizedIdentifier: this.normalizeIdentifier(
              accountIdentifier,
              provider,
            ),
            instructions: this.optionalText(dto.instructions, 1000),
            displayOrder: this.order(dto.displayOrder),
          },
          select: accountSelect,
        });
        await this.audit.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_DESTINATION_PAYMENT_ACCOUNT_CREATED,
          actorUserId,
          entityId: destinationId,
          entityType: AUDIT_ENTITY_TYPES.DESTINATION,
          metadata: { destinationId, paymentAccountId: account.id },
        });
        return account;
      });
    } catch (error) {
      this.throwDuplicate(error);
      throw error;
    }
  }

  async updateAccount(
    destinationId: string,
    accountId: string,
    actorUserId: string,
    dto: UpdateDestinationPaymentAccountDto,
    context: AuditContext,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockMutableDestination(tx, destinationId);
        const existing = await this.scopedAccount(tx, destinationId, accountId);
        if (existing.isActive && dto.isActive === false) {
          await this.assertMayDeactivate(tx, destinationId);
        }
        const provider =
          dto.provider === undefined
            ? existing.provider
            : this.provider(dto.provider);
        const accountIdentifier =
          dto.accountIdentifier === undefined
            ? existing.accountIdentifier
            : this.identifier(dto.accountIdentifier, provider);
        this.identifier(accountIdentifier, provider);
        const account = await tx.destinationPaymentAccount.update({
          where: { id: accountId },
          data: {
            provider,
            accountHolderName:
              dto.accountHolderName === undefined
                ? undefined
                : this.requiredText(dto.accountHolderName, 160),
            accountIdentifier,
            normalizedIdentifier: this.normalizeIdentifier(
              accountIdentifier,
              provider,
            ),
            instructions:
              dto.instructions === undefined
                ? undefined
                : this.optionalText(dto.instructions, 1000),
            displayOrder:
              dto.displayOrder === undefined
                ? undefined
                : this.order(dto.displayOrder),
            isActive: dto.isActive,
          },
          select: accountSelect,
        });
        await this.audit.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_DESTINATION_PAYMENT_ACCOUNT_UPDATED,
          actorUserId,
          entityId: destinationId,
          entityType: AUDIT_ENTITY_TYPES.DESTINATION,
          metadata: { destinationId, paymentAccountId: account.id },
        });
        return account;
      });
    } catch (error) {
      this.throwDuplicate(error);
      throw error;
    }
  }

  async deactivateAccount(
    destinationId: string,
    accountId: string,
    actorUserId: string,
    context: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMutableDestination(tx, destinationId);
      const existing = await this.scopedAccount(tx, destinationId, accountId);
      if (!existing.isActive) {
        throw new ConflictException('Payment account is already inactive.');
      }
      await this.assertMayDeactivate(tx, destinationId);
      const account = await tx.destinationPaymentAccount.update({
        where: { id: accountId },
        data: { isActive: false },
        select: accountSelect,
      });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_PAYMENT_ACCOUNT_DEACTIVATED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, paymentAccountId: account.id },
      });
      return account;
    });
  }

  private async requireDestination(destinationId: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true },
    });
    if (!destination) throw new NotFoundException('Destination not found.');
  }

  private async lockMutableDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: PublicationStatus }>
    >`SELECT "id", "status" FROM "destinations" WHERE "id" = ${destinationId}::uuid FOR UPDATE`;
    const destination = rows[0];
    if (!destination) throw new NotFoundException('Destination not found.');
    if (destination.status === PublicationStatus.ARCHIVED) {
      throw new ConflictException('Archived destinations are read-only.');
    }
  }

  private async scopedAccount(
    tx: Prisma.TransactionClient,
    destinationId: string,
    accountId: string,
  ) {
    const account = await tx.destinationPaymentAccount.findFirst({
      where: { id: accountId, destinationId },
    });
    if (!account) throw new NotFoundException('Payment account not found.');
    return account;
  }

  private async assertMayDeactivate(
    tx: Prisma.TransactionClient,
    destinationId: string,
  ) {
    const config = await tx.destinationBookingConfig.findUnique({
      where: { destinationId },
      select: { bookingEnabled: true },
    });
    if (!config?.bookingEnabled) return;
    const activeCount = await tx.destinationPaymentAccount.count({
      where: { destinationId, isActive: true },
    });
    if (activeCount <= 1) {
      throw new ConflictException(
        'An enabled destination requires an active payment account.',
      );
    }
  }

  private price(value: string | null): Prisma.Decimal | null {
    if (value === null) return null;
    if (typeof value !== 'string' || !ETB_AMOUNT_PATTERN.test(value)) {
      throw new BadRequestException(
        'Price must be an exact ETB decimal string.',
      );
    }
    const amount = new Prisma.Decimal(value);
    if (amount.lte(0)) throw new BadRequestException('Price must be positive.');
    return amount;
  }

  private provider(value: DestinationPaymentProvider) {
    if (!Object.values(DestinationPaymentProvider).includes(value)) {
      throw new BadRequestException('Invalid payment provider.');
    }
    return value;
  }

  private identifier(
    value: string,
    provider: DestinationPaymentProvider,
  ): string {
    if (typeof value !== 'string' || !ACCOUNT_IDENTIFIER_PATTERN.test(value)) {
      throw new BadRequestException('Invalid account identifier.');
    }
    const text = value.trim();
    this.normalizeIdentifier(text, provider);
    return text;
  }

  private normalizeIdentifier(
    value: string,
    provider: DestinationPaymentProvider,
  ): string {
    const normalized = value.replace(/[ -]/g, '').toUpperCase();
    if (provider === DestinationPaymentProvider.TELEBIRR) {
      if (/^09\d{8}$/.test(normalized)) return `+251${normalized.slice(1)}`;
      if (/^\+2519\d{8}$/.test(normalized)) return normalized;
      throw new BadRequestException('Invalid Telebirr mobile number.');
    }
    if (!/^[A-Z0-9]{5,40}$/.test(normalized)) {
      throw new BadRequestException('Invalid account identifier.');
    }
    return normalized;
  }

  private requiredText(value: string, max: number): string {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text || text.length > max) {
      throw new BadRequestException('A valid account holder name is required.');
    }
    return text;
  }

  private optionalText(value: string | null | undefined, max: number) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || value.length > max) {
      throw new BadRequestException('Invalid instructions.');
    }
    return value.trim() || null;
  }

  private order(value: number | undefined): number {
    if (value === undefined) return 0;
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      throw new BadRequestException('Invalid display order.');
    }
    return value;
  }

  private toConfig(
    destinationId: string,
    config: {
      id: string;
      bookingEnabled: boolean;
      priceAmount: Prisma.Decimal | null;
      requestDescription: string | null;
      bookingInstructions: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ) {
    return {
      id: config?.id ?? null,
      destinationId,
      bookingEnabled: config?.bookingEnabled ?? false,
      priceAmount: config?.priceAmount?.toFixed(2) ?? null,
      currency: 'ETB' as const,
      priceUnit: DestinationPriceUnit.PER_BOOKING,
      requestDescription: config?.requestDescription ?? null,
      bookingInstructions: config?.bookingInstructions ?? null,
      createdAt: config?.createdAt ?? null,
      updatedAt: config?.updatedAt ?? null,
    };
  }

  private throwDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Payment account already exists.');
    }
  }
}
