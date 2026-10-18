import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DestinationPaymentProvider,
  DestinationPriceUnit,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const ETB_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;
// A syntactic bound only: provider-specific account-number formats are not assumed.
export const ACCOUNT_IDENTIFIER_PATTERN =
  /^[+A-Za-z0-9][A-Za-z0-9 +-]{3,62}[A-Za-z0-9]$/;

export class UpdateDestinationBookingConfigDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  bookingEnabled!: boolean;

  @ApiProperty({ example: '125.00', nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsDefined()
  @IsString()
  @Matches(ETB_AMOUNT_PATTERN)
  priceAmount!: string | null;

  @ApiPropertyOptional({ enum: ['ETB'] })
  @IsOptional()
  @IsIn(['ETB'])
  currency?: 'ETB';

  @ApiPropertyOptional({ enum: DestinationPriceUnit })
  @IsOptional()
  @IsEnum(DestinationPriceUnit)
  priceUnit?: DestinationPriceUnit;

  @ApiProperty({ maxLength: 1000, nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsDefined()
  @IsString()
  @MaxLength(1000)
  requestDescription!: string | null;

  @ApiProperty({ maxLength: 1000, nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsDefined()
  @IsString()
  @MaxLength(1000)
  bookingInstructions!: string | null;
}

export class CreateDestinationPaymentAccountDto {
  @ApiProperty({ enum: DestinationPaymentProvider })
  @IsEnum(DestinationPaymentProvider)
  provider!: DestinationPaymentProvider;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  accountHolderName!: string;

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @Matches(ACCOUNT_IDENTIFIER_PATTERN)
  accountIdentifier!: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;
}

export class UpdateDestinationPaymentAccountDto {
  @ApiPropertyOptional({ enum: DestinationPaymentProvider })
  @IsOptional()
  @IsEnum(DestinationPaymentProvider)
  provider?: DestinationPaymentProvider;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountHolderName?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @Matches(ACCOUNT_IDENTIFIER_PATTERN)
  accountIdentifier?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DestinationPaymentAccountQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class EmptyActionDto {}
