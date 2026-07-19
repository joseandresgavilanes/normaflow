import { request, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL as string | undefined;
  if (!baseURL) return;

  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });

  try {
    await api.post("/api/auth/login", {
      timeout: 120000,
      data: {
        email: "demo@normaflow.io",
        password: "NormaFlow2025!",
      },
    });

    await api.get("/app/dashboard", { timeout: 120000 });
    await api.get("/app/risks", { timeout: 120000 });
    await api.get("/app/documents", { timeout: 120000 });
    await api.get("/app/gap", { timeout: 120000 });
    await api.get("/app/setup", { timeout: 120000 });
    await api.get("/app/billing", { timeout: 120000 });
    await api.get("/app/training", { timeout: 120000 });
    await api.get("/forgot-password", { timeout: 120000 });
    await api.get("/pricing", { timeout: 120000 });
    await api.get("/home", {
      timeout: 120000,
      headers: {
        Cookie: "nf_locale=es",
      },
    });
  } finally {
    await api.dispose();
  }
}
