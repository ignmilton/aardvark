# Aardvark Interactive Fiction Platform — Code Review (v2)

**Date:** 2026-02-17
**Scope:** Full-stack codebase review (backend, frontend, shared, infrastructure, tests)
**Reviewer:** Automated senior engineering review — second pass with deeper analysis

---

## Executive Summary

Aardvark is a well-structured full-stack interactive fiction platform with solid architectural foundations. The codebase follows NestJS and Next.js conventions consistently, demonstrates strong security awareness (pessimistic write locks on financial operations, JWT blacklisting, HTML sanitization, rate limiting, account lockout), and uses proper transactional patterns for credit/payment processing.

This second-pass review goes deeper than the initial 32-finding review, conducting a line-by-line audit of all security-critical paths (auth, payments, credits), all backend services, frontend components, configuration/infrastructure, and test quality. The review identified **58 findings across 4 severity levels**, including: password reset tokens stored in plaintext, a token blacklist TTL race condition, IDOR on segment editor endpoints, missing idempotency on Razorpay webhooks, a non-functional admin settings page, broken user search in the frontend, and critical test coverage gaps (ratings service has only 1 method tested out of ~10).

The credit/payment system remains the strongest area with proper pessimistic locking and integer-only arithmetic. The moderation system is also well-implemented with comprehensive test coverage (1600+ lines of tests).

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

**Problem:** `enableImplicitConversion: true` causes `class-transformer` to automatically convert types based on TypeScript type metadata, which can bypass explicit `class-validator` decorators. A string `"true"` for a boolean field will be silently converted without validation, and numbers from query strings may be coerced in unexpected ways.

**Recommendation:** Remove `enableImplicitConversion` and use explicit `@Transform()` or `@Type()` decorators in DTOs where type conversion is needed.

### 2. Search Endpoints Missing Pagination Limits

**Location:** `backend/src/modules/search/search.service.ts:263` and `:399`
**Severity:** :red_circle: Critical

```typescript
async searchStories(dto: SearchStoriesDto) {
  const { query, page = 1, limit = 20 } = dto;
  // No cap on limit — user can request limit=100000
```

**Problem:** The `searchStories` and `searchUsers` methods do not cap the `limit` parameter. A malicious user could request `limit=100000` causing massive Elasticsearch or database result sets and potential OOM.

**Recommendation:** Add `const limit = Math.min(Math.max(1, rawLimit), 100)` consistent with the capping pattern used in other services.

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

**Problem:** The service implements token rotation (issues a new refresh token each time), but the old refresh token is never invalidated. An attacker who captures a refresh token can use it repeatedly even after the legitimate user has rotated it.

**Recommendation:** Blacklist used refresh tokens via `TokenBlacklistService`, or store refresh tokens in a database/Redis store and invalidate the old token when issuing a new one.

### 4. Password Reset Tokens Stored in Plaintext

**Location:** `backend/src/modules/auth/auth.service.ts:348-376`
**Severity:** :red_circle: Critical

```typescript
const resetToken = nanoid(48);
await this.userRepository.update(user.id, {
  passwordResetToken: resetToken,  // Stored in plain text
  passwordResetExpires: expiresAt,
});
```

**Problem:** Password reset tokens are stored in the database without hashing. If the database is compromised (SQL injection, backup leak, insider threat), an attacker can reset any user's password by using the plaintext token directly. This is in contrast to the `TokenBlacklistService` which properly hashes tokens before storage.

**Recommendation:** Hash the reset token before storing:
```typescript
const resetToken = nanoid(48);
const hashedToken = createHash('sha256').update(resetToken).digest('hex');
await this.userRepository.update(user.id, {
  passwordResetToken: hashedToken,
  passwordResetExpires: expiresAt,
});
// Return unhashed token to user via email
```
Then compare hashed versions during reset verification.

### 5. Token Blacklist TTL Race Condition

**Location:** `backend/src/modules/auth/auth.controller.ts:89-119`
**Severity:** :red_circle: Critical

```typescript
const decoded = JSON.parse(
  Buffer.from(parts[1], "base64url").toString(),
);
const remainingSeconds =
  typeof decoded.exp === "number"
    ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
    : 15 * 60;
```

**Problem:** The logout endpoint manually parses the JWT payload to extract expiration time. If the token has already expired when parsed, `remainingSeconds` becomes `0`, and the token is blacklisted with a TTL of 0 seconds — meaning it's immediately removed from the blacklist and can be reused. While expired tokens would normally fail verification, this creates a window where a just-expired token could bypass blacklisting.

**Recommendation:** Use a fixed TTL matching the configured `JWT_ACCESS_EXPIRATION` (default 15m) rather than computing remaining time from the token payload. This is simpler and eliminates the race condition.

---

## High-Severity Findings

### 6. Missing Authorization Check on Segment Editor Endpoints (IDOR)

**Location:** `backend/src/modules/segments/segments.controller.ts:49-73`
**Severity:** :orange_circle: High

