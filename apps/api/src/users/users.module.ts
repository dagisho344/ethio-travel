import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserRestrictionsService } from './user-restrictions.service';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  exports: [UsersService, UserRestrictionsService],
  providers: [UsersService, UserRestrictionsService],
})
export class UsersModule {}
