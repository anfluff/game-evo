import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use project site base in production (for GitHub Pages), and '/' in dev
  base: mode === 'production' ? '/game-evo/' : '/',
  plugins: [react()],
}))
