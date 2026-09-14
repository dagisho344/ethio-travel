import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessStatus,
  BusinessVerificationSummary,
  MediaStatus,
  NotificationType,
  Prisma,
  UserStatus,
  VerificationDocumentType,
  VerificationRequestStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import {
  ApproveBusinessVerificationDto,
  RejectBusinessVerificationDto,
} from './dto/business-verification.dto';
import { BusinessVerificationQueryDto } from './dto/business-verification-query.dto';

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const REQUIRED_DOCUMENT_TYPES = [
  VerificationDocumentType.BUSINESS_LICENSE,
  VerificationDocumentType.TAX_DOCUMENT,
  VerificationDocumentType.OWNER_ID,
] as const;
const documentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const documentSelect = {
  id: true,
  type: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VerificationDocumentSelect;

const verificationInclude = {
  documents: { orderBy: { createdAt: 'desc' }, select: documentSelect },
  business: {
    select: {
      id: true,
      name: true,
      status: true,
      verificationSummary: true,
      locations: {
        where: { isPrimary: true, status: 'ACTIVE' },
        select: {
          id: true,
          label: true,
          addressLine1: true,
          city: { select: { name: true } },
          destination: { select: { name: true } },
        },
        take: 1,
      },
    },
  },
  submittedByUser: { select: { id: true, email: true } },
  reviewedByUser: { select: { id: true, email: true } },
} satisfies Prisma.BusinessVerificationInclude;

type VerificationRecord = Prisma.BusinessVerificationGetPayload<{
  include: typeof verificationInclude;
}>;

@Injectable()
export class BusinessVerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    @Inject(STORAGE_PROVIDER) private readonly storage?: StorageProvider,
    private readonly notifications?: NotificationsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async getOrCreateDraft(userId: string, businessId: string) {
    await this.requireEditor(userId, businessId);
    await this.requireActiveUser(userId);
    const existing = await this.prisma.businessVerification.findFirst({
      where: { businessId, status: VerificationRequestStatus.DRAFT },
      include: verificationInclude,
    });
    if (existing) return this.toPrivateVerification(existing);
    await this.assertBusinessCanBeVerified(businessId);
    try {
      const created = await this.prisma.businessVerification.create({
        data: {
          businessId,
          submittedByUserId: userId,
          status: VerificationRequestStatus.DRAFT,
          submittedAt: null,
        },
        include: verificationInclude,
      });
      return this.toPrivateVerification(created);
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;
      const draft = await this.prisma.businessVerification.findFirst({
        where: { businessId, status: VerificationRequestStatus.DRAFT },
        include: verificationInclude,
      });
      if (!draft) throw error;
      return this.toPrivateVerification(draft);
    }
  }

  async getCurrentDraft(userId: string, businessId: string) {
    const member = await this.requireMember(userId, businessId);
    const draft = await this.prisma.businessVerification.findFirst({
      where: { businessId, status: VerificationRequestStatus.DRAFT },
      include: verificationInclude,
    });
    return draft ? this.toPrivateVerification(draft, member.role) : null;
  }

  async uploadDocument(
    userId: string,
    businessId: string,
    verificationId: string,
    type: VerificationDocumentType,
    file: UploadedFile,
  ) {
    await this.requireEditor(userId, businessId);
    await this.requireActiveUser(userId);
    this.assertDocument(file);
    const draft = await this.findEditableDraft(businessId, verificationId);
    const id = randomUUID();
    const extension = this.extensionFor(file.mimetype);
    const storageReference = `private/verifications/${businessId}/${id}.${extension}`;
    await this.storageProvider().putObject({
      key: storageReference,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      body: file.buffer,
    });
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        await tx.verificationDocument.updateMany({
          where: {
            verificationId: draft.id,
            type,
            status: { in: [MediaStatus.PENDING_UPLOAD, MediaStatus.READY] },
          },
          data: { status: MediaStatus.ARCHIVED },
        });
        return tx.verificationDocument.create({
          data: {
            id,
            verificationId: draft.id,
            type,
            storageReference,
            originalFilename: this.safeFilename(file.originalname, extension),
            mimeType: file.mimetype,
            sizeBytes: file.size,
            status: MediaStatus.READY,
            uploadedByUserId: userId,
            finalizedAt: new Date(),
          },
          select: documentSelect,
        });
      });
      return document;
    } catch (error) {
      await this.storageProvider()
        .deleteObject(storageReference)
        .catch(() => undefined);
      throw error;
    }
  }

  async completeness(
    userId: string,
    businessId: string,
    verificationId: string,
  ) {
    await this.requireMember(userId, businessId);
    const verification = await this.findVerificationForBusiness(
      businessId,
      verificationId,
    );
    return this.completenessFor(verification);
  }

  async submitCurrentDraft(userId: string, businessId: string) {
    const draft = await this.getCurrentDraft(userId, businessId);
    if (!draft)
      throw new ConflictException(
        'Create a verification draft and upload the required documents first.',
      );
    return this.submitDraft(userId, businessId, draft.id);
  }

  async submitDraft(
    userId: string,
    businessId: string,
    verificationId: string,
  ) {
    await this.requireEditor(userId, businessId);
    await this.requireActiveUser(userId);
    const verification = await this.findEditableDraft(
      businessId,
      verificationId,
    );
    const completeness = this.completenessFor(verification);
    if (!completeness.readyToSubmit)
      throw new ConflictException(
        'Business License, Tax Document, and Owner ID are required before submission.',
      );
    await this.assertBusinessCanBeVerified(businessId);
    const now = new Date();
    const submitted = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.businessVerification.updateMany({
        where: { id: verification.id, status: VerificationRequestStatus.DRAFT },
        data: {
          status: VerificationRequestStatus.PENDING,
          submittedAt: now,
          submittedByUserId: userId,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Verification is no longer editable.');
      await tx.business.update({
        where: { id: businessId },
        data: { verificationSummary: BusinessVerificationSummary.PENDING },
      });
      return tx.businessVerification.findUniqueOrThrow({
        where: { id: verification.id },
        include: verificationInclude,
      });
    });
    return this.toPrivateVerification(submitted);
  }

  async findMine(
    userId: string,
    businessId: string,
    query: BusinessVerificationQueryDto,
  ) {
    const member = await this.requireMember(userId, businessId);
    const where = {
      businessId,
      status:
        query.status && query.status !== VerificationRequestStatus.DRAFT
          ? query.status
          : { not: VerificationRequestStatus.DRAFT },
    } satisfies Prisma.BusinessVerificationWhereInput;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessVerification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: verificationInclude,
      }),
      this.prisma.businessVerification.count({ where }),
    ]);
    return paginate(
      data.map((verification) =>
        this.toPrivateVerification(verification, member.role),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async findMineById(
    userId: string,
    businessId: string,
    verificationId: string,
  ) {
    const member = await this.requireMember(userId, businessId);
    const verification = await this.findVerificationForBusiness(
      businessId,
      verificationId,
    );
    return this.toPrivateVerification(verification, member.role);
  }

  async findAdmin(query: BusinessVerificationQueryDto) {
    const where = {
      businessId: query.businessId,
      status:
        query.status && query.status !== VerificationRequestStatus.DRAFT
          ? query.status
          : VerificationRequestStatus.PENDING,
    } satisfies Prisma.BusinessVerificationWhereInput;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessVerification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: verificationInclude,
      }),
      this.prisma.businessVerification.count({ where }),
    ]);
    return paginate(
      data.map((verification) => this.toAdminVerification(verification)),
      total,
      query.page,
      query.limit,
    );
  }

  async findAdminById(id: string) {
    const verification = await this.prisma.businessVerification.findFirst({
      where: { id, status: { not: VerificationRequestStatus.DRAFT } },
      include: verificationInclude,
    });
    if (!verification)
      throw new NotFoundException('Business verification not found.');
    return this.toAdminVerification(verification);
  }

  async adminDocumentAccess(verificationId: string, documentId: string) {
    const document = await this.findAdminDocument(verificationId, documentId);
    const url = await this.storageProvider().signedPrivateReadUrl(
      document.storageReference,
      300,
    );
    return url
      ? { delivery: 'SIGNED_URL' as const, url, expiresInSeconds: 300 }
      : {
          delivery: 'PROTECTED_STREAM' as const,
          url: null,
          expiresInSeconds: 0,
        };
  }

  async readAdminDocument(verificationId: string, documentId: string) {
    const document = await this.findAdminDocument(verificationId, documentId);
    const body = await this.storageProvider().readObject(
      document.storageReference,
    );
    return {
      body,
      filename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
    };
  }

  async approve(
    admin: AuthenticatedUser,
    id: string,
    dto: ApproveBusinessVerificationDto,
    context: AuditContext = {},
  ) {
    const verification = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.businessVerification.findUnique({
        where: { id },
      });
      if (!existing)
        throw new NotFoundException('Business verification not found.');
      const now = new Date();
      const reviewed = await tx.businessVerification.updateMany({
        where: { id, status: VerificationRequestStatus.PENDING },
        data: {
          status: VerificationRequestStatus.APPROVED,
          reviewedAt: now,
          reviewedByUserId: admin.sub,
          adminNotes: this.optional(dto.adminNotes),
        },
      });
      if (reviewed.count !== 1)
        throw new ConflictException('Verification has already been reviewed.');
      const business = await tx.business.findUnique({
        where: { id: existing.businessId },
      });
      await tx.business.update({
        where: { id: existing.businessId },
        data: {
          status: BusinessStatus.ACTIVE,
          verificationSummary: BusinessVerificationSummary.VERIFIED,
          publishedAt: business?.publishedAt ? undefined : now,
        },
      });
      await this.audit?.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_VERIFICATION_APPROVED,
        actorUserId: admin.sub,
        entityId: id,
        entityType: AUDIT_ENTITY_TYPES.BUSINESS_VERIFICATION,
        metadata: {
          operation: 'APPROVE',
          verificationStatus: VerificationRequestStatus.APPROVED,
        },
      });
      return tx.businessVerification.findUniqueOrThrow({
        where: { id },
        include: verificationInclude,
      });
    });
    await this.notifyBusinessVerification(
      verification.businessId,
      admin.sub,
      NotificationType.BUSINESS_VERIFICATION_APPROVED,
      'Business verification approved',
      'Your business verification was approved.',
      `business-verification-approved:${verification.id}`,
    );
    return this.toAdminVerification(verification);
  }

  async reject(
    admin: AuthenticatedUser,
    id: string,
    dto: RejectBusinessVerificationDto,
    context: AuditContext = {},
  ) {
    const verification = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.businessVerification.findUnique({
        where: { id },
      });
      if (!existing)
        throw new NotFoundException('Business verification not found.');
      const reviewed = await tx.businessVerification.updateMany({
        where: { id, status: VerificationRequestStatus.PENDING },
        data: {
          status: VerificationRequestStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedByUserId: admin.sub,
          rejectionReason: this.optional(dto.rejectionReason),
          adminNotes: this.optional(dto.adminNotes),
        },
      });
      if (reviewed.count !== 1)
        throw new ConflictException('Verification has already been reviewed.');
      await tx.business.update({
        where: { id: existing.businessId },
        data: {
          status: BusinessStatus.DRAFT,
          verificationSummary: BusinessVerificationSummary.REJECTED,
        },
      });
      await this.audit?.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_VERIFICATION_REJECTED,
        actorUserId: admin.sub,
        entityId: id,
        entityType: AUDIT_ENTITY_TYPES.BUSINESS_VERIFICATION,
        metadata: {
          operation: 'REJECT',
          verificationStatus: VerificationRequestStatus.REJECTED,
        },
        reason: this.optional(dto.rejectionReason),
      });
      return tx.businessVerification.findUniqueOrThrow({
        where: { id },
        include: verificationInclude,
      });
    });
    await this.notifyBusinessVerification(
      verification.businessId,
      admin.sub,
      NotificationType.BUSINESS_VERIFICATION_REJECTED,
      'Business verification rejected',
      'Your business verification was rejected. Review the verification details to resubmit.',
      `business-verification-rejected:${verification.id}`,
    );
    return this.toAdminVerification(verification);
  }

  // Tests can construct this service without storage when exercising non-upload paths.
  private storageProvider(): StorageProvider {
    if (!this.storage)
      throw new ConflictException('Verification storage is not configured.');
    return this.storage;
  }

  // Compatibility method for existing callers; it no longer permits document-less submission.
  async submit(userId: string, businessId: string) {
    return this.submitCurrentDraft(userId, businessId);
  }
  private async requireMember(userId: string, businessId: string) {
    return this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
  }

  private async requireEditor(userId: string, businessId: string) {
    return this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
  }

  private async requireActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
  }

  private async assertBusinessCanBeVerified(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        status: true,
        verificationSummary: true,
        locations: {
          where: { isPrimary: true, status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!business) throw new NotFoundException('Business not found.');
    if (
      business.status === BusinessStatus.SUSPENDED ||
      business.status === BusinessStatus.ARCHIVED
    )
      throw new ConflictException(
        'Suspended or archived businesses cannot submit verification.',
      );
    if (business.verificationSummary === BusinessVerificationSummary.VERIFIED)
      throw new ConflictException(
        'Verified businesses do not need a new verification draft.',
      );
    if (!business.locations.length)
      throw new ConflictException(
        'A valid primary business location is required.',
      );
  }

  private async findEditableDraft(
    businessId: string,
    verificationId: string,
  ): Promise<VerificationRecord> {
    const verification = await this.prisma.businessVerification.findFirst({
      where: {
        id: verificationId,
        businessId,
        status: VerificationRequestStatus.DRAFT,
      },
      include: verificationInclude,
    });
    if (!verification)
      throw new ConflictException(
        'Verification documents can only change an editable draft.',
      );
    return verification;
  }

  private async findVerificationForBusiness(
    businessId: string,
    verificationId: string,
  ): Promise<VerificationRecord> {
    const verification = await this.prisma.businessVerification.findFirst({
      where: { id: verificationId, businessId },
      include: verificationInclude,
    });
    if (!verification)
      throw new NotFoundException('Business verification not found.');
    return verification;
  }

  private async findAdminDocument(verificationId: string, documentId: string) {
    const document = await this.prisma.verificationDocument.findFirst({
      where: {
        id: documentId,
        verificationId,
        status: MediaStatus.READY,
        verification: { status: { not: VerificationRequestStatus.DRAFT } },
      },
      select: {
        id: true,
        verificationId: true,
        storageReference: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
      },
    });
    if (!document)
      throw new NotFoundException('Verification document not found.');
    return document;
  }

  private completenessFor(verification: VerificationRecord) {
    const documents = verification.documents;
    const required = REQUIRED_DOCUMENT_TYPES.map((type) => ({
      type,
      complete: documents.some(
        (document) =>
          document.type === type &&
          document.status === MediaStatus.READY &&
          Boolean(document.finalizedAt),
      ),
    }));
    return {
      required,
      readyToSubmit:
        verification.status === VerificationRequestStatus.DRAFT &&
        required.every((item) => item.complete),
    };
  }

  private toPrivateVerification(
    verification: VerificationRecord,
    role?: BusinessMemberRole,
  ) {
    const canViewDocuments = role !== BusinessMemberRole.STAFF;
    return {
      id: verification.id,
      businessId: verification.businessId,
      status: verification.status,
      submittedAt: verification.submittedAt,
      reviewedAt: verification.reviewedAt,
      rejectionReason: verification.rejectionReason,
      adminNotes: verification.adminNotes,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      business: verification.business,
      documents: canViewDocuments ? verification.documents : [],
      completeness: this.completenessFor(verification),
    };
  }

  private toAdminVerification(verification: VerificationRecord) {
    return {
      id: verification.id,
      businessId: verification.businessId,
      status: verification.status,
      submittedAt: verification.submittedAt,
      reviewedAt: verification.reviewedAt,
      rejectionReason: verification.rejectionReason,
      adminNotes: verification.adminNotes,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      business: verification.business,
      applicant: verification.submittedByUser,
      reviewer: verification.reviewedByUser,
      documents: verification.documents,
      completeness: this.completenessFor(verification),
    };
  }

  private assertDocument(file: UploadedFile): void {
    if (!file || !Buffer.isBuffer(file.buffer) || file.size < 1)
      throw new BadRequestException('A verification document is required.');
    if (file.size > MAX_DOCUMENT_BYTES)
      throw new BadRequestException(
        'Verification documents must not exceed 15 MB.',
      );
    if (
      !documentMimeTypes.has(file.mimetype) ||
      !this.matchesDocumentSignature(file.buffer, file.mimetype)
    )
      throw new BadRequestException(
        'Only valid PDF, JPEG, and PNG documents are allowed.',
      );
  }

  private matchesDocumentSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'application/pdf')
      return buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-';
    if (mimeType === 'image/jpeg')
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }

  private extensionFor(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'image/jpeg') return 'jpg';
    return 'png';
  }

  private safeFilename(filename: string, extension: string): string {
    const base =
      filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 220) || 'document';
    return `${base.replace(new RegExp(`${extname(base)}$`), '')}.${extension}`;
  }

  private optional(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text || undefined;
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async notifyBusinessVerification(
    businessId: string,
    actorUserId: string,
    type: NotificationType,
    title: string,
    body: string,
    dedupePrefix: string,
  ): Promise<void> {
    await this.notifications?.notifyBusinessMembers(businessId, {
      actorUserId,
      type,
      title,
      body,
      actionUrl: '/business/verification',
      dedupePrefix,
      roles: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER],
    });
  }
}
