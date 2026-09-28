import { Prisma } from '@prisma/client';
import { InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { SearchEntityType, SearchSort } from './search/dto/search-query.dto';
import { SearchService } from './search/search.service';
import {
  rankedSearchQuery,
  SearchPredicates,
} from './search/ranked-search.query';

const rows = ['A Museum', 'B Gallery', 'Y Lake', 'Z Lake'].map(
  (name, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name,
    slug: `result-${index}`,
    shortDescription: 'Lake history',
    fullDescription: 'Lake history',
    latitude: null,
    longitude: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    city: {
      name: 'City',
      slug: 'city',
      region: { name: 'Region', slug: 'region' },
    },
  }),
);

describe('F4A-0 ranked page hydration', () => {
  it('returns stronger matches outside the old alphabetical prefix without repeats or omissions', async () => {
    const expected = [rows[2]!, rows[3]!, rows[0]!, rows[1]!];
    const findMany = jest.fn(
      ({
        take,
        where,
      }: {
        take: number;
        select?: unknown;
        where?: { AND?: Array<{ id?: { in: string[] } }> };
      }) => {
        const ids = where?.AND?.find((part) => part.id)?.id?.in;
        return Promise.resolve(
          ids
            ? rows.filter((row) => ids.includes(row.id))
            : rows.slice(0, take),
        );
      },
    );
    const queryRaw = jest.fn<
      Promise<Array<{ id: string; type: SearchEntityType; total: bigint }>>,
      [Prisma.Sql]
    >();
    const client = {
      destination: { findMany, count: () => Promise.resolve(rows.length) },
      $queryRaw: queryRaw,
    };
    const transaction = jest.fn(
      (
        callback: (tx: typeof client) => Promise<unknown>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) => {
        expect(options.isolationLevel).toBe(
          Prisma.TransactionIsolationLevel.RepeatableRead,
        );
        return callback(client);
      },
    );
    const prisma = { ...client, $transaction: transaction };
    const service = new SearchService(prisma as unknown as PrismaService);
    const seen: string[] = [];
    for (let page = 1; page <= rows.length; page++) {
      queryRaw.mockResolvedValue([
        {
          id: expected[page - 1]!.id,
          type: SearchEntityType.DESTINATION,
          total: 4n,
        },
      ]);
      const result = await service.search({
        page,
        limit: 1,
        q: 'Lake',
        types: [SearchEntityType.DESTINATION],
        sort: SearchSort.RELEVANCE,
      });
      expect(result.meta).toEqual({ page, limit: 1, total: 4, totalPages: 4 });
      expect(result.data.map((row) => row.name)).toEqual([
        expected[page - 1]!.name,
      ]);
      seen.push(...result.data.map((row) => row.id));
    }
    expect(new Set(seen).size).toBe(rows.length);
    expect(seen).toEqual(expected.map((row) => row.id));
    expect(queryRaw).toHaveBeenCalledTimes(4);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(findMany.mock.calls).toHaveLength(4);
    for (const [call] of findMany.mock.calls) {
      expect(call.take).toBe(1);
      expect(call.select).toEqual(
        expect.objectContaining({ id: true, name: true }),
      );
      expect(call.where?.AND?.some((part) => part.id?.in.length === 1)).toBe(
        true,
      );
    }
  });

  it('binds user text and pagination values without turning them into SQL syntax', () => {
    const q = "Lake%' OR 1=1 --";
    const predicates: SearchPredicates = {
      destination: { name: { contains: q, mode: 'insensitive' } },
      attraction: {},
      business: {},
      service: {},
    };
    const sql = rankedSearchQuery(
      { q, page: 2, limit: 3, sort: SearchSort.RELEVANCE },
      [SearchEntityType.DESTINATION],
      predicates,
    );
    expect(sql.text).not.toContain(q);
    expect(sql.values).toEqual(expect.arrayContaining([q, `%${q}%`, 3]));
    expect(sql.values.slice(-2)).toEqual([3, 3]);
  });

  it('fails closed if future visibility predicates use unsupported fields or operators', () => {
    const query = { page: 1, limit: 20, sort: SearchSort.RELEVANCE };
    const predicates: SearchPredicates = {
      destination: { name: { startsWith: 'Lake' } },
      attraction: {},
      business: {},
      service: {},
    };
    expect(() =>
      rankedSearchQuery(query, [SearchEntityType.DESTINATION], predicates),
    ).toThrow(InternalServerErrorException);
    predicates.destination = { publishedAt: { not: null } };
    expect(() =>
      rankedSearchQuery(query, [SearchEntityType.DESTINATION], predicates),
    ).toThrow(InternalServerErrorException);
    expect(() =>
      rankedSearchQuery(
        { ...query, sort: SearchSort.DISTANCE },
        [SearchEntityType.DESTINATION],
        { ...predicates, destination: {} },
      ),
    ).toThrow(InternalServerErrorException);
  });
});
