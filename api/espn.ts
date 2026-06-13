// Vercel Edge function — ESPN hidden API proxy (static route; no key needed).
// vercel.json rewrites /api/espn/<path> → /api/espn?upstream=<path>.
import { proxyGet } from './_lib/proxy';

export const config = { runtime: 'edge' };

const ESPN_BASE = 'https://site.api.espn.com';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const upstream = url.searchParams.get('upstream') ?? '';
  url.searchParams.delete('upstream');
  const qs = url.searchParams.toString();
  const target = `${ESPN_BASE}/${upstream}${qs ? `?${qs}` : ''}`;

  return proxyGet(
    target,
    {},
    300,
    { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  );
}
