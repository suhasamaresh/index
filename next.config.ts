import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    console.log(config);
    config.module.rules.map((rule: any) => console.log(JSON.stringify(rule)));
    return config;
  },
};

export default nextConfig;
