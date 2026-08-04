import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright can run alongside a developer's Next.js process without both
  // servers writing to the same incremental-build directory.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  experimental: {
    // La validación de Storage limita cada archivo a 50 MB; el margen cubre
    // el sobrecoste multipart de las Server Actions de documentos/evidencias.
    serverActions: { bodySizeLimit: "55mb" },
    // Mantiene en memoria del navegador las respuestas dinámicas visitadas
    // recientemente. Las mutaciones llaman router.refresh(), por lo que los
    // cambios guardados siguen invalidando la vista actual.
    staleTimes: { dynamic: 30 },
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
