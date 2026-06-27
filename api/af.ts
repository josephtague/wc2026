// Vercel Edge function — API-Football proxy (static route).
// vercel.json rewrites /api/af/<path> → /api/af?upstream=<path>. Holds the key.
// (Reserved; the preview uses ESPN, since API-Football's free tier excludes 2026.)
import { proxyGet, errorJson } from './_lib/proxy';

export const config = { runtime: 'edge' };

const AF_BASE = 'https://v3.football.api-sports.io';

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return errorJson('API_FOOTBALL_KEY not configured', 503);

  const url = new URL(req.url);
  const upstream = url.searchParams.get('upstream') ?? '';
  url.searchParams.delete('upstream');
  const qs = url.searchParams.toString();
  const target = `${AF_BASE}/${upstream}${qs ? `?${qs}` : ''}`;

  return proxyGet(target, { 'x-apisports-key': key }, 3600);
}
