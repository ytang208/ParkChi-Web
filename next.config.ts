import type { NextConfig } from 'next';

const repositoryBase = process.env.GITHUB_ACTIONS ? '/ParkChi-Web' : '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: repositoryBase,
  assetPrefix: repositoryBase,
};

export default nextConfig;
