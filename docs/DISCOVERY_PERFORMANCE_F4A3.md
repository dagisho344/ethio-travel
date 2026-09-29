# Discovery performance assessment — F4A-3

## Baseline and scope

Measured from `b72f939d9d7e1207ea309a09d4350daa43fc6ddc` (F4A-2), with
22 applied migrations. This checkpoint adds an opt-in database benchmark,
not a production query change. No schema, migration, extension, index, seed,
cache, routing, localization model or shared-trip changes are authorized here.

## Reproduction and safety

From `apps/api`, in PowerShell:

```powershell
$env:DISCOVERY_DATABASE_TESTS='1'
pnpm exec node --env-file=.env node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand test/discovery-performance.database.e2e-spec.ts
$benchmarkExitCode=$LASTEXITCODE
Remove-Item Env:DISCOVERY_DATABASE_TESTS
exit $benchmarkExitCode
```

Without the existing `DISCOVERY_DATABASE_TESTS=1` opt-in, the suite is skipped.
It additionally rejects non-loopback database hosts. Do not point this at a
production database, run overlapping benchmark suites or run other heavy
quality gates concurrently with measurement. No credentials are hard-coded.

All generated rows live in one repeatable-read transaction, progressively
growing to each scale; the intentional exception rolls it back. Existing rows
are never updated/deleted. Random UUIDs/slugs isolate fixtures, while content,
distribution and geometry are deterministic. Counts, fixture absence, indexes
and extensions are checked after rollback. PostgreSQL `ANALYZE` runs inside
that transaction to avoid explaining large fixtures using tiny pre-fixture
estimates. Not all of its effects roll back: a preflight found that `pg_class`
row/page estimates retained synthetic counts after rollback. The benchmark
therefore re-analyzes only the same seven tables in `finally`, against the
original live rows, even when measurement fails. It reports refreshed estimates;
it does not promise byte-identical sampled statistics or physical page counts.
Rollback guarantees logical cleanup, not zero physical effects: inserts still
produce WAL, dirty buffers and reclaimable aborted tuple/index space. Normal
development vacuum remains responsible for physical cleanup; the benchmark
does not run VACUUM or clear caches.

## Method

The benchmark instantiates the actual `SearchService` and `MapsService` with
real Prisma transaction delegates. Their nested transaction callbacks reuse
the outer repeatable-read snapshot, as in the existing ranking database tests.
No matcher, ranked query, map query, hydration or rating query is mocked.
Timings cover service/Prisma/database work, not HTTP, browser rendering or
network deployment latency; transaction BEGIN/COMMIT overhead is excluded.
All delegates share one transaction connection, so normally parallel Map
branches serialize here; mixed-type Map timings do not measure a production
connection pool. Do not run this against a database being edited concurrently:
before/after count assertions assume a stable development database.

Each workload runs once as a first-observed/warm-up sample, then five times;
the reported warm statistic is the median. Fixtures were just inserted and
analyzed, so even the first observation is not a cold disk/cache benchmark.
No global cache eviction, server restart or configuration change is attempted.

The smallest and largest scales capture actual production SELECT/WITH statements from
Prisma query events and runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. Native
parameter types are inferred through a session-only PREPARE, allowlisted,
and explicitly restored when binding the event values for EXPLAIN. PREPARE
is deallocated. Native `bpchar` is preserved rather than casting currency
parameters to the truncating SQL `CHAR(1)` alias. Prisma's literal control
characters in event parameters are escaped only for JSON decoding; the bound
trim alphabet is unchanged. No untrusted SQL or values are interpolated. Reports contain
SQL fingerprints and plan-node metrics, not SQL arguments, credentials or
editorial bodies. EXPLAIN times are single instrumented observations, not the
five-run service median.

Synthetic Destination scales are 100, 1,000 and 10,000, plus respectively
90/900/9,000 translation rows, 50/500/5,000 Attractions, 25/250/2,500 Businesses,
and 50/500/5,000 Services. Three active Regions and thirty Cities (two inactive)
provide ancestry joins and scoped filters. Canonical full descriptions are
1,680 bytes before the optional term; translated full descriptions are 1,840
UTF8 bytes. Half the
Destinations have published complete Amharic translations, 10% draft, 10%
unpublished, 10% whitespace-only short description, 10% whitespace-only full
description and 10% missing. Display names are absent on some complete rows.
Some Destinations are draft and some Businesses suspended. No synthetic
reviews are added: Map rating-query overhead is included, but this is not a
large review-table aggregation benchmark.

