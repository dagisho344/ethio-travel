import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessMembersController } from './business-members.controller';
import { BusinessMembersService } from './business-members.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [BusinessMembersController],
  providers: [BusinessMembersService],
})
export class BusinessMembersModule {}
