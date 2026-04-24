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
    user: { select: { name: true } },
    comments: {
      include: { user: { select: { name: true } } }
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
    skip: cursor ? 1 : 0,
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
{ orderBy: { createdAt: 'desc' } }
{ orderBy: [{ published: 'desc' }, { createdAt: 'desc' }] }
{ orderBy: { user: { name: 'asc' } } }
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
await prisma.post.count()
await prisma.post.count({ where: { published: true } })

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
  orderBy: { _count: { id: 'desc' } },
  having: { id: { _count: { gte: 2 } } }
})
```

### where vs having
- `where` — filters rows **before** grouping
- `having` — filters groups **after** aggregation

### When to use $queryRaw
Complex aggregations, window functions, CTEs — raw SQL is cleaner:
```typescript
const result = await prisma.$queryRaw<{ userId: string; count: number }[]>`
  SELECT "userId", COUNT("id")::int as count FROM "Post" GROUP BY "userId"
`
```

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
Temporary clean DB Prisma creates and destroys automatically. Replays all existing migrations to get "before" state, diffs against current schema to generate new migration SQL.

### Expand-contract — zero-downtime column rename
```
Phase 1 (Expand): ADD COLUMN "name", backfill from "fullName", deploy dual-write code
Phase 2 (Contract): deploy code using "name" only, DROP COLUMN "fullName"
```

### Failed migration recovery
```bash
npx prisma migrate status
npx prisma migrate resolve --rolled-back "migration_name"
npx prisma migrate resolve --applied "migration_name"
```

### Idempotent SQL
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
UPDATE "User" SET "name" = "fullName" WHERE "name" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_name_idx" ON "User"("name");
```

---

## Day 11 — Transactions
**Tue Apr 15**

### ACID
Atomicity, Consistency, Isolation, Durability. All succeed or all fail — no partial state.

### Two styles
```typescript
// Sequential array — simple, can't read then conditionally write
const [debit, credit] = await prisma.$transaction([
  prisma.account.update({ where: { id: 'a' }, data: { balance: { decrement: 1000 } } }),
  prisma.account.update({ where: { id: 'b' }, data: { balance: { increment: 1000 } } })
])

// Interactive callback — read then validate then write
const result = await prisma.$transaction(async (tx) => {
  const account = await tx.account.findUnique({ where: { id: 'a' } })
  if (account.balance < 1000) throw new Error('Insufficient funds')
  await tx.account.update({ where: { id: 'a' }, data: { balance: { decrement: 1000 } } })
  await tx.account.update({ where: { id: 'b' }, data: { balance: { increment: 1000 } } })
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
```

### Isolation levels
| Level | Prevents | Use when |
|---|---|---|
| ReadCommitted | Dirty reads (default) | Dashboards, reports |
| RepeatableRead | Dirty + non-repeatable reads | Inventory checks |
| Serializable | All anomalies | Money transfers, payments |

### Idempotency key — prevent double charge
Check idempotencyKey inside the transaction before processing. Return existing if found.

### P2034 — safe to retry
```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (error.code === 'P2034' && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}
```

### DB retry vs Kafka retry
- DB retry → fix the write before it commits (P2034, timing-based conflict)
- Kafka retry → fix the side effect after it committed (SMS, webhook, fraud check)

---

## Day 12 — Raw SQL + When to Escape Prisma
**Thu Apr 16**

### Three methods
```typescript
// $queryRaw — read data, returns typed results with generic
const users = await prisma.$queryRaw<{ id: string; email: string }[]>`
  SELECT id, email FROM "UserBlog" WHERE age > 25
`

// $executeRaw — mutations, returns affected row count
const affected = await prisma.$executeRaw`
  UPDATE "UserBlog" SET "isActive" = false WHERE "lastLoginAt" < NOW() - INTERVAL '90 days'
`

// $queryRawUnsafe — only for dynamic table/column names, never user input
await prisma.$queryRawUnsafe(`SELECT * FROM "${hardcodedTableName}"`)
```

