'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { getAuthToken, getSessionScope } from '@/lib/auth-token';
import type {
  User,
  UserWarning,
  UserBan,
  BanType,
  BanScope,
  IssueWarningDto,
  IssueBanDto,
  PaginatedResponse,
} from '@aardvark/shared';

/**
 * User list query parameters
 */
export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'banned' | 'suspended';
  sortBy?: 'createdAt' | 'username' | 'email';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Hook for fetching user list with pagination and filtering
 */
export function useUserList(query: UserListQuery = {}, token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['userList', query, scope],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });

      return fetchApi<PaginatedResponse<User>>(
        `/admin/users?${params}`,
        { token }
      );
    },
    enabled: !!token,
  });
}

/**
 * Hook for fetching warnings for a specific user
 */
export function useUserWarnings(userId: string, token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['userWarnings', userId, scope],
    queryFn: () =>
      fetchApi<UserWarning[]>(`/admin/users/${userId}/warnings`, {
        token,
      }),
    enabled: !!token && !!userId,
  });
}

/**
 * Hook for fetching bans for a specific user
 */
export function useUserBans(userId: string, token?: string) {
  const scope = getSessionScope();
  return useQuery({
    queryKey: ['userBans', userId, scope],
    queryFn: () =>
      fetchApi<UserBan[]>(`/admin/users/${userId}/bans`, {
        token,
      }),
    enabled: !!token && !!userId,
  });
}

/**
 * Hook for issuing user warnings
 */
export function useIssueWarning(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: IssueWarningDto) =>
      fetchApi<UserWarning>('/admin/moderation/warnings', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userWarnings', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['userList'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['moderationStats'] });
    },
  });
}

/**
 * Hook for issuing user bans
 */
export function useIssueBan(token?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: IssueBanDto) =>
      fetchApi<UserBan>('/admin/moderation/bans', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userBans', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['userList'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['moderationStats'] });
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
      fetchApi<void>(`/admin/moderation/bans/${banId}/lift`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBans'] });
      queryClient.invalidateQueries({ queryKey: ['userList'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['moderationStats'] });
    },
  });
}

/**
 * Convenience hook combining user list, search, warn, and ban actions
 * for use in the admin users page.
 */
export function useUserManagement() {
  const token = getAuthToken();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useUserList({ search }, token);
  const warnMutation = useIssueWarning(token);
  const banMutation = useIssueBan(token);

  const users = data?.items;

  const searchUsers = useCallback((query: string) => {
    setSearch(query);
  }, []);

  const warnUser = useCallback(async (userId: string, reason: string) => {
    await warnMutation.mutateAsync({ userId, reason });
  }, [warnMutation]);

  const banUser = useCallback(async (
    userId: string,
    type: BanType,
    scope: BanScope,
    reason: string,
    durationDays?: number,
  ) => {
    await banMutation.mutateAsync({ userId, type, scope, reason, durationDays });
  }, [banMutation]);

  return { users, isLoading, searchUsers, warnUser, banUser };
}
