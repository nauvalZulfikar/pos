/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['postgres', 'pino', 'pino-pretty', 'argon2'],
  transpilePackages: ['@desain/ui', '@desain/domain', '@desain/types', '@desain/db'],
  webpack: (config) => {
    // Workspace packages export TS source with `.js` import specifiers (NodeNext-style).
    // Webpack needs to know to also try `.ts` / `.tsx` when an `.js` extension is seen.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