### SQL injection safety
Tagged template syntax is safe — Prisma parameterizes `${}` values automatically. Never use `$queryRawUnsafe` with user input.

### When NOT to use Prisma ORM
1. Complex aggregations — CTEs, window functions
2. Bulk operations at scale — raw INSERT faster than createMany
3. Full-text search — Postgres `to_tsvector` not exposed by Prisma
4. Generated SQL is too slow — EXPLAIN ANALYZE shows Seq Scan you can't fix
5. Query API more complex than equivalent SQL

### EXPLAIN ANALYZE
- `Seq Scan` → bad, needs index
- `Index Scan` → good
- `Bitmap Heap Scan` → acceptable

---

## Day 13 — Soft Deletes + Audit Trail
**Thu Apr 17**

### deletedAt pattern
```prisma
model UserBlog {
  deletedAt DateTime?  // null = active, timestamp = soft deleted
}
```

### Global soft delete middleware
```typescript
prisma.$use(async (params, next) => {
  if (['UserBlog', 'Post'].includes(params.model ?? '')) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, deletedAt: null }
    }
    if (params.action === 'delete') {
      params.action = 'update'
      params.args.data = { deletedAt: new Date() }
    }
    if (params.action === 'deleteMany') {
      params.action = 'updateMany'
      params.args.data = { deletedAt: new Date() }
    }
  }
  return next(params)
})
```

### AuditLog schema
```prisma
model AuditLog {
  id        String   @id @default(uuid())
  model     String
  recordId  String
  action    String   // "CREATE", "UPDATE", "DELETE"
  before    Json?
  after     Json?
  userId    String?
  createdAt DateTime @default(now())
  @@index([model, recordId])
  @@index([createdAt])
}
```

### Audit middleware — key points
- Capture `before` state with `findUnique` BEFORE calling `next(params)`
- Capture `after` state from the result of `next(params)`
- Use `(prisma as any)[modelName]` for dynamic model access — TypeScript can't verify dynamic string keys
- Convert model name: `params.model.charAt(0).toLowerCase() + params.model.slice(1)`

### Restore soft-deleted record
```typescript
// Find deleted — must use explicit filter to bypass middleware
const deleted = await prisma.userBlog.findFirst({
  where: { id, deletedAt: { not: null } }
})
// Restore
await prisma.userBlog.update({ where: { id }, data: { deletedAt: null } })
```

---

## Day 14 — Consolidation: Repo Layer
**Mon Apr 21**

### Fintech schema additions
```prisma
model Account {
  id           String      @id @default(uuid())
  userId       String
  type         AccountType
  balance      Float       @default(0)
  deletedAt    DateTime?
  transactions Transaction[]
  user         UserBlog    @relation(fields: [userId], references: [id])
}

model Transaction {
  id             String            @id @default(uuid())
  accountId      String
  amount         Float
  type           TransactionType
  status         TransactionStatus @default(PENDING)
  idempotencyKey String            @unique
  createdAt      DateTime          @default(now())
  account        Account           @relation(fields: [accountId], references: [id])
}
```

### Key patterns from consolidation
```typescript
// Atomic balance update — no read-then-write needed
prisma.account.update({
  where: { id },
  data: { balance: type === 'increment' ? { increment: amount } : { decrement: amount } }
})

// sumByAccountId — use aggregate not groupBy
const result = await prisma.transaction.aggregate({
  where: { accountId },
  _sum: { amount: true }
})
return result._sum.amount ?? 0

// transferFunds — 6 steps
// 1. Check idempotency key (inside tx)
// 2. Validate sender balance
// 3. Debit sender
// 4. Credit receiver
// 5. Record DEBIT transaction
// 6. Record CREDIT transaction (idempotencyKey + '_credit')
```

### Error codes reminder
- `P2002` — unique constraint — don't retry
- `P2025` — record not found — don't retry
- `P2034` — serialization conflict — safe to retry

---

## Day 15 — Indexes + Query Plans
**Tue Apr 22**

