/**
 * LANDSAFE — Cloudflare Edge Worker
 * 
 * High-performance edge router and reverse proxy for LANDSAFE:
 * - Serves frontend SPA assets via Cloudflare Workers Static Assets (`env.ASSETS`)
 * - Injects enterprise security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy)
 * - Proxies `/api/*` requests securely to backend origin with connection pooling and edge error handling
 * - Edge health check endpoint at `/edge-health` and `/api/edge-health`
 */

export interface Env {
  /** Cloudflare Workers Static Assets binding */
  ASSETS: {
    fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
  };
  /** Target backend origin (e.g. https://api.landsafe.bpbd.go.id or Cloudflare Tunnel) */
  API_ORIGIN?: string;
  /** Deployment environment name */
  ENVIRONMENT?: string;
  /** Application title */
  APP_NAME?: string;
}

interface ExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com",
    "connect-src 'self' https: wss: ws:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
  ].join('; '),
};

function applySecurityHeaders(headers: Headers, isHttps: boolean): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  if (isHttps && !headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const isHttps = url.protocol === 'https:';

    // 1. Edge health check (edge-only, fast — does not touch the backend)
    if (url.pathname === '/edge-health') {
      const response = new Response(
        JSON.stringify({
          status: 'ok',
          service: env.APP_NAME ?? 'LANDSAFE',
          environment: env.ENVIRONMENT ?? 'production',
          edge: 'cloudflare-worker',
          timestamp: new Date().toISOString(),
          datacenter: (request as unknown as { cf?: { colo?: string; country?: string } }).cf?.colo ?? 'unknown',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      );
      applySecurityHeaders(response.headers, isHttps);
      return response;
    }

    // 1b. Meaningful backend health check — probes the real backend /api/healthz
    // and reports whether the core API is reachable, rather than returning ok
    // just because the edge Worker itself is running.
    if (url.pathname === '/api/edge-health') {
      const apiOrigin = (env.API_ORIGIN ?? '').replace(/\/+$/, '');
      let backend = { reachable: false, status: null as number | null, responseMs: null as number | null };
      if (apiOrigin) {
        const start = Date.now();
        try {
          const probe = await fetch(new URL('/api/healthz', apiOrigin).toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          backend = {
            reachable: true,
            status: probe.status,
            responseMs: Date.now() - start,
          };
        } catch (_err) {
          // Backend unreachable: report fail status without exposing internals.
          backend = { reachable: false, status: null, responseMs: Date.now() - start };
        }
      }
      const healthy = backend.reachable && backend.status === 200;
      const response = new Response(
        JSON.stringify({
          status: healthy ? 'ok' : 'degraded',
          service: env.APP_NAME ?? 'LANDSAFE',
          environment: env.ENVIRONMENT ?? 'production',
          edge: 'cloudflare-worker',
          backend: {
            origin: apiOrigin ? apiOrigin : '(not configured)',
            reachable: backend.reachable,
            status: backend.status,
            responseMs: backend.responseMs,
          },
          timestamp: new Date().toISOString(),
          datacenter: (request as unknown as { cf?: { colo?: string; country?: string } }).cf?.colo ?? 'unknown',
        }),
        {
          status: healthy ? 200 : 503,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      );
      applySecurityHeaders(response.headers, isHttps);
      return response;
    }

    // 2. Handle API preflight OPTIONS
    if (url.pathname.startsWith('/api') && request.method === 'OPTIONS') {
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', url.origin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Max-Age', '86400');
      applySecurityHeaders(headers, isHttps);
      return new Response(null, { status: 204, headers });
    }

    // 3. API Proxy to Backend Origin
    if (url.pathname.startsWith('/api')) {
      const apiOrigin = (env.API_ORIGIN ?? 'http://127.0.0.1:5000').replace(/\/+$/, '');
      const targetUrl = new URL(url.pathname + url.search, apiOrigin);

      // Clone headers and append forwarding metadata
      const forwardHeaders = new Headers(request.headers);
      forwardHeaders.set('X-Forwarded-Host', url.host);
      forwardHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      const clientIp = request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-real-ip');
      if (clientIp) {
        forwardHeaders.set('X-Forwarded-For', clientIp);
      }

      try {
        const proxyResponse = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: forwardHeaders,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'follow',
        });

        // Recreate response to allow security header mutation
        const modifiedHeaders = new Headers(proxyResponse.headers);
        applySecurityHeaders(modifiedHeaders, isHttps);
        // Never cache API responses at the edge (authenticated or not).
        modifiedHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        modifiedHeaders.set('Surrogate-Control', 'no-store');

        return new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: modifiedHeaders,
        });
      } catch (err) {
        // Log the upstream failure server-side (for operators) but return a
        // sanitized message to the public client — no infrastructure details.
        const errorMsg = err instanceof Error ? err.message : 'Unknown upstream error';
        console.error(`[LANDSAFE] API proxy failure for ${targetUrl.origin}: ${errorMsg}`);
        const errorResponse = new Response(
          JSON.stringify({
            error: 'Bad Gateway',
            message: 'Unable to reach the backend API. Please try again later or contact support.',
          }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        );
        applySecurityHeaders(errorResponse.headers, isHttps);
        return errorResponse;
      }
    }

    // 4. Serve Frontend SPA via Cloudflare Workers Static Assets
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      const modifiedHeaders = new Headers(assetResponse.headers);

      // Cache immutable hashed assets for 1 year
      if (url.pathname.startsWith('/assets/')) {
        modifiedHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.')) {
        // HTML and SPA fallback: always revalidate
        modifiedHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate');
      }

      applySecurityHeaders(modifiedHeaders, isHttps);

      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: modifiedHeaders,
      });
    } catch {
      // Fallback SPA index if asset routing encounters an exception
      const indexRequest = new Request(new URL('/', request.url).toString(), request);
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      const modifiedHeaders = new Headers(indexResponse.headers);
      applySecurityHeaders(modifiedHeaders, isHttps);

      return new Response(indexResponse.body, {
        status: 200,
        headers: modifiedHeaders,
      });
    }
  },
};