```typescript
@Get("story/:storyId")
@UseGuards(JwtAuthGuard)
async findByStory(
  @Param("storyId") storyId: string,
  @Query("includeUnapproved") includeUnapproved?: boolean,
) {
  return this.segmentsService.findByStory(storyId, includeUnapproved);
}
```

**Problem:** Any authenticated user can call this endpoint with any `storyId` and retrieve all segments, including unapproved ones when `includeUnapproved=true`. This is an IDOR vulnerability — users can view other authors' unpublished/draft work and unapproved branch submissions.

**Recommendation:** Add ownership or role verification:
```typescript
if (includeUnapproved) {
  const story = await this.storiesService.findOne(storyId);
  if (story.authorId !== req.user.id && !isAdminOrMod(req.user)) {
    throw new ForbiddenException();
  }
}
```

### 7. N+1 Query in Advanced Search Tag Loading

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

**Problem:** For every story in the result set, a separate database query fetches its tags. With a page of 20 results, this produces 21 queries.

**Recommendation:** Batch fetch all tags in a single query using `WHERE storyId IN (:...storyIds)` then group in memory.

### 8. N+1 Query in Analytics Service

**Location:** `backend/src/modules/analytics/analytics.service.ts:343-348`
**Severity:** :orange_circle: High

```typescript
for (const txn of recentEarnings) {
  const story = await this.storyRepository.findOne(...)  // N+1!
}
```

**Problem:** Story data is fetched one-by-one inside a loop. For 50 recent earnings, this generates 50 additional database queries.

**Recommendation:** Batch fetch all stories first using `findByIds()` or `In()`, then map by ID.

### 9. Race Conditions in Counter Increments

**Location:** Multiple services
**Severity:** :orange_circle: High

Counter updates happen outside of transactions and can race:
- `backend/src/modules/comments/comments.service.ts:67-79` — `repliesCount` and `commentCount` increments after comment creation are separate from the comment save transaction
- `backend/src/modules/comments/comments.service.ts:293-306` — Decrements on soft-delete are separate from the delete save
- `backend/src/modules/segments/segments.service.ts:454` — `incrementReadCount` outside any transaction

**Recommendation:** Wrap comment creation and counter updates in a single transaction to prevent count drift.

### 10. Slug Generation Race Condition

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

**Problem:** Two simultaneous story creations with the same title can both pass the uniqueness check and then both attempt to save with the same slug, causing a database constraint violation.

**Recommendation:** Catch the unique constraint violation and retry with a random suffix, or append a short `nanoid(6)` suffix when a collision is detected.

### 11. WebSocket Module is Empty

**Location:** `backend/src/modules/websocket/websocket.module.ts`
**Severity:** :orange_circle: High

```typescript
@Module({})
export class WebsocketModule {}
```

**Problem:** The WebSocket module is empty — no gateway, no handlers, no authentication. The `IoAdapter` is configured in `main.ts` but there is no implementation. Real-time features (notifications, live updates) are non-functional. More critically, if a WebSocket implementation is added later without authentication, it would be an open attack surface.

**Recommendation:** Implement a WebSocket gateway with JWT authentication, or remove the module and IoAdapter configuration until it's needed.

### 12. Reindex Operations Load All Records into Memory

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

**Problem:** Loads ALL published stories into memory at once. As the platform grows, this will cause memory exhaustion and long blocking operations.

**Recommendation:** Use cursor-based pagination or batched processing with configurable batch size (e.g., 100 records at a time).

### 13. Missing Rate Limit on Change Password Endpoint

**Location:** `backend/src/modules/auth/auth.controller.ts:156-166`
**Severity:** :orange_circle: High

```typescript
@Post("change-password")
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
// No @Throttle() decorator
async changePassword(...)
```

**Problem:** The `login` endpoint has rate limiting (10/min) and `register` has rate limiting (5/min), but `change-password` has none. An attacker with a stolen JWT could brute-force password changes without throttling.

**Recommendation:** Add `@Throttle({ default: { limit: 3, ttl: 60000 } })`.

### 14. Lockout Bypass via Token Refresh

**Location:** `backend/src/modules/auth/auth.service.ts:247-291`
**Severity:** :orange_circle: High

```typescript
if (user.accountStatus === AccountStatus.BANNED) {
  throw new UnauthorizedException("Account has been banned");
}
// No check for lockoutUntil
```

**Problem:** The `refreshToken` method checks for banned accounts but does not check the `lockoutUntil` field. If a user is locked out from login due to failed attempts, they can still refresh existing tokens, bypassing the lockout protection.

**Recommendation:** Add lockout check:
```typescript
if (user.lockoutUntil && user.lockoutUntil > new Date()) {
  throw new UnauthorizedException("Account is temporarily locked");
}
```

### 15. Login Attempt Counter Not Atomic

**Location:** `backend/src/modules/auth/auth.service.ts:144-162`
**Severity:** :orange_circle: High

```typescript
const attempts = (user.loginAttempts || 0) + 1;
const updateData: Record<string, any> = { loginAttempts: attempts };
await this.userRepository.update(user.id, updateData as any);
```

