# Aardvark - Interactive Fiction Platform

A production-ready, scalable interactive fiction platform for creating, reading, and collaboratively authoring branching narrative stories. Similar to CHYOA (Choose Your Own Adventure), designed to support millions of users.

## Features

### For Readers
- Browse thousands of interactive stories across multiple genres
- Make choices that shape the narrative
- Track reading progress and bookmarks
- Follow favorite authors
- Create personal reading lists and collections
- Earn credits by watching ads
- Access premium content with subscriptions
- Offline reading support (PWA)
- Push notifications for story updates

### For Authors
- **Dual Editor System**: Rich text editor (TipTap WYSIWYG) and visual node-based editor (React Flow)
- Complex branching with state management and conditional choices
- Three collaboration modes: Private, Moderated, Open
- Branch submission system for collaborative stories
- Detailed analytics dashboard
- AI Writing Companion (premium feature)
- Monetization through credits and premium stories
- Author earnings and payouts (Stripe Connect + UPI/Razorpay)

### Platform Features
- **5 User Roles**: Guest, Reader, Author, Moderator, Admin
- **Credit Economy**: Earn credits via ads, spend on premium content
- **Premium Subscriptions**: Ad-free, unlimited access
- **Social Features**: Comments, ratings, follows, messaging, forums
- **Moderation System**: Automated and manual content moderation with ban appeals
- **Mobile-First PWA**: Offline reading, push notifications, swipe gestures
- **Full-text Search**: Elasticsearch-powered search with fallback to PostgreSQL

## Tech Stack

### Frontend
- **Framework**: Next.js 16.x (App Router)
- **UI**: React 18, Tailwind CSS, Radix UI
- **State**: Zustand, React Query (TanStack)
- **Editors**: TipTap (rich text), React Flow (visual flowchart)
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **PWA**: next-pwa for offline capabilities

### Backend
- **Framework**: NestJS 11.x
- **Database**: PostgreSQL 16 (TypeORM)
- **Cache**: Redis 7
- **Search**: Elasticsearch 8.11
- **Auth**: JWT with Passport.js (local + JWT strategies)
- **Payments**: Stripe (global) + Razorpay (India/UPI)
- **Real-time**: Socket.io
- **Email**: Nodemailer (SMTP/SendGrid)
- **Image Processing**: Sharp
- **AI**: OpenAI integration

