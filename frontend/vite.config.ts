/* eslint-disable import/no-extraneous-dependencies */
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, splitVendorChunkPlugin, type PluginOption } from 'vite';
import checker from 'vite-plugin-checker';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    nodePolyfills({
      include: ['util', 'url'],
    }),
    checker({
      typescript: true,
    }),
    splitVendorChunkPlugin(),
    visualizer({
      gzipSize: true,
      brotliSize: true,
    }) as unknown as PluginOption,
    sentryVitePlugin({
      org: 'pipesort',
      project: 'preaccred',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }) as unknown as PluginOption,
  ],
  build: {
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
