'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AdminSidebar } from './admin-sidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  pendingReports?: number;
  pendingQueue?: number;
  showBackButton?: boolean;
}

/**
 * Admin layout component with sidebar navigation
 * Wraps admin pages with consistent layout and navigation
 */
export function AdminLayout({
  children,
  title,
  description,
  pendingReports,
  pendingQueue,
  showBackButton = false,
}: AdminLayoutProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Check if user has admin/moderator access
  const hasAccess = user?.role === 'admin' || user?.role === 'moderator';

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">
            You don&apos;t have permission to access the admin panel. This area is
            restricted to moderators and administrators.
          </p>
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <AdminSidebar
        pendingReports={pendingReports}
        pendingQueue={pendingQueue}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container-wide py-6 space-y-6">
          {/* Header */}
          {(title || description || showBackButton) && (
            <div className="space-y-4">
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              {(title || description) && (
                <div>
                  {title && (
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                  )}
                  {description && (
                    <p className="text-muted-foreground mt-2">{description}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Page content */}
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
