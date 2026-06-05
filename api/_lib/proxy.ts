// Shared helpers for the serverless edge proxies.
// Files prefixed with _ are not routed by Vercel — import-only modules.

/** JSON error response with no caching. */
export function errorJson(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Proxy a GET to `target` with an auth header, streaming the upstream body back
 * and attaching a Vercel edge cache window. The edge CDN cache is what protects
 * the upstream rate-limit budget across users: the first request populates it,
 * everyone else within `sMaxAge` is served from the edge with zero upstream cost.
 */
export async function proxyGet(
  target: string,
  authHeader: Record<string, string>,
  sMaxAgeSeconds: number,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  try {
    const upstream = await fetch(target, { headers: { ...authHeader, ...extraHeaders } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': `public, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${sMaxAgeSeconds * 4}`,
      },
    });
  } catch {
    return errorJson('upstream fetch failed', 502);
  }
}
