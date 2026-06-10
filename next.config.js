/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Retired surfaces from the pre-scroll era — keep old links working.
  async redirects() {
    return [
      { source: '/feed', destination: '/', permanent: false },
      { source: '/swipe', destination: '/', permanent: false },
      { source: '/stylist', destination: '/', permanent: false },
      { source: '/discover', destination: '/saved', permanent: false },
      { source: '/wardrobe', destination: '/saved', permanent: false },
      { source: '/canvas', destination: '/build', permanent: false },
    ];
  },
  eslint: {
    // Pre-existing lint warnings in error.tsx / catalog.ts — don't block deploys
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'cdn.sylistly.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Retailer CDNs (used for first-load before our pipeline caches them)
      { protocol: 'https', hostname: '**.ssense.com' },
      { protocol: 'https', hostname: '**.nordstrom.com' },
      { protocol: 'https', hostname: '**.nike.com' },
      { protocol: 'https', hostname: '**.adidas.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  // Cutout PNGs are large static assets served from /public — they must never be
  // traced into serverless function bundles (that blew past Vercel's 250MB limit).
  outputFileTracingExcludes: {
    '*': [
      'public/assets/cutouts/**',
      './public/assets/cutouts/**',
      '**/public/assets/cutouts/**',
    ],
  },
};

module.exports = nextConfig;
