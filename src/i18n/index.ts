import { createI18n } from 'vue-i18n';
import it from '@/locales/it.json';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';
import de from '@/locales/de.json';

export type AppLocale = 'it' | 'en' | 'fr' | 'es' | 'de';

export const SUPPORTED_LOCALES: AppLocale[] = ['it', 'en', 'fr', 'es', 'de'];

export const i18n = createI18n<false>({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    it,
    fr,
    es,
    de
  },
});

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}

export function t(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(key, named ?? {});
}