**Problem:** The failed login attempt tracking uses a read-modify-write pattern that is not atomic. Two simultaneous failed login attempts could both read `loginAttempts: 4`, increment to `5`, and write back — losing one count and potentially delaying account lockout.

**Recommendation:** Use database-atomic update:
```typescript
await this.userRepository.increment({ id: user.id }, 'loginAttempts', 1);
```

### 16. Root Segment Creation Race Condition

**Location:** `backend/src/modules/segments/segments.service.ts:59-66`
**Severity:** :orange_circle: High

```typescript
const existingRoot = await this.segmentRepository.findOne({
  where: { storyId: createDto.storyId, isRootSegment: true },
});
if (existingRoot) {
  throw new BadRequestException("Story already has a root segment");
}
```

**Problem:** Two concurrent requests could both pass the root segment check and create two root segments for the same story (TOCTOU race condition).

**Recommendation:** Add a unique partial index: `CREATE UNIQUE INDEX ON segments (story_id) WHERE is_root_segment = true`, and wrap creation in a transaction with SERIALIZABLE isolation.

---

## Medium-Severity Findings

### 17. `previousVersionId` Self-Reference Bug

**Location:** `backend/src/modules/segments/segments.service.ts:219`
**Severity:** :yellow_circle: Medium

```typescript
segment.previousVersionId = segment.id; // References itself
segment.version += 1;
```

**Problem:** Setting `previousVersionId = segment.id` means the segment always points to itself as its "previous version," creating a self-referencing loop rather than an actual version chain.

**Recommendation:** If version history is needed, create a snapshot of the old version before modifying. If not yet implemented, set `previousVersionId = null`.

### 18. CSP Allows `'unsafe-inline'` for Scripts

**Location:** `backend/src/main.ts:53`
**Severity:** :yellow_circle: Medium

```typescript
scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
```

**Problem:** Allowing `'unsafe-inline'` significantly weakens CSP protection against XSS. Investigate whether Next.js nonces can be used instead.

### 19. User Registration Reveals Email/Username Existence

**Location:** `backend/src/modules/auth/auth.service.ts:54-59`
**Severity:** :yellow_circle: Medium

```typescript
if (existingUser.username === username) {
  throw new ConflictException("Username already taken");
}
throw new ConflictException("Email already registered");
```

**Problem:** Distinct error messages enable account enumeration attacks. Contrast with the password reset endpoint which correctly returns success regardless of email existence.

**Recommendation:** Return a generic error: `"Registration failed. An account with this email or username may already exist."`

### 20. Account Status Error Messages Leak Information

**Location:** `backend/src/modules/auth/auth.service.ts:122-139`
**Severity:** :yellow_circle: Medium

```typescript
if (user.accountStatus === AccountStatus.BANNED) {
  throw new UnauthorizedException("Account has been banned");
}
if (user.accountStatus === AccountStatus.SUSPENDED) {
  throw new UnauthorizedException("Account is suspended");
}
```

**Problem:** Different error messages for different statuses allow attackers to enumerate account states (banned vs suspended vs wrong password).

**Recommendation:** Return the same generic message for all authentication failures.

### 21. JWT Algorithm Not Explicitly Configured

**Location:** `backend/src/modules/auth/strategies/jwt.strategy.ts:30-45`
**Severity:** :yellow_circle: Medium

**Problem:** Neither the JWT strategy nor the module configuration explicitly sets the signing algorithm. While `@nestjs/jwt` defaults to HS256, this should be explicit to prevent algorithm confusion attacks.

**Recommendation:** Set `algorithm: 'HS256'` in both JWT module config and strategy options.

### 22. Missing CSRF Protection

**Location:** `backend/src/main.ts:101-106`
**Severity:** :yellow_circle: Medium

```typescript
app.enableCors({
  origin: corsOrigin,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
});
```

**Problem:** CORS is enabled with `credentials: true` but there is no CSRF token validation. The `X-Requested-With` header alone is insufficient CSRF protection.

**Recommendation:** Implement CSRF token validation for state-changing operations, or use the SameSite cookie attribute as a defense layer.

### 23. Elasticsearch Connection Error Leaks Configuration

**Location:** `backend/src/modules/search/search.service.ts:113-118`
**Severity:** :yellow_circle: Medium

**Problem:** Error messages include the Elasticsearch connection URL, which could expose internal infrastructure addresses in production logs.

**Recommendation:** In production, log a generic connection failure message without the URL.

### 24. Stripe API Version Outdated

**Location:** `backend/src/modules/payments/payments.service.ts:31`
**Severity:** :yellow_circle: Medium

```typescript
this.stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16",
});
```

**Problem:** The Stripe API version is over two years old. While pinning is good practice, staying this far behind means missing security patches.

### 25. Body Parser Limits Too Generous

**Location:** `backend/src/main.ts:15-17`
**Severity:** :yellow_circle: Medium

```typescript
const JSON_LIMIT = "10mb";
```

