import type { SessionProfile, WorkspaceState } from "@/context/WorkspaceStore";

/** Incrementar al cambiar el shape del seed para forzar recarga de datos demo enlazados. */
export const WORKSPACE_PERSIST_VERSION = 3;

type PersistedPayload = {
  v: number;
  savedAt: string;
  state: Omit<WorkspaceState, "toast" | "demoOrganizations">;
};

export function workspaceStorageKey(profile: SessionProfile): string {
  const kind = profile.workspaceKind ?? "demo";
  return `normaflow:workspace:v${WORKSPACE_PERSIST_VERSION}:${kind}:${profile.activeOrgId}`;
}

export function loadPersistedWorkspace(profile: SessionProfile): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(workspaceStorageKey(profile));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPayload;
    if (parsed.v !== WORKSPACE_PERSIST_VERSION || !parsed.state) return null;
    return {
      ...parsed.state,
      toast: null,
      demoOrganizations: [],
    } as WorkspaceState;
  } catch {
    return null;
  }
}

export function savePersistedWorkspace(profile: SessionProfile, state: WorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    const { toast: _toast, demoOrganizations: _orgs, ...rest } = state;
    const payload: PersistedPayload = {
      v: WORKSPACE_PERSIST_VERSION,
      savedAt: new Date().toISOString(),
      state: rest,
    };
    localStorage.setItem(workspaceStorageKey(profile), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedWorkspace(profile: SessionProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(workspaceStorageKey(profile));
  } catch {
    /* ignore */
  }
}

export function mergePersistedWithSeed(
  seeded: WorkspaceState,
  persisted: WorkspaceState,
  profile: SessionProfile,
): WorkspaceState {
  return {
    ...persisted,
    session: {
      ...persisted.session,
      name: profile.name,
      email: profile.email,
      orgName: profile.orgName,
      roleKey: profile.roleKey,
      roleLabel: profile.roleLabel,
      activeOrgId: profile.activeOrgId,
      workspaceKind: profile.workspaceKind,
      plan: profile.plan,
    },
    demoOrganizations: seeded.demoOrganizations,
    toast: null,
  };
}
