'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  canRefresh: boolean;
}

/**
 * Hook for implementing pull-to-refresh functionality
 */
export function usePullToRefresh<T extends HTMLElement = HTMLElement>(
  options: PullToRefreshOptions
) {
  const {
    onRefresh,
    threshold = 80,
    maxPull = 150,
    disabled = false,
  } = options;

  const containerRef = useRef<T>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    canRefresh: false,
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || state.isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      // Only activate if at the top of the scroll container
      if (container.scrollTop > 0) return;

      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;

      setState(prev => ({ ...prev, isPulling: true }));
    },
    [disabled, state.isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !state.isPulling || state.isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      currentYRef.current = e.touches[0].clientY;
      const pullDistance = Math.max(0, Math.min(
        currentYRef.current - startYRef.current,
        maxPull
      ));

      // Only count as pull if scrolled to top
      if (container.scrollTop > 0) {
        setState(prev => ({ ...prev, pullDistance: 0, canRefresh: false }));
        return;
      }

      if (pullDistance > 0) {
        e.preventDefault();
      }

      const canRefresh = pullDistance >= threshold;
      setState(prev => ({ ...prev, pullDistance, canRefresh }));
    },
    [disabled, state.isPulling, state.isRefreshing, threshold, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || state.isRefreshing) return;

    const { canRefresh, pullDistance } = state;

    if (canRefresh && pullDistance >= threshold) {
      setState(prev => ({ ...prev, isPulling: false, isRefreshing: true }));

      try {
        await onRefresh();
      } finally {
        setState({
          isPulling: false,
          isRefreshing: false,
          pullDistance: 0,
          canRefresh: false,
        });
      }
    } else {
      setState({
        isPulling: false,
        isRefreshing: false,
        pullDistance: 0,
        canRefresh: false,
      });
    }
  }, [disabled, state, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  // Calculate progress percentage (0-100)
  const progress = Math.min((state.pullDistance / threshold) * 100, 100);

  return {
    ref: containerRef,
    isPulling: state.isPulling,
    isRefreshing: state.isRefreshing,
    pullDistance: state.pullDistance,
    canRefresh: state.canRefresh,
    progress,
  };
}
