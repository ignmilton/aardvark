'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefault?: boolean;
  disabled?: boolean;
}

interface SwipeState {
  startX: number;
  startY: number;
  isDragging: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

/**
 * Hook for handling swipe gestures on touch devices
 */
export function useSwipeGestures<T extends HTMLElement = HTMLElement>(
  options: SwipeGestureOptions = {}
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventDefault = true,
    disabled = false,
  } = options;

  const elementRef = useRef<T>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    isDragging: false,
    direction: null,
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      setSwipeState({
        startX: touch.clientX,
        startY: touch.clientY,
        isDragging: true,
        direction: null,
      });
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !swipeState.isDragging) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - swipeState.startX;
      const deltaY = touch.clientY - swipeState.startY;

      // Determine direction based on which axis has more movement
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > threshold / 2) {
          setSwipeState(prev => ({ ...prev, direction: 'right' }));
        } else if (deltaX < -threshold / 2) {
          setSwipeState(prev => ({ ...prev, direction: 'left' }));
        }
      } else {
        if (deltaY > threshold / 2) {
          setSwipeState(prev => ({ ...prev, direction: 'down' }));
        } else if (deltaY < -threshold / 2) {
          setSwipeState(prev => ({ ...prev, direction: 'up' }));
        }
      }

      // Prevent scrolling during horizontal swipes
      if (preventDefault && Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }
    },
    [disabled, swipeState.isDragging, swipeState.startX, swipeState.startY, threshold, preventDefault]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled || !swipeState.isDragging) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - swipeState.startX;
      const deltaY = touch.clientY - swipeState.startY;

      // Determine final swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > threshold) {
          onSwipeRight?.();
        } else if (deltaX < -threshold) {
          onSwipeLeft?.();
        }
      } else {
        // Vertical swipe
        if (deltaY > threshold) {
          onSwipeDown?.();
        } else if (deltaY < -threshold) {
          onSwipeUp?.();
        }
      }

      setSwipeState({
        startX: 0,
        startY: 0,
        isDragging: false,
        direction: null,
      });
    },
    [disabled, swipeState, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || disabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled, preventDefault]);

  return {
    ref: elementRef,
    isDragging: swipeState.isDragging,
    swipeDirection: swipeState.direction,
  };
}
