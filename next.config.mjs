/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bonjour-service hanya dipakai di Node runtime; jangan di-bundle.
  serverExternalPackages: ["bonjour-service"],
};

export default nextConfig;
