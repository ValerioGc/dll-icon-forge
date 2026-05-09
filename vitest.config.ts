import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('0.1.0'),
    'import.meta.env.VITE_GITHUB_URL': JSON.stringify('https://github.com/ValerioGc/win-dll-packer'),
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/frontend/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/env.d.ts',
        'src/**/*.d.ts',
      ],
    },
  },
});
