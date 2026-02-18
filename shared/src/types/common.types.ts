/**
 * Common type definitions shared across the Aardvark Platform
 * Includes API responses, pagination, errors, and utility types
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Paginated API response — standard format for all list endpoints
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard pagination query parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string; // Only in development
  };
  timestamp: string;
}

// ============================================================================
// Error Codes
// ============================================================================

export enum ErrorCode {
  // Authentication errors (1xxx)
  UNAUTHORIZED = 'E1001',
  INVALID_CREDENTIALS = 'E1002',
  TOKEN_EXPIRED = 'E1003',
  TOKEN_INVALID = 'E1004',
  EMAIL_NOT_VERIFIED = 'E1005',
  ACCOUNT_SUSPENDED = 'E1006',
  ACCOUNT_BANNED = 'E1007',
  TWO_FACTOR_REQUIRED = 'E1008',

  // Authorization errors (2xxx)
  FORBIDDEN = 'E2001',
  INSUFFICIENT_PERMISSIONS = 'E2002',
  PREMIUM_REQUIRED = 'E2003',
  INSUFFICIENT_CREDITS = 'E2004',
  CONTENT_LOCKED = 'E2005',

  // Validation errors (3xxx)
  VALIDATION_ERROR = 'E3001',
  INVALID_INPUT = 'E3002',
  DUPLICATE_ENTRY = 'E3003',
  INVALID_FILE_TYPE = 'E3004',
  FILE_TOO_LARGE = 'E3005',

  // Resource errors (4xxx)
  NOT_FOUND = 'E4001',
  STORY_NOT_FOUND = 'E4002',
  USER_NOT_FOUND = 'E4003',
  SEGMENT_NOT_FOUND = 'E4004',
  COMMENT_NOT_FOUND = 'E4005',

  // Rate limiting (5xxx)
  RATE_LIMITED = 'E5001',
  AD_COOLDOWN = 'E5002',
  TOO_MANY_REQUESTS = 'E5003',

  // Server errors (9xxx)
  INTERNAL_ERROR = 'E9001',
  DATABASE_ERROR = 'E9002',
  EXTERNAL_SERVICE_ERROR = 'E9003',
  PAYMENT_ERROR = 'E9004',
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search result item
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  highlights: Record<string, string[]>;
}

/**
 * Search response with facets
 */
export interface SearchResponse<T> {
  results: SearchResult<T>[];
  pagination: PaginationMeta;
  facets: SearchFacets;
  query: string;
  suggestions: string[];
}

/**
 * Search facets for filtering
 */
export interface SearchFacets {
  categories: { value: string; count: number }[];
  tags: { value: string; count: number }[];
  authors: { value: string; count: number }[];
  lengths: { value: string; count: number }[];
  ratings: { min: number; max: number; avg: number };
}

/**
 * Search query parameters
 */
export interface SearchQuery extends PaginationParams {
  q: string;
  type?: 'story' | 'author' | 'all';
  filters?: Record<string, string | string[] | number | boolean>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// File Upload Types
// ============================================================================

export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export enum ImagePurpose {
  AVATAR = 'avatar',
  COVER = 'cover',
  STORY_IMAGE = 'story_image',
  COLLECTION_COVER = 'collection_cover',
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: string;
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  purpose: ImagePurpose;
  uploadedAt: Date;
}

/**
 * Image upload constraints
 */
export interface ImageConstraints {
  maxSizeBytes: number;
  allowedTypes: string[];
  dimensions: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    aspectRatio?: number;
  };
}

export const IMAGE_CONSTRAINTS: Record<ImagePurpose, ImageConstraints> = {
  [ImagePurpose.AVATAR]: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    dimensions: {
      minWidth: 100,
      maxWidth: 1000,
      minHeight: 100,
      maxHeight: 1000,
      aspectRatio: 1, // Square
    },
  },
  [ImagePurpose.COVER]: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    dimensions: {
      minWidth: 400,
      maxWidth: 2000,
      minHeight: 600,
      maxHeight: 3000,
      aspectRatio: 2 / 3, // Portrait
    },
  },
  [ImagePurpose.STORY_IMAGE]: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    dimensions: {
      minWidth: 200,
      maxWidth: 4000,
      minHeight: 200,
      maxHeight: 4000,
    },
  },
  [ImagePurpose.COLLECTION_COVER]: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    dimensions: {
      minWidth: 300,
      maxWidth: 1500,
      minHeight: 200,
      maxHeight: 1000,
      aspectRatio: 16 / 9, // Landscape
    },
  },
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties of T optional and nullable
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] | null;
};

/**
 * Extract keys of T that are strings
 */
export type StringKeys<T> = Extract<keyof T, string>;

/**
 * Timestamp fields that are automatically managed
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Soft delete fields
 */
export interface SoftDelete {
  deletedAt: Date | null;
  isDeleted: boolean;
}

/**
 * Entity with common base fields
 */
export interface BaseEntity extends Timestamps {
  id: string;
}

/**
 * Date range filter
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Geolocation coordinates
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Device information for analytics
 */
export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  screenWidth: number;
  screenHeight: number;
}

// ============================================================================
// Real-time Event Types
// ============================================================================

export enum WebSocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',

  // Story events
  STORY_UPDATED = 'story:updated',
  SEGMENT_ADDED = 'segment:added',
  BRANCH_SUBMITTED = 'branch:submitted',

  // Social events
  NEW_COMMENT = 'comment:new',
  NEW_FOLLOWER = 'follower:new',
  NEW_MESSAGE = 'message:new',
  NEW_NOTIFICATION = 'notification:new',

  // Reading events
  READER_JOINED = 'reader:joined',
  READER_LEFT = 'reader:left',

  // System events
  MAINTENANCE = 'system:maintenance',
  ANNOUNCEMENT = 'system:announcement',
}

/**
 * WebSocket message format
 */
export interface WebSocketMessage<T = unknown> {
  event: WebSocketEvent;
  data: T;
  timestamp: string;
  userId?: string;
}

// ============================================================================
// Feature Flags
// ============================================================================

export interface FeatureFlags {
  nsfwContent: boolean;
  aiCompanion: boolean;
  forumEnabled: boolean;
  messagingEnabled: boolean;
  premiumSubscriptions: boolean;
  creditPurchases: boolean;
  adRewards: boolean;
  branchContributions: boolean;
  socialSharing: boolean;
  pushNotifications: boolean;
  darkMode: boolean;
  offlineReading: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  nsfwContent: false, // SFW only for MVP
  aiCompanion: true,
  forumEnabled: true,
  messagingEnabled: true,
  premiumSubscriptions: true,
  creditPurchases: true,
  adRewards: true,
  branchContributions: true,
  socialSharing: true,
  pushNotifications: true,
  darkMode: true,
  offlineReading: true,
};
