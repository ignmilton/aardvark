'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type {
  ModerationStats,
  PlatformHealthMetrics,
} from '@aardvark/shared';

/**
 * Platform analytics data structure
 */
export interface PlatformAnalytics {
  users: {
    total: number;
    active24h: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    byRole: Record<string, number>;
  };
  content: {
    totalStories: number;
    storiesPublishedToday: number;
    storiesPublishedThisWeek: number;
    storiesPublishedThisMonth: number;
    totalSegments: number;
    totalComments: number;
    commentsToday: number;
  };
  engagement: {
    totalReads: number;
    readsToday: number;
    averageReadTime: number;
    completionRate: number;
    ratingsCount: number;
    averageRating: number;
  };
  revenue: {
    totalRevenue: number;
    revenueToday: number;
    revenueThisWeek: number;
    revenueThisMonth: number;
    creditsPurchased: number;
    creditsSpent: number;
    activeSubscriptions: number;
  };
  system: {
    errorRate: number;
    averageResponseTime: number;
    uptime: number;
    activeConnections: number;
  };
}

/**
 * Hook for fetching admin dashboard stats
 */
export function useAdminStats(token?: string) {
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: () =>
      fetchApi<{
        moderation: ModerationStats;
        health: PlatformHealthMetrics;
      }>('/admin/stats', { token }),
    enabled: !!token,
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook for fetching comprehensive platform analytics
 */
export function usePlatformAnalytics(
  period: 'day' | 'week' | 'month' | 'year' = 'day',
  token?: string
) {
  return useQuery({
    queryKey: ['platformAnalytics', period],
    queryFn: () =>
      fetchApi<PlatformAnalytics>(`/admin/analytics?period=${period}`, {
        token,
      }),
    enabled: !!token,
  });
}

/**
 * Convenience hook combining platform analytics and admin stats
 * for use in admin dashboard and analytics pages.
 */
export function useAdminAnalytics() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;
  const { data: analytics, isLoading: analyticsLoading } = usePlatformAnalytics('week', token);
  const { data: adminStats, isLoading: statsLoading } = useAdminStats(token);

  const isLoading = analyticsLoading || statsLoading;

  const stats = analytics ? {
    dailyActiveUsers: analytics.users.active24h,
    newStories7d: analytics.content.storiesPublishedThisWeek,
    engagementRate: analytics.engagement.completionRate,
    revenue30d: analytics.revenue.revenueThisMonth,
    topStories: [] as { id: string; title: string; views: number }[],
    totalUsers: analytics.users.total,
    activeAuthors: analytics.users.byRole?.author ?? 0,
    premiumUsers: analytics.revenue.activeSubscriptions,
    newUsers7d: analytics.users.newThisWeek,
    totalStories: analytics.content.totalStories,
    pendingReports: adminStats?.moderation.pendingReports ?? 0,
    totalViews: analytics.engagement.totalReads,
    totalRevenue: analytics.revenue.totalRevenue,
  } : undefined;

  const trends = analytics ? {
    dailyActiveUsers: undefined as { value: number; label: string } | undefined,
    newStories: undefined as { value: number; label: string } | undefined,
    engagement: undefined as { value: number; label: string } | undefined,
    revenue: undefined as { value: number; label: string } | undefined,
  } : undefined;

  return { stats, trends, isLoading };
}
