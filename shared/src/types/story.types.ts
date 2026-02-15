/**
 * Story and branching narrative type definitions for the Aardvark Platform
 * Supports complex branching and collaborative writing
 */

/**
 * Story categories for organization and discovery
 */
export enum StoryCategory {
  FANTASY = 'fantasy',
  SCI_FI = 'sci_fi',
  ROMANCE = 'romance',
  MYSTERY = 'mystery',
  THRILLER = 'thriller',
  HORROR = 'horror',
  ADVENTURE = 'adventure',
  HISTORICAL = 'historical',
  COMEDY = 'comedy',
  DRAMA = 'drama',
  SLICE_OF_LIFE = 'slice_of_life',
  SUPERHERO = 'superhero',
  DYSTOPIAN = 'dystopian',
  URBAN_FANTASY = 'urban_fantasy',
  STEAMPUNK = 'steampunk',
  OTHER = 'other',
}

/**
 * Story collaboration modes determining who can contribute
 */
export enum CollaborationMode {
  /** Only the original author can write branches */
  PRIVATE = 'private',
  /** Other users can submit branches for author approval */
  MODERATED = 'moderated',
  /** Community can freely add branches (still subject to platform moderation) */
  OPEN = 'open',
}

/**
 * Story publication status
 */
export enum StoryStatus {
  /** Work in progress, not visible to others */
  DRAFT = 'draft',
  /** Submitted for moderation review before publishing */
  PENDING_REVIEW = 'pending_review',
  /** Published and visible to readers */
  PUBLISHED = 'published',
  /** Temporarily hidden by author */
  HIDDEN = 'hidden',
  /** Removed by moderation */
  REMOVED = 'removed',
  /** Story is complete and no longer updated */
  COMPLETED = 'completed',
}

/**
 * Content warning tags for mature themes
 */
export enum ContentWarning {
  VIOLENCE = 'violence',
  GORE = 'gore',
  DEATH = 'death',
  STRONG_LANGUAGE = 'strong_language',
  SUBSTANCE_USE = 'substance_use',
  MENTAL_HEALTH = 'mental_health',
  DARK_THEMES = 'dark_themes',
  SENSITIVE_TOPICS = 'sensitive_topics',
}

/**
 * Story length classification
 */
export enum StoryLength {
  SHORT = 'short', // < 10 segments
  MEDIUM = 'medium', // 10-50 segments
  LONG = 'long', // 50-200 segments
  EPIC = 'epic', // 200+ segments
}

/**
 * Story complexity rating based on branching structure
 */
export enum StoryComplexity {
  LINEAR = 'linear', // Few choices, mostly linear path
  SIMPLE = 'simple', // Some branching, converges often
  MODERATE = 'moderate', // Multiple paths with meaningful divergence
  COMPLEX = 'complex', // Heavy branching
  INTRICATE = 'intricate', // Deep branching
}

/**
 * Core story entity
 */
export interface Story {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  description: string;
  synopsis: string; // Longer description for story page
  coverImageUrl: string | null;
  category: StoryCategory;
  tags: string[];
  contentWarnings: ContentWarning[];
  collaborationMode: CollaborationMode;
  status: StoryStatus;
  isPremium: boolean;
  creditCost: number; // 0 for free stories, 10-50 for premium
  nsfwFlag: boolean; // Future-ready, currently always false
  language: string; // ISO 639-1 code
  estimatedReadTime: number; // Minutes
  length: StoryLength;
  complexity: StoryComplexity;
  rootSegmentId: string | null; // Entry point of the story
  currentVersion: number;
  viewCount: number;
  uniqueReaders: number;
  averageRating: number;
  ratingsCount: number;
  completionRate: number; // Percentage of readers reaching an ending
  featuredAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Story segment (a single node/chapter in the branching narrative)
 */
export interface StorySegment {
  id: string;
  storyId: string;
  authorId: string; // May differ from story author in collaborative stories
  title: string | null; // Optional chapter title
  content: string; // Main narrative content (HTML from rich text editor)
  contentMarkdown: string; // Markdown source for editing

  // Visual editor positioning
  position: {
    x: number;
    y: number;
  };

  // Segment relationships
  parentSegmentIds: string[]; // Segments that can lead to this one
  isRootSegment: boolean; // Entry point of the story
  isEnding: boolean; // Marks this as a conclusion point
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;

  // Metadata
  wordCount: number;
  estimatedReadTime: number; // Seconds
  readCount: number;

  // Version control
  version: number;
  previousVersionId: string | null;

  // Collaboration
  submittedByUserId: string | null; // For moderated/open stories
  approvedByUserId: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected' | null;
  rejectionReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Choice connecting one segment to another
 */
export interface Choice {
  id: string;
  segmentId: string; // Source segment
  nextSegmentId: string; // Destination segment
  choiceText: string; // Text displayed to reader
  order: number; // Display order (1-10)