### Infrastructure
- **Storage**: AWS S3 / MinIO (S3-compatible)
- **CDN**: Cloudflare
- **Containerization**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana, Loki

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm 10+

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/aardvark.git
   cd aardvark
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start infrastructure services**
   ```bash
   npm run docker:dev
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - API Docs: http://localhost:4000/api/docs

### Docker Compose Services (Development)

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL 16 database |
| redis | 6379 | Redis 7 cache |
| elasticsearch | 9200 | Elasticsearch 8.11 search engine |
| minio | 9000/9001 | S3-compatible storage (API/Console) |
| mailhog | 1025/8025 | Email testing (SMTP/Web UI) |
| backend | 4000 | NestJS API server |
| frontend | 3000 | Next.js application |

### Docker Compose Services (Production)

Additional production services:
| Service | Port | Description |
|---------|------|-------------|
| nginx | 80/443 | Reverse proxy with SSL |
| certbot | - | Let's Encrypt SSL certificates |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Dashboards and visualization |
| loki | 3100 | Log aggregation |
| promtail | - | Log collection |

## Project Structure

```
aardvark/
├── frontend/                 # Next.js 16 application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks (offline, PWA, gestures)
│   │   ├── lib/             # Utilities (API, sanitize, SEO)
│   │   ├── stores/          # Zustand state stores
│   │   └── styles/          # Global styles
│   └── public/              # Static assets
│
├── backend/                  # NestJS application
│   ├── src/
│   │   ├── config/          # Configuration
│   │   ├── common/          # Shared (cache, mail, filters)
│   │   ├── database/        # Entities & migrations
│   │   └── modules/         # 31 feature modules
│   │       ├── auth/        # Authentication (JWT, local)
│   │       ├── users/       # User management
│   │       ├── stories/     # Story CRUD
│   │       ├── segments/    # Story segments/nodes
│   │       ├── choices/     # Branching choices
│   │       ├── progress/    # Reader progress tracking
│   │       ├── comments/    # Story comments
│   │       ├── ratings/     # Ratings and reviews
│   │       ├── credits/     # Credit system
│   │       ├── subscriptions/ # Premium subscriptions
│   │       ├── payments/    # Stripe + Razorpay
│   │       ├── earnings/    # Author payouts
│   │       ├── search/      # Elasticsearch integration
│   │       ├── moderation/  # Content moderation
│   │       ├── notifications/ # Push notifications
│   │       ├── messaging/   # Direct messages
│   │       ├── forum/       # Discussion forums
│   │       ├── tags/        # Story tagging
│   │       ├── reading-lists/ # User collections
│   │       ├── collections/ # Featured collections
│   │       ├── featured/    # Featured content
│   │       ├── analytics/   # Analytics dashboard
│   │       ├── impressions/ # View tracking
│   │       ├── ai-companion/ # AI writing assistant
│   │       ├── ads/         # Ad rewards
│   │       ├── upload/      # File uploads (S3)
│   │       ├── mobile/      # Mobile-specific APIs
│   │       ├── branch-submissions/ # Collaborative branches
│   │       ├── websocket/   # Real-time updates
│   │       └── health/      # Health checks
│   └── test/                # Tests
│
├── shared/                   # Shared types & utilities
│   └── src/
│       ├── types/           # TypeScript types
│       ├── utils/           # Utility functions
│       └── constants/       # Constants
│
├── docker/                   # Docker configuration
│   ├── docker-compose.yml   # Development stack
│   ├── docker-compose.prod.yml # Production stack
│   ├── Dockerfile.backend   # Multi-stage backend build
│   └── Dockerfile.frontend  # Multi-stage frontend build
│
├── docs/                     # Documentation
│   ├── DESIGN_DOCUMENT.md
│   └── PRODUCTION_ARCHITECTURE.md
│
└── .github/                  # GitHub Actions
    └── workflows/
        ├── ci.yml           # Continuous Integration
        └── deploy.yml       # Production deployment
```

## API Documentation

API documentation is available via Swagger UI at `/api/docs` when running in development mode.

### Main Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/forgot-password | Request password reset |
| POST | /api/v1/auth/reset-password | Reset password with token |

#### Stories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/stories | List stories (paginated, filterable) |
| POST | /api/v1/stories | Create story |
| GET | /api/v1/stories/:id | Get story details |
| PUT | /api/v1/stories/:id | Update story |
| DELETE | /api/v1/stories/:id | Delete story |

#### Segments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/segments/story/:storyId | Get all segments for a story |
| GET | /api/v1/segments/story/:storyId/structure | Get story structure for editor |
| POST | /api/v1/segments | Create segment |
| PUT | /api/v1/segments/:id | Update segment |
| DELETE | /api/v1/segments/:id | Delete segment |

#### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/payments/checkout/credits | Create Stripe checkout for credits |
| POST | /api/v1/payments/checkout/subscription | Create subscription checkout |
| POST | /api/v1/payments/upi/order | Create UPI order (India) |
| POST | /api/v1/payments/upi/verify | Verify UPI payment |
| POST | /api/v1/payments/webhook | Stripe webhook handler |

#### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/search/stories | Search stories |
| GET | /api/v1/search/users | Search users |
| GET | /api/v1/search/autocomplete | Autocomplete suggestions |

## Database Schema

### Core Tables
- `users` - User accounts and profiles (30+ fields)
- `stories` - Story metadata
- `story_segments` - Story content nodes
- `choices` - Connections between segments
- `reader_progress` - User reading state and history

### Social Tables
- `comments` - Story comments with threading
- `ratings` - Story ratings and reviews
- `follows` - User follows
- `messages` - Direct messages
- `forum_posts` - Forum discussions
- `notifications` - User notifications
- `push_subscriptions` - Web push subscriptions

### Monetization Tables
- `transactions` - Credit transactions
- `subscriptions` - User subscriptions
- `subscription_plans` - Available plans
- `credit_bundles` - Credit purchase options
- `author_earnings` - Author payout tracking
- `ad_rewards` - Ad reward records
- `story_unlocks` - Premium content unlocks

### Content Management Tables
- `tags` - Story tags
- `story_tags` - Story-tag associations
- `reading_lists` - User reading lists
- `collections` - Curated collections
- `featured_content` - Featured stories
- `moderation_reports` - Content reports
- `ban_appeals` - User ban appeals
- `branch_submissions` - Collaborative branch submissions

## Environment Variables

See `.env.example` for all available configuration options.

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aardvark

# Cache
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email (SMTP)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM_EMAIL=noreply@aardvark.local
```

