# CLAUDE.md — Aardvark Interactive Fiction Platform

## Project Overview

Aardvark is a full-stack interactive fiction platform (similar to CHYOA) built with TypeScript. It enables users to create, read, and collaborate on branching narrative stories with a credit-based monetization system.

**Tech stack:** Next.js 16 (frontend) + NestJS 11 (backend) + PostgreSQL 16 + Redis 7 + Elasticsearch 8.11

**Monorepo structure using npm workspaces:**

```
aardvark/
├── frontend/          # Next.js 16 App Router — port 3000
├── backend/           # NestJS 11 API server — port 4000
├── shared/            # Shared TypeScript types, DTOs, utilities, constants
├── docker/            # Docker Compose, Dockerfiles, nginx, monitoring
├── docs/              # Architecture and design documents
└── .github/workflows/ # CI/CD pipelines
```

## Quick Reference — Commands

```bash
# Development
npm run dev                  # Start frontend + backend concurrently
npm run dev:frontend         # Frontend only (Next.js dev, port 3000)
npm run dev:backend          # Backend only (NestJS watch, port 4000)

# Build
npm run build                # Build all workspaces
npm run build:frontend       # Next.js production build
npm run build:backend        # NestJS compilation

# Test
npm run test                 # Jest tests across all workspaces
npm run test --workspace=backend   # Backend tests only
npm run test --workspace=frontend  # Frontend tests only
npm run test:e2e             # Playwright E2E tests

# Lint & Format
npm run lint                 # ESLint across all workspaces
npm run type-check --workspace=frontend  # Frontend type check (tsc --noEmit)

# Database
npm run db:migrate           # Run TypeORM migrations
npm run db:seed              # Seed database

# Docker
npm run docker:dev           # Start dev infrastructure (Postgres, Redis, ES, MinIO, MailHog)
npm run docker:down          # Stop Docker services
```

## Architecture

### Frontend (`frontend/`)

- **Framework:** Next.js 16 with App Router (`src/app/`)
- **State:** Zustand (client state) + TanStack React Query (server state)
- **UI:** Radix UI primitives + Tailwind CSS + Framer Motion animations
- **Rich text editor:** TipTap (Medium-style WYSIWYG)
- **Visual story editor:** React Flow (node-based flowchart editor)
- **Forms:** React Hook Form + Zod validation
- **Auth:** next-auth
- **PWA:** next-pwa for offline support

Key directories:
```
frontend/src/
├── app/            # Next.js App Router pages (29 routes across 23 unique paths)
├── components/     # React components (16 subdirectories: ui/, editor/, reader/, story/, admin/, layout/, providers/, payments/, a11y/, pwa/, seo/, ads/, home/, i18n/, recommendations/, submissions/)
├── lib/            # Utilities (api.ts, seo.ts, sanitize.ts, utils.ts, performance.ts)
├── hooks/          # Custom React hooks (11 hooks: admin-analytics, keyboard-nav, moderation, offline-reading, pull-to-refresh, push-notifications, pwa-install, swipe-gestures, translations, user-management)
├── i18n/           # Internationalization
└── styles/         # Global CSS / Tailwind
```

### Backend (`backend/`)

- **Framework:** NestJS 11, modular monolith (31 feature modules)
- **Database:** PostgreSQL 16 via TypeORM (29 entities in `src/database/entities/`)
- **Cache:** Redis via cache-manager + ioredis
- **Search:** Elasticsearch 8.11 with PostgreSQL full-text fallback
- **Auth:** Passport.js (local + JWT strategies), refresh tokens
- **Real-time:** Socket.io for notifications and live updates
- **Payments:** Stripe (global). Razorpay (India) is configured in `.env.example` but not yet implemented
- **AI:** OpenAI integration for writing companion
- **API docs:** Swagger via NestJS decorators (disabled in production)
- **API prefix:** `/api/v1` with URI-based versioning
- **Rate limiting:** ThrottlerModule with global ThrottlerGuard

