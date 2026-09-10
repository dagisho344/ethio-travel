import { ApiPropertyOptional } from '@nestjs/swagger';
import { AiIntent } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const budgetLevels = ['LOW', 'MODERATE', 'FLEXIBLE'] as const;
const paceLevels = ['RELAXED', 'BALANCED', 'FULL'] as const;

export class AiPreferencesDto {
  @ApiPropertyOptional({ enum: budgetLevels })
  @IsIn(budgetLevels)
  @IsOptional()
  budget?: (typeof budgetLevels)[number];

  @ApiPropertyOptional({ enum: paceLevels })
  @IsIn(paceLevels)
  @IsOptional()
  pace?: (typeof paceLevels)[number];

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @ArrayMaxSize(10)
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  interests?: string[];

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accommodationType?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  transportPreference?: string;
}

export class CreateAiConversationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}

export class AiConversationQueryDto extends PaginationQueryDto {}

export class SendAiMessageDto {
  @ApiPropertyOptional({ enum: AiIntent, default: AiIntent.GENERAL_TRAVEL })
  @IsEnum(AiIntent)
  @IsOptional()
  intent: AiIntent = AiIntent.GENERAL_TRAVEL;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ type: AiPreferencesDto })
  @IsOptional()
  @Type(() => AiPreferencesDto)
  @ValidateNested()
  preferences?: AiPreferencesDto;
}

export class GenerateTripSuggestionsDto {
  @ApiPropertyOptional({
    enum: [AiIntent.TRIP_ITINERARY, AiIntent.TRIP_IMPROVEMENT],
    default: AiIntent.TRIP_ITINERARY,
  })
  @IsEnum(AiIntent)
  @IsOptional()
  intent: AiIntent = AiIntent.TRIP_ITINERARY;

  @ApiPropertyOptional({ maxLength: 1200 })
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  instruction?: string;

  @ApiPropertyOptional({ type: AiPreferencesDto })
  @IsOptional()
  @Type(() => AiPreferencesDto)
  @ValidateNested()
  preferences?: AiPreferencesDto;
}
