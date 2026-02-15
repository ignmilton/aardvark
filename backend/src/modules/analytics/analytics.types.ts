/**
 * Response types for analytics module
 */

/**
 * Author dashboard summary data
 */
export interface AuthorDashboard {
  totalReads: number;
  uniqueReaders: number;
  totalEarnings: number;
  avgRating: number;
  totalStories: number;
  publishedStories: number;
  totalComments: number;
  totalRatings: number;
  topStories: TopStory[];
  recentActivity: RecentActivity[];
  earningsTrend: {
    current: number;
    previous: number;
    percentChange: number;
  };
  readersTrend: {
    current: number;
    previous: number;
    percentChange: number;
  };
}

/**
 * Top performing story summary
 */
export interface TopStory {
  id: string;
  title: string;
  viewCount: number;
  uniqueReaders: number;
  averageRating: number;
  completionRate: number;
  earnings: number;
}

/**
 * Recent activity item
 */
export interface RecentActivity {
  type: "read" | "comment" | "rating" | "earning";
  storyId: string;
  storyTitle: string;
  userId?: string;
  username?: string;
  content?: string;
  rating?: number;
  amount?: number;
  timestamp: Date;
}

/**
 * Detailed story analytics
 */
export interface StoryAnalytics {
  storyId: string;
  title: string;
  views: number;
  uniqueReaders: number;
  completionRate: number;
  avgReadTime: number;
  avgRating: number;
  totalRatings: number;
  totalComments: number;
  totalEarnings: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  branchHeatmap: BranchHeatmap[];
  engagementByDay: EngagementPoint[];
  topSegments: SegmentStat[];
}

/**
 * Branch/choice popularity data
 */
export interface BranchHeatmap {
  segmentId: string;
  segmentTitle: string | null;
  choiceId: string;
  choiceText: string;
  nextSegmentId: string | null;
  timesSelected: number;
  percentage: number;
}

/**
 * Segment-level statistics
 */
export interface SegmentStat {
  segmentId: string;
  title: string | null;
  readCount: number;
  avgTimeSpent: number;
  dropoffRate: number;
}

/**
 * Engagement data point for trends
 */
export interface EngagementPoint {
  date: string;
  reads: number;
  uniqueReaders: number;
  completions: number;
  comments: number;
  ratings: number;
  earnings: number;
}

/**
 * Reader engagement statistics
 */
export interface ReaderStats {
  totalReaders: number;
  activeReaders: number;
  newReaders: number;
  returningReaders: number;
  avgSessionDuration: number;
  avgStoriesPerReader: number;
  retentionRate: number;
  engagementByDay: EngagementPoint[];
}

/**
 * Earnings breakdown
 */
export interface EarningsBreakdown {
  totalGross: number;
  totalFees: number;
  totalNet: number;
  byStory: StoryEarnings[];
  byType: TypeEarnings[];
  byPeriod: PeriodEarnings[];
}

/**
 * Earnings per story
 */
export interface StoryEarnings {
  storyId: string;
  storyTitle: string;
  gross: number;
  fees: number;
  net: number;
  transactionCount: number;
}

/**
 * Earnings by type
 */
export interface TypeEarnings {
  type: string;
  gross: number;
  fees: number;
  net: number;
  count: number;
}

/**
 * Earnings by time period
 */
export interface PeriodEarnings {
  period: string;
  gross: number;
  fees: number;
  net: number;
  count: number;
}

/**
 * Branch popularity data
 */
export interface BranchPopularity {
  segmentId: string;
  segmentTitle: string | null;
  totalReads: number;
  branches: BranchChoice[];
}

/**
 * Individual branch choice data
 */
export interface BranchChoice {
  choiceId: string;
  choiceText: string;
  nextSegmentId: string | null;
  timesSelected: number;
  percentage: number;
}

/**
 * Completion funnel data showing reader drop-off
 */
export interface CompletionFunnel {
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
  segments: FunnelSegment[];
  avgSegmentsRead: number;
  dropoffPoints: DropoffPoint[];
}

/**
 * Funnel segment data
 */
export interface FunnelSegment {
  segmentId: string;
  title: string | null;
  order: number;
  readCount: number;
  retentionRate: number;
  avgTimeSpent: number;
}

/**
 * Drop-off point identification
 */
export interface DropoffPoint {
  segmentId: string;
  title: string | null;
  dropoffCount: number;
  dropoffRate: number;
}

/**
 * Reader demographics data
 */
export interface ReaderDemographics {
  totalReaders: number;
  byTimeZone: TimeZoneData[];
  byReadingTime: ReadingTimeData[];
  avgSessionsByTime: SessionTimeData[];
  peakReadingHours: number[];
}

/**
 * Time zone distribution
 */
export interface TimeZoneData {
  timezone: string;
  count: number;
  percentage: number;
}

/**
 * Reading time distribution
 */
export interface ReadingTimeData {
  hour: number;
  count: number;
  percentage: number;
}

/**
 * Session data by time
 */
export interface SessionTimeData {
  hour: number;
  avgSessions: number;
  avgDuration: number;
}

/**
 * Engagement trends over time
 */
export interface EngagementTrends {
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  data: EngagementPoint[];
  summary: {
    totalReads: number;
    avgDailyReads: number;
    peakDay: string;
    peakReads: number;
    totalEarnings: number;
    avgDailyEarnings: number;
  };
}

/**
 * Export format type
 */
export type ExportFormatType = "csv" | "json";

/**
 * Export result
 */
export interface ExportResult {
  format: ExportFormatType;
  data: string;
  filename: string;
  contentType: string;
}
