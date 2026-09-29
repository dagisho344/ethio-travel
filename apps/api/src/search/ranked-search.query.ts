import { InternalServerErrorException } from '@nestjs/common';
import { EditorialLocale, Prisma } from '@prisma/client';
import { publicAmharicEditorialSql } from '../destinations/public-destination-editorial.util';
import {
  SearchEntityType,
  SearchQueryDto,
  SearchSort,
} from './dto/search-query.dto';

export type SearchPredicates = {
  destination: Prisma.DestinationWhereInput;
  attraction: Prisma.AttractionWhereInput;
  business: Prisma.BusinessWhereInput;
  service: Prisma.ServiceWhereInput;
};

export interface RankedSearchRow {
  id: string | null;
  type: SearchEntityType | null;
  total: bigint;
}

type Column = { expression: Prisma.Sql; cast?: Prisma.Sql };
type Context = {
  columns: Record<string, Column>;
  relations: Record<string, Context>;
};

// This adapter is private to Search. Identifiers/relationships are a closed,
// literal map, not caller-supplied SQL. Only the existing discovery predicate
// subset is supported; an unexpected field/operator fails closed.
function column(alias: string, name: string, cast?: string): Column {
  return {
    expression: Prisma.raw(`${alias}."${name}"`),
    cast: cast ? Prisma.raw(cast) : undefined,
  };
}
const region: Context = {
  columns: {
    name: column('r', 'name'),
    slug: column('r', 'slug'),
    status: column('r', 'status', '"LocationStatus"'),
  },
  relations: {},
};
const city: Context = {
  columns: {
    name: column('c', 'name'),
    slug: column('c', 'slug'),
    status: column('c', 'status', '"LocationStatus"'),
  },
  relations: { region },
};
const destination: Context = {
  columns: {
    name: column('d', 'name'),
    slug: column('d', 'slug'),
    status: column('d', 'status', '"PublicationStatus"'),
    shortDescription: column('d', 'short_description'),
    fullDescription: column('d', 'full_description'),
    latitude: column('d', 'latitude', 'numeric'),
    longitude: column('d', 'longitude', 'numeric'),
  },
  relations: { city },
};
const businessDestination: Context = {
  columns: destination.columns,
  relations: {},
};
// Only the root Destination branch may match translation content. Parent
// Destination relations on other entity types retain their canonical context.
const localizedDestination: Context = { ...destination };
const translationContext: Context = {
  columns: {
    locale: column('dt', 'locale', '"EditorialLocale"'),
    isPublished: column('dt', 'is_published'),
    displayName: column('dt', 'display_name'),
    shortDescription: column('dt', 'short_description'),
  },
  relations: {},
};
const business: Context = {
  columns: {
    name: column('b', 'name'),
    slug: column('b', 'slug'),
    description: column('b', 'description'),
    addressLine1: column('b', 'address_line_1'),
    neighborhood: column('b', 'neighborhood'),
    destinationId: column('b', 'destination_id', 'uuid'),
    status: column('b', 'status', '"BusinessStatus"'),
    verificationSummary: column(
      'b',
      'verification_summary',
      '"BusinessVerificationSummary"',
    ),
  },
  relations: {
    city,
    destination: businessDestination,
    category: {
      columns: {
        code: column('bc', 'code'),
        isActive: column('bc', 'is_active'),
      },
      relations: {},
    },
  },
};
const contexts: Record<SearchEntityType, Context> = {
  destination: localizedDestination,
  attraction: {
    columns: {
      name: column('a', 'name'),
      description: column('a', 'description'),
      status: column('a', 'status', '"PublicationStatus"'),
    },
    relations: { destination },
  },
  business,
  service: {
    columns: {
      name: column('s', 'name'),
      shortDescription: column('s', 'short_description'),
      description: column('s', 'description'),
      status: column('s', 'status', '"ServiceStatus"'),
      pricingModel: column('s', 'pricing_model', '"PricingModel"'),
      currency: column('s', 'currency'),
      price: column('s', 'price', 'numeric'),
    },
    relations: {
      business,
      category: {
        columns: {
          code: column('sc', 'code'),
          isActive: column('sc', 'is_active'),
        },
        relations: {},
      },
    },
  },
};
const sources: Record<SearchEntityType, Prisma.Sql> = {
  destination: Prisma.sql`FROM "public"."destinations" d JOIN "public"."cities" c ON c.id = d.city_id JOIN "public"."regions" r ON r.id = c.region_id`,
  attraction: Prisma.sql`FROM "public"."attractions" a JOIN "public"."destinations" d ON d.id = a.destination_id JOIN "public"."cities" c ON c.id = d.city_id JOIN "public"."regions" r ON r.id = c.region_id`,
  business: Prisma.sql`FROM "public"."businesses" b JOIN "public"."business_categories" bc ON bc.id = b.category_id JOIN "public"."cities" c ON c.id = b.city_id JOIN "public"."regions" r ON r.id = c.region_id LEFT JOIN "public"."destinations" d ON d.id = b.destination_id`,
  service: Prisma.sql`FROM "public"."services" s JOIN "public"."service_categories" sc ON sc.id = s.category_id JOIN "public"."businesses" b ON b.id = s.business_id JOIN "public"."business_categories" bc ON bc.id = b.category_id JOIN "public"."cities" c ON c.id = b.city_id JOIN "public"."regions" r ON r.id = c.region_id LEFT JOIN "public"."destinations" d ON d.id = b.destination_id`,
};
const aliases: Record<SearchEntityType, string> = {
  destination: 'd',
  attraction: 'a',
  business: 'b',
  service: 's',
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InternalServerErrorException('Unsupported discovery predicate.');
  return value as Record<string, unknown>;
}
function conjunction(parts: Prisma.Sql[], operator: 'AND' | 'OR'): Prisma.Sql {
  if (!parts.length)
    return operator === 'AND' ? Prisma.sql`TRUE` : Prisma.sql`FALSE`;
  return Prisma.sql`(${Prisma.join(parts, ` ${operator} `)})`;
}
function scalar(value: unknown, field: Column): Prisma.Sql {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  )
    throw new InternalServerErrorException('Unsupported discovery value.');
  return field.cast
    ? Prisma.sql`${value}::${field.cast}`
    : Prisma.sql`${value}`;
}
function fieldPredicate(field: Column, value: unknown): Prisma.Sql {
  if (value === null) return Prisma.sql`${field.expression} IS NULL`;
  if (typeof value !== 'object')
    return Prisma.sql`${field.expression} = ${scalar(value, field)}`;
  const filter = object(value);
  const keys = Object.keys(filter).filter((key) => filter[key] !== undefined);
  if (keys.includes('contains')) {
    if (
      typeof filter.contains !== 'string' ||
      filter.mode !== 'insensitive' ||
      keys.some((key) => key !== 'contains' && key !== 'mode')
    )
      throw new InternalServerErrorException(
        'Unsupported discovery text filter.',
      );
    return Prisma.sql`${field.expression} ILIKE ${`%${filter.contains}%`}`;
  }
  return conjunction(
    keys.map((key) => {
      if (key === 'gte')
        return Prisma.sql`${field.expression} >= ${scalar(filter[key], field)}`;
      if (key === 'lte')
        return Prisma.sql`${field.expression} <= ${scalar(filter[key], field)}`;
      throw new InternalServerErrorException(
        'Unsupported discovery comparison.',
      );
    }),
    'AND',
  );
}
function predicate(value: unknown, context: Context): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const [key, filter] of Object.entries(object(value))) {
    if (filter === undefined) continue;
    if (key === 'AND' || key === 'OR') {
      const children = Array.isArray(filter) ? filter : [filter];
      parts.push(
        conjunction(
          children.map((child) => predicate(child, context)),
          key,
        ),
      );
    } else if (key === 'translations' && context === localizedDestination) {
      const relation = object(filter);
      if (Object.keys(relation).length !== 1 || !relation.some)
        throw new InternalServerErrorException(
          'Unsupported discovery translation relation.',
        );
      parts.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "public"."destination_translations" dt WHERE dt.destination_id = d.id AND ${publicAmharicEditorialSql()} AND ${predicate(relation.some, translationContext)})`,
      );
    } else if (context.relations[key]) {
      parts.push(predicate(filter, context.relations[key]));
    } else if (context.columns[key]) {
      parts.push(fieldPredicate(context.columns[key], filter));
    } else {
      throw new InternalServerErrorException('Unsupported discovery field.');
    }
  }
  return conjunction(parts, 'AND');
}
function order(sort: SearchSort): Prisma.Sql {
  switch (sort) {
    case SearchSort.RELEVANCE:
      return Prisma.sql`q.relevance DESC, q.name ASC, q.type ASC, q.id ASC`;
    case SearchSort.NAME_ASC:
      return Prisma.sql`q.name ASC, q.type ASC, q.id ASC`;
    case SearchSort.NAME_DESC:
      return Prisma.sql`q.name DESC, q.type ASC, q.id ASC`;
    case SearchSort.NEWEST:
      return Prisma.sql`q.created_at DESC, q.name ASC, q.type ASC, q.id ASC`;
    default:
      throw new InternalServerErrorException(
        'Unsupported ranked discovery sort.',
      );
  }
}

/** Exact ordinary Search window. Nearby retains its existing Haversine path. */
export function rankedSearchQuery(
  query: SearchQueryDto,
  types: SearchEntityType[],
  predicates: SearchPredicates,
): Prisma.Sql {
  const branches = types.map((type) => {
    if (!Object.prototype.hasOwnProperty.call(contexts, type))
      throw new InternalServerErrorException(
        'Unsupported ranked discovery type.',
      );
    const alias = aliases[type];
    const id = Prisma.raw(`${alias}.id`);
    const name = Prisma.raw(`${alias}.name`);
    const createdAt = Prisma.raw(`${alias}.created_at`);
    // Keep the literal name-vs-prose tiers. Fold both operands in PostgreSQL:
    // mixing JS query case-folding with database name case-folding can lose a
    // literal Unicode name match. No request locale/collation is introduced.
    // ILIKE pattern behavior remains confined to existing matching filters.
    const translatedNameMatch =
      type === SearchEntityType.DESTINATION &&
      query.locale === EditorialLocale.am &&
      query.q
        ? Prisma.sql`OR EXISTS (SELECT 1 FROM "public"."destination_translations" dt WHERE dt.destination_id = d.id AND ${publicAmharicEditorialSql()} AND strpos(lower(dt.display_name), lower(${query.q})) > 0)`
        : Prisma.empty;
    const relevance = query.q
      ? Prisma.sql`CASE WHEN strpos(lower(${name}), lower(${query.q})) > 0 ${translatedNameMatch} THEN 2 ELSE 1 END`
      : Prisma.sql`0`;
    return Prisma.sql`SELECT ${id} AS id, ${type}::text AS type, ${name} AS name, ${createdAt} AS created_at, ${relevance} AS relevance ${sources[type]} WHERE ${predicate(predicates[type], contexts[type])}`;
  });
  const qualified = branches.length
    ? Prisma.join(branches, ' UNION ALL ')
    : Prisma.sql`SELECT NULL::uuid AS id, NULL::text AS type, NULL::text AS name, NULL::timestamp AS created_at, 0 AS relevance WHERE FALSE`;
  return Prisma.sql`
    WITH qualified AS (${qualified}),
    ranked AS (SELECT q.id, q.type, row_number() OVER (ORDER BY ${order(query.sort)}) AS position FROM qualified q),
    page AS (SELECT id, type, position FROM ranked ORDER BY position LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}),
    totals AS (SELECT count(*) AS total FROM qualified)
    SELECT page.id, page.type, totals.total FROM totals LEFT JOIN page ON TRUE ORDER BY page.position
  `;
}