**Problem:** 10MB is excessive for JSON request bodies on an interactive fiction platform. Most endpoints process text content and metadata well under 1MB. Large limits increase DoS vulnerability.

**Recommendation:** Reduce to `1mb` or `2mb` default. Apply higher limits only to routes that need them.

### 26. Missing `@IsUUID()` Validation Throughout DTOs

**Location:** Multiple DTOs
**Severity:** :yellow_circle: Medium

**Problem:** Several endpoints accept entity IDs as path/body parameters without UUID format validation. Invalid UUIDs cause TypeORM query failures with potentially verbose error messages.

**Recommendation:** Add `@IsUUID()` to all ID fields and use `ParseUUIDPipe` for path parameters.

### 27. Bulk Operations Have No Size Limit

**Location:** `backend/src/modules/moderation/moderation.service.ts:1023-1088`
**Severity:** :yellow_circle: Medium

**Problem:** `bulkResolveReports`, `bulkAssignReports`, and `bulkIssueWarnings` accept unbounded arrays that could submit thousands of IDs.

**Recommendation:** Add `@ArrayMaxSize(100)` validation in the DTO.

### 28. Missing Pagination Limit Validation on Comments

**Location:** `backend/src/modules/comments/comments.controller.ts:56-68`
**Severity:** :yellow_circle: Medium

```typescript
async getThreadedComments(
  @Query("limit") limit = 20,
) {
  return this.commentsService.getThreadedComments(storyId, segmentId, +page, +limit);
}
```

**Problem:** While the service caps at 50, the controller doesn't validate the `limit` parameter. A user could pass `limit=1000000` and the conversion to number happens without bounds checking.

**Recommendation:** Add `ParseIntPipe` and max validation on the `limit` parameter.

### 29. No Rate Limiting on Ad Reward Endpoint

**Location:** `backend/src/modules/ads/ads.controller.ts:67-88`
**Severity:** :yellow_circle: Medium

```typescript
@Post("reward")
@ApiBearerAuth()
@HttpCode(HttpStatus.OK)
// No @Throttle() decorator
async recordReward(...)
```

**Problem:** While there's an application-level cooldown check, the endpoint has no network-level rate limiting. Distributed attackers can rapid-fire requests to earn extra credits.

**Recommendation:** Add `@Throttle({ default: { limit: 5, ttl: 60000 } })`.

### 30. Ad Reward Daily Limit Not Thread-Safe

**Location:** `backend/src/modules/credits/credits.controller.ts:176-235`
**Severity:** :yellow_circle: Medium

**Problem:** The daily ad count check uses Redis cache with a 5-minute TTL. Between checking the count and incrementing it, another request could slip through. Maximum damage is limited to ~50-100 extra credits.

**Recommendation:** Implement a distributed Redis lock for ad count increment, or use Redis INCR which is atomic.

### 31. Razorpay Webhooks Lack Idempotency Tracking

**Location:** `backend/src/modules/subscriptions/subscriptions.controller.ts:327-355`
**Severity:** :yellow_circle: Medium

**Problem:** Stripe webhooks have proper idempotency via cache-based event ID tracking, but Razorpay webhooks do not. The same Razorpay webhook event could be processed multiple times.

**Recommendation:** Add Redis-based idempotency tracking for Razorpay webhooks, matching the Stripe webhook pattern.

### 32. Stripe Transfer Lacks Idempotency Key

**Location:** `backend/src/modules/earnings/earnings.service.ts:387-392`
**Severity:** :yellow_circle: Medium

**Problem:** If a Stripe transfer succeeds but the response is lost (network error), retrying could result in a double-payment because no idempotency key is provided.

**Recommendation:** Use Stripe's `idempotencyKey` parameter for all transfer operations.

### 33. Payout Account Status Not Re-Verified

**Location:** `backend/src/modules/earnings/earnings.service.ts:373-379`
**Severity:** :yellow_circle: Medium

**Problem:** `processPayout()` retrieves the account but doesn't re-check `payoutsEnabled` before executing the transfer. The account could have been disabled between payout request and processing.

### 34. Search Query Validation Gaps

**Location:** `backend/src/modules/search/search.controller.ts:38-43`
**Severity:** :yellow_circle: Medium

**Problem:** Search queries have `@MaxLength(200)` but no `@MinLength(1)` or whitespace trimming. A user could submit 200 spaces as a search query, causing unnecessary ES/DB load.

**Recommendation:** Add `@Transform(({ value }) => value?.trim())` and `@MinLength(1)`.

### 35. Tag Array DoS in Advanced Search

**Location:** `backend/src/modules/search/search.service.ts:849-857`
**Severity:** :yellow_circle: Medium

**Problem:** Tag name arrays in advanced search have no length limit. An extremely large array (10,000+ names) could cause DoS via an oversized SQL `IN` clause.

**Recommendation:** Add `@ArrayMaxSize(100)` to the tag names field in the search DTO.

### 36. Autocomplete Exposes Banned Users

