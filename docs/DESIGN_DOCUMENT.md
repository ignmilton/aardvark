# Aardvark Interactive Fiction Platform - Design Document

## Project Overview

Build a production-ready, scalable interactive fiction platform similar to CHYOA (Choose Your Own Adventure), designed to support millions of users. The platform enables users to read, write, and collaboratively create branching narrative stories with complex state management and choice tracking.

---

## Architecture Requirements

### Tech Stack (Optimize for Scale & Performance)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React with Next.js 16+ (App Router) | SSR/SSG, SEO optimization, and performance |
| **Backend** | Node.js with NestJS 11+ | Robust API architecture |
| **Primary Database** | PostgreSQL | Relational data (users, stories, branches, transactions) |
| **Cache** | Redis | Caching, session management, and real-time features |
| **Search** | Elasticsearch | Advanced search functionality |
| **File Storage** | AWS S3 or Cloudflare R2 | Media assets |
| **Authentication** | NextAuth.js or Auth0 | JWT tokens |
| **Payments** | Stripe | Subscriptions and credits |
| **Ads** | Google AdSense/AdMob | Video ad network with reward tracking |
| **Real-time** | Socket.io | Notifications and live updates |
| **CDN** | Cloudflare | Global content delivery |
| **Deployment** | Docker, GitHub Actions | Containerization, CI/CD pipeline |

---

## Core Features & Functionality

### 1. User System (5 Role Types)

#### Guest Users
- Browse public story library
- Read first chapter/segment of any story without registration
- View trending/popular sections
- Cannot comment, save progress, or access premium content

#### Registered Readers
- Full access to free stories
- Save reading progress and bookmarks
- Comment and rate stories
- Earn credits by watching ads (rate: 1 credit per 30-second video ad)
- Follow authors and receive notifications
- Create favorites collections
- Personal reading history and recommendations

#### Authors
- All reader privileges
- Create and publish stories with three collaboration modes:
  - **Private**: Only author can write branches
  - **Moderated**: Other users can submit branches for author approval
  - **Open**: Community can freely add approved branches
- Toggle between Rich Text Editor (Medium-style) and Visual Node-Based Editor (Twine-style flowchart)
- Markdown support in both editors
- Set stories as Free or Premium (credit-locked)
- Configure NSFW toggle (future-ready, SFW only for MVP)
- View detailed analytics: reads, completion rates, popular branches, earnings
- AI Writing Companion access (premium feature for paid authors)
- Manage submitted branches and community contributions

#### Moderators
- Review flagged content in moderation queue
- Approve/reject/edit user-submitted content
- Manage user reports and disputes
- Access moderation dashboard with filtering tools
- Temporary ban/warning system

#### Admins
- Full system access
- User management (roles, bans, account issues)
- Platform analytics and reporting
- Configure ad rates, credit costs, premium pricing
- Content category/tag management
- System configuration and feature flags

---

### 2. Story Creation & Branching System

#### Dual Editor Interface

**Rich Text Editor:**
- WYSIWYG with formatting toolbar (bold, italic, headings, lists, links, images)

**Visual Node Editor:**
- Drag-and-drop flowchart with:
  - Node cards representing story segments
  - Connectors showing choice paths
  - Minimap for navigation
  - Auto-layout options
- Toggle switch between editors with real-time sync
- Markdown support in text mode with live preview
- Auto-save every 30 seconds + manual save button

#### Complex Branching & State Management

| Feature | Description |
|---------|-------------|
| **Choice System** | Multiple choices per segment (2-10 options) |
| **State Variables** | Track reader decisions across story (e.g., `met_character_X: true`, `trust_level: 7`) |
| **Conditional Branches** | Show/hide choices based on previous decisions |
| **Branch Merging** | Multiple paths can converge to same segment |
| **Dead Ends & Endings** | Authors mark conclusion points |
| **Version Control** | Track edits and allow rollback to previous versions |

