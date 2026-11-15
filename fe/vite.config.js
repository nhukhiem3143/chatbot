import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Chạy dev trực tiếp (npm run dev): proxy /api sang data-service. Khi chạy Docker thì Nginx lo việc này.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
