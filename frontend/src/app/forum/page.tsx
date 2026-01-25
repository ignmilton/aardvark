'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';

interface ForumCategory {
  id: string;
  name: string;
  description: string;
  slug: string;
  threadCount: number;
  postCount: number;
  lastPost: {
    title: string;
    authorName: string;
    createdAt: string;
  } | null;
}

interface ForumThread {
  id: string;
  title: string;
  slug: string;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  isLocked: boolean;
  lastReplyAt: string | null;
  lastReplyAuthor: string | null;
}

export default function ForumPage() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalThreads, setTotalThreads] = useState(0);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetchApi<{ success: boolean; data: ForumCategory[] }>('/forum/categories');
        setCategories(response.data || []);
      } catch (error) {
        console.error('Failed to load forum categories:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory) {
      setThreads([]);
      return;
    }
    async function loadThreads() {
      setThreadsLoading(true);
      try {
        const response = await fetchApi<{
          success: boolean;
          data: ForumThread[];
          meta: { total: number };
        }>(`/forum/threads?category=${selectedCategory}&page=${page}&limit=20`);
        setThreads(response.data || []);
        setTotalThreads(response.meta?.total || 0);
      } catch (error) {
        console.error('Failed to load threads:', error);
      } finally {
        setThreadsLoading(false);
      }
    }
    loadThreads();
  }, [selectedCategory, page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading forum...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Community Forum</h1>

        {!selectedCategory ? (
          /* Category List */
          <div className="space-y-3">
            {categories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No forum categories available.</p>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.slug); setPage(1); }}
                  className="w-full text-left p-5 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{cat.threadCount} threads</div>
                      <div>{cat.postCount} posts</div>
                    </div>
                  </div>
                  {cat.lastPost && (
                    <div className="mt-3 text-xs text-muted-foreground border-t pt-2">
                      Last: &ldquo;{cat.lastPost.title}&rdquo; by {cat.lastPost.authorName}
                      {' - '}{new Date(cat.lastPost.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          /* Thread List */
          <div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-primary hover:underline mb-4 inline-block"
            >
              &larr; Back to Categories
            </button>

            {threadsLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading threads...</p>
            ) : threads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No threads in this category yet.</p>
            ) : (
              <div className="space-y-2">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`p-4 border rounded-lg ${thread.isPinned ? 'border-primary/30 bg-primary/5' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                        {thread.authorAvatar ? (
                          <img src={thread.authorAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          thread.authorName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {thread.isPinned && <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">Pinned</span>}
                          {thread.isLocked && <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">Locked</span>}
                          <h3 className="font-medium truncate">{thread.title}</h3>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>by {thread.authorName}</span>
                          <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                          <span>{thread.repliesCount} replies</span>
                          <span>{thread.viewsCount} views</span>
                        </div>
                        {thread.lastReplyAuthor && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last reply by {thread.lastReplyAuthor} - {new Date(thread.lastReplyAt!).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalThreads > 20 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40 text-sm"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(totalThreads / 20)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(totalThreads / 20)}
                  className="px-3 py-1 border rounded-md disabled:opacity-40 text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
