/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Important: prevent PDF.js from trying to use canvas
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
  // Disable server-side rendering for PDF viewer
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  // Enable ES modules for PDF.js
  transpilePackages: ['pdfjs-dist'],
}

module.exports = nextConfig