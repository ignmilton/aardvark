import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { WebVitalsReporter } from './web-vitals';
import { AnnouncerProvider } from '@/components/a11y/announcer';
import { I18nProvider } from '@/components/providers/i18n-provider';
import '@/styles/globals.css';

// Font CSS variables are defined in globals.css using system fonts
// This avoids the need to fetch fonts during build while maintaining good typography
// In production, Google Fonts can be loaded via CSS @import for enhanced typography

// Metadata for SEO
export const metadata: Metadata = {
  title: {
    default: 'Aardvark - Interactive Fiction Platform',
    template: '%s | Aardvark',
  },
  description:
    'Create, read, and share interactive stories with branching narratives. Choose your own adventure awaits.',
  keywords: [
    'interactive fiction',
    'choose your own adventure',
    'branching narrative',
    'storytelling',
    'creative writing',
    'CYOA',
  ],
  authors: [{ name: 'Aardvark' }],
  creator: 'Aardvark',
  publisher: 'Aardvark',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  openGraph: {
    title: 'Aardvark - Interactive Fiction Platform',
    description:
      'Create, read, and share interactive stories with branching narratives.',
    url: '/',
    siteName: 'Aardvark',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Aardvark - Interactive Fiction Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aardvark - Interactive Fiction Platform',
    description:
      'Create, read, and share interactive stories with branching narratives.',
    images: ['/og-image.png'],
    creator: '@aardvark',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png' }],
  },
};

// Viewport configuration for PWA
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

/**
 * Root layout component for the Aardvark application.
 * Provides global providers, theme support, and base layout structure.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="font-sans"
    >
      <head>
        {/* PWA meta tags */}
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Aardvark" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#e15f54" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
          <QueryProvider>
            <AuthProvider>
              <ToastProvider>
                <AnnouncerProvider>
                {/* Skip to main content for accessibility */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
                >
                  Skip to main content
                </a>

                {/* Main application structure */}
                <div className="relative flex min-h-screen flex-col">
                  {/* Header - hidden on certain pages like reading mode */}
                  <Header />

                  {/* Main content area */}
                  <main
                    id="main-content"
                    className="flex-1 pb-16 md:pb-0"
                    role="main"
                  >
                    {children}
                  </main>

                  {/* Mobile bottom navigation */}
                  <MobileNav />
                </div>

                {/* PWA components */}
                <OfflineIndicator />
                <InstallPrompt />

                {/* Performance monitoring */}
                <WebVitalsReporter />
                </AnnouncerProvider>
              </ToastProvider>
            </AuthProvider>
          </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
