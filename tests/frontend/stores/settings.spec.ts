import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

function setupSettingsStore() {
  mountComponent({ template: '<div />' });
  return useSettingsStore();
}

describe('settings store', () => {
  beforeEach(() => {
    resetFrontendTestState();
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

    expect(nextSettings.language).toBe('it');
    expect(nextSettings.theme).toBe('light');
  });

  it('falls back to defaults when persisted settings are not valid JSON', () => {
    localStorage.setItem('win-dll-packer:settings', '{broken');
    const settings = setupSettingsStore();

    settings.load();

    expect(settings.language).toBe('it');
    expect(settings.theme).toBe('light');
  });

  it('toggles language and theme and saves settings', async () => {
    const settings = setupSettingsStore();

    settings.load();
    settings.toggleLanguage();
    settings.toggleTheme();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem('win-dll-packer:settings') ?? '{}')).toEqual({
      language: 'en',
      theme: 'dark',
    });
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
