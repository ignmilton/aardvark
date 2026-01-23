'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook to manage keyboard navigation within a container.
 * Supports arrow key navigation between focusable elements.
 */
export function useKeyboardNav(options: {
  selector?: string;
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onEscape?: () => void;
} = {}) {
  const {
    selector = '[role="option"], [role="menuitem"], button, a, input, [tabindex]',
    orientation = 'vertical',
    loop = true,
    onEscape,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector),
    ).filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
    );
  }, [selector]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);

      let nextIndex: number | null = null;

      switch (event.key) {
        case 'ArrowDown':
          if (orientation === 'horizontal') return;
          event.preventDefault();
          nextIndex = currentIndex + 1;
          break;
        case 'ArrowUp':
          if (orientation === 'horizontal') return;
          event.preventDefault();
          nextIndex = currentIndex - 1;
          break;
        case 'ArrowRight':
          if (orientation === 'vertical') return;
          event.preventDefault();
          nextIndex = currentIndex + 1;
          break;
        case 'ArrowLeft':
          if (orientation === 'vertical') return;
          event.preventDefault();
          nextIndex = currentIndex - 1;
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = elements.length - 1;
          break;
        case 'Escape':
          onEscape?.();
          return;
        default:
          return;
      }

      if (nextIndex !== null) {
        if (loop) {
          nextIndex = ((nextIndex % elements.length) + elements.length) % elements.length;
        } else {
          nextIndex = Math.max(0, Math.min(nextIndex, elements.length - 1));
        }
        elements[nextIndex]?.focus();
      }
    },
    [getFocusableElements, orientation, loop, onEscape],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return containerRef;
}

/**
 * Hook to trap focus within a container (for modals/dialogs).
 */
export function useFocusTrap(active: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    previousFocus.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    firstFocusable?.focus();

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);

    return () => {
      container.removeEventListener('keydown', handleTab);
      previousFocus.current?.focus();
    };
  }, [active]);

  return containerRef;
}
