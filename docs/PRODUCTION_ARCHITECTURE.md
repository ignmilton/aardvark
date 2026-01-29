# Aardvark Interactive Fiction Platform - Production Architecture

## Document Version
- **Version**: 2.0
- **Date**: 2026-01-29
- **Status**: Design Document for Production Readiness

---

## 1. Executive Summary

Aardvark is an interactive fiction platform where users create and consume branching narrative stories. This document outlines the production-ready architecture based on stakeholder requirements.

### Key Design Decisions
| Decision | Choice |
|----------|--------|
| Story Content | 100% User-Generated Content (UGC) |
| Tag System | Folksonomy (author-created) with metadata |
| Monetization | Freemium with credits, ads, and subscriptions |
| Collaboration | Configurable per story |
| API Consumers | Web frontend + Mobile apps |
| Moderation | Pre-publication review |
| Localization | Linked translations |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
├─────────────────────┬───────────────────────┬───────────────────────┤
│   Next.js Web App   │   iOS App (Future)    │  Android App (Future) │
│     (Port 3000)     │                       │                       │
└─────────────────────┴───────────────────────┴───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY                                 │
│                    NestJS Backend (Port 4000)                        │
├─────────────────────────────────────────────────────────────────────┤
│  Auth  │  Stories  │  Credits  │  Ads  │  Analytics  │  Moderation  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                  │
├───────────────────┬─────────────────────┬───────────────────────────┤
│    PostgreSQL     │       Redis         │      Object Storage       │
│   (Primary DB)    │  (Cache/Sessions)   │   (Images/Media)          │
└───────────────────┴─────────────────────┴───────────────────────────┘
```

### 2.2 Module Structure

```
backend/src/modules/
├── auth/                 # Authentication & Authorization
├── users/                # User management
├── stories/              # Story CRUD & discovery
├── segments/             # Story segment management
├── choices/              # Choice/decision management
├── tags/                 # Tag management with metadata
├── collections/          # User-curated story collections
├── featured/             # Editorial picks management
├── credits/              # Credit system
├── subscriptions/        # Subscription management
├── ads/                  # Ad serving & reward tracking
├── impressions/          # Impression tracking for revenue
├── revenue/              # Revenue calculation & payouts
├── translations/         # Story translation linking
├── moderation/           # Pre-publication review
├── analytics/            # Funnel analysis & dashboards
├── recommendations/      # Personalized recommendations
├── progress/             # Reader progress tracking
├── comments/             # Story comments
├── ratings/              # Story ratings
└── notifications/        # User notifications
```

---

## 3. Data Model

### 3.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │───────│    Story     │───────│  Segment     │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │                      │
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Subscription │       │     Tag      │       │    Choice    │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌──────────────┐       ┌──────────────┐
│   Credits    │       │  TagAlias    │
└──────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Collection  │───────│ Impression   │───────│   Revenue    │
└──────────────┘       └──────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────┐
│ Translation  │───────│  AdReward    │
└──────────────┘       └──────────────┘
```

### 3.2 Core Entities

#### 3.2.1 User Entity (Enhanced)
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.READER })
  role: UserRole;

  // Credit System
  @Column({ type: 'int', default: 0 })
  creditBalance: number;

  // Subscription
  @OneToOne(() => Subscription, subscription => subscription.user)
  subscription: Subscription;

  // Revenue (for authors)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingRevenue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalEarnings: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 3.2.2 Story Entity (Updated)
