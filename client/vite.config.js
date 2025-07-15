import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const isNgrok = process.argv.includes('--ngrok') || process.argv.includes('-ngrok')
  if (isNgrok) {
    process.env.VITE_NGROK = 'true'
  }
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0', // Allow external access
      port: 5173,
      allowedHosts: ['91e6f6a38b02.ngrok-free.app'],
    },
  }
})
