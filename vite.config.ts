import { defineConfig, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

import combineSelectors from 'postcss-combine-duplicated-selectors';
import autoprefixer from 'autoprefixer';
import purgecss from '@fullhuman/postcss-purgecss';
import cssnano from 'cssnano';

const host = process.env.TAURI_DEV_HOST;
const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string };
const githubUrl = 'https://github.com/ValerioGc/win-dll-packer';


export default defineConfig(async ({ mode }) => {
  const analyze = mode === 'analyze' || process.env.ANALYZE === 'true';
  const plugins: PluginOption[] = [vue()];

  if (analyze) {
    const { visualizer } = await import('rollup-plugin-visualizer');

    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }) as PluginOption,
    );
  }

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
      'import.meta.env.VITE_GITHUB_URL': JSON.stringify(githubUrl),
    },

    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },

    plugins,

    css: {
      preprocessorOptions: {
        scss: {
          additionalData: "@use '@/styles/partials/placeholders' as *;\n",
        },
      },
      postcss: {
        plugins: [
          combineSelectors({ removeDuplicatedProperties: true }),
          purgecss({
            content: [
              './public/**/*.html',
              './src/**/*.vue',
              './src/**/*.ts',
              './src/styles/**/*.scss',
            ],
            safelist: {
              standard: [/^v-/, /^el-/],
            },
            defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
          }),
          autoprefixer({
            overrideBrowserslist: ['last 4 versions', 'not dead'],
          }),
          cssnano({ preset: 'default' }),
        ],
      }
    },
  
    build: {
      sourcemap: false,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1400,
    }
  };
});
