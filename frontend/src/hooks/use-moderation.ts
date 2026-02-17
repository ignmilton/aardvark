'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { getAuthToken, getSessionScope } from '@/lib/auth-token';
import type {
  ModerationAction,
  ModerationQueueItem,
  ModerationQueueQuery,
  ModerationStats,
  ResolveModerationDto,
  PaginatedResponse,
  PlatformHealthMetrics,
} from '@aardvark/shared';

/**
 * Hook for fetching moderation queue
 */
export function useModerationQueue(query: ModerationQueueQuery, token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['moderationQueue', query, scope],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });

      return fetchApi<PaginatedResponse<ModerationQueueItem>>(
        `/admin/moderation/queue?${params}`,
        { token }
      );
    },
    enabled: !!token,
  });
}

/**
 * Hook for resolving moderation reports
 */
export function useResolveReport(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      data,
    }: {
      reportId: string;
      data: ResolveModerationDto;
    }) =>
      fetchApi<void>(`/admin/moderation/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderationQueue'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderationStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

/**
 * Hook for assigning moderation reports to moderators
 */
export function useAssignReport(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) =>
      fetchApi<void>(`/admin/moderation/reports/${reportId}/assign`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderationQueue'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

/**
 * Hook for fetching moderation statistics
 */
export function useModerationStats(token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['moderationStats', scope],
    queryFn: () =>
      fetchApi<ModerationStats>('/admin/moderation/stats', { token }),
    enabled: !!token,
    refetchInterval: 60000, // Refetch every minute
  });
}

// Aliases for backward compatibility with admin pages
export const useAssignModeration = useAssignReport;
export const useResolveModeration = useResolveReport;

/**
 * Hook for fetching admin stats (moderation + health)
 */
export function useAdminStats(token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['adminStats', scope],
    queryFn: () =>
      fetchApi<{
        moderation: ModerationStats;
        health: PlatformHealthMetrics;
      }>('/admin/stats', { token }),
    enabled: !!token,
    refetchInterval: 60000,
  });
}

/**
 * Hook for fetching user bans
 */
export function useUserBans(
  query: string | { page?: number; limit?: number; isActive?: boolean } | undefined,
  token?: string,
) {
  const scope = getSessionScope();
  const isUserIdQuery = typeof query === 'string';
  const queryKey = isUserIdQuery ? ['userBans', query, scope] : ['userBans', 'admin', query, scope];
  const endpoint = isUserIdQuery
    ? `/admin/users/${query}/bans`
    : `/admin/bans?${new URLSearchParams(
        Object.entries(query || {}).reduce((acc, [k, v]) => {
          if (v !== undefined) acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>),
      )}`;

  return useQuery({
    queryKey,
    queryFn: () =>
      fetchApi<{ items: any[]; total: number }>(endpoint, { token }),
    enabled: !!token && !!query,
  });
}

/**
 * Hook for fetching user warnings
 */
export function useUserWarnings(userId: string | undefined, token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['userWarnings', userId, scope],
    queryFn: () =>
      fetchApi<any[]>(`/admin/users/${userId}/warnings`, { token }),
    enabled: !!token && !!userId,
  });
}

/**
 * Hook for issuing a ban
 */
export function useIssueBan(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) =>
      fetchApi<void>(`/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBans'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

/**
 * Hook for issuing a warning
 */
export function useIssueWarning(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) =>
      fetchApi<void>(`/admin/users/${userId}/warn`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userWarnings'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

/**
 * Hook for lifting a ban
 */
export function useLiftBan(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (banId: string) =>
      fetchApi<void>(`/admin/bans/${banId}/lift`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBans'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

/**
 * Convenience hook combining moderation queue, reports, and actions
 * for use in admin moderation and reports pages.
 */
export function useModeration() {
  const token = getAuthToken();
  const { data: queueData, isLoading } = useModerationQueue({}, token);
  const resolveReportMutation = useResolveReport(token);

  const queue = queueData?.items;
  const reports = queueData?.items;

  const resolveReport = async (reportId: string, action: ModerationAction, reason: string) => {
    await resolveReportMutation.mutateAsync({ reportId, data: { action, reason } });
  };

  const resolveItem = resolveReport;

  return { queue, reports, isLoading, resolveReport, resolveItem };
}