Workloads include rare/common canonical names, short/full canonical prose,
Amharic names/snippets, English queries in Amharic, dual matches, ineligible
translations, no matches, page 1/page 40, mixed entity types, scoped City and
Service category/currency/price filters, bounded Map selection and Near Me.
Assertions ensure stable repeated counts/returned sizes, single-count dual matches,
zero hidden-translation matches and marker caps. Existing correctness suites
remain the authority for the full eligibility/security contract.

## Verified database environment and development data

- PostgreSQL 18.4, x86_64 Windows/MSVC 19.44; UTF8;
  `English_United States.1252` collation and character classification.
- Default text-search configuration: `pg_catalog.english` (not used by these
  substring queries); `shared_buffers=128MB`, `work_mem=4MB`.
- Enabled extensions: `plpgsql` 1.0 only; no `pg_trgm` or PostGIS.
- Docker configuration uses `postgres:16-alpine`. Its daemon was unavailable;
  the Docker CLI also reported denied access to its user config. No Docker
  runtime measurements or permissions bypass were attempted. PostgreSQL 16
  plans/collation must be measured separately on the deployment target.

These are current **development** counts, not production counts:

| Table                  | Live rows |
| ---------------------- | --------: |
| Destination            |         1 |
| DestinationTranslation |         0 |
| City                   |        71 |
| Region                 |        14 |
| Attraction             |         0 |
| Business               |         3 |
| Service                |         4 |
| BusinessCategory       |        11 |
| ServiceCategory        |        15 |

The separate synthetic scales add the records described above. Parent and
translation eligibility reduces qualifying counts; 10,000 synthetic
Destinations yield 9,000 common-query public matches, 4,000 translated-name
matches and 5,000 translated-snippet matches, not 10,000 public records.

## Existing index inventory

All listed indexes are B-tree; the benchmark logs their exact catalog names
and definitions. No migration creates a trigram, GIN/GiST or full-text index.

| Table                  | Indexed columns/keys                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destination            | `id` PK; `(city_id, slug)` unique; `city_id`; `status`; `name`; `(latitude, longitude)`                                                                                                         |
| DestinationTranslation | `id` PK; `(destination_id, locale)` unique; `(locale, is_published)`                                                                                                                            |
| City                   | `id` PK; `(region_id, slug)` unique; `region_id`; `status`; `name`; `(latitude, longitude)`                                                                                                     |
| Region                 | `id` PK; `slug` unique; `status`; `name`                                                                                                                                                        |
| Attraction             | `id` PK; `(destination_id, slug)` unique; `destination_id`; `category`; `status`; `name`; `(latitude, longitude)`                                                                               |
| Business               | `id` PK; `(city_id, slug)` unique; `city_id`; `destination_id`; `category_id`; `status`; `verification_summary`; `name`; `(latitude, longitude)`; `(status, verification_summary, category_id)` |
| Service                | `id` PK; `(business_id, slug)` unique; `business_id`; `category_id`; `status`; `pricing_model`; `name`; `price`; `(latitude, longitude)`; `(status, category_id, pricing_model)`                |

## Measurements

The final run passed all three scales and cleanup checks (one opt-in test,
152.121 seconds including Jest startup; measured test body 118.097 seconds).
The table reports warm **service median milliseconds** from five repeats,
not HTTP latency. These Windows timings are not a production SLA. Text lengths,
review volume, hardware, concurrency, collation, database version and plan/cache
state all affect deployment results. Earlier preflight runs varied materially;
the final run is a reproducible observation, not a confidence interval.

