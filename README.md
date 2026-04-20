# Prisma Study Plan — Chat Notes
**April 2025 · Anil Neeli**
Stack: Prisma 5 · Node.js · TypeScript · PostgreSQL (Neon) · GitHub Codespaces

---

## Overview

22-day interview-focused Prisma study plan, 1hr/day, weekdays only. Weekends protected for AWS/Bedrock work. Target companies: Razorpay, CRED, Zepto (India return September 2026).

---

## Day 1 — Setup + Schema Syntax
**Tue Apr 1**

### Key learnings
- Use **Prisma 5** not 7 — Prisma 7 moved connection config out of `schema.prisma` into `prisma.config.ts`, breaking standard setup
- `generator` must use `provider = "prisma-client-js"` (not `prisma-client`)
- `datasource` requires `url = env("DATABASE_URL")` — without it Prisma throws on init
- Custom `output` path in generator causes import issues — use default `@prisma/client`
- DB connection via **Neon.tech** (free cloud Postgres, select "Prisma" connection string type)

### tsconfig.json — working setup for ts-node
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "verbatimModuleSyntax": false,
    "strict": true,
    "skipLibCheck": true,
    "ignoreDeprecations": "5.0",
    "types": ["node"]
  }
}
```

### Scalar types
| Type | Maps to (Postgres) | Notes |
|---|---|---|
| String | TEXT | Default for text |
| Int | INTEGER | Whole numbers |
| Float | DOUBLE PRECISION | Use Decimal for money |
| Boolean | BOOLEAN | true/false |
| DateTime | TIMESTAMP | Always UTC |
| Json | JSONB | Not type-safe in queries |
| String? | TEXT NULL | ? makes any type nullable |

### Field modifiers
| Modifier | What it does |
|---|---|
| `@id` | Primary key |
| `@unique` | Single field unique constraint |
| `@@unique([a, b])` | Compound unique — combination must be unique |
| `@default(uuid())` | Auto-generate UUID. Also: cuid(), now(), autoincrement() |
| `@updatedAt` | Auto-set on every update — client-side, not DB-side |
| `@map("col")` | Map to different DB column name |
| `@@map("table")` | Map to different DB table name |

### Interview Q
**"What's the difference between `@unique` and `@@unique`?"**
`@unique` is on a single field. `@@unique([email, tenantId])` means the combination must be unique — one email can exist across multiple tenants.

### Gotcha
`@updatedAt` is injected by Prisma Client, not the DB. If you update a row via raw SQL or another tool, `updatedAt` won't change.

### Practice exercise — Product model
```prisma
enum Category {
  ELECTRONICS
  CLOTHING
  FOOD
}

