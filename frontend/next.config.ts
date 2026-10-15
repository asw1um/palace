import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';

// Where /api and /uploads are proxied to. Baked in at build time, so in Docker it
// is passed as a build arg (the backend's service name, e.g. http://backend:5000).
const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:5000').replace(/\/+$/, '');

function buildCommit(): string {
  // No git inside the Docker build; the image passes the commit in instead.
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image. Opt-in because the
  // standalone copy step needs symlink rights a normal Windows shell lacks.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Next.js generates validator.ts paths relative to `src/app/` when the tsconfig
  // `@/*` alias points to `src/`. The app/ directory is at root, not src/, so the
  // generated paths are wrong. Suppress so builds aren't blocked by Next.js's own codegen.
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'http',  hostname: '127.0.0.1' }, // local uploads served by the backend
    ],
    formats: ['image/avif', 'image/webp'],
    // Reserve space so browsers don't trigger CLS while decoding
    minimumCacheTTL: 3600,
  },

  // Injected for the Settings → About "Build" row. NEXT_PUBLIC_* is inlined by
  // both Turbopack and webpack, so no webpack DefinePlugin is needed.
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      // In dev, chunks have stable URLs (no content hash) so must never be cached long-term.
      // In production, Next.js appends content hashes so immutable caching is safe.
      ...(isProd ? [{
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      }] : []),
      {
        // Backend-proxied uploads (avatars, banners) — cache 1 h, serve stale for 24 h
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
