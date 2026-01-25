'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Home, Search, PenTool, BookOpen, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mobile bottom navigation bar.
 * Provides quick access to main sections on mobile devices.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  // Hide on reading pages
  if (pathname?.startsWith('/read/')) {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/stories', label: 'Browse', icon: Search },
    { href: '/create', label: 'Write', icon: PenTool, authRequired: true },
    { href: '/library', label: 'Library', icon: BookOpen, authRequired: true },
    {
      href: isAuthenticated && user ? `/users/${user.username}` : '/login',
      label: isAuthenticated ? 'Profile' : 'Login',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          // Skip auth-required items for non-authenticated users
          if (item.authRequired && !isAuthenticated) return null;

          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon
                className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')}
              />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