```typescript
@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  synopsis: string;

  @Column({ nullable: true })
  coverImageUrl: string;

  // Author relationship
  @ManyToOne(() => User, user => user.stories)
  author: User;

  @Column()
  authorId: string;

  // Root segment reference
  @Column({ type: 'uuid', nullable: true })
  rootSegmentId: string;

  // Tags (many-to-many)
  @ManyToMany(() => Tag, tag => tag.stories)
  @JoinTable({ name: 'story_tags' })
  tags: Tag[];

  // Category (primary classification)
  @Column({ nullable: true })
  category: string;

  // Content warnings
  @Column({ type: 'simple-array', nullable: true })
  contentWarnings: string[];

  // Monetization
  @Column({ default: false })
  isPremium: boolean;

  @Column({ type: 'int', default: 0 })
  creditCost: number;

  // Collaboration settings
  @Column({
    type: 'enum',
    enum: CollaborationMode,
    default: CollaborationMode.CLOSED
  })
  collaborationMode: CollaborationMode;

  // Publication status
  @Column({
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.DRAFT
  })
  status: StoryStatus;

  // Moderation
  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING
  })
  moderationStatus: ModerationStatus;

  @Column({ type: 'text', nullable: true })
  moderationNotes: string;

  @Column({ type: 'uuid', nullable: true })
  moderatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  moderatedAt: Date;

  // Analytics
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  ratingsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionRate: number;

  // Translation linking
  @Column({ type: 'uuid', nullable: true })
  originalStoryId: string;

  @Column({ length: 5, default: 'en' })
  language: string;

  @OneToMany(() => Story, story => story.originalStory)
  translations: Story[];

  @ManyToOne(() => Story, story => story.translations)
  originalStory: Story;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;
}

// Enums
export enum CollaborationMode {
  CLOSED = 'closed',           // Only author
  INVITE_ONLY = 'invite_only', // Author invites collaborators
  MODERATED = 'moderated',     // Anyone can submit, requires approval
  OPEN = 'open'                // Wiki-style, anyone can edit
}

export enum StoryStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUIRES_CHANGES = 'requires_changes'
}
```

#### 3.2.3 Tag Entity (Enhanced with Metadata)
```typescript
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Popularity tracking
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  // Creator (author who first used this tag)
  @ManyToOne(() => User)
  createdBy: User;

  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  // Aliases for this tag
  @OneToMany(() => TagAlias, alias => alias.tag)
  aliases: TagAlias[];

  // Stories using this tag
  @ManyToMany(() => Story, story => story.tags)
  stories: Story[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('tag_aliases')
export class TagAlias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  alias: string;

  @ManyToOne(() => Tag, tag => tag.aliases, { onDelete: 'CASCADE' })
  tag: Tag;

  @Column()
  tagId: string;
}
```

#### 3.2.4 Collection Entity (User-Curated)
```typescript
@Entity('collections')
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  coverImageUrl: string;

  // Owner
  @ManyToOne(() => User, user => user.collections)
  owner: User;

  @Column()
  ownerId: string;

  // Visibility
  @Column({ default: true })
  isPublic: boolean;

  // Stories in collection (ordered)
  @OneToMany(() => CollectionStory, cs => cs.collection)
  collectionStories: CollectionStory[];

  // Followers
  @Column({ type: 'int', default: 0 })
  followerCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('collection_stories')
export class CollectionStory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Collection, collection => collection.collectionStories, { onDelete: 'CASCADE' })
  collection: Collection;

  @Column()
  collectionId: string;

  @ManyToOne(() => Story)
  story: Story;

  @Column()
  storyId: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'text', nullable: true })
  curatorNote: string;

  @CreateDateColumn()
  addedAt: Date;
}
```

#### 3.2.5 Featured Content Entity (Editorial Picks)
```typescript
@Entity('featured_content')
export class FeaturedContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: FeaturedType
  })
  type: FeaturedType;

  // Can feature a story or a collection
  @ManyToOne(() => Story, { nullable: true })
  story: Story;

  @Column({ type: 'uuid', nullable: true })
  storyId: string;

  @ManyToOne(() => Collection, { nullable: true })
  collection: Collection;

  @Column({ type: 'uuid', nullable: true })
  collectionId: string;

  // Display settings
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  bannerImageUrl: string;

  // Scheduling
  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  // Position/priority
  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ nullable: true })
  placement: string; // 'homepage_hero', 'homepage_carousel', 'category_spotlight'

  // Created by admin/moderator
  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum FeaturedType {
  STORY = 'story',
  COLLECTION = 'collection',
  AUTHOR_SPOTLIGHT = 'author_spotlight',
  NEW_RELEASES = 'new_releases',
  EDITORS_PICK = 'editors_pick'
}
```