#### Story Metadata
- Title, description, cover image
- Categories (Fantasy, Sci-Fi, Romance, Mystery, Thriller, Horror, etc.)
- Tags (user-generated and curated)
- Content warnings (violence, mature themes, etc.)
- Estimated reading time
- Difficulty/complexity rating
- Language selection
- NSFW toggle (UI present but disabled for SFW-only content currently)

#### Collaboration Modes

**Moderated Mode:**
- Notification system for branch submissions
- Approval queue with preview and edit capabilities
- Comment/feedback system for rejections

**Open Mode:**
- Community voting on branch quality
- Author can still moderate and remove low-quality branches
- Credit attribution to branch contributors

---

### 3. Monetization & Credit System

#### Credit Economy

**Earning Credits (Free Users):**
| Action | Credits Earned |
|--------|----------------|
| Watch 30-second video ads | 1 credit per ad |
| Daily login bonus | 2 credits |
| Complete story reading | 5 credits (for featured stories) |
| Rate and review | 1 credit per review (max 5/day) |

**Spending Credits:**
| Action | Credits Required |
|--------|------------------|
| Unlock premium stories | 10-50 credits (author-set pricing) |
| Access AI Writing Companion | 5 credits per session (for non-premium authors) |
| Tip favorite authors | Any amount |

#### Premium Subscription ($9.99/month suggested)
- Ad-free experience
- Unlimited access to all premium stories
- Unlimited AI Writing Companion (for authors)
- Early access to new features
- Premium badge on profile
- Priority customer support
- Higher storage limits for authored stories

#### Payment Integration
- Stripe Checkout for subscriptions and one-time credit purchases
- Credit bundles: 100 credits ($4.99), 500 credits ($19.99), 1000 credits ($34.99)
- Subscription management (upgrade, downgrade, cancel)
- Revenue sharing: Authors earn 70% of credit revenue from their premium stories
- Payout system for authors via Stripe Connect (minimum $50 threshold)

#### Ad System
- Video ad player modal with countdown timer
- Ad frequency limits: max 1 ad per 10 minutes per user
- Ad verification to ensure completion
- Integration with Google Ad Manager or custom video ad network
- Ad performance analytics for monetization optimization

---

### 4. Discovery & Search Features

#### Homepage Sections
- Hero carousel with featured stories
- Trending (last 7 days by views/ratings)
- Popular (all-time by ratings)
- New Releases (last 30 days)
- Continue Reading (personalized for logged-in users)
- Recommended For You (algorithm-based)
- Editor's Picks

#### Advanced Search
- Full-text search with Elasticsearch
- **Filters:**
  - Categories (multi-select)
  - Tags (multi-select)
  - Content warnings
  - Completion status (ongoing/completed)
  - Length (short/medium/long)
  - Rating (1-5 stars)
  - Free vs. Premium
  - Date published
- **Sort by:** Relevance, Rating, Views, Date, Trending
- Search suggestions and autocomplete
- Search history for logged-in users

#### Story Pages
- Story metadata display
- Author profile link with follow button
- Rating system (5-star with half-star precision)
- Reviews section with pagination
- Related/similar stories recommendation
- Share buttons (social media, copy link)
- Report story button
- Reading progress indicator

---

### 5. Social & Community Features

#### User Profiles
- Avatar upload (with moderation)
- Bio (max 500 characters with markdown support)
- Links (website, social media)
- Badges and achievements
- Followers/Following counts and lists
- Public reading history (optional privacy toggle)
- Authored stories showcase
- Favorite collections (public/private toggle)
- User statistics (stories read, completion rate, etc.)

#### Engagement Features
- **Comments:** Threaded comments on story chapters with likes and replies
- **Ratings & Reviews:** 5-star ratings + written reviews (verified readers only)
- **Favorites/Bookmarks:** Organize stories into custom collections
- **Following System:** Follow authors for updates

#### Notifications
- New chapters from followed authors
- Replies to comments
- Milestone achievements
- Branch approval/rejection (for contributors)
- System announcements

#### Author Analytics Dashboard
- Total views, unique readers
- Completion rates by chapter
- Average reading time per segment
- Popular branches (heat map visualization)
- Reader choice distribution (which branches taken most)
- Rating breakdown and review sentiment analysis
- Revenue earned (for premium stories)
- Follower growth over time
- Geographic distribution of readers

