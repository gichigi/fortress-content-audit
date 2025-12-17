import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// #region agent log
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logPath = join(__dirname, '.cursor/debug.log');
const log = (msg, data, hypothesisId) => {
  try {
    const entry = JSON.stringify({
      sessionId: 'debug-session',
      runId: 'build-debug',
      hypothesisId,
      location: 'next.config.js',
      message: msg,
      data: data || {},
      timestamp: Date.now()
    }) + '\n';
    fs.appendFileSync(logPath, entry);
  } catch (e) {}
};
log('Next.js config loading', { timestamp: new Date().toISOString() }, 'A');
// #endregion

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Re-enable optimization and provide sensible responsive breakpoints
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vercel.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  // #region agent log
  webpack: (config, { isServer, dev }) => {
    log('Webpack config called', { isServer, dev, hasCache: !!config.cache }, 'A');
    if (dev && config.cache) {
      // Disable webpack cache in dev mode to prevent file access issues
      // The cache can become corrupted and cause ENOENT errors
      config.cache = false;
      log('Webpack cache disabled in dev mode', {}, 'A');
    }
    return config;
  },
  // #endregion
};

// #region agent log
log('Next.js config exported', { hasRewrites: typeof nextConfig.rewrites === 'function' }, 'A');
// #endregion

export default nextConfig;