#### 3.2.6 Credit System Entities
```typescript
@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  amount: number; // Positive for credits earned, negative for spent

  @Column({
    type: 'enum',
    enum: CreditTransactionType
  })
  type: CreditTransactionType;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Reference to what triggered this transaction
  @Column({ type: 'uuid', nullable: true })
  referenceId: string;

  @Column({ nullable: true })
  referenceType: string; // 'ad_reward', 'story_purchase', 'subscription_bonus', etc.

  // Balance after transaction
  @Column({ type: 'int' })
  balanceAfter: number;

  @CreateDateColumn()
  createdAt: Date;
}

export enum CreditTransactionType {
  AD_REWARD = 'ad_reward',
  STORY_PURCHASE = 'story_purchase',
  SUBSCRIPTION_BONUS = 'subscription_bonus',
  REFUND = 'refund',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
  PROMOTIONAL = 'promotional'
}

@Entity('ad_rewards')
export class AdReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column()
  adProvider: string;

  @Column()
  adType: string; // 'rewarded_video', 'interstitial', etc.

  @Column({ type: 'int' })
  creditsAwarded: number;

  @Column({ nullable: true })
  adUnitId: string;

  @Column({ type: 'json', nullable: true })
  adMetadata: Record<string, any>;

  @CreateDateColumn()
  watchedAt: Date;
}
```

#### 3.2.7 Subscription Entity
```typescript
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.subscription)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier
  })
  tier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE
  })
  status: SubscriptionStatus;

  // Billing
  @Column({ type: 'timestamp' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp' })
  currentPeriodEnd: Date;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  // Platform (for mobile subscriptions)
  @Column({ nullable: true })
  platform: string; // 'web', 'ios', 'android'

  @Column({ nullable: true })
  platformSubscriptionId: string;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  EXPIRED = 'expired'
}
```

#### 3.2.8 Impression & Revenue Tracking
```typescript
@Entity('impressions')
export class Impression {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Story)
  story: Story;

  @Column()
  storyId: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  // Session tracking for anonymous users
  @Column({ nullable: true })
  sessionId: string;

  // Impression type
  @Column({
    type: 'enum',
    enum: ImpressionType
  })
  type: ImpressionType;

  // For segment reads, track which segment
  @Column({ type: 'uuid', nullable: true })
  segmentId: string;

  // Duration tracking (for read impressions)
  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  // Revenue attribution
  @Column({ default: false })
  isRevenueEligible: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  revenueAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}

export enum ImpressionType {
  VIEW = 'view',              // Story page view
  READ_START = 'read_start',  // Started reading
  READ_SEGMENT = 'read_segment', // Read a segment
  READ_COMPLETE = 'read_complete' // Completed story
}

@Entity('author_revenue')
export class AuthorRevenue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  author: User;

  @Column()
  authorId: string;

  @ManyToOne(() => Story)
  story: Story;

  @Column()
  storyId: string;

  // Revenue period
  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  // Metrics
  @Column({ type: 'int', default: 0 })
  totalImpressions: number;

  @Column({ type: 'int', default: 0 })
  uniqueReaders: number;

  @Column({ type: 'int', default: 0 })
  completions: number;

  // Revenue
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  grossRevenue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 70 })
  revenueSharePercent: number; // Default 70% to author

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  netRevenue: number;

  // Payout status
  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.PENDING
  })
  payoutStatus: PayoutStatus;

  @Column({ type: 'uuid', nullable: true })
  payoutId: string;

  @CreateDateColumn()
  createdAt: Date;
}

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed'
}
```

#### 3.2.9 Segment Entity (Simplified - No State Variables)
```typescript
@Entity('story_segments')
export class StorySegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Story, story => story.segments, { onDelete: 'CASCADE' })
  story: Story;

  @Column()
  storyId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  contentMarkdown: string;

  // Visual editor positioning
  @Column({ type: 'json', nullable: true })
  position: { x: number; y: number };

  // Segment relationships
  @Column({ type: 'simple-array', nullable: true })
  parentSegmentIds: string[];

  @Column({ default: false })
  isRootSegment: boolean;

  @Column({ default: false })
  isEnding: boolean;

  @Column({ nullable: true })
  endingType: string; // 'good', 'bad', 'neutral', 'secret'

  // Collaboration (for moderated mode)
  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.APPROVED
  })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  // Contributor (if different from story author)
  @ManyToOne(() => User, { nullable: true })
  contributor: User;

  @Column({ type: 'uuid', nullable: true })
  contributorId: string;

  // Analytics
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}
```

