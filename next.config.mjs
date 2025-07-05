/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Important: prevent PDF.js from trying to use canvas
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
  // Move this out of experimental and rename
  serverExternalPackages: ['pdfjs-dist'],
  // Remove transpilePackages for pdfjs-dist to avoid conflict
}

export default nextConfig