import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessStatus,
  BusinessVerificationSummary,
  Prisma,
  UserStatus,
  VerificationRequestStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApproveBusinessVerificationDto,
  RejectBusinessVerificationDto,
} from './dto/business-verification.dto';
import { BusinessVerificationQueryDto } from './dto/business-verification-query.dto';

@Injectable()
export class BusinessVerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async submit(userId: string, businessId: string) {
    await this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.findUnique({
          where: { id: businessId },
        });
        if (!business) throw new NotFoundException('Business not found.');
        if (
          business.status === BusinessStatus.SUSPENDED ||
          business.status === BusinessStatus.ARCHIVED
        )
          throw new ConflictException(
            'Suspended or archived businesses cannot submit verification.',
          );
        const verification = await tx.businessVerification.create({
          data: {
            businessId,
            submittedByUserId: userId,
            status: VerificationRequestStatus.PENDING,
          },
        });
        await tx.business.update({
          where: { id: businessId },
          data: { verificationSummary: BusinessVerificationSummary.PENDING },
        });
        return verification;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A pending verification already exists for this business.',
        );
      throw error;
    }
  }

  async findMine(
    userId: string,
    businessId: string,
    query: BusinessVerificationQueryDto,
  ) {
    await this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
    const where = {
      businessId,
      status: query.status,
    } satisfies Prisma.BusinessVerificationWhereInput;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessVerification.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessVerification.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }
  async findMineById(
    userId: string,
    businessId: string,
    verificationId: string,
  ) {
    await this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
    const verification = await this.prisma.businessVerification.findFirst({
      where: { id: verificationId, businessId },
    });
    if (!verification)
      throw new NotFoundException('Business verification not found.');
    return verification;
  }
  async findAdmin(query: BusinessVerificationQueryDto) {
    const where = {
      businessId: query.businessId,
      status: query.status,
    } satisfies Prisma.BusinessVerificationWhereInput;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessVerification.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessVerification.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }
  async findAdminById(id: string) {
    const verification = await this.prisma.businessVerification.findUnique({
      where: { id },
    });
    if (!verification)
      throw new NotFoundException('Business verification not found.');
    return verification;
  }

  async approve(
    admin: AuthenticatedUser,
    id: string,
    dto: ApproveBusinessVerificationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.businessVerification.findUnique({
        where: { id },
      });
      if (!verification)
        throw new NotFoundException('Business verification not found.');
      const now = new Date();
      const reviewed = await tx.businessVerification.updateMany({
        where: { id, status: VerificationRequestStatus.PENDING },
        data: {
          status: VerificationRequestStatus.APPROVED,
          reviewedAt: now,
          reviewedByUserId: admin.sub,
          adminNotes: dto.adminNotes,
        },
      });
      if (reviewed.count !== 1)
        throw new ConflictException('Verification has already been reviewed.');
      const business = await tx.business.findUnique({
        where: { id: verification.businessId },
      });
      await tx.business.update({
        where: { id: verification.businessId },
        data: {
          status: BusinessStatus.ACTIVE,
          verificationSummary: BusinessVerificationSummary.VERIFIED,
          publishedAt: business?.publishedAt ? undefined : now,
        },
      });
      return tx.businessVerification.findUniqueOrThrow({ where: { id } });
    });
  }

  async reject(
    admin: AuthenticatedUser,
    id: string,
    dto: RejectBusinessVerificationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.businessVerification.findUnique({
        where: { id },
      });
      if (!verification)
        throw new NotFoundException('Business verification not found.');
      const reviewed = await tx.businessVerification.updateMany({
        where: { id, status: VerificationRequestStatus.PENDING },
        data: {
          status: VerificationRequestStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedByUserId: admin.sub,
          rejectionReason: dto.rejectionReason,
          adminNotes: dto.adminNotes,
        },
      });
      if (reviewed.count !== 1)
        throw new ConflictException('Verification has already been reviewed.');
      await tx.business.update({
        where: { id: verification.businessId },
        data: {
          status: BusinessStatus.DRAFT,
          verificationSummary: BusinessVerificationSummary.REJECTED,
        },
      });
      return tx.businessVerification.findUniqueOrThrow({ where: { id } });
    });
  }
}
