import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for the 'use cache' directive and cacheTag used by lib/content/read.ts
  cacheComponents: true,
}

export default nextConfig