#### Private Messaging
- Direct messages between users
- Conversation threads
- Notification for new messages
- Block/report user functionality
- Message search and archiving

#### Forum System
- Discussion boards by category (General, Writing Tips, Story Discussions, etc.)
- Create threads and reply
- Upvote/downvote system
- Moderator tools (pin, lock, delete threads)
- User reputation system based on forum activity
- Rich text editor for posts

---

### 6. Moderation System

#### Automated Moderation
- Content filtering using ML models or services like AWS Comprehend
- Detect prohibited content: hate speech, explicit NSFW (when SFW-only), spam
- Automatic flagging for human review
- Profanity filter (configurable by story rating)
- Image moderation for uploads
- Rate limiting to prevent spam

#### Manual Moderation

**Moderation Queue Dashboard:**
- Flagged stories, comments, forum posts, user reports
- Filter by type, severity, date
- Assign to moderators
- Quick action buttons (approve, reject, edit, ban user)

**User Reporting:**
- Report button on stories, comments, profiles
- Report reasons (spam, harassment, inappropriate content, copyright)
- Report tracking with status updates for reporter

**Moderator Tools:**
- User warning system (3 strikes policy)
- Temporary bans (1 day, 7 days, 30 days)
- Permanent bans with ban reason
- Edit content (with edit history tracked)
- Shadowban option for spam accounts

**Admin Override:** Admins can review moderator actions and reverse decisions

#### Content Warning System
- Authors tag stories with warnings (violence, death, strong language, etc.)
- User preferences to filter out specific warnings
- Age verification for future NSFW content (18+ gate)

---

## Mobile-First Design Requirements

### Responsive Design Priorities

| Breakpoint | Focus |
|------------|-------|
| **Mobile (320px-768px)** | Primary focus, optimized touch interactions |
| **Tablet (768px-1024px)** | Hybrid layout with side navigation |
| **Desktop (1024px+)** | Full-featured with sidebars and multi-column layouts |

#### Mobile Features
- Bottom navigation bar
- Swipe gestures for navigation
- Collapsible menus
- Reading mode with adjustable font size and background color
- Offline reading mode (PWA with service workers)

### Progressive Web App (PWA)
- Installable on mobile devices
- Offline reading for saved stories
- Push notifications for updates
- App-like experience

### Performance Optimization
- Lazy loading for images and content
- Infinite scroll with virtual scrolling for long lists
- Code splitting and route-based chunking
- Image optimization (WebP, responsive images)
- Server-side rendering for SEO and initial load
- **Target:** <2s initial load, <1s navigation

---

## Database Schema Design

### Key Tables/Collections

