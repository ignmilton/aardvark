# Aardvark Interactive Fiction Platform — Code Review

**Date:** 2026-02-17
**Scope:** Full-stack codebase review (backend, frontend, shared, infrastructure)
**Reviewer:** Automated senior engineering review

---

## Executive Summary

Aardvark is a well-structured full-stack interactive fiction platform with a solid architectural foundation. The codebase follows NestJS and Next.js conventions consistently, demonstrates good security awareness (JWT blacklisting, HTML sanitization, rate limiting, account lockout), and uses proper transactional patterns for financial operations. However, the review identified **26 findings across 4 severity levels**: a ValidationPipe implicit conversion bypass, missing search pagination caps, a refresh token rotation gap, multiple N+1 query patterns (search tags, threaded comments), race conditions in counter updates, an empty WebSocket module, missing composite database indexes, an unused cache layer, and frontend bundle size issues. The credit/payment system is particularly well-implemented with proper pessimistic locking.

---

## Critical Issues

### 1. `enableImplicitConversion` in ValidationPipe Bypasses Type Safety

**Location:** `backend/src/main.ts:126`
**Severity:** :red_circle: Critical

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true, // <-- Problem
    },
  }),
);
```

**Problem:** `enableImplicitConversion: true` causes `class-transformer` to automatically convert types based on the TypeScript type metadata, which can bypass explicit `class-validator` decorators. For example, a string `"true"` for a boolean field will be silently converted without validation, and numbers from query strings may be coerced in unexpected ways. This effectively undermines the `whitelist` and `forbidNonWhitelisted` safeguards.

**Recommendation:** Remove `enableImplicitConversion` and use explicit `@Transform()` decorators in DTOs where type conversion is needed. Or at minimum, ensure all DTOs use explicit `@Type(() => Number)` decorators rather than relying on implicit conversion.

### 2. Search Endpoints Missing Pagination Limits

**Location:** `backend/src/modules/search/search.service.ts:263` and `:399`
**Severity:** :red_circle: Critical

```typescript
async searchStories(dto: SearchStoriesDto) {
  const { query, page = 1, limit = 20 } = dto;
  // No cap on limit — user can request limit=100000
```

**Problem:** The `searchStories` and `searchUsers` methods do not cap the `limit` parameter, unlike other services (stories, comments, moderation) which all cap at 50-100. A malicious user could request `limit=100000` causing massive Elasticsearch or database result sets.

**Recommendation:** Add `const limit = Math.min(Math.max(1, rawLimit), 100)` consistent with the pattern used in `StoriesService.findAll()`, `CommentsService.findAll()`, and `ModerationService.getReportQueue()`.

### 3. Refresh Token Not Invalidated on Rotation

**Location:** `backend/src/modules/auth/auth.service.ts:246-282`
**Severity:** :red_circle: Critical

```typescript
async refreshToken(refreshTokenStr: string): Promise<{...}> {
  const payload = await this.jwtService.verifyAsync(refreshTokenStr, {
    secret: this.configService.get("jwt.refreshSecret"),
  });
  // ... generates new tokens
  return this.generateTokens(user);
  // Old refresh token is NOT blacklisted
}
```

**Problem:** The service implements token rotation (issues a new refresh token each time), but the old refresh token is never invalidated. An attacker who captures a refresh token can use it repeatedly even after the legitimate user has rotated it. The comment on line 243 says "Implements token rotation" but the old token remains valid until its natural expiry.

**Recommendation:** Store refresh tokens in the database (or Redis) and invalidate the old token when issuing a new one. Alternatively, blacklist used refresh tokens similarly to how access tokens are blacklisted on logout via `TokenBlacklistService`.

---

## High-Severity Findings

### 4. N+1 Query in Advanced Search

**Location:** `backend/src/modules/search/search.service.ts:901-913`
**Severity:** :orange_circle: High

```typescript
const storiesWithTags = await Promise.all(
  stories.map(async (story) => {
    const storyTags = await this.storyTagRepository.find({
      where: { storyId: story.id },
      relations: ["tag"],
    });
    return { ...story, storyTags: storyTags.map((st) => st.tag) };
  }),
);
```

**Problem:** For every story in the result set, a separate database query fetches its tags. With a page of 20 results, this produces 21 queries. This is a classic N+1 problem that degrades as result size grows.

**Recommendation:** Replace with a single query:
```typescript
const storyIds = stories.map(s => s.id);
const allStoryTags = await this.storyTagRepository.find({
  where: { storyId: In(storyIds) },
  relations: ["tag"],
});
const tagsByStory = new Map<string, Tag[]>();
allStoryTags.forEach(st => {
  if (!tagsByStory.has(st.storyId)) tagsByStory.set(st.storyId, []);
  tagsByStory.get(st.storyId)!.push(st.tag);
});
```

### 5. Race Conditions in Counter Increments

**Location:** Multiple services
**Severity:** :orange_circle: High

Several counter updates happen outside of transactions and can race:

- `backend/src/modules/comments/comments.service.ts:67-79` — `repliesCount` and `commentCount` increments after comment creation are separate from the comment save transaction
- `backend/src/modules/comments/comments.service.ts:293-306` — Decrements on soft-delete are separate from the delete save
- `backend/src/modules/segments/segments.service.ts:454` — `incrementReadCount` outside any transaction

**Problem:** Under concurrent requests, these increment/decrement operations can result in lost updates or incorrect counts. For example, two simultaneous comment creations could both read the same count and increment to the same value.

**Recommendation:** TypeORM's `.increment()` and `.decrement()` methods are atomic SQL operations (they use `SET count = count + 1`), so the individual operations are safe. However, the comment service saves the comment and then increments counters in separate operations with no transaction wrapper — if the increment fails, the count drifts. Wrap the comment creation and counter updates in a single transaction.

### 6. Slug Generation Race Condition

**Location:** `backend/src/modules/stories/stories.service.ts:48-59`
**Severity:** :orange_circle: High

```typescript
private async generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;
  while (await this.storyRepository.findOne({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return slug;
}
```

**Problem:** Two simultaneous story creations with the same title can both check for slug uniqueness, find it available, and then both attempt to save with the same slug, causing a database constraint violation. The method is a check-then-act pattern without any locking.

**Recommendation:** Wrap in a database transaction with serializable isolation, or catch the unique constraint violation and retry with a suffix. A simpler approach: append a short random suffix (e.g., `nanoid(6)`) when a collision is detected.

### 7. WebSocket Module is Empty

**Location:** `backend/src/modules/websocket/websocket.module.ts`
**Severity:** :orange_circle: High

```typescript
@Module({})
export class WebsocketModule {}
```

**Problem:** The WebSocket module is empty — no gateway, no handlers, no authentication. The `IoAdapter` is configured in `main.ts:142`, but there's no actual implementation. This means real-time features described in the architecture (notifications, live updates) are non-functional.

**Recommendation:** Implement a WebSocket gateway with JWT authentication, room management for story sessions, and proper event handlers. At minimum, add a TODO comment so this isn't overlooked.

### 8. Reindex Operations Load All Records into Memory

**Location:** `backend/src/modules/search/search.service.ts:588-611` and `:736-756`
**Severity:** :orange_circle: High

```typescript
async reindexAllStories(): Promise<{ indexed: number; failed: number }> {
  const stories = await this.storyRepository.find({
    where: { status: StoryStatus.PUBLISHED },
    relations: ["author"],
  });
  // Iterates all stories in memory
```

**Problem:** `reindexAllStories()` and `reindexAllTags()` load ALL records into memory at once. As the platform grows, this will cause memory exhaustion and long blocking operations.

**Recommendation:** Use cursor-based pagination or streaming:
```typescript
const batchSize = 100;
let skip = 0;
while (true) {
  const batch = await this.storyRepository.find({
    where: { status: StoryStatus.PUBLISHED },
    relations: ["author"],
    skip,
    take: batchSize,
  });
  if (batch.length === 0) break;
  for (const story of batch) await this.indexStory(story);
  skip += batchSize;
}
```

---

## Medium-Severity Findings

### 9. `previousVersionId` Self-Reference Bug

**Location:** `backend/src/modules/segments/segments.service.ts:219`
**Severity:** :yellow_circle: Medium

```typescript
segment.previousVersionId = segment.id; // References itself, not a previous version
segment.version += 1;
```

**Problem:** Setting `previousVersionId = segment.id` means the segment always points to itself as its "previous version," rather than creating an actual version chain. The intent appears to be version history, but this creates a self-referencing loop that provides no useful history.

**Recommendation:** If version history is needed, create a new entity for the old version before modifying, or use a separate versioning table. If version history is not yet implemented, set `previousVersionId = null` and add a TODO.

### 10. CSP Allows `'unsafe-inline'` for Scripts

**Location:** `backend/src/main.ts:53`
**Severity:** :yellow_circle: Medium

```typescript
scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
```

**Problem:** Allowing `'unsafe-inline'` for scripts significantly weakens CSP protection against XSS. While this may be needed for Stripe or inline Next.js scripts, it undermines the core benefit of CSP.

**Recommendation:** Use nonces or hashes instead of `'unsafe-inline'`. For Stripe, the required CSP directive is `https://js.stripe.com` which is already present; `'unsafe-inline'` may not be needed for Stripe specifically. Investigate whether Next.js can be configured to use nonces via the `csp` config option.

### 11. User Registration Reveals Email/Username Existence

**Location:** `backend/src/modules/auth/auth.service.ts:54-59`
**Severity:** :yellow_circle: Medium

```typescript
if (existingUser) {
  if (existingUser.username === username) {
    throw new ConflictException("Username already taken");
  }
  throw new ConflictException("Email already registered");
}
```

**Problem:** Distinct error messages reveal whether a specific email or username is already registered. This enables account enumeration attacks. Contrast this with the password reset endpoint (`auth.service.ts:345`) which correctly returns success regardless of whether the email exists.

**Recommendation:** Return a generic error message: `"Registration failed. An account with this email or username may already exist."` This prevents enumeration while still informing the user of the general issue.

### 12. Elasticsearch Connection Error Leaks Configuration

**Location:** `backend/src/modules/search/search.service.ts:113-118`
**Severity:** :yellow_circle: Medium

```typescript
this.logger.error(
  `Failed to connect to Elasticsearch: ${error.message}. Search will fall back to database queries. ` +
    `Ensure Elasticsearch is running at ${this.configService.get("elasticsearch.node", "http://localhost:9200")}.`,
);
```

**Problem:** The error message includes the Elasticsearch connection URL, which could include credentials if embedded in the URL. Even if credentials aren't embedded, internal infrastructure addresses should not be logged in production.

**Recommendation:** In production, log a generic message without the connection URL. Include the URL only in development mode.

### 13. Stripe API Version is Outdated

**Location:** `backend/src/modules/payments/payments.service.ts:31`
**Severity:** :yellow_circle: Medium

```typescript
this.stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16",
});
```

**Problem:** The Stripe API version `2023-10-16` is over two years old. While pinning API versions is good practice for stability, staying this far behind means missing security patches and new features.

**Recommendation:** Review the Stripe changelog and upgrade to a more recent API version. Test payment flows thoroughly after upgrading.

### 14. Body Parser Size Limits May Be Too Generous

**Location:** `backend/src/main.ts:15-17`
**Severity:** :yellow_circle: Medium

```typescript
const JSON_LIMIT = "10mb";
const URL_ENCODED_LIMIT = "10mb";
const RAW_LIMIT = "10mb";
```

**Problem:** 10MB is generous for JSON request bodies on an interactive fiction platform. Most API endpoints process text content, DTOs, and metadata that should be well under 1MB. Large limits increase vulnerability to DoS attacks via oversized payloads, even with rate limiting in place.

**Recommendation:** Reduce the default JSON limit to `1mb` or `2mb`. Apply higher limits only to specific routes that need them (e.g., file upload endpoints) using route-specific middleware.

### 15. Missing `@IsUUID()` Validation in Multiple Locations

**Location:** Throughout DTOs
**Severity:** :yellow_circle: Medium

Several endpoints accept `userId`, `storyId`, and other IDs as path parameters or body fields without UUID format validation. Invalid UUIDs will cause TypeORM query failures with potentially verbose error messages.

**Recommendation:** Add `@IsUUID()` validation to all ID parameters in DTOs. Use `ParseUUIDPipe` for path parameters in controllers.

### 16. Bulk Operations Have No Size Limit

**Location:** `backend/src/modules/moderation/moderation.service.ts:1023-1088`
**Severity:** :yellow_circle: Medium

```typescript
async bulkResolveReports(
  reportIds: string[], // No max length validation
  moderatorId: string,
  action: ModerationAction,
  notes?: string,
): Promise<{ resolved: number; failed: string[] }>
```

**Problem:** `bulkResolveReports`, `bulkAssignReports`, and `bulkIssueWarnings` accept unbounded arrays. A moderator (or compromised moderator account) could submit thousands of IDs, causing sequential database operations that block the event loop.

**Recommendation:** Add `@ArrayMaxSize(100)` validation in the DTO, and process items in batches if needed.

### 17. N+1 Query in Threaded Comments

**Location:** `backend/src/modules/comments/comments.service.ts:203-217`
**Severity:** :yellow_circle: Medium

```typescript
const commentsWithReplies = await Promise.all(
  rootComments.map(async (comment) => {
    const replies = await this.commentRepository.find({
      where: { parentCommentId: comment.id, isDeleted: false },
      relations: ["user"],
      order: { createdAt: "ASC" },
      take: 3,
    });
    // ... N queries executed for N root comments
  }),
);
```

**Problem:** For every root comment on a page, a separate query fetches its replies. With 20 root comments, this creates 21 queries. This pattern appears on every story page with comments.

**Recommendation:** Use a single query with `WHERE parentCommentId IN (:...rootIds)` then group results in memory, or use a LEFT JOIN in the initial query.

### 18. Missing Composite Database Indexes

**Location:** Multiple entity files
**Severity:** :yellow_circle: Medium

Common query patterns lack covering indexes:
- **Comments:** `WHERE storyId = ? AND isDeleted = FALSE ORDER BY createdAt` needs `@Index(["storyId", "isDeleted", "createdAt"])`
- **Stories:** `WHERE status = 'PUBLISHED' AND category = ? ORDER BY viewCount DESC` needs `@Index(["status", "category", "viewCount"])`
- **Reader Progress:** `WHERE userId = ? ORDER BY lastReadAt DESC` needs `@Index(["userId", "lastReadAt"])`

**Recommendation:** Add composite indexes matching the most common query patterns. These will provide significant improvement on tables that grow large.

### 19. Cache Module Created But Not Used by Services

**Location:** `backend/src/common/cache/cache.module.ts` + all services
**Severity:** :yellow_circle: Medium

**Problem:** The Redis-backed CacheModule is properly configured and globally available, but no service actually uses `@Cacheable()` decorators or injects the cache manager to cache query results. Frequently accessed data like featured stories, popular tags, and user stats are re-queried on every request.

**Recommendation:** Add caching to high-traffic, low-mutation endpoints:
- Featured stories: 10-minute TTL
- Tag listings: 1-hour TTL
- Story metadata for read endpoints: 5-minute TTL

### 20. Elasticsearch Uses `refresh: true` on Every Index Operation

**Location:** `backend/src/modules/search/search.service.ts:525,579,709`
**Severity:** :yellow_circle: Medium

```typescript
await this.client.index({
  index: STORIES_INDEX,
  id: story.id,
  body: doc,
  refresh: true, // Forces immediate shard refresh
});
```

**Problem:** `refresh: true` forces Elasticsearch to refresh the index shard on every write. This is expensive and unnecessary for most operations. Elasticsearch's default 1-second refresh interval is sufficient for near-real-time search.

**Recommendation:** Use `refresh: false` (or omit) for normal writes. Reserve `refresh: true` for test environments only. For bulk reindexing, use `refresh: "wait_for"` at the end of the batch.

### 21. Segment Cycle Detection Has No Depth Limit

**Location:** `backend/src/modules/segments/segments.service.ts:512-541`
**Severity:** :yellow_circle: Medium

```typescript
private async wouldCreateCycle(
  fromId: string,
  toId: string,
  visited: Set<string> = new Set(),
): Promise<boolean> {
  // ... recursive with one DB query per node
```

**Problem:** The cycle detection algorithm has no maximum depth limit and makes one database query per graph node visited. A story with deep branching (10+ levels) generates 10+ sequential queries. Pathological graphs could cause stack overflow or timeouts.

**Recommendation:** Add `if (visited.size > 100) return false;` as a safety limit. For better performance, batch-fetch all segments for the story once and traverse in memory.

### 22. TipTap Editor Not Code-Split on Frontend

**Location:** `frontend/package.json` (13 TipTap packages)
**Severity:** :yellow_circle: Medium

**Problem:** The TipTap rich text editor (13 packages, ~300KB+ JS) is loaded as a core dependency but only used on 2-3 editing routes. Every page load pays the bundle size cost.

**Recommendation:** Use Next.js dynamic imports with `ssr: false`:
```typescript
const RichTextEditor = dynamic(() => import('@/components/editor/rich-text-editor'), {
  loading: () => <EditorSkeleton />,
  ssr: false,
});
```

---

## Low-Severity Findings

### 23. Inconsistent Pagination Response Formats

**Location:** Throughout backend services
**Severity:** :green_circle: Low

Different services return pagination metadata in inconsistent formats:
- `StoriesService.findAll()` returns `{ items, total, page, limit }`
- `CommentsService.findAll()` returns `{ data, meta: { page, limit, total, totalPages } }`
- `ModerationService.getReportQueue()` returns `{ reports, total, page, limit, totalPages }`
- `SearchService.searchStories()` returns `{ data, meta: { page, limit, total, totalPages } }`

**Recommendation:** Standardize on a single pagination response format across all endpoints. The `{ data, meta }` pattern from the search/comments services is the most conventional.

### 24. Frontend API Client Lacks Error Type Discrimination

**Location:** `frontend/src/lib/api.ts:62-68`
**Severity:** :green_circle: Low

```typescript
if (!response.ok) {
  const error = await response.json().catch(() => ({ message: 'Request failed' }));
  throw new Error(error.message || `HTTP error ${response.status}`);
}
```

**Problem:** All API errors are converted to generic `Error` objects, losing the structured error response from the backend (`code`, `details`, `status`). This makes it difficult for the frontend to handle different error types (validation errors vs auth errors vs server errors).

**Recommendation:** Create a custom `ApiError` class:
```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) { super(message); }
}
```

### 25. `TransformInterceptor` Applied Globally Without Exclusion

**Location:** `backend/src/main.ts:136-139`
**Severity:** :green_circle: Low

The `TransformInterceptor` and `LoggingInterceptor` are applied globally. Depending on their implementation, this could interfere with streaming responses, file downloads, or WebSocket upgrades. Consider applying these selectively or ensuring they handle non-JSON responses gracefully.

### 26. Database Query Cache Uses Database-Backed Storage

**Location:** `backend/src/config/database.config.ts:53-57`
**Severity:** :green_circle: Low

```typescript
cache: {
  type: "database",
  tableName: "query_result_cache",
  duration: 30000,
},
```

**Problem:** With Redis already available, using database-backed query caching adds unnecessary database load. Every cached query result is stored in and retrieved from the same database being queried.

**Recommendation:** Switch to Redis-based TypeORM caching:
```typescript
cache: {
  type: "ioredis",
  options: { host: redisHost, port: redisPort },
  duration: 30000,
}
```

---

## Positive Observations

1. **Excellent financial transaction handling** — The `CreditsService` uses pessimistic write locks (`lock: { mode: "pessimistic_write" }`) within database transactions for all balance-modifying operations. This correctly prevents double-spending and race conditions on credit operations.

2. **Strong authentication security** — Account lockout after 5 failed attempts, password change invalidation of existing tokens via `passwordChangedAt` checking in the JWT strategy, token blacklisting on logout, and rate limiting on auth endpoints are all well-implemented.

3. **Good HTML sanitization** — Both `SegmentsService` and `CommentsService` use `sanitize-html` with explicit allowlists for tags and attributes, transform links to add `rel="noopener noreferrer"` and `target="_blank"`, and restrict URL schemes to `http`, `https`, and `mailto`.

4. **Upload security** — The `UploadService` validates magic bytes for images (JPEG, PNG, GIF, WebP, AVIF), checks dangerous file extensions, enforces MIME type allowlists, and applies per-category size limits.

5. **Graceful degradation** — The search service falls back to PostgreSQL `ILIKE` queries when Elasticsearch is unavailable. Payment services gracefully disable in development when Stripe/Razorpay are unconfigured.

6. **Secret management** — The `requireSecret()` function in `configuration.ts` throws in production if `JWT_SECRET`/`JWT_REFRESH_SECRET` are missing and generates ephemeral random secrets in development, preventing use of hardcoded defaults.

7. **SQL injection prevention** — Query builder usage with parameterized queries is consistent. The `getSortColumn()` method in `StoriesService` uses a whitelist to prevent sort column injection.

8. **Proper CORS configuration** — Explicit origin whitelist in both production and development, with credentials enabled and specific allowed methods/headers.

9. **Comprehensive moderation system** — Reports, warnings, bans, mutes, appeals, shadow bans, auto-ban (3 strikes), and priority scoring are all well-modeled with proper audit trails via `ModerationLog`.

10. **Consistent authorization patterns** — Ownership checks in services follow a clear pattern: owner can edit their own content, moderators/admins have elevated permissions, with proper `ForbiddenException` responses.

---

## Action Items

### Must-Fix (Critical/High)
- [ ] Remove or rethink `enableImplicitConversion: true` in the global `ValidationPipe`
- [ ] Add pagination limit caps in `SearchService.searchStories()` and `SearchService.searchUsers()`
- [ ] Invalidate old refresh tokens on rotation (store in Redis or DB)
- [ ] Fix the N+1 query in `SearchService.advancedSearch()` for tag loading
- [ ] Implement the WebSocket module or remove it from `app.module.ts`
- [ ] Add batched processing for `reindexAllStories()` and `reindexAllTags()`
- [ ] Add transaction wrapping for comment creation + counter updates

### Should-Fix (Medium)
- [ ] Fix the `previousVersionId` self-reference in segment updates
- [ ] Replace `'unsafe-inline'` in CSP scriptSrc with nonces
- [ ] Use generic registration error messages to prevent account enumeration
- [ ] Redact Elasticsearch URL from production error logs
- [ ] Upgrade Stripe API version from `2023-10-16`
- [ ] Reduce default body parser JSON limit from `10mb` to `1-2mb`
- [ ] Add `@IsUUID()` validation to all ID fields in DTOs
- [ ] Add `@ArrayMaxSize()` to bulk operation DTOs
- [ ] Fix slug generation race condition with retry-on-conflict pattern
- [ ] Fix N+1 in threaded comments (fetch replies in single batch query)
- [ ] Add composite indexes on Comment, Story, and ReaderProgress entities
- [ ] Implement caching on high-traffic read endpoints (featured stories, tags)
- [ ] Remove `refresh: true` from Elasticsearch index operations
- [ ] Add depth limit to segment cycle detection algorithm
- [ ] Code-split TipTap editor with dynamic imports

### Nice-to-Have (Low)
- [ ] Standardize pagination response format across all services
- [ ] Create a custom `ApiError` class in the frontend API client
- [ ] Switch TypeORM query cache from database-backed to Redis-backed
- [ ] Review global interceptor behavior with non-JSON responses
- [ ] Optimize Radix UI package imports in Next.js config

---

## Questions & Clarifications

1. **Email verification bypass** — `auth.service.ts:71-72` sets `emailVerified: true` and `accountStatus: ACTIVE` for all registrations with a "For MVP" comment. Is there a plan to enforce email verification before launch?

2. **Soft delete strategy** — Comments use soft delete (`isDeleted` flag) while stories use hard delete (`repository.remove()`). Is this intentional? Hard-deleting stories cascades to segments, choices, and reader progress, which may not be recoverable.

3. **NSFW content gating** — The `nsfwFlag` field exists on stories and the `FEATURE_NSFW_CONTENT` flag exists in configuration, but there's no visible enforcement in the story query endpoints to filter NSFW content by default.

4. **Two-factor authentication** — The `twoFactorEnabled` and `twoFactorSecret` fields exist on the User entity, but there's no TOTP implementation visible. Is this planned?

5. **Collaborative editing conflicts** — The segment versioning (`version` field + `previousVersionId`) suggests planned concurrent editing support, but there's no conflict resolution or optimistic locking. What's the intended behavior when two users edit the same segment simultaneously?
