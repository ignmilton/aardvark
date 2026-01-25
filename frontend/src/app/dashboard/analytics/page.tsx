'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';

interface AnalyticsData {
  overview: {
    totalStories: number;
    totalViews: number;
    totalRatings: number;
    averageRating: number;
    totalEarnings: number;
    followersCount: number;
  };
  recentViews: { date: string; views: number }[];
  topStories: {
    id: string;
    title: string;
    slug: string;
    viewCount: number;
    averageRating: number;
    ratingsCount: number;
  }[];
  ratingDistribution: { rating: number; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const token = localStorage.getItem('token') || '';
        const response = await fetchApi<{ success: boolean; data: AnalyticsData }>(
          `/analytics/dashboard?period=${period}`,
          { token },
        );
        setData(response.data);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Unable to load analytics. Please log in.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Author Analytics</h1>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Stories" value={data.overview.totalStories} />
          <StatCard label="Total Views" value={data.overview.totalViews.toLocaleString()} />
          <StatCard label="Ratings" value={data.overview.totalRatings} />
          <StatCard label="Avg Rating" value={data.overview.averageRating.toFixed(1)} />
          <StatCard label="Earnings" value={`$${(data.overview.totalEarnings / 100).toFixed(2)}`} />
          <StatCard label="Followers" value={data.overview.followersCount} />
        </div>

        {/* Views Chart (simple bar representation) */}
        {data.recentViews.length > 0 && (
          <div className="border rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Views Over Time</h2>
            <div className="flex items-end gap-1 h-32">
              {data.recentViews.map((day, i) => {
                const maxViews = Math.max(...data.recentViews.map((d) => d.views), 1);
                const height = (day.views / maxViews) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.views} views`}>
                    <div
                      className="w-full bg-primary/80 rounded-t-sm min-h-[2px]"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>{data.recentViews[0]?.date}</span>
              <span>{data.recentViews[data.recentViews.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {/* Top Stories */}
        {data.topStories.length > 0 && (
          <div className="border rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Top Stories</h2>
            <div className="space-y-3">
              {data.topStories.map((story, index) => (
                <div key={story.id} className="flex items-center gap-4 p-3 rounded-md hover:bg-muted/50">
                  <span className="text-2xl font-bold text-muted-foreground w-8">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{story.title}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                      <span>{story.viewCount.toLocaleString()} views</span>
                      <span>{'★'} {story.averageRating.toFixed(1)} ({story.ratingsCount})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating Distribution */}
        {data.ratingDistribution.length > 0 && (
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Rating Distribution</h2>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const entry = data.ratingDistribution.find((d) => d.rating === rating);
                const count = entry?.count || 0;
                const totalRatings = data.ratingDistribution.reduce((sum, d) => sum + d.count, 0);
                const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="text-sm w-12">{rating} {'★'}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-lg p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
