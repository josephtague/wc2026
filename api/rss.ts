// Vercel Edge function — BBC Sport RSS proxy.
// Replaces the third-party codetabs.com CORS hop used previously in prod.
import { proxyGet } from './_lib/proxy';

export const config = { runtime: 'edge' };

const BBC_FEED = 'https://feeds.bbci.co.uk/sport/football/rss.xml';

export default async function handler(): Promise<Response> {
  // BBC requires a browser-like User-Agent; cache 15 min at the edge.
  return proxyGet(
    BBC_FEED,
    {},
    900,
    {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, text/xml, */*',
    },
  );
}
