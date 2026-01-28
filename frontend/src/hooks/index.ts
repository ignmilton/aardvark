/**
 * Admin Hooks
 * Central export point for all admin-related hooks
 */

// Moderation hooks
export {
  useModerationQueue,
  useResolveReport,
  useAssignReport,
  useModerationStats,
} from './use-moderation';

// Admin analytics hooks
export {
  useAdminStats,
  usePlatformAnalytics,
  type PlatformAnalytics,
} from './use-admin-analytics';

// User management hooks
export {
  useUserList,
  useUserWarnings,
  useUserBans,
  useIssueWarning,
  useIssueBan,
  useLiftBan,
  type UserListQuery,
} from './use-user-management';

// Mobile gesture hooks
export { useSwipeGestures } from './use-swipe-gestures';
export { usePullToRefresh } from './use-pull-to-refresh';

// PWA hooks
export { usePWAInstall } from './use-pwa-install';
export { usePushNotifications } from './use-push-notifications';
export { useOfflineReading } from './use-offline-reading';

// Utility hooks
export { useKeyboardNav } from './use-keyboard-nav';
