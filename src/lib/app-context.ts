import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_CREDENTIALS, DEMO_CREDENTIALS } from "@/lib/constants";
import { demoCookieName, verifyDemoSession } from "@/lib/demo-auth";
import { DEMO_ORGANIZATIONS, getDemoOrg } from "@/lib/demo/organizations";
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
  workspaceKind: "demo" | "blank";
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; plan: string };
  role: Role;
  memberships: { organizationId: string; organizationName: string; role: Role }[];
};

export type NeedsOrgContext = {
  mode: "needs_organization";
  user: User;
};

export type AppContext = LiveAppContext | DemoAppContext | NeedsOrgContext;

const DEMO_ROLES: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "COMPLIANCE_MANAGER", "AUDITOR", "CONTRIBUTOR", "VIEWER"];

function normalizeDemoRole(role: string | undefined): Role {
  const key = role?.trim().toUpperCase().replace(/\s+/g, "_");
  return DEMO_ROLES.includes(key as Role) ? (key as Role) : "ORG_ADMIN";
}

function configuredDemoEmail(): string {
  return process.env.DEMO_EMAIL || DEMO_CREDENTIALS.email;
}

function configuredCustomerEmail(): string {
  return process.env.CUSTOMER_EMAIL || CUSTOMER_CREDENTIALS.email;
}

function localContextForEmail(email: string): DemoAppContext | null {
  if (email === configuredDemoEmail()) return demoContext(email);
  if (email === configuredCustomerEmail()) return blankContext(email);
  return null;
}

function demoContext(email: string): DemoAppContext {
  const org = getDemoOrg(process.env.DEMO_ORG_ID || "org_tecnoserv") ?? DEMO_ORGANIZATIONS[0];
  return {
    mode: "demo",
    workspaceKind: "demo",
    user: {
      id: "demo-local",
      name: process.env.DEMO_NAME || "Ana García",
      email,
    },
    organization: {
      id: org.id,
      name: org.name,
      plan: org.plan,
    },
    role: normalizeDemoRole(process.env.DEMO_ROLE),
    memberships: DEMO_ORGANIZATIONS.map(o => ({
      organizationId: o.id,
      organizationName: o.name,
      role: normalizeDemoRole(process.env.DEMO_ROLE),
    })),
  };
}

function blankContext(email: string): DemoAppContext {
  const role = normalizeDemoRole(process.env.CUSTOMER_ROLE);
  const orgName = process.env.CUSTOMER_ORG_NAME || "Mi Organización";
  const orgId = process.env.CUSTOMER_ORG_ID || "org_customer";
  return {
    mode: "demo",
    workspaceKind: "blank",
    user: {
      id: "customer-local",
      name: process.env.CUSTOMER_NAME || "Admin Cliente",
      email,
    },
    organization: {
      id: orgId,
      name: orgName,
      plan: process.env.CUSTOMER_PLAN || "GROWTH",
    },
    role,
    memberships: [
      {
        organizationId: orgId,
        organizationName: orgName,
        role,
      },
    ],
  };
}

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

  const localContext = isAuthDemoMode() ? localContextForEmail(email) : null;
  if (localContext) return localContext;

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
    return null;
  }
}
