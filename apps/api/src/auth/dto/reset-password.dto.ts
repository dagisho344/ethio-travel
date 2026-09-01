import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty({ minLength: 8, example: 'AnotherStrongPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
