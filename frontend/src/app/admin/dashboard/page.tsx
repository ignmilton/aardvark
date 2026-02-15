'use client';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminStatsCard } from '@/components/admin/admin-stats-card';
import { useAdminAnalytics } from '@/hooks/use-admin-analytics';
import {
  Users,
  BookOpen,
  Flag,
  TrendingUp,
  DollarSign,
  Eye,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { stats, isLoading } = useAdminAnalytics();

  return (
    <AdminLayout
      title="Dashboard"
      description="Platform overview and key metrics"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AdminStatsCard
          title="Total Users"
          value={isLoading ? '...' : stats?.totalUsers ?? 0}
          icon={Users}
          description="Registered users"
        />
        <AdminStatsCard
          title="Published Stories"
          value={isLoading ? '...' : stats?.totalStories ?? 0}
          icon={BookOpen}
          description="Active stories on platform"
        />
        <AdminStatsCard
          title="Pending Reports"
          value={isLoading ? '...' : stats?.pendingReports ?? 0}
          icon={Flag}
          variant="warning"
          description="Awaiting moderation"
        />
        <AdminStatsCard
          title="Total Views"
          value={isLoading ? '...' : stats?.totalViews ?? 0}
          icon={Eye}
          description="All-time story views"
        />
        <AdminStatsCard
          title="Active Authors"
          value={isLoading ? '...' : stats?.activeAuthors ?? 0}
          icon={TrendingUp}
          description="Authors with published stories"
        />
        <AdminStatsCard
          title="Revenue"
          value={isLoading ? '...' : `$${stats?.totalRevenue ?? 0}`}
          icon={DollarSign}
          variant="success"
          description="Total platform revenue"
        />
      </div>
    </AdminLayout>
  );
}