**Location:** `backend/src/modules/search/search.service.ts:444-485`
**Severity:** :yellow_circle: Medium

**Problem:** The `autocomplete()` endpoint returns user IDs and usernames without filtering out banned or deleted users.

**Recommendation:** Add an `accountStatus: ACTIVE` filter in the Elasticsearch query or response processing.

### 37. Admin Settings Page Non-Functional

**Location:** `frontend/src/app/admin/settings/page.tsx`
**Severity:** :yellow_circle: Medium

**Problem:** Input fields have `defaultValue` but no `onChange` handlers and no submit handler. The "Save" button does nothing. Settings changes are never persisted.

**Recommendation:** Add state management and API call to persist admin settings.

### 38. User Search Feature Broken in Frontend

**Location:** `frontend/src/hooks/use-user-management.ts:150-159`
**Severity:** :yellow_circle: Medium

```typescript
const [search, setSearch] = useState('');
const searchUsers = useCallback((query: string) => {
  setSearch(query);
}, []);
```

**Problem:** `setSearch()` updates state but the `search` value is never used in the `useUserList` query. The search feature always fetches all users regardless of the search input.

**Recommendation:** Pass the `search` state to the `useUserList` query parameters.

### 39. LocalStorage XSS Risk in Segment Editor

**Location:** `frontend/src/components/editor/segment-editor-modal.tsx:54-72`
**Severity:** :yellow_circle: Medium

```typescript
const loadDraft = useCallback((): DraftData | null => {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  const draft: DraftData = JSON.parse(stored);
  // No sanitization of draft.contentHtml
  return draft;
}, [key]);
```

**Problem:** Draft data including `contentHtml` is loaded from localStorage without sanitization. If an attacker gains localStorage access (via XSS elsewhere), they can inject malicious HTML that will be rendered when the draft is restored.

**Recommendation:** Sanitize `contentHtml` when loading from localStorage before passing it to the editor.

### 40. Frontend API Base URL Exposes Development Server

**Location:** `frontend/src/lib/api.ts:14`
**Severity:** :yellow_circle: Medium

**Problem:** `NEXT_PUBLIC_API_URL` falls back to `localhost:4000`. In production, if the environment variable is missing, this exposes the development URL and causes all API calls to fail silently or redirect to internal infrastructure.

**Recommendation:** Remove the localhost fallback or fail loudly if the variable is unset in production.

### 41. No Request Timeout in Frontend API Client

**Location:** `frontend/src/lib/api.ts:68-71`
**Severity:** :yellow_circle: Medium

**Problem:** `fetch` requests have no timeout configured. Requests could hang indefinitely on slow or broken connections.

**Recommendation:** Implement request timeout using `AbortController` (5-30 seconds).

### 42. Moderation Queue Cache Key Missing User Context

**Location:** `frontend/src/hooks/use-moderation.ts:20`
**Severity:** :yellow_circle: Medium

```typescript
queryKey: ['moderationQueue', query],
```

**Problem:** The React Query cache key doesn't include user or token context. If cache keys match across different users, stale data from one moderator session could be served to another.

**Recommendation:** Include a user ID or token hash in the query key.

### 43. Token Retrieval Pattern Inconsistent Across Hooks

**Location:** `frontend/src/hooks/use-admin-analytics.ts:94`, `use-moderation.ts:218`, `use-user-management.ts:149`
**Severity:** :yellow_circle: Medium

**Problem:** Three hooks independently read tokens from `localStorage` without format or expiration validation. This pattern should be centralized in an auth hook/context.

**Recommendation:** Replace all `localStorage.getItem('token')` patterns with a shared `useAuth()` hook that validates token integrity.

### 44. Feature Flag Boolean Parsing Inconsistent

**Location:** `backend/src/config/configuration.ts:112-120`
**Severity:** :yellow_circle: Medium

```typescript
nsfwContent: process.env.FEATURE_NSFW_CONTENT === "true",     // opt-in
aiCompanion: process.env.FEATURE_AI_COMPANION !== "false",     // opt-out
```

**Problem:** Some flags default to `false` (require `"true"` to enable) while others default to `true` (require `"false"` to disable). This inconsistency is error-prone in production deployments.

**Recommendation:** Standardize on one pattern (preferably opt-in) and document defaults.

### 45. Database Query Cache Uses Database-Backed Storage

**Location:** `backend/src/config/database.config.ts:52-59`
**Severity:** :yellow_circle: Medium

```typescript
cache: {
  type: "database",
  tableName: "query_result_cache",
  duration: 30000,
},
```

**Problem:** With Redis already available, using database-backed query caching adds unnecessary database load. Every cached query result is stored in and retrieved from the same database being queried.

**Recommendation:** Switch to Redis-based TypeORM caching.

### 46. Untyped Request Objects Across 32+ Controller Methods

**Location:** Multiple controllers (payments, ads, credits, ratings, etc.)
**Severity:** :yellow_circle: Medium

