// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Applies to App Router route handlers & server actions
      bodySizeLimit: '100mb',   // pick a size that matches your files, e.g. 50mb/100mb
    },
  },
};

module.exports = nextConfig;
