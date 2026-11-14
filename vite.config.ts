import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: '/',
    server: {
      port: 3001,
      host: '0.0.0.0',
      strictPort: true
    },
    preview: {
      port: 3001,
      host: '0.0.0.0',
      strictPort: true
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
