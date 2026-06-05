import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env so the API keys can be injected server-side in the dev proxy —
  // these are NOT VITE_-prefixed, so they never end up in the browser bundle.
  // In production the equivalent /api serverless functions do the same thing.
  const env = loadEnv(mode, process.cwd(), '');
  const fdKey = env.FD_KEY ?? '';
  const afKey = env.API_FOOTBALL_KEY ?? '';

  return {
    plugins: [react()],
    server: {
      proxy: {
        // BBC Sport RSS — proxied to avoid CORS restriction in dev
        '/api/rss': {
          target: 'https://feeds.bbci.co.uk',
          changeOrigin: true,
          secure: false,
          rewrite: () => '/sport/football/rss.xml',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
              proxyReq.setHeader('Accept', 'application/rss+xml, text/xml, */*');
            });
          },
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
        // API-Football (api-sports.io) — key injected server-side. (Reserved; the
        // free plan can't access season 2026, so the preview uses ESPN instead.)
        '/api/af': {
          target: 'https://v3.football.api-sports.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/af/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (afKey) proxyReq.setHeader('x-apisports-key', afKey);
            });
          },
        },
        // ESPN hidden API — powers the Match Preview (line-ups, odds, H2H). No key.
        '/api/espn': {
          target: 'https://site.api.espn.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/espn/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            });
          },
        },
      },
    },
  };
})
