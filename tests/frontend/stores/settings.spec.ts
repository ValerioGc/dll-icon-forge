import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

function setupSettingsStore() {
  mountComponent({ template: '<div />' });
  return useSettingsStore();
}

function mockSystemLanguage(lang: string) {
  Object.defineProperty(navigator, 'language', {
    value: lang,
    configurable: true,
    writable: true,
  });
}

describe('settings store', () => {
  beforeEach(() => {
    resetFrontendTestState();
    mockSystemLanguage('it-IT');
  });

  it('loads defaults and applies locale/theme to the document', () => {
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('it');
    expect(settings.theme).toBe('light');
    expect(document.documentElement.lang).toBe('it');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('loads valid persisted settings and ignores invalid values', () => {
    localStorage.setItem('win-dll-packer:settings', JSON.stringify({
      language: 'en',
      theme: 'dark',
    }));
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('dark');

    localStorage.setItem('win-dll-packer:settings', JSON.stringify({
      language: 'fr',
      theme: 'sepia',
    }));
    const nextSettings = setupSettingsStore();

    nextSettings.load();

    expect(nextSettings.language).toBe('fr');
    expect(nextSettings.theme).toBe('light');
  });

  it('accepts all five supported locales from storage', () => {
    for (const lang of ['it', 'en', 'fr', 'es', 'de']) {
      localStorage.setItem('win-dll-packer:settings', JSON.stringify({ language: lang }));
      const settings = setupSettingsStore();
      settings.load();
      expect(settings.language).toBe(lang);
    }
  });

  it('detects system language when no stored preference exists', () => {
    mockSystemLanguage('fr-FR');
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('fr');
  });

  it('falls back to English when system language is not supported', () => {
    mockSystemLanguage('ja-JP');
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('en');
  });

  it('stored preference takes priority over system language', () => {
    localStorage.setItem('win-dll-packer:settings', JSON.stringify({ language: 'de' }));
    mockSystemLanguage('fr-FR');
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('de');
  });

  it('falls back to defaults when persisted settings are not valid JSON', () => {
    mockSystemLanguage('it-IT');
    localStorage.setItem('win-dll-packer:settings', '{broken');
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('it');
    expect(settings.theme).toBe('light');
  });

  it('sets language and theme and saves settings', async () => {
    const settings = setupSettingsStore();

    settings.load();
    settings.setLanguage('en');
    settings.toggleTheme();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem('win-dll-packer:settings') ?? '{}')).toEqual({
      language: 'en',
      theme: 'dark',
      viewMode: 'grid',
      pageSize: 20,
    });
  });

  it('loads default viewMode and pageSize when no value is stored', () => {
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.viewMode).toBe('grid');
    expect(settings.pageSize).toBe(20);
  });

  it('persists viewMode and pageSize across changes', async () => {
    const settings = setupSettingsStore();

    settings.load();
    settings.setViewMode('list');
    settings.setPageSize(40);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(JSON.parse(localStorage.getItem('win-dll-packer:settings') ?? '{}')).toMatchObject({
      viewMode: 'list',
      pageSize: 40,
    });
  });

  it('rejects invalid viewMode and pageSize from storage and falls back to defaults', () => {
    localStorage.setItem('win-dll-packer:settings', JSON.stringify({
      viewMode: 'masonry',
      pageSize: 17,
    }));
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.viewMode).toBe('grid');
    expect(settings.pageSize).toBe(20);
  });

  it('toggles viewMode between list and grid', () => {
    const settings = setupSettingsStore();

    settings.load();
    expect(settings.viewMode).toBe('grid');
    settings.toggleViewMode();
    expect(settings.viewMode).toBe('list');
    settings.toggleViewMode();
    expect(settings.viewMode).toBe('grid');
  });

  it('allows setting language and theme explicitly', async () => {
    const settings = setupSettingsStore();

    settings.load();
    settings.setLanguage('en');
    settings.setTheme('dark');
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
