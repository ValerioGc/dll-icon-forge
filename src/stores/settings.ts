import { watch } from 'vue';
import { defineStore } from 'pinia';
import { setLocale, type AppLocale } from '@/i18n';

export type Theme = 'dark' | 'light';
export type Language = AppLocale;

type SettingsState = {
  language: Language;
  theme: Theme;
  loaded: boolean;
};

const STORAGE_KEY = 'win-dll-packer:settings';

const DEFAULTS: Omit<SettingsState, 'loaded'> = {
  language: 'it',
  theme: 'light',
};

function readStoredSettings(): Partial<SettingsState> {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Partial<SettingsState>;
  } catch {
    return {};
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    ...DEFAULTS,
    loaded: false,
  }),

  actions: {
    load(): void {
      const stored = readStoredSettings();

      this.language = stored.language === 'en' || stored.language === 'it'
        ? stored.language
        : DEFAULTS.language;

      this.theme = stored.theme === 'dark' || stored.theme === 'light'
        ? stored.theme
        : DEFAULTS.theme;

      this.loaded = true;
      this.apply();
      this.startPersistence();
    },

    save(): void {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        language: this.language,
        theme: this.theme,
      }));
    },

    apply(): void {
      setLocale(this.language);
      applyTheme(this.theme);
    },

    startPersistence(): void {
      watch(
        () => [this.language, this.theme],
        () => {
          this.apply();
          this.save();
        },
      );
    },

    setLanguage(language: Language): void {
      this.language = language;
    },

    toggleLanguage(): void {
      this.language = this.language === 'it' ? 'en' : 'it';
    },

    setTheme(theme: Theme): void {
      this.theme = theme;
    },

    toggleTheme(): void {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
    },
  },
});