#### 3.2.10 Choice Entity (Simplified - No State Conditions)
```typescript
@Entity('choices')
export class Choice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StorySegment, segment => segment.choices, { onDelete: 'CASCADE' })
  segment: StorySegment;

  @Column()
  segmentId: string;

  @Column()
  choiceText: string;

  @Column({ type: 'uuid', nullable: true })
  nextSegmentId: string;

  @ManyToOne(() => StorySegment, { nullable: true })
  nextSegment: StorySegment;

  // Display order
  @Column({ type: 'int', default: 0 })
  order: number;

  // Analytics
  @Column({ type: 'int', default: 0 })
  timesChosen: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 3.2.11 Reader Progress (Simplified)
```typescript
@Entity('reader_progress')
export class ReaderProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => Story)
  story: Story;

  @Column()
  storyId: string;

  // Current position
  @Column({ type: 'uuid' })
  currentSegmentId: string;

  // History
  @Column({ type: 'simple-array', nullable: true })
  visitedSegmentIds: string[];

  @Column({ type: 'json', nullable: true })
  choiceHistory: { segmentId: string; choiceId: string; timestamp: Date }[];

  // Bookmarks
  @Column({ type: 'simple-array', nullable: true })
  bookmarks: string[];

  // Completion
  @Column({ default: false })
  isCompleted: boolean;

  @Column({ nullable: true })
  completedEndingType: string;

  // Access tracking
  @Column({ default: false })
  hasPurchased: boolean;

  @Column({ type: 'timestamp', nullable: true })
  purchasedAt: Date;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  lastReadAt: Date;
}
```

---

## 4. API Endpoints

### 4.1 Stories API
```
GET     /api/v1/stories                    - List published stories (paginated, filtered)
GET     /api/v1/stories/:id                - Get story by ID
GET     /api/v1/stories/slug/:slug         - Get story by slug
GET     /api/v1/stories/featured           - Get featured stories
GET     /api/v1/stories/trending           - Get trending stories
GET     /api/v1/stories/recommendations    - Personalized recommendations (auth)
POST    /api/v1/stories                    - Create story (requires AUTHOR role)
PUT     /api/v1/stories/:id                - Update story (owner only)
DELETE  /api/v1/stories/:id                - Delete story (owner only)
POST    /api/v1/stories/:id/submit-review  - Submit for moderation review
POST    /api/v1/stories/:id/publish        - Publish (after approval)
```

### 4.2 Tags API
```
GET     /api/v1/tags                       - List all tags (with metadata)
GET     /api/v1/tags/:id                   - Get tag by ID
GET     /api/v1/tags/slug/:slug            - Get tag by slug
GET     /api/v1/tags/popular               - Get popular tags
GET     /api/v1/tags/search                - Search tags (for autocomplete)
POST    /api/v1/tags                       - Create tag (authors can create)
PUT     /api/v1/tags/:id                   - Update tag (admin/moderator)
POST    /api/v1/tags/:id/aliases           - Add alias to tag
DELETE  /api/v1/tags/:id/aliases/:aliasId  - Remove alias
```

### 4.3 Collections API
```
GET     /api/v1/collections                - List public collections
GET     /api/v1/collections/:id            - Get collection by ID
GET     /api/v1/collections/slug/:slug     - Get collection by slug
GET     /api/v1/collections/user/:userId   - Get user's collections
GET     /api/v1/collections/my             - Get current user's collections (auth)
POST    /api/v1/collections                - Create collection (auth)
PUT     /api/v1/collections/:id            - Update collection (owner only)
DELETE  /api/v1/collections/:id            - Delete collection (owner only)
POST    /api/v1/collections/:id/stories    - Add story to collection
DELETE  /api/v1/collections/:id/stories/:storyId - Remove story
PUT     /api/v1/collections/:id/reorder    - Reorder stories in collection
POST    /api/v1/collections/:id/follow     - Follow collection
DELETE  /api/v1/collections/:id/follow     - Unfollow collection
```

### 4.4 Featured Content API (Admin)
```
GET     /api/v1/featured                   - Get active featured content
GET     /api/v1/featured/all               - Get all featured (admin)
POST    /api/v1/featured                   - Create featured content (admin)
PUT     /api/v1/featured/:id               - Update featured content (admin)
DELETE  /api/v1/featured/:id               - Delete featured content (admin)
```

### 4.5 Credits API
```
GET     /api/v1/credits/balance            - Get current balance (auth)
GET     /api/v1/credits/transactions       - Get transaction history (auth)
POST    /api/v1/credits/purchase           - Purchase credits (future)
POST    /api/v1/credits/spend              - Spend credits on story
```

### 4.6 Ads API
```
GET     /api/v1/ads/config                 - Get ad configuration
POST    /api/v1/ads/reward                 - Record ad watch, award credits (auth)
GET     /api/v1/ads/daily-limit            - Check daily ad reward limit
```

### 4.7 Subscriptions API
```
GET     /api/v1/subscriptions/status       - Get subscription status (auth)
POST    /api/v1/subscriptions/subscribe    - Start subscription
POST    /api/v1/subscriptions/cancel       - Cancel subscription
POST    /api/v1/subscriptions/webhook      - Stripe/App Store webhook
```

### 4.8 Moderation API
```
GET     /api/v1/moderation/queue           - Get pending reviews (mod/admin)
GET     /api/v1/moderation/story/:id       - Get story moderation details
POST    /api/v1/moderation/story/:id/approve - Approve story
POST    /api/v1/moderation/story/:id/reject  - Reject story
POST    /api/v1/moderation/story/:id/request-changes - Request changes
```

### 4.9 Translations API
```
GET     /api/v1/stories/:id/translations   - Get all translations of a story
POST    /api/v1/stories/:id/translations   - Create translation link
DELETE  /api/v1/stories/:id/translations/:langCode - Remove translation link
```

### 4.10 Analytics API (Author Dashboard)
```
GET     /api/v1/analytics/overview         - Get author overview stats (auth)
GET     /api/v1/analytics/story/:id        - Get story analytics (owner)
GET     /api/v1/analytics/story/:id/funnel - Get reader funnel analysis
GET     /api/v1/analytics/revenue          - Get revenue breakdown (auth)
GET     /api/v1/analytics/revenue/history  - Get revenue history (auth)
```

---

## 5. Business Logic

### 5.1 Monetization Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER TYPES                                   │
├─────────────────────────┬───────────────────────────────────────────┤
│    FREE USER            │         SUBSCRIBER                        │
│  - Sees ads             │       - No ads                            │
│  - Earns credits (ads)  │       - Unlimited access                  │
│  - Spends credits       │       - No credits needed                 │
└─────────────────────────┴───────────────────────────────────────────┘

Story Access Flow:
1. User wants to read premium story
2. Check if user has active subscription
   - YES → Grant immediate access
   - NO → Check if user has purchased this story
     - YES → Grant access
     - NO → Check credit balance
       - SUFFICIENT → Deduct credits, grant access
       - INSUFFICIENT → Show ad option or upgrade prompt
```

