import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { PrismaModule } from '../prisma/prisma.module';
import { TripsModule } from '../trips/trips.module';
import { AiController, TripAiController } from './ai.controller';
import { AiRateLimiterService } from './ai-rate-limiter.service';
import { AiService } from './ai.service';
import { AiGroundingService } from './grounding/ai-grounding.service';
import { AI_PROVIDER, AiProvider } from './providers/ai.provider';
import { DisabledAiProvider } from './providers/disabled-ai.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Module({
  imports: [PrismaModule, TripsModule],
  controllers: [AiController, TripAiController],
  providers: [
    AiService,
    AiGroundingService,
    AiRateLimiterService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): AiProvider => {
        if (config.get('aiProvider', { infer: true }) === 'DISABLED')
          return new DisabledAiProvider();
        return new OpenAiCompatibleProvider(
          config.get('aiModel', { infer: true }),
          config.get('aiBaseUrl', { infer: true }),
          config.get('aiApiKey', { infer: true }),
        );
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
