/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Important: prevent PDF.js from trying to use canvas on the server
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
    }
    
    // Add support for PDF.js worker
    config.plugins.push(
      new config.webpack.ProvidePlugin({
        process: 'process/browser',
      })
    );
    
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