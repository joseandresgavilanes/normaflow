import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { demoCookieName, verifyDemoSession } from "@/lib/demo-auth";
import { isAuthDemoMode, isSupabaseConfigured, sessionSecret } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Organization, Role, User } from "@prisma/client";

export type LiveAppContext = {
  mode: "live";
  user: User;
  organization: Organization;
  role: Role;
  memberships: { organizationId: string; organizationName: string; role: Role }[];
};

export type DemoAppContext = {
  mode: "demo";
  email: string;
};

export type NeedsOrgContext = {
  mode: "needs_organization";
  user: User;
};

export type AppContext = LiveAppContext | DemoAppContext | NeedsOrgContext;

async function emailFromSession(): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) return user.email;
    } catch {
      /* fall through */
    }
  }
  if (isAuthDemoMode()) {
    const raw = (await cookies()).get(demoCookieName)?.value;
    if (raw) {
      const email = verifyDemoSession(raw, sessionSecret());
      if (email) return email;
    }
  }
  return null;
}

export async function getAppContext(): Promise<AppContext | null> {
  const email = await emailFromSession();
  if (!email) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });
    if (!user) {
      if (isAuthDemoMode()) return { mode: "demo", email };
      return null;
    }
    if (user.memberships.length === 0) {
      return { mode: "needs_organization", user };
    }

    const orgIdCookie = (await cookies()).get("nf_org")?.value;
    const membership =
      user.memberships.find(m => m.organizationId === orgIdCookie) ?? user.memberships[0];

    return {
      mode: "live",
      user,
      organization: membership.organization,
      role: membership.role,
      memberships: user.memberships.map(m => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
      })),
    };
  } catch {
    if (isAuthDemoMode()) return { mode: "demo", email };
    return null;
  }
}
