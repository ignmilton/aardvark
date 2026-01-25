'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PenTool,
  BookOpen,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'fantasy', label: 'Fantasy', description: 'Magic, mythical creatures, and epic quests' },
  { id: 'sci-fi', label: 'Sci-Fi', description: 'Space, technology, and futuristic worlds' },
  { id: 'romance', label: 'Romance', description: 'Love stories and relationships' },
  { id: 'mystery', label: 'Mystery', description: 'Puzzles, crimes, and investigations' },
  { id: 'horror', label: 'Horror', description: 'Scary stories and supernatural terrors' },
  { id: 'adventure', label: 'Adventure', description: 'Action-packed journeys and explorations' },
  { id: 'thriller', label: 'Thriller', description: 'Suspense and high-stakes situations' },
  { id: 'comedy', label: 'Comedy', description: 'Funny and lighthearted tales' },
  { id: 'drama', label: 'Drama', description: 'Emotional and character-driven narratives' },
  { id: 'historical', label: 'Historical', description: 'Stories set in the past' },
];

export default function CreateStoryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/create');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your story');
      return;
    }
    if (!category) {
      toast.error('Please select a category');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create story');
      }

      const { data } = await response.json();
      toast.success('Story created! Redirecting to editor...');
      router.push(`/story/${data.slug}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create story');
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <PenTool className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Create a New Story</h1>
          <p className="text-muted-foreground">
            Start your interactive adventure
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  step >= s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s}
              </div>
              {s < 2 && (
                <div className={`w-16 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="story-title" className="block text-sm font-medium mb-2">
                Story Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="story-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a captivating title..."
                className="text-lg"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.length}/200 characters
              </p>
            </div>

            <div>
              <label htmlFor="story-description" className="block text-sm font-medium mb-2">
                Description (Optional)
              </label>
              <textarea
                id="story-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give readers a preview of your story..."
                rows={4}
                className="w-full px-3 py-2 border rounded-md resize-none bg-background"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {description.length}/2000 characters
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!title.trim()}
                size="lg"
              >
                Next: Choose Category
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Category */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-4">
                Choose a Category <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`p-4 text-left border rounded-lg transition-all ${
                      category === cat.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                        : 'hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium">{cat.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cat.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} size="lg">
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!category || isCreating}
                size="lg"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Story
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-12 p-6 bg-muted/30 rounded-lg">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Tips for a Great Story
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Choose a compelling title that hooks readers</li>
            <li>• Write a description that creates intrigue without spoilers</li>
            <li>• Plan your story branches before diving into writing</li>
            <li>• Create meaningful choices that affect the story outcome</li>
            <li>• Include multiple endings to encourage replay</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
