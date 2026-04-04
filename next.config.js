/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['framer-motion'], // <-- SURGICAL INJECTION
  // ONLY apply static export and custom distDir during 'next build' for Tauri.
  // In 'next dev', fall back to default dynamic behavior.
  ...(isProd && {
    output: 'export',
    distDir: 'dist',
  }),
  // Ignore Tauri specific APIs during compilation warnings
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

module.exports = nextConfig;
