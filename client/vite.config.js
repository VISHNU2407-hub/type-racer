import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})