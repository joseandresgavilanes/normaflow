"use client";
import { useState } from "react";

const DEMO_USER = {
  id: "u_demo_ana",
  name: "Ana García",
  email: "demo@normaflow.io",
  role: "COMPLIANCE_MANAGER" as const,
  organizationId: "org_demo_tecnoserv",
};

export function useUser() {
  const [user] = useState(DEMO_USER);
  // In production: use Supabase auth.getUser()
  return { user, loading: false };
}