```
users
├── id (UUID, PK)
├── username (VARCHAR, UNIQUE)
├── email (VARCHAR, UNIQUE)
├── password_hash (VARCHAR)
├── role (ENUM: guest, reader, author, moderator, admin)
├── avatar_url (VARCHAR)
├── bio (TEXT)
├── created_at (TIMESTAMP)
├── subscription_status (ENUM)
├── credits_balance (INTEGER)
└── preferences_json (JSONB)

stories
├── id (UUID, PK)
├── author_id (UUID, FK → users)
├── title (VARCHAR)
├── description (TEXT)
├── cover_image (VARCHAR)
├── category (ENUM)
├── tags (TEXT[])
├── collaboration_mode (ENUM: private, moderated, open)
├── is_premium (BOOLEAN)
├── credit_cost (INTEGER)
├── nsfw_flag (BOOLEAN)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── status (ENUM: draft, published, hidden)

story_segments
├── id (UUID, PK)
├── story_id (UUID, FK → stories)
├── author_id (UUID, FK → users)
├── content (TEXT)
├── position_json (JSONB) -- for visual editor
├── parent_segment_ids (UUID[])
├── is_ending (BOOLEAN)
└── created_at (TIMESTAMP)

choices
├── id (UUID, PK)
├── segment_id (UUID, FK → story_segments)
├── choice_text (VARCHAR)
├── next_segment_id (UUID, FK → story_segments)
├── condition_json (JSONB) -- for state-based branching
└── order (INTEGER)

reader_progress
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── story_id (UUID, FK → stories)
├── current_segment_id (UUID, FK → story_segments)
├── state_variables_json (JSONB)
└── last_read_at (TIMESTAMP)

comments
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── story_id (UUID, FK → stories)
├── segment_id (UUID, FK → story_segments, nullable)
├── content (TEXT)
├── parent_comment_id (UUID, FK → comments, nullable)
├── likes (INTEGER)
└── created_at (TIMESTAMP)

ratings
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── story_id (UUID, FK → stories)
├── rating (DECIMAL)
├── review_text (TEXT)
└── created_at (TIMESTAMP)

transactions
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── type (ENUM: ad_watch, purchase, spend)
├── amount (INTEGER)
├── description (TEXT)
└── created_at (TIMESTAMP)

subscriptions
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── stripe_subscription_id (VARCHAR)
├── status (ENUM)
└── current_period_end (TIMESTAMP)

notifications
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── type (ENUM)
├── content (TEXT)
├── read (BOOLEAN)
└── created_at (TIMESTAMP)

follows
├── id (UUID, PK)
├── follower_id (UUID, FK → users)
├── following_id (UUID, FK → users)
└── created_at (TIMESTAMP)

messages
├── id (UUID, PK)
├── sender_id (UUID, FK → users)
├── recipient_id (UUID, FK → users)
├── content (TEXT)
├── read (BOOLEAN)
└── created_at (TIMESTAMP)

forum_threads
├── id (UUID, PK)
├── category (ENUM)
├── author_id (UUID, FK → users)
├── title (VARCHAR)
├── content (TEXT)
├── pinned (BOOLEAN)
├── locked (BOOLEAN)
└── created_at (TIMESTAMP)

forum_posts
├── id (UUID, PK)
├── thread_id (UUID, FK → forum_threads)
├── author_id (UUID, FK → users)
├── content (TEXT)
├── upvotes (INTEGER)
├── downvotes (INTEGER)
└── created_at (TIMESTAMP)

moderation_queue
├── id (UUID, PK)
├── content_type (ENUM)
├── content_id (UUID)
├── reporter_id (UUID, FK → users)
├── reason (TEXT)
├── status (ENUM)
├── assigned_moderator_id (UUID, FK → users, nullable)
└── created_at (TIMESTAMP)

author_earnings
├── id (UUID, PK)
├── author_id (UUID, FK → users)
├── story_id (UUID, FK → stories)
├── amount (DECIMAL)
├── period (VARCHAR)
├── paid_out (BOOLEAN)
└── created_at (TIMESTAMP)
```

### Relationships
- Implement proper foreign keys and indexes
- Use junction tables for many-to-many (follows, favorites, story_tags)
- Optimize queries with composite indexes on frequently filtered columns

---

## API Architecture

### RESTful API Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/forgot-password` | Password reset |

#### Stories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stories` | List stories (with filters, pagination) |
| GET | `/api/stories/:id` | Get story details |
| POST | `/api/stories` | Create story (author only) |
| PUT | `/api/stories/:id` | Update story |
| DELETE | `/api/stories/:id` | Delete story |
| GET | `/api/stories/:id/segments` | Get story segments |
| POST | `/api/stories/:id/segments` | Add segment |
| GET | `/api/stories/:id/read/:segmentId` | Read specific segment with choices |

#### User & Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id` | User profile |
| PUT | `/api/users/:id` | Update profile |
| POST | `/api/users/:id/follow` | Follow user |
| GET | `/api/users/:id/stories` | User's stories |
| POST | `/api/stories/:id/rate` | Rate story |
| GET | `/api/stories/:id/comments` | Get comments |
| POST | `/api/stories/:id/comments` | Add comment |