Key directories:
```
backend/src/
├── main.ts             # Bootstrap (Helmet, CORS, compression, validation pipe, Swagger, rate limiting)
├── app.module.ts       # Root module registering all 31 feature modules
├── modules/            # Feature modules: ads, ai, ai-companion, analytics, auth, branch-submissions, choices, collections, comments, credits, earnings, featured, forum, health, impressions, messaging, mobile, moderation, notifications, payments, progress, ratings, reading-lists, search, segments, stories, subscriptions, tags, upload, users, websocket
├── database/
│   ├── entities/       # 29 TypeORM entities
│   ├── migrations/     # TypeORM migrations (empty — not yet generated)
│   ├── seeds/          # Database seeding (run-seed.ts runner only)
│   └── data-source.ts  # TypeORM data source config
├── common/
│   ├── filters/        # HTTP exception filter
│   ├── interceptors/   # Transform & logging interceptors
│   ├── cache/          # Redis cache module
│   └── mail/           # Email service (Nodemailer/SendGrid)
└── config/             # configuration.ts + database.config.ts
```

Module pattern: each module follows `feature.module.ts` + `feature.controller.ts` + `feature.service.ts` + `dtos/` folder.

### Shared (`shared/`)

Shared TypeScript types, DTOs, enums, constants, and utility functions consumed by both frontend and backend. Import as `@aardvark/shared`.

Files: `types/` (story, user, common, monetization, moderation, social, forum, messaging, tag), `utils/`, `constants/`.

## Code Conventions

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `rich-text-editor.tsx`, `auth.service.ts` |
| Components | PascalCase | `RichTextEditor`, `SegmentNode` |
| Functions/variables | camelCase | `fetchApi`, `slugify` |
| Constants | UPPER_SNAKE_CASE | `JSON_LIMIT`, `SALT_ROUNDS` |
| Types/Interfaces | PascalCase | `Story`, `RichTextEditorProps` |
| Enums | PascalCase | `StoryStatus`, `UserRole` |

### Import Aliases

- **Frontend:** `@/*` maps to `./src/*` (e.g., `@/components/ui/button`, `@/lib/api`, `@/hooks/useAuth`)
- **Backend:** `@/*` maps to `src/*`, `@entities` maps to `src/database/entities`
- **Shared package:** `@aardvark/shared` (both frontend and backend)

### TypeScript