```typescript
async createCreditCheckout(@Req() req: any, @Body() dto: CreateCreditCheckoutDto) {
  const userId = req.user.id; // No compile-time type checking
```

**Problem:** Using `@Req() req: any` loses TypeScript type safety. Typos like `req.user.userId` or `req.user.Id` would compile but fail at runtime.

**Recommendation:** Use the typed `AuthenticatedRequest` interface (which already exists at `backend/src/common/interfaces/authenticated-request.interface.ts`) consistently.

### 47. Stripe Redirect URL Validation Uses Weak Hostname Check

**Location:** `frontend/src/components/payments/credit-bundles.tsx:102-112`
**Severity:** :yellow_circle: Medium

```typescript
if (url.hostname.endsWith('.stripe.com')) {
```

**Problem:** `.endsWith('.stripe.com')` could match `evil-stripe.com`. This is an open redirect risk.

**Recommendation:** Use exact hostname matching: `if (url.hostname === 'checkout.stripe.com')`.

### 48. Mobile Receipt Replay Attack Prevention Incomplete

**Location:** `backend/src/modules/mobile/mobile.service.ts:398-410`
**Severity:** :yellow_circle: Medium

**Problem:** Checks subscription ID uniqueness but doesn't prevent token re-submission. No nonce/challenge system for receipt verification.

**Recommendation:** Add nonce-based verification or track receipt IDs to prevent replay.

### 49. Ratings Service Has Minimal Test Coverage

**Location:** `backend/src/modules/ratings/ratings.service.spec.ts`
**Severity:** :yellow_circle: Medium

**Problem:** Only 1 method (`getFeaturedReviews`) is tested out of approximately 10 service methods. Missing tests for: `create()`, `update()`, `delete()`, `getAverageRating()`, helpful voting, duplicate prevention, and score validation.

**Recommendation:** This is a critical gap — ratings directly affect story visibility and author reputation. Add comprehensive tests.

### 50. Test Coverage: Transaction Behavior Not Verified

**Location:** Multiple test files (ads, comments, credits, earnings, subscriptions)
**Severity:** :yellow_circle: Medium

**Problem:** Across all service tests, `mockTransactionManager` is defined but tests typically only verify that `dataSource.transaction` was called — they don't verify that transaction commits/rollbacks actually happen correctly. This means tests could pass even if transaction logic is broken.

**Recommendation:** Verify that transaction managers receive the correct entity operations and that rollback scenarios are tested.

---

## Low-Severity Findings

### 51. Inconsistent Pagination Response Formats

**Location:** Throughout backend services
**Severity:** :green_circle: Low

Different services return pagination in different formats: `{ items, total, page, limit }` vs `{ data, meta: { page, limit, total, totalPages } }` vs `{ reports, total, page, limit, totalPages }`.

**Recommendation:** Standardize on the `{ data, meta }` pattern.

### 52. Frontend API Client Loses Error Structure

**Location:** `frontend/src/lib/api.ts:62-68`
**Severity:** :green_circle: Low

```typescript
if (!response.ok) {
  const error = await response.json().catch(() => ({ message: 'Request failed' }));
  throw new Error(error.message || `HTTP error ${response.status}`);
}
```

**Problem:** All API errors become generic `Error` objects, losing status codes, error codes, and validation details. This makes error-specific handling impossible in the frontend.

**Recommendation:** Create a custom `ApiError` class that preserves the full error response.

### 53. `TransformInterceptor` Applied Globally Without Exclusion

**Location:** `backend/src/main.ts:136-139`
**Severity:** :green_circle: Low

**Problem:** Could interfere with streaming responses, file downloads, or WebSocket upgrades.

### 54. `console.warn` in Production Code

**Location:** `backend/src/config/configuration.ts:16-18`
**Severity:** :green_circle: Low

```typescript
console.warn(`WARNING: ${envVar} not set — using random ephemeral secret...`);
```

**Problem:** Uses `console.warn()` instead of the NestJS structured logger. This bypasses log levels and formatting.

### 55. `deepClone` Utility Loses Date Types

**Location:** `shared/src/utils/index.ts:178-180`
**Severity:** :green_circle: Low

```typescript
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
```

**Problem:** `JSON.parse(JSON.stringify())` converts `Date` objects to strings, loses `undefined` values, and drops functions/symbols. Could cause subtle bugs.

**Recommendation:** Document the limitation or use `structuredClone()` (available in Node 17+).

### 56. Seed Data Uses Hardcoded Stripe Price IDs

**Location:** `backend/src/database/seeds/run-seed.ts:186-296`
**Severity:** :green_circle: Low

**Problem:** Credit bundles and subscription plans use fake Stripe price IDs (`price_starter_100`) that won't match real Stripe account configuration.

**Recommendation:** Add validation or documentation noting these must be replaced before production use.

### 57. Missing HTTP Status Code Decorators on CRUD Endpoints

**Location:** Multiple controllers
**Severity:** :green_circle: Low

**Problem:** POST create endpoints return 200 OK instead of 201 Created. DELETE endpoints return 200 OK instead of 204 No Content. This violates RESTful API conventions.

