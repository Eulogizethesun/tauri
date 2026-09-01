import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [svelte()],
  resolve: { dedupe: ['@tauri-apps/api'] },
  clearScreen: false,
  server: {
    host: host ?? false,
    port: 1421,
    strictPort: true,
    hmr: host ? { protocol: 'ws', host, port: 1431 } : undefined,
    fs: { allow: ['.', '../../packages/api/dist'] }
  }
})
