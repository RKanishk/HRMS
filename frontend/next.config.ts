import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the project root so a stray package-lock.json in a parent/home folder is not picked up.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
