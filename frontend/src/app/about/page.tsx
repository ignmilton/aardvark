import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Sparkles, Heart } from 'lucide-react';

export const metadata = {
  title: 'About - Aardvark',
  description: 'Learn about Aardvark, the interactive fiction platform where your choices shape the story.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">About Aardvark</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Where every choice matters and every reader becomes the author of their own adventure.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Aardvark was built with a simple belief: stories are more engaging when you&apos;re part of them.
            We&apos;re creating a platform where readers don&apos;t just consume content—they shape it. Every choice
            leads to a new path, every decision changes the outcome, and every reader experiences
            something unique.
          </p>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8">What Makes Us Different</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg">
              <BookOpen className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Interactive Storytelling</h3>
              <p className="text-muted-foreground">
                Our stories branch and evolve based on your choices, creating personalized
                narratives that reflect your decisions.
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <Users className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Community Collaboration</h3>
              <p className="text-muted-foreground">
                Authors can enable collaborative writing, allowing readers to contribute
                their own branches to existing stories.
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <Sparkles className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Powerful Creation Tools</h3>
              <p className="text-muted-foreground">
                Our visual editor makes it easy to craft complex branching narratives
                with state variables, conditions, and multiple endings.
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <Heart className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Creator-Friendly</h3>
              <p className="text-muted-foreground">
                Writers can monetize their work through premium content, tips from
                readers, and credit-based story unlocks.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12 border-t">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Your Adventure?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of readers and writers on Aardvark.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link href="/stories">Explore Stories</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/create">Start Writing</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
