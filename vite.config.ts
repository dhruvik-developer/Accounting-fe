import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: '/acf/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@mui\/icons-material\/([^/]+)$/, replacement: '@mui/icons-material/esm/$1' },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  server: { port: 5173 },
});
