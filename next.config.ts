/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    dangerouslyAllowSVG: true, // Required for DiceBear SVGs
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Uploaded site photos and logos (Supabase storage)
      { protocol: 'https', hostname: '*.supabase.co', port: '', pathname: '/storage/v1/object/public/**' },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/7.x/**', // Matches the version used in your code
      },
    ],
  },
  // Browsers ask for /favicon.ico on their own (e.g. on the robots and sitemap files); serve the site icon.
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon.png' }]
  },
  // Security headers on every response.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' }, // don't guess file types
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, // don't leak full URLs to other sites
          { key: 'X-Frame-Options', value: 'DENY' }, // no embedding the site in other sites' frames
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }, // HTTPS only (browsers ignore it on http://localhost)
        ],
      },
    ]
  },
};

module.exports = nextConfig;