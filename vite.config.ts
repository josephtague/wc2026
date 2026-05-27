import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env so the API key can be injected server-side in the proxy —
  // this way VITE_FD_KEY never ends up in the browser bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const fdKey = env.VITE_FD_KEY ?? '';

  return {
    plugins: [react()],
    server: {
      proxy: {
        // BBC Sport RSS — proxied to avoid CORS restriction in dev
        '/api/rss': {
          target: 'https://feeds.bbci.co.uk',
          changeOrigin: true,
          rewrite: () => '/sport/football/rss.xml',
        },
        // football-data.org — key injected server-side, never exposed to the browser
        '/api/fd': {
          target: 'https://api.football-data.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fd/, '/v4'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (fdKey) proxyReq.setHeader('X-Auth-Token', fdKey);
            });
          },
        },
      },
    },
  };
})
