import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const isNgrok = process.argv.includes('--ngrok') || process.argv.includes('-ngrok')
  if (isNgrok) {
    process.env.VITE_NGROK = 'true'
  }
  const noAuth = process.argv.includes('--no-auth') || process.argv.includes('-no-auth')
  if (noAuth) {
    process.env.VITE_NO_AUTH = 'true'
  }
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0', // Allow external access (ngrok, Cloudflare Tunnel, LAN)
      port: 5173,
      allowedHosts: true,
      proxy: {
        // Same-origin /api → backend :3000 (required for HTTPS tunnels → avoid mixed content)
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '') || '/',
        },
      },
    },
  }
})