### 5.2 Revenue Sharing Model

```
Revenue Sources:
┌─────────────────────────────────────────────────────────────────────┐
│  Ad Revenue Pool         │  Subscription Revenue Pool               │
│  (From free users)       │  (From subscribers)                      │
└─────────────────────────┴───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              IMPRESSION-BASED DISTRIBUTION                           │
│                                                                      │
│  Author Revenue = (Author's Impressions / Total Impressions)         │
│                   × Revenue Pool × Revenue Share %                   │
│                                                                      │
│  Default Revenue Share: 70% to Author, 30% Platform                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Moderation Workflow

```
[Author creates story]
         │
         ▼
[Story status: DRAFT]
         │
         ▼
[Author submits for review]
         │
         ▼
[Story status: PENDING_REVIEW]
[Moderation status: PENDING]
         │
         ▼
[Moderator reviews]
         │
    ┌────┴────┬─────────────┐
    ▼         ▼             ▼
[APPROVE] [REJECT]   [REQUEST_CHANGES]
    │         │             │
    ▼         ▼             ▼
[PUBLISHED] [DRAFT]     [DRAFT]
             + notes     + notes
```

---

## 6. Recommendations System

### 6.1 Personalization Factors
- Reading history (completed stories, genres)
- Tag preferences (frequently read tags)
- Author follows
- Rating history
- Collection saves
- Similar users' behavior (collaborative filtering)

### 6.2 Algorithm Outline
```typescript
async getRecommendations(userId: string): Promise<Story[]> {
  // 1. Get user's preferences
  const preferences = await this.getUserPreferences(userId);

  // 2. Score stories based on:
  //    - Tag overlap with user's preferred tags
  //    - Author following status
  //    - Similar users' ratings (collaborative filtering)
  //    - Recency boost for new stories
  //    - Quality score (rating × completion rate)

  // 3. Filter out:
  //    - Already read stories
  //    - Stories below quality threshold
  //    - Stories not matching content preferences

  // 4. Return top N diverse recommendations
}
```

---

## 7. Mobile API Considerations

### 7.1 Mobile-Specific Endpoints
- `/api/v1/mobile/sync` - Offline reading sync
- `/api/v1/mobile/push-token` - Register push notification token
- `/api/v1/subscriptions/verify-ios` - Verify iOS App Store receipt
- `/api/v1/subscriptions/verify-android` - Verify Google Play receipt

### 7.2 Response Optimization
- Compressed responses (gzip/brotli)
- Pagination with cursor-based navigation
- Partial response fields (sparse fieldsets)
- ETags for caching

---

## 8. Removed Features

### 8.1 StoryStateVariable (REMOVED)
The `StoryStateVariable` system has been removed from the architecture. Stories will use a simpler linear/branching narrative without complex state tracking.

**Removed entities:**
- `StoryStateVariable`
- `stateEffects` on segments
- `conditions` on choices
- `requiredState` on choices
- `stateVariables` on reader progress

**Rationale:** Simplifies the reading experience and reduces complexity for both authors and readers.

---

## 9. Database Seeding Strategy

### 9.1 No Hardcoded Sample Stories
Sample/demo stories should NOT be created via hardcoded seed files. Instead:

1. **Admin creates demo stories** through the normal API workflow
2. **Migration scripts** only create schema and required system data (roles, default settings)
3. **Demo content** is imported via documented API calls or admin panel

### 9.2 Required Seed Data (Schema Only)
```sql
-- Only system-required data
INSERT INTO roles (name) VALUES ('admin'), ('moderator'), ('author'), ('reader');
INSERT INTO settings (key, value) VALUES
  ('ad_credits_per_view', '5'),
  ('daily_ad_limit', '10'),
  ('default_revenue_share', '0.70');
