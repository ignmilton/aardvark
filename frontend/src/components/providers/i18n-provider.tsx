'use client';

import { type ReactNode } from 'react';
import { I18nContext, useLocale } from '@/hooks/use-translations';

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Internationalization provider that wraps the app with translation context.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const { locale, messages, t, setLocale } = useLocale();

  return (
    <I18nContext.Provider value={{ locale, messages, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