| Workload                               |     100 |   1,000 |    10,000 | Final total / returned |
| -------------------------------------- | ------: | ------: | --------: | ---------------------- |
| English rare canonical name            |  25.285 |  62.658 |   525.242 | 100 / 20               |
| English canonical name                 |  27.444 |  56.515 |   627.545 | 2,233 / 20             |
| English short prose                    |  21.016 |  85.791 |   439.508 | 2,000 / 20             |
| English full prose                     |  22.577 |  65.764 |   522.911 | 3,167 / 20             |
| Amharic display name                   |  37.114 | 107.394 | 1,044.664 | 4,000 / 20             |
| Amharic short prose                    |  34.210 |  99.125 | 1,087.720 | 5,000 / 20             |
| Amharic rare display name              |   8.716 |  86.955 |   766.310 | 5 / 5                  |
| English query, Amharic locale          |  26.540 |  65.363 |   505.363 | 2,233 / 20             |
| Canonical + translation dual match     |  26.196 |  74.895 |   977.445 | 1,000 / 20             |
| Hidden/incomplete translation term     |  10.840 |  65.381 |   673.652 | 0 / 0                  |
| English no match                       |   9.184 |  51.691 |   508.097 | 0 / 0                  |
| Amharic no match                       |   9.009 |  70.784 |   585.527 | 0 / 0                  |
| English common, page 1                 |  19.140 |  30.337 |   244.300 | 9,000 / 20             |
| Amharic common, page 1                 |  29.626 |  68.715 |   356.470 | 9,000 / 20             |
| Amharic common, page 40                |   4.865 |  52.564 |   355.080 | 9,000 / 20             |
| All entity types, common               |  75.350 | 133.908 |   666.173 | 20,366 / 20            |
| Amharic scoped Region + City           |  28.499 |  35.801 |    69.564 | 334 / 20               |
| Service scope/category/ETB/FIXED/price |  77.254 |  73.714 |    74.501 | 1 / 1                  |
| Bounded Map, English name              |  22.454 |  27.750 |    57.067 | no total / 98          |
| Bounded Map, Amharic name              |  35.719 |  86.707 |   187.265 | no total / 189         |
| Bounded Map, all types                 | 284.066 | 308.373 |   482.209 | no total / 200         |
| Near Me, Amharic distance              |  27.126 |  80.731 |    72.482 | 152 / 20               |
| Near Me Map, Amharic                   |  28.061 |  72.044 |    71.705 | no total / 152         |

The 100-row page-40 request returns an empty page with the correct total of 90;
it is not comparable to an occupied deeper page at larger scales. At 10,000,
page 1 and page 40 have similar costs because exact qualification/count/ranking
still covers the complete set. No candidate truncation is introduced.

First-observed samples at 10,000 were 484.319 ms (rare English), 836.022 ms
(Amharic name), 514.187 ms (English no match), and 198.960 ms (Amharic Map).
They are already warm-ish, sometimes faster than repeated medians, and cannot
be presented as cold-disk measurements.

## Representative query-plan evidence

These are single EXPLAIN observations for the leading selection/ranking
statement, **not** the service medians above. Other captured statements include
bounded hydration, ancestry summaries, translation hydration and grouped ratings.
The opt-in log emits fingerprinted plan metrics for every captured statement
in representative workloads at 100 and 10,000; no giant plan dump is committed.

| Workload at 10,000 | Planning / execution ms | Key evidence                                                                                                                                                      |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rare English       | 1.180 / 583.669         | Destination scan passes 9,501 and removes 500 drafts; ancestry gives 9,001; join filter removes 8,901 to return 100. Ranking sort of 100 uses 32 KB and 0.269 ms. |
| Amharic name       | 2.970 / 735.328         | Two translation scans each examine 9,000 rows, return 4,000/remove 5,000, and take 65.718/65.734 ms; ranking sort uses 355 KB/43.731 ms.                          |
| Rare Amharic name  | 3.599 / 769.954         | Only 5 matches, but two translation scans remove 8,995 each (71.420/85.483 ms); canonical/translation OR join filtering still evaluates 9,001 eligible parents.   |
| English no match   | 1.809 / 499.133         | Ancestry join costs 21.587 ms; the match join filter removes all 9,001. Final sort is effectively empty (0.011 ms).                                               |
| Amharic no match   | 2.844 / 601.088         | One executed translation scan removes all 9,000 (79.861 ms); the second subplan has zero loops.                                                                   |
| English common     | 1.991 / 288.296         | 9,000 qualifying IDs; canonical ordering sort 178.231 ms/956 KB, so ranking matters for high-hit queries.                                                         |
| Amharic common     | 3.039 / 483.736         | Translation name-ranking scan 114.442 ms; 9,000-row sort 138.261 ms/956 KB.                                                                                       |
| All types common   | 13.239 / 665.723        | Hash joins across eligible entities; 20,366-row sort 300.679 ms/2,104 KB.                                                                                         |
| Scoped Service     | 8.165 / 4.614           | Business category and Service business-ID indexes used; final matching row count remains 1 with intact ETB parameter.                                             |
| English Map        | 5.072 / 17.800          | Coordinate bitmap index yields 441 candidates; geography/eligibility/text gives 98 returned markers.                                                              |
| Amharic Map        | 3.440 / 117.540         | Same coordinate index; translation unique index for parent lookups, plus a 9,000-row translation scan; 189 returned markers.                                      |

