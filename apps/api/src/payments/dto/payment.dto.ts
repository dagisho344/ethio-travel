import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreatePaymentDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  idempotencyKey?: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class AdminPaymentQueryDto extends PaymentQueryDto {
  @ApiPropertyOptional({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  traveler?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  business?: string;

  @ApiPropertyOptional({ minLength: 3, maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  currency?: string;
}

export class RefundPaymentDto {
  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  idempotencyKey?: string;
}
