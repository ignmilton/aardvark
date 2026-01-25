import { Suspense } from 'react';
import Link from 'next/link';
import { HeroSection } from '@/components/home/hero-section';
import { ContinueReading } from '@/components/home/continue-reading';
import { FeaturedStories } from '@/components/home/featured-stories';
import { TrendingStories } from '@/components/home/trending-stories';
import { CategoryGrid } from '@/components/home/category-grid';
import { HowItWorks } from '@/components/home/how-it-works';
import { CallToAction } from '@/components/home/call-to-action';
import { StorySkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, Sparkles, Users, PenTool } from 'lucide-react';

/**
 * Homepage component for the Aardvark interactive fiction platform.
 * Showcases featured content, trending stories, and platform capabilities.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <HeroSection />

      {/* Continue Reading (for authenticated users) */}
      <ContinueReading />

      {/* Featured Stories Carousel */}
      <section className="py-12 md:py-16">
        <div className="container-wide">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">
                Featured Stories
              </h2>
              <p className="text-muted-foreground mt-1">
                Hand-picked adventures curated by our editors
              </p>
            </div>
            <Link href="/stories?filter=featured">
              <Button variant="ghost">View All</Button>
            </Link>
          </div>
          <Suspense fallback={<StorySkeleton count={4} />}>
            <FeaturedStories />
          </Suspense>
        </div>
      </section>

      {/* Trending Stories */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container-wide">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Trending Now
              </h2>
              <p className="text-muted-foreground mt-1">
                Most popular stories this week
              </p>
            </div>
            <Link href="/stories?sort=trending">
              <Button variant="ghost">View All</Button>
            </Link>
          </div>
          <Suspense fallback={<StorySkeleton count={6} />}>
            <TrendingStories />
          </Suspense>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-12 md:py-16">
        <div className="container-wide">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold">
              Explore by Genre
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              From epic fantasy adventures to spine-chilling mysteries, find
              your next favorite story
            </p>
          </div>
          <CategoryGrid />
        </div>
      </section>

      {/* Platform Stats */}
      <section className="py-12 md:py-16 bg-primary/5">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">
                10K+
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Interactive Stories
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">
                500K+
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Active Readers
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">
                50K+
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Story Branches
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">
                5K+
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Authors
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-16">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold">How It Works</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Whether you want to read or create, getting started is easy
            </p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container-wide">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Reader Features */}
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Read & Explore</h3>
              <p className="text-muted-foreground mb-4">
                Dive into thousands of interactive stories where your choices
                shape the narrative. Save your progress and pick up where you
                left off.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Track your reading progress
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Create personal collections
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Follow favorite authors
                </li>
              </ul>
            </div>

            {/* Author Features */}
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <PenTool className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Write & Create</h3>
              <p className="text-muted-foreground mb-4">
                Bring your stories to life with our powerful dual editor
                system. Use rich text or visual flowcharts to craft branching
                narratives.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Visual node-based editor
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Complex state management
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  AI writing companion
                </li>
              </ul>
            </div>

            {/* Community Features */}
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect & Collaborate</h3>
              <p className="text-muted-foreground mb-4">
                Join a vibrant community of storytellers. Contribute branches to
                collaborative stories or build your own following.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Collaborative storytelling
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Community forums
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Earn from your stories
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <CallToAction />
    </div>
  );
}
