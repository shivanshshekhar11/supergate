import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@llm-gateway/schemas'],
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
  // Standalone output for lean Docker images — only in CI/production builds
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
}

export default nextConfig