#### Monetization
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/credits/watch-ad` | Log ad watch and credit user |
| POST | `/api/credits/purchase` | Purchase credits |
| POST | `/api/subscription/create` | Create subscription |
| POST | `/api/subscription/cancel` | Cancel subscription |
| POST | `/api/stories/:id/unlock` | Spend credits to unlock premium story |

#### Moderation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/moderation/queue` | Get moderation queue (moderator only) |
| POST | `/api/moderation/report` | Report content |
| PUT | `/api/moderation/:id/resolve` | Resolve moderation issue |
| POST | `/api/admin/users/:id/ban` | Ban user (admin only) |

### API Implementation Requirements
- Rate limiting (Express Rate Limit)
- Authentication middleware (JWT verification)
- Role-based access control
- Input validation and sanitization
- Error handling and logging
- API documentation (Swagger/OpenAPI)

---

## Security & Compliance

| Area | Implementation |
|------|----------------|
| **Authentication** | Bcrypt for password hashing, JWT with refresh tokens |
| **Authorization** | Role-based middleware for protected routes |
| **Input Validation** | Validate and sanitize all user inputs (SQL injection, XSS prevention) |
| **HTTPS** | Enforce SSL/TLS for all connections |
| **CORS** | Configure appropriate CORS policies |
| **Rate Limiting** | Prevent abuse and DDoS attacks |
| **Data Privacy** | GDPR compliance (data export, account deletion, cookie consent) |
| **Payment Security** | PCI DSS compliance via Stripe (never store card details) |
| **Content Security** | CSP headers to prevent XSS |
| **Session Management** | Secure session handling with httpOnly cookies |
| **File Upload Security** | Validate file types, scan for malware, size limits |
| **Audit Logging** | Track admin/moderator actions for accountability |

---

## Deployment & Infrastructure Guidance

### Development Environment
- Docker Compose for local development (frontend, backend, PostgreSQL, Redis, Elasticsearch)
- Environment variables for configuration (.env files)
- Git workflow: feature branches, pull requests, code reviews

### CI/CD Pipeline
- GitHub Actions or GitLab CI
- Automated testing (unit, integration, e2e with Cypress/Playwright)
- Linting and code quality checks (ESLint, Prettier, SonarQube)
- Build and containerization
- Automated deployment to staging/production

### Cloud Infrastructure (AWS Example)

| Service | AWS Product | Purpose |
|---------|-------------|---------|
| Compute | ECS Fargate or EKS | Container orchestration |
| Database | RDS PostgreSQL | Primary database with read replicas |
| Cache | ElastiCache | Redis caching |
| Search | OpenSearch | Elasticsearch |
| Storage | S3 | Media files |
| CDN | CloudFront | Static assets and caching |
| Load Balancer | ALB | Application Load Balancer with auto-scaling |
| Monitoring | CloudWatch, X-Ray | Logs, metrics, and tracing |
| Secrets | Secrets Manager | API keys and credentials |

### Scaling Strategy
- Horizontal scaling for application servers (auto-scaling based on CPU/memory)
- Database read replicas for read-heavy operations
- Redis for caching frequently accessed data (stories, user sessions)
- CDN for static assets and edge caching
- Queue system (AWS SQS, RabbitMQ) for background jobs (email, notifications, analytics processing)
- Microservices architecture for future scaling (story service, user service, payment service)

### Monitoring & Observability
- Application Performance Monitoring (New Relic, Datadog, or Prometheus + Grafana)
- Error tracking (Sentry)
- Log aggregation (ELK stack or CloudWatch Logs Insights)
- Uptime monitoring (Pingdom, UptimeRobot)
- User analytics (Google Analytics, Mixpanel, or custom)

### Backup & Disaster Recovery
- Daily automated database backups with point-in-time recovery
- S3 versioning for uploaded files
- Multi-region deployment for high availability (future consideration)
- Disaster recovery plan with RTO/RPO targets

---

## Development Phases & Deliverables

### Phase 1: Foundation
- Project setup and infrastructure
- Database schema implementation
- Authentication system (all user roles)
- Basic story CRUD operations
- Simple reading interface

### Phase 2: Core Features
- Rich text editor integration
- Basic branching system
- Reader progress tracking
- Search and discovery
- User profiles and following

