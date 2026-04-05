"use client";
import { useState, useEffect } from "react";
import { DEMO_ORG } from "@/lib/demo-data";

export function useOrganization() {
  const [org, setOrg] = useState(DEMO_ORG);
  const [loading, setLoading] = useState(false);
  // In production: fetch from Supabase based on current user's membership
  return { org, loading };
}