```

---

## 10. Migration Plan

### Phase 1: Schema Updates
1. Remove `StoryStateVariable` entity
2. Remove state-related columns from `StorySegment` and `Choice`
3. Remove `stateVariables` from `ReaderProgress`
4. Add new entities: `Collection`, `FeaturedContent`, `Subscription`, etc.

### Phase 2: API Updates
1. Remove state variable endpoints
2. Add new endpoints for collections, subscriptions, credits, ads
3. Update story/segment/choice DTOs

### Phase 3: Frontend Updates
1. Remove state variable UI from story editor
2. Add collections management
3. Add subscription/credits UI
4. Add ad watching flow

### Phase 4: Production Data
1. Create demo stories through API
2. Set up initial featured content
3. Configure ad providers
4. Set up Stripe for subscriptions

---

## 11. Appendix

### 11.1 Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aardvark

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d

# Stripe (Subscriptions)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Ad Networks
ADMOB_APP_ID=ca-app-pub-...
UNITY_ADS_GAME_ID=...

# Storage
S3_BUCKET=aardvark-media
S3_REGION=us-east-1

# Redis
REDIS_URL=redis://localhost:6379
```

### 11.2 API Response Format
```typescript
// Success response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "You need 10 credits to access this story",
    "details": {
      "required": 10,
      "balance": 5
    }
  }
}
```
