/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Коротка назва коміту - щоб у налаштуваннях було видно, яка версія на телефоні. */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Відносні шляхи - щоб збірку можна було викласти будь-куди (GitHub Pages, Netlify, папка).
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(commit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  // Лише тести застосунку: у локальних теках (напр. .claude-config) бувають чужі тести.
  test: {
    include: ['src/**/*.test.ts'],
  },
})
