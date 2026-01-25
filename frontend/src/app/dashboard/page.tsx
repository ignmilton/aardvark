'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  BarChart3,
  PenTool,
  Star,
  Eye,
  Users,
  TrendingUp,
  Loader2,
  ArrowRight,
  Plus,
} from 'lucide-react';

interface DashboardStats {
  totalStories: number;
  publishedStories: number;
  draftStories: number;
  totalViews: number;
  totalRatings: number;
  averageRating: number;
  followersCount: number;
}

interface RecentStory {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  viewCount: number;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentStories, setRecentStories] = useState<RecentStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load dashboard data
  useEffect(() => {
    async function loadDashboard() {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem('accessToken');
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, storiesRes] = await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/analytics/author/overview`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/stories?limit=5&sortBy=updatedAt`, { headers }),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setStats(data.data);
        }

        if (storiesRes.status === 'fulfilled' && storiesRes.value.ok) {
          const data = await storiesRes.value.json();
          setRecentStories(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [isAuthenticated]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.displayName || user?.username}
            </p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="h-4 w-4 mr-2" />
              New Story
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalStories || 0}</p>
                <p className="text-sm text-muted-foreground">Stories</p>
              </div>
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalViews?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.averageRating?.toFixed(1) || '0.0'}</p>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.followersCount || 0}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Recent Stories */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent Stories</h2>
              <Link href="/library?tab=my-stories" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>

            {recentStories.length === 0 ? (
              <div className="text-center py-8">
                <PenTool className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No stories yet</p>
                <Button asChild size="sm">
                  <Link href="/create">Create Your First Story</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentStories.map((story) => (
                  <Link
                    key={story.id}
                    href={`/story/${story.slug}/edit`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium line-clamp-1">{story.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className={`px-1.5 py-0.5 rounded ${
                          story.status === 'published'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {story.status}
                        </span>
                        <span>{story.viewCount} views</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/create"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Create New Story</p>
                  <p className="text-xs text-muted-foreground">Start a new interactive adventure</p>
                </div>
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">View Analytics</p>
                  <p className="text-xs text-muted-foreground">See detailed performance metrics</p>
                </div>
              </Link>
              <Link
                href="/library"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <BookOpen className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">Your Library</p>
                  <p className="text-xs text-muted-foreground">Manage your stories and drafts</p>
                </div>
              </Link>
              <Link
                href={`/users/${user?.username}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">View Public Profile</p>
                  <p className="text-xs text-muted-foreground">See how others see you</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
