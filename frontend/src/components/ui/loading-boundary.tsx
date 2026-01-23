'use client';

import { Suspense, type ReactNode } from 'react';
import { Skeleton } from './skeleton';

interface LoadingBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  type?: 'story' | 'profile' | 'reading' | 'default';
}

function DefaultFallback({ type }: { type: string }) {
  switch (type) {
    case 'story':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      );
    case 'profile':
      return (
        <div className="flex items-center space-x-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      );
    case 'reading':
      return (
        <div className="max-w-2xl mx-auto space-y-4 p-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
  }
}

/**
 * Suspense boundary with appropriate loading skeletons.
 */
export function LoadingBoundary({ children, fallback, type = 'default' }: LoadingBoundaryProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback type={type} />}>
      {children}
    </Suspense>
  );
}
