// Vercel Edge function — football-data.org proxy (static route).
// Vercel does not reliably route dynamic catch-all files (api/fd/[...path].ts) for
// this project, so this is a static /api/fd function; vercel.json rewrites
// /api/fd/<path> → /api/fd?upstream=<path>. Holds FD_KEY server-side.
import { proxyGet, errorJson } from './_lib/proxy';

export const config = { runtime: 'edge' };

const FD_BASE = 'https://api.football-data.org/v4';

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.FD_KEY;
  if (!key) return errorJson('FD_KEY not configured', 503);

  const url = new URL(req.url);
  const upstream = url.searchParams.get('upstream') ?? '';
  url.searchParams.delete('upstream');           // the rest are real upstream params (e.g. season)
  const qs = url.searchParams.toString();
  const target = `${FD_BASE}/${upstream}${qs ? `?${qs}` : ''}`;

  const sMaxAge = upstream.includes('/matches') ? 60 : 900;   // live scores fresh; scorers/standings slow
  return proxyGet(target, { 'X-Auth-Token': key }, sMaxAge);
}
