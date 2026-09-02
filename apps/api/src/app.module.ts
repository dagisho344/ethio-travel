import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AttractionsModule } from './attractions/attractions.module';
import { AuthModule } from './auth/auth.module';
import { BusinessCategoriesModule } from './business-categories/business-categories.module';
import { BusinessMembersModule } from './business-members/business-members.module';
import { BusinessVerificationsModule } from './business-verifications/business-verifications.module';
import { BusinessesModule } from './businesses/businesses.module';
import { CitiesModule } from './cities/cities.module';
import { DestinationsModule } from './destinations/destinations.module';
import { appConfig } from './config/app.config';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { MapsModule } from './maps/maps.module';
import { createHttpLoggerOptions } from './logger/http-logger.options';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { ServicesModule } from './services/services.module';
import { SearchModule } from './search/search.module';
import { RegionsModule } from './regions/regions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: envValidationSchema,
    }),
    PinoLoggerModule.forRoot({
      pinoHttp: createHttpLoggerOptions(process.env.NODE_ENV),
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    RegionsModule,
    CitiesModule,
    DestinationsModule,
    AttractionsModule,
    BusinessCategoriesModule,
    BusinessesModule,
    BusinessMembersModule,
    BusinessVerificationsModule,
    ServiceCategoriesModule,
    ServicesModule,
    SearchModule,
    MapsModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
