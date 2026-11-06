/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@electric-sql/pglite', 'pg'],
    outputFileTracingIncludes: {
      '/**': ['./supabase/migrations/**/*'],
    },
  },
};

export default nextConfig;
