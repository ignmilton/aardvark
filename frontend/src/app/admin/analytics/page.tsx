'use client';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminStatsCard } from '@/components/admin/admin-stats-card';
import { useAdminAnalytics } from '@/hooks/use-admin-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  BookOpen,
  TrendingUp,
  DollarSign,
  BarChart3,
  Activity,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const { stats, trends, isLoading } = useAdminAnalytics();

  return (
    <AdminLayout
      title="Analytics"
      description="Platform-wide statistics and trends"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminStatsCard
          title="Daily Active Users"
          value={isLoading ? '...' : stats?.dailyActiveUsers ?? 0}
          icon={Users}
          trend={trends?.dailyActiveUsers}
        />
        <AdminStatsCard
          title="New Stories (7d)"
          value={isLoading ? '...' : stats?.newStories7d ?? 0}
          icon={BookOpen}
          trend={trends?.newStories}
        />
        <AdminStatsCard
          title="Engagement Rate"
          value={isLoading ? '...' : `${stats?.engagementRate ?? 0}%`}
          icon={Activity}
          trend={trends?.engagement}
        />
        <AdminStatsCard
          title="Revenue (30d)"
          value={isLoading ? '...' : `$${stats?.revenue30d ?? 0}`}
          icon={DollarSign}
          variant="success"
          trend={trends?.revenue}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Stories This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : stats?.topStories?.length === 0 ? (
              <p className="text-muted-foreground">No data available</p>
            ) : (
              <ul className="space-y-3">
                {stats?.topStories?.map((story: { id: string; title: string; views: number }, i: number) => (
                  <li key={story.id} className="flex items-center justify-between">
                    <span className="text-sm">
                      <span className="font-medium text-muted-foreground mr-2">{i + 1}.</span>
                      {story.title}
                    </span>
                    <span className="text-sm text-muted-foreground">{story.views} views</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total Users</span>
                  <span className="font-medium">{stats?.totalUsers ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Authors</span>
                  <span className="font-medium">{stats?.activeAuthors ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Premium Subscribers</span>
                  <span className="font-medium">{stats?.premiumUsers ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>New Users (7d)</span>
                  <span className="font-medium">{stats?.newUsers7d ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
