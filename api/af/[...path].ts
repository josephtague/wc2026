// Vercel Edge function — API-Football (api-sports.io) passthrough proxy.
// Holds API_FOOTBALL_KEY server-side. Mirrors the dev Vite proxy for /api/af.
// The rich Match Preview uses the dedicated aggregator at /api/preview instead,
// but this passthrough covers simpler direct calls (e.g. the fixtures map).
import { proxyGet, errorJson } from '../_lib/proxy';

export const config = { runtime: 'edge' };

const AF_BASE = 'https://v3.football.api-sports.io';

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return errorJson('API_FOOTBALL_KEY not configured', 503);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/af\//, '');
  const target = `${AF_BASE}/${path}${url.search}`;

  // API-Football data is low-frequency for a given fixture; cache 1h at the edge.
  return proxyGet(target, { 'x-apisports-key': key }, 3600);
}
