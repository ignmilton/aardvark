'use client';

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { throttle } from '@/lib/performance';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  containerHeight?: number;
}

/**
 * Virtualized list component for rendering large lists efficiently.
 * Only renders items visible in the viewport plus an overscan buffer.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 5,
  renderItem,
  className,
  containerHeight,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(600);

  const height = containerHeight || measuredHeight;

  useEffect(() => {
    if (containerHeight) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMeasuredHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [containerHeight]);

  const throttledScrollRef = useRef(
    throttle((container: HTMLDivElement) => {
      setScrollTop(container.scrollTop);
    }, 16),
  );

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      throttledScrollRef.current(containerRef.current);
    }
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + height) / itemHeight) + overscan,
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: containerHeight || '100%', overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, i) => (
          <div
            key={startIndex + i}
            style={{
              position: 'absolute',
              top: (startIndex + i) * itemHeight,
              height: itemHeight,
              width: '100%',
            }}
          >
            {renderItem(item, startIndex + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
