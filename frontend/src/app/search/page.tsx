'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  description: string;
  authorName: string;
  averageRating: number;
  viewCount: number;
  category: string;
  tags: string[];
}

interface SearchResponse {
  success: boolean;
  data: SearchResult[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams?.get('q') || '');
  const [category, setCategory] = useState(searchParams?.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams?.get('sort') || 'relevance');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async () => {
    if (!query.trim() && !category) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      params.set('sortBy', sortBy);
      params.set('page', String(page));
      params.set('limit', '20');

      const response = await fetchApi<SearchResponse>(`/stories?${params.toString()}`);
      setResults(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, category, sortBy, page]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    if (sortBy !== 'relevance') params.set('sort', sortBy);
    router.push(`/search?${params.toString()}`);
  };

  const categories = [
    '', 'fantasy', 'sci-fi', 'romance', 'mystery', 'horror', 'adventure',
    'thriller', 'comedy', 'drama', 'historical', 'literary',
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Search Stories</h1>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stories by title, description, or tags..."
              className="flex-1 px-4 py-2 border rounded-lg bg-background"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
            >
              Search
            </button>
          </div>
          <div className="flex gap-4 flex-wrap">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border rounded-md bg-background text-sm"
            >
              <option value="">All Categories</option>
              {categories.filter(Boolean).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border rounded-md bg-background text-sm"
            >
              <option value="relevance">Relevance</option>
              <option value="rating">Highest Rated</option>
              <option value="views">Most Viewed</option>
              <option value="created">Newest</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Searching...</div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {query || category ? 'No stories found matching your criteria.' : 'Enter a search term to find stories.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {total} result{total !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-4">
              {results.map((story) => (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}/read`}
                  className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <h3 className="text-lg font-semibold">{story.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {story.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>by {story.authorName}</span>
                    {story.averageRating > 0 && (
                      <span>{'★'.repeat(Math.round(story.averageRating))} {story.averageRating.toFixed(1)}</span>
                    )}
                    <span>{story.viewCount.toLocaleString()} views</span>
                    {story.category && (
                      <span className="px-2 py-0.5 bg-muted rounded-full">{story.category}</span>
                    )}
                  </div>
                  {story.tags?.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {story.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="px-3 py-1 border rounded-md disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Search Stories</h1>
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
