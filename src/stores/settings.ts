import { watch } from 'vue';
import { defineStore } from 'pinia';
import { setLocale, type AppLocale } from '@/i18n';

export type Theme = 'dark' | 'light';
export type Language = AppLocale;
export type ViewMode = 'list' | 'grid';

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type SettingsState = {
  language: Language;
  theme: Theme;
  viewMode: ViewMode;
  pageSize: PageSize;
  loaded: boolean;
};

const STORAGE_KEY = 'win-dll-packer:settings';

const DEFAULTS: Omit<SettingsState, 'loaded'> = {
  language: 'it',
  theme: 'light',
  viewMode: 'grid',
  pageSize: 20,
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

function isPageSize(value: unknown): value is PageSize {
  return typeof value === 'number' && (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
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

      this.viewMode = stored.viewMode === 'list' || stored.viewMode === 'grid'
        ? stored.viewMode
        : DEFAULTS.viewMode;

      this.pageSize = isPageSize(stored.pageSize) ? stored.pageSize : DEFAULTS.pageSize;

      this.loaded = true;
      this.apply();
      this.startPersistence();
    },

    save(): void {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        language: this.language,
        theme: this.theme,
        viewMode: this.viewMode,
        pageSize: this.pageSize,
      }));
    },

    apply(): void {
      setLocale(this.language);
      applyTheme(this.theme);
    },

    startPersistence(): void {
      watch(
        () => [this.language, this.theme, this.viewMode, this.pageSize],
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

    setViewMode(viewMode: ViewMode): void {
      this.viewMode = viewMode;
    },

    toggleViewMode(): void {
      this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
    },

    setPageSize(pageSize: PageSize): void {
      this.pageSize = pageSize;
    },
  },
});