  // Statistics
  timesChosen: number;

  isHidden: boolean; // Author can hide choices temporarily
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reader's progress through a story
 */
export interface ReaderProgress {
  id: string;
  userId: string;
  storyId: string;
  currentSegmentId: string;

  // All segments the reader has visited
  visitedSegmentIds: string[];

  // All choices the reader has made
  choiceHistory: {
    segmentId: string;
    choiceId: string;
    timestamp: Date;
  }[];

  // Reading statistics
  startedAt: Date;
  lastReadAt: Date;
  totalReadTime: number; // Seconds
  isCompleted: boolean;
  completedAt: Date | null;
  reachedEndingId: string | null;

  // Bookmarks within the story
  bookmarks: {
    segmentId: string;
    note: string;
    createdAt: Date;
  }[];
}

/**
 * Story version for history tracking
 */
export interface StoryVersion {
  id: string;
  storyId: string;
  version: number;
  changeDescription: string;
  changedByUserId: string;
  segmentSnapshot: Record<string, StorySegment>; // Full state at this version
  createdAt: Date;
}

/**
 * Branch submission for collaborative stories
 */
export interface BranchSubmission {
  id: string;
  storyId: string;
  parentSegmentId: string;
  submittedByUserId: string;
  segment: Partial<StorySegment>;
  choices: Partial<Choice>[];
  submissionNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  reviewedByUserId: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

/**
 * Story analytics data
 */
export interface StoryAnalytics {
  storyId: string;
  period: 'day' | 'week' | 'month' | 'all_time';
  startDate: Date;
  endDate: Date;

  // Traffic metrics
  views: number;
  uniqueReaders: number;
  newReaders: number;
  returningReaders: number;

  // Engagement metrics
  averageReadTime: number;
  completionRate: number;
  bounceRate: number;

  // Branch analytics
  branchHeatmap: {
    segmentId: string;
    visits: number;
    averageTimeSpent: number;
  }[];

  choiceDistribution: {
    choiceId: string;
    segmentId: string;
    choiceText: string;
    percentage: number;
    totalChosen: number;
  }[];

  // Ending statistics
  endingDistribution: {
    segmentId: string;
    endingType: string;
    reachedCount: number;
    percentage: number;
  }[];

  // Demographics
  readersByCountry: Record<string, number>;
  readersByDevice: Record<string, number>;
}

// ============================================================================
// DTOs for API Communication
// ============================================================================

export interface CreateStoryDto {
  title: string;
  description: string;
  synopsis?: string;
  category: StoryCategory;
  tags?: string[];
  contentWarnings?: ContentWarning[];
  collaborationMode?: CollaborationMode;
  isPremium?: boolean;
  creditCost?: number;
  language?: string;
}

export interface UpdateStoryDto {
  title?: string;
  description?: string;
  synopsis?: string;
  coverImageUrl?: string;
  category?: StoryCategory;
  tags?: string[];
  contentWarnings?: ContentWarning[];
  collaborationMode?: CollaborationMode;
  status?: StoryStatus;
  isPremium?: boolean;
  creditCost?: number;
}

export interface CreateSegmentDto {
  storyId: string;
  parentSegmentId?: string; // If null, this is the root segment
  title?: string;
  content: string;
  contentMarkdown?: string;
  position?: { x: number; y: number };
  isEnding?: boolean;
  endingType?: 'good' | 'bad' | 'neutral' | 'secret';
}

export interface UpdateSegmentDto {
  title?: string;
  content?: string;
  contentMarkdown?: string;
  position?: { x: number; y: number };
  isEnding?: boolean;
  endingType?: 'good' | 'bad' | 'neutral' | 'secret' | null;
}

export interface CreateChoiceDto {
  segmentId: string;
  nextSegmentId: string;
  choiceText: string;
  order?: number;
}

export interface UpdateChoiceDto {
  choiceText?: string;
  nextSegmentId?: string;
  order?: number;
  isHidden?: boolean;
}

export interface SubmitBranchDto {
  storyId: string;
  parentSegmentId: string;
  segment: CreateSegmentDto;
  choices: CreateChoiceDto[];
  submissionNote: string;
}

export interface ReviewBranchDto {
  status: 'approved' | 'rejected' | 'revision_requested';
  reviewNote?: string;
}

/**
 * Query parameters for story listing
 */
export interface StoryQueryParams {
  page?: number;
  limit?: number;
  category?: StoryCategory | StoryCategory[];
  tags?: string[];
  status?: StoryStatus;
  collaborationMode?: CollaborationMode;
  isPremium?: boolean;
  authorId?: string;
  minRating?: number;
  length?: StoryLength;
  complexity?: StoryComplexity;
  language?: string;
  search?: string;
  sortBy?: 'created' | 'updated' | 'rating' | 'views' | 'trending';
  sortOrder?: 'asc' | 'desc';
  excludeWarnings?: ContentWarning[];
}
