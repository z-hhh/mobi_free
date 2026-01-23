import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

// 获取 Commit Hash
const getCommitHash = () => {
  try {
    // Cloudflare Pages build environment
    if (process.env.CF_PAGES_COMMIT_SHA) {
      return process.env.CF_PAGES_COMMIT_SHA.substring(0, 7);
    }
    // Local git environment
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
};

const commitHash = getCommitHash();

// https://vite.dev/config/
export default defineConfig({
  base: (() => {
    const isCI = process.env.GITHUB_ACTIONS === 'true'
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
    if (!isCI || !repo) return '/'
    return repo.endsWith('.github.io') ? '/' : `/${repo}/`
  })(),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Mobi Free',
        short_name: 'MobiFree',
        description: 'Free fitness for everyone',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0', // Listens on all interfaces
    // OR
    // host: true, // Also listens on all interfaces
  },
  define: (() => {
    // Debug: log environment variables during build
    console.log('[Vite Build] CF_PAGES:', process.env.CF_PAGES);
    console.log('[Vite Build] CF_PAGES === "1":', process.env.CF_PAGES === '1');
    console.log('[Vite Build] All CF_* env vars:', Object.keys(process.env).filter(k => k.startsWith('CF_')));

    return {
      __BUILD_TIME__: JSON.stringify(new Date().toLocaleString()),
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
      __CF_PAGES__: JSON.stringify(process.env.CF_PAGES === '1'),
    };
  })(),
})
