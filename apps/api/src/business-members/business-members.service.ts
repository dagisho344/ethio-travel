import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  BusinessStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBusinessMemberDto,
  UpdateBusinessMemberDto,
} from './dto/business-member.dto';

@Injectable()
export class BusinessMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async findMembers(userId: string, businessId: string) {
    await this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
    return this.prisma.businessMember.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMember(
    userId: string,
    businessId: string,
    dto: CreateBusinessMemberDto,
  ) {
    await this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
    ]);
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, status: UserStatus.ACTIVE },
    });
    if (!user) throw new NotFoundException('Active user not found.');
    try {
      return await this.prisma.businessMember.create({
        data: {
          businessId,
          userId: dto.userId,
          role: dto.role,
          status: BusinessMemberStatus.ACTIVE,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('User is already a business member.');
      throw error;
    }
  }

  async updateMember(
    userId: string,
    businessId: string,
    memberId: string,
    dto: UpdateBusinessMemberDto,
  ) {
    await this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
    ]);
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.businessMember.findFirst({
        where: { id: memberId, businessId },
        include: { business: true },
      });
      if (!member) throw new NotFoundException('Business member not found.');
      if (
        member.business.status !== BusinessStatus.ARCHIVED &&
        member.role === BusinessMemberRole.OWNER &&
        member.status === BusinessMemberStatus.ACTIVE &&
        ((dto.role && dto.role !== BusinessMemberRole.OWNER) ||
          (dto.status && dto.status !== BusinessMemberStatus.ACTIVE))
      ) {
        const ownerCount = await tx.businessMember.count({
          where: {
            businessId,
            role: BusinessMemberRole.OWNER,
            status: BusinessMemberStatus.ACTIVE,
            id: { not: member.id },
          },
        });
        if (ownerCount < 1)
          throw new ConflictException(
            'A non-archived business must keep at least one active owner.',
          );
      }
      return tx.businessMember.update({ where: { id: memberId }, data: dto });
    });
  }
}
