import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';
import { AuthService, RequestMetadata } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: AuthResponseDto })
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, this.getMetadata(request));
  }

  @Post('login')
  @ApiCreatedResponse({ type: AuthResponseDto })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, this.getMetadata(request));
  }

  @Post('refresh')
  @ApiCreatedResponse({ type: AuthResponseDto })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(dto, this.getMetadata(request));
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: MessageResponseDto })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    return this.authService.logout(user.sessionId);
  }

  @Post('forgot-password')
  @ApiCreatedResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @ApiCreatedResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  private getMetadata(request: Request): RequestMetadata {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
