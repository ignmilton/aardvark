'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  FileText,
  Flag,
  TrendingUp,
  Activity,
  Shield,
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminStatsCard } from '@/components/admin/admin-stats-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminStats, usePlatformAnalytics } from '@/hooks/use-admin-analytics';
import { formatCompactNumber } from '@/lib/utils';

/**
 * Admin Dashboard - Main overview page
 * Displays platform statistics, health metrics, and recent activity
 */
export default function AdminDashboard() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;

  const { data: stats } = useAdminStats(token);
  const { data: analytics } = usePlatformAnalytics(selectedPeriod, token);

  // Calculate trend percentages (mock for now)
  const getTrendValue = (current: number, previous: number) => {
    if (!previous) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <AdminSidebar
        pendingReports={stats?.moderation.pendingReports || 0}
        pendingQueue={stats?.moderation.pendingReports || 0}
      />

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Platform overview and health metrics
            </p>
          </div>

          {/* Period Selector */}
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="day">Today</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Platform Health Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <AdminStatsCard
              title="Active Users"
              value={formatCompactNumber(stats?.health.activeUsers24h || 0)}
              description="Last 24 hours"
              icon={Users}
              trend={{
                value: getTrendValue(
                  stats?.health.activeUsers24h || 0,
                  analytics?.users.active24h || 0
                ),
                label: 'from yesterday',
              }}
            />
            <AdminStatsCard
              title="New Users"
              value={formatCompactNumber(stats?.health.newUsersToday || 0)}
              description="Registered today"
              icon={TrendingUp}
              variant="success"
              trend={{
                value: getTrendValue(
                  stats?.health.newUsersToday || 0,
                  analytics?.users.newToday || 0
                ),
                label: 'from yesterday',
              }}
            />
            <AdminStatsCard
              title="Stories Published"
              value={formatCompactNumber(stats?.health.storiesPublishedToday || 0)}
              description="New stories today"
              icon={FileText}
              trend={{
                value: getTrendValue(
                  stats?.health.storiesPublishedToday || 0,
                  analytics?.content.storiesPublishedToday || 0
                ),
                label: 'from yesterday',
              }}
            />
            <AdminStatsCard
              title="Pending Reports"
              value={stats?.moderation.pendingReports || 0}
              description="Awaiting review"
              icon={Flag}
              variant={
                (stats?.moderation.pendingReports || 0) > 50
                  ? 'danger'
                  : (stats?.moderation.pendingReports || 0) > 20
                  ? 'warning'
                  : 'default'
              }
            />
          </div>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health
              </CardTitle>
              <CardDescription>Real-time platform performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Uptime</span>
                    <Badge variant="success">
                      {((stats?.health.uptime || 0) * 100).toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(stats?.health.uptime || 0) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Error Rate</span>
                    <Badge
                      variant={
                        (stats?.health.errorRate || 0) > 5
                          ? 'destructive'
                          : (stats?.health.errorRate || 0) > 2
                          ? 'warning'
                          : 'success'
                      }
                    >
                      {((stats?.health.errorRate || 0) * 100).toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        (stats?.health.errorRate || 0) > 5
                          ? 'bg-red-500'
                          : (stats?.health.errorRate || 0) > 2
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((stats?.health.errorRate || 0) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Response Time</span>
                    <Badge variant="secondary">
                      {stats?.health.averageResponseTime || 0}ms
                    </Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${Math.min(
                          ((stats?.health.averageResponseTime || 0) / 1000) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Moderation Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Moderation Stats
                </CardTitle>
                <CardDescription>
                  {selectedPeriod === 'day'
                    ? 'Today'
                    : selectedPeriod === 'week'
                    ? 'This week'
                    : 'This month'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Reports</span>
                    <span className="font-medium">
                      {stats?.moderation.totalReports || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pending</span>
                    <Badge variant="warning">
                      {stats?.moderation.pendingReports || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Resolved</span>
                    <Badge variant="success">
                      {stats?.moderation.resolvedReports || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Resolution Time</span>
                    <span className="font-medium">
                      {stats?.moderation.averageResolutionTime || 0} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Moderators</span>
                    <span className="font-medium">
                      {stats?.moderation.activeModeratorCount || 0}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => router.push('/admin/moderation-queue')}
                >
                  View Moderation Queue
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Report Breakdown</CardTitle>
                <CardDescription>By reason and content type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Top Report Reasons</h4>
                    <div className="space-y-2">
                      {stats?.moderation.reportsByReason &&
                        Object.entries(stats.moderation.reportsByReason)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([reason, count]) => (
                            <div
                              key={reason}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-muted-foreground capitalize">
                                {reason.replace(/_/g, ' ')}
                              </span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium mb-2">By Content Type</h4>
                    <div className="space-y-2">
                      {stats?.moderation.reportsByContentType &&
                        Object.entries(stats.moderation.reportsByContentType)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([type, count]) => (
                            <div
                              key={type}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-muted-foreground capitalize">
                                {type.replace(/_/g, ' ')}
                              </span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Content Overview</CardTitle>
              <CardDescription>Platform content statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Stories</p>
                  <p className="text-2xl font-bold">
                    {formatCompactNumber(analytics?.content.totalStories || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Segments</p>
                  <p className="text-2xl font-bold">
                    {formatCompactNumber(analytics?.content.totalSegments || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Comments</p>
                  <p className="text-2xl font-bold">
                    {formatCompactNumber(analytics?.content.totalComments || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Comments Today</p>
                  <p className="text-2xl font-bold">
                    {formatCompactNumber(analytics?.content.commentsToday || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => router.push('/admin/moderation-queue')}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Review Reports
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => router.push('/admin/users')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => router.push('/admin/analytics')}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