### @@index in Prisma
```prisma
@@index([userId])              // single field
@@index([userId, createdAt])   // composite — leading column rule applies
```
`@id`, `@unique`, `@@unique` all auto-create indexes.

### Composite index — leading column rule
`@@index([userId, createdAt])` helps:
- filter by `userId` alone ✓
- filter by `userId + createdAt` ✓
- filter by `createdAt` alone ✗ — leading column missing

### EXPLAIN ANALYZE
```typescript
await prisma.$queryRaw`EXPLAIN ANALYZE SELECT * FROM "Post" WHERE "userId" = ${userId}`
```
- `Seq Scan` → needs index
- `Index Scan` → efficient
- `Bitmap Heap Scan` → acceptable

### Partial indexes — via custom migration
```sql
CREATE INDEX "Post_userId_published_idx" ON "Post"("userId") WHERE published = true;
```

### Slow patterns Prisma generates
1. Filtering on unindexed relation field
2. Ordering on unindexed column
3. include on unindexed FK — `postId IN (...)` with no index on `postId`

### Workflow
Enable `log: ['query']` → EXPLAIN ANALYZE → add `@@index` → if still slow → `$queryRaw`

---

## Day 16 — Connection Pooling
**Wed Apr 23**

### Singleton — most important rule
One PrismaClient per process. Never instantiate inside a request handler. Module-level code runs once and is cached by Node.js module system.

### Lambda singleton pattern
```typescript
declare global { var prisma: PrismaClient | undefined }
const prisma = global.prisma ?? new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL + '?connection_limit=1' } }
})
if (process.env.NODE_ENV !== 'production') global.prisma = prisma
export default prisma
```

### connection_limit calculation
`connection_limit = total usable connections ÷ number of instances`
- ECS db.t3.medium (340 max), 10 tasks, 40 reserved: `300 ÷ 10 = 30`
- Lambda db.t3.micro (85 max): `connection_limit=1` per Lambda instance

### PgBouncer modes
| Mode | Efficiency | Prisma $transaction | Use |
|---|---|---|---|
| Session | Low | Works fine | Safe default |
| Transaction | High | Breaks without pgbouncer=true | Add ?pgbouncer=true |
| Statement | Highest | Completely broken | Never |

### Why transaction mode breaks Prisma
PgBouncer releases the Postgres connection after each query. Prisma's interactive transaction spans multiple queries — they end up on different Postgres connections. `BEGIN` on C1, `COMMIT` on C3 — no open transaction.

### RDS Proxy
AWS managed pooler. IAM auth, automatic failover, multiplexing. Best choice for ECS + RDS setup. No special Prisma config — just change the endpoint URL.

### idle in transaction
Transaction opened but never committed/rolled back. Fix: use `$transaction()` — handles COMMIT/ROLLBACK automatically. Detect: `pg_stat_activity WHERE state = 'idle in transaction'`. Kill: `pg_terminate_backend(pid)`.

---

## Day 17 — Prisma in Lambda + ECS
**Thu Apr 24**

### Binary target problem
Prisma generates a Rust query engine binary that must match the deployment OS. Mismatch = runtime crash (not build-time).

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

### Binary targets
| Target | Use for |
|---|---|
| native | Local dev machine |
| rhel-openssl-3.0.x | Amazon Linux 2023 — Lambda Node 20, ECS Fargate |
| rhel-openssl-1.0.x | Amazon Linux 2 — older Lambda runtimes |
| linux-arm64-openssl-3.0.x | Graviton ARM-based Lambda/ECS |
| debian-openssl-3.0.x | Ubuntu/Debian containers |

### Dockerfile — multi-stage ECS
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Migration deployment — why separate step
Three reasons:
1. Old app keeps running if migration fails — users see no downtime
2. No ECS restart loop — entrypoint.sh crash → ECS restarts → checksum mismatch → loops
3. Separation of concerns — infrastructure operation needs controlled execution, not buried in app startup

