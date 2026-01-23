export const locales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Espa\u00f1ol',
  fr: 'Fran\u00e7ais',
  de: 'Deutsch',
  pt: 'Portugu\u00eas',
  ja: '\u65e5\u672c\u8a9e',
  ko: '\ud55c\uad6d\uc5b4',
  zh: '\u4e2d\u6587',
  hi: '\u0939\u093f\u0928\u094d\u0926\u0940',
  ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
};

export const rtlLocales: Locale[] = ['ar'];

export function isRTL(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