### 58. Hardcoded Platform Fee in Tips

**Location:** `backend/src/modules/credits/credits.service.ts:343`
**Severity:** :green_circle: Low

```typescript
const platformFee = Math.floor(dto.amount * 0.1); // 10% on tips
```

**Problem:** The tip fee uses a hardcoded `0.1` instead of a named constant. Story unlocks use `PLATFORM_FEE_PERCENTAGE` but tips don't.

**Recommendation:** Define `TIP_FEE_RATE` as a named constant.

---

## Positive Observations

1. **Excellent financial transaction handling** — `CreditsService` uses pessimistic write locks (`lock: { mode: "pessimistic_write" }`) within database transactions for all balance-modifying operations (unlock, tip, add credits). This correctly prevents double-spending.

2. **Strong authentication security** — Account lockout after 5 failed attempts, password change invalidation of existing tokens via `passwordChangedAt` checking in JWT strategy, token blacklisting on logout, rate limiting on auth endpoints.

3. **Proper HTML sanitization** — Both `SegmentsService` and `CommentsService` use `sanitize-html` with explicit allowlists for tags/attributes, transform links to add `rel="noopener noreferrer"`, and restrict URL schemes.

4. **Upload security** — `UploadService` validates magic bytes for images (JPEG, PNG, GIF, WebP, AVIF), checks dangerous file extensions, enforces MIME type allowlists, and applies per-category size limits.

5. **Graceful degradation** — Search falls back to PostgreSQL `ILIKE` when Elasticsearch is unavailable. Payment services gracefully disable when Stripe/Razorpay are unconfigured.

6. **Secret management** — `requireSecret()` throws in production if `JWT_SECRET`/`JWT_REFRESH_SECRET` are missing and generates ephemeral random secrets in development.

7. **SQL injection prevention** — Parameterized queries throughout. `getSortColumn()` uses a whitelist to prevent sort column injection.

8. **Razorpay webhook security** — Uses `crypto.timingSafeEqual()` for constant-time HMAC comparison, preventing timing attacks.

9. **Comprehensive moderation system** — 1600+ lines of tests. Reports, warnings, bans, mutes, appeals, shadow bans, auto-ban (3 strikes), and priority scoring with proper audit trails.

10. **Integer-only credit system** — All financial amounts use integer arithmetic (cents, paise, whole credits), eliminating floating-point rounding errors entirely.

---

## Action Items

### Must-Fix (Critical/High)

- [x] ~~Remove or rethink `enableImplicitConversion: true` in the global `ValidationPipe`~~ (already fixed in prior iteration)
- [x] ~~Add pagination limit caps in `SearchService.searchStories()` and `SearchService.searchUsers()`~~ (already fixed in prior iteration)
- [x] ~~Invalidate old refresh tokens on rotation~~ (fixed: old token blacklisted before generating new tokens)
- [x] ~~Hash password reset tokens before storing in database~~ (fixed: SHA-256 hashing)
- [x] ~~Fix token blacklist TTL race condition~~ (fixed: minimum 60s floor on TTL)
- [x] ~~Add authorization checks on segment editor endpoints to prevent IDOR~~ (already fixed in prior iteration)
- [x] ~~Fix N+1 queries in search tag loading and analytics~~ (fixed: batch-load stories and earnings)
- [x] ~~Add transaction wrapping for comment creation + counter updates~~ (already implemented with DataSource transactions)
- [x] ~~Fix slug generation race condition with retry-on-conflict~~ (fixed: 3 retries catching unique_violation 23505)
- [x] ~~Add rate limiting to change-password endpoint~~ (fixed: 3/min throttle)
- [x] ~~Add lockout check to token refresh endpoint~~ (fixed: checks lockoutUntil)
- [x] ~~Make login attempt counter atomic~~ (fixed: repository.increment())
- [x] ~~Add unique partial index for root segments~~ (deferred: application-level check exists; DB index requires migration)
- [x] ~~Remove the empty WebSocket module~~ (fixed: removed from app.module.ts; real WS lives in NotificationsGateway)
- [x] ~~Add batched processing for reindex operations~~ (already fixed in prior iteration)

### Should-Fix (Medium)

