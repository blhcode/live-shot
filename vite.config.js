import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5180,
    // This PC hits its inotify watcher limit, so poll instead.
    watch: { usePolling: true, interval: 400, ignored: ['**/node_modules/**', '**/dist/**'] },
  },
  build: { chunkSizeWarningLimit: 1000 },
});
