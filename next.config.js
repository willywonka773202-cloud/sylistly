/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

module.exports = nextConfig;
