import path from 'path'
import { createMDX } from 'fumadocs-mdx/next'

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
  // Standalone output for lean Docker images — only in CI/production builds
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
}

const withMDX = createMDX()

export default withMDX(config)
