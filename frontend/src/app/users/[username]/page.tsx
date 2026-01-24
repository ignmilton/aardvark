'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  createdAt: string;
  stats: {
    storiesPublished: number;
    totalViews: number;
    averageRating: number;
    followersCount: number;
    followingCount: number;
  };
}

interface UserStory {
  id: string;
  title: string;
  slug: string;
  description: string;
  averageRating: number;
  viewCount: number;
  category: string;
  publishedAt: string;
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'stories' | 'about'>('stories');

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const [profileRes, storiesRes] = await Promise.all([
          fetchApi<{ success: boolean; data: UserProfile }>(`/users/${username}`),
          fetchApi<{ success: boolean; data: UserStory[] }>(`/users/${username}/stories`),
        ]);
        setProfile(profileRes.data);
        setStories(storiesRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">{error || 'User not found'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground overflow-hidden">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              profile.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{profile.displayName}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
            <div className="flex gap-6 mt-3 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{profile.stats.storiesPublished}</strong> stories</span>
              <span><strong className="text-foreground">{profile.stats.followersCount}</strong> followers</span>
              <span><strong className="text-foreground">{profile.stats.followingCount}</strong> following</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b mb-6">
          <button
            onClick={() => setActiveTab('stories')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'stories' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Stories ({stories.length})
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'about' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            About
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'stories' ? (
          stories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No published stories yet.</p>
          ) : (
            <div className="space-y-4">
              {stories.map((story) => (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}/read`}
                  className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <h3 className="font-semibold">{story.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{story.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {story.averageRating > 0 && <span>{'★'} {story.averageRating.toFixed(1)}</span>}
                    <span>{story.viewCount.toLocaleString()} views</span>
                    {story.category && <span>{story.category}</span>}
                    <span>{new Date(story.publishedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Statistics</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{profile.stats.totalViews.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Views</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{profile.stats.averageRating.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Avg Rating</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{profile.stats.storiesPublished}</div>
                  <div className="text-xs text-muted-foreground">Stories</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
