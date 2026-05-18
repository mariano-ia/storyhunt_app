import type { NextConfig } from "next";

// Security headers — sent on every response. Tightened 2026-05-18 pre-OTA
// launch. Values are intentionally conservative; loosen on a per-path basis
// if a third-party widget breaks.
const SECURITY_HEADERS = [
  // Browsers stick to HTTPS for 2 years. HSTS already added at the edge by Vercel.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // No iframing the dashboard / player (prevents clickjacking the paywall CTA).
  { key: 'X-Frame-Options', value: 'DENY' },
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
      // Block search engines from indexing the player (tokens in URLs).
      {
        source: '/play/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      // Dashboard is admin-only.
      {
        source: '/dashboard/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Default headers for everything else.
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
