import { createI18n } from 'vue-i18n';
import it from '@/locales/it.json';
import en from '@/locales/en.json';

export type AppLocale = 'it' | 'en';

export const SUPPORTED_LOCALES: AppLocale[] = ['it', 'en'];

export const i18n = createI18n<false>({
  legacy: false,
  globalInjection: true,
  locale: 'it',
  fallbackLocale: 'en',
  messages: {
    it,
    en,
  },
});

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}

export function t(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(key, named ?? {});
}