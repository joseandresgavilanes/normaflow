import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["supabase.co", "avatars.githubusercontent.com"],
  },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