```bash
# CI/CD pipeline
aws ecs run-task --cluster my-cluster --task-definition migrate-task \
  --overrides '{"containerOverrides":[{"name":"app","command":["npx","prisma","migrate","deploy"]}]}'
aws ecs wait tasks-stopped --cluster my-cluster --tasks $TASK_ARN
aws ecs update-service --cluster my-cluster --service my-service --force-new-deployment
```

### DATABASE_URL via Secrets Manager
```json
{ "secrets": [{ "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..." }] }
```

### Cold start impact
| Scenario | Cold start |
|---|---|
| Without Prisma | ~200ms |
| With Prisma | ~800–1200ms (30MB binary) |
| Provisioned concurrency | ~0ms |
| ECS Fargate | No cold starts |

### ECS vs Lambda
- ECS → always-on APIs, no cold starts, connection_limit = usable ÷ task count
- Lambda → async jobs, reports, emails, connection_limit = 1

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
> "Offset requires Postgres to scan and discard all prior rows — `OFFSET 10000` scans 10,000 rows to return 10. Cursor uses an index to jump directly — same speed on page 1 or page 10,000. Cursor is also stable under inserts."

### When NOT to use Prisma
> "Complex reporting with CTEs or window functions, bulk operations at scale, full-text search, or when EXPLAIN ANALYZE shows a Seq Scan I can't fix. Drop to `$queryRaw` with a TypeScript generic for type safety."

### Rename column with zero downtime
> "Expand-contract: Migration 1 adds the new column and backfills data, deploy code that writes to both. Migration 2 drops the old column after code no longer references it."

### Failed migration recovery
> "Run `migrate status`. Assess partial DB state. Revert manually then `migrate resolve --rolled-back`, or finish manually then `migrate resolve --applied`. Verify with `migrate status`."

### Transactions — two styles
> "$transaction([]) for simple sequential ops. Interactive callback for read-then-validate-then-write. Serializable isolation for money transfers. P2034 = serialization conflict = safe to retry with exponential backoff."

### Soft deletes
> "Add nullable `deletedAt` DateTime. Use `$use()` middleware to inject `deletedAt: null` on all reads and convert deletes to updates globally. Developers never need to remember the filter."

### Connection pooling in ECS
> "Singleton PrismaClient, one per process. connection_limit = usable connections ÷ task count. RDS Proxy for multiplexing and automatic failover. Never instantiate PrismaClient inside a request handler."

### Deploy Prisma in ECS
> "binaryTargets includes rhel-openssl-3.0.x. prisma generate in Docker build stage. Migrations as separate ECS one-off task before deploying app — three reasons: old app keeps running on failure, no restart loop risk, separation of concerns. DATABASE_URL from Secrets Manager."

### Idempotent migration
> "Write SQL with `IF NOT EXISTS` guards and `WHERE IS NULL` on backfill — safe to run multiple times without overwriting already-migrated data."

---

## Commands Reference

```bash
# Setup
npm install prisma@5 @prisma/client@5 dotenv
npx prisma init
npx prisma generate

# Migrations
npx prisma migrate dev --name description
npx prisma migrate deploy
npx prisma migrate status
npx prisma migrate dev --create-only
npx prisma migrate resolve --rolled-back name
npx prisma migrate resolve --applied name

# Run files
npx ts-node src/day1.ts

# Inspect
npx prisma studio
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
| Day 11 | Transactions | ✓ |
| Day 12 | Raw SQL + when to escape | ✓ |
| Day 13 | Soft deletes + audit trail | ✓ |
| Day 14 | Consolidation — repo layer | ✓ |
| Day 15 | Indexes + query plans | ✓ |
| Day 16 | Connection pooling | ✓ |
| Day 17 | Prisma in Lambda + ECS | ✓ |
| Day 18 | Multi-tenancy + seeding | upcoming |
| Day 19 | System design: payment ledger | upcoming |
| Day 20 | Capstone: fintech schema | upcoming |
| Day 21 | Mock round 2 — full sim | upcoming |
| Day 22 | Gap review + README polish | upcoming |
