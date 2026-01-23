'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Locale, defaultLocale, getMessages } from '@/i18n';

type Messages = Record<string, any>;

interface I18nContextType {
  locale: Locale;
  messages: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextType>({
  locale: defaultLocale,
  messages: {},
  t: (key) => key,
  setLocale: () => {},
});

export function useTranslations(namespace?: string) {
  const { t, locale, setLocale } = useContext(I18nContext);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return t(fullKey, params);
    },
    [t, namespace],
  );

  return { t: translate, locale, setLocale };
}

/**
 * Get a nested value from messages object using dot notation
 */
export function getNestedValue(obj: Record<string, any>, path: string): string {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current === undefined || current === null) return path;
    current = current[key];
  }

  return typeof current === 'string' ? current : path;
}

/**
 * Interpolate parameters in a translated string
 */
export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

/**
 * Hook to load and manage locale state
 */
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Messages>({});

  useEffect(() => {
    // Load saved locale from localStorage
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved) {
      setLocaleState(saved);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Locale;
      const supportedLocales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar'];
      if (supportedLocales.includes(browserLang)) {
        setLocaleState(browserLang);
      }
    }
  }, []);

  useEffect(() => {
    getMessages(locale).then(setMessages);
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = ['ar'].includes(newLocale) ? 'rtl' : 'ltr';
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = getNestedValue(messages, key);
      if (params) {
        return interpolate(value, params);
      }
      return value;
    },
    [messages],
  );

  return { locale, messages, t, setLocale };
}
