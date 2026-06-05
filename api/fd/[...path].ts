// Vercel Edge function — football-data.org passthrough proxy.
// Holds FD_KEY server-side so it never reaches the browser bundle.
// Routes: /api/fd/competitions/WC/matches?season=2026
//         /api/fd/competitions/WC/scorers
//         /api/fd/competitions/WC/standings
import { proxyGet, errorJson } from '../_lib/proxy';

export const config = { runtime: 'edge' };

const FD_BASE = 'https://api.football-data.org/v4';

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.FD_KEY;
  if (!key) return errorJson('FD_KEY not configured', 503);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/fd\//, '');
  const target = `${FD_BASE}/${path}${url.search}`;

  // Live matches refresh often; scorers/standings change slowly.
  const sMaxAge = path.includes('/matches') ? 60 : 900;
  return proxyGet(target, { 'X-Auth-Token': key }, sMaxAge);
}
