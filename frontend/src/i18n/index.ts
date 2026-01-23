import { Locale, defaultLocale } from './config';

type MessageModule = Record<string, any>;

const messageImports: Record<Locale, () => Promise<MessageModule>> = {
  en: () => import('./messages/en.json'),
  es: () => import('./messages/es.json'),
  fr: () => import('./messages/fr.json').catch(() => import('./messages/en.json')),
  de: () => import('./messages/de.json').catch(() => import('./messages/en.json')),
  pt: () => import('./messages/pt.json').catch(() => import('./messages/en.json')),
  ja: () => import('./messages/ja.json').catch(() => import('./messages/en.json')),
  ko: () => import('./messages/ko.json').catch(() => import('./messages/en.json')),
  zh: () => import('./messages/zh.json').catch(() => import('./messages/en.json')),
  hi: () => import('./messages/hi.json').catch(() => import('./messages/en.json')),
  ar: () => import('./messages/ar.json').catch(() => import('./messages/en.json')),
};

export async function getMessages(locale: Locale): Promise<MessageModule> {
  const loader = messageImports[locale] || messageImports[defaultLocale];
  const module = await loader();
  return module.default || module;
}

export { locales, defaultLocale, localeNames, isRTL } from './config';
export type { Locale } from './config';
