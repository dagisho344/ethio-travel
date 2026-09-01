import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SafeUserDto } from '../auth/dto/auth-response.dto';
import { RoleName } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

const userInclude = {
  profile: true,
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

type UserWithProfileAndRoles = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toSafeUser(user: UserWithProfileAndRoles): SafeUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.profile?.firstName ?? null,
      lastName: user.profile?.lastName ?? null,
      phone: user.profile?.phone ?? null,
      roles: user.roles.map((userRole) => userRole.role.name),
    };
  }

  async findSafeUserById(userId: string): Promise<SafeUserDto> {
    const user = await this.prisma.user.findUnique({
      include: userInclude,
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toSafeUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<SafeUserDto> {
    const user = await this.prisma.user.update({
      data: {
        profile: {
          upsert: {
            create: dto,
            update: dto,
          },
        },
      },
      include: userInclude,
      where: { id: userId },
    });

    return this.toSafeUser(user);
  }

  async assignRole(userId: string, roleName: RoleName): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    await this.prisma.userRole.upsert({
      create: { roleId: role.id, userId },
      update: {},
      where: { userId_roleId: { roleId: role.id, userId } },
    });
  }
}