Plans show hash joins for broad ancestry matching and nested loops/index probes
for selective hydration/scopes. The largest captured sort uses 2,104 KB,
quicksort/top-N sorts remain in memory, hash joins use one batch, and no temp
blocks are written. Root/shared buffers are hits (zero observed disk reads),
confirming this is a warm-cache assessment. Planning across _all_ captured
statements peaks at 52.843 ms; do not attribute all service overhead to ranking.
Node times are inclusive and overlap: do not sum them as independent costs.

At this distribution, translating eligibility/name matching adds full-table
work even for rare/no-match terms. Both canonical ILIKE evaluation over long
prose and translation scans grow with scale. Bounded Map/Near Me paths narrow
canonical work first and scale more gently; all-type Map additionally has 24
batched selection/hydration/rating statements serialized by the fixture adapter.
These are per-entity batches, not a per-marker N+1 pattern.

## Index decision and no-change justification

**No index, extension or migration is added in F4A-3.** This is not a claim
that broad discovery is fast enough for every production workload. The tested
unscoped selective/no-match paths are concerning at the largest scale.

The expensive canonical match is an OR across Destination name/short/full
description **and joined City/Region names**. Plans apply this as a join filter
after eligible ancestry joins. An index on Destination text alone is therefore
not proven to remove that dominant work with the current SQL shape. Translation
qualification adds scans and exact completeness checks; translated name ranking
uses `strpos(lower(...))`, not an indexable ILIKE predicate. Do not promise
that a collection of new indexes fixes either path without testing it.

