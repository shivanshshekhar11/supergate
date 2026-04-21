import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@llm-gateway/schemas'],
  // Standalone output for lean Docker images — only in CI/production builds
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
}

export default nextConfig