model Product {
  id          String   @id @default(uuid())
  name        String
  description String?   // must be optional — ? required
  price       Float
  sku         String   @unique
  category    Category
  inStock     Boolean  @default(true)
  tags        Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Day 2 — Relations
**Wed Apr 2**

### The golden rule — FK placement
The foreign key **always lives on the child side** (the "many" side / "belongs to" side). Post belongs to User → `userId` lives on Post, not User. The parent holds a virtual array — no DB column.

### Relation types

**1:N — One to Many**
```prisma
model User {
  id    String @id @default(uuid())
  posts Post[]   // virtual — no column in DB
}

model Post {
  userId String
  user   User @relation(fields: [userId], references: [id])
}
```

**1:1 — One to One**
Only difference from 1:N — `@unique` on the FK field:
```prisma
model Profile {
  userId String @unique   // @unique makes this 1:1
  user   User @relation(fields: [userId], references: [id])
}
```

**Implicit M:N** — Prisma manages join table. Use `connect`/`disconnect`. No extra columns possible.

**Explicit M:N** — You own the join table. Use when you need extra data on the relation:
```prisma
model PostTag {
  postId     String
  tagId      String
  taggedBy   String
  assignedAt DateTime @default(now())

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
}
```

### Referential actions
| Action | What happens | Use when |
|---|---|---|
| Cascade | Delete children when parent deleted | Posts when User deleted |
| Restrict (default) | Block parent delete if children exist | Financial records |
| SetNull | Set FK to null | Optional relations |
| NoAction | Like Restrict but checked at end of tx | Complex transactions |

### Interview Q
**"When would you use explicit M:N over implicit?"**
Explicit when the relation itself carries data — assignedAt, role, grade. Implicit when it's a pure connection with no metadata.

**"Where does the foreign key live?"**
Always on the child (many) side.

### Cascade tracing
```
User deleted
  └── Post.userId has Cascade → Posts deleted
        └── Comment.postId has Cascade → Comments deleted
        └── PostTag.postId has Cascade → PostTag rows deleted

Tag deleted
  └── PostTag.tagId has Cascade → PostTag rows deleted (Post survives)
```

### Mistakes made
1. Missing `?` on optional fields
2. Wrong `references` field — always reference the PK (`id`) of the other model
3. Missing `onDelete: Cascade` — Prisma defaults to Restrict

---

## Day 3 — CRUD + Typed Client
**Thu Apr 3**

### The key rule
- `findUnique` / `update` / `delete` → where needs `@id` or `@unique` field
- `findMany` / `updateMany` / `deleteMany` → where can use any field

### All operations
```typescript
// CREATE
prisma.post.create({ data: { ... } })
prisma.tag.createMany({ data: [...], skipDuplicates: true })

// READ
prisma.user.findUnique({ where: { email: 'x' } })   // @unique or @id only
prisma.post.findFirst({ where: { published: true }, orderBy: { createdAt: 'desc' } })
prisma.post.findMany({ where: { ... }, take: 10, skip: 0 })

// UPDATE
prisma.post.update({ where: { id: 'x' }, data: { published: true } })
prisma.post.updateMany({ where: { userId: 'x' }, data: { published: false } })
prisma.tag.upsert({ where: { name: 'x' }, create: { name: 'x' }, update: {} })

// DELETE
prisma.post.delete({ where: { id: 'x' } })
prisma.post.deleteMany({ where: { userId: 'x' } })
```

### Prisma input types
| Type | Use for |
|---|---|
| `Prisma.PostCreateInput` | data in create() — relation objects |
| `Prisma.PostUncheckedCreateInput` | data in create() — raw FK values (most common) |
| `Prisma.PostUpdateInput` | data in update() — all optional |
| `Prisma.PostWhereInput` | where in findMany() — any field |
| `Prisma.PostWhereUniqueInput` | where in findUnique/update/delete — @id/@unique only |
| `Prisma.PostSelect` | control which fields return |

### Three validation layers
```
Joi/Zod        → catches bad user input from outside (runtime)
Prisma types   → catches developer mistakes (compile time)
DB constraints → catches race conditions and integrity violations
```

### Error codes
- `P2002` — Unique constraint violation (duplicate email, SKU etc.)
- `P2025` — Record not found (thrown by update/delete when where has no match)

### update vs updateMany
`update()` throws P2025 if record not found. `updateMany()` silently returns `count: 0`. In fintech, prefer `update()` — you want to know if the record wasn't found.

### upsert race condition
Not atomic under high concurrency — two requests can both find "not exists" and both try to create, causing P2002. In fintech, use explicit transaction with find-then-create.

### Mistakes made
- `async const` — invalid syntax. Correct: `const fn = async () => {}`
- Used `userId` in `findUnique` — not a `@unique` field
- `prisma.userBlog` — model name must match exactly (camelCase)
- Queries outside `main()` — async functions must run inside main()
- Missing `where` + `update` clauses in upsert

---

## Day 4 — Interview Q: Schema Design
**Fri Apr 4**

*(Schema design out loud session — practice justifying every decision)*

---

## Day 5 — Filtering + Operators
**Mon Apr 7**

### Basic operators
```typescript
{ published: true }                          // equals (default)
{ published: { not: true } }                 // not
{ email: { in: ['a@x.com', 'b@x.com'] } }  // in
{ age: { gte: 18, lte: 60 } }              // range
{ name: null }                               // IS NULL
{ name: { not: null } }                     // IS NOT NULL
```

### String operators
```typescript
{ name: { contains: 'anil', mode: 'insensitive' } }  // ILIKE %anil%
{ title: { startsWith: 'How to' } }                   // LIKE value%
{ title: { endsWith: '2025' } }                        // LIKE %value
```

### AND / OR / NOT
```typescript
// AND is implicit — multiple fields at same level
{ published: true, userId: 'x' }

// Explicit AND + OR combination
{
  AND: [
    { published: true },
    { OR: [
      { title: { startsWith: 'How' } },
      { content: { contains: 'typescript' } }
    ]}
  ]
}
```

### Relation filters
```typescript
{ posts: { some: {} } }            // at least one post exists
{ posts: { some: { published: true } } }  // at least one published
{ posts: { every: { published: true } } } // ALL posts published
{ posts: { none: {} } }            // zero posts exist
{ user: { is: null } }             // nullable 1:1 relation only
```

### some/none vs is/isNot
- `some`/`every`/`none` → for **array relations** (1:N, M:N)
- `is`/`isNot` → for **nullable single relations** (1:1)

### Date filtering
Always use `gte` not `gt` for inclusive date range boundaries.

### Mistakes made
- `some:` with no value — needs `some: {}` or `some: { condition }`
- Used `is: null` on array relation — use `none: {}` instead
- Missing sort direction in `orderBy` — always specify `'asc'` or `'desc'`
- Wrong nesting in OR conditions — each condition is its own `{}`

---

## Day 6 — N+1 Deep Dive
**Tue Apr 8**

### What is N+1?
1 query to fetch a list + N queries (one per item) to fetch related data = N+1 total round trips.

### Enable query logging
```typescript
const prisma = new PrismaClient({ log: ['query'] })
```

### The problem
```typescript
const posts = await prisma.post.findMany()   // 1 query
for (const post of posts) {
  const user = await prisma.userBlog.findUnique({ where: { id: post.userId } })
  // N queries — one per post
}
// 10 posts = 11 queries. 100 posts = 101 queries.
```

### The fix — include
```typescript
const posts = await prisma.post.findMany({
  include: { user: true }
})
// Always 2 queries — Prisma batches with IN clause
// SELECT * FROM "UserBlog" WHERE id IN ('uuid-1', 'uuid-2', 'uuid-3')
```

### include vs select
```typescript
// include — all Post fields + relation
{ include: { user: true } }

// include + nested select — all Post fields + partial relation (most common)
{ include: { user: { select: { name: true, email: true } } } }

// select at top level — specific Post fields + specific relation (most performant)
{ select: { title: true, user: { select: { name: true } } } }
```

**Cannot use `select` and `include` together at top level.**

### include vs SQL JOIN
| Approach | Queries | Use when |
|---|---|---|
| Loop (N+1) | 1 + N | Never |
| include | 2 (fixed) | Most cases |
| Raw SQL JOIN | 1 | Complex reporting, max performance |

### Nested include — query count
```typescript
prisma.post.findMany({
  include: {
    user: { select: { name: true } },     // post author
    comments: {
      include: { user: { select: { name: true } } }  // comment authors
    }
  }
})
// 4 queries: Posts + post authors + comments + comment authors
```

### Interview answer flow
1. **Spot** — enable `log: ['query']`, count queries
2. **Cause** — fetching related data in a loop, one query per iteration
3. **Fix** — use `include` to batch into single IN clause
4. **Optimize** — use `select` inside `include` to avoid over-fetching
5. **Edge case** — very large datasets → `$queryRaw` with real SQL JOIN

---

## Day 7 — Pagination + Sorting
**Wed Apr 9**

### Offset pagination (skip/take)
```typescript
prisma.post.findMany({
  take: 10,
  skip: (page - 1) * pageSize,
  orderBy: { createdAt: 'desc' }
})
```
Simple but degrades at scale — `OFFSET 10000` scans 10,000 rows to return 10.

### Cursor-based pagination
```typescript
async function getPostsCursor({ take, cursor }: { take: number, cursor?: string }) {
  const posts = await prisma.post.findMany({
    take,
    skip: cursor ? 1 : 0,          // skip cursor itself
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' }
  })
  return {
    posts,
    nextCursor: posts.length === take ? posts[posts.length - 1].id : null
  }
}
```

### Why cursor wins at scale
- Offset: scans and discards all prior rows — O(N) with page number
- Cursor: uses index to jump directly — O(1) regardless of page
- Cursor is also stable — inserts don't shift results

### Sorting
```typescript
// Single field
{ orderBy: { createdAt: 'desc' } }

// Multiple fields — primary first, tiebreaker second
{ orderBy: [{ published: 'desc' }, { createdAt: 'desc' }] }

// By relation field
{ orderBy: { user: { name: 'asc' } } }

// By aggregation — users with most posts first
{ orderBy: { posts: { _count: 'desc' } } }
```

### Optional filters pattern
```typescript
where: {
  ...(published !== undefined && { published }),
  ...(userId && { userId })
}
```

---

## Day 8 — Nested Writes + Aggregations
**Thu Apr 10**

### Nested write operations
| Operation | Use when |
|---|---|
| connect | Link to existing record — use raw FK when you have the id |
| create | Create parent + children in one call (max 1 level deep in prod) |
| connectOrCreate | Find existing and connect, or create if not found |
| disconnect | Remove relation link without deleting the record |
| update nested | Update child while updating parent |

### Production rule
1 level deep nested write → fine. 2+ levels → break into explicit separate queries.

### Aggregations
```typescript
// count
await prisma.post.count()
await prisma.post.count({ where: { published: true } })

// aggregate
await prisma.userBlog.aggregate({
  _count: { id: true },
  _avg: { age: true },
  _min: { age: true },
  _max: { age: true },
  _sum: { age: true }
})
```

### groupBy
```typescript
await prisma.post.groupBy({
  by: ['userId'],
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } },  // extra nesting — sorting by aggregated value
  having: { id: { _count: { gte: 2 } } }  // filter groups after aggregation
})
```

### where vs having
- `where` — filters rows **before** grouping
- `having` — filters groups **after** aggregation

### orderBy syntax in groupBy
```
Normal orderBy:  { field: direction }
groupBy orderBy: { aggregation: { field: direction } }  // one extra level
```

### When to use $queryRaw
Complex aggregations, window functions, CTEs — raw SQL is cleaner. Add TypeScript generic for type safety:
```typescript
const result = await prisma.$queryRaw<{ userId: string; count: number }[]>`
  SELECT "userId", COUNT("id")::int as count FROM "Post" GROUP BY "userId"
`
```

### Mistakes made
- `_count: { userId: true }` — use `id` not `userId` for counting records
- `orderBy: { _count: 'desc' }` — missing field inside aggregation
- Used `aggregate` instead of `groupBy` for having clause

---

## Day 10 — Migrations Deep Dive
**Mon Apr 14**

### migrate dev vs migrate deploy
| | migrate dev | migrate deploy |
|---|---|---|
| Generates migration files | ✓ | ✗ |
| Applies pending migrations | ✓ | ✓ |
| Resets DB on drift | ✓ | ✗ |
| Runs seed script | ✓ | ✗ |
| Use in | Local dev | CI/CD, production |

### Shadow database
Temporary clean DB Prisma creates and destroys automatically. Replays all existing migrations to get "before" state, then diffs against current schema to generate new migration SQL. Never interact with it directly.

### Never edit a migration after applying
Every migration has a checksum in `_prisma_migrations`. Editing after applying causes checksum mismatch → blocks all future migrations → production outage.

### Expand-contract — zero-downtime column rename
```
❌ DANGEROUS: ALTER TABLE "User" RENAME COLUMN "fullName" TO "name"
   → locks table + breaks running code

✅ SAFE — expand-contract:

Phase 1 (Expand):
  Migration: ADD COLUMN "name", backfill from "fullName"
  Deploy: code writes to BOTH columns

Phase 2 (Contract):
  Deploy: code only uses "name"
  Migration: DROP COLUMN "fullName"
```

### Failed migration recovery
```bash
npx prisma migrate status                          # see what failed

# Option A — revert partial changes manually, then:
npx prisma migrate resolve --rolled-back "migration_name"

# Option B — finish SQL manually, then:
npx prisma migrate resolve --applied "migration_name"
```

### Can you re-run a failed migration?
Not directly — Prisma blocks re-runs. Most generated SQL is not idempotent. Fix: `resolve --rolled-back` → edit SQL to add `IF NOT EXISTS` guards → create new migration → deploy.

### CONCURRENTLY — index without table lock
```bash
# Generate SQL without applying
npx prisma migrate dev --name add-email-index --create-only

# Edit generated SQL:
# Change: CREATE INDEX "idx" ON "User"("email")
# To:     CREATE INDEX CONCURRENTLY "idx" ON "User"("email")

# Apply
npx prisma migrate dev
```

| | Normal INDEX | CONCURRENTLY |
|---|---|---|
| Table lock | Yes — blocks all queries | No |
| Build speed | Faster | 2-3x slower |
| In transaction | Yes | No |
| Use when | Small tables | Large production tables |

If CONCURRENTLY fails → leaves INVALID index → must `DROP INDEX CONCURRENTLY` and retry.

### Idempotent SQL — safe to run multiple times
```sql
-- Each line has a guard — "only act if work not done yet"
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
UPDATE "User" SET "name" = "fullName" WHERE "name" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_name_idx" ON "User"("name");
```

**Idempotent** = run once or ten times, same result. Don't overwrite or duplicate existing data.

---

## Setup Issues Encountered (Day 1)

| Issue | Cause | Fix |
|---|---|---|
| `Module has no exported member 'PrismaClient'` | Custom output path in generator | Remove `output` from generator, use default `@prisma/client` |
| `verbatimModuleSyntax` error | tsconfig strict mode conflict | Set `verbatimModuleSyntax: false`, `module: CommonJS` |
| `PrismaClientInitializationError` | Prisma 7 — no `url` in schema | Downgrade to `prisma@5 @prisma/client@5` |
| `datasources` not in type | Prisma 7 renamed to `datasourceUrl` | Downgrade to Prisma 5 (stable, what jobs use) |
| Empty terminal output | Missing `main()` call at bottom | Add `main().catch(console.error).finally(() => prisma.$disconnect())` |
| `node ts-node file.ts` error | Wrong command | Use `npx ts-node file.ts` |

---

## Key Interview Answers

### N+1
> "Enable `log: ['query']` to spot it in the terminal. It happens when you fetch related data inside a loop — one query per iteration. Fix with `include` — Prisma batches all IDs into a single IN clause, always 2 queries regardless of data size. Optimize further with `select` inside `include` to avoid over-fetching."

### Cursor vs offset pagination
> "Offset requires Postgres to scan and discard all prior rows — `OFFSET 10000` scans 10,000 rows to return 10. Cursor uses an index to jump directly to the right position — same speed on page 1 or page 10,000. Cursor is also stable under inserts."

### When NOT to use Prisma
> "Complex reporting queries with CTEs or window functions, bulk operations at scale, full-text search, or when EXPLAIN ANALYZE shows Prisma generating a slow query I can't override. I'd drop to `$queryRaw` and write SQL directly, adding a TypeScript generic for type safety."

### Rename column with zero downtime
> "Expand-contract: Migration 1 adds the new column and backfills data, deploy code that writes to both. Migration 2 drops the old column after code no longer references it. Never rename directly — it locks the table and breaks running instances."

### Failed migration recovery
> "Run `migrate status` to see what failed. Connect to the DB and assess partial state. If reverting, undo the partial SQL manually and run `migrate resolve --rolled-back`. If completing, finish the SQL manually and run `migrate resolve --applied`. Verify with `migrate status` before redeploying."

### Idempotent migration
> "Write SQL with `IF NOT EXISTS` guards and `WHERE IS NULL` on backfill — so it can run multiple times without overwriting already-migrated data or throwing duplicate errors."

---

## Commands Reference

```bash
# Setup
npm install prisma@5 @prisma/client@5 dotenv
npx prisma init
npx prisma generate

# Migrations
npx prisma migrate dev --name description     # local dev
npx prisma migrate deploy                      # production
npx prisma migrate status                      # check state
npx prisma migrate dev --create-only           # generate SQL without applying
npx prisma migrate resolve --rolled-back name  # mark as rolled back
npx prisma migrate resolve --applied name      # mark as applied

# Run files
npx ts-node src/day1.ts

# Inspect
npx prisma studio                              # browser UI at localhost:5555
```

---

## Days Completed

| Day | Topic | Status |
|---|---|---|
| Day 1 | Setup + schema syntax | ✓ |
| Day 2 | Relations | ✓ |
| Day 3 | CRUD + typed client | ✓ |
| Day 4 | Interview Q: schema design | ✓ |
| Day 5 | Filtering + operators | ✓ |
| Day 6 | N+1 deep dive | ✓ |
| Day 7 | Pagination + sorting | ✓ |
| Day 8 | Nested writes + aggregations | ✓ |
| Day 9 | Mock round 1 | skipped |
| Day 10 | Migrations deep dive | ✓ |
| Day 11 | Transactions | upcoming |
| Day 12 | Raw SQL + when to escape | upcoming |
| Day 13 | Soft deletes + audit trail | upcoming |
| Day 14 | Consolidation — repo layer | upcoming |
| Day 15 | Indexes + query plans | upcoming |
| Day 16 | Connection pooling | upcoming |
| Day 17 | Prisma in Lambda + ECS | upcoming |
| Day 18 | Multi-tenancy + seeding | upcoming |
| Day 19 | System design: payment ledger | upcoming |
| Day 20 | Capstone: fintech schema | upcoming |
| Day 21 | Mock round 2 — full sim | upcoming |
| Day 22 | Gap review + README polish | upcoming |