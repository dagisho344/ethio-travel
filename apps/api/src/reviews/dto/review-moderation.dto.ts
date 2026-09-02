import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimToOptional } from './trim-to-optional';

export class ReviewModerationNoteDto {
  @ApiProperty({
    maxLength: 1000,
    description: 'Required moderation reason or note.',
  })
  @Transform(({ value }) => trimToOptional(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  moderationNote!: string;
}