- **Ordinary B-tree:** existing PK/FK/scope/status indexes already support the
  demonstrated joins, selective filters and hydration. Leading-wildcard
  `%substring%` matches are not fixed by another ordinary `name` B-tree.
  [PostgreSQL index-type guidance](https://www.postgresql.org/docs/18/indexes-types.html)
- **Translation partial B-tree:** a proposed `(destination_id)` index restricted
  to `locale='am' AND is_published=true` overlaps the existing unique
  `(destination_id, locale)` and `(locale, is_published)` indexes. Its potential
  size reduction does not demonstrate improvement for this distribution, where
  many published rows remain. No redundant index is recommended from this run.
- **pg_trgm:** the strongest candidate for a separately approved experiment,
  not an approved deployment. GIN/GiST trigram indexes can support ILIKE
  substring qualification on canonical `name`, `short_description`,
  `full_description`, and translated `display_name`/`short_description`.
  Never index translated full description as a search field. Test narrow
  candidates individually and compare the _actual whole query_ before choosing
  columns: joined OR conditions and `strpos` ranking may still dominate; common
  matches and terms without extractable trigrams may benefit little.
  [PostgreSQL pg_trgm guidance](https://www.postgresql.org/docs/18/pgtrgm.html)
- **Bounds/Near Me:** the existing `(latitude, longitude)` index is used in
  representative bounded plans. Leading latitude range and longitude filtering
  do not make it a general two-dimensional spatial engine. No extra coordinate
  index or PostGIS is justified by this bounded fixture.
  [PostgreSQL multicolumn guidance](https://www.postgresql.org/docs/18/indexes-multicolumn.html)

Approval is required before any extension/index experiment or production query
reshaping. Such work must preserve the exact qualifying set, totals, ranking,
translation completeness, public eligibility and stable page window. Trigram
indexes add storage, insert/update maintenance and build/deployment cost;
`full_description` is the largest canonical candidate, not a default choice.
Confirm extension permissions and PostgreSQL 16/deployment compatibility, measure
write/storage cost, plan nonblocking index deployment where needed, and define
rollback per selected index before proposing a migration. There is no reviewed
index SQL or migration name in this checkpoint because no particular new index
has yet demonstrated a benefit on the complete query.

## Reevaluation triggers and limitations

Reevaluate before scaling to the tested 10,000-Destination range with similarly
long prose, or sooner if production p95 latency/CPU shows selective or no-match
queries scanning most eligible records. Use the product's agreed latency and
concurrency targets rather than treating these local medians as an SLA. Compare
plans under representative concurrent traffic, deployment collation/version,
real review volumes and larger location taxonomies. Measure an explicitly
approved trigram/query-shape experiment before creating a permanent migration.

This benchmark establishes exact current behavior and a cost baseline, not
linguistic stemming, fuzzy matching, transliteration, an external search engine
or translated-full-description matching. No precise device coordinates are
stored; nearby positions are fixed synthetic inputs. UI, clustering, locale
cookies and shared-trip fragment-token handling are unchanged. Browser
acceptance from F4A-2 remains outstanding; no browser performance is claimed.

## Verification and known pre-existing issues

Commands below were executed on the final artifact. No repository-wide
formatter traversed the nested untracked checkout. In the root, targeted
Prettier uses the existing `.gitignore` as its ignore file so the explicitly
named documentation can be checked despite `docs/**` in `.prettierignore`.
No new formatter configuration was created.

| Command (working directory)                                                                                                                                                                                                          | Result                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm exec prettier --ignore-path .gitignore --check apps/api/test/discovery-performance.database.e2e-spec.ts docs/DISCOVERY_PERFORMANCE_F4A3.md docs/DISCOVERY_MAPS_COMPLETION.md docs/I18N_EDITORIAL_DESTINATIONS.md` (root)       | Passed, exit 0                                                                                                                                               |
| `pnpm exec eslint test/discovery-performance.database.e2e-spec.ts` (`apps/api`)                                                                                                                                                      | Passed, exit 0                                                                                                                                               |
| `pnpm typecheck` (`apps/api`)                                                                                                                                                                                                        | Passed, exit 0                                                                                                                                               |
| Opt-in benchmark invocation above (`apps/api`)                                                                                                                                                                                       | 1 suite / 1 test passed, exit 0                                                                                                                              |
| `pnpm exec jest --config test/jest-e2e.json --runInBand test/discovery-performance.database.e2e-spec.ts` without opt-in (`apps/api`)                                                                                                 | 1 suite / 1 test skipped, exit 0; no fixture/ANALYZE work                                                                                                    |
| `pnpm exec jest --config jest.config.js --runInBand src/destinations/destinations-translations.phase16.spec.ts src/search-ranking.phase16.spec.ts src/search-maps.phase5.spec.ts` (`apps/api`)                                       | 3 suites / 29 tests passed, exit 0                                                                                                                           |
| `DISCOVERY_DATABASE_TESTS=1` with `pnpm exec node --env-file=.env node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --silent test/search-maps.e2e-spec.ts test/search-ranking.database.e2e-spec.ts` (`apps/api`) | 2 suites / 21 tests passed, exit 0, including actual PostgreSQL ranking/locale paths                                                                         |
| `node --test tests/discovery-correctness.test.mjs tests/discovery-maps-phase15.test.mjs tests/i18n-discovery-f4a2.test.mjs` (`apps/web`)                                                                                             | 18 tests passed, exit 0                                                                                                                                      |
| `pnpm --dir apps/api exec prisma validate` (root)                                                                                                                                                                                    | Passed, exit 0                                                                                                                                               |
| `pnpm --dir apps/api exec prisma migrate status` (root)                                                                                                                                                                              | 22 migrations, database up to date, exit 0                                                                                                                   |
| `git diff --check` (root)                                                                                                                                                                                                            | Passed, exit 0                                                                                                                                               |
| `pnpm lint` (`apps/api`)                                                                                                                                                                                                             | Failed, exit 1: exactly the four known unrelated unsafe assignments in `src/destinations/destinations-translations.phase16.spec.ts` lines 181, 192, 193, 244 |

The pre-existing lint file is not modified. The unrelated formatting-only
`business-media.phase16.spec.ts` diff and nested `ethio-travel/` checkout are
preserved. No staging/commit/push occurs. Full workspace tests and a production
web build are not rerun for this test/documentation-only checkpoint; production
API/web code, dependency/configuration, Prisma schema and all 22 migration files
are unchanged. This is not a claim that the full lint gate is green or that a
new browser/build acceptance run occurred. Existing unrelated Prisma drift is
not reconciled by migration status/validation, and no drift repair was attempted.
