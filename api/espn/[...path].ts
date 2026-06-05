// Vercel Edge function — ESPN hidden API passthrough (no key required).
// Used by the Match Preview: scoreboard (find event) + summary (line-ups, odds, H2H).
// Proxied for consistent CORS + edge caching. Mirrors the dev Vite proxy for /api/espn.
import { proxyGet } from '../_lib/proxy';

export const config = { runtime: 'edge' };

const ESPN_BASE = 'https://site.api.espn.com';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/espn\//, '');
  const target = `${ESPN_BASE}/${path}${url.search}`;

  // Scoreboard/summary for upcoming matches change slowly; line-ups land ~1h pre-KO.
  // 5 min edge cache balances freshness against ESPN load and is plenty for a preview.
  return proxyGet(
    target,
    {},
    300,
    { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  );
}
