import type { NextConfig } from "next";

// Security headers — sent on every response. Tightened 2026-05-18 pre-OTA
// launch. Values are intentionally conservative; loosen on a per-path basis
// if a third-party widget breaks.
// X-Frame-Options is declared per-route (DENY for default + dashboard,
// SAMEORIGIN for /play/* so the editor preview iframe works). Next.js
// concatenates headers across matching rules, so keeping it out of the shared
// list is the only way to avoid emitting both DENY and SAMEORIGIN on /play.
const SECURITY_HEADERS = [
  // Browsers stick to HTTPS for 2 years. HSTS already added at the edge by Vercel.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Disallow MIME-sniffing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Strict referrer policy to avoid leaking ?token=SH-XXX in Referer.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Cut surface for fingerprinting / unused APIs.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],

  async headers() {
    return [
      // Player: allow same-origin framing so the dashboard editor can embed
      // /play/[id] in its preview iframe. Third parties still can't clickjack
      // the paywall (frame-ancestors 'self' enforces it in modern browsers).
      {
        source: '/play/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      // Dashboard is admin-only.
      {
        source: '/dashboard/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Default headers for everything else (skips /play and /dashboard so
      // their X-Frame-Options values don't collide with the rules above).
      {
        source: '/:path((?!play|dashboard).*)',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
