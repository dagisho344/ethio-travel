import { Injectable } from '@nestjs/common';
import { Prisma, TripItemType } from '@prisma/client';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../../common/utils/public-visibility.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AiGroundedCandidate } from '../providers/ai.provider';

const CANDIDATES_PER_TYPE = 6;

type CandidateType = Extract<
  TripItemType,
  'DESTINATION' | 'ATTRACTION' | 'BUSINESS' | 'SERVICE'
>;

type GroundingScope = {
  destinationCityId?: string | null;
  primaryDestinationId?: string | null;
};

@Injectable()
export class AiGroundingService {
  constructor(private readonly prisma: PrismaService) {}

  async candidates(scope: GroundingScope): Promise<AiGroundedCandidate[]> {
    const [destinations, attractions, businesses, services] = await Promise.all(
      [
        this.prisma.destination.findMany({
          where: {
            ...publicDestinationWhere(),
            cityId: scope.destinationCityId ?? undefined,
          },
          orderBy: { name: 'asc' },
          take: CANDIDATES_PER_TYPE,
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            city: { select: { name: true } },
          },
        }),
        this.prisma.attraction.findMany({
          where: {
            ...publicAttractionWhere(),
            destinationId: scope.primaryDestinationId ?? undefined,
          },
          orderBy: { name: 'asc' },
          take: CANDIDATES_PER_TYPE,
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            description: true,
            entranceFee: true,
            currency: true,
            destination: { select: { name: true } },
          },
        }),
        this.prisma.business.findMany({
          where: {
            ...publicBusinessWhere(),
            cityId: scope.destinationCityId ?? undefined,
          },
          orderBy: { name: 'asc' },
          take: CANDIDATES_PER_TYPE,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            category: { select: { name: true } },
            city: { select: { name: true } },
          },
        }),
        this.prisma.service.findMany({
          where: {
            ...publicServiceWhere(),
            business: {
              ...publicBusinessWhere(),
              cityId: scope.destinationCityId ?? undefined,
            },
          },
          orderBy: { name: 'asc' },
          take: CANDIDATES_PER_TYPE,
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            price: true,
            currency: true,
            category: { select: { name: true } },
            business: {
              select: { name: true, city: { select: { name: true } } },
            },
          },
        }),
      ],
    );
    return [
      ...destinations.map((record) =>
        this.candidate('DESTINATION', record, {
          category: null,
          description: record.shortDescription,
          location: record.city.name,
        }),
      ),
      ...attractions.map((record) =>
        this.candidate('ATTRACTION', record, {
          category: record.category,
          description: record.description,
          location: record.destination.name,
          price: record.entranceFee,
          currency: record.currency,
        }),
      ),
      ...businesses.map((record) =>
        this.candidate('BUSINESS', record, {
          category: record.category.name,
          description: record.description,
          location: record.city.name,
        }),
      ),
      ...services.map((record) =>
        this.candidate('SERVICE', record, {
          category: record.category.name,
          description: record.shortDescription,
          location: `${record.business.name}, ${record.business.city.name}`,
          price: record.price,
          currency: record.currency,
        }),
      ),
    ];
  }

  async findEligible(
    type: CandidateType,
    id: string,
  ): Promise<AiGroundedCandidate | null> {
    if (type === 'DESTINATION') {
      const record = await this.prisma.destination.findFirst({
        where: { id, ...publicDestinationWhere() },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          city: { select: { name: true } },
        },
      });
      return record
        ? this.candidate('DESTINATION', record, {
            category: null,
            description: record.shortDescription,
            location: record.city.name,
          })
        : null;
    }
    if (type === 'ATTRACTION') {
      const record = await this.prisma.attraction.findFirst({
        where: { id, ...publicAttractionWhere() },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          description: true,
          entranceFee: true,
          currency: true,
          destination: { select: { name: true } },
        },
      });
      return record
        ? this.candidate('ATTRACTION', record, {
            category: record.category,
            description: record.description,
            location: record.destination.name,
            price: record.entranceFee,
            currency: record.currency,
          })
        : null;
    }
    if (type === 'BUSINESS') {
      const record = await this.prisma.business.findFirst({
        where: { id, ...publicBusinessWhere() },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          category: { select: { name: true } },
          city: { select: { name: true } },
        },
      });
      return record
        ? this.candidate('BUSINESS', record, {
            category: record.category.name,
            description: record.description,
            location: record.city.name,
          })
        : null;
    }
    const record = await this.prisma.service.findFirst({
      where: { id, ...publicServiceWhere() },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        price: true,
        currency: true,
        category: { select: { name: true } },
        business: { select: { name: true, city: { select: { name: true } } } },
      },
    });
    return record
      ? this.candidate('SERVICE', record, {
          category: record.category.name,
          description: record.shortDescription,
          location: `${record.business.name}, ${record.business.city.name}`,
          price: record.price,
          currency: record.currency,
        })
      : null;
  }

  private candidate(
    entityType: CandidateType,
    record: { id: string; name: string; slug: string },
    details: {
      category: string | null;
      description: string | null;
      location: string | null;
      price?: Prisma.Decimal | null;
      currency?: string | null;
    },
  ): AiGroundedCandidate {
    const knownPrice =
      details.price !== undefined &&
      details.price !== null &&
      details.currency !== undefined &&
      details.currency !== null
        ? { amount: details.price.toString(), currency: details.currency }
        : null;
    return {
      entityType,
      entityId: record.id,
      name: record.name,
      slug: record.slug,
      category: details.category,
      location: details.location,
      description: details.description
        ? details.description.slice(0, 500)
        : null,
      knownPrice,
      availability: 'UNKNOWN',
    };
  }
}
