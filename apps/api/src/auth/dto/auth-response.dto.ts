import { ApiProperty } from '@nestjs/swagger';

export class SafeUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  firstName!: string | null;

  @ApiProperty({ nullable: true })
  lastName!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ type: SafeUserDto })
  user!: SafeUserDto;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}
