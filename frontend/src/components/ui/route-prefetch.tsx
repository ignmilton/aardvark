'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link, { type LinkProps } from 'next/link';
import { useInView } from 'react-intersection-observer';

interface PrefetchLinkProps extends LinkProps {
  children: ReactNode;
  className?: string;
  prefetchOnHover?: boolean;
}

/**
 * Enhanced link component that prefetches routes when they enter the viewport
 * or on hover, for near-instant navigation.
 */
export function PrefetchLink({
  children,
  className,
  prefetchOnHover = true,
  ...linkProps
}: PrefetchLinkProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px',
  });

  return (
    <Link
      ref={ref}
      className={className}
      prefetch={inView}
      {...linkProps}
    >
      {children}
    </Link>
  );
}
