import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // La validación de Storage limita cada archivo a 50 MB; el margen cubre
    // el sobrecoste multipart de las Server Actions de documentos/evidencias.
    serverActions: { bodySizeLimit: "55mb" },
  },
  images: {
    domains: ["supabase.co", "avatars.githubusercontent.com"],
  },
  serverExternalPackages: ["@prisma/client"],
  async redirects() {
    return [
      // Rutas índice de secciones que solo tienen sub-páginas.
      { source: "/app/catalogs", destination: "/app/catalogs/locations", permanent: false },
      { source: "/app/info", destination: "/app/info/personnel", permanent: false },
    ];
  },
};

export default nextConfig;
