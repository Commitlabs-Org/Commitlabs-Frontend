/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');

try {
  execSync('node scripts/validate-env.mjs', { stdio: 'inherit' });
} catch (err) {
  process.exit(1);
}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['escrow-client'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // DENY (not SAMEORIGIN): nothing needs to frame the app, and the
          // wallet signing flow must not be clickjackable. The CSP
          // `frame-ancestors 'none'` set in src/middleware.ts agrees.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
