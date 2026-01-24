/**
 * Social features type definitions for the Aardvark Platform
 * Includes comments, ratings, reviews, messaging, and forums
 */

// ============================================================================
// Comments System
// ============================================================================

/**
 * Comment entity for threaded discussions on stories
 */
export interface Comment {
  id: string;
  userId: string;
  storyId: string;
  segmentId: string | null; // Null for story-level comments
  parentCommentId: string | null; // For threading
  content: string;
  contentHtml: string; // Rendered HTML with sanitization
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  isDeleted: boolean; // Soft delete for threading preservation
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Like on a comment
 */
export interface CommentLike {
  id: string;
  userId: string;
  commentId: string;
  createdAt: Date;
}

// ============================================================================
// Ratings & Reviews
// ============================================================================

/**
 * Rating and optional review for a story
 */
export interface Rating {
  id: string;
  userId: string;
  storyId: string;
  rating: number; // 0.5 to 5.0 in 0.5 increments
  reviewTitle: string | null;
  reviewText: string | null;
  reviewHtml: string | null;
  helpfulCount: number; // Users who found this review helpful
  isVerifiedReader: boolean; // User has completed at least 50% of story
  isEdited: boolean;
  isFeatured: boolean; // Highlighted by author or admin
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Record of users marking reviews as helpful
 */
export interface ReviewHelpful {
  id: string;
  userId: string;
  ratingId: string;
  createdAt: Date;
}

// ============================================================================
// Collections & Favorites
// ============================================================================

/**
 * User-created collection of stories
 */
export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublic: boolean;
  storiesCount: number;
  followersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Story membership in a collection
 */
export interface CollectionStory {
  id: string;
  collectionId: string;
  storyId: string;
  note: string | null; // User's note about why they added it
  order: number;
  addedAt: Date;
}

/**
 * Users following a collection
 */
export interface CollectionFollow {
  id: string;
  userId: string;
  collectionId: string;
  createdAt: Date;
}

// ============================================================================
// Notifications System
// ============================================================================

export enum NotificationType {
  // Story notifications
  NEW_CHAPTER = 'new_chapter',
  STORY_COMPLETED = 'story_completed',
  STORY_FEATURED = 'story_featured',

  // Social notifications
  NEW_FOLLOWER = 'new_follower',
  COMMENT_REPLY = 'comment_reply',
  COMMENT_LIKE = 'comment_like',
  NEW_REVIEW = 'new_review',
  REVIEW_HELPFUL = 'review_helpful',

  // Author notifications
  BRANCH_SUBMITTED = 'branch_submitted',
  BRANCH_APPROVED = 'branch_approved',
  BRANCH_REJECTED = 'branch_rejected',

  // Moderation notifications
  CONTENT_FLAGGED = 'content_flagged',
  CONTENT_REMOVED = 'content_removed',
  WARNING_ISSUED = 'warning_issued',
  ACCOUNT_SUSPENDED = 'account_suspended',

  // Credits & earnings
  CREDITS_EARNED = 'credits_earned',
  PAYOUT_PROCESSED = 'payout_processed',

  // System
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
}

/**
 * Notification entity
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>; // Type-specific data
  linkUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// ============================================================================
// DTOs
// ============================================================================

export interface CreateCommentDto {
  storyId: string;
  segmentId?: string;
  parentCommentId?: string;
  content: string;
}

export interface UpdateCommentDto {
  content: string;
}

export interface CreateRatingDto {
  storyId: string;
  rating: number;
  reviewTitle?: string;
  reviewText?: string;
}

export interface UpdateRatingDto {
  rating?: number;
  reviewTitle?: string;
  reviewText?: string;
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
}

export interface AddToCollectionDto {
  storyId: string;
  note?: string;
}

