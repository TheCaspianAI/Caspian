import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Ignore .caspian directory to prevent hot reload when creating/deleting nodes
      // This directory contains manifests, audit logs, and worktree data
      ignored: ['**/.caspian/**'],
    },
  },
})


