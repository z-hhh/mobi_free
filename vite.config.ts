import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listens on all interfaces
    // OR
    // host: true, // Also listens on all interfaces
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString()),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
})
