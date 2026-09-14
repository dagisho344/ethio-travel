import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

function trimValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

export class AdminReportResolutionDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @Transform(({ value }) => trimValue(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(1000)
  resolution!: string;
}
