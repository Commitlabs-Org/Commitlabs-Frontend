/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // ioredis is an optional production dependency — exclude it from the
      // bundle so webpack doesn't error when it isn't installed.
      config.externals = Array.isArray(config.externals)
        ? ['ioredis', ...config.externals]
        : ['ioredis'];
    }
    return config;
  },
}

module.exports = nextConfig

