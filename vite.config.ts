import { defineConfig, loadEnv } from 'vite'
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
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  // Debug: log environment variables during build
  console.log('[Vite Build] Mode:', mode);
  console.log('[Vite Build] env:', env);
  console.log('[Vite Build] CF_PAGES:', env.CF_PAGES);
  console.log('[Vite Build] CF_PAGES_COMMIT_SHA:', env.CF_PAGES_COMMIT_SHA);

  return {
    base: (() => {
      const isCI = env.GITHUB_ACTIONS === 'true'
      const repo = env.GITHUB_REPOSITORY?.split('/')[1]
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
    },
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toLocaleString()),
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __APP_VERSION__: JSON.stringify(env.npm_package_version || '0.0.0'),
      // Use env.CF_PAGES because loadEnv makes it available if it exists
      __CF_PAGES__: JSON.stringify(env.CF_PAGES === '1'),
    },
  }
})