- Strict mode enabled: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`
- Backend: CommonJS modules, decorator metadata enabled (`emitDecoratorMetadata`, `experimentalDecorators`)
- Frontend: ESNext modules, bundler module resolution
- Target: ES2022 for both
- Unused variables prefixed with `_` are allowed (ESLint rule: `argsIgnorePattern: '^_'`)

### Frontend Patterns

- Use App Router conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)
- Server components by default; add `'use client'` only when needed
- Use `@tanstack/react-query` for data fetching/caching
- Use Zustand stores for client-side state
- Use Zod schemas for form validation with `@hookform/resolvers`
- Tailwind CSS for styling; use `cn()` utility from `@/lib/utils` for conditional classes
- Radix UI for accessible primitives (found in `components/ui/`)

### Backend Patterns

- NestJS module pattern: Module → Controller → Service → Repository
- Use class-validator decorators on DTOs for request validation
- Use class-transformer for response serialization
- Use Guards (`@UseGuards`) for authentication/authorization
- Use Interceptors for response transformation and logging
- Prefer async/await over raw Promises

## Testing

### Unit Tests

- **Framework:** Jest 29
- **Backend tests:** `*.spec.ts` files alongside source (7 test files covering auth, credits, earnings, moderation, payments, subscriptions)
- **Frontend tests:** `*.spec.ts` / `*.spec.tsx` using `@testing-library/react` and `jest-environment-jsdom`
- **Run:** `npm run test` (all) or `npm run test --workspace=backend` / `npm run test --workspace=frontend`

### E2E Tests

- **Framework:** Playwright 1.40
- **Location:** `frontend/e2e/` (7 test files: accessibility, auth, home, moderation, payment-checkout, search, stories)
- **Browsers:** Chromium, Firefox, WebKit + mobile viewports (Pixel 5, iPhone 13)
- **Features:** Auth state setup (`auth.setup.ts`), screenshot on failure, video retention
- **Run:** `npm run test:e2e`

### Test file pattern

Always use `*.spec.ts` (not `*.test.ts`) for test files.

## CI/CD Pipeline

GitHub Actions workflows (`.github/workflows/`):

**ci.yml** — runs on push/PR to `main`/`develop`:
1. **Security:** `npm audit --audit-level=high` on all workspaces
2. **Lint:** ESLint + TypeScript type checking
3. **Test:** Jest with PostgreSQL + Redis service containers (depends on lint)
4. **Build:** shared → backend → frontend (depends on security + lint + test)
5. **Docker:** Build images, push to GHCR, Trivy vulnerability scan (main/develop only)
6. **E2E:** Playwright tests (main/develop only)

**deploy.yml** — Docker image build, GHCR push, DB migrations, rolling deployment via SSH, health checks.

## Infrastructure (Docker)

**Development** (`docker/docker-compose.yml`):
- PostgreSQL 16 (5432), Redis 7 (6379), Elasticsearch 8.11 (9200), MinIO (9000/9001), MailHog (1025/8025)

**Production** (`docker/docker-compose.prod.yml`):
- All dev services + Nginx (80/443), Certbot (Let's Encrypt), Prometheus (9090), Grafana (3001), Loki (3100), Promtail

Start dev infrastructure: `npm run docker:dev`

## Environment Configuration

Copy `.env.example` to `.env` and configure. Key sections:
- **Database:** `DATABASE_URL` (PostgreSQL connection string)
- **Cache:** `REDIS_URL`
- **Search:** `ELASTICSEARCH_NODE`
- **Auth:** `JWT_SECRET`, `JWT_REFRESH_SECRET`
- **Storage:** S3-compatible (MinIO for dev, AWS S3 for prod)
- **Payments:** `STRIPE_SECRET_KEY` (Razorpay vars exist in `.env.example` but package not installed)
- **AI:** `OPENAI_API_KEY`
- **Email:** SMTP config (MailHog for dev)

Required Node.js >= 20.0.0, npm >= 10.0.0.

## Key Domain Concepts

- **Story:** Top-level entity with title, slug, category, status, and metadata
- **Segment:** Individual narrative sections within a story (content blocks)
- **Choice:** Branching points connecting segments (the "choose your own adventure" links)
- **Progress:** Tracks a reader's path through a story
- **Credits:** Virtual currency for premium content access
- **Branch Submissions:** Collaborative contributions from other authors
- **Moderation:** Content review pipeline with auto-flagging and manual review

## Common Development Tasks

### Adding a new backend module

1. Create `backend/src/modules/<feature>/` with `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`
2. Add DTOs in `dtos/` subfolder with class-validator decorators
3. Add entity in `backend/src/database/entities/` if needed
4. Register module in `backend/src/app.module.ts`
5. Add shared types to `shared/src/types/` if frontend needs them

### Adding a new frontend page

1. Create directory in `frontend/src/app/<route>/`
2. Add `page.tsx` (and optionally `layout.tsx`, `loading.tsx`, `error.tsx`)
3. Use existing components from `components/ui/` for consistent UI
4. Use React Query hooks for data fetching

### Adding shared types

1. Add types to the appropriate file in `shared/src/types/`
2. Export from `shared/src/types/index.ts` and `shared/src/index.ts`
3. Both frontend and backend can import via `@aardvark/shared`

## Notable Implementation Gaps

These items are documented or configured but not fully implemented yet:

- **Razorpay payment gateway:** Referenced in `.env.example` but the `razorpay` npm package is not installed in the backend
- **Database migrations:** The `migrations/` directory exists but contains no migration files (only `.gitkeep`)
- **Database seeds:** Only the `run-seed.ts` runner exists; no actual seed data files
- **Frontend `stores/` and `services/` directories:** Aliases defined in `frontend/tsconfig.json` but the directories don't exist

## Pre-commit Hooks

Husky + lint-staged runs on staged files:
- `*.{ts,tsx}` — ESLint fix + Prettier
- `*.{json,md}` — Prettier

Note: The `.husky/` directory is created at `npm install` time via the `prepare` script and is not checked into git.
