import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the floating "N" dev-tools button that `next dev` adds in the corner.
  devIndicators: false,
};

export default nextConfig;

// Lets `next dev` see Cloudflare bindings from wrangler.jsonc.
initOpenNextCloudflareForDev();
