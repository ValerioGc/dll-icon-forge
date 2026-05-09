import { mount, type MountingOptions } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Component } from 'vue';
import { i18n, setLocale } from '@/i18n';

export function resetFrontendTestState() {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  setLocale('it');
  setActivePinia(createPinia());
}

export function mountComponent(
  component: Component,
  options: MountingOptions<Record<string, unknown>> = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(component, {
    ...options,
    global: {
      ...(options.global ?? {}),
      plugins: [pinia, i18n, ...(options.global?.plugins ?? [])],
    },
  });
}
