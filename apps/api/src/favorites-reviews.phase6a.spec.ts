import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationSql = readFileSync(
  join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20260902000001_favorites_reviews_foundation',
    'migration.sql',
  ),
  'utf8',
);

describe('Phase 6A favorites and reviews database foundation', () => {
  it('enforces exactly one relational target for favorites and reviews', () => {
    expect(migrationSql).toContain('CONSTRAINT "favorites_exactly_one_target_check"');
    expect(migrationSql).toContain('CONSTRAINT "reviews_exactly_one_target_check"');
    expect(migrationSql).toContain('= 1)');
  });

  it('enforces review rating range at the database level', () => {
    expect(migrationSql).toContain('CONSTRAINT "reviews_rating_check"');
    expect(migrationSql).toContain('"rating" >= 1 AND "rating" <= 5');
  });

  it('prevents duplicate favorites and reviews per user and target', () => {
    for (const target of ['business', 'service', 'destination', 'attraction']) {
      expect(migrationSql).toContain(
        `CREATE UNIQUE INDEX "favorites_user_${target}_unique"`,
      );
      expect(migrationSql).toContain(
        `CREATE UNIQUE INDEX "reviews_user_${target}_unique"`,
      );
      expect(migrationSql).toContain(`WHERE "${target}_id" IS NOT NULL`);
    }
  });

  it('uses the requested review lookup and moderation indexes', () => {
    expect(migrationSql).toContain(
      'CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at")',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX "reviews_user_id_created_at_idx" ON "reviews"("user_id", "created_at")',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX "reviews_business_id_status_idx" ON "reviews"("business_id", "status")',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX "reviews_service_id_status_idx" ON "reviews"("service_id", "status")',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX "reviews_destination_id_status_idx" ON "reviews"("destination_id", "status")',
    );
    expect(migrationSql).toContain(
      'CREATE INDEX "reviews_attraction_id_status_idx" ON "reviews"("attraction_id", "status")',
    );
  });

  it('keeps author and target deletes restricted while moderator delete sets null', () => {
    expect(migrationSql).toContain(
      'CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "reviews_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL',
    );
    for (const target of ['business', 'service', 'destination', 'attraction']) {
      expect(migrationSql).toContain(
        `CONSTRAINT "reviews_${target}_id_fkey" FOREIGN KEY ("${target}_id")`,
      );
      expect(migrationSql).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    }
  });
});