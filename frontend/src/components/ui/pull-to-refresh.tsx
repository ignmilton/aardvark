'use client';

import { ReactNode } from 'react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  threshold?: number;
}

/**
 * Pull-to-refresh container component for mobile feeds
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
  threshold = 80,
}: PullToRefreshProps) {
  const {
    ref,
    isPulling,
    isRefreshing,
    pullDistance,
    canRefresh,
    progress,
  } = usePullToRefresh<HTMLDivElement>({
    onRefresh,
    threshold,
    disabled,
  });

  return (
    <div
      ref={ref}
      className={cn('relative overflow-auto', className)}
      style={{
        transform: isPulling ? `translateY(${pullDistance * 0.5}px)` : undefined,
        transition: isPulling ? 'none' : 'transform 0.2s ease-out',
      }}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 flex items-center justify-center',
          'w-10 h-10 rounded-full bg-background border shadow-sm',
          'transition-all duration-200',
          isPulling || isRefreshing ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: isPulling ? Math.max(-40 + pullDistance * 0.5, 4) : -40,
        }}
      >
        <RefreshCw
          className={cn(
            'w-5 h-5 text-muted-foreground',
            isRefreshing && 'animate-spin',
            canRefresh && !isRefreshing && 'text-primary'
          )}
          style={{
            transform: !isRefreshing ? `rotate(${progress * 3.6}deg)` : undefined,
          }}
        />
      </div>

      {/* Pull status text */}
      {(isPulling || isRefreshing) && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground',
            'transition-opacity duration-200'
          )}
          style={{
            top: isPulling ? Math.max(-16 + pullDistance * 0.5, 48) : 48,
          }}
        >
          {isRefreshing
            ? 'Refreshing...'
            : canRefresh
            ? 'Release to refresh'
            : 'Pull to refresh'}
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  );
}