### Optional Variables

```env
# Elasticsearch (falls back to PostgreSQL if not configured)
ELASTICSEARCH_NODE=http://localhost:9200

# Storage (defaults to MinIO in development)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=aardvark-uploads

# OpenAI (for AI Companion feature)
OPENAI_API_KEY=sk-xxx

# Razorpay (India payments)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx

# Feature Flags
FEATURE_AI_COMPANION=true
FEATURE_NSFW_CONTENT=false
```

## Scripts

```bash
# Development
npm run dev              # Start all services
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only

# Building
npm run build            # Build all packages
npm run build:frontend   # Build frontend
npm run build:backend    # Build backend

# Testing
npm run test             # Run all unit tests
npm run test:e2e         # Run Playwright E2E tests
npm run test:coverage    # Run tests with coverage

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database with test data
npm run migration:run    # Run pending migrations

# Docker
npm run docker:dev       # Start dev infrastructure
npm run docker:down      # Stop all containers

# Linting
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript type checking
```

## Deployment

### Docker Deployment

```bash
# Build production images
docker build -f docker/Dockerfile.backend -t aardvark-backend .
docker build -f docker/Dockerfile.frontend -t aardvark-frontend .

# Run with Docker Compose
docker-compose -f docker/docker-compose.prod.yml up -d
```

### CI/CD Pipeline

The project uses GitHub Actions for CI/CD:

1. **CI Pipeline** (`ci.yml`):
   - Security audit (npm audit)
   - Linting and type checking
   - Unit tests with PostgreSQL + Redis services
   - Docker image builds with Trivy vulnerability scanning
   - E2E tests (on main/develop branches)

2. **Deploy Pipeline** (`deploy.yml`):
   - Builds and pushes Docker images to GHCR
   - Runs database migrations
   - Rolling deployment via SSH
   - Health checks and smoke tests

### Cloud Deployment (AWS)

Recommended AWS architecture:
- **ECS Fargate** or **EKS** for container orchestration
- **RDS PostgreSQL** with read replicas for high availability
- **ElastiCache Redis** for caching and sessions
- **OpenSearch Service** for full-text search
- **S3** for file storage
- **CloudFront** for CDN and static assets
- **Application Load Balancer** for routing and SSL termination
- **CloudWatch** for logging and monitoring

### Production Checklist

- [ ] Set strong JWT secrets
- [ ] Configure CORS for your domain
- [ ] Set up SSL certificates (Certbot/ACM)
- [ ] Configure rate limiting appropriately
- [ ] Set up monitoring dashboards (Grafana)
- [ ] Configure log retention (Loki)
- [ ] Set up database backups
- [ ] Configure Stripe webhooks for your domain
- [ ] Set up email service (SendGrid/SES)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- ESLint + Prettier for code formatting
- TypeScript strict mode enabled
- Conventional commits recommended

## License

This project is proprietary. All rights reserved.

## Support

- Documentation: [/docs](/docs)
- Issues: [GitHub Issues](https://github.com/your-org/aardvark/issues)
- Email: support@aardvark.com
