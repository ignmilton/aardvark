'use client';

import { Globe } from 'lucide-react';
import { useState } from 'react';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { useTranslations } from '@/hooks/use-translations';

/**
 * Language switcher dropdown component.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md p-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{localeNames[locale]}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            aria-label="Select language"
            className="absolute right-0 top-full z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border bg-card py-1 shadow-lg"
          >
            {locales.map((loc) => (
              <button
                key={loc}
                role="option"
                aria-selected={locale === loc}
                onClick={() => {
                  setLocale(loc);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
                  locale === loc
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                {localeNames[loc]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