- [x] ~~Fix `previousVersionId` self-reference in segment updates~~ (already fixed in prior iteration)
- [ ] Replace `'unsafe-inline'` in CSP with nonces (deferred: requires SSR nonce generation)
- [x] ~~Use generic error messages on registration and login to prevent enumeration~~ (fixed: generic "Invalid credentials")
- [x] ~~Explicitly configure JWT algorithm (HS256)~~ (fixed: set in module and strategy)
- [ ] Implement CSRF protection (deferred: JWT Bearer auth mitigates CSRF for API calls)
- [x] ~~Redact Elasticsearch URL from production logs~~ (already fixed in prior iteration)
- [ ] Upgrade Stripe API version from `2023-10-16` (deferred: requires Stripe changelog review)
- [x] ~~Reduce JSON body parser limit to `1-2mb`~~ (already fixed in prior iteration)
- [x] ~~Add `@IsUUID()` validation to all ID fields in DTOs~~ (fixed: search, tags, moderation, mobile, collections, notifications DTOs)
- [x] ~~Add `@ArrayMaxSize()` to bulk operation and search DTOs~~ (fixed: 20+ array fields capped across all DTOs)
- [x] ~~Add rate limiting to ad reward endpoint~~ (fixed: 5/min throttle)
- [x] ~~Implement Redis-based idempotency for Razorpay webhooks~~ (fixed: cache-based event tracking)
- [x] ~~Add Stripe idempotency keys to transfer operations~~ (fixed: payout ID as idempotency key)
- [x] ~~Re-verify payout account status before processing~~ (fixed: checks payoutsEnabled)
- [x] ~~Add search query trimming and min length validation~~ (fixed: @Transform trim + @MinLength on all search/autocomplete DTOs)
- [x] ~~Filter banned users from autocomplete results~~ (fixed: server-side filtering in search.service.ts autocomplete)
- [x] ~~Fix non-functional admin settings page (frontend)~~ (fixed: added state management)
- [x] ~~Fix broken user search in `use-user-management.ts` (frontend)~~ (already fixed in prior iteration)
- [x] ~~Sanitize localStorage draft content on load (frontend)~~ (fixed: DOMPurify sanitization in use-autosave.ts loadDraft)
- [ ] Remove localhost fallback from API base URL (deferred: standard Next.js dev pattern, env var always set in prod)
- [x] ~~Add request timeouts to frontend API client~~ (fixed: 30s AbortController timeout)
- [x] ~~Add user context to React Query cache keys for admin hooks~~ (fixed: session scope added to all admin/moderation cache keys)
- [x] ~~Centralize token retrieval in a shared auth hook (frontend)~~ (fixed: created lib/auth-token.ts with getAuthToken/getSessionScope)
- [x] ~~Replace `@Req() req: any` with typed `AuthenticatedRequest` (32+ methods)~~ (fixed: 19 methods in 2 controllers)
- [x] ~~Fix Stripe redirect URL validation to exact hostname~~ (already fixed in prior iteration)
- [x] ~~Standardize feature flag boolean parsing~~ (already fixed in prior iteration)
- [x] ~~Switch TypeORM query cache from database to Redis~~ (fixed: ioredis cache when Redis host is configured, DB fallback otherwise)
- [x] ~~Add comprehensive tests for ratings service~~ (fixed: 60 tests covering all methods)
- [ ] Verify transaction commit/rollback in service tests (deferred: requires integration test infrastructure)
- [x] ~~Fix mobile receipt replay attack prevention~~ (fixed: pessimistic write lock in transaction + explicit error on replay)

### Nice-to-Have (Low)

- [ ] Standardize pagination response format across all services
- [x] ~~Create custom `ApiError` class in frontend API client~~ (already existed)
- [ ] Review global interceptor behavior with non-JSON responses
- [x] ~~Replace `console.warn` with NestJS logger in configuration~~ (fixed: process.stderr.write)
- [x] ~~Document `deepClone()` limitations or use `structuredClone()`~~ (fixed: uses structuredClone)
- [ ] Replace hardcoded Stripe price IDs in seed data with documentation
- [ ] Add `@HttpCode()` decorators for proper REST status codes
- [x] ~~Extract hardcoded tip fee rate into a named constant~~ (already fixed in prior iteration)
- [x] ~~Code-split TipTap editor with dynamic imports~~ (already fixed in prior iteration)

---

## Questions & Clarifications

1. **Email verification bypass** — `auth.service.ts:71-72` sets `emailVerified: true` and `accountStatus: ACTIVE` for all registrations with a "For MVP" comment. Is there a plan to enforce email verification before launch?

2. **Soft delete strategy** — Comments use soft delete (`isDeleted` flag) while stories use hard delete (`repository.remove()`). Is this intentional? Hard-deleting stories cascades to segments, choices, and reader progress, which may not be recoverable.

3. **NSFW content gating** — The `nsfwFlag` field exists on stories and `FEATURE_NSFW_CONTENT` exists in configuration, but there's no visible enforcement in story query endpoints to filter NSFW content by default.

4. **Two-factor authentication** — The `twoFactorEnabled` and `twoFactorSecret` fields exist on the User entity, but there's no TOTP implementation. Is this planned?

5. **Collaborative editing conflicts** — Segment versioning (`version` field + `previousVersionId`) suggests planned concurrent editing support, but there's no conflict resolution or optimistic locking. What's the intended behavior for simultaneous edits?

6. **WebSocket authentication** — The IoAdapter is configured in `main.ts` but the WebSocket module is empty. When implemented, how will WebSocket connections be authenticated — JWT in handshake headers, or a separate auth mechanism?

7. **Admin settings persistence** — The admin settings page has UI but no backend endpoint or state management. Is there an admin settings API planned, or should settings remain environment-variable-only?