### Phase 3: Advanced Story Features
- Visual node-based editor
- Complex state management and conditional branching
- Collaboration modes (private, moderated, open)
- Branch submission and approval workflow

### Phase 4: Monetization
- Stripe integration for subscriptions
- Credit system implementation
- Ad integration with reward mechanism
- Premium story unlocking
- Author revenue tracking and payouts

### Phase 5: Social & Community
- Comments and ratings system
- Private messaging
- Forum implementation
- Notifications system
- Author analytics dashboard

### Phase 6: Moderation & AI
- Automated content moderation
- Moderation queue and tools
- AI Writing Companion integration (OpenAI API or similar)
- Reporting system
- Admin dashboard

### Phase 7: Polish & Launch
- Mobile optimization and PWA
- Performance optimization
- SEO optimization
- User testing and bug fixes
- Deployment to production
- Marketing site and documentation

---

## Additional Technical Specifications

### AI Writing Companion (Premium Feature)
- Integration with OpenAI API (GPT-4) or Anthropic Claude
- **Features:**
  - Continue story suggestion based on context
  - Grammar and style improvements
  - Plot idea generation
  - Character development suggestions
  - Alternative dialogue options
- Rate limiting: 50 requests/day for premium users
- Cost tracking and optimization

### Recommendation Algorithm
- Collaborative filtering based on reading history
- Content-based filtering using tags and categories
- Hybrid approach combining both methods
- Real-time updates using user behavior
- A/B testing framework for algorithm improvements

### SEO Optimization
- Server-side rendering for all public pages
- Dynamic meta tags (title, description, Open Graph)
- Structured data (JSON-LD for stories)
- Sitemap generation
- Robots.txt configuration
- Canonical URLs for duplicate content prevention

### Accessibility (WCAG 2.1 AA Compliance)
- Keyboard navigation support
- Screen reader compatibility (ARIA labels)
- Color contrast compliance
- Alt text for images
- Focus indicators
- Adjustable text size and reading mode

### Internationalization (i18n) - Future Ready
- Translation framework (next-i18next or react-intl)
- Language selection
- RTL support for Arabic/Hebrew
- Date/time formatting
- Currency conversion

---

## Code Quality & Best Practices

| Practice | Implementation |
|----------|----------------|
| **TypeScript** | Use TypeScript for type safety across frontend and backend |
| **Code Structure** | Feature-based folder organization |
| **Testing** | Aim for 80%+ code coverage |
| **Unit Tests** | Jest |
| **Integration Tests** | Supertest for API |
| **E2E Tests** | Cypress/Playwright |
| **Documentation** | JSDoc comments, API documentation, README files |
| **Version Control** | Semantic versioning, changelog maintenance |
| **Code Reviews** | Mandatory PR reviews before merge |
| **Performance** | Regular performance audits, Lighthouse scores >90 |

---

## Deliverables

- [ ] Full source code with TypeScript, well-commented and organized
- [ ] Database migration scripts and seed data for testing
- [ ] API documentation (Swagger/OpenAPI specification)
- [ ] Deployment guide with infrastructure setup instructions
- [ ] Docker Compose file for local development
- [ ] CI/CD pipeline configuration (GitHub Actions YAML)
- [ ] Admin user guide for platform management
- [ ] Testing suite with coverage reports
- [ ] Environment configuration templates (.env.example)
- [ ] Architecture diagrams (database ERD, system architecture, user flows)

---

## Success Metrics & KPIs

| Metric | Target |
|--------|--------|
| **Performance** | Page load <2s, API response <200ms |
| **Scalability** | Support 1M+ concurrent users |
| **Availability** | 99.9% uptime SLA |
| **User Engagement** | Track daily active users, average session time, story completion rates |
| **Monetization** | Conversion rate to premium, ad revenue per user, author earnings |
| **Content Growth** | Stories published per month, active authors, community contributions |

---

## Notes

Build this as a production-ready application with enterprise-grade code quality, security, and scalability. Prioritize clean architecture, maintainability, and user experience. Provide detailed inline comments explaining complex logic, especially for the branching system and state management. Include error handling, logging, and graceful degradation throughout.
